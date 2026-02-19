# N3xFin

🚀 The Vision
Most people suffer from "financial opacity"—they see numbers but don't understand the story behind them. N3xFin democratizes sophisticated financial advice by using AWS-powered AI to analyze bank statements in plain language, helping users identify wasteful spending and build better saving habits.

✨ Key Features
Intelligent Categorization: Automatically sorts transactions from CSV/PDF uploads using Amazon Bedrock.

Conversational Q&A: An AI agent that answers questions like "Why was my dining spend so high last month?"

Predictive Spending Alerts: Forecasts upcoming high-spend periods based on historical patterns.

Anomaly Detection: Flags unusual charges or duplicate transactions instantly.

Monthly Health Reports: Generates comprehensive, actionable financial summaries.

🛠 Tech Stack
Designed for the AWS Marketplace using a secure, serverless architecture:

Component	Technology
Frontend	React / Tailwind CSS
Hosting	AWS Amplify
AI Engine	Amazon Bedrock (Claude 3.5 Sonnet)
Backend	AWS Lambda (Python)
Database	Amazon DynamoDB
Storage	Amazon S3 (with AES-256 encryption)
Parsing	Amazon Textract / Python-based PDF parsers
