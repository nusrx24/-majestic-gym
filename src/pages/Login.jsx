import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { gymSettings } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-textPrimary font-sans">
      <div className="w-full max-w-md card p-8">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="w-48 h-48 mb-4 flex items-center justify-center transition-transform hover:scale-110 duration-500 relative">
            {gymSettings.logo_url && !logoError ? (
              <img 
                src={gymSettings.logo_url} 
                alt={gymSettings.gym_name} 
                className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(204,255,0,0.2)]" 
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" onError={(e) => e.target.style.display = 'none'} />
                
                {/* Fallback MG Circle if no image exists anywhere */}
                <div className="w-24 h-24 bg-neon rounded-3xl flex items-center justify-center text-background shadow-[0_0_40px_rgba(204,255,0,0.3)] absolute inset-auto -z-10 opacity-20">
                   <span className="font-extrabold text-3xl tracking-tighter">MG</span>
                </div>
              </div>
            )}
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">{gymSettings.gym_name}</h1>
          <p className="text-textSecondary text-[10px] font-black uppercase tracking-[0.4em] mt-3 opacity-60">Staff Access Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm text-textSecondary mb-2 font-medium">Email Address</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field w-full bg-black/50" 
              placeholder="admin@majesticgym.com" 
            />
          </div>
          
          <div>
            <label className="block text-sm text-textSecondary mb-2 font-medium">Password</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field w-full bg-black/50" 
              placeholder="••••••••" 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary w-full mt-2 disabled:opacity-50 flex justify-center items-center py-3 text-lg"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
