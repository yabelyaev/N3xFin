"""
Profile Service - Manages user financial goals and profile data
"""
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from decimal import Decimal
import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
# Profile data is stored in the transactions table with SK='PROFILE'
table = dynamodb.Table(os.environ.get('DYNAMODB_TABLE_TRANSACTIONS', 'n3xfin-transactions'))


class ProfileService:
    """Service for managing user financial profiles and goals"""
    
    @staticmethod
    def get_profile(user_id: str) -> Optional[Dict[str, Any]]:
        """Get user profile and goals"""
        try:
            response = table.get_item(
                Key={
                    'PK': f'USER#{user_id}',
                    'SK': 'PROFILE'
                }
            )
            
            if 'Item' not in response:
                return None
            
            item = response['Item']
            
            # Convert Decimal to float for JSON serialization
            return ProfileService._convert_decimals(item)
            
        except ClientError as e:
            print(f"Error getting profile: {e}")
            return None
    
    @staticmethod
    def save_profile(user_id: str, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save or update user profile"""
        try:
            now = datetime.utcnow().isoformat()
            
            # Convert floats to Decimal for DynamoDB
            profile_data = ProfileService._convert_floats(profile_data)
            
            item = {
                'PK': f'USER#{user_id}',
                'SK': 'PROFILE',
                'occupation': profile_data.get('occupation', ''),
                'currency': profile_data.get('currency', 'USD'),
                'income_sources': profile_data.get('income_sources', []),
                'goals': profile_data.get('goals', []),
                'debts': profile_data.get('debts', []),
                'fixed_expenses': profile_data.get('fixed_expenses', {}),
                'updated_at': now,
                'created_at': profile_data.get('created_at', now)
            }
            
            table.put_item(Item=item)
            
            return ProfileService._convert_decimals(item)
            
        except ClientError as e:
            print(f"Error saving profile: {e}")
            raise Exception(f"Failed to save profile: {str(e)}")
    
    @staticmethod
    def add_goal(user_id: str, goal: Dict[str, Any]) -> Dict[str, Any]:
        """Add a new financial goal"""
        profile = ProfileService.get_profile(user_id)
        
        if profile is None:
            profile = {
                'occupation': '',
                'currency': 'USD',
                'income_sources': [],
                'goals': [],
                'debts': [],
                'fixed_expenses': {}
            }
        
        # Add goal with unique ID
        goal['id'] = f"GOAL#{datetime.utcnow().timestamp()}"
        goal['created_at'] = datetime.utcnow().isoformat()
        goal['status'] = 'active'
        
        profile['goals'].append(goal)
        
        return ProfileService.save_profile(user_id, profile)
    
    @staticmethod
    def update_goal(user_id: str, goal_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing goal"""
        profile = ProfileService.get_profile(user_id)
        
        if profile is None:
            raise Exception("Profile not found")
        
        goals = profile.get('goals', [])
        goal_found = False
        
        for goal in goals:
            if goal.get('id') == goal_id:
                goal.update(updates)
                goal['updated_at'] = datetime.utcnow().isoformat()
                goal_found = True
                break
        
        if not goal_found:
            raise Exception(f"Goal {goal_id} not found")
        
        profile['goals'] = goals
        return ProfileService.save_profile(user_id, profile)
    
    @staticmethod
    def delete_goal(user_id: str, goal_id: str) -> Dict[str, Any]:
        """Delete a goal"""
        profile = ProfileService.get_profile(user_id)
        
        if profile is None:
            raise Exception("Profile not found")
        
        goals = profile.get('goals', [])
        profile['goals'] = [g for g in goals if g.get('id') != goal_id]
        
        return ProfileService.save_profile(user_id, profile)
    
    @staticmethod
    def get_profile_summary(user_id: str) -> str:
        """Get a text summary of user profile for AI context"""
        profile = ProfileService.get_profile(user_id)
        
        if not profile:
            return "No profile information available."
        
        summary_parts = []
        
        # Currency
        currency = profile.get('currency', 'USD')
        currency_symbol = {'USD': '$', 'EUR': '€', 'GBP': '£', 'AUD': 'A$', 'CAD': 'C$', 'JPY': '¥', 'CNY': '¥', 'INR': '₹', 'BRL': 'R$', 'ZAR': 'R'}.get(currency, '$')
        
        # Occupation
        if profile.get('occupation'):
            summary_parts.append(f"Occupation: {profile['occupation']}")
        
        # Income sources
        income_sources = profile.get('income_sources', [])
        if income_sources:
            income_list = []
            for source in income_sources:
                amount = source.get('monthly_amount', 0)
                income_list.append(f"{source.get('type', 'Unknown')}: {currency_symbol}{amount:,.2f}/month")
            summary_parts.append(f"Income sources: {', '.join(income_list)}")
            
            total_income = sum(s.get('monthly_amount', 0) for s in income_sources)
            summary_parts.append(f"Total monthly income: {currency_symbol}{total_income:,.2f}")
        
        # Goals
        goals = profile.get('goals', [])
        active_goals = [g for g in goals if g.get('status') == 'active']
        if active_goals:
            summary_parts.append(f"\nFinancial Goals ({len(active_goals)} active):")
            for goal in active_goals:
                goal_type = goal.get('type', 'Unknown')
                target = goal.get('target_amount', 0)
                current = goal.get('current_amount', 0)
                deadline = goal.get('deadline', 'No deadline')
                priority = goal.get('priority', 'medium')
                
                progress = (current / target * 100) if target > 0 else 0
                summary_parts.append(
                    f"  - {goal.get('name', 'Unnamed goal')} ({goal_type}): "
                    f"{currency_symbol}{current:,.2f} / {currency_symbol}{target:,.2f} ({progress:.1f}% complete) "
                    f"[Priority: {priority}, Deadline: {deadline}]"
                )
        
        # Debts
        debts = profile.get('debts', [])
        if debts:
            summary_parts.append(f"\nDebts ({len(debts)}):")
            for debt in debts:
                debt_type = debt.get('type', 'Unknown')
                balance = debt.get('balance', 0)
                interest = debt.get('interest_rate', 0)
                min_payment = debt.get('minimum_payment', 0)
                summary_parts.append(
                    f"  - {debt.get('name', 'Unnamed debt')} ({debt_type}): "
                    f"{currency_symbol}{balance:,.2f} balance, {interest}% APR, "
                    f"{currency_symbol}{min_payment:,.2f}/month minimum"
                )
        
        # Fixed expenses
        fixed_expenses = profile.get('fixed_expenses', {})
        if fixed_expenses:
            summary_parts.append("\nFixed Monthly Expenses:")
            for category, amount in fixed_expenses.items():
                summary_parts.append(f"  - {category}: {currency_symbol}{amount:,.2f}")
            
            total_fixed = sum(fixed_expenses.values())
            summary_parts.append(f"Total fixed expenses: {currency_symbol}{total_fixed:,.2f}/month")
        
        return "\n".join(summary_parts)
    
    @staticmethod
    def _convert_decimals(obj: Any) -> Any:
        """Convert Decimal objects to float for JSON serialization"""
        if isinstance(obj, list):
            return [ProfileService._convert_decimals(item) for item in obj]
        elif isinstance(obj, dict):
            return {key: ProfileService._convert_decimals(value) for key, value in obj.items()}
        elif isinstance(obj, Decimal):
            return float(obj)
        else:
            return obj
    
    @staticmethod
    def _convert_floats(obj: Any) -> Any:
        """Convert float objects to Decimal for DynamoDB"""
        if isinstance(obj, list):
            return [ProfileService._convert_floats(item) for item in obj]
        elif isinstance(obj, dict):
            return {key: ProfileService._convert_floats(value) for key, value in obj.items()}
        elif isinstance(obj, float):
            return Decimal(str(obj))
        else:
            return obj
