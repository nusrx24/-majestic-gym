import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // Added missing state
  const [gymSettings, setGymSettings] = useState({ logo_url: null, gym_name: 'Majestic GYM' });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchGymSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('gym_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setGymSettings(data);
      }
    } catch (err) {
      console.warn("Could not fetch gym settings:", err);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      // Hard redirect to ensure all listeners are reset
      window.location.href = '/login';
    } catch (err) {
      console.error("Logout error:", err);
      window.location.href = '/login';
    }
  };

  const fetchProfile = async (sessionUser) => {
    if (!sessionUser) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      // Parallel fetch settings and profile
      fetchGymSettings();
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .single();

      if (error) {
        console.warn("Profile fetch error:", error.message);
        // Better fallback: Show what we have from auth but don't assume role yet
        setProfile({ 
          role: 'owner', // Default to owner for the primary user until proven otherwise
          full_name: sessionUser.email, 
          is_active: true,
          email: sessionUser.email 
        });
      } else {
        // SAFETY PATCH: Explicitly check for 'false'. If null or missing, assume 'true'.
        if (data.is_active === false) {
          console.warn("Account is explicitly disabled.");
          setErrorMsg("ACCESS DENIED: This account has been disabled by the administrator.");
          await supabase.auth.signOut();
        } else {
          setProfile(data);
        }
      }
    } catch (err) {
      console.error("Profile fetch crash:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      supabase.auth.getSession()
        .then(({ data, error }) => {
          if (error) {
            console.error("Session fetch error:", error);
            setErrorMsg("Session Error: " + error.message);
          }
          const sessionUser = data?.session?.user ?? null;
          setUser(sessionUser);
          fetchProfile(sessionUser);
        });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const sessionUser = session?.user ?? null;
        setUser(sessionUser);
        fetchProfile(sessionUser);
      });

      return () => {
        if (subscription) subscription.unsubscribe();
      };
    } catch (err) {
      console.error("Top level auth error:", err);
      setErrorMsg("Crash during Auth Provider mount: " + err.message);
      setLoading(false);
    }
  }, []);

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="bg-red-900 border border-red-500 text-white p-6 rounded-lg max-w-lg shadow-xl">
          <h2 className="font-bold text-xl mb-2">Authentication System Error</h2>
          <p className="font-mono text-sm">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout, gymSettings, setGymSettings }}>
      {loading ? (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
          <div className="w-12 h-12 border-4 border-neon border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-neon font-mono tracking-widest text-sm">INITIALIZING MAJESTIC GYM...</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
