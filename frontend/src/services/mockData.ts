// Mock data for demo mode
export const mockTransactions = [
  { id: '1', date: '2024-02-15', description: 'Starbucks Coffee', amount: -5.50, category: 'Dining', balance: 2450.50 },
  { id: '2', date: '2024-02-14', description: 'Uber Ride', amount: -15.00, category: 'Transportation', balance: 2456.00 },
  { id: '3', date: '2024-02-14', description: 'Whole Foods', amount: -85.30, category: 'Shopping', balance: 2471.00 },
  { id: '4', date: '2024-02-13', description: 'Netflix Subscription', amount: -15.99, category: 'Entertainment', balance: 2556.30 },
  { id: '5', date: '2024-02-12', description: 'Shell Gas Station', amount: -45.00, category: 'Transportation', balance: 2572.29 },
  { id: '6', date: '2024-02-10', description: 'Amazon Purchase', amount: -125.00, category: 'Shopping', balance: 2617.29 },
  { id: '7', date: '2024-02-10', description: 'Salary Deposit', amount: 3000.00, category: 'Income', balance: 2742.29 },
  { id: '8', date: '2024-02-08', description: 'Electric Bill', amount: -120.00, category: 'Utilities', balance: -257.71 },
  { id: '9', date: '2024-02-05', description: 'Restaurant Dinner', amount: -75.00, category: 'Dining', balance: -137.71 },
  { id: '10', date: '2024-02-03', description: 'Gym Membership', amount: -50.00, category: 'Healthcare', balance: -62.71 },
  { id: '11', date: '2024-02-01', description: 'Rent Payment', amount: -1200.00, category: 'Housing', balance: -12.71 },
  { id: '12', date: '2024-01-28', description: 'Coffee Shop', amount: -6.50, category: 'Dining', balance: 1187.29 },
  { id: '13', date: '2024-01-25', description: 'Gas Station', amount: -40.00, category: 'Transportation', balance: 1193.79 },
  { id: '14', date: '2024-01-22', description: 'Grocery Store', amount: -95.00, category: 'Shopping', balance: 1233.79 },
  { id: '15', date: '2024-01-20', description: 'Movie Tickets', amount: -30.00, category: 'Entertainment', balance: 1328.79 },
];

export const mockAnalytics = {
  categorySpending: [
    { category: 'Dining', totalAmount: 87.00, transactionCount: 3, percentageOfTotal: 4.5 },
    { category: 'Transportation', totalAmount: 100.00, transactionCount: 3, percentageOfTotal: 5.2 },
    { category: 'Shopping', totalAmount: 305.30, transactionCount: 3, percentageOfTotal: 15.8 },
    { category: 'Entertainment', totalAmount: 45.99, transactionCount: 2, percentageOfTotal: 2.4 },
    { category: 'Utilities', totalAmount: 120.00, transactionCount: 1, percentageOfTotal: 6.2 },
    { category: 'Healthcare', totalAmount: 50.00, transactionCount: 1, percentageOfTotal: 2.6 },
    { category: 'Housing', totalAmount: 1200.00, transactionCount: 1, percentageOfTotal: 62.1 },
  ],
  timeSeriesData: [
    { timestamp: '2024-02-01', amount: 1200.00 },
    { timestamp: '2024-02-03', amount: 50.00 },
    { timestamp: '2024-02-05', amount: 75.00 },
    { timestamp: '2024-02-08', amount: 120.00 },
    { timestamp: '2024-02-10', amount: 125.00 },
    { timestamp: '2024-02-12', amount: 45.00 },
    { timestamp: '2024-02-13', amount: 15.99 },
    { timestamp: '2024-02-14', amount: 100.30 },
    { timestamp: '2024-02-15', amount: 5.50 },
  ],
};

export const mockAnomalies = [
  {
    id: 'a1',
    transaction: mockTransactions[10],
    reason: 'Unusually high amount for Housing category',
    severity: 'high' as const,
    expectedRange: { min: 800, max: 1000 },
  },
];

export const mockPredictions = [
  {
    id: 'p1',
    category: 'Dining',
    predictedAmount: 150.00,
    historicalAverage: 120.00,
    severity: 'warning' as const,
    message: 'Your dining spending is predicted to be 25% higher than usual this month',
    recommendations: [
      'Consider meal prepping to reduce restaurant visits',
      'Set a weekly dining budget of $30',
    ],
  },
];

export const mockRecommendations = [
  {
    id: 'r1',
    title: 'Reduce Dining Expenses',
    description: 'You spent $87 on dining out this month. Cooking at home could save you money.',
    category: 'Dining',
    potentialSavings: 50.00,
    actionItems: [
      'Plan meals for the week',
      'Buy groceries in bulk',
      'Limit restaurant visits to once per week',
    ],
    priority: 1,
  },
  {
    id: 'r2',
    title: 'Optimize Transportation Costs',
    description: 'Consider carpooling or public transit to reduce gas expenses.',
    category: 'Transportation',
    potentialSavings: 30.00,
    actionItems: [
      'Use public transportation twice a week',
      'Combine errands to reduce trips',
    ],
    priority: 2,
  },
];

export const mockReports = [
  {
    id: 'report-2024-02',
    month: '2024-02',
    totalSpending: 1932.79,
    totalIncome: 3000.00,
    spendingByCategory: mockAnalytics.categorySpending,
    savingsRate: 35.6,
    trends: [
      { category: 'Dining', direction: 'increasing' as const, percentageChange: 15 },
      { category: 'Shopping', direction: 'stable' as const, percentageChange: 2 },
    ],
    insights: [
      'Your savings rate improved by 5% compared to last month',
      'Housing remains your largest expense at 62% of spending',
      'Consider reducing dining expenses to increase savings',
    ],
    recommendations: mockRecommendations,
    generatedAt: new Date().toISOString(),
  },
];
