"""Unit tests for categorization service."""
import pytest
import json
from datetime import datetime
from src.categorization.categorization_service import CategorizationService
from src.common.models import Transaction, CATEGORIES


class TestPromptBuilding:
    """Test categorization prompt building."""
    
    def test_build_prompt_single_transaction(self):
        """Test prompt building for single transaction."""
        service = CategorizationService()
        transaction = Transaction(
            id='tx-1',
            userId='user-123',
            date=datetime(2024, 2, 20),
            description='Starbucks Coffee',
            amount=-5.50,
            sourceFile='test.csv',
            rawData='{}',
            createdAt=datetime.utcnow()
        )
        
        prompt = service._build_categorization_prompt([transaction])
        
        assert 'Starbucks Coffee' in prompt
        assert '$5.50' in prompt
        assert 'expense' in prompt
        assert all(cat in prompt for cat in CATEGORIES)
    
    def test_build_prompt_multiple_transactions(self):
        """Test prompt building for multiple transactions."""
        service = CategorizationService()
        transactions = [
            Transaction(
                id='tx-1',
                userId='user-123',
                date=datetime(2024, 2, 20),
                description='Coffee Shop',
                amount=-5.50,
                sourceFile='test.csv',
                rawData='{}',
                createdAt=datetime.utcnow()
            ),
            Transaction(
                id='tx-2',
                userId='user-123',
                date=datetime(2024, 2, 21),
                description='Salary Deposit',
                amount=2000.00,
                sourceFile='test.csv',
                rawData='{}',
                createdAt=datetime.utcnow()
            )
        ]
        
        prompt = service._build_categorization_prompt(transactions)
        
        assert 'Coffee Shop' in prompt
        assert 'Salary Deposit' in prompt
        assert 'expense' in prompt
        assert 'income' in prompt


class TestResponseParsing:
    """Test parsing of Bedrock responses."""
    
    def test_parse_valid_json_response(self):
        """Test parsing valid JSON response."""
        service = CategorizationService()
        response_text = json.dumps([
            {"category": "Dining", "confidence": 0.95, "reasoning": "Coffee shop purchase"},
            {"category": "Income", "confidence": 0.98, "reasoning": "Salary deposit"}
        ])
        
        transactions = [
            Transaction(id='tx-1', userId='user-123', date=datetime.utcnow(), 
                       description='Coffee', amount=-5.50, sourceFile='test.csv', 
                       rawData='{}', createdAt=datetime.utcnow()),
            Transaction(id='tx-2', userId='user-123', date=datetime.utcnow(), 
                       description='Salary', amount=2000.00, sourceFile='test.csv', 
                       rawData='{}', createdAt=datetime.utcnow())
        ]
        
        results = service._parse_categorization_response(response_text, transactions)
        
        assert len(results) == 2
        assert results[0]['category'] == 'Dining'
        assert results[0]['confidence'] == 0.95
        assert results[1]['category'] == 'Income'
    
    def test_parse_response_with_markdown(self):
        """Test parsing response wrapped in markdown code blocks."""
        service = CategorizationService()
        response_text = """```json
[
    {"category": "Dining", "confidence": 0.95, "reasoning": "Coffee shop"}
]
```"""
        
        transactions = [
            Transaction(id='tx-1', userId='user-123', date=datetime.utcnow(), 
                       description='Coffee', amount=-5.50, sourceFile='test.csv', 
                       rawData='{}', createdAt=datetime.utcnow())
        ]
        
        results = service._parse_categorization_response(response_text, transactions)
        
        assert len(results) == 1
        assert results[0]['category'] == 'Dining'
    
    def test_parse_response_invalid_category(self):
        """Test that invalid categories default to Other."""
        service = CategorizationService()
        response_text = json.dumps([
            {"category": "InvalidCategory", "confidence": 0.95, "reasoning": "Test"}
        ])
        
        transactions = [
            Transaction(id='tx-1', userId='user-123', date=datetime.utcnow(), 
                       description='Test', amount=-10.00, sourceFile='test.csv', 
                       rawData='{}', createdAt=datetime.utcnow())
        ]
        
        results = service._parse_categorization_response(response_text, transactions)
        
        assert results[0]['category'] == 'Other'
        assert results[0]['confidence'] == 0.0
    
    def test_parse_response_low_confidence(self):
        """Test that low confidence results default to Other."""
        service = CategorizationService()
        response_text = json.dumps([
            {"category": "Dining", "confidence": 0.5, "reasoning": "Uncertain"}
        ])
        
        transactions = [
            Transaction(id='tx-1', userId='user-123', date=datetime.utcnow(), 
                       description='Test', amount=-10.00, sourceFile='test.csv', 
                       rawData='{}', createdAt=datetime.utcnow())
        ]
        
        results = service._parse_categorization_response(response_text, transactions)
        
        # Confidence 0.5 is below threshold (0.7), should become Other
        assert results[0]['category'] == 'Other'
    
    def test_parse_response_malformed_json(self):
        """Test handling of malformed JSON."""
        service = CategorizationService()
        response_text = "This is not valid JSON"
        
        transactions = [
            Transaction(id='tx-1', userId='user-123', date=datetime.utcnow(), 
                       description='Test', amount=-10.00, sourceFile='test.csv', 
                       rawData='{}', createdAt=datetime.utcnow())
        ]
        
        results = service._parse_categorization_response(response_text, transactions)
        
        # Should fallback to Other
        assert len(results) == 1
        assert results[0]['category'] == 'Other'
        assert results[0]['confidence'] == 0.0
    
    def test_parse_response_missing_results(self):
        """Test handling when response has fewer results than transactions."""
        service = CategorizationService()
        response_text = json.dumps([
            {"category": "Dining", "confidence": 0.95, "reasoning": "Coffee"}
        ])
        
        transactions = [
            Transaction(id='tx-1', userId='user-123', date=datetime.utcnow(), 
                       description='Coffee', amount=-5.50, sourceFile='test.csv', 
                       rawData='{}', createdAt=datetime.utcnow()),
            Transaction(id='tx-2', userId='user-123', date=datetime.utcnow(), 
                       description='Lunch', amount=-15.00, sourceFile='test.csv', 
                       rawData='{}', createdAt=datetime.utcnow())
        ]
        
        results = service._parse_categorization_response(response_text, transactions)
        
        # Should pad with Other category
        assert len(results) == 2
        assert results[0]['category'] == 'Dining'
        assert results[1]['category'] == 'Other'


class TestCategorizationServiceMocked:
    """Test CategorizationService with mocked AWS services."""
    
    @pytest.fixture
    def categorization_service(self, mocker):
        """Create CategorizationService with mocked AWS clients."""
        service = CategorizationService()
        service.bedrock = mocker.Mock()
        service.dynamodb = mocker.Mock()
        service.transactions_table = mocker.Mock()
        return service
    
    def test_categorize_batch_success(self, categorization_service, mocker):
        """Test successful batch categorization."""
        # Mock Bedrock response
        mock_response = {
            'body': mocker.Mock()
        }
        mock_response['body'].read.return_value = json.dumps({
            'content': [{
                'text': json.dumps([
                    {"category": "Dining", "confidence": 0.95, "reasoning": "Coffee shop"},
                    {"category": "Transportation", "confidence": 0.90, "reasoning": "Gas station"}
                ])
            }]
        }).encode()
        
        categorization_service.bedrock.invoke_model.return_value = mock_response
        
        transactions = [
            Transaction(id='tx-1', userId='user-123', date=datetime.utcnow(), 
                       description='Starbucks', amount=-5.50, sourceFile='test.csv', 
                       rawData='{}', createdAt=datetime.utcnow()),
            Transaction(id='tx-2', userId='user-123', date=datetime.utcnow(), 
                       description='Shell Gas', amount=-40.00, sourceFile='test.csv', 
                       rawData='{}', createdAt=datetime.utcnow())
        ]
        
        results = categorization_service.categorize_batch(transactions)
        
        assert len(results) == 2
        assert results[0]['category'] == 'Dining'
        assert results[0]['confidence'] == 0.95
        assert results[1]['category'] == 'Transportation'
    
    def test_categorize_batch_bedrock_error(self, categorization_service):
        """Test handling of Bedrock errors."""
        categorization_service.bedrock.invoke_model.side_effect = Exception('Bedrock error')
        
        transactions = [
            Transaction(id='tx-1', userId='user-123', date=datetime.utcnow(), 
                       description='Test', amount=-10.00, sourceFile='test.csv', 
                       rawData='{}', createdAt=datetime.utcnow())
        ]
        
        results = categorization_service.categorize_batch(transactions)
        
        # Should fallback to Other
        assert len(results) == 1
        assert results[0]['category'] == 'Other'
        assert results[0]['confidence'] == 0.0
    
    def test_categorize_empty_list(self, categorization_service):
        """Test categorizing empty transaction list."""
        results = categorization_service.categorize_batch([])
        assert results == []
    
    def test_categorize_large_batch(self, categorization_service, mocker):
        """Test that large batches are split correctly."""
        # Create 60 transactions (should be split into 2 batches of 50)
        transactions = [
            Transaction(id=f'tx-{i}', userId='user-123', date=datetime.utcnow(), 
                       description=f'Transaction {i}', amount=-10.00, sourceFile='test.csv', 
                       rawData='{}', createdAt=datetime.utcnow())
            for i in range(60)
        ]
        
        # Mock Bedrock to return appropriate number of results
        def mock_invoke(modelId, body):
            body_dict = json.loads(body)
            prompt = body_dict['messages'][0]['content']
            # Count transactions in prompt
            count = prompt.count('Description:')
            
            mock_response = mocker.Mock()
            mock_response.read.return_value = json.dumps({
                'content': [{
                    'text': json.dumps([
                        {"category": "Other", "confidence": 0.5, "reasoning": "Test"}
                        for _ in range(count)
                    ])
                }]
            }).encode()
            
            return {'body': mock_response}
        
        categorization_service.bedrock.invoke_model.side_effect = mock_invoke
        
        results = categorization_service.categorize_batch(transactions)
        
        # Should have results for all 60 transactions
        assert len(results) == 60
        # Bedrock should have been called twice (2 batches)
        assert categorization_service.bedrock.invoke_model.call_count == 2
