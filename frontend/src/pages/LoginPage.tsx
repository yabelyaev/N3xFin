import { LoginForm } from '../components/auth';
import { enableDemoMode } from '../services/demoMode';
import { useNavigate } from 'react-router-dom';

export function LoginPage() {
  const navigate = useNavigate();

  const handleDemoMode = () => {
    enableDemoMode();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">N3xFin</h1>
          <p className="text-gray-600">AI-Powered Financial Intelligence</p>
        </div>
        <LoginForm />
        
        {/* Demo Mode Button */}
        <div className="mt-6">
          <button
            onClick={handleDemoMode}
            className="w-full py-3 px-4 border-2 border-indigo-600 text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-colors"
          >
            🎭 Try Demo Mode
          </button>
          <p className="text-xs text-gray-500 text-center mt-2">
            Explore the app with sample data (no AWS deployment needed)
          </p>
        </div>
      </div>
    </div>
  );
}
