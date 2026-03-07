import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

interface IncomeSource {
  type: string;
  monthly_amount: number;
}

interface Goal {
  id?: string;
  name: string;
  type: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  priority: string;
  status?: string;
}

interface Debt {
  name: string;
  type: string;
  balance: number;
  interest_rate: number;
  minimum_payment: number;
}

interface Profile {
  occupation: string;
  income_sources: IncomeSource[];
  goals: Goal[];
  debts: Debt[];
  fixed_expenses: Record<string, number>;
}

export const ProfileGoalsPage = () => {
  const [profile, setProfile] = useState<Profile>({
    occupation: '',
    income_sources: [],
    goals: [],
    debts: [],
    fixed_expenses: {}
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await apiService.getProfile();
      setProfile(response.data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      await apiService.saveProfile(profile);
      setSaveMessage('Profile saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('Error saving profile');
      console.error('Error saving profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addGoal = () => {
    setProfile({
      ...profile,
      goals: [...profile.goals, {
        name: '',
        type: 'savings',
        target_amount: 0,
        current_amount: 0,
        deadline: '',
        priority: 'medium'
      }]
    });
  };

  const updateGoal = (index: number, field: keyof Goal, value: any) => {
    const newGoals = [...profile.goals];
    newGoals[index] = { ...newGoals[index], [field]: value };
    setProfile({ ...profile, goals: newGoals });
  };

  const removeGoal = (index: number) => {
    setProfile({
      ...profile,
      goals: profile.goals.filter((_, i) => i !== index)
    });
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-8 text-white">
        <h1 className="text-3xl font-bold">🎯 Financial Goals & Profile</h1>
        <p className="mt-2 text-blue-100">
          Set your goals and let AI help you achieve them with personalized recommendations
        </p>
      </div>

      {/* Occupation */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex items-center mb-4">
          <span className="text-2xl mr-3">💼</span>
          <h2 className="text-xl font-semibold text-gray-900">Your Occupation</h2>
        </div>
        <input
          type="text"
          value={profile.occupation}
          onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
          placeholder="e.g., Software Engineer, Teacher, Business Owner"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
        <p className="mt-2 text-sm text-gray-500 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          AI can suggest career-related income opportunities based on your occupation
        </p>
      </div>

      {/* Financial Goals */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <span className="text-2xl mr-3">🎯</span>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Financial Goals</h2>
                <p className="text-sm text-gray-500 mt-1">Track your progress toward what matters most</p>
              </div>
            </div>
            <button
              onClick={addGoal}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Goal
            </button>
          </div>
        </div>

        <div className="p-6">
          {profile.goals.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎯</div>
              <p className="text-gray-500 text-lg mb-2">No goals yet</p>
              <p className="text-gray-400 text-sm">Add your first goal to get personalized AI recommendations</p>
            </div>
          ) : (
            <div className="space-y-6">
              {profile.goals.map((goal, index) => {
                const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
                const progressColor = progress >= 75 ? 'bg-green-500' : progress >= 50 ? 'bg-blue-500' : progress >= 25 ? 'bg-yellow-500' : 'bg-red-500';
                
                return (
                  <div key={index} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Goal Name
                        </label>
                        <input
                          type="text"
                          value={goal.name}
                          onChange={(e) => updateGoal(index, 'name', e.target.value)}
                          placeholder="e.g., College Fund, Pay off Credit Card"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Type
                        </label>
                        <select
                          value={goal.type}
                          onChange={(e) => updateGoal(index, 'type', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="savings">💰 Savings</option>
                          <option value="debt_payoff">💳 Debt Payoff</option>
                          <option value="investment">📈 Investment</option>
                          <option value="emergency_fund">🚨 Emergency Fund</option>
                          <option value="other">📌 Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Target Amount
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">$</span>
                          <input
                            type="number"
                            value={goal.target_amount}
                            onChange={(e) => updateGoal(index, 'target_amount', parseFloat(e.target.value) || 0)}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Current Amount
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">$</span>
                          <input
                            type="number"
                            value={goal.current_amount}
                            onChange={(e) => updateGoal(index, 'current_amount', parseFloat(e.target.value) || 0)}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Deadline
                        </label>
                        <input
                          type="date"
                          value={goal.deadline}
                          onChange={(e) => updateGoal(index, 'deadline', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Priority
                        </label>
                        <select
                          value={goal.priority}
                          onChange={(e) => updateGoal(index, 'priority', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="low">🟢 Low</option>
                          <option value="medium">🟡 Medium</option>
                          <option value="high">🔴 High</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mt-4 mb-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Progress</span>
                        <span className="text-sm font-semibold text-gray-900">
                          ${goal.current_amount.toLocaleString()} / ${goal.target_amount.toLocaleString()} ({Math.round(progress)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-3 rounded-full transition-all duration-500 ${progressColor}`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => removeGoal(index)}
                        className="flex items-center text-red-600 hover:text-red-800 text-sm font-medium transition"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove Goal
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end items-center space-x-4 bg-white rounded-lg shadow-md p-4 border border-gray-200">
        {saveMessage && (
          <div className={`flex items-center ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {saveMessage.includes('Error') ? (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            <span className="text-sm font-medium">{saveMessage}</span>
          </div>
        )}
        <button
          onClick={saveProfile}
          disabled={isSaving}
          className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-sm font-medium"
        >
          {isSaving ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save Profile
            </>
          )}
        </button>
      </div>
    </div>
  );
};
