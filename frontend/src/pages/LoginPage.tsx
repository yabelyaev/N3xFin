import { LoginForm } from '../components/auth';

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">N3xFin</h1>
          <p className="text-gray-600">AI-Powered Financial Intelligence</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
