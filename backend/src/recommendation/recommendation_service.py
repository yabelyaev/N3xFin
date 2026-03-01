"""
Recommendation Service for N3xFin

Generates personalized savings recommendations based on spending patterns.
"""

from datetime import datetime, timedelta, UTC
from decimal import Decimal
from typing import Dict, List, Optional
import boto3
from boto3.dynamodb.conditions import Key
import json

from common.config import Config
from common.errors import ValidationError


class RecommendationService:
    """Service for generating personalized savings recommendations."""
    
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb')
        self.transactions_table = self.dynamodb.Table(Config.DYNAMODB_TABLE_TRANSACTIONS)
        self.bedrock = boto3.client('bedrock-runtime', region_name=Config.BEDROCK_REGION)
    
    def generate_recommendations(self, user_id: str) -> List[Dict]:
        """
        Generate personalized savings recommendations.
        
        Analyzes spending patterns and uses AI to suggest specific actions.
        
        Args:
            user_id: User identifier
            
        Returns:
            List of recommendations ranked by potential savings
        """
        # Get spending data for last 30 days
        end_date = datetime.now(UTC)
        start_date = end_date - timedelta(days=30)
        
        transactions = self._get_transactions_in_range(user_id, start_date, end_date)
        
        if len(transactions) < 5:
            return [{
                'id': 'insufficient-data',
                'title': 'Insufficient Data',
                'description': 'Upload more bank statements to receive personalized recommendations',
                'category': 'General',
                'potentialSavings': 0.0,
                'actionItems': ['Upload at least 30 days of transaction history'],
                'priority': 1
            }]
        
        # Analyze spending by category
        category_spending = self._analyze_category_spending(transactions)
        
        # Calculate total spending
        total_spending = sum(data['total'] for data in category_spending.values())
        
        if total_spending == 0:
            return []
        
        # Generate recommendations using Bedrock
        recommendations = self._generate_ai_recommendations(
            category_spending,
            total_spending
        )
        
        # Rank recommendations by potential savings
        ranked_recommendations = self.rank_recommendations(recommendations)
        
        return ranked_recommendations
    
    def rank_recommendations(self, recommendations: List[Dict]) -> List[Dict]:
        """
        Rank recommendations by potential savings amount.
        
        Args:
            recommendations: List of recommendation dictionaries
            
        Returns:
            Sorted list with highest savings first
        """
        # Sort by potential savings (descending) and priority (descending)
        sorted_recs = sorted(
            recommendations,
            key=lambda x: (x.get('potentialSavings', 0), x.get('priority', 0)),
            reverse=True
        )
        
        return sorted_recs
    
    def _get_transactions_in_range(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict]:
        """Query transactions within a date range."""
        response = self.transactions_table.query(
            KeyConditionExpression=Key('PK').eq(f'USER#{user_id}') & 
                                 Key('SK').between(
                                     f'TRANSACTION#{start_date.isoformat()}',
                                     f'TRANSACTION#{end_date.isoformat()}~'
                                 )
        )
        return response.get('Items', [])
    
    def _analyze_category_spending(self, transactions: List[Dict]) -> Dict:
        """Analyze spending by category."""
        category_data = {}
        
        for txn in transactions:
            amount = Decimal(str(txn.get('amount', 0)))
            # Only analyze expenses (negative amounts)
            if amount < 0:
                category = txn.get('category', 'Other')
                if category not in category_data:
                    category_data[category] = {
                        'total': Decimal('0'),
                        'count': 0,
                        'transactions': []
                    }
                
                category_data[category]['total'] += abs(amount)
                category_data[category]['count'] += 1
                category_data[category]['transactions'].append(txn)
        
        return category_data
    
    def _generate_ai_recommendations(
        self,
        category_spending: Dict,
        total_spending: Decimal
    ) -> List[Dict]:
        """
        Generate recommendations using Bedrock AI.
        
        Args:
            category_spending: Spending data by category
            total_spending: Total spending amount
            
        Returns:
            List of recommendation dictionaries
        """
        try:
            # Prepare spending summary for AI
            spending_summary = []
            for category, data in sorted(
                category_spending.items(),
                key=lambda x: x[1]['total'],
                reverse=True
            ):
                percentage = (float(data['total']) / float(total_spending)) * 100
                spending_summary.append({
                    'category': category,
                    'amount': float(data['total']),
                    'percentage': round(percentage, 1),
                    'transactionCount': data['count']
                })
            
            prompt = f"""You are a financial advisor analyzing a user's spending patterns. Based on their last 30 days of spending, provide 3-5 specific, actionable savings recommendations.

Spending Summary:
{json.dumps(spending_summary, indent=2)}

Total Spending: ${float(total_spending):.2f}

For each recommendation, provide:
1. A clear, concise title
2. A detailed description explaining why this will save money
3. The category it applies to
4. Estimated monthly savings amount (be realistic)
5. 2-3 specific action items
6. Priority (1-5, where 5 is highest priority)

Respond with a JSON array of recommendations. Each recommendation should have this structure:
{{
  "title": "string",
  "description": "string",
  "category": "string",
  "potentialSavings": number,
  "actionItems": ["string", "string"],
  "priority": number
}}

Focus on the highest spending categories and provide practical, achievable recommendations."""

            request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 2000,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.7
            }
            
            response = self.bedrock.invoke_model(
                modelId=Config.BEDROCK_MODEL_ID,
                body=json.dumps(request_body)
            )
            
            response_body = json.loads(response['body'].read())
            content = response_body['content'][0]['text']
            
            # Parse JSON response
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                content = content.split('```')[1].split('```')[0].strip()
            
            recommendations = json.loads(content)
            
            # Add unique IDs
            for i, rec in enumerate(recommendations):
                rec['id'] = f"rec-{datetime.now(UTC).timestamp()}-{i}"
            
            return recommendations if isinstance(recommendations, list) else [recommendations]
        
        except Exception as e:
            print(f"Error generating AI recommendations: {str(e)}")
            # Fallback to rule-based recommendations
            return self._generate_fallback_recommendations(category_spending, total_spending)
    
    def _generate_fallback_recommendations(
        self,
        category_spending: Dict,
        total_spending: Decimal
    ) -> List[Dict]:
        """Generate basic recommendations when AI fails."""
        recommendations = []
        
        # Sort categories by spending
        sorted_categories = sorted(
            category_spending.items(),
            key=lambda x: x[1]['total'],
            reverse=True
        )
        
        # Generate recommendations for top 3 spending categories
        for i, (category, data) in enumerate(sorted_categories[:3]):
            amount = float(data['total'])
            percentage = (amount / float(total_spending)) * 100
            
            # Estimate 10-20% potential savings
            potential_savings = round(amount * 0.15, 2)
            
            recommendations.append({
                'id': f"fallback-{i}",
                'title': f"Reduce {category} Spending",
                'description': f"Your {category} spending is ${amount:.2f} ({percentage:.1f}% of total). "
                              f"Consider ways to reduce this category.",
                'category': category,
                'potentialSavings': potential_savings,
                'actionItems': [
                    f"Track your {category} expenses more carefully",
                    f"Set a monthly budget for {category}",
                    f"Look for cheaper alternatives in {category}"
                ],
                'priority': 5 - i  # Higher priority for higher spending
            })
        
        return recommendations
