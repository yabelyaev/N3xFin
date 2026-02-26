"""
Report Service for N3xFin

Generates monthly financial health reports with insights and export capabilities.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional
import boto3
from boto3.dynamodb.conditions import Key
import json
import csv
import io

from common.config import Config
from common.errors import ValidationError


class ReportService:
    """Service for generating and exporting financial reports."""
    
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb')
        self.transactions_table = self.dynamodb.Table(Config.DYNAMODB_TABLE_TRANSACTIONS)
        self.reports_table = self.dynamodb.Table(Config.DYNAMODB_TABLE_REPORTS)
        self.bedrock = boto3.client('bedrock-runtime', region_name=Config.BEDROCK_REGION)
        self.s3 = boto3.client('s3')
    
    def generate_monthly_report(
        self,
        user_id: str,
        year: int,
        month: int
    ) -> Dict:
        """
        Generate a comprehensive monthly financial health report.
        
        Args:
            user_id: User identifier
            year: Report year
            month: Report month (1-12)
            
        Returns:
            Complete financial health report
        """
        # Validate month
        if month < 1 or month > 12:
            raise ValidationError("Month must be between 1 and 12")
        
        # Calculate date range for the month
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = datetime(year, month + 1, 1) - timedelta(days=1)
        
        # Get transactions for the month
        transactions = self._get_transactions_in_range(user_id, start_date, end_date)
        
        if len(transactions) == 0:
            return {
                'reportId': f"{user_id}-{year}-{month:02d}",
                'userId': user_id,
                'month': f"{year}-{month:02d}",
                'totalSpending': 0.0,
                'totalIncome': 0.0,
                'spendingByCategory': {},
                'savingsRate': 0.0,
                'trends': [],
                'insights': ['No transactions found for this month'],
                'recommendations': [],
                'transactionCount': 0,
                'generatedAt': datetime.utcnow().isoformat()
            }
        
        # Calculate spending and income
        spending_data = self._calculate_spending_and_income(transactions)
        
        # Calculate category breakdown
        category_breakdown = self._calculate_category_breakdown(transactions)
        
        # Calculate savings rate
        savings_rate = self._calculate_savings_rate(
            spending_data['totalIncome'],
            spending_data['totalSpending']
        )
        
        # Calculate trends (compare to previous month)
        trends = self._calculate_monthly_trends(user_id, year, month, spending_data)
        
        # Generate AI insights
        insights = self._generate_insights(
            spending_data,
            category_breakdown,
            savings_rate,
            trends
        )
        
        # Generate recommendations
        recommendations = self._generate_recommendations(
            category_breakdown,
            spending_data['totalSpending']
        )
        
        # Build report
        report = {
            'reportId': f"{user_id}-{year}-{month:02d}",
            'userId': user_id,
            'month': f"{year}-{month:02d}",
            'totalSpending': spending_data['totalSpending'],
            'totalIncome': spending_data['totalIncome'],
            'spendingByCategory': category_breakdown,
            'savingsRate': savings_rate,
            'trends': trends,
            'insights': insights,
            'recommendations': recommendations,
            'transactionCount': len(transactions),
            'generatedAt': datetime.utcnow().isoformat()
        }
        
        # Store report in DynamoDB
        self._store_report(report)
        
        return report
    
    def export_to_csv(self, report: Dict) -> str:
        """
        Export report to CSV format.
        
        Args:
            report: Report dictionary
            
        Returns:
            CSV string
        """
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(['N3xFin Monthly Financial Report'])
        writer.writerow(['Month', report['month']])
        writer.writerow(['Generated', report['generatedAt']])
        writer.writerow([])
        
        # Summary
        writer.writerow(['Summary'])
        writer.writerow(['Total Income', f"${report['totalIncome']:.2f}"])
        writer.writerow(['Total Spending', f"${report['totalSpending']:.2f}"])
        writer.writerow(['Savings Rate', f"{report['savingsRate']:.1f}%"])
        writer.writerow(['Transaction Count', report['transactionCount']])
        writer.writerow([])
        
        # Spending by Category
        writer.writerow(['Spending by Category'])
        writer.writerow(['Category', 'Amount', 'Percentage', 'Count'])
        for category, data in sorted(
            report['spendingByCategory'].items(),
            key=lambda x: x[1]['total'],
            reverse=True
        ):
            writer.writerow([
                category,
                f"${data['total']:.2f}",
                f"{data['percentage']:.1f}%",
                data['count']
            ])
        writer.writerow([])
        
        # Trends
        if report['trends']:
            writer.writerow(['Trends'])
            for trend in report['trends']:
                writer.writerow([
                    trend['category'],
                    trend['direction'],
                    f"{trend['percentageChange']:.1f}%"
                ])
            writer.writerow([])
        
        # Insights
        writer.writerow(['Insights'])
        for i, insight in enumerate(report['insights'], 1):
            writer.writerow([f"{i}.", insight])
        writer.writerow([])
        
        # Recommendations
        if report['recommendations']:
            writer.writerow(['Recommendations'])
            for i, rec in enumerate(report['recommendations'], 1):
                writer.writerow([f"{i}.", rec['title']])
                writer.writerow(['', f"Potential Savings: ${rec['potentialSavings']:.2f}"])
                for action in rec['actionItems']:
                    writer.writerow(['', f"- {action}"])
                writer.writerow([])
        
        return output.getvalue()
    
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
    
    def _calculate_spending_and_income(self, transactions: List[Dict]) -> Dict:
        """Calculate total spending and income."""
        total_spending = Decimal('0')
        total_income = Decimal('0')
        
        for txn in transactions:
            amount = Decimal(str(txn.get('amount', 0)))
            if amount < 0:
                total_spending += abs(amount)
            else:
                total_income += amount
        
        return {
            'totalSpending': float(total_spending),
            'totalIncome': float(total_income)
        }
    
    def _calculate_category_breakdown(self, transactions: List[Dict]) -> Dict:
        """Calculate spending breakdown by category."""
        category_data = {}
        total_spending = Decimal('0')
        
        for txn in transactions:
            amount = Decimal(str(txn.get('amount', 0)))
            if amount < 0:
                category = txn.get('category', 'Other')
                if category not in category_data:
                    category_data[category] = {
                        'total': Decimal('0'),
                        'count': 0
                    }
                
                category_data[category]['total'] += abs(amount)
                category_data[category]['count'] += 1
                total_spending += abs(amount)
        
        # Calculate percentages
        result = {}
        for category, data in category_data.items():
            percentage = (float(data['total']) / float(total_spending) * 100) if total_spending > 0 else 0
            result[category] = {
                'total': float(data['total']),
                'count': data['count'],
                'percentage': round(percentage, 1)
            }
        
        return result
    
    def _calculate_savings_rate(self, income: float, spending: float) -> float:
        """Calculate savings rate as percentage of income."""
        if income == 0:
            return 0.0
        
        savings = income - spending
        savings_rate = (savings / income) * 100
        return round(savings_rate, 1)
    
    def _calculate_monthly_trends(
        self,
        user_id: str,
        year: int,
        month: int,
        current_data: Dict
    ) -> List[Dict]:
        """Calculate trends compared to previous month."""
        # Get previous month
        if month == 1:
            prev_year = year - 1
            prev_month = 12
        else:
            prev_year = year
            prev_month = month - 1
        
        # Get previous month's transactions
        prev_start = datetime(prev_year, prev_month, 1)
        if prev_month == 12:
            prev_end = datetime(prev_year + 1, 1, 1) - timedelta(days=1)
        else:
            prev_end = datetime(prev_year, prev_month + 1, 1) - timedelta(days=1)
        
        prev_transactions = self._get_transactions_in_range(user_id, prev_start, prev_end)
        
        if len(prev_transactions) == 0:
            return []
        
        prev_data = self._calculate_spending_and_income(prev_transactions)
        
        # Calculate overall trend
        trends = []
        
        # Total spending trend
        if prev_data['totalSpending'] > 0:
            change = ((current_data['totalSpending'] - prev_data['totalSpending']) / 
                     prev_data['totalSpending'] * 100)
            direction = 'increasing' if change > 5 else 'decreasing' if change < -5 else 'stable'
            trends.append({
                'category': 'Overall Spending',
                'direction': direction,
                'percentageChange': round(change, 1)
            })
        
        return trends
    
    def _generate_insights(
        self,
        spending_data: Dict,
        category_breakdown: Dict,
        savings_rate: float,
        trends: List[Dict]
    ) -> List[str]:
        """Generate AI-powered insights using Bedrock."""
        try:
            # Build context for AI
            context = {
                'totalSpending': spending_data['totalSpending'],
                'totalIncome': spending_data['totalIncome'],
                'savingsRate': savings_rate,
                'topCategories': sorted(
                    category_breakdown.items(),
                    key=lambda x: x[1]['total'],
                    reverse=True
                )[:3],
                'trends': trends
            }
            
            prompt = f"""Analyze this monthly financial data and provide 3-5 key insights:

Total Income: ${spending_data['totalIncome']:.2f}
Total Spending: ${spending_data['totalSpending']:.2f}
Savings Rate: {savings_rate:.1f}%

Top Spending Categories:
{json.dumps([{cat: data} for cat, data in context['topCategories']], indent=2)}

Provide insights as a JSON array of strings. Focus on:
1. Overall financial health
2. Spending patterns
3. Savings performance
4. Notable trends

Example: ["Your savings rate of 25% is excellent", "Dining spending increased by 15%"]"""

            request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 800,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7
            }
            
            response = self.bedrock.invoke_model(
                modelId=Config.BEDROCK_MODEL_ID,
                body=json.dumps(request_body)
            )
            
            response_body = json.loads(response['body'].read())
            content = response_body['content'][0]['text']
            
            # Parse JSON
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                content = content.split('```')[1].split('```')[0].strip()
            
            insights = json.loads(content)
            return insights if isinstance(insights, list) else [str(insights)]
        
        except Exception as e:
            print(f"Error generating insights: {str(e)}")
            # Fallback insights
            return self._generate_fallback_insights(spending_data, category_breakdown, savings_rate)
    
    def _generate_fallback_insights(
        self,
        spending_data: Dict,
        category_breakdown: Dict,
        savings_rate: float
    ) -> List[str]:
        """Generate basic insights when AI fails."""
        insights = []
        
        # Savings rate insight
        if savings_rate > 20:
            insights.append(f"Excellent savings rate of {savings_rate:.1f}%! You're saving more than the recommended 20%.")
        elif savings_rate > 10:
            insights.append(f"Good savings rate of {savings_rate:.1f}%. Consider increasing to 20% for optimal financial health.")
        elif savings_rate > 0:
            insights.append(f"Your savings rate of {savings_rate:.1f}% could be improved. Aim for at least 10-20%.")
        else:
            insights.append("You're spending more than you earn this month. Review your expenses to identify areas to cut back.")
        
        # Top spending category
        if category_breakdown:
            top_category = max(category_breakdown.items(), key=lambda x: x[1]['total'])
            insights.append(
                f"{top_category[0]} is your highest spending category at ${top_category[1]['total']:.2f} "
                f"({top_category[1]['percentage']:.1f}% of total spending)."
            )
        
        # Transaction count
        total_count = sum(data['count'] for data in category_breakdown.values())
        insights.append(f"You made {total_count} transactions this month.")
        
        return insights
    
    def _generate_recommendations(
        self,
        category_breakdown: Dict,
        total_spending: float
    ) -> List[Dict]:
        """Generate savings recommendations."""
        recommendations = []
        
        # Sort categories by spending
        sorted_categories = sorted(
            category_breakdown.items(),
            key=lambda x: x[1]['total'],
            reverse=True
        )
        
        # Generate recommendations for top 2 categories
        for category, data in sorted_categories[:2]:
            potential_savings = data['total'] * 0.15  # Estimate 15% savings
            recommendations.append({
                'title': f"Reduce {category} Spending",
                'description': f"You spent ${data['total']:.2f} on {category} this month.",
                'category': category,
                'potentialSavings': round(potential_savings, 2),
                'actionItems': [
                    f"Review your {category} expenses",
                    f"Set a monthly budget for {category}",
                    f"Look for cheaper alternatives"
                ]
            })
        
        return recommendations
    
    def _store_report(self, report: Dict):
        """Store report in DynamoDB."""
        try:
            self.reports_table.put_item(Item={
                'userId': report['userId'],
                'month': report['month'],
                'reportId': report['reportId'],
                'reportData': json.dumps(report),
                'createdAt': report['generatedAt']
            })
        except Exception as e:
            print(f"Error storing report: {str(e)}")
            # Don't fail the request if storage fails
