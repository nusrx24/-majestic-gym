import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  X, 
  CreditCard, 
  ShoppingCart,
  Loader2,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

const MemberShop = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Cart State
  const [cart, setCart] = useState([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

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

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock_level) {
        alert("Stock limit reached.");
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

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleStripeCheckout = async () => {
    if (cart.length === 0) return;
    setIsCheckingOut(true);

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const memberId = authSession?.user?.id;

      // Call the Stripe Store Checkout Edge Function
      const { data, error } = await supabase.functions.invoke('stripe-store-checkout', {
        headers: {
          Authorization: `Bearer ${authSession?.access_token}`
        },
        body: {
          cartItems: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
          })),
          memberId: memberId
        }
      });

      if (error) throw error;
      
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert("Checkout Error: " + err.message);
      setIsCheckingOut(false);
    }
  };

  const filteredProducts = products.filter(p => 
    (selectedCategory === 'All' || p.category === selectedCategory) &&
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-140px)] p-4">
      
      {/* Product Display */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="mb-8">
           <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-4 flex items-center gap-3">
              <ShoppingBag className="w-10 h-10 text-neon" /> Majestic Shop
           </h1>
           <div className="flex flex-wrap gap-2 mb-6">
              {categories.map(cat => (
                <button 
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    selectedCategory === cat ? 'bg-neon text-black' : 'bg-gray-900 text-textSecondary hover:text-white border border-gray-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
           </div>
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="Find supplements and accessories..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface border border-gray-800 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-1 focus:ring-neon"
              />
           </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
           {loading ? (
             <div className="flex justify-center items-center py-20 col-span-full">
                <Loader2 className="w-10 h-10 text-neon animate-spin" />
             </div>
           ) : filteredProducts.map(product => (
             <div key={product.id} className="card p-0 group flex flex-col bg-gray-900 border-gray-800 hover:border-neon transition-all overflow-hidden">
                <div className="aspect-square bg-black p-4 flex items-center justify-center relative overflow-hidden">
                   {product.image_url ? (
                     <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg group-hover:scale-110 transition-transform duration-500" />
                   ) : (
                     <ShoppingBag className="w-12 h-12 text-gray-800" />
                   )}
                   <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="p-4 flex-1 flex flex-col">
                   <p className="text-[10px] text-neon font-black uppercase mb-1">{product.category}</p>
                   <h3 className="text-white font-extrabold text-sm mb-4 line-clamp-2">{product.name}</h3>
                   <div className="mt-auto flex items-center justify-between">
                      <p className="text-white font-black">Rs. {product.price}</p>
                      <button 
                        onClick={() => addToCart(product)}
                        className="p-2 bg-neon rounded-lg text-black hover:scale-110 transition-transform shadow-lg"
                      >
                         <Plus className="w-4 h-4" />
                      </button>
                   </div>
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* Shopping Cart Sidebar */}
      <div className="w-full lg:w-[400px] flex flex-col pt-4">
         <div className="card h-full flex flex-col p-8 border-neon/20 bg-gradient-to-b from-gray-900 to-black shadow-2xl relative">
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-2xl font-black text-white italic flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6 text-neon" /> Order Summary
               </h2>
               <span className="text-neon text-xs font-black bg-neon/10 px-2 py-1 rounded border border-neon/20">{cart.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 mb-8">
               {cart.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center opacity-10">
                    <ShoppingCart className="w-16 h-16 mb-4" />
                    <p className="font-black uppercase tracking-widest">Cart is empty</p>
                 </div>
               ) : cart.map(item => (
                 <div key={item.id} className="flex items-center gap-4 bg-black/40 p-3 rounded-2xl border border-gray-800 animate-in slide-in-from-right duration-300">
                    <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-neon flex-shrink-0">
                       {item.image_url ? (
                         <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                       ) : <p className="text-[10px] font-black">X{item.quantity}</p>}
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-white font-bold text-xs truncate uppercase italic">{item.name}</p>
                       <p className="text-neon font-black text-xs">Rs. {item.price * item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                       <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 rounded-lg bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center">
                          <Minus className="w-3 h-3" />
                       </button>
                       <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 rounded-lg bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center">
                          <Plus className="w-3 h-3" />
                       </button>
                    </div>
                 </div>
               ))}
            </div>

            <div className="pt-8 border-t border-gray-800">
               <div className="flex items-center justify-between mb-6">
                  <p className="text-textSecondary text-xs font-black uppercase tracking-widest leading-none">Total Purchase</p>
                  <p className="text-3xl font-black text-white italic tracking-tighter leading-none">Rs. {total.toLocaleString()}</p>
               </div>
               
               <button 
                 onClick={handleStripeCheckout}
                 disabled={cart.length === 0 || isCheckingOut}
                 className="w-full py-5 bg-neon rounded-2xl text-black font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(204,255,0,0.3)] hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100"
               >
                  {isCheckingOut ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                    <>
                       Checkout with Card <CreditCard className="w-6 h-6" />
                    </>
                  )}
               </button>
               <p className="text-[9px] text-center text-textSecondary font-bold uppercase mt-6 tracking-widest opacity-40">
                  Secure Credit Card checkout powered by Stripe
               </p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default MemberShop;
