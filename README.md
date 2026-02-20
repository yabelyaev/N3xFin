# N3xFin: AI-Powered Financial Intelligence Platform

N3xFin is a next-generation financial intelligence platform that transforms raw bank statements into actionable insights using AWS-powered AI.

## Features

- 🔐 Secure file upload (CSV/PDF bank statements)
- 🤖 AI-powered transaction categorization (Amazon Bedrock)
- 📊 Visual spending dashboards
- 🚨 Anomaly detection for unusual charges
- 📈 Predictive spending alerts
- 💡 Personalized savings recommendations
- 💬 Conversational Q&A interface
- 📄 Monthly financial health reports

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: AWS Lambda (Python 3.11)
- **Database**: Amazon DynamoDB
- **Storage**: Amazon S3 (AES-256 encryption)
- **AI Engine**: Amazon Bedrock (Claude 3.5 Sonnet)
- **Auth**: AWS Cognito
- **API**: API Gateway
- **Hosting**: AWS Amplify

## Project Structure

```
n3xfin/
├── backend/
│   ├── src/
│   │   ├── common/          # Shared utilities and models
│   │   ├── auth/            # Authentication service
│   │   ├── upload/          # File upload service
│   │   ├── parser/          # Statement parsing service
│   │   ├── categorization/  # AI categorization service
│   │   ├── analytics/       # Analytics and anomaly detection
│   │   ├── prediction/      # Predictive alerts
│   │   ├── recommendation/  # Savings recommendations
│   │   ├── conversation/    # Conversational Q&A
│   │   └── report/          # Report generation
│   ├── tests/               # Test suite
│   ├── template.yaml        # SAM template
│   └── requirements.txt     # Python dependencies
├── frontend/                # React application (to be created)
└── .kiro/specs/n3xfin/     # Feature specifications
```

## Getting Started

### Prerequisites

- Python 3.11+
- AWS CLI configured with credentials
- AWS SAM CLI
- Node.js 18+ (for frontend)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
make install

# Run tests
make test

# Deploy to AWS
make deploy
```

### Frontend Setup (Coming Soon)

```bash
cd frontend
npm install
npm start
```

## Development

### Running Tests

```bash
# Run all tests
make test

# Run with coverage
make test-coverage

# Run specific test file
pytest tests/test_parser.py -v
```

### Code Quality

```bash
# Format code
make format

# Lint code
make lint
```

## Security

- All data encrypted at rest (AES-256) and in transit (TLS 1.2+)
- User data isolation with separate S3 paths
- Password complexity requirements enforced
- Session timeout and rate limiting
- Privacy-first design with minimal PII storage

## AWS Free Tier Usage

This project is designed to stay within AWS Free Tier limits:
- Lambda: 1M requests/month
- DynamoDB: 25GB storage, 25 RCU/WCU
- S3: 5GB storage
- Cognito: 50,000 MAUs
- API Gateway: 1M requests/month

## License

MIT License - See LICENSE file for details

## Contributing

This project follows spec-driven development. See `.kiro/specs/n3xfin/` for requirements, design, and tasks.
