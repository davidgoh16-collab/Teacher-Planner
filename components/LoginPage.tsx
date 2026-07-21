import React, { useState } from 'react';
import { auth, microsoftProvider, googleProvider } from '../firebase';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { AlertCircle, Mail, Lock, User as UserIcon, Loader2 } from 'lucide-react';

type Mode = 'signin' | 'register';

const friendlyError = (code: string): string => {
  switch (code) {
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email but a different sign-in method.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by the browser. Please allow popups.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in cancelled.';
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account already exists for that email. Try signing in instead.';
    case 'auth/weak-password':
      return 'Please choose a password of at least 6 characters.';
    default:
      return 'Something went wrong. Please try again.';
  }
};

const LoginPage: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | 'microsoft' | 'google' | 'email'>(null);
  const [mode, setMode] = useState<Mode>('signin');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handlePopup = async (provider: typeof microsoftProvider | typeof googleProvider, which: 'microsoft' | 'google') => {
    setLoading(which);
    setError(null);
    try {
      await signInWithPopup(auth, provider);
      // Auth state change is handled by App.tsx
    } catch (err: any) {
      console.error('Login Error:', err);
      setError(friendlyError(err?.code));
      setLoading(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading('email');
    setError(null);
    try {
      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      // Auth state change is handled by App.tsx
    } catch (err: any) {
      console.error('Email auth error:', err);
      setError(friendlyError(err?.code));
      setLoading(null);
    }
  };

  const busy = loading !== null;

  return (
    <div className="min-h-screen bg-[#faf7f2] dark:bg-[#1c1a17] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-black/[0.06] dark:border-white/[0.08] overflow-hidden animate-in fade-in zoom-in-95 duration-300">

        {/* Login Body */}
        <div className="p-8 space-y-5">
          <div className="text-center space-y-1">
            <img src="/logo.png" alt="Teacher Planner" className="mx-auto mb-5 h-16 w-16" />
            <h1 className="font-serif text-2xl text-slate-900 dark:text-white">Teacher Planner</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {mode === 'register' ? 'Set up your own planner in minutes.' : 'Plan lessons, meetings and projects — your way.'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 p-3 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2.5">
            <button
              onClick={() => handlePopup(microsoftProvider, 'microsoft')}
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 bg-[#2F2F2F] hover:bg-[#1a1a1a] text-white py-2.5 px-4 rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
              <span className="font-medium">{loading === 'microsoft' ? 'Signing in…' : 'Continue with Microsoft'}</span>
            </button>

            <button
              onClick={() => handlePopup(googleProvider, 'google')}
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 border border-black/[0.08] dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white dark:border-white/[0.1] py-2.5 px-4 rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
              <span className="font-medium">{loading === 'google' ? 'Signing in…' : 'Continue with Google'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
            <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">or</span>
            <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === 'register' && (
              <div className="relative">
                <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-sage-500"
                />
              </div>
            )}
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                autoComplete="email"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-sage-500"
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-sage-500"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-sage-600 hover:bg-sage-700 text-white py-2.5 px-4 rounded-xl font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading === 'email' && <Loader2 size={16} className="animate-spin" />}
              {mode === 'register' ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="text-sm text-center text-slate-500 dark:text-slate-400">
            {mode === 'register' ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setMode(mode === 'register' ? 'signin' : 'register'); setError(null); }}
              className="text-sage-700 dark:text-sage-300 font-medium hover:underline"
            >
              {mode === 'register' ? 'Sign in' : 'Create one'}
            </button>
          </p>

          <p className="text-xs text-center text-slate-400 dark:text-slate-600">
            Secure authentication powered by Firebase
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
