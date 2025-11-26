import React, { useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';

const AuthLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    // Redirect authenticated users away from auth pages
    if (!isLoading && isAuthenticated && user) {
      if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, isLoading, isAuthenticated, navigate]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If authenticated, show loading while redirect happens
  if (isAuthenticated && user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-gold-50 px-4 py-8 overflow-hidden relative">
      {/* Decorative Background Elements - Constrained to viewport */}
      <div className="fixed top-0 right-0 -z-10 w-[400px] h-[400px] bg-gold-100/30 rounded-full blur-[120px] translate-x-1/4 -translate-y-1/4 animate-pulse-slow pointer-events-none"></div>
      <div className="fixed bottom-0 left-0 -z-10 w-[400px] h-[400px] bg-rose-100/30 rounded-full blur-[100px] -translate-x-1/4 translate-y-1/4 pointer-events-none"></div>
      
      <div className="w-full max-w-md z-10 relative">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-md text-white font-serif font-bold text-xl">
            M
          </div>
          <div className="flex flex-col">
            <span className="font-serif font-bold text-gray-900 leading-none text-xl tracking-tight">MMR Burwan</span>
            <span className="text-[10px] uppercase tracking-widest text-gold-600 font-medium">Official Portal</span>
          </div>
        </Link>
        
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;

