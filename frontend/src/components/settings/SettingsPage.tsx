import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { getUser } from '../../utils/auth';
import { AccountDeletionDialog } from './AccountDeletionDialog';

interface UserPreferences {
  alertThreshold: number;
  reportFrequency: 'weekly' | 'monthly';
}

export function SettingsPage() {
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<UserPreferences>({
    alertThreshold: 120,
    reportFrequency: 'monthly',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const user = getUser();

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getUserPreferences();
      if (response.data) {
        setPreferences(response.data);
      }
    } catch (err: any) {
      console.error('Failed to load preferences:', err);
      // Use defaults if loading fails
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await apiService.updateUserPreferences(preferences);
      setSuccess('Preferences saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteComplete = () => {
    // Redirect to login page after account deletion
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center">
            <div className="text-gray-600">Loading settings...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your account preferences and settings
          </p>
        </div>

        {/* User Information */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Account Information</h2>
          </div>
          <div className="px-6 py-5">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <div className="mt-1 text-sm text-gray-900">{user?.email || 'Not available'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">User ID</label>
                <div className="mt-1 text-sm text-gray-500 font-mono">{user?.id || 'Not available'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Preferences</h2>
          </div>
          <div className="px-6 py-5">
            <div className="space-y-6">
              {/* Alert Threshold */}
              <div>
                <label htmlFor="alertThreshold" className="block text-sm font-medium text-gray-700">
                  Alert Threshold (%)
                </label>
                <p className="mt-1 text-sm text-gray-500">
                  Receive alerts when predicted spending exceeds historical average by this percentage
                </p>
                <div className="mt-2 flex items-center space-x-4">
                  <input
                    type="range"
                    id="alertThreshold"
                    min="100"
                    max="200"
                    step="5"
                    value={preferences.alertThreshold}
                    onChange={(e) =>
                      setPreferences({ ...preferences, alertThreshold: parseInt(e.target.value) })
                    }
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-900 w-16 text-right">
                    {preferences.alertThreshold}%
                  </span>
                </div>
              </div>

              {/* Report Frequency */}
              <div>
                <label htmlFor="reportFrequency" className="block text-sm font-medium text-gray-700">
                  Report Frequency
                </label>
                <p className="mt-1 text-sm text-gray-500">
                  How often you want to receive financial health reports
                </p>
                <select
                  id="reportFrequency"
                  value={preferences.reportFrequency}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      reportFrequency: e.target.value as 'weekly' | 'monthly',
                    })
                  }
                  className="mt-2 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            {success && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">{success}</p>
              </div>
            )}

            {/* Save Button */}
            <div className="mt-6">
              <button
                onClick={handleSavePreferences}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone - Account Deletion */}
        <div className="bg-white shadow rounded-lg border-2 border-red-200">
          <div className="px-6 py-5 border-b border-red-200 bg-red-50">
            <h2 className="text-lg font-medium text-red-900">Danger Zone</h2>
          </div>
          <div className="px-6 py-5">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Delete Account</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Once you delete your account, there is no going back. All your data will be permanently deleted within 30 days.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Delete My Account
              </button>
            </div>
          </div>
        </div>

        {/* Account Deletion Dialog */}
        <AccountDeletionDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onDeleteComplete={handleDeleteComplete}
        />
      </div>
    </div>
  );
}
