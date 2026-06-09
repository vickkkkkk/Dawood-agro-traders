import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-app flex relative font-sans text-primary-text">
      
      {/* Sidebar - renders persistent layout on desktop, sliding drawer on mobile */}
      <Sidebar 
        collapsed={collapsed} 
        setCollapsed={setCollapsed} 
        mobileOpen={mobileOpen} 
        setMobileOpen={setMobileOpen} 
      />
      
      {/* Main Content Pane - auto-adjusts layout width next to the sidebar */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="app-main-content flex-1 overflow-x-hidden overflow-y-auto bg-slate-950/20 scroll-smooth">
          <Outlet />
        </main>
      </div>
      
    </div>
  );
};

export default AppLayout;
