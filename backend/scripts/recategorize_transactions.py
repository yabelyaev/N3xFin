#!/usr/bin/env python3
"""
Script to recategorize all existing transactions for a user.
This is used when category definitions change.
"""

import sys
import os
import json
import boto3
from datetime import datetime, UTC
from decimal import Decimal

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from categorization.categorization_service import CategorizationService
from common.config import config


def recategorize_all_transactions(user_id: str, batch_size: int = 100):
    """Recategorize all transactions for a user."""
    service = CategorizationService()
    
    total_processed = 0
    total_changed = 0
    
    while True:
        print(f"\nProcessing batch of {batch_size} transactions...")
        result = service.recategorize_all_transactions(user_id, batch_size)
        
        print(f"  Processed: {result['totalProcessed']}")
        print(f"  Recategorized: {result['recategorized']}")
        print(f"  Changed: {result['changed']}")
        print(f"  Unchanged: {result['unchanged']}")
        
        total_processed += result['totalProcessed']
        total_changed += result['changed']
        
        # Check if we're done
        if result['totalProcessed'] < batch_size:
            print(f"\nDone! Processed {total_processed} total transactions, {total_changed} changed category.")
            break
        
        # Continue with next batch
        print(f"Total so far: {total_processed} processed, {total_changed} changed")


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python recategorize_transactions.py <user_id> [batch_size]")
        print("Example: python recategorize_transactions.py user123 100")
        sys.exit(1)
    
    user_id = sys.argv[1]
    batch_size = int(sys.argv[2]) if len(sys.argv) > 2 else 100
    
    print(f"Recategorizing transactions for user: {user_id}")
    print(f"Batch size: {batch_size}")
    print(f"Using Bedrock region: {config.BEDROCK_REGION}")
    print(f"Using Bedrock model: {config.BEDROCK_MODEL_ID}")
    
    try:
        recategorize_all_transactions(user_id, batch_size)
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
