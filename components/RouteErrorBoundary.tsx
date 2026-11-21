import React from 'react';
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import Button from './ui/Button';

export const RouteErrorBoundary: React.FC = () => {
  const error = useRouteError();
  const navigate = useNavigate();

  let errorMessage = 'An unexpected application error occurred.';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage = error.statusText || error.data?.message || errorMessage;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-gray-200/80 rounded-2xl shadow-xl p-6 sm:p-8 text-center animate-fade-up">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
          <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-rose-600" />
        </div>

        <h1 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 mb-2">
          Something went wrong
        </h1>

        <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
          {errorStatus === 404
            ? "The page you're looking for doesn't exist or was moved."
            : errorMessage}
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <Button
            variant="primary"
            size="sm"
            onClick={handleReload}
            className="w-full sm:w-auto"
          >
            <RefreshCw size={14} className="mr-1.5" />
            Reload Page
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGoBack}
            className="w-full sm:w-auto"
          >
            <ArrowLeft size={14} className="mr-1.5" />
            Go Back
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoHome}
            className="w-full sm:w-auto"
          >
            <Home size={14} className="mr-1.5" />
            Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RouteErrorBoundary;

