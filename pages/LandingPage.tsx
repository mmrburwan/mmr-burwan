import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import SEO from '../components/SEO';
import StructuredData from '../components/StructuredData';
import Hero from '../components/Hero';
import Features from '../components/Features';
import HowItWorks from '../components/HowItWorks';
import Security from '../components/Security';
import Services from '../components/Services';
import Appointment from '../components/Appointment';
import CTA from '../components/CTA';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    // Wait for auth to finish loading before checking
    if (!isLoading && isAuthenticated && user) {
      // Redirect authenticated users to their appropriate dashboard
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

  // If authenticated, don't render landing page (redirect will happen)
  if (isAuthenticated && user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Show landing page for unauthenticated users
  return (
    <>
      <SEO
        title="MMR Burwan | Digital Marriage Registration System"
        description="Apply for marriage registration online from anywhere, anytime. Secure, fast, and paperless digital marriage registration system for Burwan. Official government service with 24/7 support."
        keywords="marriage registration, nikah registration, burwan, digital marriage certificate, online marriage registration, government service, marriage certificate online"
        url="https://mmrburwan.com"
      />
      <StructuredData type="GovernmentService" />
      <Hero />
      <Features />
      <HowItWorks />
      <Services />
      <Security />
      <Appointment />
      <CTA />
    </>
  );
};

export default LandingPage;

