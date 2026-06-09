import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as loginApi, getMe } from '../api/auth';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('dat_token'));
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      const storedToken = localStorage.getItem('dat_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await getMe();
        setUser(response.data || response.user || response);
        setToken(storedToken);
      } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.removeItem('dat_token');
        localStorage.removeItem('dat_user');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await loginApi(email, password);
    const { token: newToken, user: userData } = response.data || response;
    
    localStorage.setItem('dat_token', newToken);
    localStorage.setItem('dat_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    
    return userData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('dat_token');
    localStorage.removeItem('dat_user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  const isAuthenticated = !!token && !!user;

  const hasRole = useCallback((role) => {
    if (!user) return false;
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  }, [user]);

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
