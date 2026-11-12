import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { DivorceApplicationProvider } from '../../contexts/DivorceApplicationContext';
import DivorceFormContent from '../../components/divorce/DivorceFormContent';

const DivorceApplicationPage: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 mb-1">
          Divorce Registration Application
        </h1>
        <p className="text-xs sm:text-sm text-gray-600">
          Apply for divorce registration under The Bengal Muhammadan Marriages and Divorces Registration Act-1876
        </p>
      </div>
      <DivorceApplicationProvider userId={user.id}>
        <DivorceFormContent />
      </DivorceApplicationProvider>
    </div>
  );
};

export default DivorceApplicationPage;

