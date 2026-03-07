"""
Recommendation Service for N3xFin

Generates personalized savings recommendations using multi-month trend analysis
and a senior financial advisor AI persona.
"""

from datetime import datetime, timedelta, UTC
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from collections import defaultdict
import calendar
import boto3
from boto3.dynamodb.conditions import Key, Attr
import json

from common.config import Config
from common.errors import ValidationError
from profile.profile_service import ProfileService


# Categories that represent positive financial behaviour — never suggest cutting these
POSITIVE_CATEGORIES = {'savings', 'income', 'transfers', 'investment', 'retirement'}

# Categories that need special handling (not positive, but not regular spending either)
NEUTRAL_CATEGORIES = {'atm & cash', 'loans & debt'}  # ATM = cash spending, Loans = debt payments

# Spike threshold: flag a category when Latest Month > (6m_avg * this multiplier)
SPIKE_MULTIPLIER = 1.5


class RecommendationService:
    """Service for generating personalized savings recommendations."""

    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb')
        self.transactions_table = self.dynamodb.Table(Config.DYNAMODB_TABLE_TRANSACTIONS)
        self.bedrock = boto3.client('bedrock-runtime', region_name=Config.BEDROCK_REGION)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate_recommendations(self, user_id: str) -> List[Dict]:
        """
        Generate consultant-grade savings recommendations.

        Pulls 6 months of data, builds month-by-month category trends,
        detects spending spikes, then passes a rich context to Claude including user profile.
        """
        end_date = datetime.now(UTC)
        start_date = end_date - timedelta(days=183)  # ~6 months

        transactions = self._get_transactions_in_range(user_id, start_date, end_date)
        
        # Get user profile for goal-oriented recommendations
        profile_summary = ProfileService.get_profile_summary(user_id)

        if len(transactions) < 5:
            return [{
                'id': 'insufficient-data',
                'title': 'Not enough data yet',
                'description': 'Upload a few months of bank statements and I\'ll give you '
                               'personalised advice tailored to your actual spending patterns.',
                'category': 'General',
                'potentialSavings': 0.0,
                'actionItems': ['Upload at least 30 days of transaction history to get started'],
                'priority': 1,
                'isSpike': False,
                'categoryTrends': []
            }]

        # Build month-by-month category breakdown
        monthly_by_category = self._build_monthly_breakdown(transactions)

        # Detect spikes
        spike_categories = self._detect_spikes(monthly_by_category)

        # Total spending summary (latest month)
        latest_month = self._latest_month_key(monthly_by_category)
        total_spending = sum(
            monthly_by_category[cat].get(latest_month, Decimal('0'))
            for cat in monthly_by_category
        )

        # Generate recommendations via AI with profile context
        recommendations = self._generate_ai_recommendations(
            monthly_by_category, spike_categories, latest_month, total_spending, profile_summary
        )

        return self.rank_recommendations(recommendations)

    def rank_recommendations(self, recommendations: List[Dict]) -> List[Dict]:
        """Sort by priority descending, then potential savings."""
        return sorted(
            recommendations,
            key=lambda x: (x.get('priority', 0), x.get('potentialSavings', 0)),
            reverse=True
        )

    # ------------------------------------------------------------------
    # Data helpers
    # ------------------------------------------------------------------

    def _get_transactions_in_range(self, user_id: str, start_date: datetime, end_date: datetime) -> List[Dict]:
        """Paginate through all transactions for a user in a date range."""
        start_str = start_date.strftime('%Y-%m-%d')
        end_str = end_date.strftime('%Y-%m-%d')
        items = []
        kwargs = dict(
            KeyConditionExpression=Key('PK').eq(f'USER#{user_id}') &
                                   Key('SK').begins_with('TRANSACTION#'),
            FilterExpression=Attr('date').between(start_str + 'T00:00:00', end_str + 'T23:59:59')
        )
        while True:
            response = self.transactions_table.query(**kwargs)
            items.extend(response.get('Items', []))
            if 'LastEvaluatedKey' not in response:
                break
            kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
        return items

    def _build_monthly_breakdown(self, transactions: List[Dict]) -> Dict[str, Dict[str, Decimal]]:
        """
        Returns: { category -> { 'YYYY-MM' -> total_expense } }
        Only counts expenses (negative amounts).
        """
        result: Dict[str, Dict[str, Decimal]] = defaultdict(lambda: defaultdict(Decimal))
        for txn in transactions:
            amount = Decimal(str(txn.get('amount', 0)))
            if amount >= 0:
                continue  # skip income
            category = txn.get('category', 'Other')
            date_str = txn.get('date', '')[:7]  # 'YYYY-MM'
            if not date_str:
                continue
            result[category][date_str] += abs(amount)
        return result

    def _detect_spikes(self, monthly_by_category: Dict) -> Dict[str, Dict]:
        """
        For each category, compare latest month vs. average of prior months.
        Returns: { category -> { 'latest': amount, 'avg': amount, 'multiplier': float, 'months': sorted list } }
        """
        spikes = {}
        for category, monthly in monthly_by_category.items():
            if category.lower() in POSITIVE_CATEGORIES:
                continue
            months = sorted(monthly.keys())
            if len(months) < 2:
                continue
            latest = months[-1]
            prior = months[:-1]
            latest_amount = float(monthly[latest])
            avg_prior = sum(float(monthly[m]) for m in prior) / len(prior)
            if avg_prior > 0 and latest_amount > avg_prior * SPIKE_MULTIPLIER:
                spikes[category] = {
                    'latest': latest_amount,
                    'avg': round(avg_prior, 2),
                    'multiplier': round(latest_amount / avg_prior, 1),
                    'months': months,
                    'monthly': {m: float(monthly[m]) for m in months}
                }
        return spikes

    def _latest_month_key(self, monthly_by_category: Dict) -> str:
        """Find the most recent YYYY-MM key across all categories."""
        all_months = set()
        for monthly in monthly_by_category.values():
            all_months.update(monthly.keys())
        return max(all_months) if all_months else ''

    def _format_month(self, ym: str) -> str:
        """'2025-12' -> 'Dec 2025'"""
        try:
            dt = datetime.strptime(ym, '%Y-%m')
            return dt.strftime('%b %Y')
        except Exception:
            return ym

    # ------------------------------------------------------------------
    # AI recommendation generation
    # ------------------------------------------------------------------

    def _generate_ai_recommendations(
        self,
        monthly_by_category: Dict,
        spike_categories: Dict,
        latest_month: str,
        total_spending: Decimal,
        profile_summary: str = ""
    ) -> List[Dict]:
        try:
            # Build spending summary for latest month
            latest_summary = []
            for cat, monthly in sorted(monthly_by_category.items(), key=lambda x: float(x[1].get(latest_month, 0)), reverse=True):
                amt = float(monthly.get(latest_month, 0))
                if amt <= 0:
                    continue
                pct = (amt / float(total_spending) * 100) if total_spending else 0
                is_positive = cat.lower() in POSITIVE_CATEGORIES
                is_spike = cat in spike_categories
                entry = {
                    'category': cat,
                    'thisMonth': round(amt, 2),
                    'pctOfTotal': round(pct, 1),
                    'isPositive': is_positive,
                }
                if is_spike:
                    entry['⚠️ SPIKE'] = True
                    entry['avgPriorMonths'] = spike_categories[cat]['avg']
                    entry['multiplier'] = spike_categories[cat]['multiplier']
                latest_summary.append(entry)

            # Build 6-month trend table
            all_months = sorted({m for monthly in monthly_by_category.values() for m in monthly.keys()})
            trend_table = {}
            for cat, monthly in monthly_by_category.items():
                trend_table[cat] = {m: round(float(monthly.get(m, 0)), 2) for m in all_months}

            profile_context = f"\n## User Financial Profile\n{profile_summary}\n" if profile_summary else ""

            prompt = f"""You are a senior personal finance advisor — the calibre of McKinsey, Goldman Sachs, or a top-tier CFP. 
Your job is to give {self._format_month(latest_month)} spending a professional, empathetic review and produce 3-6 high-impact, specific recommendations.
{profile_context}
## Latest Month Summary ({self._format_month(latest_month)})
Total outflows: ${float(total_spending):.2f}
{json.dumps(latest_summary, indent=2)}

## 6-Month Category Trends (monthly expense totals)
{json.dumps(trend_table, indent=2)}

## Spike Categories Detected (latest month > 1.5× rolling average)
{json.dumps({k: {'latestMonth': v['latest'], 'avgPriorMonths': v['avg'], 'howMuchHigher': f"{v['multiplier']}×"} for k, v in spike_categories.items()}, indent=2) if spike_categories else "None detected"}

## Instructions
1. POSITIVE categories (Savings, Income, Transfers, Investments, Retirement) are GREAT behaviours — celebrate them, never suggest cutting.
2. ATM & Cash withdrawals are SPENDING (cash taken out to spend) — treat like any other expense category, NOT as savings.
3. Loans & Debt payments are necessary obligations — acknowledge them but don't suggest cutting (suggest paying off faster instead).
4. For **spike categories**, diagnose the likely cause (seasonal, one-off, or a new habit?) and give specific advice.
5. For recurring high spend, give targeted, realistic cuts — not generic advice like "spend less".
6. Write naturally, warmly, and confidently — like a trusted advisor, not a risk disclaimer.
7. Prioritise recommendations that will actually move the needle (high savings potential first).
8. If a category has a spike, set `isSpike: true` and include `categoryTrends` with the month-by-month data so the user can drill in.
9. **IMPORTANT**: If the user has financial goals, ALWAYS relate recommendations to goal progress. For example: "Cutting dining by $200/month would get you to your $50,000 college fund goal 8 months faster" or "This saving would cover 40% of your monthly debt payment goal."
10. If the user has an occupation, you can suggest career-related income opportunities (e.g., "As a software engineer, consider freelancing on weekends for an extra $1-2k/month").

Respond ONLY with a JSON array. Each item:
{{
  "title": "Short, motivating title",
  "description": "2-3 sentences of specific, actionable advice. Reference actual dollar amounts and months where relevant. If user has goals, show how this helps achieve them.",
  "category": "Category name",
  "potentialSavings": <realistic monthly savings number>,
  "actionItems": ["Specific action 1", "Specific action 2", "Specific action 3"],
  "priority": <1-10>,
  "isSpike": <true|false>,
  "categoryTrends": [{{"month": "MMM YYYY", "amount": <number>}}, ...]
}}

Only include `categoryTrends` (non-empty) when `isSpike` is true. Otherwise set it to [].
Produce 3-6 recommendations. Focus on the ones with the most savings potential."""

            request_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 3000,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.4  # lower = more factual, less hallucination
            }

            response = self.bedrock.invoke_model(
                modelId=Config.BEDROCK_MODEL_ID,
                body=json.dumps(request_body)
            )

            response_body = json.loads(response['body'].read())
            content = response_body['content'][0]['text']

            # Strip markdown fences if present
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                content = content.split('```')[1].split('```')[0].strip()

            recommendations = json.loads(content)
            if not isinstance(recommendations, list):
                recommendations = [recommendations]

            # Attach IDs and ensure categoryTrends is present
            for i, rec in enumerate(recommendations):
                rec['id'] = f"rec-{int(datetime.now(UTC).timestamp())}-{i}"
                if 'categoryTrends' not in rec:
                    rec['categoryTrends'] = []
                if 'isSpike' not in rec:
                    rec['isSpike'] = False

            return recommendations

        except Exception as e:
            print(f"Error generating AI recommendations: {str(e)}")
            return self._generate_fallback_recommendations(monthly_by_category, spike_categories, latest_month, total_spending)

    # ------------------------------------------------------------------
    # Fallback (no AI)
    # ------------------------------------------------------------------

    def _generate_fallback_recommendations(
        self,
        monthly_by_category: Dict,
        spike_categories: Dict,
        latest_month: str,
        total_spending: Decimal
    ) -> List[Dict]:
        """Rule-based fallback when AI is unavailable."""
        recommendations = []
        idx = 0

        # 1. Celebrate savings first
        for cat, monthly in monthly_by_category.items():
            if cat.lower() in POSITIVE_CATEGORIES and float(monthly.get(latest_month, 0)) > 0:
                amount = float(monthly[latest_month])
                recommendations.append({
                    'id': f'fallback-{idx}',
                    'title': 'Great job saving! 🎉',
                    'description': f'You moved ${amount:.2f} to {cat} this month — that\'s a powerful habit. '
                                   'Consider increasing it by 5–10% next month.',
                    'category': cat,
                    'potentialSavings': round(amount * 0.10, 2),
                    'actionItems': [
                        'Set up an automatic transfer on payday so savings happen before you can spend',
                        'Look for a high-interest savings account to boost returns',
                        'Aim to grow your savings rate by 1% every quarter'
                    ],
                    'priority': 8,
                    'isSpike': False,
                    'categoryTrends': []
                })
                idx += 1
                break

        # 2. Flag spikes
        CATEGORY_TIPS: Dict[str, List[str]] = {
            'Shopping': [
                'Wait 48 hours before any purchase over $50 to avoid impulse buys',
                'Unsubscribe from retailer emails and push notifications',
                'Set a monthly "fun money" cap and stick to it'
            ],
            'Dining': [
                'Plan meals on Sunday and batch-cook for the week',
                'Switch one restaurant meal per week for a home-cooked version',
                'Use your loyalty cards — most cafes offer a free drink after 10'
            ],
            'Entertainment': [
                'Audit your subscriptions — cancel any you haven\'t used in 30 days',
                'Look for free community events, parks, and library resources',
                'Share streaming accounts with family where the plan allows'
            ],
            'Transportation': [
                'Combine errands into one trip to save on fuel',
                'Compare your comprehensive insurance quote annually',
                'Try public transport or bike for regular short commutes'
            ],
            'Utilities': [
                'Compare electricity and gas providers — switching can save 10–20%',
                'Check for any appliances left on standby 24/7',
                'Contact your provider and ask for a loyalty discount'
            ],
            'ATM & Cash': [
                'Track what you spend cash on — it\'s easy to lose track',
                'Try using a debit card instead to keep better records',
                'Set a weekly cash budget and stick to it',
                'Consider if you really need cash or if card payments work better'
            ],
        }

        for cat, spike in sorted(spike_categories.items(), key=lambda x: x[1]['multiplier'], reverse=True):
            latest_amt = spike['latest']
            avg_amt = spike['avg']
            mult = spike['multiplier']
            extra = latest_amt - avg_amt
            tips = CATEGORY_TIPS.get(cat, [
                f'Review your {cat} transactions line by line this month',
                f'Set a ${avg_amt:.0f}/month cap to return to your normal level',
                f'Identify the single largest {cat} charge and see if it repeats'
            ])
            trends = [
                {'month': self._format_month(m), 'amount': round(float(monthly_by_category[cat].get(m, 0)), 2)}
                for m in spike['months']
            ]
            recommendations.append({
                'id': f'fallback-{idx}',
                'title': f'Unusual spike in {cat}',
                'description': f'You spent ${latest_amt:.2f} on {cat} this month — {mult}× your average of ${avg_amt:.2f}. '
                               f'That\'s ~${extra:.2f} more than usual. Was this a one-off or a new pattern?',
                'category': cat,
                'potentialSavings': round(extra, 2),
                'actionItems': tips,
                'priority': 7,
                'isSpike': True,
                'categoryTrends': trends
            })
            idx += 1

        # 3. Top non-positive, non-spike categories
        sorted_cats = sorted(
            [(cat, monthly) for cat, monthly in monthly_by_category.items()
             if cat.lower() not in POSITIVE_CATEGORIES and cat not in spike_categories],
            key=lambda x: float(x[1].get(latest_month, 0)),
            reverse=True
        )
        for cat, monthly in sorted_cats[:2]:
            amount = float(monthly.get(latest_month, 0))
            if amount <= 0:
                continue
            pct = (amount / float(total_spending) * 100) if total_spending else 0
            tips = CATEGORY_TIPS.get(cat, [
                f'Set a monthly budget for {cat}',
                f'Review your top 3 {cat} transactions',
                f'Find one easy cut in {cat} to start'
            ])
            recommendations.append({
                'id': f'fallback-{idx}',
                'title': f'Trim {cat} spending',
                'description': f'{cat} is ${amount:.2f}/month ({pct:.1f}% of outflows). '
                               f'A 15% reduction frees up ${amount * 0.15:.2f} to redirect to savings.',
                'category': cat,
                'potentialSavings': round(amount * 0.15, 2),
                'actionItems': tips,
                'priority': 5 - idx if (5 - idx) > 0 else 1,
                'isSpike': False,
                'categoryTrends': []
            })
            idx += 1

        return recommendations
