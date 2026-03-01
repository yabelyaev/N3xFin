"""
Prediction Service for N3xFin

Generates spending forecasts and alerts based on historical patterns.
"""

from datetime import datetime, timedelta, UTC
from decimal import Decimal
from typing import Dict, List, Optional
from collections import defaultdict
import boto3
from boto3.dynamodb.conditions import Key
import json

from common.config import Config
from common.errors import ValidationError


class PredictionService:
    """Service for predicting spending and generating alerts."""
    
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb')
        self.transactions_table = self.dynamodb.Table(Config.DYNAMODB_TABLE_TRANSACTIONS)
        self.bedrock = boto3.client('bedrock-runtime', region_name=Config.BEDROCK_REGION)
    
    def predict_spending(
        self,
        user_id: str,
        category: str,
        horizon_days: int = 30
    ) -> Dict:
        """
        Predict spending for a category over the next N days.
        
        Uses simple moving average of historical data.
        
        Args:
            user_id: User identifier
            category: Category to predict
            horizon_days: Number of days to predict (default 30)
            
        Returns:
            Prediction with amount, confidence, and historical average
        """
        # Get historical data (last 90 days)
        end_date = datetime.now(UTC)
        start_date = end_date - timedelta(days=90)
        
        transactions = self._get_transactions_in_range(user_id, start_date, end_date)
        
        # Filter by category and calculate spending
        category_spending = []
        for txn in transactions:
            if txn.get('category') == category:
                amount = abs(Decimal(str(txn.get('amount', 0))))
                if amount > 0:
                    category_spending.append(float(amount))
        
        if len(category_spending) < 5:
            # Not enough data for prediction
            return {
                'category': category,
                'predictedAmount': 0.0,
                'confidence': 0.0,
                'horizon': horizon_days,
                'historicalAverage': 0.0,
                'message': 'Insufficient historical data for prediction'
            }
        
        # Calculate moving average
        historical_avg = sum(category_spending) / len(category_spending)
        
        # Scale to prediction horizon (simple linear scaling)
        days_in_history = 90
        predicted_amount = (historical_avg * len(category_spending) / days_in_history) * horizon_days
        
        # Confidence based on data consistency (inverse of coefficient of variation)
        if historical_avg > 0:
            std_dev = (sum((x - historical_avg) ** 2 for x in category_spending) / len(category_spending)) ** 0.5
            cv = std_dev / historical_avg
            confidence = max(0.0, min(1.0, 1.0 - cv))
        else:
            confidence = 0.0
        
        return {
            'category': category,
            'predictedAmount': round(predicted_amount, 2),
            'confidence': round(confidence, 2),
            'horizon': horizon_days,
            'historicalAverage': round(historical_avg, 2),
            'dataPoints': len(category_spending)
        }
    
    def generate_alerts(self, user_id: str) -> List[Dict]:
        """
        Generate spending alerts for categories exceeding thresholds.
        
        Args:
            user_id: User identifier
            
        Returns:
            List of alerts with predictions and recommendations
        """
        # Get all categories from recent transactions
        end_date = datetime.now(UTC)
        start_date = end_date - timedelta(days=30)
        
        transactions = self._get_transactions_in_range(user_id, start_date, end_date)
        
        # Get unique categories
        categories = set()
        for txn in transactions:
            category = txn.get('category')
            if category and category != 'Income':
                categories.add(category)
        
        alerts = []
        
        # Generate predictions for each category
        for category in categories:
            prediction = self.predict_spending(user_id, category, horizon_days=30)
            
            # Skip if insufficient data
            if prediction['confidence'] < 0.3:
                continue
            
            # Calculate historical average for comparison
            historical_avg = prediction['historicalAverage'] * prediction.get('dataPoints', 0) / 90 * 30
            
            # Generate alert if predicted spending exceeds threshold
            threshold_percentage = Config.ALERT_THRESHOLD_PERCENTAGE
            if prediction['predictedAmount'] > historical_avg * (threshold_percentage / 100):
                severity = self._calculate_severity(
                    prediction['predictedAmount'],
                    historical_avg
                )
                
                # Generate recommendations using Bedrock
                recommendations = self._generate_recommendations(
                    category,
                    prediction['predictedAmount'],
                    historical_avg
                )
                
                alerts.append({
                    'id': f"alert-{user_id}-{category}-{datetime.now(UTC).timestamp()}",
                    'userId': user_id,
                    'category': category,
                    'message': f"Your {category} spending is predicted to be ${prediction['predictedAmount']:.2f} "
                              f"in the next 30 days, which is {((prediction['predictedAmount'] / historical_avg - 1) * 100):.0f}% "
                              f"higher than your average of ${historical_avg:.2f}",
                    'predictedAmount': prediction['predictedAmount'],
                    'historicalAverage': round(historical_avg, 2),
                    'severity': severity,
                    'recommendations': recommendations,
                    'confidence': prediction['confidence'],
                    'createdAt': datetime.now(UTC).isoformat()
                })
        
        # Sort by severity and predicted amount
        severity_order = {'critical': 3, 'warning': 2, 'info': 1}
        alerts.sort(
            key=lambda x: (severity_order.get(x['severity'], 0), x['predictedAmount']),
            reverse=True
        )
        
        return alerts
    
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
    
    def _calculate_severity(self, predicted: float, historical: float) -> str:
        """Calculate alert severity based on deviation from historical average."""
        if historical == 0:
            return 'info'
        
        ratio = predicted / historical
        
        if ratio >= 1.5:
            return 'critical'
        elif ratio >= 1.3:
            return 'warning'
        else:
            return 'info'
    
    def _generate_recommendations(
        self,
        category: str,
        predicted_amount: float,
        historical_avg: float
    ) -> List[str]:
        """
        Generate actionable recommendations using Bedrock.
        
        Args:
            category: Spending category
            predicted_amount: Predicted spending amount
            historical_avg: Historical average spending
            
        Returns:
            List of recommendation strings
        """
        try:
            prompt = f"""You are a financial advisor. A user's {category} spending is predicted to be ${predicted_amount:.2f} in the next 30 days, which is significantly higher than their average of ${historical_avg:.2f}.

Provide 2-3 specific, actionable recommendations to help them reduce spending in this category. Be concise and practical.

Respond with a JSON array of strings, each containing one recommendation.
Example: ["Recommendation 1", "Recommendation 2", "Recommendation 3"]"""

            request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 500,
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
            # Handle markdown code blocks
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                content = content.split('```')[1].split('```')[0].strip()
            
            recommendations = json.loads(content)
            
            if isinstance(recommendations, list):
                return recommendations[:3]  # Limit to 3 recommendations
            else:
                return [str(recommendations)]
        
        except Exception as e:
            print(f"Error generating recommendations: {str(e)}")
            # Fallback recommendations
            return [
                f"Review your {category} expenses and identify areas to cut back",
                f"Set a budget limit for {category} spending",
                f"Track your {category} purchases more carefully"
            ]
