#!/usr/bin/env python3
"""
Script to delete old/incorrect reports from DynamoDB.
This will remove reports for months that don't have actual transaction data.
"""

import boto3
from datetime import datetime

def cleanup_reports(user_id: str, dry_run: bool = True):
    """
    Delete reports that are for months without actual transaction data.
    
    Args:
        user_id: The user ID to clean up reports for
        dry_run: If True, only print what would be deleted without actually deleting
    """
    dynamodb = boto3.resource('dynamodb')
    reports_table = dynamodb.Table('n3xfin-reports')
    transactions_table = dynamodb.Table('n3xfin-transactions')
    
    # Get all reports for the user
    response = reports_table.query(
        KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues={
            ':pk': f'USER#{user_id}',
            ':sk': 'REPORT#'
        }
    )
    
    reports = response.get('Items', [])
    print(f"Found {len(reports)} reports for user {user_id}")
    
    # Get actual months with transaction data
    months_with_data = set()
    response = transactions_table.query(
        KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues={
            ':pk': f'USER#{user_id}',
            ':sk': 'TRANSACTION#'
        }
    )
    
    for item in response.get('Items', []):
        date_str = item.get('date', '')
        if date_str and len(date_str) >= 7:
            months_with_data.add(date_str[:7])  # YYYY-MM
    
    print(f"Found {len(months_with_data)} months with actual transaction data: {sorted(months_with_data)}")
    
    # Current month (don't delete reports for future months beyond this)
    current_month = datetime.now().strftime('%Y-%m')
    
    # Check each report
    to_delete = []
    for report in reports:
        month = report.get('month', '')
        
        # Delete if:
        # 1. Month has no transaction data
        # 2. Month is in the future (beyond current month)
        should_delete = (month not in months_with_data) or (month > current_month)
        
        if should_delete:
            to_delete.append(report)
            print(f"  {'[DRY RUN] Would delete' if dry_run else 'Deleting'}: {month}")
    
    if not to_delete:
        print("No reports to delete!")
        return
    
    print(f"\nTotal reports to delete: {len(to_delete)}")
    
    if not dry_run:
        for report in to_delete:
            reports_table.delete_item(
                Key={
                    'PK': report['PK'],
                    'SK': report['SK']
                }
            )
        print(f"Deleted {len(to_delete)} reports")
    else:
        print("\nThis was a dry run. Run with dry_run=False to actually delete.")


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python cleanup_old_reports.py <user_id> [--execute]")
        print("\nWithout --execute flag, this will do a dry run (no actual deletion)")
        sys.exit(1)
    
    user_id = sys.argv[1]
    execute = '--execute' in sys.argv
    
    print(f"Cleaning up reports for user: {user_id}")
    print(f"Mode: {'EXECUTE (will delete)' if execute else 'DRY RUN (no deletion)'}\n")
    
    cleanup_reports(user_id, dry_run=not execute)
