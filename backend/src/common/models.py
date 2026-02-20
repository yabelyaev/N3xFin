"""Data models for N3xFin platform."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class Transaction(BaseModel):
    """Transaction data model."""
    id: str
    userId: str
    date: datetime
    description: str
    amount: float
    balance: Optional[float] = None
    category: Optional[str] = None
    categoryConfidence: Optional[float] = None
    isAnomaly: bool = False
    anomalyReason: Optional[str] = None
    sourceFile: str
    rawData: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class Category(BaseModel):
    """Category data model."""
    id: str
    name: str
    description: str
    confidence: float


class User(BaseModel):
    """User data model."""
    id: str
    email: str
    createdAt: datetime
    lastLogin: datetime


class CategorySpending(BaseModel):
    """Category spending aggregation."""
    category: str
    totalAmount: float
    transactionCount: int
    percentageOfTotal: float


class Anomaly(BaseModel):
    """Anomaly detection result."""
    transaction: Transaction
    reason: str
    severity: str  # 'low', 'medium', 'high'
    expectedRange: dict


class Recommendation(BaseModel):
    """Savings recommendation."""
    id: str
    title: str
    description: str
    category: str
    potentialSavings: float
    actionItems: List[str]
    priority: int


class FinancialHealthReport(BaseModel):
    """Monthly financial health report."""
    userId: str
    month: datetime
    totalSpending: float
    spendingByCategory: List[CategorySpending]
    savingsRate: float
    trends: List[dict]
    insights: List[str]
    recommendations: List[Recommendation]


# Category taxonomy
CATEGORIES = [
    'Dining',
    'Transportation',
    'Utilities',
    'Entertainment',
    'Shopping',
    'Healthcare',
    'Housing',
    'Income',
    'Savings',
    'Other'
]
