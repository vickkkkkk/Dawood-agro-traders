import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Receipt, Package,
  Truck, Users, BookOpen, UserCog, ChevronLeft,
  ChevronRight, LogOut, Wheat, X, FileSpreadsheet, TrendingUp, Wallet, RotateCcw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NAV_ITEMS } from '../../utils/constants';

const iconMap = {
  LayoutDashboard, ShoppingCart, Receipt, Package,
  Truck, Users, BookOpen, UserCog, FileSpreadsheet, TrendingUp, Wallet, RotateCcw
};

const Sidebar = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const filteredNavItems = NAV_ITEMS.filter(item =>
    item.roles.includes(user?.role)
  );

  const renderNavLinks = () => (
    <nav className="flex-1 py-6 px-4 overflow-y-auto">
      {filteredNavItems.map((item) => {
        const IconComponent = iconMap[item.icon];
        const isActive = item.path === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(item.path);

        return (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)} // Close drawer on link click (mobile)
            id={`nav-${item.path.replace('/', '') || 'dashboard'}`}
            className={`
              sidebar-tab-item
              flex items-center gap-4 rounded-xl
              text-sm font-bold tracking-wide
              transition-all duration-200 ease-out
              group relative
              ${isActive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md shadow-emerald-500/5'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }
            `}
          >
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-emerald-500 rounded-r-full" />
            )}
            {IconComponent && (
              <IconComponent
                size={20}
                className={`flex-shrink-0 transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
              />
            )}
            {(!collapsed || mobileOpen) && (
              <span className="animate-fade-in whitespace-nowrap leading-none">{item.label}</span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );

  const renderFooter = () => (
    <div className="border-t border-white/5 p-4 space-y-3">
      {/* Collapse Toggle (Desktop only) */}
      <button
        id="sidebar-toggle"
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        {!collapsed && <span>Collapse Sidebar</span>}
      </button>

      {/* User Card */}
      <div className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-white/5 border border-white/5 ${collapsed && !mobileOpen ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-md shadow-emerald-500/10">
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        {(!collapsed || mobileOpen) && (
          <div className="flex-1 min-w-0 animate-fade-in">
            <p className="text-xs font-bold text-white truncate">{user?.name || 'User'}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{user?.role || 'Role'}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity duration-300"
        />
      )}

      {/* 2. Mobile Drawer Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-screen z-50 w-[260px]
          bg-slate-900 border-r border-white/10
          flex flex-col lg:hidden
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-[72px] px-5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
              <Wheat size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white leading-tight">DAWOOD AGRO</h1>
              <p className="text-[10px] text-emerald-400 font-bold tracking-widest">TRADERS</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        {renderNavLinks()}
        {renderFooter()}
      </aside>

      {/* 3. Desktop Persistent Sidebar */}
      <aside
        id="sidebar"
        className={`
          hidden lg:flex flex-col flex-shrink-0 h-screen sticky top-0
          bg-slate-900 border-r border-white/10
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[76px] sidebar-collapsed' : 'w-[260px]'}
        `}
      >
        <div className="h-[72px] px-5 border-b border-white/10 flex items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
              <Wheat size={22} className="text-white" />
            </div>
            {!collapsed && (
              <div className="animate-fade-in overflow-hidden">
                <h1 className="text-sm font-extrabold text-white leading-tight">DAWOOD AGRO</h1>
                <p className="text-[10px] text-emerald-400 font-bold tracking-widest">TRADERS</p>
              </div>
            )}
          </div>
        </div>
        {renderNavLinks()}
        {renderFooter()}
      </aside>
    </>
  );
};

export default Sidebar;
