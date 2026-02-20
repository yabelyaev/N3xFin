.PHONY: install test lint format clean deploy

install:
	pip install -r requirements-dev.txt

test:
	pytest tests/ -v

test-coverage:
	pytest tests/ --cov=src --cov-report=html --cov-report=term

lint:
	flake8 src/ tests/
	mypy src/

format:
	black src/ tests/

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache .coverage htmlcov .mypy_cache

deploy:
	sam build
	sam deploy --guided

deploy-fast:
	sam build
	sam deploy
