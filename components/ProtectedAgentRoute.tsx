import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './ui/LoadingSpinner';
import Button from './ui/Button';
import { ShieldAlert } from 'lucide-react';

interface ProtectedAgentRouteProps {
  children: React.ReactNode;
}

const ProtectedAgentRoute: React.FC<ProtectedAgentRouteProps> = ({ children }) => {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();
  const [isReady, setIsReady] = useState(false);

  // Add a small delay to ensure auth state is fully resolved
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setIsReady(true), 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (isLoading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user || (user.role !== 'agent' && user.role !== 'admin')) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Block disabled agent access
  if (user.role === 'agent' && user.disabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-red-200">
          <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">Account Disabled</h2>
          <p className="text-gray-600 text-sm mb-6 leading-relaxed">
            Your agent account has been disabled by an administrator. You cannot access the agent portal or manage applications. Please contact administration for assistance.
          </p>
          <Button variant="outline" onClick={() => logout()} className="w-full">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedAgentRoute;
