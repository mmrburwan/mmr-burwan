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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-gold-50 px-3 py-3 sm:px-4 sm:py-6 overflow-hidden relative">
      {/* Decorative Background Elements - Constrained to viewport */}
      <div className="fixed top-0 right-0 -z-10 w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] bg-gold-100/30 rounded-full blur-[80px] sm:blur-[120px] translate-x-1/4 -translate-y-1/4 animate-pulse-slow pointer-events-none"></div>
      <div className="fixed bottom-0 left-0 -z-10 w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] bg-rose-100/30 rounded-full blur-[60px] sm:blur-[100px] -translate-x-1/4 translate-y-1/4 pointer-events-none"></div>
      
      <div className="w-full max-w-sm sm:max-w-md z-10 relative">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mb-3 sm:mb-5 justify-center">
          <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-md text-white font-serif font-bold text-base sm:text-lg">
            M
          </div>
          <div className="flex flex-col">
            <span className="font-serif font-bold text-gray-900 leading-none text-base sm:text-lg tracking-tight">MMR Burwan</span>
            <span className="text-[8px] sm:text-[10px] uppercase tracking-widest text-gold-600 font-medium">Official Portal</span>
          </div>
        </Link>
        
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;

