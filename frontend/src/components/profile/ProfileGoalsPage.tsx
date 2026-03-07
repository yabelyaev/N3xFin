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
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Financial Profile & Goals</h1>
        <p className="mt-2 text-gray-600">
          Help your AI financial advisor give you personalized, goal-oriented advice
        </p>
      </div>

      {/* Occupation */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Occupation</h2>
        <input
          type="text"
          value={profile.occupation}
          onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
          placeholder="e.g., Software Engineer, Teacher, Business Owner"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="mt-2 text-sm text-gray-500">
          Your AI advisor can suggest career-related income opportunities based on your occupation
        </p>
      </div>

      {/* Financial Goals */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Financial Goals</h2>
          <button
            onClick={addGoal}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Goal
          </button>
        </div>

        {profile.goals.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No goals yet. Add a goal to get personalized recommendations!
          </p>
        ) : (
          <div className="space-y-4">
            {profile.goals.map((goal, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Goal Name
                    </label>
                    <input
                      type="text"
                      value={goal.name}
                      onChange={(e) => updateGoal(index, 'name', e.target.value)}
                      placeholder="e.g., College Fund, Pay off Credit Card"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={goal.type}
                      onChange={(e) => updateGoal(index, 'type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="savings">Savings</option>
                      <option value="debt_payoff">Debt Payoff</option>
                      <option value="investment">Investment</option>
                      <option value="emergency_fund">Emergency Fund</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Target Amount ($)
                    </label>
                    <input
                      type="number"
                      value={goal.target_amount}
                      onChange={(e) => updateGoal(index, 'target_amount', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Amount ($)
                    </label>
                    <input
                      type="number"
                      value={goal.current_amount}
                      onChange={(e) => updateGoal(index, 'current_amount', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deadline
                    </label>
                    <input
                      type="date"
                      value={goal.deadline}
                      onChange={(e) => updateGoal(index, 'deadline', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      value={goal.priority}
                      onChange={(e) => updateGoal(index, 'priority', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Progress: ${goal.current_amount.toLocaleString()} / ${goal.target_amount.toLocaleString()} 
                    ({goal.target_amount > 0 ? Math.round((goal.current_amount / goal.target_amount) * 100) : 0}%)
                  </div>
                  <button
                    onClick={() => removeGoal(index)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end items-center space-x-4">
        {saveMessage && (
          <span className={`text-sm ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {saveMessage}
          </span>
        )}
        <button
          onClick={saveProfile}
          disabled={isSaving}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
};
