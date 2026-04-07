import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, CalendarCheck, Settings, BarChart3, Dumbbell, ShoppingBag, Package, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ isOpen, setIsOpen }) => {
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
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden" 
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-gray-800 h-screen flex flex-col transform transition-transform duration-300 md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
          <NavLink to="/" onClick={() => setIsOpen(false)} className="flex items-center group hover:bg-gray-800/30 transition-all">
            {gymSettings.logo_url ? (
              <img src={gymSettings.logo_url} alt="Logo" className="h-8 w-auto object-contain mr-2" />
            ) : (
              <div className="flex items-center">
                <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain mr-2" onError={(e) => e.target.style.display = 'none'} />
              </div>
            )}
            <h2 className="text-lg font-black tracking-tight text-white group-hover:text-neon transition-colors uppercase italic truncate max-w-[120px]">
              {gymSettings.gym_name}
            </h2>
          </NavLink>
          <button 
            onClick={() => setIsOpen(false)} 
            className="md:hidden p-2 text-gray-500 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      
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
  </>
  );
};

export default Sidebar;
