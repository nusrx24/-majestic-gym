import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  X, 
  CreditCard, 
  Banknote, 
  User, 
  CheckCircle2, 
  ArrowRight,
  ShoppingCart,
  Filter,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

const Store = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Cart State
  const [cart, setCart] = useState([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  
  // Member Link State
  const [memberSearch, setMemberSearch] = useState('');
  const [foundMembers, setFoundMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isMemberSearching, setIsMemberSearching] = useState(false);

  const categories = ['All', 'Supplement', 'Drink', 'Gear', 'Snack', 'Other'];

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('inventory_items')
      .select('*')
      .gt('stock_level', 0)
      .order('name', { ascending: true });
    
    if (data) setProducts(data);
    setLoading(false);
  };

  const searchMembers = async (term) => {
    if (term.length < 2) {
      setFoundMembers([]);
      return;
    }
    setIsMemberSearching(true);
    const { data } = await supabase
      .from('members')
      .select('id, first_name, last_name, member_id_string')
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,member_id_string.ilike.%${term}%`)
      .limit(5);
    
    if (data) setFoundMembers(data);
    setIsMemberSearching(false);
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock_level) {
        alert("Cannot add more. Stock limit reached.");
        return;
      }
      setCart(cart.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const updateQuantity = (id, delta) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const product = products.find(p => p.id === id);
        const newQty = Math.max(1, item.quantity + delta);
        if (newQty > product.stock_level) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id) => setCart(cart.filter(item => item.id !== id));

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsCheckingOut(true);

    try {
      // 1. Create Sale Record
      const { data: sale, error: saleError } = await supabase
        .from('inventory_sales')
        .insert([{
          member_id: selectedMember?.id || null,
          total_amount: subtotal,
          payment_method: paymentMethod
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      // 2. Create Sale Items & Update Stock
      for (const item of cart) {
        // Add to sale_items
        await supabase.from('inventory_sale_items').insert([{
          sale_id: sale.id,
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price
        }]);

        // Decrement stock
        await supabase.rpc('decrement_stock', { 
          item_id: item.id, 
          qty: item.quantity 
        });
      }

      alert("Sale successful! Stock updated.");
      setCart([]);
      setSelectedMember(null);
      fetchProducts(); // Refresh products with new stock levels
    } catch (err) {
      console.error("Checkout Error:", err);
      alert("Error processing sale: " + err.message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const filteredProducts = products.filter(p => 
    (selectedCategory === 'All' || p.category === selectedCategory) &&
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      
      {/* Product Catalog - Left Side */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-6 space-y-4">
           <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-3xl font-black text-white tracking-tight uppercase italic flex items-center gap-3">
                 <ShoppingBag className="w-8 h-8 text-neon" /> Supplement Store 
              </h1>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                 {categories.map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
                        selectedCategory === cat ? 'bg-neon text-black border-neon' : 'bg-gray-900 text-textSecondary border-gray-800 hover:text-white'
                      }`}
                    >
                       {cat}
                    </button>
                 ))}
              </div>
           </div>
           
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search products..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface border border-gray-800 rounded-2xl pl-12 pr-4 py-4 text-sm focus:ring-1 focus:ring-neon transition-all"
              />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pr-2">
           {loading ? (
             <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-neon animate-spin" />
             </div>
           ) : filteredProducts.length === 0 ? (
             <div className="text-center p-20 opacity-20">
                <ShoppingBag className="w-16 h-16 mx-auto mb-4" />
                <p className="text-white font-black uppercase tracking-widest">No matching products</p>
             </div>
           ) : (
             <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map(product => (
                   <button 
                     key={product.id}
                     onClick={() => addToCart(product)}
                     className="card p-4 group hover:border-neon/30 transition-all text-left flex flex-col h-full bg-gradient-to-br from-gray-900 to-black relative overflow-hidden"
                   >
                      <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="w-8 h-8 rounded-lg bg-neon text-black flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                            <Plus className="w-5 h-5" />
                         </div>
                      </div>
                      
                      <div className="w-full aspect-square rounded-xl bg-gray-800 mb-4 flex items-center justify-center text-gray-600 group-hover:text-neon transition-colors overflow-hidden border border-gray-700">
                         {product.image_url ? (
                           <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                         ) : (
                           <ShoppingBag className="w-8 h-8 opacity-20" />
                         )}
                      </div>
                      
                      <div className="flex-1 flex flex-col">
                         <p className="text-[9px] text-neon font-black uppercase tracking-[0.2em] mb-1">{product.category}</p>
                         <h3 className="text-white font-black leading-tight mb-2 line-clamp-2">{product.name}</h3>
                         <div className="mt-auto flex justify-between items-end">
                            <p className="text-white font-black text-sm">Rs. {product.price}</p>
                            <span className="text-[9px] text-textSecondary font-bold bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700">
                               {product.stock_level} Stock
                            </span>
                         </div>
                      </div>
                   </button>
                ))}
             </div>
           )}
        </div>
      </div>

      {/* Cart & Checkout - Right Side */}
      <div className="w-full lg:w-[380px] flex flex-col gap-6">
         {/* Cart Panel */}
         <div className="card flex-1 flex flex-col p-6 min-h-[400px] border-neon/10 bg-gradient-to-b from-gray-900 to-black">
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-xl font-black text-white italic tracking-tighter flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-neon" /> Current Cart
               </h2>
               <span className="px-3 py-1 bg-gray-900 rounded-full text-[10px] font-black text-neon border border-neon/20">
                  {cart.length} ITEMS
               </span>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 mb-8">
               {cart.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center opacity-10">
                    <ShoppingCart className="w-12 h-12 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-center">Cart is empty.<br/>Pick items from catalog.</p>
                 </div>
               ) : cart.map(item => (
                 <div key={item.id} className="flex items-center gap-4 bg-black/40 p-3 rounded-2xl border border-gray-800 animate-in slide-in-from-right duration-300">
                    <div className="w-12 h-12 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center text-neon flex-shrink-0">
                       <p className="text-xs font-black">X{item.quantity}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-white font-black text-xs truncate uppercase italic">{item.name}</p>
                       <p className="text-neon font-black text-xs mt-1">Rs. {item.price * item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                       <button 
                         onClick={() => updateQuantity(item.id, -1)}
                         className="w-6 h-6 rounded-lg bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center"
                       >
                          <Minus className="w-3 h-3" />
                       </button>
                       <button 
                         onClick={() => updateQuantity(item.id, 1)}
                         className="w-6 h-6 rounded-lg bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center"
                       >
                          <Plus className="w-3 h-3" />
                       </button>
                       <button 
                         onClick={() => removeFromCart(item.id)}
                         className="w-6 h-6 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center ml-1"
                       >
                          <X className="w-3 h-3" />
                       </button>
                    </div>
                 </div>
               ))}
            </div>

            {/* Member Link UI */}
            <div className="pt-6 border-t border-gray-800 space-y-4">
               {!selectedMember ? (
                 <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                      type="text" 
                      placeholder="Link Sale to Member (Name/QR)..." 
                      value={memberSearch}
                      onChange={(e) => {
                        setMemberSearch(e.target.value);
                        searchMembers(e.target.value);
                      }}
                      className="w-full bg-black border border-gray-800 rounded-xl pl-12 pr-4 py-3 text-[10px] focus:ring-1 focus:ring-neon"
                    />
                    {foundMembers.length > 0 && (
                      <div className="absolute bottom-full mb-2 left-0 right-0 bg-gray-900 border border-gray-800 rounded-2xl p-2 shadow-2xl z-20">
                         {foundMembers.map(m => (
                           <button 
                             key={m.id}
                             onClick={() => {
                               setSelectedMember(m);
                               setFoundMembers([]);
                               setMemberSearch('');
                             }}
                             className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-xl text-left"
                           >
                              <div>
                                 <p className="text-white font-bold text-xs">{m.first_name} {m.last_name}</p>
                                 <p className="text-textSecondary text-[9px] uppercase tracking-widest">{m.member_id_string}</p>
                              </div>
                              <ArrowRight className="w-3 h-3 text-neon" />
                           </button>
                         ))}
                      </div>
                    )}
                 </div>
               ) : (
                 <div className="flex items-center justify-between p-3 bg-neon/10 border border-neon/20 rounded-2xl">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-neon text-black flex items-center justify-center">
                          <User className="w-4 h-4" />
                       </div>
                       <div>
                          <p className="text-neon font-black text-xs italic tracking-tighter uppercase">{selectedMember.first_name} {selectedMember.last_name}</p>
                          <p className="text-[8px] text-neon/60 font-black tracking-widest uppercase">Member ID: {selectedMember.member_id_string}</p>
                       </div>
                    </div>
                    <button onClick={() => setSelectedMember(null)} className="text-neon/50 hover:text-red-400">
                       <X className="w-4 h-4" />
                    </button>
                 </div>
               )}

               {/* Totals & Checkout */}
               <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                     <p className="text-textSecondary text-xs font-black uppercase tracking-widest">Total Payable</p>
                     <p className="text-2xl font-black text-white italic tracking-tighter">Rs. {subtotal}</p>
                  </div>

                  <div className="flex gap-2">
                     <button 
                       onClick={() => setPaymentMethod('cash')}
                       className={`flex-1 p-4 rounded-2xl border transition-all flex flex-col items-center gap-1 group ${
                         paymentMethod === 'cash' ? 'bg-neon/10 border-neon text-neon' : 'bg-gray-900 border-gray-800 text-textSecondary'
                       }`}
                     >
                        <Banknote className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Cash</span>
                     </button>
                     <button 
                       onClick={() => setPaymentMethod('card')}
                       className={`flex-1 p-4 rounded-2xl border transition-all flex flex-col items-center gap-1 group ${
                         paymentMethod === 'card' ? 'bg-neon/10 border-neon text-neon' : 'bg-gray-900 border-gray-800 text-textSecondary'
                       }`}
                     >
                        <CreditCard className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Card</span>
                     </button>
                  </div>

                  <button 
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || isCheckingOut}
                    className="w-full py-5 bg-neon rounded-2xl text-black font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(204,255,0,0.3)] hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 group"
                  >
                     {isCheckingOut ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                       <>
                          Complete Purchase <CheckCircle2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
                       </>
                     )}
                  </button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Store;
