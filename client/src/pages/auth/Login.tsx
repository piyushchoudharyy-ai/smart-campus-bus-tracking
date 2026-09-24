import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bus, Shield, Navigation, GraduationCap, Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login, quickLoginAs } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
      // Route based on role
      const storedUser = JSON.parse(localStorage.getItem('campus_bus_user') || '{}');
      if (storedUser.role === 'admin') navigate('/admin');
      else if (storedUser.role === 'driver') navigate('/driver');
      else navigate('/student');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async (role: 'admin' | 'driver' | 'student') => {
    setError(null);
    setIsLoading(true);
    try {
      await quickLoginAs(role);
      if (role === 'admin') navigate('/admin');
      else if (role === 'driver') navigate('/driver');
      else navigate('/student');
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-gradient-to-b from-sky-50 via-slate-50 to-indigo-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-sky-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-sky-500/30">
            <Bus className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Smart Campus Transit</h1>
          <p className="text-xs text-slate-500 mt-1">Hardware-free, real-time college bus tracking</p>
        </div>

        {/* Demo Persona Quick-Login Pills */}
        <div className="mb-6 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center mb-2.5">
            ⚡ Quick Demo Evaluation
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('admin')}
              className="flex flex-col items-center p-2 rounded-xl bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 transition shadow-xs"
            >
              <Shield className="w-4 h-4 mb-1 text-purple-600" />
              <span className="text-[11px] font-bold">Admin</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('driver')}
              className="flex flex-col items-center p-2 rounded-xl bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 transition shadow-xs"
            >
              <Navigation className="w-4 h-4 mb-1 text-amber-600" />
              <span className="text-[11px] font-bold">Driver</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('student')}
              className="flex flex-col items-center p-2 rounded-xl bg-white border border-sky-200 text-sky-700 hover:bg-sky-50 transition shadow-xs"
            >
              <GraduationCap className="w-4 h-4 mb-1 text-sky-600" />
              <span className="text-[11px] font-bold">Student</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Campus Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@campus.edu"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-sky-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-sky-600 hover:text-sky-700">
              Create student/driver account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
