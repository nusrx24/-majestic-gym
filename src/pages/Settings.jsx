import React, { useState, useEffect } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { User, Shield, Users, Mail, Check, X, RefreshCw, LogOut, Phone, Key, Trash2, UserMinus, UserCheck, Plus } from 'lucide-react';

const Settings = () => {
  const { profile, logout, gymSettings, setGymSettings } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  
  // Add Staff State
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'staff',
    password: ''
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLogoUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `gym_logo_${Date.now()}.${fileExt}`;
      const filePath = `system/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('member-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('member-photos')
        .getPublicUrl(filePath);

      // Update gym_settings table
      const { error: dbError } = await supabase
        .from('gym_settings')
        .update({ logo_url: publicUrl, updated_at: new Date() })
        .eq('gym_name', gymSettings.gym_name); // Use current name to target the single row

      if (dbError) throw dbError;

      setGymSettings({ ...gymSettings, logo_url: publicUrl });
      alert("Majestic GYM logo updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Logo upload failed: " + err.message);
    } finally {
      setLogoUploading(false);
    }
  };

  const fetchProfiles = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setProfiles(data);
    setLoading(false);
  };

  useEffect(() => {
    if (profile?.role === 'owner') {
      fetchProfiles();
    }
  }, [profile]);

  const handleAddStaff = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 0. Pre-Verification: Check if this email is already in your directory
      const { data: existing, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', formData.email.toLowerCase())
        .maybeSingle();

      if (existing) {
        throw new Error("This email is already registered in your staff directory.");
      }

      // 1. Create a "Ghost Client" using values from your main client
      const { createClient } = await import('@supabase/supabase-js');
      
      const tempSupabase = createClient(
        supabaseUrl,
        supabaseAnonKey,
        { auth: { persistSession: false } }
      );

      // 2. Register the user in Supabase Auth
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
            role: formData.role,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Could not create authentication record.");

      // 3. Force sync the profile immediately
      const { error: profileError } = await supabase.from('profiles').upsert([{
        id: authData.user.id,
        email: formData.email.toLowerCase(),
        full_name: formData.name,
        phone: formData.phone,
        role: formData.role,
        is_active: true
      }]);
      
      if (profileError) throw profileError;
      
      alert(`SUCCESS: ${formData.name} is now registered!\n\nACTION REQUIRED: STAFF MUST CHECK EMAIL to confirm their account before they can log in.\n\nPRO-TIP: Go to Supabase Dashboard > Auth > Settings and UNCHECK "Confirm Email" to allow staff to log in instantly without checking email.`);
      setShowAddForm(false);
      setFormData({ name: '', email: '', phone: '', role: 'staff', password: '' });
      fetchProfiles();
    } catch (err) {
      console.error("Staff Creation Error:", err);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (targetId, updates) => {
    setUpdatingId(targetId);
    const { error } = await supabase.from('profiles').update(updates).eq('id', targetId);
    if (!error) {
      setProfiles(profiles.map(p => p.id === targetId ? { ...p, ...updates } : p));
    }
    setUpdatingId(null);
  };

  const handleDelete = async (targetId) => {
    if (window.confirm("Permanently delete this staff record? This cannot be undone.")) {
      const { error } = await supabase.from('profiles').delete().eq('id', targetId);
      if (!error) setProfiles(profiles.filter(p => p.id !== targetId));
    }
  };

  if (profile?.role !== 'owner') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center text-white">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">Your Profile</h1>
          <button onClick={logout} className="btn-secondary bg-red-900/20 text-red-400 hover:bg-red-900/40 border-red-900/50 flex items-center gap-2">
             <LogOut className="w-4 h-4" />
             Log Out
          </button>
        </div>
        
        <div className="card max-w-lg mx-auto mt-10">
           <div className="flex flex-col items-center p-8">
              <div className="w-24 h-24 bg-gray-800 rounded-3xl flex items-center justify-center text-neon text-3xl font-black mb-6">
                 {profile?.full_name?.[0].toUpperCase()}
              </div>
              <h2 className="text-2xl font-bold uppercase">{profile?.full_name}</h2>
              <p className="text-neon text-xs font-black uppercase tracking-widest mt-2">{profile?.role}</p>
              <div className="w-full grid grid-cols-1 gap-4 mt-10">
                 <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                    <Mail className="w-4 h-4 text-textSecondary" />
                    <span className="text-sm font-medium">{profile?.email}</span>
                 </div>
                 <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                    <Phone className="w-4 h-4 text-textSecondary" />
                    <span className="text-sm font-medium">{profile?.phone || 'No phone set'}</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">System Command</h1>
          <p className="text-textSecondary mt-1">Manage physical staff access and branding.</p>
        </div>
        <button onClick={logout} className="btn-secondary bg-red-900/20 text-red-500 hover:bg-red-900 hover:text-white border-red-900/50 transition-all flex items-center gap-2">
           <LogOut className="w-4 h-4" />
           Log Out
        </button>
      </div>

      {/* Gym Branding Section */}
      <div className="card border-neon/40 bg-neon/5 mb-6">
         <div className="flex flex-col md:flex-row items-center gap-8 p-4">
            <div className="relative group">
               <div className="w-32 h-32 rounded-3xl bg-gray-800 border-2 border-dashed border-gray-700 flex items-center justify-center overflow-hidden transition-all group-hover:border-neon">
                  {gymSettings.logo_url ? (
                    <img src={gymSettings.logo_url} alt="Gym Logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <div className="text-center p-4">
                       <User className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                       <p className="text-[8px] text-gray-600 uppercase font-bold">No Logo</p>
                    </div>
                  )}
                  {logoUploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                       <RefreshCw className="w-6 h-6 text-neon animate-spin" />
                    </div>
                  )}
               </div>
               <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-neon rounded-2xl flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-lg ring-4 ring-background">
                  <Plus className="w-5 h-5 text-black" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={logoUploading} />
               </label>
            </div>
            <div className="flex-1 text-center md:text-left">
               <h3 className="text-xl font-black text-white uppercase tracking-tight">Gym Branding</h3>
               <p className="text-textSecondary text-sm mt-1 max-w-sm">Upload your official Majestic GYM logo. This will appear on all dashboards, reports, and member certificates.</p>
               <div className="flex items-center gap-2 mt-4 justify-center md:justify-start">
                  <span className="px-2 py-1 bg-neon text-black text-[10px] font-black uppercase tracking-widest rounded">Current Name: {gymSettings.gym_name}</span>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1 border-r border-gray-800 pr-6">
           <div className="card bg-gradient-to-br from-neon/10 via-transparent to-transparent border-neon/20">
              <div className="flex flex-col items-center text-center p-4">
                 <div className="w-20 h-20 bg-neon rounded-3xl flex items-center justify-center text-background font-black text-3xl shadow-[0_0_30px_rgba(204,255,0,0.3)] mb-6">
                    {profile.full_name?.[0].toUpperCase()}
                 </div>
                 <h2 className="text-xl font-black text-white uppercase tracking-tight">{profile.full_name}</h2>
                 <p className="px-3 py-1 bg-neon/10 text-neon text-[10px] font-black uppercase tracking-widest border border-neon/20 rounded-full mt-2">
                    System {profile.role}
                 </p>
                 <div className="w-full h-[1px] bg-gray-800 my-8" />
                 <div className="text-left w-full space-y-4">
                    <div className="flex items-center gap-3">
                       <Mail className="w-4 h-4 text-textSecondary" />
                       <span className="text-xs text-textSecondary font-medium truncate">{profile.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                       <Phone className="w-4 h-4 text-textSecondary" />
                       <span className="text-xs text-textSecondary font-medium">{profile.phone || 'No phone'}</span>
                    </div>
                 </div>
              </div>
           </div>

           {/* Add Staff Shortcut */}
           <button 
             onClick={() => {
               setFormData({ name: '', email: '', phone: '', role: 'staff', password: '' });
               setShowAddForm(!showAddForm);
             }}
             className={`w-full mt-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all border-2 flex items-center justify-center gap-3 ${
               showAddForm 
                 ? 'bg-gray-800 border-gray-700 text-white' 
                 : 'bg-neon/5 border-neon/30 text-neon hover:bg-neon hover:text-black'
             }`}
           >
              {showAddForm ? <X className="w-4 h-4" /> : <Users className="w-4 h-4" />}
              {showAddForm ? 'Cancel Form' : 'Add New Staff Member'}
           </button>
        </div>

        {/* Staff Hub */}
        <div className="lg:col-span-2 space-y-6">
           {showAddForm && (
             <div className="card border-neon/40 animate-in slide-in-from-top-4 duration-300" key={showAddForm ? 'visible' : 'hidden'}>
               <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">Create Staff Account</h3>
               <form onSubmit={handleAddStaff} className="grid grid-cols-2 gap-4" autoComplete="off">
                  <div className="col-span-2">
                    <label className="text-[10px] uppercase font-black text-textSecondary mb-1 block">Full Name</label>
                    <input required type="text" name="new_staff_fullname" id="reg-name" autoComplete="new-password" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-field" placeholder="John Trainer" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-black text-textSecondary mb-1 block">Email</label>
                    <input required type="email" name="new_staff_email" id="reg-email" autoComplete="new-password" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="input-field" placeholder="john@gym.com" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-black text-textSecondary mb-1 block">Phone</label>
                    <input type="tel" name="new_staff_phone" id="reg-phone" autoComplete="new-password" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="input-field" placeholder="0312-XXXXXXX" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-black text-textSecondary mb-1 block">Assign Role</label>
                    <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="input-field">
                       <option value="staff">Gym Staff</option>
                       <option value="owner">System Owner</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-black text-textSecondary mb-1 block">Temp Password</label>
                    <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="input-field" placeholder="••••••••" />
                  </div>
                  <div className="col-span-2 pt-4">
                    <button type="submit" className="btn-primary w-full py-4 uppercase tracking-[0.3em] font-black italic">
                       Authorize & Create Profile
                    </button>
                  </div>
               </form>
             </div>
           )}

          <div className="card p-0 overflow-hidden border-gray-800">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
               <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-neon" />
                  <h2 className="text-sm font-black text-white uppercase tracking-widest">Active Staff Directory</h2>
               </div>
               <button onClick={fetchProfiles} className="text-gray-500 hover:text-white transition-all">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
               </button>
            </div>
            
            <div className="divide-y divide-gray-800 max-h-[600px] overflow-y-auto">
              {profiles.map((p) => (
                <div key={p.id} className="p-6 hover:bg-gray-800/10 transition-all group">
                   <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                         <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${p.is_active ? 'bg-gray-800 text-white' : 'bg-red-900/20 text-red-500 opacity-50'}`}>
                            {p.full_name?.[0].toUpperCase() || '?'}
                         </div>
                         <div>
                            <div className="flex items-center gap-2">
                               <p className={`font-bold transition-all ${p.is_active ? 'text-white' : 'text-gray-600 line-through'}`}>{p.full_name}</p>
                               {p.role === 'owner' && <Shield className="w-3 h-3 text-neon" />}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                               <p className="text-[10px] text-textSecondary font-black uppercase tracking-widest">{p.role}</p>
                               <span className="text-gray-800">•</span>
                               <p className="text-[10px] text-textSecondary font-black uppercase tracking-widest">{p.email}</p>
                            </div>
                         </div>
                      </div>

                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         {/* Toggle Role */}
                         {p.id !== profile.id ? (
                           <button 
                             onClick={() => updateProfile(p.id, { role: p.role === 'owner' ? 'staff' : 'owner' })}
                             disabled={updatingId === p.id}
                             className="p-2 bg-gray-800 rounded-lg text-textSecondary hover:text-neon"
                             title="Swap Role"
                           >
                              <RefreshCw className="w-4 h-4" />
                           </button>
                         ) : (
                           <div className="p-2 text-neon/30 cursor-not-allowed" title="You cannot demote yourself">
                              <Shield className="w-4 h-4" />
                           </div>
                         )}
                         
                         {/* Toggle Status */}
                         {p.id !== profile.id ? (
                           <button 
                             onClick={() => updateProfile(p.id, { is_active: !p.is_active })}
                             disabled={updatingId === p.id}
                             className={`p-2 rounded-lg transition-colors ${p.is_active ? 'bg-orange-900/20 text-orange-400 hover:bg-orange-900' : 'bg-green-900/20 text-green-400 hover:bg-green-900'}`}
                             title={p.is_active ? "Disable Account" : "Enable Account"}
                           >
                              {p.is_active ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                           </button>
                         ) : (
                           <div className="p-2 text-neon/30 cursor-not-allowed" title="Your account is the Master Owner">
                              <Check className="w-4 h-4" />
                           </div>
                         )}

                         {/* Delete */}
                         {p.id !== profile.id && (
                           <button 
                             onClick={() => handleDelete(p.id)}
                             disabled={updatingId === p.id}
                             className="p-2 bg-red-900/20 text-red-500 rounded-lg hover:bg-red-900 hover:text-white"
                             title="Delete Permanently"
                           >
                              <Trash2 className="w-4 h-4" />
                           </button>
                         )}
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
