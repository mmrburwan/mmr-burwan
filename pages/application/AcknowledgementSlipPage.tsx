import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { applicationService } from '../../services/application';
import { Application } from '../../types';
import Button from '../../components/ui/Button';
import { ArrowLeft, Printer } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import AcknowledgementSlipTemplate from '../../components/application/AcknowledgementSlipTemplate';

const AcknowledgementSlipPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [application, setApplication] = useState<Application | null>(null);
    const [loading, setLoading] = useState(true);

    const handlePrint = () => {
        // Open the print-specific page in a new window
        window.open(`/print/application/${id}/acknowledgement`, '_blank', 'width=800,height=800');
    };

    useEffect(() => {
        const fetchApplication = async () => {
            if (!id) return;
            try {
                // user checks are handled by RLS typically, but good to have
                const data = await applicationService.getApplicationById(id);
                setApplication(data);
            } catch (error) {
                console.error('Failed to load application', error);
            } finally {
                setLoading(false);
            }
        };

        fetchApplication();
    }, [id]);

    if (loading) return <LoadingSpinner />;

    if (!application) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <h2 className="text-xl font-bold text-gray-800">Application not found</h2>
                <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mt-4">
                    Back to Dashboard
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="mb-6 flex items-center justify-between print:hidden">
                <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                    <ArrowLeft size={16} className="mr-2" /> Back to Dashboard
                </Button>
                <Button variant="primary" onClick={handlePrint}>
                    <Printer size={16} className="mr-2" /> Print Slip
                </Button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <AcknowledgementSlipTemplate
                    application={application}
                    userEmail={user?.email || undefined}
                />
            </div>
        </div>
    );
};

export default AcknowledgementSlipPage;
