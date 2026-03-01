"""Parser service for extracting transaction data from bank statements."""
import csv
import hashlib
import io
import uuid
import boto3
from datetime import datetime, UTC
from typing import List, Dict, Any, Optional
from dateutil import parser as date_parser
from common.config import config
from common.errors import ProcessingError, ValidationError
from common.models import Transaction


class ParserService:
    """Handles parsing of CSV and PDF bank statements."""
    
    def __init__(self):
        self.s3 = boto3.client('s3', region_name=config.BEDROCK_REGION)
        self.dynamodb = boto3.resource('dynamodb', region_name=config.BEDROCK_REGION)
        self.transactions_table = self.dynamodb.Table(config.DYNAMODB_TABLE_TRANSACTIONS)
        self.bedrock = boto3.client('bedrock-runtime', region_name=config.BEDROCK_REGION)
        
        # Import PDF libraries only when needed
        try:
            from PyPDF2 import PdfReader
            self.PdfReader = PdfReader
        except ImportError:
            self.PdfReader = None
    
    def parse_csv(self, s3_bucket: str, s3_key: str, user_id: str) -> List[Transaction]:
        """
        Parse CSV bank statement from S3.
        
        Args:
            s3_bucket: S3 bucket name
            s3_key: S3 object key
            user_id: User ID
            
        Returns:
            List of parsed transactions
            
        Raises:
            ProcessingError: If parsing fails
        """
        try:
            # Download file from S3
            response = self.s3.get_object(Bucket=s3_bucket, Key=s3_key)
            content = response['Body'].read().decode('utf-8')
            
            # Parse CSV
            transactions = []
            csv_reader = csv.DictReader(io.StringIO(content))
            
            # Detect column mappings
            headers = csv_reader.fieldnames
            if not headers:
                raise ProcessingError(
                    'CSV file has no headers',
                    {'file': s3_key}
                )
            
            column_mapping = self._detect_column_mapping(headers)
            
            for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (header is row 1)
                try:
                    transaction = self._parse_csv_row(row, column_mapping, user_id, s3_key)
                    if transaction:
                        transactions.append(transaction)
                except Exception as e:
                    print(f'Warning: Failed to parse row {row_num}: {str(e)}')
                    # Continue parsing other rows
            
            if not transactions:
                raise ProcessingError(
                    'No valid transactions found in CSV file',
                    {'file': s3_key}
                )
            
            return transactions
            
        except ProcessingError:
            raise
        except Exception as e:
            raise ProcessingError(
                f'Failed to parse CSV file: {str(e)}',
                {'file': s3_key, 'error': str(e)}
            )
    def parse_pdf(self, s3_bucket: str, s3_key: str, user_id: str) -> List[Transaction]:
        """
        Parse PDF bank statement from S3.

        Args:
            s3_bucket: S3 bucket name
            s3_key: S3 object key
            user_id: User ID

        Returns:
            List of parsed transactions

        Raises:
            ProcessingError: If parsing fails
        """
        if not self.PdfReader:
            raise ProcessingError(
                'PDF parsing library not available',
                {'file': s3_key}
            )

        try:
            # Download file from S3
            response = self.s3.get_object(Bucket=s3_bucket, Key=s3_key)
            pdf_content = response['Body'].read()

            # Extract text from PDF
            pdf_reader = self.PdfReader(io.BytesIO(pdf_content))
            full_text = ""

            for page in pdf_reader.pages:
                full_text += page.extract_text() + "\n"

            if not full_text.strip():
                raise ProcessingError(
                    'No text found in PDF file',
                    {'file': s3_key}
                )

            # Try parsing with regex first
            transactions = self._parse_pdf_text(full_text, user_id, s3_key)

            if not transactions or use_llm:
                # Use LLM-based parsing if requested or if regex found nothing
                method = "forced LLM" if use_llm else "regex fallback to LLM"
                print(f'Attempting {method} parsing for PDF...')
                try:
                    transactions = self.parse_pdf_with_llm(s3_bucket, s3_key, user_id)
                except Exception as llm_error:
                    print(f'LLM parsing failed: {str(llm_error)}')
                    if not transactions: # Only raise if we have absolutely nothing
                        raise ProcessingError(
                            f'No transactions found in PDF file using any method. LLM error: {str(llm_error)}',
                            {'file': s3_key}
                        )

            return transactions

        except ProcessingError:
            raise
        except Exception as e:
            raise ProcessingError(
                f'Failed to parse PDF file: {str(e)}',
                {'file': s3_key, 'error': str(e)}
            )



    def _parse_pdf_text(self, text: str, user_id: str, source_file: str) -> List[Transaction]:
        """
        Parse transactions from plain text extracted from PDF.

        Args:
            text: Extracted text
            user_id: User ID
            source_file: Source file path

        Returns:
            List of transactions
        """
        import re

        transactions = []
        lines = text.split('\n')

        # Pattern to match transaction lines
        # Looks for: date, description, amount
        # Example: "01/15/2024 GROCERY STORE -45.67"
        date_pattern = r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b'
        amount_pattern = r'[-+]?\$?\s*\d{1,3}(?:,?\d{3})*(?:\.\d{2})?'

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Find date
            date_match = re.search(date_pattern, line)
            if not date_match:
                continue

            date_str = date_match.group(1)

            # Find amount (usually at the end)
            amount_matches = list(re.finditer(amount_pattern, line))
            if not amount_matches:
                continue

            amount_str = amount_matches[-1].group(0)

            # Description is between date and amount
            date_end = date_match.end()
            amount_start = amount_matches[-1].start()
            description = line[date_end:amount_start].strip()

            if not description:
                continue

            try:
                # Parse date
                transaction_date = date_parser.parse(date_str)

                # Parse amount
                amount_clean = amount_str.replace('$', '').replace(',', '').strip()
                amount = float(amount_clean)

                # Create transaction
                transaction_id = str(uuid.uuid4())
                transaction = Transaction(
                    id=transaction_id,
                    userId=user_id,
                    date=transaction_date,
                    description=description,
                    amount=amount,
                    balance=None,
                    sourceFile=source_file,
                    rawData=line,
                    createdAt=datetime.now(UTC)
                )

                transactions.append(transaction)

            except Exception as e:
                print(f'Warning: Failed to parse PDF text line: {str(e)}')
                continue

        return transactions

    def parse_pdf_with_llm(self, s3_bucket: str, s3_key: str, user_id: str) -> List[Transaction]:
        """
        Parse PDF using multimodal LLM (text-based approach).

        Args:
            s3_bucket: S3 bucket name
            s3_key: S3 object key
            user_id: User ID

        Returns:
            List of parsed transactions

        Raises:
            ProcessingError: If parsing fails
        """
        try:
            # Download PDF from S3
            response = self.s3.get_object(Bucket=s3_bucket, Key=s3_key)
            pdf_content = response['Body'].read()

            # Extract text from PDF
            if not self.PdfReader:
                raise ProcessingError(
                    'PDF parsing library not available',
                    {'file': s3_key}
                )

            pdf_reader = self.PdfReader(io.BytesIO(pdf_content))
            full_text = ""

            for page in pdf_reader.pages:
                full_text += page.extract_text() + "\n"

            if not full_text.strip():
                raise ProcessingError(
                    'No text found in PDF file',
                    {'file': s3_key}
                )

            # Use LLM to parse the text
            print(f'Sending {len(full_text)} characters of text to LLM for parsing...')
            transactions = self.parse_pdf_with_llm_text(full_text, user_id, s3_key)

            if not transactions:
                print(f'LLM returned NO transactions for file: {s3_key}')
                raise ProcessingError(
                    'No transactions found in PDF using LLM',
                    {'file': s3_key}
                )

            print(f'Successfully extracted {len(transactions)} transactions using LLM for file: {s3_key}')
            return transactions

        except ProcessingError:
            raise
        except Exception as e:
            raise ProcessingError(
                f'Failed to parse PDF with LLM: {str(e)}',
                {'file': s3_key, 'error': str(e)}
            )

    def parse_pdf_with_llm_text(self, text: str, user_id: str, source_file: str) -> List[Transaction]:
        """
        Parse transactions from PDF text using Claude LLM.

        Args:
            text: Extracted PDF text
            user_id: User ID
            source_file: Source file path

        Returns:
            List of transactions
        """
        prompt = f"""Analyze this bank statement text and extract all transactions.

    Bank Statement Text:
    {text[:10000]}  

    For each transaction, provide:
    - date: Transaction date in YYYY-MM-DD format (IMPORTANT: For dates like "10/18" or "11/01", interpret as MM/DD and use 2024 as the year unless the statement clearly shows a different year)
    - description: Transaction description/merchant name
    - amount: Transaction amount (negative for debits/expenses, positive for credits/deposits)
    - balance: Account balance after transaction (if visible)

    Return ONLY a valid JSON array with this exact structure:
    [
      {{
    "date": "2024-01-15",
    "description": "GROCERY STORE",
    "amount": -45.67,
    "balance": 1234.56
      }}
    ]

    Rules:
    - Extract ALL transactions visible in the text
    - Use negative amounts for debits/withdrawals/expenses
    - Use positive amounts for credits/deposits
    - For dates in MM/DD format, use 2024 as the year
    - If balance is not visible, omit the balance field
    - Return empty array [] if no transactions found
    - Return ONLY the JSON array, no other text"""

        try:
            # Call Claude 3 Sonnet
            response = self.bedrock.invoke_model(
                modelId='anthropic.claude-3-sonnet-20240229-v1:0',
                body=json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 4096,
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
            
            print(f'--- RAW LLM RESPONSE START ---')
            print(content)
            print(f'--- RAW LLM RESPONSE END ---')

            # Extract JSON from response
            content = content.strip()
            if content.startswith('```'):
                lines = content.split('\n')
                content = '\n'.join(lines[1:-1]) if len(lines) > 2 else content
                content = content.replace('```json', '').replace('```', '').strip()

            # Parse transactions
            try:
                transactions_data = json.loads(content)
            except json.JSONDecodeError as jde:
                print(f'Failed to parse LLM JSON: {str(jde)}')
                print(f'Content was: {content}')
                return []

            if not isinstance(transactions_data, list):
                print(f'Warning: LLM returned non-list response: {type(transactions_data)}')
                return []

            # Convert to Transaction objects
            transactions = []
            for tx_data in transactions_data:
                try:
                    transaction_date = datetime.fromisoformat(tx_data['date'])
                    transaction_id = str(uuid.uuid4())

                    transaction = Transaction(
                        id=transaction_id,
                        userId=user_id,
                        date=transaction_date,
                        description=tx_data['description'],
                        amount=float(tx_data['amount']),
                        balance=float(tx_data['balance']) if 'balance' in tx_data else None,
                        sourceFile=source_file,
                        rawData=json.dumps(tx_data),
                        createdAt=datetime.now(UTC)
                    )
                    transactions.append(transaction)

                except Exception as e:
                    print(f'Warning: Failed to parse LLM transaction: {str(e)}')
                    continue

            return transactions

        except Exception as e:
            print(f'Warning: LLM extraction failed: {str(e)}')
            return []





    
    def _detect_column_mapping(self, headers: List[str]) -> Dict[str, str]:
        """
        Detect which columns contain transaction data.
        
        Args:
            headers: CSV column headers
            
        Returns:
            Mapping of field names to column names
        """
        headers_lower = [h.lower().strip() for h in headers]
        mapping = {}
        
        # Date column
        date_keywords = ['date', 'transaction date', 'posting date', 'trans date']
        for keyword in date_keywords:
            for i, header in enumerate(headers_lower):
                if keyword in header:
                    mapping['date'] = headers[i]
                    break
            if 'date' in mapping:
                break
        
        # Description column
        desc_keywords = ['description', 'memo', 'details', 'transaction', 'merchant', 'payee']
        for keyword in desc_keywords:
            for i, header in enumerate(headers_lower):
                if keyword in header:
                    mapping['description'] = headers[i]
                    break
            if 'description' in mapping:
                break
        
        # Amount column
        amount_keywords = ['amount', 'debit', 'credit', 'value', 'transaction amount']
        for keyword in amount_keywords:
            for i, header in enumerate(headers_lower):
                if keyword in header and 'balance' not in header:
                    mapping['amount'] = headers[i]
                    break
            if 'amount' in mapping:
                break
        
        # Balance column (optional)
        balance_keywords = ['balance', 'running balance', 'account balance']
        for keyword in balance_keywords:
            for i, header in enumerate(headers_lower):
                if keyword in header:
                    mapping['balance'] = headers[i]
                    break
            if 'balance' in mapping:
                break
        
        # Validate required fields
        required_fields = ['date', 'description', 'amount']
        missing_fields = [f for f in required_fields if f not in mapping]
        if missing_fields:
            raise ProcessingError(
                f'Could not detect required columns: {", ".join(missing_fields)}',
                {'headers': headers, 'missing': missing_fields}
            )
        
        return mapping
    
    def _parse_csv_row(self, row: Dict[str, str], column_mapping: Dict[str, str], 
                       user_id: str, source_file: str) -> Optional[Transaction]:
        """
        Parse a single CSV row into a Transaction.
        
        Args:
            row: CSV row data
            column_mapping: Column name mapping
            user_id: User ID
            source_file: Source file path
            
        Returns:
            Transaction object or None if row is invalid
        """
        # Extract fields
        date_str = row.get(column_mapping['date'], '').strip()
        description = row.get(column_mapping['description'], '').strip()
        amount_str = row.get(column_mapping['amount'], '').strip()
        balance_str = row.get(column_mapping.get('balance', ''), '').strip() if 'balance' in column_mapping else None
        
        # Skip empty rows
        if not date_str or not description or not amount_str:
            return None
        
        # Parse date
        try:
            transaction_date = date_parser.parse(date_str)
        except Exception:
            raise ValidationError(
                f'Invalid date format: {date_str}',
                {'date': date_str}
            )
        
        # Parse amount
        try:
            # Remove currency symbols and commas
            amount_clean = amount_str.replace('$', '').replace(',', '').replace('£', '').replace('€', '').strip()
            # Handle parentheses for negative numbers
            if amount_clean.startswith('(') and amount_clean.endswith(')'):
                amount_clean = '-' + amount_clean[1:-1]
            amount = float(amount_clean)
        except Exception:
            raise ValidationError(
                f'Invalid amount format: {amount_str}',
                {'amount': amount_str}
            )
        
        # Parse balance (optional)
        balance = None
        if balance_str:
            try:
                balance_clean = balance_str.replace('$', '').replace(',', '').replace('£', '').replace('€', '').strip()
                if balance_clean.startswith('(') and balance_clean.endswith(')'):
                    balance_clean = '-' + balance_clean[1:-1]
                balance = float(balance_clean)
            except Exception:
                # Balance is optional, so we can ignore parsing errors
                pass
        
        # Create transaction
        transaction_id = str(uuid.uuid4())
        
        return Transaction(
            id=transaction_id,
            userId=user_id,
            date=transaction_date,
            description=description,
            amount=amount,
            balance=balance,
            sourceFile=source_file,
            rawData=str(row),
            createdAt=datetime.now(UTC)
        )
    
    def detect_duplicates(self, transactions: List[Transaction], user_id: str) -> List[Transaction]:
        """
        Filter out duplicate transactions.
        
        Args:
            transactions: List of transactions to check
            user_id: User ID
            
        Returns:
            List of unique transactions
        """
        unique_transactions = []
        seen_hashes = set()
        
        # Get existing transaction hashes from DynamoDB
        try:
            response = self.transactions_table.query(
                KeyConditionExpression='PK = :pk',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}'
                },
                ProjectionExpression='id, #d, description, amount',
                ExpressionAttributeNames={'#d': 'date'}
            )
            
            for item in response.get('Items', []):
                tx_hash = self._generate_transaction_hash(
                    item['date'],
                    item['description'],
                    float(item['amount'])
                )
                seen_hashes.add(tx_hash)
                
        except Exception as e:
            print(f'Warning: Failed to check for duplicates: {str(e)}')
            # Continue without duplicate checking
        
        # Filter new transactions
        for transaction in transactions:
            tx_hash = self._generate_transaction_hash(
                transaction.date.isoformat(),
                transaction.description,
                transaction.amount
            )
            
            if tx_hash not in seen_hashes:
                unique_transactions.append(transaction)
                seen_hashes.add(tx_hash)
        
        return unique_transactions
    
    def _generate_transaction_hash(self, date: str, description: str, amount: float) -> str:
        """
        Generate unique hash for a transaction.
        
        Args:
            date: Transaction date (ISO format string)
            description: Transaction description
            amount: Transaction amount
            
        Returns:
            SHA256 hash
        """
        # Normalize inputs
        date_normalized = date[:10] if len(date) >= 10 else date  # Use just the date part
        description_normalized = description.lower().strip()
        amount_normalized = f'{amount:.2f}'
        
        # Create hash
        hash_input = f'{date_normalized}|{description_normalized}|{amount_normalized}'
        return hashlib.sha256(hash_input.encode()).hexdigest()
    
    def store_transactions(self, transactions: List[Transaction]) -> int:
        """
        Store transactions in DynamoDB.
        
        Args:
            transactions: List of transactions to store
            
        Returns:
            Number of transactions stored
        """
        stored_count = 0
        
        for transaction in transactions:
            try:
                # Create DynamoDB item
                item = {
                    'PK': f'USER#{transaction.userId}',
                    'SK': f'TRANSACTION#{transaction.date.isoformat()}#{transaction.id}',
                    'id': transaction.id,
                    'date': transaction.date.isoformat(),
                    'description': transaction.description,
                    'amount': str(transaction.amount),  # Store as string to avoid precision issues
                    'sourceFile': transaction.sourceFile,
                    'createdAt': transaction.createdAt.isoformat(),
                    'isAnomaly': False,
                    'category': transaction.category if transaction.category else 'Uncategorized',
                    'categoryConfidence': str(transaction.categoryConfidence) if transaction.categoryConfidence is not None else '0.0',
                    # GSI keys for querying
                    'GSI1PK': f'USER#{transaction.userId}#CATEGORY#{transaction.category if transaction.category else "Uncategorized"}',  # Will be updated by categorization service
                    'GSI1SK': f'DATE#{transaction.date.isoformat()}',
                    'GSI2PK': f'USER#{transaction.userId}#DATE#{transaction.date.strftime("%Y-%m")}',
                    'GSI2SK': f'AMOUNT#{abs(transaction.amount):012.2f}'
                }
                
                if transaction.balance is not None:
                    item['balance'] = str(transaction.balance)
                
                # Store in DynamoDB
                self.transactions_table.put_item(Item=item)
                stored_count += 1
                
            except Exception as e:
                print(f'Warning: Failed to store transaction {transaction.id}: {str(e)}')
                # Continue storing other transactions
        
        return stored_count
