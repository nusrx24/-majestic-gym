import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Package, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  TrendingUp,
  Filter,
  ArrowUpDown,
  RefreshCw
} from 'lucide-react';

const Inventory = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Supplement',
    price: '',
    cost_price: '',
    stock_level: 0,
    min_stock_alert: 5
  });

  const categories = ['Supplement', 'Drink', 'Gear', 'Snack', 'Other'];

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name', { ascending: true });

    if (data) setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, image_url: publicUrl }));
    } catch (err) {
      console.error("Upload Error:", err);
      alert("Error: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const payload = {
      name: formData.name,
      category: formData.category,
      price: parseFloat(formData.price),
      stock_level: parseInt(formData.stock_level),
      min_stock_alert: parseInt(formData.min_stock_alert),
      image_url: formData.image_url || null
    };

    if (editingItem) {
      const { error } = await supabase
        .from('inventory_items')
        .update(payload)
        .eq('id', editingItem.id);
      
      if (!error) {
        setItems(items.map(item => item.id === editingItem.id ? { ...item, ...payload } : item));
        setEditingItem(null);
      } else {
        alert("Update failed: " + error.message);
      }
    } else {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert([payload])
        .select()
        .single();
      
      if (data) {
        setItems([...items, data]);
        setIsAdding(false);
      } else {
        alert("Insert failed: " + error.message);
      }
    }
    resetForm();
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this product from inventory?')) {
      const { error } = await supabase.from('inventory_items').delete().eq('id', id);
      if (!error) setItems(items.filter(item => item.id !== id));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Supplement',
      price: '',
      cost_price: '',
      stock_level: 0,
      min_stock_alert: 5
    });
    setIsAdding(false);
    setEditingItem(null);
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockItems = items.filter(item => item.stock_level <= item.min_stock_alert);

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">Inventory Management</h1>
          <p className="text-textSecondary text-sm font-bold uppercase tracking-widest mt-1 opacity-60">Manage your product catalog and stock levels</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="btn-primary px-6 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Add New Product
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 border-gray-800 bg-gradient-to-br from-gray-900 to-black">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-neon/10 flex items-center justify-center text-neon border border-neon/20">
                <Package className="w-6 h-6" />
             </div>
             <div>
                <p className="text-textSecondary text-[10px] font-black uppercase tracking-widest leading-none">Total SKUs</p>
                <p className="text-white text-2xl font-black mt-2 leading-none">{items.length}</p>
             </div>
          </div>
        </div>
        
        <div className="card p-6 border-gray-800 bg-gradient-to-br from-gray-900 to-black">
          <div className="flex items-center gap-4">
             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${lowStockItems.length > 0 ? 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)] animate-pulse' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                <AlertTriangle className="w-6 h-6" />
             </div>
             <div>
                <p className="text-textSecondary text-[10px] font-black uppercase tracking-widest leading-none">Low Stock Alerts</p>
                <p className={`text-2xl font-black mt-2 leading-none ${lowStockItems.length > 0 ? 'text-red-400' : 'text-white'}`}>{lowStockItems.length}</p>
             </div>
          </div>
          {lowStockItems.length > 0 && <p className="text-[10px] text-red-400/60 font-bold uppercase mt-2">Restock suggested immediately</p>}
        </div>

        <div className="card p-6 border-gray-800 bg-gradient-to-br from-gray-900 to-black">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-neon/10 flex items-center justify-center text-neon border border-neon/20">
                <TrendingUp className="w-6 h-6" />
             </div>
             <div>
                <p className="text-textSecondary text-[10px] font-black uppercase tracking-widest leading-none">Estimated Value</p>
                <p className="text-white text-2xl font-black mt-2 leading-none">
                  Rs. {items.reduce((acc, item) => acc + (item.price * item.stock_level), 0).toLocaleString()}
                </p>
             </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="card p-0 border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-800 bg-gray-900/30 flex flex-col md:flex-row gap-4 items-center">
           <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search products, categories..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/50 border border-gray-800 rounded-xl pl-12 pr-4 py-3 text-sm focus:ring-1 focus:ring-neon transition-all"
              />
           </div>
           <button onClick={fetchItems} className="p-3 bg-gray-800 rounded-xl border border-gray-700 hover:bg-gray-700 transition-colors">
              <RefreshCw className={`w-4 h-4 text-textSecondary ${loading ? 'animate-spin text-neon' : ''}`} />
           </button>
        </div>

        <div className="overflow-x-auto">
           <table className="w-full text-left">
              <thead>
                 <tr className="bg-gray-900/10 border-b border-gray-800">
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-textSecondary">Product Details</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-textSecondary">Category</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-textSecondary text-right">Price</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-textSecondary text-center">Stock Level</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-textSecondary text-right">Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                 {filteredItems.map(item => (
                    <tr key={item.id} className="group hover:bg-white/5 transition-all">
                       <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-neon border border-gray-700 group-hover:scale-110 transition-transform">
                                <Package className="w-6 h-6" />
                             </div>
                             <div>
                                <p className="text-white font-black tracking-tight">{item.name}</p>
                                <p className="text-[10px] text-textSecondary font-black uppercase tracking-widest mt-1 opacity-60">ID: {item.id.slice(0, 8)}</p>
                             </div>
                          </div>
                       </td>
                       <td className="px-8 py-6">
                          <span className="px-3 py-1 bg-gray-800 text-textSecondary text-[10px] font-black uppercase tracking-widest border border-gray-700 rounded-lg">
                             {item.category}
                          </span>
                       </td>
                       <td className="px-8 py-6 text-right font-black text-white">
                          Rs. {item.price}
                       </td>
                       <td className="px-8 py-6 text-center">
                          <div className="flex flex-col items-center gap-2">
                             <span className={`text-lg font-black ${item.stock_level <= item.min_stock_alert ? 'text-red-400' : 'text-neon'}`}>
                               {item.stock_level}
                             </span>
                             <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-1000 ${
                                    item.stock_level <= item.min_stock_alert ? 'bg-red-500' : 'bg-neon shadow-[0_0_10px_#ccff00]'
                                  }`} 
                                  style={{ width: `${Math.min((item.stock_level / (item.min_stock_alert * 3)) * 100, 100)}%` }}
                                />
                             </div>
                          </div>
                       </td>
                       <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2">
                             <button 
                               onClick={() => { setEditingItem(item); setFormData(item); }}
                               className="p-2 bg-gray-800 text-gray-400 hover:text-neon border border-gray-700 rounded-lg transition-all"
                             >
                                <Edit2 className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={() => handleDelete(item.id)}
                               className="p-2 bg-gray-800 text-gray-400 hover:text-red-400 border border-gray-700 rounded-lg transition-all"
                             >
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {(isAdding || editingItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="card w-full max-w-lg p-8 border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-8">
                 {editingItem ? 'Modify Product' : 'Add New Product'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-textSecondary mb-2 block text-center">Product Image</label>
                        <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed border-gray-800 rounded-2xl bg-black/30 hover:border-neon transition-all group relative">
                           {formData.image_url ? (
                             <div className="relative w-32 h-32">
                                <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover rounded-xl border border-gray-700" />
                                <button 
                                  type="button"
                                  onClick={() => setFormData({...formData, image_url: ''})}
                                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-lg"
                                >
                                   <X className="w-3 h-3" />
                                </button>
                             </div>
                           ) : (
                             <div className="flex flex-col items-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                <Plus className="w-8 h-8 text-neon" />
                                <p className="text-[9px] font-black uppercase tracking-widest">Select Product Photo</p>
                             </div>
                           )}
                           <input 
                             type="file" 
                             accept="image/*"
                             onChange={handleFileUpload}
                             className="absolute inset-0 opacity-0 cursor-pointer"
                           />
                           {uploading && (
                             <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-2xl">
                                <Loader2 className="w-6 h-6 text-neon animate-spin" />
                             </div>
                           )}
                        </div>
                     </div>
                    
                    <div className="md:col-span-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-textSecondary mb-2 block">Product Name</label>
                       <input 
                         required
                         type="text" 
                         value={formData.name}
                         onChange={(e) => setFormData({...formData, name: e.target.value})}
                         className="w-full bg-black border border-gray-800 rounded-xl p-3 text-white font-bold"
                         placeholder="e.g. Optimum Nutrition Whey"
                       />
                    </div>
                    
                    <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-textSecondary mb-2 block">Category</label>
                       <select 
                         value={formData.category}
                         onChange={(e) => setFormData({...formData, category: e.target.value})}
                         className="w-full bg-black border border-gray-800 rounded-xl p-3 text-white font-bold"
                       >
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>

                    <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-textSecondary mb-2 block">Price (Sale)</label>
                       <input 
                         required
                         type="number" 
                         step="0.01"
                         value={formData.price}
                         onChange={(e) => setFormData({...formData, price: e.target.value})}
                         className="w-full bg-black border border-gray-800 rounded-xl p-3 text-white font-bold"
                         placeholder="1500"
                       />
                    </div>

                    <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-textSecondary mb-2 block">Stock Level</label>
                       <input 
                         required
                         type="number" 
                         value={formData.stock_level}
                         onChange={(e) => setFormData({...formData, stock_level: e.target.value})}
                         className="w-full bg-black border border-gray-800 rounded-xl p-3 text-white font-bold text-neon"
                       />
                    </div>

                    <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-textSecondary mb-2 block">Alert Threshold</label>
                       <input 
                         required
                         type="number" 
                         value={formData.min_stock_alert}
                         onChange={(e) => setFormData({...formData, min_stock_alert: e.target.value})}
                         className="w-full bg-black border border-gray-800 rounded-xl p-3 text-white font-bold text-red-400"
                       />
                    </div>
                 </div>

                 <div className="flex gap-4 pt-4">
                    <button 
                      type="button" 
                      onClick={resetForm}
                      className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 btn-primary py-4"
                    >
                      {editingItem ? 'Update Database' : 'Finalize Addition'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
