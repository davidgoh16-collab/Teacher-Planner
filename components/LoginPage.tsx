import React, { useState } from 'react';
import { auth, microsoftProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { BookOpen, AlertCircle } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, microsoftProvider);
      // Auth state change will be caught by App.tsx
    } catch (err: any) {
      console.error("Login Error:", err);
      let errorMessage = "Failed to sign in. Please try again.";
      if (err.code === 'auth/account-exists-with-different-credential') {
        errorMessage = "An account already exists with the same email address but different sign-in credentials.";
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = "Sign-in popup was blocked by the browser. Please allow popups.";
      } else if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = "Sign-in cancelled.";
      }
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header Section */}
        <div className="bg-slate-900 dark:bg-slate-950 p-8 text-center border-b border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-indigo-500 to-purple-500"></div>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-2xl mb-4 shadow-lg shadow-green-900/50">
            <BookOpen size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Teacher Planner</h1>
          <p className="text-slate-400 text-sm">Academic Year 2025/2026</p>
        </div>

        {/* Login Body */}
        <div className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Welcome back</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Please sign in to access your timetable and lesson plans.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 p-3 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleMicrosoftLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-[#2F2F2F] hover:bg-[#1a1a1a] text-white py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden"
          >
            {/* Microsoft Logo SVG */}
            <svg className="w-5 h-5" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
              <path fill="#f35325" d="M1 1h10v10H1z"/>
              <path fill="#81bc06" d="M12 1h10v10H12z"/>
              <path fill="#05a6f0" d="M1 12h10v10H1z"/>
              <path fill="#ffba08" d="M12 12h10v10H12z"/>
            </svg>
            <span className="font-medium">
              {loading ? 'Signing in...' : 'Sign in with Microsoft'}
            </span>
          </button>

          <p className="text-xs text-center text-gray-400 dark:text-slate-600 mt-6">
            Secure authentication powered by Firebase
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;