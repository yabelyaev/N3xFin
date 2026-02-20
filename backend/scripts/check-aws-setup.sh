#!/bin/bash
# Check AWS setup and credentials

set -e

echo "🔍 Checking AWS setup..."
echo ""

# Check AWS CLI
echo "1️⃣  Checking AWS CLI..."
if command -v aws &> /dev/null; then
    aws_version=$(aws --version 2>&1)
    echo "✅ AWS CLI installed: $aws_version"
else
    echo "❌ AWS CLI not found. Install from: https://aws.amazon.com/cli/"
    exit 1
fi

# Check AWS credentials
echo ""
echo "2️⃣  Checking AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    account_id=$(aws sts get-caller-identity --query Account --output text)
    user_arn=$(aws sts get-caller-identity --query Arn --output text)
    echo "✅ AWS credentials configured"
    echo "   Account ID: $account_id"
    echo "   User/Role: $user_arn"
else
    echo "❌ AWS credentials not configured. Run: aws configure"
    exit 1
fi

# Check AWS SAM CLI
echo ""
echo "3️⃣  Checking AWS SAM CLI..."
if command -v sam &> /dev/null; then
    sam_version=$(sam --version 2>&1)
    echo "✅ AWS SAM CLI installed: $sam_version"
else
    echo "❌ AWS SAM CLI not found. Install from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

# Check default region
echo ""
echo "4️⃣  Checking AWS region..."
region=$(aws configure get region)
if [ -z "$region" ]; then
    echo "⚠️  No default region set. Recommended: us-east-1"
    echo "   Set with: aws configure set region us-east-1"
else
    echo "✅ Default region: $region"
fi

# Check if stack exists
echo ""
echo "5️⃣  Checking for existing N3xFin stack..."
if aws cloudformation describe-stacks --stack-name n3xfin-stack &> /dev/null; then
    stack_status=$(aws cloudformation describe-stacks --stack-name n3xfin-stack --query 'Stacks[0].StackStatus' --output text)
    echo "✅ Stack exists: n3xfin-stack (Status: $stack_status)"
    
    echo ""
    echo "📊 Stack Outputs:"
    aws cloudformation describe-stacks --stack-name n3xfin-stack --query 'Stacks[0].Outputs' --output table
else
    echo "ℹ️  Stack not deployed yet. Run: sam build && sam deploy --guided"
fi

echo ""
echo "✅ AWS setup check complete!"
echo ""
