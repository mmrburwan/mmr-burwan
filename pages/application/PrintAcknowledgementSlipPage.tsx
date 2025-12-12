import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { applicationService } from '../../services/application';
import { profileService } from '../../services/profile';
import { Application } from '../../types';
import AcknowledgementSlipTemplate from '../../components/application/AcknowledgementSlipTemplate';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const PrintAcknowledgementSlipPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [application, setApplication] = useState<Application | null>(null);
    const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (!id) return;
            try {
                const appData = await applicationService.getApplicationById(id);
                setApplication(appData);

                if (appData?.userId) {
                    // Try to get email from profile first (if added to schema)
                    let email;
                    const profile = await profileService.getProfile(appData.userId);
                    if (profile && (profile as any).email) {
                        email = (profile as any).email;
                    }

                    // Fallback: If current user owns this application, get from auth
                    if (!email) {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user && user.id === appData.userId) {
                            email = user.email;
                        }
                    }

                    if (email) {
                        setUserEmail(email);
                    }
                }
            } catch (error) {
                console.error('Failed to load data', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [id]);

    useEffect(() => {
        if (!loading && application) {
            // Short delay to ensure rendering is complete
            const timer = setTimeout(() => {
                window.print();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [loading, application]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <LoadingSpinner />
            </div>
        );
    }

    if (!application) {
        return (
            <div className="p-8 text-center text-red-600">
                Application not found
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <AcknowledgementSlipTemplate application={application} userEmail={userEmail} />
        </div>
    );
};

export default PrintAcknowledgementSlipPage;
