import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Upload, Camera, Loader2, User as UserIcon } from 'lucide-react';
import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';

const AddMember = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    bloodGroup: 'Unknown',
    emergencyContact: '',
    imageUrl: ''
  });
  const [generatedId, setGeneratedId] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Auto-generate a dummy member ID when the component mounts
  useEffect(() => {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    setGeneratedId(`MAG-${randomNum}`);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${generatedId}-${Math.random()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('member-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('member-photos')
        .getPublicUrl(filePath);

      setFormData({ ...formData, imageUrl: publicUrl });
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    const { error } = await supabase.from('members').insert([{
      member_id_string: generatedId,
      first_name: formData.firstName,
      last_name: formData.lastName,
      phone: formData.phone,
      email: formData.email,
      blood_group: formData.bloodGroup,
      emergency_contact: formData.emergencyContact,
      image_url: formData.imageUrl
    }]);

    setIsSaving(false);

    if (error) {
      alert("Failed to save: " + error.message);
    } else {
      // Success!
      navigate('/members');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/members')} className="p-2 bg-surface rounded-lg hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-textSecondary" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-white">Register New Member</h1>
          <p className="text-textSecondary mt-1">Fill out the details below to enroll a new member.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Container */}
        <div className="col-span-2 card">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-textSecondary mb-1">First Name *</label>
                <input required type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="input-field" placeholder="John" />
              </div>
              <div>
                <label className="block text-sm text-textSecondary mb-1">Last Name *</label>
                <input required type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="input-field" placeholder="Doe" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-textSecondary mb-1">Phone Number *</label>
                <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} className="input-field" placeholder="+1 234 567 890" />
              </div>
              <div>
                <label className="block text-sm text-textSecondary mb-1">Email Address</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="input-field" placeholder="john@example.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-textSecondary mb-1">Blood Group</label>
                <select name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} className="input-field">
                  <option value="Unknown">Unknown</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-textSecondary mb-1">Emergency Contact</label>
                <input type="text" name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} className="input-field" placeholder="Jane Doe (Wife) - +1 987 654 321" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center pt-4">
              <div className="space-y-2">
                <label className="block text-sm text-textSecondary mb-2 font-bold uppercase tracking-widest text-[10px]">Profile Photo</label>
                <div 
                  onClick={() => fileInputRef.current.click()}
                  className="w-full h-40 border-2 border-dashed border-gray-800 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-neon/50 hover:bg-neon/5 transition-all cursor-pointer group relative overflow-hidden"
                >
                   {formData.imageUrl ? (
                     <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                   ) : (
                     <>
                        <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center text-gray-700 group-hover:text-neon transition-colors">
                           <Camera className="w-6 h-6" />
                        </div>
                        <p className="text-[10px] text-textSecondary font-black uppercase tracking-widest">Click to Upload Photo</p>
                     </>
                   )}

                   {isUploading && (
                     <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 text-neon animate-spin" />
                        <span className="text-[8px] font-black text-neon uppercase">Uploading...</span>
                     </div>
                   )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handlePhotoUpload} 
                />
              </div>
              <div className="p-6 bg-gray-900/50 rounded-2xl border border-gray-800 border-dashed">
                 <p className="text-textSecondary text-xs leading-relaxed">
                   <span className="text-neon font-bold">Pro Tip:</span> Capturing a member photo at registration helps staff identify members quickly at the front desk. Files should be under 5MB.
                 </p>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-800 flex justify-end">
              <button type="submit" disabled={isSaving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                <Save className="w-5 h-5" />
                {isSaving ? 'Saving...' : 'Save Member'}
              </button>
            </div>
          </form>
        </div>

        {/* Dynamic QR Code Panel */}
        <div className="col-span-1 border-l border-gray-800 pl-6 flex flex-col items-center">
          <div className="bg-white p-6 rounded-xl shadow-[0_0_15px_rgba(204,255,0,0.1)] mb-4">
             <QRCodeSVG value={generatedId} size={180} fgColor="#0a0a0a" />
          </div>
          <h3 className="text-xl font-mono text-neon font-bold tracking-widest">{generatedId}</h3>
          <p className="text-sm text-center text-textSecondary mt-4">
            This dynamic QR Code is generated instantly. The member can take a physical photo of this screen, or it can be printed onto an ID card.
          </p>
        </div>

      </div>
    </div>
  );
};

export default AddMember;
