"""Categorization service using Amazon Bedrock."""
import json
import boto3
from typing import List, Dict, Any
from ..common.config import config
from ..common.models import CATEGORIES, Transaction
from ..common.errors import ExternalServiceError


class CategorizationService:
    """Handles AI-powered transaction categorization using Amazon Bedrock."""
    
    def __init__(self):
        self.bedrock = boto3.client('bedrock-runtime', region_name=config.BEDROCK_REGION)
        self.dynamodb = boto3.resource('dynamodb', region_name=config.BEDROCK_REGION)
        self.transactions_table = self.dynamodb.Table(config.DYNAMODB_TABLE_TRANSACTIONS)
        self.model_id = config.BEDROCK_MODEL_ID
    
    def categorize_transaction(self, transaction: Transaction) -> Dict[str, Any]:
        """
        Categorize a single transaction using AI.
        
        Args:
            transaction: Transaction to categorize
            
        Returns:
            Dict with category, confidence, and reasoning
        """
        return self.categorize_batch([transaction])[0]
    
    def categorize_batch(self, transactions: List[Transaction]) -> List[Dict[str, Any]]:
        """
        Categorize multiple transactions in a batch.
        
        Args:
            transactions: List of transactions to categorize
            
        Returns:
            List of categorization results
        """
        if not transactions:
            return []
        
        # Process in batches of up to CATEGORIZATION_BATCH_SIZE
        batch_size = config.CATEGORIZATION_BATCH_SIZE
        all_results = []
        
        for i in range(0, len(transactions), batch_size):
            batch = transactions[i:i + batch_size]
            results = self._categorize_batch_internal(batch)
            all_results.extend(results)
        
        return all_results
    
    def _categorize_batch_internal(self, transactions: List[Transaction]) -> List[Dict[str, Any]]:
        """
        Internal method to categorize a batch of transactions.
        
        Args:
            transactions: List of transactions (max CATEGORIZATION_BATCH_SIZE)
            
        Returns:
            List of categorization results
        """
        # Build prompt
        prompt = self._build_categorization_prompt(transactions)
        
        try:
            # Call Bedrock
            response = self.bedrock.invoke_model(
                modelId=self.model_id,
                body=json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 2000,
                    "temperature": 0.1,  # Low temperature for consistent categorization
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ]
                })
            )
            
            # Parse response
            response_body = json.loads(response['body'].read())
            content = response_body['content'][0]['text']
            
            # Extract JSON from response
            results = self._parse_categorization_response(content, transactions)
            
            return results
            
        except Exception as e:
            print(f'Bedrock error: {str(e)}')
            # Fallback to "Other" category for all transactions
            return [
                {
                    'category': 'Other',
                    'confidence': 0.0,
                    'reasoning': f'Categorization failed: {str(e)}'
                }
                for _ in transactions
            ]
    
    def _build_categorization_prompt(self, transactions: List[Transaction]) -> str:
        """
        Build prompt for Bedrock categorization.
        
        Args:
            transactions: List of transactions
            
        Returns:
            Formatted prompt string
        """
        categories_str = ', '.join(CATEGORIES)
        
        # Build transaction list
        transactions_str = ""
        for i, tx in enumerate(transactions, 1):
            amount_str = f"${abs(tx.amount):.2f}"
            tx_type = "expense" if tx.amount < 0 else "income"
            transactions_str += f"{i}. Description: \"{tx.description}\", Amount: {amount_str} ({tx_type}), Date: {tx.date.strftime('%Y-%m-%d')}\n"
        
        prompt = f"""You are a financial transaction categorizer. Analyze the following transactions and categorize each one into exactly ONE category from this list:

Categories: {categories_str}

Category Definitions:
- Dining: Restaurants, cafes, food delivery, bars
- Transportation: Gas, public transit, ride-sharing, parking, car maintenance
- Utilities: Electricity, water, gas, internet, phone bills
- Entertainment: Movies, concerts, streaming services, games, hobbies
- Shopping: Retail purchases, online shopping, clothing, electronics
- Healthcare: Doctor visits, pharmacy, medical bills, insurance
- Housing: Rent, mortgage, property tax, home maintenance
- Income: Salary, wages, bonuses, refunds, transfers in
- Savings: Transfers to savings, investments
- Other: Anything that doesn't fit the above categories

Transactions to categorize:
{transactions_str}

For each transaction, respond with a JSON object containing:
- "category": The category name (must be one from the list above)
- "confidence": A number between 0 and 1 indicating confidence
- "reasoning": Brief explanation (one sentence)

Respond with a JSON array containing one object per transaction, in the same order. Example format:
[
  {{"category": "Dining", "confidence": 0.95, "reasoning": "Coffee shop purchase"}},
  {{"category": "Transportation", "confidence": 0.90, "reasoning": "Gas station charge"}}
]

Important: Respond ONLY with the JSON array, no other text."""
        
        return prompt
    
    def _parse_categorization_response(self, response_text: str, transactions: List[Transaction]) -> List[Dict[str, Any]]:
        """
        Parse Bedrock response into categorization results.
        
        Args:
            response_text: Raw response from Bedrock
            transactions: Original transactions
            
        Returns:
            List of categorization results
        """
        try:
            # Extract JSON from response (handle markdown code blocks)
            json_str = response_text.strip()
            if json_str.startswith('```'):
                # Remove markdown code block markers
                lines = json_str.split('\n')
                json_str = '\n'.join(lines[1:-1]) if len(lines) > 2 else json_str
            
            # Parse JSON
            results = json.loads(json_str)
            
            # Validate and normalize results
            normalized_results = []
            for i, result in enumerate(results):
                category = result.get('category', 'Other')
                confidence = float(result.get('confidence', 0.0))
                reasoning = result.get('reasoning', 'No reasoning provided')
                
                # Validate category
                if category not in CATEGORIES:
                    category = 'Other'
                    confidence = 0.0
                
                # Apply confidence threshold
                if confidence < config.CATEGORY_CONFIDENCE_THRESHOLD:
                    category = 'Other'
                
                normalized_results.append({
                    'category': category,
                    'confidence': confidence,
                    'reasoning': reasoning
                })
            
            # Ensure we have results for all transactions
            while len(normalized_results) < len(transactions):
                normalized_results.append({
                    'category': 'Other',
                    'confidence': 0.0,
                    'reasoning': 'Missing categorization'
                })
            
            return normalized_results[:len(transactions)]
            
        except Exception as e:
            print(f'Failed to parse categorization response: {str(e)}')
            print(f'Response text: {response_text}')
            # Return "Other" for all transactions
            return [
                {
                    'category': 'Other',
                    'confidence': 0.0,
                    'reasoning': f'Parse error: {str(e)}'
                }
                for _ in transactions
            ]
    
    def update_transaction_category(self, transaction_id: str, user_id: str, 
                                    category: str, confidence: float, reasoning: str) -> None:
        """
        Update transaction with categorization result.
        
        Args:
            transaction_id: Transaction ID
            user_id: User ID
            category: Category name
            confidence: Confidence score
            reasoning: Categorization reasoning
        """
        try:
            # Find the transaction
            response = self.transactions_table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk_prefix)',
                FilterExpression='id = :id',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk_prefix': 'TRANSACTION#',
                    ':id': transaction_id
                }
            )
            
            items = response.get('Items', [])
            if not items:
                print(f'Transaction not found: {transaction_id}')
                return
            
            item = items[0]
            pk = item['PK']
            sk = item['SK']
            
            # Update the transaction
            self.transactions_table.update_item(
                Key={'PK': pk, 'SK': sk},
                UpdateExpression='SET category = :cat, categoryConfidence = :conf, categoryReasoning = :reason, GSI1PK = :gsi1pk',
                ExpressionAttributeValues={
                    ':cat': category,
                    ':conf': str(confidence),
                    ':reason': reasoning,
                    ':gsi1pk': f'USER#{user_id}#CATEGORY#{category}'
                }
            )
            
        except Exception as e:
            print(f'Failed to update transaction category: {str(e)}')
            raise ExternalServiceError(
                f'Failed to update transaction: {str(e)}',
                {'transactionId': transaction_id}
            )
    
    def categorize_user_transactions(self, user_id: str, limit: int = 100) -> Dict[str, Any]:
        """
        Categorize all uncategorized transactions for a user.
        
        Args:
            user_id: User ID
            limit: Maximum number of transactions to process
            
        Returns:
            Summary of categorization results
        """
        try:
            # Get uncategorized transactions
            response = self.transactions_table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk_prefix)',
                FilterExpression='attribute_not_exists(category) OR category = :other',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk_prefix': 'TRANSACTION#',
                    ':other': 'Uncategorized'
                },
                Limit=limit
            )
            
            items = response.get('Items', [])
            
            if not items:
                return {
                    'totalProcessed': 0,
                    'categorized': 0,
                    'message': 'No uncategorized transactions found'
                }
            
            # Convert to Transaction objects
            transactions = []
            for item in items:
                from datetime import datetime
                transactions.append(Transaction(
                    id=item['id'],
                    userId=item['PK'].replace('USER#', ''),
                    date=datetime.fromisoformat(item['date']),
                    description=item['description'],
                    amount=float(item['amount']),
                    balance=float(item.get('balance', 0)) if item.get('balance') else None,
                    sourceFile=item['sourceFile'],
                    rawData=item['rawData'],
                    createdAt=datetime.fromisoformat(item['createdAt'])
                ))
            
            # Categorize transactions
            results = self.categorize_batch(transactions)
            
            # Update transactions with categories
            categorized_count = 0
            for transaction, result in zip(transactions, results):
                self.update_transaction_category(
                    transaction.id,
                    user_id,
                    result['category'],
                    result['confidence'],
                    result['reasoning']
                )
                if result['category'] != 'Other':
                    categorized_count += 1
            
            return {
                'totalProcessed': len(transactions),
                'categorized': categorized_count,
                'uncategorized': len(transactions) - categorized_count,
                'message': f'Successfully categorized {categorized_count} out of {len(transactions)} transactions'
            }
            
        except Exception as e:
            print(f'Failed to categorize user transactions: {str(e)}')
            raise ExternalServiceError(
                f'Categorization failed: {str(e)}',
                {'userId': user_id}
            )
