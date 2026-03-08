"""
Conversation Service for N3xFin

Handles natural language Q&A about user finances using AI.
"""

from datetime import datetime, timedelta, UTC
from decimal import Decimal
from typing import Dict, List, Optional
import boto3
from boto3.dynamodb.conditions import Key
import json

from common.config import Config
from common.errors import ValidationError
from profile.profile_service import ProfileService


class ConversationService:
    """Service for conversational Q&A about finances."""
    
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb')
        self.transactions_table = self.dynamodb.Table(Config.DYNAMODB_TABLE_TRANSACTIONS)
        self.conversations_table = self.dynamodb.Table(Config.DYNAMODB_TABLE_CONVERSATIONS)
        self.bedrock = boto3.client('bedrock-runtime', region_name=Config.BEDROCK_REGION)
    
    def ask_question(
        self,
        user_id: str,
        question: str,
        conversation_history: Optional[List[Dict]] = None
    ) -> Dict:
        """
        Answer a user's financial question using AI.
        
        Args:
            user_id: User identifier
            question: User's question
            conversation_history: Previous messages in conversation
            
        Returns:
            Response with answer, confidence, and sources
        """
        if not question or len(question.strip()) == 0:
            raise ValidationError("Question cannot be empty")
        
        # Get relevant financial context
        context = self.get_relevant_context(user_id, question)
        
        # Build conversation history
        if conversation_history is None:
            conversation_history = self._get_recent_conversation_history(user_id)
        
        # Generate response using Bedrock
        response = self._generate_ai_response(question, context, conversation_history)
        
        # Store conversation
        self._store_conversation(user_id, question, response['answer'], context)
        
        return response
    
    def get_relevant_context(self, user_id: str, question: str) -> Dict:
        """
        Retrieve relevant financial data based on the question.
        
        Args:
            user_id: User identifier
            question: User's question
            
        Returns:
            Financial context including transactions, summaries, profile, and goals
        """
        # Get user profile for personalized context
        profile_summary = ProfileService.get_profile_summary(user_id)
        
        # Get full profile to access goals
        profile = ProfileService.get_profile(user_id)
        goals = profile.get('goals', []) if profile else []
        active_goals = [g for g in goals if g.get('status') == 'active']
        
        # Determine time range based on question keywords
        time_range = self._detect_time_range(question)
        
        # Get transactions for the time range
        transactions = self._get_transactions_in_range(
            user_id,
            time_range['start'],
            time_range['end']
        )
        
        # Analyze spending by category
        category_totals = self._calculate_category_totals(transactions)
        
        # Get total spending
        total_spending = sum(data['total'] for data in category_totals.values())
        
        return {
            'profile': profile_summary,
            'goals': active_goals,
            'goalCount': len(active_goals),
            'timeRange': {
                'start': time_range['start'].isoformat(),
                'end': time_range['end'].isoformat(),
                'description': time_range['description']
            },
            'transactionCount': len(transactions),
            'totalSpending': float(total_spending),
            'categoryTotals': {
                cat: {
                    'total': float(data['total']),
                    'count': data['count'],
                    'percentage': round((float(data['total']) / float(total_spending) * 100), 1) if total_spending > 0 else 0
                }
                for cat, data in category_totals.items()
            },
            'recentTransactions': [
                {
                    'date': txn['date'],
                    'description': txn['description'],
                    'amount': float(txn['amount']),
                    'category': txn.get('category', 'Other')
                }
                for txn in transactions[:10]  # Include up to 10 recent transactions
            ]
        }
    
    def _detect_time_range(self, question: str) -> Dict:
        """Detect time range from question keywords."""
        question_lower = question.lower()
        end_date = datetime.now(UTC)
        
        # Check for specific time periods
        if 'today' in question_lower:
            start_date = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
            description = 'today'
        elif 'this week' in question_lower or 'week' in question_lower:
            start_date = end_date - timedelta(days=7)
            description = 'this week'
        elif 'this month' in question_lower or 'month' in question_lower:
            start_date = end_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            description = 'this month'
        elif 'last month' in question_lower:
            # Previous calendar month — use UTC-aware datetimes
            first_of_this_month = end_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            last_of_prev_month = first_of_this_month - timedelta(seconds=1)
            start_date = last_of_prev_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end_date = last_of_prev_month
            description = 'last month'
        elif 'year' in question_lower or 'annual' in question_lower:
            start_date = datetime(end_date.year, 1, 1)
            description = 'this year'
        else:
            # Default to last 30 days
            start_date = end_date - timedelta(days=30)
            description = 'last 30 days'
        
        return {
            'start': start_date,
            'end': end_date,
            'description': description
        }
    
    def _get_transactions_in_range(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict]:
        """Query transactions within a date range using the SK date prefix format."""
        # SK format is TRANSACTION#YYYY-MM-DD#<uuid> — must match this exactly
        start_str = start_date.strftime('%Y-%m-%d')
        end_str = end_date.strftime('%Y-%m-%d')
        items = []
        kwargs = dict(
            KeyConditionExpression=Key('PK').eq(f'USER#{user_id}') &
                                   Key('SK').between(
                                       f'TRANSACTION#{start_str}',
                                       f'TRANSACTION#{end_str}~'
                                   )
        )
        while True:
            response = self.transactions_table.query(**kwargs)
            items.extend(response.get('Items', []))
            if 'LastEvaluatedKey' not in response:
                break
            kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
        return items
    
    def _calculate_category_totals(self, transactions: List[Dict]) -> Dict:
        """Calculate spending totals by category."""
        category_data = {}
        
        for txn in transactions:
            amount = Decimal(str(txn.get('amount', 0)))
            # Only count expenses
            if amount < 0:
                category = txn.get('category', 'Other')
                if category not in category_data:
                    category_data[category] = {
                        'total': Decimal('0'),
                        'count': 0
                    }
                
                category_data[category]['total'] += abs(amount)
                category_data[category]['count'] += 1
        
        return category_data
    
    def _generate_ai_response(
        self,
        question: str,
        context: Dict,
        conversation_history: List[Dict]
    ) -> Dict:
        """Generate AI response using Bedrock."""
        try:
            # Build conversation messages
            messages = []
            
            # Add conversation history (limited to last 5 exchanges)
            for msg in conversation_history[-5:]:
                messages.append({
                    "role": msg['role'],
                    "content": msg['content']
                })
            
            # Build context summary
            context_summary = self._build_context_summary(context)
            
            # Add current question with context
            user_message = f"""Question: {question}

Financial Context:
{context_summary}

Please provide a clear, concise answer based on the financial data provided. If the data doesn't contain enough information to answer the question, explain what information is missing."""
            
            messages.append({
                "role": "user",
                "content": user_message
            })
            
            # Call Bedrock
            request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "messages": messages,
                "temperature": 0.7,
                "system": """You are a knowledgeable personal financial advisor with expertise in budgeting, spending analysis, and financial planning. 

Your role:
- Analyze the user's transaction data AND their financial profile (goals, income, debts, occupation) to provide personalized, actionable financial advice
- Give specific, data-driven recommendations based on their actual spending patterns and stated financial goals
- Help users achieve their specific goals (e.g., paying off debt, saving for college, building emergency fund)
- Consider their income sources and occupation when suggesting ways to increase income
- Be empathetic and non-judgmental about spending habits
- Provide practical tips that are realistic and achievable given their financial situation
- When suggesting savings, be specific about amounts, categories, and how it helps their goals
- Always relate advice back to goal progress (e.g., "Cutting dining by $200/month gets you to your college fund goal 8 months faster")
- If asked about investments or complex financial products, acknowledge you're focused on spending analysis and budgeting
- Always base your advice on the actual data provided - don't make assumptions
- If data is insufficient, clearly explain what additional information would help

CRITICAL - Handling Goal Questions:
- When user asks about "my goal" or "how to achieve my goal":
  * If they have EXACTLY ONE active goal: Answer directly about that specific goal
  * If they have MULTIPLE goals: List them as a), b), c), etc. and ask which one they want to discuss
  * If they have NO goals: Politely explain they haven't set up any financial goals yet and suggest they add goals in their profile
- Always check the "Active Financial Goals" section in the context
- Use the goal labels (a, b, c) provided in the context when listing multiple goals
- Be specific about goal progress, target amounts, and deadlines

Guidelines:
- Keep responses concise (2-3 paragraphs max)
- Use specific numbers from their data when relevant
- Prioritize actionable advice over general tips
- Be encouraging and supportive
- Focus on spending optimization and goal achievement, not investment advice
- If they have an occupation listed, you can suggest career-related income opportunities (e.g., freelancing, side gigs relevant to their field)"""
            }
            
            response = self.bedrock.invoke_model(
                modelId=Config.BEDROCK_MODEL_ID,
                body=json.dumps(request_body)
            )
            
            response_body = json.loads(response['body'].read())
            answer = response_body['content'][0]['text']
            
            # Calculate confidence based on data availability
            confidence = self._calculate_confidence(context)
            
            return {
                'answer': answer,
                'confidence': confidence,
                'sources': [context['timeRange']['description']],
                'context': context
            }
        
        except Exception as e:
            print(f"Error generating AI response: {str(e)}")
            # Return fallback response
            return {
                'answer': "I'm having trouble processing your question right now. Please try rephrasing it or ask something else.",
                'confidence': 0.0,
                'sources': [],
                'context': context
            }
    
    def _build_context_summary(self, context: Dict) -> str:
        """Build a text summary of financial context."""
        summary_parts = []
        
        # User profile
        if context.get('profile'):
            summary_parts.append("User Profile:")
            summary_parts.append(context['profile'])
            summary_parts.append("")
        
        # Financial Goals - IMPORTANT for context
        goals = context.get('goals', [])
        if goals:
            summary_parts.append(f"Active Financial Goals ({len(goals)}):")
            for idx, goal in enumerate(goals, 1):
                goal_name = goal.get('name', 'Unnamed goal')
                goal_type = goal.get('type', 'Unknown')
                target = goal.get('target_amount', 0)
                current = goal.get('current_amount', 0)
                deadline = goal.get('deadline', 'No deadline')
                priority = goal.get('priority', 'medium')
                progress = (current / target * 100) if target > 0 else 0
                
                summary_parts.append(
                    f"  {chr(96 + idx)}) {goal_name} ({goal_type}): "
                    f"${current:,.2f} / ${target:,.2f} ({progress:.1f}% complete) "
                    f"[Priority: {priority}, Deadline: {deadline}]"
                )
            summary_parts.append("")
        
        # Time range
        summary_parts.append(f"Time Period: {context['timeRange']['description']}")
        
        # Total spending
        summary_parts.append(f"Total Spending: ${context['totalSpending']:.2f}")
        summary_parts.append(f"Number of Transactions: {context['transactionCount']}")
        
        # Category breakdown
        if context['categoryTotals']:
            summary_parts.append("\nSpending by Category:")
            for category, data in sorted(
                context['categoryTotals'].items(),
                key=lambda x: x[1]['total'],
                reverse=True
            ):
                summary_parts.append(
                    f"  - {category}: ${data['total']:.2f} ({data['percentage']:.1f}%) - {data['count']} transactions"
                )
        
        # Recent transactions
        if context['recentTransactions']:
            summary_parts.append("\nRecent Transactions:")
            for txn in context['recentTransactions'][:5]:
                summary_parts.append(
                    f"  - {txn['date']}: {txn['description']} - ${abs(txn['amount']):.2f} ({txn['category']})"
                )
        
        return "\n".join(summary_parts)
    
    def _calculate_confidence(self, context: Dict) -> float:
        """Calculate confidence score based on available data."""
        # Base confidence on amount of data
        txn_count = context['transactionCount']
        
        if txn_count == 0:
            return 0.0
        elif txn_count < 5:
            return 0.3
        elif txn_count < 20:
            return 0.6
        elif txn_count < 50:
            return 0.8
        else:
            return 0.95
    
    def _get_recent_conversation_history(self, user_id: str) -> List[Dict]:
        """Get recent conversation history for context."""
        try:
            response = self.conversations_table.query(
                KeyConditionExpression=Key('PK').eq(f'USER#{user_id}') & Key('SK').begins_with('CONVERSATION#'),
                ScanIndexForward=False,  # Most recent first
                Limit=Config.MAX_CONVERSATION_HISTORY
            )
            
            conversations = response.get('Items', [])
            
            # Convert to message format
            messages = []
            for conv in reversed(conversations):  # Oldest first
                messages.append({
                    'role': 'user',
                    'content': conv['question']
                })
                messages.append({
                    'role': 'assistant',
                    'content': conv['answer']
                })
            
            return messages
        except Exception as e:
            print(f"Error retrieving conversation history: {str(e)}")
            return []
    
    def _store_conversation(
        self,
        user_id: str,
        question: str,
        answer: str,
        context: Dict
    ):
        """Store conversation in DynamoDB."""
        try:
            timestamp = datetime.now(UTC).isoformat()
            
            self.conversations_table.put_item(
                Item={
                    'PK': f'USER#{user_id}',
                    'SK': f'CONVERSATION#{timestamp}',
                    'userId': user_id,
                    'timestamp': timestamp,
                    'question': question,
                    'answer': answer,
                    'context': json.dumps(context),
                    'createdAt': timestamp
                }
            )
        except Exception as e:
            print(f"Error storing conversation: {str(e)}")
            # Don't fail the request if storage fails
