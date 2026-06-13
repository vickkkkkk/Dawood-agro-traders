import { useLocation } from 'react-router-dom';
import { Bell, Menu, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const pageTitles = {
  '/': 'Dashboard',
  '/pos': 'Point of Sale',
  '/bills': 'Bills',
  '/inventory': 'Inventory',
  '/purchases': 'Purchases',
  '/customers': 'Customers',
  '/credits': 'Credit Ledger',
  '/users': 'User Management',
};

const Header = ({ onMenuClick }) => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const title = pageTitles[location.pathname] || 'Dashboard';

  return (
    <header
      id="app-header"
      className="h-[72px] sticky top-0 z-30 bg-slate-900/60 backdrop-blur-xl border-b border-white/5 flex items-center"
    >
      <div className="flex-1 flex items-center justify-between app-header-content">
        
        {/* Left: Menu Toggle (Mobile) + Title */}
        <div className="flex items-center gap-3">
          <button
            id="mobile-menu-toggle"
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Menu size={20} />
          </button>
          
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-wider uppercase">{title}</h1>
            <p className="hidden sm:block text-[10px] font-bold text-slate-500 tracking-wider uppercase mt-0.5">
              {new Date().toLocaleDateString('en-PK', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                })}
            </p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Notification Bell */}
          <button
            id="btn-notifications"
            className="relative p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
          </button>



          {/* User Profile */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-emerald-500/10">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-bold text-white leading-none">{user?.name || 'User'}</p>
              <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-1 leading-none">{user?.role || 'Role'}</p>
            </div>
            {/* Logout button relocated here */}
            <button
              id="header-logout"
              onClick={logout}
              className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer ml-1 flex items-center justify-center"
              title="Logout Account"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
