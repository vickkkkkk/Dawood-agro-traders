import { ShieldX } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const RoleGuard = ({ allowedRoles, roles, children }) => {
  const { user } = useAuth();
  const rolesToMatch = allowedRoles || roles || [];

  if (!user || !rolesToMatch.includes(user.role)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            <ShieldX size={40} className="text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-slate-400 max-w-md">
            You don't have permission to access this page.
            Contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  return children || <Outlet />;
};

export default RoleGuard;
