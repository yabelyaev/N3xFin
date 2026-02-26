"""
Analytics Service for N3xFin

Provides spending aggregation, trend analysis, and anomaly detection.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from collections import defaultdict
import statistics
import boto3
from boto3.dynamodb.conditions import Key, Attr

from common.config import Config
from common.errors import ValidationError


class AnalyticsService:
    """Service for analyzing financial transactions and generating insights."""
    
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb')
        self.transactions_table = self.dynamodb.Table(Config.DYNAMODB_TABLE_TRANSACTIONS)
    
    def get_spending_by_category(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict]:
        """
        Aggregate spending by category for a time range.
        
        Args:
            user_id: User identifier
            start_date: Start of time range
            end_date: End of time range
            
        Returns:
            List of category spending summaries
        """
        transactions = self._get_transactions_in_range(user_id, start_date, end_date)
        
        # Group by category
        category_data = defaultdict(lambda: {'total': Decimal('0'), 'count': 0, 'transactions': []})
        total_spending = Decimal('0')
        
        for txn in transactions:
            # Only count expenses (negative amounts)
            amount = Decimal(str(txn.get('amount', 0)))
            if amount < 0:
                category = txn.get('category', 'Other')
                category_data[category]['total'] += abs(amount)
                category_data[category]['count'] += 1
                category_data[category]['transactions'].append(txn)
                total_spending += abs(amount)
        
        # Calculate percentages and format results
        results = []
        for category, data in category_data.items():
            percentage = float(data['total'] / total_spending * 100) if total_spending > 0 else 0
            results.append({
                'category': category,
                'totalAmount': float(data['total']),
                'transactionCount': data['count'],
                'percentageOfTotal': round(percentage, 2)
            })
        
        # Sort by total amount descending
        results.sort(key=lambda x: x['totalAmount'], reverse=True)
        
        return results
    
    def get_spending_over_time(
        self,
        user_id: str,
        start_date: datetime,
        end_date: datetime,
        granularity: str = 'day'
    ) -> List[Dict]:
        """
        Aggregate spending over time with specified granularity.
        
        Args:
            user_id: User identifier
            start_date: Start of time range
            end_date: End of time range
            granularity: Time bucket size ('day', 'week', 'month')
            
        Returns:
            List of time series data points
        """
        if granularity not in ['day', 'week', 'month']:
            raise ValidationError("Granularity must be 'day', 'week', or 'month'")
        
        transactions = self._get_transactions_in_range(user_id, start_date, end_date)
        
        # Group by time bucket
        time_buckets = defaultdict(lambda: Decimal('0'))
        
        for txn in transactions:
            amount = Decimal(str(txn.get('amount', 0)))
            # Only count expenses
            if amount < 0:
                txn_date = datetime.fromisoformat(txn['date'].replace('Z', '+00:00'))
                bucket_key = self._get_time_bucket(txn_date, granularity)
                time_buckets[bucket_key] += abs(amount)
        
        # Convert to list and sort by timestamp
        results = [
            {
                'timestamp': timestamp.isoformat(),
                'amount': float(amount)
            }
            for timestamp, amount in time_buckets.items()
        ]
        results.sort(key=lambda x: x['timestamp'])
        
        return results
    
    def detect_anomalies(
        self,
        user_id: str,
        transactions: Optional[List[Dict]] = None
    ) -> List[Dict]:
        """
        Detect anomalous transactions using statistical methods.
        
        Args:
            user_id: User identifier
            transactions: Optional list of transactions to analyze
            
        Returns:
            List of detected anomalies
        """
        # Get historical data if not provided (last 90 days)
        if transactions is None:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=90)
            transactions = self._get_transactions_in_range(user_id, start_date, end_date)
        
        # Need minimum data for statistical analysis
        if len(transactions) < 10:
            return []
        
        # Group transactions by category for analysis
        category_amounts = defaultdict(list)
        for txn in transactions:
            amount = abs(Decimal(str(txn.get('amount', 0))))
            if amount > 0:  # Only analyze expenses
                category = txn.get('category', 'Other')
                category_amounts[category].append((txn, float(amount)))
        
        anomalies = []
        
        # Detect anomalies per category using Z-score
        for category, txn_amounts in category_amounts.items():
            if len(txn_amounts) < 5:  # Need minimum samples
                continue
            
            amounts = [amt for _, amt in txn_amounts]
            mean = statistics.mean(amounts)
            
            # Handle case where all amounts are the same
            try:
                stdev = statistics.stdev(amounts)
            except statistics.StatisticsError:
                continue
            
            if stdev == 0:
                continue
            
            # Flag transactions > 2.5 standard deviations from mean
            for txn, amount in txn_amounts:
                z_score = (amount - mean) / stdev
                if abs(z_score) > 2.5:
                    severity = 'high' if abs(z_score) > 3.5 else 'medium' if abs(z_score) > 3.0 else 'low'
                    anomalies.append({
                        'transaction': txn,
                        'reason': f'Amount ${amount:.2f} is {abs(z_score):.1f} standard deviations from category average',
                        'severity': severity,
                        'expectedRange': {
                            'min': round(mean - 2.5 * stdev, 2),
                            'max': round(mean + 2.5 * stdev, 2)
                        },
                        'zScore': round(z_score, 2)
                    })
        
        # Sort by severity and z-score
        severity_order = {'high': 3, 'medium': 2, 'low': 1}
        anomalies.sort(key=lambda x: (severity_order[x['severity']], abs(x['zScore'])), reverse=True)
        
        return anomalies
    
    def calculate_trends(
        self,
        user_id: str,
        category: Optional[str] = None
    ) -> Dict:
        """
        Calculate spending trends by comparing current to previous period.
        
        Args:
            user_id: User identifier
            category: Optional category to analyze (None for all spending)
            
        Returns:
            Trend analysis with direction and percentage change
        """
        # Compare last 30 days to previous 30 days
        end_date = datetime.utcnow()
        current_start = end_date - timedelta(days=30)
        previous_start = current_start - timedelta(days=30)
        
        # Get transactions for both periods
        current_txns = self._get_transactions_in_range(user_id, current_start, end_date)
        previous_txns = self._get_transactions_in_range(user_id, previous_start, current_start)
        
        # Calculate totals
        current_total = self._calculate_total_spending(current_txns, category)
        previous_total = self._calculate_total_spending(previous_txns, category)
        
        # Calculate trend
        if previous_total == 0:
            if current_total == 0:
                direction = 'stable'
                percentage_change = 0.0
            else:
                direction = 'increasing'
                percentage_change = 100.0
        else:
            percentage_change = ((current_total - previous_total) / previous_total) * 100
            
            if abs(percentage_change) < 5:
                direction = 'stable'
            elif percentage_change > 0:
                direction = 'increasing'
            else:
                direction = 'decreasing'
        
        return {
            'direction': direction,
            'percentageChange': round(percentage_change, 2),
            'comparisonPeriod': 'last 30 days vs previous 30 days',
            'currentTotal': float(current_total),
            'previousTotal': float(previous_total),
            'category': category or 'all'
        }
    
    def store_anomaly_feedback(
        self,
        user_id: str,
        transaction_id: str,
        is_legitimate: bool,
        notes: Optional[str] = None
    ) -> Dict:
        """
        Store user feedback on anomaly detection.
        
        Args:
            user_id: User identifier
            transaction_id: Transaction ID
            is_legitimate: Whether user confirms transaction is legitimate
            notes: Optional user notes
            
        Returns:
            Confirmation of stored feedback
        """
        feedback_item = {
            'userId': user_id,
            'transactionId': transaction_id,
            'isLegitimate': is_legitimate,
            'feedbackTimestamp': datetime.utcnow().isoformat(),
            'notes': notes or ''
        }
        
        # Update the transaction with feedback
        try:
            self.transactions_table.update_item(
                Key={
                    'userId': user_id,
                    'date': transaction_id.split('#')[0] if '#' in transaction_id else transaction_id
                },
                UpdateExpression='SET anomalyFeedback = :feedback',
                ExpressionAttributeValues={
                    ':feedback': feedback_item
                }
            )
            
            return {
                'success': True,
                'transactionId': transaction_id,
                'feedback': feedback_item
            }
        except Exception as e:
            raise ValidationError(f"Failed to store anomaly feedback: {str(e)}")
    
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
    
    def _get_time_bucket(self, date: datetime, granularity: str) -> datetime:
        """Convert a date to a time bucket based on granularity."""
        if granularity == 'day':
            return datetime(date.year, date.month, date.day)
        elif granularity == 'week':
            # Start of week (Monday)
            start_of_week = date - timedelta(days=date.weekday())
            return datetime(start_of_week.year, start_of_week.month, start_of_week.day)
        elif granularity == 'month':
            return datetime(date.year, date.month, 1)
        else:
            raise ValidationError(f"Invalid granularity: {granularity}")
    
    def _calculate_total_spending(
        self,
        transactions: List[Dict],
        category: Optional[str] = None
    ) -> Decimal:
        """Calculate total spending from transactions, optionally filtered by category."""
        total = Decimal('0')
        for txn in transactions:
            # Filter by category if specified
            if category and txn.get('category') != category:
                continue
            
            amount = Decimal(str(txn.get('amount', 0)))
            # Only count expenses (negative amounts)
            if amount < 0:
                total += abs(amount)
        
        return total
