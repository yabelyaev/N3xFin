#!/bin/bash
# Local development setup script

set -e

echo "🚀 Setting up N3xFin local development environment..."

# Check Python version
echo "📋 Checking Python version..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
required_version="3.11"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "❌ Python 3.11+ required. Found: $python_version"
    exit 1
fi
echo "✅ Python version: $python_version"

# Create virtual environment
echo "📦 Creating virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "ℹ️  Virtual environment already exists"
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip > /dev/null 2>&1

# Install dependencies
echo "📚 Installing dependencies..."
pip install -r requirements.txt > /dev/null 2>&1
pip install -r requirements-dev.txt > /dev/null 2>&1
echo "✅ Dependencies installed"

# Run tests to verify setup
echo "🧪 Running tests to verify setup..."
pytest tests/ -v --tb=short || echo "⚠️  Some tests may fail until AWS resources are deployed"

echo ""
echo "✅ Local development environment ready!"
echo ""
echo "Next steps:"
echo "  1. Activate virtual environment: source venv/bin/activate"
echo "  2. Configure AWS credentials: aws configure"
echo "  3. Deploy infrastructure: sam build && sam deploy --guided"
echo "  4. Run tests: make test"
echo ""
