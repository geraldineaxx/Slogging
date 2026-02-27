
import React, { useState } from 'react';
import { AnimatedTitle } from './AnimatedTitle';
import { supabase } from '../lib/supabase';
import { Button } from './Button';

type AuthMode = 'login' | 'signup' | 'reset' | 'reset-sent';

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const clearError = () => setError('');

  const friendlyError = (msg: string) => {
    if (msg.toLowerCase().includes('email rate limit')) return 'Your email has been entered too many times. Please try again later.';
    return msg;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearError();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(friendlyError(error.message));
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    clearError();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(friendlyError(error.message));
    } else {
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setError('Check your email to confirm your account.');
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearError();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) setError(friendlyError(error.message));
    else setMode('reset-sent');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-10">
        <div className="text-center space-y-3">
          <AnimatedTitle
            text="SLOGGING"
            style={{ letterSpacing: '-1rem', fontWeight: 300, fontSize: '16rem', color: '#f5f5f5' }}
          />
          <p className="text-white/50 text-sm tracking-widest uppercase font-bold">Track your creative time</p>
        </div>

        {mode === 'reset-sent' ? (
          <div className="glass rounded-3xl p-8 border border-white/10 text-center space-y-4">
            <div className="text-4xl">✉️</div>
            <h2 className="text-lg font-medium text-white">Check your email</h2>
            <p className="text-white/60 text-sm">
              We sent a password reset link to <span className="text-white">{email}</span>.
            </p>
            <button
              onClick={() => { setMode('login'); setEmail(''); clearError(); }}
              className="text-white/50 hover:text-white text-xs uppercase tracking-widest font-bold transition-colors"
            >
              Back to login
            </button>
          </div>
        ) : mode === 'reset' ? (
          <div className="glass rounded-3xl p-8 border border-white/10 space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-medium text-white">Reset password</h2>
              <p className="text-white/50 text-sm">We'll send a reset link to your email.</p>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Email</label>
                <input
                  autoFocus
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/30"
                />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full justify-center">
                {loading ? 'Sending…' : 'Send Reset Link'}
              </Button>
              <button
                type="button"
                onClick={() => { setMode('login'); clearError(); }}
                className="w-full text-center text-white/50 hover:text-white text-xs uppercase tracking-widest font-bold transition-colors"
              >
                Back to login
              </button>
            </form>
          </div>
        ) : (
          <div className="glass rounded-3xl p-8 border border-white/10 space-y-6">
            <div className="flex gap-1 bg-white/5 rounded-full p-1">
              <button
                onClick={() => { setMode('login'); clearError(); }}
                className={`flex-1 py-2 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all ${mode === 'login' ? 'bg-white text-[#6461A0]' : 'text-white/50 hover:text-white'}`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setMode('signup'); clearError(); }}
                className={`flex-1 py-2 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all ${mode === 'signup' ? 'bg-white text-[#6461A0]' : 'text-white/50 hover:text-white'}`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={mode === 'login' ? handleLogin : handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Email</label>
                <input
                  autoFocus
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/30"
                />
              </div>
              {mode === 'signup' && (
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/30"
                  />
                </div>
              )}
              {error && <p className={`text-xs ${error.startsWith('Check') ? 'text-green-400' : 'text-red-400'}`}>{error}</p>}
              <Button type="submit" disabled={loading} className="w-full justify-center">
                {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => { setMode('reset'); clearError(); }}
                  className="w-full text-center text-white/50 hover:text-white text-xs uppercase tracking-widest font-bold transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
