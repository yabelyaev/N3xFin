# N3xFin Architecture

## System Architecture Diagram

```mermaid
graph TB
    subgraph "Client"
        USER[User Browser]
    end

    subgraph "Frontend - AWS Amplify"
        UI[React App<br/>TypeScript]
    end

    subgraph "API Layer"
        APIGW[API Gateway]
        COGNITO[Cognito<br/>Auth]
    end

    subgraph "Compute - AWS Lambda Functions"
        AUTH[Auth Service]
        UPLOAD[File Upload]
        PARSE[PDF/CSV Parser]
        CATEGORIZE[AI Categorization<br/>Batch Processing]
        ANALYTICS[Analytics Engine]
        AI_SERVICES[AI Services<br/>Predictions, Recommendations,<br/>Reports, Q&A]
    end

    subgraph "AI"
        BEDROCK[Amazon Bedrock<br/>Claude 3.5 Haiku<br/>Claude 3 Sonnet]
    end

    subgraph "Storage"
        S3[S3 Bucket<br/>Statements]
        DYNAMO[DynamoDB<br/>Single Table]
    end

    USER -->|HTTPS| UI
    UI -->|REST API| APIGW
    APIGW -->|Authorize| COGNITO
    
    APIGW --> AUTH
    APIGW --> UPLOAD
    APIGW --> PARSE
    APIGW --> CATEGORIZE
    APIGW --> ANALYTICS
    APIGW --> AI_SERVICES

    UPLOAD -->|Presigned URLs| S3
    PARSE -->|Read Files| S3
    PARSE -->|Store Transactions| DYNAMO
    
    CATEGORIZE -->|AI Categorization| BEDROCK
    CATEGORIZE -->|Update| DYNAMO
    CATEGORIZE -.->|Self-Invoke<br/>Large Batches| CATEGORIZE
    
    AI_SERVICES -->|AI Analysis| BEDROCK
    AI_SERVICES -->|Query/Update| DYNAMO
    
    ANALYTICS -->|Query| DYNAMO
    AUTH -->|User Data| DYNAMO

    style USER fill:#e1f5ff
    style UI fill:#61dafb
    style APIGW fill:#ff4f8b
    style COGNITO fill:#dd344c
    style AUTH fill:#ff9900
    style UPLOAD fill:#ff9900
    style PARSE fill:#ff9900
    style CATEGORIZE fill:#ff9900
    style ANALYTICS fill:#ff9900
    style AI_SERVICES fill:#ff9900
    style BEDROCK fill:#00a1c9
    style S3 fill:#569a31
    style DYNAMO fill:#4053d6
```

### Architecture Layers

**Frontend Layer**
- React SPA with TypeScript
- Hosted on AWS Amplify with CI/CD
- Responsive design for desktop and mobile

**API Layer**
- API Gateway for REST endpoints
- Cognito for JWT-based authentication
- Request validation and throttling

**Compute Layer (10 Lambda Functions)**
- **Auth**: Login, register, verify, logout
- **Upload**: Generate presigned S3 URLs
- **Parser**: Extract transactions from PDF/CSV
- **Categorization**: AI-powered batch categorization with self-invocation
- **Analytics**: Spending analysis and trend calculation
- **Prediction**: Anomaly detection and alerts
- **Recommendation**: Savings advice generation
- **Report**: Monthly report generation
- **Conversation**: Q&A assistant
- **Profile**: User goals and preferences

**AI Layer**
- Amazon Bedrock with Claude 3.5 Haiku (primary)
- Claude 3 Sonnet for PDF parsing
- Batch processing to optimize costs

**Storage Layer**
- S3 for bank statement files (encrypted)
- DynamoDB single-table design for all data
- Server-side encryption at rest

## Data Flow

### 1. User Authentication Flow
```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API Gateway
    participant Cognito
    participant Lambda
    participant DynamoDB

    User->>Frontend: Enter credentials
    Frontend->>API Gateway: POST /auth/login
    API Gateway->>Lambda: Invoke Auth Function
    Lambda->>Cognito: Verify credentials
    Cognito-->>Lambda: User verified
    Lambda->>DynamoDB: Get user profile
    DynamoDB-->>Lambda: User data
    Lambda-->>API Gateway: JWT token
    API Gateway-->>Frontend: Auth response
    Frontend-->>User: Logged in
```

### 2. Statement Upload & Processing Flow
```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API Gateway
    participant Upload Lambda
    participant S3
    participant Parser Lambda
    participant Categorize Lambda
    participant Bedrock
    participant DynamoDB

    User->>Frontend: Upload PDF/CSV
    Frontend->>API Gateway: Request upload URL
    API Gateway->>Upload Lambda: Generate presigned URL
    Upload Lambda->>S3: Create presigned URL
    S3-->>Upload Lambda: URL
    Upload Lambda-->>Frontend: Presigned URL
    Frontend->>S3: Upload file directly
    S3-->>Frontend: Upload complete
    Frontend->>API Gateway: POST /parser/parse
    API Gateway->>Parser Lambda: Parse statement
    Parser Lambda->>S3: Read file
    S3-->>Parser Lambda: File content
    Parser Lambda->>Parser Lambda: Extract transactions
    Parser Lambda->>DynamoDB: Store transactions
    Parser Lambda->>API Gateway: Trigger categorization
    API Gateway->>Categorize Lambda: Categorize batch
    Categorize Lambda->>DynamoDB: Get uncategorized
    DynamoDB-->>Categorize Lambda: Transactions
    Categorize Lambda->>Bedrock: AI categorization
    Bedrock-->>Categorize Lambda: Categories
    Categorize Lambda->>DynamoDB: Update categories
    Categorize Lambda->>Categorize Lambda: Self-invoke if more
    Categorize Lambda-->>Frontend: Status update
```

### 3. Analytics & Insights Flow
```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API Gateway
    participant Analytics Lambda
    participant Prediction Lambda
    participant Recommendation Lambda
    participant Bedrock
    participant DynamoDB

    User->>Frontend: View dashboard
    Frontend->>API Gateway: GET /analytics
    API Gateway->>Analytics Lambda: Get spending data
    Analytics Lambda->>DynamoDB: Query transactions
    DynamoDB-->>Analytics Lambda: Transaction data
    Analytics Lambda->>Analytics Lambda: Calculate trends
    Analytics Lambda-->>Frontend: Analytics data
    
    Frontend->>API Gateway: GET /predictions/alerts
    API Gateway->>Prediction Lambda: Get anomalies
    Prediction Lambda->>DynamoDB: Query patterns
    DynamoDB-->>Prediction Lambda: Historical data
    Prediction Lambda->>Prediction Lambda: Z-score analysis
    Prediction Lambda-->>Frontend: Anomalies
    
    Frontend->>API Gateway: GET /recommendations
    API Gateway->>Recommendation Lambda: Get advice
    Recommendation Lambda->>DynamoDB: Query spending
    DynamoDB-->>Recommendation Lambda: Spending data
    Recommendation Lambda->>Bedrock: AI analysis
    Bedrock-->>Recommendation Lambda: Recommendations
    Recommendation Lambda-->>Frontend: Savings advice
```

### 4. Conversational AI Flow
```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API Gateway
    participant Conversation Lambda
    participant Bedrock
    participant DynamoDB

    User->>Frontend: Ask question
    Frontend->>API Gateway: POST /conversation/ask
    API Gateway->>Conversation Lambda: Process question
    Conversation Lambda->>DynamoDB: Get user context
    DynamoDB-->>Conversation Lambda: Transactions + Goals
    Conversation Lambda->>Conversation Lambda: Build prompt
    Conversation Lambda->>Bedrock: AI Q&A
    Bedrock-->>Conversation Lambda: Answer
    Conversation Lambda-->>Frontend: Response
    Frontend-->>User: Display answer
```

## DynamoDB Table Design

### Single Table Design
```
Primary Key: PK (Partition Key) + SK (Sort Key)

Entity Types:
┌─────────────────────────────────────────────────────────────┐
│ USER                                                         │
│ PK: USER#<userId>                                           │
│ SK: PROFILE                                                 │
│ Attributes: email, createdAt, goals, preferences            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TRANSACTION                                                  │
│ PK: USER#<userId>                                           │
│ SK: TRANSACTION#<date>#<transactionId>                      │
│ Attributes: amount, description, category, balance          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ REPORT                                                       │
│ PK: USER#<userId>                                           │
│ SK: REPORT#<YYYY-MM>                                        │
│ Attributes: totalSpending, savingsRate, insights            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FILE                                                         │
│ PK: USER#<userId>                                           │
│ SK: FILE#<fileKey>                                          │
│ Attributes: filename, uploadedAt, status, s3Key             │
└─────────────────────────────────────────────────────────────┘

Access Patterns:
1. Get user profile: Query PK=USER#<id>, SK=PROFILE
2. Get transactions by date: Query PK=USER#<id>, SK begins_with TRANSACTION#<date>
3. Get all transactions: Query PK=USER#<id>, SK begins_with TRANSACTION#
4. Get monthly report: Query PK=USER#<id>, SK=REPORT#<YYYY-MM>
5. List user files: Query PK=USER#<id>, SK begins_with FILE#
```

## AWS Services Used

| Service | Purpose | Free Tier Limit |
|---------|---------|-----------------|
| **AWS Amplify** | Frontend hosting, CI/CD | 1,000 build minutes/month, 15 GB served |
| **API Gateway** | REST API endpoints | 1M requests/month |
| **AWS Lambda** | Serverless compute | 1M requests/month, 400K GB-seconds |
| **Amazon Cognito** | User authentication | 50,000 MAUs |
| **Amazon DynamoDB** | NoSQL database | 25 GB storage, 25 RCU/WCU |
| **Amazon S3** | File storage | 5 GB storage, 20K GET, 2K PUT |
| **Amazon Bedrock** | AI/ML (Claude 3.5 Haiku + Claude 3 Sonnet) | Pay per token (~$0.001/1K input for Haiku) |

## Security Architecture

```mermaid
graph LR
    subgraph "Security Layers"
        A[HTTPS/TLS<br/>Encryption in Transit]
        B[Cognito JWT<br/>Authentication]
        C[IAM Roles<br/>Least Privilege]
        D[S3 Encryption<br/>Data at Rest]
        E[DynamoDB Encryption<br/>Data at Rest]
    end

    A --> B
    B --> C
    C --> D
    C --> E

    style A fill:#dd344c
    style B fill:#dd344c
    style C fill:#dd344c
    style D fill:#569a31
    style E fill:#4053d6
```

### Security Features
- **Authentication**: Amazon Cognito with JWT tokens
- **Authorization**: IAM roles with least-privilege access
- **Encryption in Transit**: HTTPS/TLS for all API calls
- **Encryption at Rest**: S3 and DynamoDB server-side encryption
- **API Security**: API Gateway throttling and request validation
- **Data Isolation**: User data partitioned by userId in DynamoDB
- **Secure File Upload**: Presigned S3 URLs with expiration

## Scalability & Performance

### Optimization Strategies
1. **Caching**: Frontend caches analytics data with stale-while-revalidate
2. **Batch Processing**: Categorization processes 50 transactions per Bedrock call
3. **Async Processing**: Large uploads trigger Lambda self-invocation chains
4. **Data Preloading**: Common time ranges preloaded on dashboard
5. **Efficient Queries**: DynamoDB composite keys enable single-query access patterns
6. **Serverless Auto-scaling**: Lambda scales automatically with demand

### Performance Metrics
- **Dashboard Load**: < 2 seconds (with cached data)
- **File Upload**: < 5 seconds for 100 transactions
- **Categorization**: ~2 seconds per 50 transactions
- **AI Q&A Response**: < 3 seconds
- **Report Generation**: < 5 seconds

## Cost Optimization

### Staying Within Free Tier
- **Lambda**: Optimized function size and execution time
- **DynamoDB**: Single-table design minimizes queries
- **Bedrock**: Batch processing reduces API calls by 50x
- **S3**: Files deleted after processing (optional)
- **API Gateway**: Caching reduces redundant requests

### Estimated Monthly Costs (Beyond Free Tier)
- Lambda: $0 (within free tier for typical usage)
- DynamoDB: $0 (within free tier for < 1000 users)
- S3: $0 (within free tier for < 100 statements/month)
- Bedrock: $5-15 (main cost driver, no free tier)
- **Total**: ~$5-15/month for demo/competition usage

