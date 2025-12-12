import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ApplicationProvider } from '../../contexts/ApplicationContext';
import ApplicationFormContent from '../../components/application/ApplicationFormContent';

const ApplicationPage: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <ApplicationProvider userId={user.id}>
      <ApplicationFormContent />
    </ApplicationProvider>
  );
};

export default ApplicationPage;
