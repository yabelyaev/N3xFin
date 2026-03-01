"""Unit tests for parser service."""
import pytest
import io
from datetime import datetime
from parser.parser_service import ParserService
from common.errors import ProcessingError, ValidationError


class TestColumnMapping:
    """Test CSV column detection."""
    
    def test_detect_standard_columns(self):
        """Test detection of standard column names."""
        service = ParserService()
        headers = ['Date', 'Description', 'Amount', 'Balance']
        mapping = service._detect_column_mapping(headers)
        
        assert mapping['date'] == 'Date'
        assert mapping['description'] == 'Description'
        assert mapping['amount'] == 'Amount'
        assert mapping['balance'] == 'Balance'
    
    def test_detect_alternative_column_names(self):
        """Test detection of alternative column names."""
        service = ParserService()
        headers = ['Transaction Date', 'Memo', 'Debit', 'Running Balance']
        mapping = service._detect_column_mapping(headers)
        
        assert 'date' in mapping
        assert 'description' in mapping
        assert 'amount' in mapping
        assert 'balance' in mapping
    
    def test_detect_case_insensitive(self):
        """Test case-insensitive column detection."""
        service = ParserService()
        headers = ['DATE', 'DESCRIPTION', 'AMOUNT']
        mapping = service._detect_column_mapping(headers)
        
        assert 'date' in mapping
        assert 'description' in mapping
        assert 'amount' in mapping
    
    def test_missing_required_column(self):
        """Test error when required column is missing."""
        service = ParserService()
        headers = ['Date', 'Description']  # Missing amount
        
        with pytest.raises(ProcessingError) as exc_info:
            service._detect_column_mapping(headers)
        assert 'amount' in str(exc_info.value.message).lower()


class TestCSVRowParsing:
    """Test parsing of individual CSV rows."""
    
    def test_parse_valid_row(self):
        """Test parsing a valid CSV row."""
        service = ParserService()
        row = {
            'Date': '2024-02-20',
            'Description': 'Coffee Shop',
            'Amount': '-5.50',
            'Balance': '1000.00'
        }
        column_mapping = {
            'date': 'Date',
            'description': 'Description',
            'amount': 'Amount',
            'balance': 'Balance'
        }
        
        transaction = service._parse_csv_row(row, column_mapping, 'user-123', 'test.csv')
        
        assert transaction is not None
        assert transaction.userId == 'user-123'
        assert transaction.description == 'Coffee Shop'
        assert transaction.amount == -5.50
        assert transaction.balance == 1000.00
    
    def test_parse_row_with_currency_symbols(self):
        """Test parsing amounts with currency symbols."""
        service = ParserService()
        row = {
            'Date': '2024-02-20',
            'Description': 'Purchase',
            'Amount': '$1,234.56'
        }
        column_mapping = {
            'date': 'Date',
            'description': 'Description',
            'amount': 'Amount'
        }
        
        transaction = service._parse_csv_row(row, column_mapping, 'user-123', 'test.csv')
        
        assert transaction.amount == 1234.56
    
    def test_parse_row_with_parentheses_negative(self):
        """Test parsing negative amounts in parentheses."""
        service = ParserService()
        row = {
            'Date': '2024-02-20',
            'Description': 'Withdrawal',
            'Amount': '(100.00)'
        }
        column_mapping = {
            'date': 'Date',
            'description': 'Description',
            'amount': 'Amount'
        }
        
        transaction = service._parse_csv_row(row, column_mapping, 'user-123', 'test.csv')
        
        assert transaction.amount == -100.00
    
    def test_parse_row_various_date_formats(self):
        """Test parsing various date formats."""
        service = ParserService()
        column_mapping = {
            'date': 'Date',
            'description': 'Description',
            'amount': 'Amount'
        }
        
        date_formats = [
            '2024-02-20',
            '02/20/2024',
            '20-Feb-2024',
            'February 20, 2024'
        ]
        
        for date_str in date_formats:
            row = {
                'Date': date_str,
                'Description': 'Test',
                'Amount': '10.00'
            }
            transaction = service._parse_csv_row(row, column_mapping, 'user-123', 'test.csv')
            assert transaction is not None
            assert isinstance(transaction.date, datetime)
    
    def test_parse_row_skip_empty(self):
        """Test that empty rows are skipped."""
        service = ParserService()
        row = {
            'Date': '',
            'Description': '',
            'Amount': ''
        }
        column_mapping = {
            'date': 'Date',
            'description': 'Description',
            'amount': 'Amount'
        }
        
        transaction = service._parse_csv_row(row, column_mapping, 'user-123', 'test.csv')
        
        assert transaction is None
    
    def test_parse_row_invalid_date(self):
        """Test error on invalid date format."""
        service = ParserService()
        row = {
            'Date': 'invalid-date',
            'Description': 'Test',
            'Amount': '10.00'
        }
        column_mapping = {
            'date': 'Date',
            'description': 'Description',
            'amount': 'Amount'
        }
        
        with pytest.raises(ValidationError) as exc_info:
            service._parse_csv_row(row, column_mapping, 'user-123', 'test.csv')
        assert 'date' in str(exc_info.value.message).lower()
    
    def test_parse_row_invalid_amount(self):
        """Test error on invalid amount format."""
        service = ParserService()
        row = {
            'Date': '2024-02-20',
            'Description': 'Test',
            'Amount': 'not-a-number'
        }
        column_mapping = {
            'date': 'Date',
            'description': 'Description',
            'amount': 'Amount'
        }
        
        with pytest.raises(ValidationError) as exc_info:
            service._parse_csv_row(row, column_mapping, 'user-123', 'test.csv')
        assert 'amount' in str(exc_info.value.message).lower()


class TestTransactionHash:
    """Test transaction hash generation for duplicate detection."""
    
    def test_generate_hash_consistent(self):
        """Test that same transaction generates same hash."""
        service = ParserService()
        
        hash1 = service._generate_transaction_hash('2024-02-20', 'Coffee Shop', 5.50)
        hash2 = service._generate_transaction_hash('2024-02-20', 'Coffee Shop', 5.50)
        
        assert hash1 == hash2
    
    def test_generate_hash_case_insensitive_description(self):
        """Test that description is case-insensitive."""
        service = ParserService()
        
        hash1 = service._generate_transaction_hash('2024-02-20', 'Coffee Shop', 5.50)
        hash2 = service._generate_transaction_hash('2024-02-20', 'COFFEE SHOP', 5.50)
        
        assert hash1 == hash2
    
    def test_generate_hash_different_for_different_transactions(self):
        """Test that different transactions generate different hashes."""
        service = ParserService()
        
        hash1 = service._generate_transaction_hash('2024-02-20', 'Coffee Shop', 5.50)
        hash2 = service._generate_transaction_hash('2024-02-21', 'Coffee Shop', 5.50)
        hash3 = service._generate_transaction_hash('2024-02-20', 'Restaurant', 5.50)
        hash4 = service._generate_transaction_hash('2024-02-20', 'Coffee Shop', 6.00)
        
        assert hash1 != hash2
        assert hash1 != hash3
        assert hash1 != hash4


class TestParserServiceMocked:
    """Test ParserService with mocked AWS services."""
    
    @pytest.fixture
    def parser_service(self, mocker):
        """Create ParserService with mocked AWS clients."""
        service = ParserService()
        service.s3 = mocker.Mock()
        service.dynamodb = mocker.Mock()
        service.transactions_table = mocker.Mock()
        return service
    
    def test_parse_csv_success(self, parser_service):
        """Test successful CSV parsing."""
        csv_content = """Date,Description,Amount,Balance
2024-02-20,Coffee Shop,-5.50,1000.00
2024-02-21,Salary,2000.00,3000.00
2024-02-22,Grocery Store,-50.00,2950.00"""
        
        parser_service.s3.get_object.return_value = {
            'Body': io.BytesIO(csv_content.encode('utf-8'))
        }
        
        transactions = parser_service.parse_csv('test-bucket', 'test.csv', 'user-123')
        
        assert len(transactions) == 3
        assert transactions[0].description == 'Coffee Shop'
        assert transactions[0].amount == -5.50
        assert transactions[1].description == 'Salary'
        assert transactions[1].amount == 2000.00
    
    def test_parse_csv_no_headers(self, parser_service):
        """Test error when CSV has no headers."""
        csv_content = ""
        
        parser_service.s3.get_object.return_value = {
            'Body': io.BytesIO(csv_content.encode('utf-8'))
        }
        
        with pytest.raises(ProcessingError) as exc_info:
            parser_service.parse_csv('test-bucket', 'test.csv', 'user-123')
        assert 'no headers' in str(exc_info.value.message).lower()
    
    def test_parse_csv_no_valid_transactions(self, parser_service):
        """Test error when no valid transactions found."""
        csv_content = """Date,Description,Amount
,,"""
        
        parser_service.s3.get_object.return_value = {
            'Body': io.BytesIO(csv_content.encode('utf-8'))
        }
        
        with pytest.raises(ProcessingError) as exc_info:
            parser_service.parse_csv('test-bucket', 'test.csv', 'user-123')
        assert 'no valid transactions' in str(exc_info.value.message).lower()
