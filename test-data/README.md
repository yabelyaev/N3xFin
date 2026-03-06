# N3xFin Test Data

## Overview

This directory contains **realistic Australian bank statements** for testing the N3xFin platform.

## Generated Files

### First Bank Australia - Checking Account
Account: 1234-5678-9012

- **FirstBank_Statement_Sep2025.pdf** (Sep-Oct 2025) - 60 days
- **FirstBank_Statement_Nov2025.pdf** (Nov-Dec 2025) - 60 days  
- **FirstBank_Statement_Jan2026.pdf** (Jan-Feb 2026) - 60 days

### Second Bank Australia - Savings Account
Account: 9876-5432-1098

- **SecondBank_Statement_Sep2025.pdf** (Sep-Oct 2025) - 60 days
- **SecondBank_Statement_Nov2025.pdf** (Nov-Dec 2025) - 60 days
- **SecondBank_Statement_Jan2026.pdf** (Jan-Feb 2026) - 60 days

### CSV Versions
Each PDF has a corresponding CSV file for testing both formats.

## Transaction Details

### Realistic Generic Merchants
- **Groceries**: SuperMart, FreshGrocer, Local Market, Budget Foods, Organic Market
- **Dining**: City Cafe, Quick Bites, Pizza Place, Sandwich Shop, Coffee Corner
- **Transportation**: Public Transport Card, Gas Station, Fuel Stop, Service Station
- **Utilities**: Power Company, Energy Provider, Water Utility, Telecom Provider, Internet Service
- **Entertainment**: Streaming Service A, Music Streaming, Cinema Complex, Movie Theater, Video Service
- **Shopping**: Department Store, Retail Shop, Electronics Store, Hardware Store, Fashion Outlet
- **Health**: Pharmacy, Health Store, Fitness Center, Gym Membership

_Note: All merchant names are generic to avoid trademark issues._

### Transaction Patterns
- **Monthly salary**: $4,500-$5,000 on the 15th of each month
- **Daily transactions**: 1-4 per day (70% of days)
- **Spending ranges**:
  - Groceries: $15-$180
  - Dining: $8-$65
  - Transportation: $5-$85
  - Utilities: $50-$250
  - Entertainment: $10-$45
  - Shopping: $20-$350
  - Health: $15-$120

### Date Format
All dates use Australian format: **DD/MM/YYYY**

Example: `15/09/2025` = 15 September 2025

## Regenerating Test Data

To regenerate the test statements:

```bash
python3 generate_test_statements.py
```

This will create fresh statements with randomized transactions.

## Testing Scenarios

### 1. Single Statement Upload
Upload one PDF or CSV to test basic parsing.

### 2. Multi-Statement Upload
Upload all 6 statements to test:
- 6-month trend analysis
- Spending recommendations with historical context
- Anomaly detection across time periods
- Predictive alerts based on patterns

### 3. Multi-Bank Support
Upload both First Bank and Second Bank statements to test:
- Combined analytics across accounts
- Category aggregation from multiple sources
- Duplicate detection across banks

### 4. Format Comparison
Upload both PDF and CSV versions of the same statement to verify:
- Consistent parsing results
- Duplicate detection working
- No data loss between formats

## Expected Results

When all 6 statements are uploaded:

- **Total transactions**: ~800-1,200 (varies due to randomization)
- **Time period**: 6 months (Sep 2025 - Feb 2026)
- **Total income**: ~$27,000-$30,000 (6 months salary)
- **Total expenses**: ~$20,000-$25,000
- **Categories**: 7-8 main categories
- **Anomalies**: 5-15 unusual transactions
- **Recommendations**: 3-6 personalized savings tips

## Notes

- Transactions are randomly generated each time
- Balances are calculated sequentially
- Spending patterns include realistic variation
- Some months may have spending spikes (intentional for testing)
- Income is consistent (salary) for predictability

## Privacy & Legal

These are **100% fictional test statements** with:
- Generic bank names (no real trademarks)
- Generic merchant names (no real brands)
- Fictional account numbers
- Random transaction amounts
- No real personal information
- Safe for demos, testing, and public sharing

**Purpose**: Testing and demonstration only. Not affiliated with any real financial institutions.

## Integration with N3xFin

Upload these files at: https://main.dognrdvmztld1.amplifyapp.com

1. Register a test account
2. Navigate to Upload page
3. Upload statements one by one or in batch
4. Wait for parsing to complete
5. Check Dashboard for analytics
6. Test all features with 6 months of data
