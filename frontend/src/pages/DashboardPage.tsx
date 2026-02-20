import { useState } from 'react';
import {
  SpendingDashboard,
  AnomalyAlerts,
  PredictiveAlerts,
  SavingsRecommendations,
} from '../components/dashboard';

export const DashboardPage = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'anomalies' | 'alerts' | 'recommendations'>('overview');

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: '📊' },
    { id: 'anomalies' as const, label: 'Anomalies', icon: '🔍' },
    { id: 'alerts' as const, label: 'Alerts', icon: '⚠️' },
    { id: 'recommendations' as const, label: 'Savings', icon: '💰' },
  ];

  return (
    <div className="bg-gray-50">
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Financial Dashboard</h1>
          <p className="text-sm text-gray-600 mb-6">
            Track your spending, detect anomalies, and discover savings opportunities
          </p>
          <div className="flex gap-1 border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'overview' && <SpendingDashboard />}
          {activeTab === 'anomalies' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Anomaly Detection</h2>
              <AnomalyAlerts />
            </div>
          )}
          {activeTab === 'alerts' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Predictive Spending Alerts</h2>
              <PredictiveAlerts />
            </div>
          )}
          {activeTab === 'recommendations' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Savings Recommendations</h2>
              <SavingsRecommendations />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
