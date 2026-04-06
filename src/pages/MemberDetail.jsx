import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft, 
  Download, 
  User as UserIcon, 
  Phone, 
  Mail, 
  Heart, 
  Calendar, 
  Package, 
  Edit2, 
  Check, 
  X, 
  ShieldAlert,
  Camera,
  Upload,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Activity,
  Scale,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  AreaChart,
  Area
} from 'recharts';

const MemberDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const qrRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [member, setMember] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [usageSessions, setUsageSessions] = useState([]);
  const [progressLogs, setProgressLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Edit & Upload State
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  // Progress Logging State
  const [isLogging, setIsLogging] = useState(false);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [logData, setLogData] = useState({
    weight: '',
    body_fat_percentage: '',
    notes: ''
  });

  const fetchData = async () => {
    setLoading(true);

    const { data: memberData } = await supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .single();

    if (memberData) {
      setMember(memberData);
      setEditData(memberData);

      const { data: subData } = await supabase
        .from('member_subscriptions')
        .select('*, packages(name, duration_days)')
        .eq('member_id', id)
        .order('created_at', { ascending: false });

      setSubscriptions(subData || []);

      const { data: usageData } = await supabase
        .from('equipment_usage')
        .select('*, equipment(name)')
        .eq('member_id', id)
        .not('end_time', 'is', null)
        .order('end_time', { ascending: false });

      setUsageSessions(usageData || []);

      const { data: logData } = await supabase
        .from('member_progress_logs')
        .select('*')
        .eq('member_id', id)
        .order('log_date', { ascending: true });

      setProgressLogs(logData || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleUpdate = async () => {
    if (!editData.first_name || !editData.last_name) {
      setError("First and Last name are required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    
    const { error: updateError } = await supabase
      .from('members')
      .update({
        first_name: editData.first_name,
        last_name: editData.last_name,
        phone: editData.phone,
        email: editData.email,
        blood_group: editData.blood_group,
        emergency_contact: editData.emergency_contact,
        height: editData.height,
        starting_weight: editData.starting_weight,
        target_weight: editData.target_weight,
        goal_type: editData.goal_type,
        special_needs: editData.special_needs
      })
      .eq('id', id);

    if (updateError) {
      setError(updateError.message);
      setIsSaving(false);
    } else {
      setMember({...member, ...editData});
      setIsEditing(false);
      setIsSaving(false);
    }
  };

  const calculateBMI = (weight, height) => {
    if (!weight || !height) return null;
    const heightInMeters = height / 100;
    return (weight / (heightInMeters * heightInMeters)).toFixed(1);
  };

  const handleLogProgress = async (e) => {
    e.preventDefault();
    if (!logData.weight) return;

    setIsSavingLog(true);
    const bmi = calculateBMI(logData.weight, member.height);

    const { data: newLog, error: logError } = await supabase
      .from('member_progress_logs')
      .insert([{
        member_id: id,
        weight: parseFloat(logData.weight),
        body_fat_percentage: logData.body_fat_percentage ? parseFloat(logData.body_fat_percentage) : null,
        bmi: bmi ? parseFloat(bmi) : null,
        notes: logData.notes,
        log_date: new Date().toISOString()
      }])
      .select()
      .single();

    if (logError) {
      alert("Error saving log: " + logError.message);
    } else {
      setProgressLogs([...progressLogs, newLog]);
      setIsLogging(false);
      setLogData({ weight: '', body_fat_percentage: '', notes: '' });
    }
    setIsSavingLog(false);
  };

  const getGoalStatus = () => {
    if (!member || progressLogs.length === 0) return null;
    
    const latestLog = progressLogs[progressLogs.length - 1];
    const prevLog = progressLogs.length > 1 ? progressLogs[progressLogs.length - 2] : { weight: member.starting_weight };
    const goal = member.goal_type;
    
    let isOffTrack = false;
    let message = "On Track";
    let color = "text-neon bg-neon/10 border-neon/20";

    if (goal === 'lose') {
      if (latestLog.weight > prevLog.weight) {
        isOffTrack = true;
        message = "Off Track - Gaining weight";
      } else if (latestLog.weight > member.target_weight) {
        message = `On Track - ${latestLog.weight - member.target_weight}kg to go`;
      } else {
        message = "Goal Reached!";
      }
    } else if (goal === 'gain') {
      if (latestLog.weight < prevLog.weight) {
        isOffTrack = true;
        message = "Off Track - Losing weight";
      } else if (latestLog.weight < member.target_weight) {
        message = `On Track - ${member.target_weight - latestLog.weight}kg to log`;
      } else {
        message = "Goal Reached!";
      }
    }

    if (isOffTrack) {
      color = "text-red-400 bg-red-500/10 border-red-500/20";
    }

    return { message, color, isOffTrack };
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}-${Math.random()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('member-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('member-photos')
        .getPublicUrl(filePath);

      // 3. Update Member Record
      const { error: updateError } = await supabase
        .from('members')
        .update({ image_url: publicUrl })
        .eq('id', id);

      if (updateError) throw updateError;

      setMember({ ...member, image_url: publicUrl });
    } catch (err) {
      setError(err.message || "Failed to upload photo. Ensure 'member-photos' bucket exists.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 50, 50, 300, 300);
      const link = document.createElement('a');
      link.download = `QR-${member.member_id_string}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleSettleUsage = async (sessionId) => {
    try {
      const { error } = await supabase
        .from('equipment_usage')
        .update({ 
          payment_status: 'paid',
          payment_method: 'cash'
        })
        .eq('id', sessionId);

      if (error) throw error;

      setUsageSessions(usageSessions.map(s => 
        s.id === sessionId ? { ...s, payment_status: 'paid', payment_method: 'cash' } : s
      ));
      
      alert("Payment settled successfully!");
    } catch (err) {
      console.error("Error settling payment:", err);
      alert("Error settling payment: " + err.message);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-10 h-10 border-4 border-neon border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!member) return (
    <div className="card text-center p-20 border-red-500/20">
      <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <p className="text-white text-lg font-bold">Member Not Found</p>
      <button onClick={() => navigate('/members')} className="btn-primary mt-6">Return to Directory</button>
    </div>
  );

  const today = new Date().toISOString().split('T')[0];
  const activeSub = subscriptions.find(s => s.payment_status === 'paid' && s.end_date >= today);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <button onClick={() => navigate('/members')} className="flex items-center gap-2 text-textSecondary hover:text-white transition-colors group">
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Back to Members
        </button>
        
        {isEditing ? (
          <div className="flex gap-3">
             <button 
               onClick={() => { setIsEditing(false); setEditData(member); setError(null); }}
               className="px-4 py-2 bg-gray-800 text-textSecondary hover:text-white rounded-lg transition-colors border border-gray-700 flex items-center gap-2 text-sm font-bold"
             >
               <X className="w-4 h-4" /> Cancel
             </button>
             <button 
               onClick={handleUpdate}
               disabled={isSaving}
               className="btn-primary px-6 flex items-center gap-2 disabled:opacity-50"
             >
               <Check className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Changes'}
             </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-neon/10 text-neon border border-neon/30 hover:bg-neon hover:text-black rounded-lg transition-all flex items-center gap-2 text-sm font-bold"
          >
            <Edit2 className="w-4 h-4" /> Edit Profile
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl text-sm flex items-center gap-3 animate-shake">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* QR Code Panel */}
        <div className="card flex flex-col items-center text-center p-8 bg-gradient-to-b from-gray-900 to-black border-gray-800">
          <h2 className="text-xs font-bold text-textSecondary uppercase tracking-[0.2em] mb-8 self-start">Member QR Status</h2>

          <div ref={qrRef} className="bg-white p-5 rounded-2xl mb-6 shadow-[0_0_50px_rgba(255,255,255,0.05)] ring-1 ring-white/10 group cursor-zoom-in">
            <QRCodeSVG
              value={member.member_id_string}
              size={220}
              bgColor="#ffffff"
              fgColor="#000000"
              level="H"
              className="group-hover:scale-105 transition-transform duration-500"
            />
          </div>

          <p className="text-neon font-mono font-bold text-2xl mb-1 tracking-tighter">{member.member_id_string}</p>
          <p className="text-textSecondary text-xs uppercase tracking-widest mb-8">Gym Official ID</p>

          <button
            onClick={handleDownloadQR}
            className="w-full h-12 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold transition-all flex items-center justify-center gap-2 border border-gray-700 shadow-lg"
          >
            <Download className="w-4 h-4" />
            Download Digital ID
          </button>

          {activeSub ? (
            <div className="mt-6 w-full bg-neon/10 border border-neon/20 rounded-2xl p-5 text-left relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-20 h-20 bg-neon/5 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-neon/10 transition-all" />
               <p className="text-neon font-black uppercase tracking-widest text-[10px]">Active Membership</p>
               <h3 className="text-white font-bold text-lg mt-1">{activeSub.packages?.name}</h3>
               <div className="flex items-center gap-2 mt-3 text-textSecondary text-xs font-medium">
                  <Calendar className="w-3.5 h-3.5 text-neon" />
                  Expires on {format(new Date(activeSub.end_date), 'MMMM dd, yyyy')}
               </div>
            </div>
          ) : (
            <div className="mt-6 w-full bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-left border-dashed">
              <p className="text-red-400 font-black uppercase tracking-widest text-[10px]">Membership Inactive</p>
              <p className="text-textSecondary text-sm mt-1">Assign a package to activate door access and track attendance history.</p>
            </div>
          )}
        </div>

        {/* Member Info */}
        <div className="card lg:col-span-2 p-0 overflow-hidden border-gray-800">
          <div className="p-8 border-b border-gray-800 bg-gray-900/30 flex items-center gap-6">
             {/* Profile Photo Section - Redesigned for Clarity */}
             <div className="relative group">
               <div className="w-28 h-28 rounded-3xl bg-gray-900 border-2 border-gray-800 overflow-hidden flex flex-col items-center justify-center text-textSecondary shadow-2xl relative group-hover:border-neon/30 transition-all">
                  {member.image_url ? (
                    <img src={member.image_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <UserIcon className="w-8 h-8 opacity-20 mb-1" />
                      <span className="text-[8px] font-black uppercase tracking-widest opacity-40">No Photo</span>
                    </>
                  )}
                  
                  {isUploading && (
                    <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center gap-2">
                       <Loader2 className="w-6 h-6 text-neon animate-spin" />
                       <span className="text-[8px] font-black text-neon uppercase animate-pulse">Uploading...</span>
                    </div>
                  )}

                  {/* Upload Overlay - Prominent Action */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <button 
                      onClick={() => fileInputRef.current.click()}
                      disabled={isUploading}
                      className="flex flex-col items-center justify-center gap-1 hover:text-neon transition-colors"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-[8px] font-black text-white uppercase tracking-widest">Update</span>
                    </button>
                    
                    {member.image_url && (
                      <button 
                        onClick={async () => {
                           if (window.confirm("Remove profile photo?")) {
                             setIsUploading(true);
                             const { error } = await supabase.from('members').update({ image_url: null }).eq('id', id);
                             if (!error) setMember({ ...member, image_url: null });
                             setIsUploading(false);
                           }
                        }}
                        className="text-red-400 hover:text-red-500 transition-colors mt-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
               </div>
               
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 className="hidden" 
                 accept="image/*" 
                 onChange={handlePhotoUpload} 
               />
             </div>

             <div>
                <h1 className="text-3xl font-black text-white tracking-tighter leading-none">
                  {isEditing ? (
                    <div className="flex gap-2">
                       <input 
                         type="text" 
                         value={editData.first_name} 
                         onChange={(e) => setEditData({...editData, first_name: e.target.value})}
                         className="bg-gray-800 border-none rounded p-1 w-32 focus:ring-1 focus:ring-neon"
                       />
                       <input 
                         type="text" 
                         value={editData.last_name} 
                         onChange={(e) => setEditData({...editData, last_name: e.target.value})}
                         className="bg-gray-800 border-none rounded p-1 w-32 focus:ring-1 focus:ring-neon"
                       />
                    </div>
                  ) : `${member.first_name} ${member.last_name}`}
                </h1>
                <p className="text-textSecondary text-xs font-bold uppercase tracking-widest mt-3 flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-neon" />
                   Member Since {format(new Date(member.created_at), 'yyyy')}
                </p>
             </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              <EditableInfoRow 
                icon={<Phone className="w-4 h-4" />} 
                label="Primary Phone" 
                value={member.phone || 'No phone recorded'} 
                isEditing={isEditing}
                inputValue={editData.phone}
                onChange={(v) => setEditData({...editData, phone: v})}
              />
              <EditableInfoRow 
                icon={<Mail className="w-4 h-4" />} 
                label="Email Address" 
                value={member.email || 'No email recorded'} 
                isEditing={isEditing}
                inputValue={editData.email}
                onChange={(v) => setEditData({...editData, email: v})}
              />
              <EditableInfoRow 
                icon={<Heart className="w-4 h-4" />} 
                label="Blood Group" 
                value={member.blood_group || 'Not specified'} 
                isEditing={isEditing}
                inputValue={editData.blood_group}
                onChange={(v) => setEditData({...editData, blood_group: v})}
              />
              <EditableInfoRow 
                icon={<Phone className="w-4 h-4 text-red-400" />} 
                label="Emergency Contact" 
                value={member.emergency_contact || 'No emergency info'} 
                isEditing={isEditing}
                inputValue={editData.emergency_contact}
                onChange={(v) => setEditData({...editData, emergency_contact: v})}
              />
            </div>

            {/* NEW: Health Essentials Section */}
            <div className="pt-8 border-t border-gray-800">
              <h3 className="text-white font-black text-sm uppercase tracking-widest mb-6 flex items-center gap-3">
                <Activity className="w-5 h-5 text-neon" /> Health Essentials
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <EditableInfoRow 
                  icon={<Scale className="w-4 h-4" />} 
                  label="Height (cm)" 
                  value={member.height ? `${member.height} cm` : 'Not set'} 
                  isEditing={isEditing}
                  type="number"
                  inputValue={editData.height}
                  onChange={(v) => setEditData({...editData, height: v})}
                />
                <EditableInfoRow 
                  icon={<Scale className="w-4 h-4" />} 
                  label="Starting Weight (kg)" 
                  value={member.starting_weight ? `${member.starting_weight} kg` : 'Not set'} 
                  isEditing={isEditing}
                  type="number"
                  inputValue={editData.starting_weight}
                  onChange={(v) => setEditData({...editData, starting_weight: v})}
                />
                <EditableInfoRow 
                  icon={<TrendingUp className="w-4 h-4 text-neon" />} 
                  label="Target Weight (kg)" 
                  value={member.target_weight ? `${member.target_weight} kg` : 'Not set'} 
                  isEditing={isEditing}
                  type="number"
                  inputValue={editData.target_weight}
                  onChange={(v) => setEditData({...editData, target_weight: v})}
                />
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-textSecondary uppercase font-black tracking-widest mb-2">Primary Fitness Goal</p>
                  {isEditing ? (
                    <select 
                      value={editData.goal_type} 
                      onChange={(e) => setEditData({...editData, goal_type: e.target.value})}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white font-bold text-sm focus:ring-1 focus:ring-neon"
                    >
                      <option value="maintain">Maintain Weight</option>
                      <option value="lose">Lose Weight</option>
                      <option value="gain">Gain Muscle / Weight</option>
                    </select>
                  ) : (
                    <span className="px-3 py-1 bg-neon/10 text-neon border border-neon/20 rounded-full text-[10px] font-black uppercase w-fit">
                      {member.goal_type === 'lose' ? 'Lose Weight' : member.goal_type === 'gain' ? 'Gain Weight' : 'Maintain'}
                    </span>
                  )}
                </div>
                <div className="md:col-span-2">
                  <EditableInfoRow 
                    icon={<FileText className="w-4 h-4" />} 
                    label="Special Medical Needs / Notes" 
                    value={member.special_needs || 'None reported'} 
                    isEditing={isEditing}
                    inputValue={editData.special_needs}
                    onChange={(v) => setEditData({...editData, special_needs: v})}
                  />
                </div>
              </div>
            </div>

            {/* NEW: Progress Tracker Section */}
            <div className="pt-8 border-t border-gray-800">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                  <div>
                    <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-3">
                      <Activity className="w-5 h-5 text-neon" /> Body Progress Tracking
                    </h3>
                    <p className="text-textSecondary text-[10px] uppercase font-bold tracking-widest mt-1 opacity-60">Visualizing goals & measurements</p>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    {getGoalStatus() && (
                      <div className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest flex items-center gap-2 ${getGoalStatus().color}`}>
                        {getGoalStatus().isOffTrack ? <ShieldAlert className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        {getGoalStatus().message}
                      </div>
                    )}
                    <button 
                      onClick={() => setIsLogging(true)}
                      className="px-4 py-2 bg-neon text-black rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-[0_0_20px_rgba(204,255,0,0.2)] ml-auto md:ml-0"
                    >
                      Log measurements
                    </button>
                  </div>
               </div>

               {isLogging && (
                 <div className="mb-8 p-6 bg-gray-900/50 border border-neon/20 rounded-2xl animate-in slide-in-from-top duration-300">
                    <form onSubmit={handleLogProgress} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                       <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-textSecondary block mb-2">Weight (kg)</label>
                          <input 
                            required
                            type="number" 
                            step="0.1"
                            value={logData.weight}
                            onChange={(e) => setLogData({...logData, weight: e.target.value})}
                            className="w-full bg-black border border-gray-800 rounded-lg p-2 text-white font-bold"
                            placeholder="75.5"
                          />
                       </div>
                       <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-textSecondary block mb-2">Body Fat % (Opt)</label>
                          <input 
                            type="number" 
                            step="0.1"
                            value={logData.body_fat_percentage}
                            onChange={(e) => setLogData({...logData, body_fat_percentage: e.target.value})}
                            className="w-full bg-black border border-gray-800 rounded-lg p-2 text-white font-bold"
                            placeholder="15.0"
                          />
                       </div>
                       <div className="md:col-span-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-textSecondary block mb-2">Notes</label>
                          <input 
                            type="text" 
                            value={logData.notes}
                            onChange={(e) => setLogData({...logData, notes: e.target.value})}
                            className="w-full bg-black border border-gray-800 rounded-lg p-2 text-white font-bold"
                            placeholder="Post-workout morning weight"
                          />
                       </div>
                       <div className="md:col-span-4 flex justify-end gap-3 pt-2">
                          <button 
                            type="button"
                            onClick={() => setIsLogging(false)}
                            className="px-4 py-2 text-textSecondary text-[10px] font-black uppercase hover:text-white"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit"
                            disabled={isSavingLog}
                            className="btn-primary py-2 px-6 text-xs"
                          >
                            {isSavingLog ? 'Saving...' : 'Save Log Entry'}
                          </button>
                       </div>
                    </form>
                 </div>
               )}

               {progressLogs.length > 0 ? (
                 <div className="space-y-8">
                    {/* Weight Chart */}
                    <div className="h-64 w-full bg-black/40 rounded-2xl p-4 border border-gray-800">
                       <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={[
                            { log_date: member.created_at, weight: member.starting_weight },
                            ...progressLogs
                          ]}>
                             <defs>
                                <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                                   <stop offset="5%" stopColor="#ccff00" stopOpacity={0.3}/>
                                   <stop offset="95%" stopColor="#ccff00" stopOpacity={0}/>
                                </linearGradient>
                             </defs>
                             <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                             <XAxis 
                               dataKey="log_date" 
                               tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                               stroke="#555"
                               fontSize={10}
                               tickMargin={10}
                             />
                             <YAxis 
                               domain={['dataMin - 2', 'dataMax + 2']} 
                               stroke="#555"
                               fontSize={10}
                             />
                             <Tooltip 
                               contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '12px' }}
                               labelFormatter={(date) => format(new Date(date), 'MMMM dd, yyyy')}
                               itemStyle={{ color: '#ccff00', fontSize: '12px', fontWeight: 'bold' }}
                             />
                             {member.target_weight && (
                               <ReferenceLine 
                                 y={member.target_weight} 
                                 stroke="#444" 
                                 strokeDasharray="5 5" 
                                 label={{ value: 'TARGET', fill: '#666', fontSize: 10, position: 'right' }} 
                               />
                             )}
                             <Area 
                               type="monotone" 
                               dataKey="weight" 
                               stroke="#ccff00" 
                               strokeWidth={3}
                               fillOpacity={1} 
                               fill="url(#colorWeight)" 
                               animationDuration={2000}
                             />
                          </AreaChart>
                       </ResponsiveContainer>
                    </div>

                    {/* Log History List */}
                    <div className="overflow-x-auto">
                       <table className="w-full text-left">
                          <thead>
                             <tr className="border-b border-gray-800">
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-textSecondary">Date</th>
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-textSecondary">Weight</th>
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-textSecondary">BMI</th>
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-textSecondary">Body Fat</th>
                                <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-textSecondary">Trend</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800/50">
                             {/* Show Starting Weight as first record */}
                             <tr className="group hover:bg-white/5 transition-colors">
                                <td className="py-4 text-xs font-bold text-textSecondary">Initial</td>
                                <td className="py-4 text-sm font-black text-white">{member.starting_weight} kg</td>
                                <td className="py-4 text-xs font-bold text-textSecondary">{calculateBMI(member.starting_weight, member.height) || '--'}</td>
                                <td className="py-4 text-xs font-bold text-textSecondary">--</td>
                                <td className="py-4 text-xs font-bold text-neon uppercase">Starting Point</td>
                             </tr>
                             {progressLogs.slice().reverse().map((log, idx, arr) => {
                                const prevWeight = idx < arr.length - 1 ? arr[idx + 1].weight : member.starting_weight;
                                const diff = (log.weight - prevWeight).toFixed(1);
                                return (
                                  <tr key={log.id} className="group hover:bg-white/5 transition-colors">
                                     <td className="py-4 text-xs font-bold text-white">{format(new Date(log.log_date), 'MMM dd, yyyy')}</td>
                                     <td className="py-4 text-sm font-black text-white">{log.weight} kg</td>
                                     <td className="py-4 text-xs font-bold text-neon">{log.bmi || '--'}</td>
                                     <td className="py-4 text-xs font-bold text-white">{log.body_fat_percentage ? `${log.body_fat_percentage}%` : '--'}</td>
                                     <td className="py-4">
                                        {diff === "0.0" ? (
                                          <span className="text-[10px] font-bold text-textSecondary uppercase">No Change</span>
                                        ) : diff > 0 ? (
                                          <span className="text-[10px] font-bold text-red-400 uppercase flex items-center gap-1">
                                             <TrendingUp className="w-3 h-3" /> +{diff}kg
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-bold text-neon uppercase flex items-center gap-1">
                                             <TrendingDown className="w-3 h-3" /> {diff}kg
                                          </span>
                                        )}
                                     </td>
                                  </tr>
                                );
                             })}
                          </tbody>
                       </table>
                    </div>
                 </div>
               ) : (
                 <div className="bg-gray-900/30 p-12 rounded-2xl border border-gray-800 border-dashed text-center">
                    <Activity className="w-10 h-10 text-gray-700 mx-auto mb-4 opacity-20" />
                    <p className="text-textSecondary text-xs uppercase font-black tracking-widest opacity-40">No progress logs recorded yet</p>
                    <p className="text-textSecondary text-[10px] mt-2 opacity-30">Click "Log Measurements" to start tracking BMI and weight trends.</p>
                 </div>
               )}
            </div>

            {/* Subscription History */}
            <div className="pt-8 border-t border-gray-800">
              <h3 className="text-white font-black text-sm uppercase tracking-widest mb-6 flex items-center gap-3">
                <Package className="w-5 h-5 text-neon" /> Subscription History
              </h3>
              
              {subscriptions.length === 0 ? (
                <div className="bg-gray-900 p-10 rounded-2xl border border-gray-800 text-center">
                   <p className="text-textSecondary text-sm italic">No payment or subscription history exists for this member.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {subscriptions.map(sub => (
                    <div key={sub.id} className="group flex justify-between items-center p-4 bg-gray-900 hover:bg-gray-800/80 rounded-2xl border border-gray-800 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-neon border border-gray-700">
                           <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-white font-black tracking-tight">{sub.packages?.name}</p>
                          <p className="text-textSecondary text-xs">{format(new Date(sub.start_date), 'MMM dd')} → {format(new Date(sub.end_date), 'MMM dd, yyyy')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          sub.payment_status === 'paid' && sub.end_date >= today
                            ? 'bg-neon/10 text-neon border border-neon/20'
                            : 'bg-gray-800 text-textSecondary border border-gray-700'
                        } border`}>
                          {sub.payment_status === 'paid' && sub.end_date >= today ? 'ACTIVE' : 'EXPIRED'}
                        </span>
                        <p className="text-textSecondary text-[10px] font-bold mt-2 uppercase tracking-widest opacity-60">
                           Paid via {sub.payment_method?.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Usage Billing History */}
            <div className="pt-8 border-t border-gray-800">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                 <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-3">
                    <Clock className="w-5 h-5 text-neon" /> Equipment Usage (Treadmill Billing)
                 </h3>
                 {usageSessions.filter(s => s.payment_status !== 'paid').length > 0 && (
                    <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in duration-500">
                       <TrendingDown className="w-4 h-4 text-red-400" />
                       <div className="flex flex-col">
                          <span className="text-[9px] font-black text-red-400 uppercase tracking-widest leading-none">Unpaid Balance</span>
                          <span className="text-white font-black text-sm tracking-tighter mt-1">
                             Rs. {usageSessions.filter(s => s.payment_status !== 'paid').reduce((acc, s) => acc + s.total_charge, 0)}
                          </span>
                       </div>
                    </div>
                 )}
              </div>
              
              {usageSessions.length === 0 ? (
                <div className="bg-gray-900/30 p-10 rounded-2xl border border-gray-800 border-dashed text-center">
                   <p className="text-textSecondary text-xs uppercase font-bold tracking-widest opacity-40 italic">No usage records found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {usageSessions.map(session => (
                    <div key={session.id} className={`p-4 border rounded-2xl flex items-center justify-between transition-all group ${
                      session.payment_status === 'paid' ? 'bg-gray-900 border-gray-800' : 'bg-red-500/5 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.05)]'
                    }`}>
                       <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner transition-all ${
                            session.payment_status === 'paid' ? 'bg-neon/10 text-neon border-neon/20 group-hover:bg-neon/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                             <Clock className="w-5 h-5" />
                          </div>
                          <div>
                             <p className="text-white font-black tracking-tight text-sm uppercase">{session.equipment?.name || 'Treadmill'}</p>
                             <div className="flex items-center gap-2 mt-1">
                                <span className="text-textSecondary text-[10px] font-bold uppercase tracking-widest opacity-60">
                                   {format(new Date(session.end_time), 'MMM dd')}
                                </span>
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                  session.payment_status === 'paid' ? 'bg-neon/10 text-neon border-neon/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                   {session.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                                </span>
                             </div>
                          </div>
                       </div>
                       <div className="text-right flex flex-col items-end gap-2">
                          <div>
                             <p className="text-white font-black text-sm leading-none">Rs. {session.total_charge}</p>
                             <p className="text-textSecondary text-[10px] font-bold uppercase tracking-widest opacity-60 leading-none mt-1">
                                {Math.ceil((new Date(session.end_time) - new Date(session.start_time)) / (1000 * 60))} mins
                             </p>
                          </div>
                          
                          {session.payment_status !== 'paid' && (
                             <button 
                               onClick={() => handleSettleUsage(session.id)}
                               className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-neon hover:text-black transition-all shadow-lg"
                             >
                               Mark Paid
                             </button>
                          )}
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Clock = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

const EditableInfoRow = ({ icon, label, value, isEditing, inputValue, onChange }) => (
  <div className="flex items-start gap-4 group">
    <div className={`mt-0.5 p-2 rounded-lg bg-gray-900 border border-gray-800 transition-colors ${isEditing ? 'border-neon/30 text-neon' : 'text-gray-500'}`}>
       {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] text-textSecondary uppercase font-black tracking-widest">{label}</p>
      {isEditing ? (
        <input 
          type="text" 
          value={inputValue || ''} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 mt-1 text-white font-bold text-sm focus:ring-1 focus:ring-neon transition-all"
        />
      ) : (
        <p className="text-white font-extrabold mt-1 truncate">{value}</p>
      )}
    </div>
  </div>
);

export default MemberDetail;
