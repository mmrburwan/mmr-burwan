import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { divorceApplicationService } from '../services/divorceApplication';
import { DivorceApplication } from '../types';

interface DivorceApplicationContextType {
  application: DivorceApplication | null;
  isLoading: boolean;
  loadApplication: (idOrUserId: string) => Promise<void>;
  updateDraft: (updates: {
    userDetails?: any;
    partnerForm?: any;
    userAddress?: any;
    userCurrentAddress?: any;
    partnerAddress?: any;
    partnerCurrentAddress?: any;
    divorceDate?: string;
    divorceReason?: string;
    divorceType?: string;
    marriageCertificateNumber?: string;
    marriageApplicationId?: string;
    declarations?: Record<string, boolean | string>;
  }) => Promise<void>;
  submitApplication: () => Promise<void>;
  refreshApplication: () => Promise<void>;
}

const DivorceApplicationContext = createContext<DivorceApplicationContextType | undefined>(undefined);

export const useDivorceApplication = () => {
  const context = useContext(DivorceApplicationContext);
  if (!context) {
    throw new Error('useDivorceApplication must be used within DivorceApplicationProvider');
  }
  return context;
};

export const DivorceApplicationProvider: React.FC<{
  children: React.ReactNode;
  userId?: string;
  applicationId?: string;
}> = ({ children, userId, applicationId }) => {
  const [application, setApplication] = useState<DivorceApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const identifier = applicationId || userId;

  const loadApplication = useCallback(async (idOrUserId: string) => {
    setIsLoading(true);
    try {
      let app = applicationId
        ? await divorceApplicationService.getDivorceApplicationById(applicationId)
        : null;

      if (!app && userId) {
        app = await divorceApplicationService.getDivorceApplication(userId);
      }

      if (!app && userId) {
        app = await divorceApplicationService.createDraft(userId);
      }

      setApplication(app);
    } catch (error) {
      console.error('Failed to load divorce application:', error);
    } finally {
      setIsLoading(false);
    }
  }, [applicationId, userId]);

  const updateDraft = useCallback(
    async (updates: {
      userDetails?: any;
      partnerForm?: any;
      userAddress?: any;
      userCurrentAddress?: any;
      partnerAddress?: any;
      partnerCurrentAddress?: any;
      divorceDate?: string;
      divorceReason?: string;
      divorceType?: string;
      marriageCertificateNumber?: string;
      marriageApplicationId?: string;
      declarations?: Record<string, boolean | string>;
    }) => {
      const targetId = application?.id || applicationId || userId;
      if (!targetId) return;

      try {
        const updated = await divorceApplicationService.updateDraft(targetId, updates);
        setApplication(updated);
      } catch (error) {
        console.error('Failed to update divorce draft:', error);
        throw error;
      }
    },
    [application?.id, applicationId, userId]
  );

  const submitApplication = useCallback(async () => {
    const targetId = application?.id || applicationId || userId;
    if (!targetId) return;

    try {
      const submitted = await divorceApplicationService.submitApplication(targetId);
      setApplication(submitted);
    } catch (error) {
      console.error('Failed to submit divorce application:', error);
      throw error;
    }
  }, [application?.id, applicationId, userId]);

  const refreshApplication = useCallback(async () => {
    if (identifier) {
      await loadApplication(identifier);
    }
  }, [identifier, loadApplication]);

  useEffect(() => {
    if (identifier) {
      loadApplication(identifier);
    }
  }, [identifier, loadApplication]);

  return (
    <DivorceApplicationContext.Provider
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
    </DivorceApplicationContext.Provider>
  );
};

