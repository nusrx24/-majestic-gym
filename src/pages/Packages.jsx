import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Plus, Edit2, Trash2, X, Save } from 'lucide-react';

const Packages = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration_days: ''
  });

  const fetchPackages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .order('price', { ascending: true });
    
    if (!error && data) {
      setPackages(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleOpenModal = (pkg = null) => {
    if (pkg) {
      setFormData({
        name: pkg.name,
        description: pkg.description || '',
        price: pkg.price.toString(),
        duration_days: pkg.duration_days.toString()
      });
      setCurrentId(pkg.id);
      setIsEditing(true);
    } else {
      setFormData({
        name: '',
        description: '',
        price: '',
        duration_days: ''
      });
      setCurrentId(null);
      setIsEditing(false);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      duration_days: parseInt(formData.duration_days)
    };

    let error;
    if (isEditing) {
      const { error: err } = await supabase
        .from('packages')
        .update(payload)
        .eq('id', currentId);
      error = err;
    } else {
      const { error: err } = await supabase
        .from('packages')
        .insert([payload]);
      error = err;
    }

    if (error) {
      alert("Error saving package: " + error.message);
    } else {
      setIsModalOpen(false);
      fetchPackages();
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this package? This may affect members with this plan.")) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);
    
    if (error) {
      alert("Error deleting package: " + error.message);
    } else {
      fetchPackages();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Membership Packages</h1>
          <p className="text-textSecondary mt-1">Design and manage tiered membership options.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Package
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading && packages.length === 0 ? (
          <div className="col-span-3 py-12 flex justify-center">
            <div className="w-8 h-8 border-2 border-neon border-t-transparent flex rounded-full animate-spin"></div>
          </div>
        ) : (
          packages.map((pkg) => (
            <div key={pkg.id} className="card hover:border-neon/50 transition-all group relative border-gray-800">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center text-neon group-hover:bg-neon/10 transition-colors">
                  <Package className="w-6 h-6" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleOpenModal(pkg)}
                    className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(pkg.id)}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-white tracking-tight">{pkg.name}</h3>
              <p className="text-textSecondary text-sm h-10 mt-2 line-clamp-2">{pkg.description}</p>
              
              <div className="mt-8 pt-6 border-t border-gray-800 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-neon tracking-tighter">Rs. {pkg.price}</span>
                <span className="text-textSecondary text-sm font-medium">/ {pkg.duration_days} days</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl border border-gray-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
              <h2 className="text-xl font-bold text-white">
                {isEditing ? 'Edit Package' : 'Create New Package'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-textSecondary uppercase tracking-wider">Package Name</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Premium Monthly"
                  className="input-field"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-textSecondary uppercase tracking-wider">Description</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="What's included?"
                  className="input-field min-h-[80px]"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-textSecondary uppercase tracking-wider">Price (LKR)</label>
                  <input 
                    required
                    type="number" 
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    placeholder="2500"
                    className="input-field"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-textSecondary uppercase tracking-wider">Duration (Days)</label>
                  <input 
                    required
                    type="number" 
                    value={formData.duration_days}
                    onChange={(e) => setFormData({...formData, duration_days: e.target.value})}
                    placeholder="30"
                    className="input-field"
                  />
                </div>
              </div>
              
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-700 text-textSecondary font-bold hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 btn-primary py-3 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {isEditing ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Packages;
