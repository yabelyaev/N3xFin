"""
Conversation Service for N3xFin

Handles natural language Q&A about user finances using AI.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional
import boto3
from boto3.dynamodb.conditions import Key
import json

from common.config import Config
from common.errors import ValidationError


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
            Financial context including transactions and summaries
        """
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
        end_date = datetime.utcnow()
        
        # Check for specific time periods
        if 'today' in question_lower:
            start_date = datetime(end_date.year, end_date.month, end_date.day)
            description = 'today'
        elif 'this week' in question_lower or 'week' in question_lower:
            start_date = end_date - timedelta(days=7)
            description = 'this week'
        elif 'this month' in question_lower or 'month' in question_lower:
            start_date = datetime(end_date.year, end_date.month, 1)
            description = 'this month'
        elif 'last month' in question_lower:
            # Previous month
            if end_date.month == 1:
                start_date = datetime(end_date.year - 1, 12, 1)
                month_end = datetime(end_date.year, 1, 1) - timedelta(days=1)
            else:
                start_date = datetime(end_date.year, end_date.month - 1, 1)
                month_end = datetime(end_date.year, end_date.month, 1) - timedelta(days=1)
            end_date = month_end
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
        """Query transactions within a date range."""
        response = self.transactions_table.query(
            KeyConditionExpression=Key('userId').eq(user_id) & 
                                 Key('date').between(
                                     start_date.isoformat(),
                                     end_date.isoformat()
                                 )
        )
        return response.get('Items', [])
    
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
                "system": "You are a helpful financial assistant. Provide clear, accurate answers about the user's spending based on their transaction data. Be conversational but professional. If you don't have enough data to answer, say so clearly."
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
                KeyConditionExpression=Key('userId').eq(user_id),
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
            timestamp = datetime.utcnow().isoformat()
            
            self.conversations_table.put_item(
                Item={
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
