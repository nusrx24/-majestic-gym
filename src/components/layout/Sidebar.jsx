import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, CalendarCheck, Settings, BarChart3, Dumbbell, ShoppingBag, Package } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const { profile, gymSettings } = useAuth();

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Members', icon: Users, path: '/members' },
    { name: 'Attendance', icon: CalendarCheck, path: '/attendance' },
    { name: 'Shop', icon: ShoppingBag, path: '/shop' }, // Member-side shopping
    { name: 'Store', icon: ShoppingBag, path: '/store', ownerOnly: false }, // Staff-side terminal
    { name: 'Inventory', icon: Package, path: '/inventory', ownerOnly: true },
    { name: 'Packages & Pay', icon: CreditCard, path: '/billing' },
    { name: 'Revenue', icon: BarChart3, path: '/revenue', ownerOnly: true },
    { name: 'Settings', icon: Settings, path: '/settings', ownerOnly: true },
  ];

  const filteredItems = menuItems.filter(item => !item.ownerOnly || profile?.role === 'owner');

  return (
    <aside className="w-64 bg-surface border-r border-gray-800 h-screen flex flex-col">
      <NavLink to="/" className="h-16 flex items-center px-6 border-b border-gray-800 group hover:bg-gray-800/30 transition-all">
        {gymSettings.logo_url ? (
          <img src={gymSettings.logo_url} alt="Logo" className="h-10 w-auto object-contain mr-3" />
        ) : (
          <div className="flex items-center">
            <img src="/logo.png" alt="Logo" className="h-10 w-auto object-contain mr-2" onError={(e) => e.target.style.display = 'none'} />
            <div className="w-8 h-8 bg-neon rounded-lg flex items-center justify-center text-background shadow-[0_0_15px_rgba(204,255,0,0.4)] group-hover:scale-110 transition-transform hidden no-img-fallback">
              <span className="font-extrabold text-sm">MG</span>
            </div>
          </div>
        )}
        <h2 className="text-xl font-black tracking-tight text-white group-hover:text-neon transition-colors uppercase italic">
          {gymSettings.gym_name}
        </h2>
      </NavLink>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        {filteredItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                isActive
                  ? 'bg-gray-800 text-neon font-semibold'
                  : 'text-textSecondary hover:bg-gray-800/50 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>
      
      <div className="p-4 border-t border-gray-800">
        <div className="bg-background rounded-lg p-4 text-xs font-black uppercase tracking-[0.3em] text-textSecondary text-center">
          <p>MAJESTIC GYM v2.0</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
