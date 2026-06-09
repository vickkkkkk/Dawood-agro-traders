import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Menu, Settings, Sun, Moon, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

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
  const { theme, setTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);

  const title = pageTitles[location.pathname] || 'Dashboard';

  useEffect(() => {
    if (!showSettings) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.header-settings-container')) {
        setShowSettings(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [showSettings]);

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

          {/* Settings / Theme Trigger Dropdown */}
          <div className="relative header-settings-container">
            <button
              id="btn-settings"
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-center ${
                showSettings 
                  ? 'bg-white/10 border-white/20 text-white' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title="Settings"
            >
              <Settings size={18} className={showSettings ? 'animate-spin-slow' : ''} />
            </button>
            {showSettings && (
              <div className="absolute right-0 mt-2.5 w-56 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl p-4 z-50 animate-fade-in">
                <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Preferences</p>
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">App Theme</span>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5">
                      <button
                        onClick={() => {
                          setTheme('light');
                          setShowSettings(false);
                        }}
                        className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          theme === 'light'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Sun size={14} />
                        <span>Light</span>
                      </button>
                      <button
                        onClick={() => {
                          setTheme('dark');
                          setShowSettings(false);
                        }}
                        className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          theme === 'dark'
                            ? 'bg-white/10 text-white shadow-sm border border-white/5'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Moon size={14} />
                        <span>Dark</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

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
