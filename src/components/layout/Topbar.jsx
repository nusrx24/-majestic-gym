import React, { useState, useEffect, useRef } from 'react';
import { Bell, User, Calendar, ArrowRight, X, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';

const Topbar = () => {
  const { profile, gymSettings, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const [logoError, setLogoError] = useState(false);

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const fetchNotifications = async () => {
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const { data } = await supabase
      .from('member_subscriptions')
      .select('id, end_date, members(id, first_name, last_name), packages(name)')
      .eq('payment_status', 'paid')
      .gt('end_date', today.toISOString().split('T')[0])
      .lte('end_date', sevenDaysFromNow.toISOString().split('T')[0])
      .order('end_date', { ascending: true });

    if (data) setNotifications(data);
  };

  useEffect(() => {
    fetchNotifications();
    
    // Close dropdown on outside click
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-surface border-b border-gray-800 flex items-center justify-between px-6 sticky top-0 z-40 w-full">
      <div className="flex-1 flex items-center gap-4">
        {gymSettings.logo_url && !logoError ? (
          <img 
            src={gymSettings.logo_url} 
            alt={gymSettings.gym_name} 
            className="h-10 w-auto cursor-pointer object-contain hover:scale-105 transition-transform" 
            onClick={() => navigate('/')}
            onError={() => setLogoError(true)}
          />
        ) : (
          <div className="flex items-center gap-3" onClick={() => navigate('/')}>
             <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain cursor-pointer" onError={(e) => e.target.style.display = 'none'} />
             <p className="text-white text-sm font-black uppercase tracking-tighter cursor-pointer hover:text-neon transition-colors">
               {gymSettings.gym_name} 
             </p>
          </div>
        )}
        <div className="h-6 w-[1px] bg-gray-800 mx-2 hidden md:block" />
        <p className="text-textSecondary text-[10px] font-bold uppercase tracking-widest opacity-60 hidden md:block">Admin Command Center</p>
      </div>

      <div className="flex items-center gap-6">
        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`relative p-2 rounded-xl transition-all ${isOpen ? 'bg-neon text-black' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-surface ${isOpen ? 'bg-black' : 'bg-neon animate-pulse'}`} />
            )}
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-gray-900 border border-gray-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Alerts ({notifications.length})</h3>
                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              
              <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-800/50">
                {notifications.length > 0 ? notifications.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => { navigate(`/members/${n.members.id}`); setIsOpen(false); }}
                    className="p-4 hover:bg-gray-800/40 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neon/10 flex items-center justify-center text-neon border border-neon/20">
                         <Calendar className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-bold truncate group-hover:text-neon transition-colors">
                          {n.members.first_name} {n.members.last_name}
                        </p>
                        <p className="text-[10px] text-textSecondary uppercase font-black tracking-widest">
                           Ends {format(new Date(n.end_date), 'MMM dd')}
                        </p>
                      </div>
                      <ArrowRight className="w-3 h-3 text-gray-700 group-hover:text-neon group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                )) : (
                  <div className="p-10 text-center">
                    <p className="text-textSecondary text-xs">All members have active plans. Check back tomorrow!</p>
                  </div>
                )}
              </div>
              
              {notifications.length > 0 && (
                <button 
                  onClick={() => { navigate('/'); setIsOpen(false); }}
                  className="w-full py-3 bg-gray-800/30 hover:bg-gray-800 text-[10px] text-neon font-black uppercase tracking-[0.2em] transition-colors"
                >
                  View All in Dashboard
                </button>
              )}
            </div>
          )}
        </div>

        <div onClick={logout} className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 cursor-pointer transition-all border border-transparent hover:border-red-500/20" title="Sign Out">
           <LogOut className="w-5 h-5" />
        </div>

        <div className="flex items-center gap-4 border-l border-gray-800 pl-6 cursor-pointer group">
          <div className="w-10 h-10 rounded-2xl bg-gray-800 flex items-center justify-center text-textSecondary group-hover:text-neon transition-all border border-gray-700 group-hover:border-neon/30 overflow-hidden shadow-inner font-black">
             {getInitials(profile?.full_name)}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-black text-white leading-none tracking-tight uppercase">
              {profile?.full_name || 'Anonymous Staff'}
            </p>
            <p className="text-[10px] text-neon font-black uppercase tracking-widest mt-1 opacity-80">
              {profile?.role || 'Guest'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
