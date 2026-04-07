import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for hash changes if using implicit flow, but standard onAuthStateChange is usually enough.
    // If the user lands here, they must be authenticated (via the reset link).
    // We can verify this:
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        // Give it a moment to see if the hash is parsed
        setTimeout(async () => {
           const { data: delayedData } = await supabase.auth.getSession();
           if (!delayedData.session) {
              setError("Invalid or expired password reset link.");
           }
        }, 1000);
      }
    };
    checkSession();
  }, []);

  const handleReset = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Password successfully updated! Redirecting to login...");
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-textPrimary font-sans">
      <div className="w-full max-w-md card p-8">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="w-24 h-24 bg-neon rounded-3xl flex items-center justify-center text-background shadow-[0_0_40px_rgba(204,255,0,0.3)] mb-4">
             <span className="font-extrabold text-3xl tracking-tighter">MG</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase italic">Reset Password</h1>
          <p className="text-textSecondary text-[10px] font-black uppercase tracking-[0.4em] mt-3 opacity-60">Secure Recovery</p>
        </div>

        <form onSubmit={handleReset} className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-3 rounded-lg text-sm text-center">
              {message}
            </div>
          )}
          
          <div>
            <label className="block text-sm text-textSecondary mb-2 font-medium">New Password</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field w-full bg-black/50" 
              placeholder="••••••••" 
            />
          </div>
          
          <div>
            <label className="block text-sm text-textSecondary mb-2 font-medium">Confirm New Password</label>
            <input 
              type="password" 
              required 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field w-full bg-black/50" 
              placeholder="••••••••" 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || !!message}
            className="btn-primary w-full mt-2 disabled:opacity-50 flex justify-center items-center py-3 text-lg"
          >
            {loading ? 'Updating...' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
