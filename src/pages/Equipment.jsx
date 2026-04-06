import React, { useState, useEffect } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Filter, CheckCircle, AlertTriangle, XCircle, Trash2, RefreshCw, Upload, Image as ImageIcon, Play, Square, Clock, User as UserIcon, QrCode, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import ScanMemberModal from '../components/ScanMemberModal';

const Equipment = () => {
  const { profile } = useAuth();
  const [equipment, setEquipment] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [now, setNow] = useState(new Date());

  const handleDownloadQR = () => {
    const svg = document.getElementById('machine-qr-code');
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
      link.download = `QR-${selectedMachine.name.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const [formData, setFormData] = useState({
    name: '',
    status: 'good',
    notes: '',
    is_billable: false,
    per_minute_rate: 10,
    image_url: null
  });

  const fetchEquipment = async () => {
    setLoading(true);
    const { data: equipData } = await supabase
      .from('equipment')
      .select('*')
      .order('created_at', { ascending: false });
    
    const { data: sessions } = await supabase
      .from('equipment_usage')
      .select('*, members(first_name, last_name, member_id_string)')
      .is('end_time', null);

    if (equipData) setEquipment(equipData);
    if (sessions) setActiveSessions(sessions);
    setLoading(false);
  };

  useEffect(() => {
    fetchEquipment();
    const interval = setInterval(() => setNow(new Date()), 10000); // Update timers every 10s
    return () => clearInterval(interval);
  }, []);

  const handleStartUsage = async (member) => {
    try {
      const { data, error } = await supabase
        .from('equipment_usage')
        .insert([{
          equipment_id: selectedMachine.id,
          member_id: member.id,
          start_time: new Date().toISOString(),
          payment_status: 'pending'
        }])
        .select('*, members(first_name, last_name, member_id_string)')
        .single();

      if (error) throw error;
      setActiveSessions([...activeSessions, data]);
      setShowScanModal(false);
      alert(`Session started for ${member.first_name} on ${selectedMachine.name}`);
    } catch (err) {
      alert("Error starting session: " + err.message);
    }
  };

  const handleStopUsage = async (session) => {
    const startTime = new Date(session.start_time);
    const endTime = new Date();
    const durationMinutes = Math.max(1, Math.ceil((endTime - startTime) / (1000 * 60)));
    const equip = equipment.find(e => e.id === session.equipment_id);
    const rate = equip?.per_minute_rate || 10;
    const totalCharge = durationMinutes * rate;

    if (!window.confirm(`Stop session for ${session.members?.first_name}? \nDuration: ${durationMinutes} mins \nTotal Charge: Rs. ${totalCharge}`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('equipment_usage')
        .update({ 
          end_time: endTime.toISOString(),
          total_charge: totalCharge
        })
        .eq('id', session.id);

      if (error) throw error;

      setActiveSessions(activeSessions.filter(s => s.id !== session.id));
      alert(`Session ended. Rs. ${totalCharge} added to billing.`);
    } catch (err) {
      alert("Error stopping session: " + err.message);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setImageUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `equip_${Date.now()}.${fileExt}`;
      const filePath = `equipment/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('member-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('member-photos')
        .getPublicUrl(filePath);

      setFormData({ ...formData, image_url: publicUrl });
    } catch (err) {
      alert("Image upload failed: " + err.message);
    } finally {
      setImageUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('equipment')
        .insert([formData]);

      if (error) throw error;

      setShowAddModal(false);
      setFormData({ name: '', status: 'good', notes: '', is_billable: false, per_minute_rate: 10, image_url: null });
      fetchEquipment();
    } catch (err) {
      alert("Error adding equipment: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    const { error } = await supabase
      .from('equipment')
      .update({ status: newStatus, last_maintenance: new Date() })
      .eq('id', id);
    
    if (!error) {
      setEquipment(equipment.map(e => e.id === id ? { ...e, status: newStatus } : e));
    }
  };

  const deleteEquipment = async (id) => {
    if (window.confirm("Remove this equipment from inventory?")) {
      const { error } = await supabase.from('equipment').delete().eq('id', id);
      if (!error) setEquipment(equipment.filter(e => e.id !== id));
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'good': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'needs_repair': return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      case 'broken': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return null;
    }
  };

  const filteredEquipment = equipment.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6 pb-20 text-white">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">Equipment Inventory</h1>
          <p className="text-textSecondary mt-1 text-sm tracking-tight font-medium uppercase opacity-60">Track gym assets, health status, and maintenance.</p>
        </div>
        {profile?.role === 'owner' && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2 px-6 py-3 shadow-[0_0_20px_rgba(204,255,0,0.2)]"
          >
            <Plus className="w-5 h-5" />
            <span>Add Asset</span>
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-surface p-4 rounded-2xl border border-gray-800">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search machine..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Filter className="text-gray-400 w-5 h-5 hidden sm:block" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field bg-transparent"
          >
            <option value="all">All Status</option>
            <option value="good">Operational</option>
            <option value="needs_repair">Warning</option>
            <option value="broken">Out of Order</option>
          </select>
          <button onClick={fetchEquipment} className="p-2 bg-gray-800 rounded-xl hover:text-neon transition-colors">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && equipment.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 text-textSecondary">
          <RefreshCw className="w-10 h-10 animate-spin mb-4 text-neon" />
          <p className="font-black uppercase tracking-widest text-[10px]">Scanning Inventory...</p>
        </div>
      ) : filteredEquipment.length === 0 ? (
        <div className="card p-20 text-center border-gray-800">
          <ImageIcon className="w-16 h-16 text-gray-800 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white uppercase italic">No Assets Found</h3>
          <p className="text-textSecondary mt-2">Adjust your search or register a new machine.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEquipment.map((item) => (
            <div key={item.id} className="card group overflow-hidden border-gray-800 hover:border-neon/30 transition-all flex flex-col">
              <div className="relative h-48 bg-gray-900 flex items-center justify-center overflow-hidden">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <ImageIcon className="w-12 h-12 text-gray-800" />
                )}
                <div className={`absolute top-4 right-4 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border ${
                  item.status === 'good' ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 
                  item.status === 'needs_repair' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                  'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {getStatusIcon(item.status)}
                  {item.status.replace('_', ' ')}
                </div>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-black text-white uppercase italic tracking-tight">{item.name}</h3>
                  {item.is_billable && (
                    <span className="px-2 py-0.5 bg-neon text-black text-[10px] font-black uppercase rounded shadow-[0_0_10px_rgba(204,255,0,0.3)]">Rs. {item.per_minute_rate}/min</span>
                  )}
                </div>
                
                {/* Usage Billing Console */}
                {item.is_billable && (
                  <div className="mt-4 mb-6">
                    {activeSessions.filter(s => s.equipment_id === item.id).length > 0 ? (
                      activeSessions.filter(s => s.equipment_id === item.id).map(session => {
                        const elapsedMins = Math.ceil((now - new Date(session.start_time)) / (1000 * 60));
                        return (
                          <div key={session.id} className="p-4 bg-neon/5 border border-neon/30 rounded-2xl flex items-center justify-between animate-pulse-subtle">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-neon/10 flex items-center justify-center text-neon border border-neon/20 shadow-inner">
                                <UserIcon className="w-5 h-5 shadow-[0_0_8px_rgba(204,255,0,0.5)]" />
                              </div>
                              <div>
                                <p className="text-white text-sm font-black uppercase italic tracking-tight leading-none">{session.members?.first_name}</p>
                                <div className="flex items-center gap-3 text-[10px] text-neon/80 font-black uppercase mt-1">
                                  <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {elapsedMins}m</div>
                                  <div className="w-1 h-1 bg-neon/40 rounded-full"></div>
                                  <div>Rs. {elapsedMins * item.per_minute_rate}</div>
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleStopUsage(session); }}
                              className="w-10 h-10 bg-red-500/20 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center shadow-lg hover:rotate-12"
                              title="Stop Session"
                            >
                              <Square className="w-4 h-4 fill-current" />
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <button 
                        disabled={item.status !== 'good'}
                        onClick={() => { setSelectedMachine(item); setShowScanModal(true); }}
                        className={`w-full py-4 flex items-center justify-center gap-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          item.status === 'good' ? 'bg-neon text-black shadow-[0_0_15px_rgba(204,255,0,0.2)] hover:scale-[1.02] active:scale-95' : 'bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed opacity-50'
                        }`}
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Authorize Usage
                      </button>
                    )}
                  </div>
                )}

                {!item.is_billable && item.notes && (
                   <p className="text-textSecondary text-xs leading-relaxed line-clamp-3 mb-6 bg-gray-900/40 p-4 rounded-xl border border-gray-800 opacity-80 italic">
                      " {item.notes} "
                   </p>
                )}
                
                <div className="mt-auto pt-6 border-t border-gray-800 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setSelectedMachine(item); setShowQRModal(true); }}
                      className="p-2.5 bg-gray-800 text-gray-500 hover:text-neon border border-transparent hover:border-neon/30 rounded-xl transition-all"
                      title="Get QR Label"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => updateStatus(item.id, 'good')} 
                      className={`p-2.5 rounded-xl transition-all ${item.status === 'good' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-800 text-gray-500 hover:text-green-400 border border-transparent'}`}
                      title="Operational"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => updateStatus(item.id, 'needs_repair')} 
                      className={`p-2.5 rounded-xl transition-all ${item.status === 'needs_repair' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-gray-800 text-gray-500 hover:text-orange-400 border border-transparent'}`}
                      title="Needs Repair"
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => updateStatus(item.id, 'broken')} 
                      className={`p-2.5 rounded-xl transition-all ${item.status === 'broken' ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-gray-800 text-gray-500 hover:text-red-400 border border-transparent'}`}
                      title="Broken"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                  {profile?.role === 'owner' && (
                    <button onClick={() => deleteEquipment(item.id)} className="p-2.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Equipment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-surface border border-gray-800 w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Add New Asset</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-white transition-colors"><XCircle className="w-8 h-8" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="flex items-center gap-8">
                <div className="w-32 h-32 rounded-3xl bg-gray-900 border-2 border-dashed border-gray-700 flex items-center justify-center overflow-hidden relative shadow-inner">
                  {formData.image_url ? (
                    <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-gray-700" />
                  )}
                  {imageUploading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><RefreshCw className="w-6 h-6 text-neon animate-spin" /></div>}
                </div>
                <label className="flex-1">
                  <div className="btn-secondary cursor-pointer flex items-center justify-center gap-3 py-4 font-black uppercase text-xs tracking-widest border-gray-700 bg-gray-900 hover:border-neon hover:text-neon">
                    <Upload className="w-4 h-4" />
                    <span>Upload Asset Photo</span>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-textSecondary mb-2 block tracking-widest">Machine Identity</label>
                <input required type="text" placeholder="e.g. Treadmill PRO #01" className="input-field py-4" 
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer p-5 bg-gray-900/50 rounded-2xl border border-gray-800 hover:border-neon/30 transition-all">
                  <input type="checkbox" checked={formData.is_billable} onChange={e => setFormData({...formData, is_billable: e.target.checked})} className="w-5 h-5 accent-neon rounded-lg" />
                  <span className="text-sm font-black text-white uppercase tracking-tight">Enable Usage Billing (Treadmill Mode)</span>
                </label>
                
                {formData.is_billable && (
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] uppercase font-black text-textSecondary mb-2 block tracking-widest">Billing Rate (Rs. per minute)</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neon font-black text-sm">Rs.</div>
                      <input type="number" className="input-field pl-12 py-4" value={formData.per_minute_rate} onChange={e => setFormData({...formData, per_minute_rate: e.target.value})} />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-textSecondary mb-2 block tracking-widest">Maintenance History / Notes</label>
                <textarea rows="3" className="input-field p-4" placeholder="Any specific issues or instructions..." 
                  value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>

              <button disabled={loading || imageUploading} className="btn-primary w-full py-5 uppercase font-black tracking-[0.2em] shadow-[0_0_30px_rgba(204,255,0,0.2)] hover:shadow-neon/40 transition-all text-sm">
                {loading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : 'Register Gym Asset'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Usage Scanning Portal */}
      <ScanMemberModal 
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        onMemberScanned={handleStartUsage}
        title={`Scan for ${selectedMachine?.name}`}
      />

      {/* Machine QR Modal */}
      {showQRModal && selectedMachine && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[70] flex items-center justify-center p-4">
          <div className="bg-surface border border-gray-800 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
              <div className="flex items-center gap-3">
                <QrCode className="w-6 h-6 text-neon" />
                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Machine Digital ID</h3>
              </div>
              <button onClick={() => setShowQRModal(false)} className="text-gray-500 hover:text-white transition-colors"><XCircle className="w-8 h-8" /></button>
            </div>
            
            <div className="p-10 flex flex-col items-center text-center">
              <div className="bg-white p-6 rounded-[2rem] mb-8 shadow-[0_0_50px_rgba(204,255,0,0.1)]">
                <QRCodeSVG
                  id="machine-qr-code"
                  value={`EQUIP_SCAN:${selectedMachine.id}`}
                  size={240}
                  level="H"
                  includeMargin={false}
                />
              </div>
              
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">{selectedMachine.name}</h2>
              <p className="text-textSecondary text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-8">Scan to Start/Stop Session</p>
              
              <div className="w-full flex flex-col gap-3">
                <button 
                  onClick={handleDownloadQR}
                  className="btn-primary w-full py-5 flex items-center justify-center gap-3 shadow-[0_0_25px_rgba(204,255,0,0.2)]"
                >
                  <Download className="w-5 h-5" />
                  <span className="font-black uppercase tracking-widest text-xs">Download Print Label</span>
                </button>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed px-4">
                  Print this QR and stick it to the machine. Members will scan it using the Kiosk to identify the equipment.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Equipment;
