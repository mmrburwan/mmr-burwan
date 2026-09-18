import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { applicationService } from '../../services/application';
import { Application } from '../../types';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { FileText, Clock, CheckCircle, ChevronLeft, ArrowRight } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { safeFormatDate } from '../../utils/dateUtils';
import Button from '../../components/ui/Button';

const AgentDashboardViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [agentName, setAgentName] = useState<string>('Agent');

  useEffect(() => {
    if (id) {
      loadApplications();
    }
  }, [id]);

  const loadApplications = async () => {
    setIsLoading(true);
    try {
      if (!id) return;
      const apps = await applicationService.getApplicationsByAgent(id);
      setApplications(apps);
      // In a real app we might want to fetch agent details separately, but for now we'll just display "Agent"
    } catch (error) {
      console.error('Failed to load applications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-800';
      case 'rejected': return 'bg-rose-100 text-rose-800';
      case 'under_review': return 'bg-blue-100 text-blue-800';
      case 'submitted': return 'bg-gold-100 text-gold-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string, verified?: boolean) => {
    if (verified) return 'Verified';
    switch (status) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Action Needed';
      case 'under_review': return 'Under Review';
      case 'submitted': return 'Submitted';
      case 'draft': return 'Draft';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  const approvedCount = applications.filter(a => a.verified || a.status === 'approved').length;
  const pendingCount = applications.filter(a => a.status === 'submitted' || a.status === 'under_review').length;
  const draftCount = applications.filter(a => a.status === 'draft').length;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/agents')}
          className="text-gray-500 hover:text-gray-900 -ml-2"
        >
          <ChevronLeft size={20} />
          Back to Agents
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-gray-900 mb-1">{agentName}'s Dashboard</h1>
        <p className="text-sm text-gray-600">View applications managed by this agent</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 sm:p-5 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
              <FileText size={20} />
            </div>
            <h3 className="font-medium text-gray-600 text-sm">Total Applications</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{applications.length}</p>
        </Card>

        <Card className="p-4 sm:p-5 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
              <CheckCircle size={20} />
            </div>
            <h3 className="font-medium text-gray-600 text-sm">Approved</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{approvedCount}</p>
        </Card>

        <Card className="p-4 sm:p-5 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gold-100 rounded-lg text-gold-700">
              <Clock size={20} />
            </div>
            <h3 className="font-medium text-gray-600 text-sm">Pending Review</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
        </Card>

        <Card className="p-4 sm:p-5 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gray-100 rounded-lg text-gray-700">
              <FileText size={20} />
            </div>
            <h3 className="font-medium text-gray-600 text-sm">Drafts</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{draftCount}</p>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-lg text-gray-900">Agent's Applications</h2>
        </div>
        
        {applications.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {applications.map((app) => (
              <div
                key={app.id}
                className="p-5 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer"
                onClick={() => navigate(`/admin/applications/${app.id}`)}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900">
                      {app.proxyUserEmail || 'No Email'}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(app.verified ? 'approved' : app.status)}`}>
                      {getStatusLabel(app.status, app.verified)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      Groom: {app.userDetails?.firstName ? `${app.userDetails.firstName} ${app.userDetails.lastName || ''}` : 'N/A'}
                    </span>
                    <span>
                      Bride: {app.partnerForm?.firstName ? `${app.partnerForm.firstName} ${app.partnerForm.lastName || ''}` : 'N/A'}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-gray-400">
                    Created: {safeFormatDate(app.submittedAt || app.lastUpdated, 'MMM d, yyyy')}
                  </div>
                </div>
                
                <div className="text-gray-400">
                  <ArrowRight size={20} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <p>This agent hasn't created any applications yet.</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AgentDashboardViewPage;
