import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { applicationService } from '../services/application';
import { Application, PartnerDetails, Address } from '../types';

interface ApplicationContextType {
  application: Application | null;
  isLoading: boolean;
  loadApplication: (userId: string) => Promise<void>;
  updateDraft: (updates: {
    userDetails?: any;
    partnerForm?: PartnerDetails;
    userAddress?: Address;
    userCurrentAddress?: Address;
    partnerAddress?: Address;
    partnerCurrentAddress?: Address;
    address?: Address;
    currentAddress?: Address;
    declarations?: Record<string, boolean | string>;
  }) => Promise<void>;
  submitApplication: () => Promise<void>;
  refreshApplication: () => Promise<void>;
}

const ApplicationContext = createContext<ApplicationContextType | undefined>(undefined);

export const useApplication = () => {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error('useApplication must be used within ApplicationProvider');
  }
  return context;
};

export const ApplicationProvider: React.FC<{
  children: React.ReactNode;
  userId: string;
}> = ({ children, userId }) => {
  const [application, setApplication] = useState<Application | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadApplication = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      let app = await applicationService.getApplication(userId);
      if (!app) {
        app = await applicationService.createDraft(userId);
      }
      setApplication(app);
    } catch (error) {
      console.error('Failed to load application:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateDraft = useCallback(async (updates: {
    userDetails?: any;
    partnerForm?: PartnerDetails;
    userAddress?: Address;
    userCurrentAddress?: Address;
    partnerAddress?: Address;
    partnerCurrentAddress?: Address;
    address?: Address;
    currentAddress?: Address;
    declarations?: Record<string, boolean | string>;
  }) => {
    if (!userId) return;
    try {
      const updated = await applicationService.updateDraft(userId, updates);
      setApplication(updated);
    } catch (error) {
      console.error('Failed to update draft:', error);
      throw error;
    }
  }, [userId]);

  const submitApplication = useCallback(async () => {
    if (!userId) return;
    try {
      const submitted = await applicationService.submitApplication(userId);
      setApplication(submitted);
    } catch (error) {
      console.error('Failed to submit application:', error);
      throw error;
    }
  }, [userId]);

  const refreshApplication = useCallback(async () => {
    if (userId) {
      await loadApplication(userId);
    }
  }, [userId, loadApplication]);

  useEffect(() => {
    if (userId) {
      loadApplication(userId);
    }
  }, [userId, loadApplication]);

  return (
    <ApplicationContext.Provider
      value={{
        application,
        isLoading,
        loadApplication,
        updateDraft,
        submitApplication,
        refreshApplication,
      }}
    >
      {children}
    </ApplicationContext.Provider>
  );
};

