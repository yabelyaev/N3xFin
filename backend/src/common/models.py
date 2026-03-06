from datetime import datetime, UTC
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field


@dataclass
class Transaction:
    """Transaction data model."""
    id: str
    userId: str
    date: datetime
    description: str
    amount: float
    sourceFile: str
    rawData: str
    balance: Optional[float] = None
    category: Optional[str] = None
    categoryConfidence: Optional[float] = None
    isAnomaly: bool = False
    anomalyReason: Optional[str] = None
    createdAt: datetime = field(default_factory=lambda: datetime.now(UTC))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for DynamoDB."""
        return {
            'id': self.id,
            'userId': self.userId,
            'date': self.date.isoformat(),
            'description': self.description,
            'amount': str(self.amount),
            'balance': str(self.balance) if self.balance is not None else None,
            'category': self.category or 'Uncategorized',
            'categoryConfidence': str(self.categoryConfidence) if self.categoryConfidence is not None else '0.0',
            'isAnomaly': self.isAnomaly,
            'anomalyReason': self.anomalyReason,
            'sourceFile': self.sourceFile,
            'rawData': self.rawData,
            'createdAt': self.createdAt.isoformat()
        }


@dataclass
class Category:
    """Category data model."""
    id: str
    name: str
    description: str
    confidence: float


@dataclass
class User:
    """User data model."""
    id: str
    email: str
    createdAt: datetime
    lastLogin: datetime


@dataclass
class CategorySpending:
    """Category spending aggregation."""
    category: str
    totalAmount: float
    transactionCount: int
    percentageOfTotal: float


@dataclass
class Anomaly:
    """Anomaly detection result."""
    transaction: Transaction
    reason: str
    severity: str  # 'low', 'medium', 'high'
    expectedRange: dict


@dataclass
class Recommendation:
    """Savings recommendation."""
    id: str
    title: str
    description: str
    category: str
    potentialSavings: float
    actionItems: List[str]
    priority: int


@dataclass
class FinancialHealthReport:
    """Monthly financial health report."""
    userId: str
    month: datetime
    totalSpending: float
    spendingByCategory: List[CategorySpending]
    savingsRate: float
    trends: List[Dict[str, Any]]
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
    'Loans & Debt',
    'ATM & Cash',
    'Transfers',
    'Other'
]
