import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { adminService } from '../../services/admin';
import { certificateService } from '../../services/certificates';
import { Application, CertificateDetails, Certificate } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import VerifyApplicationModal from '../../components/admin/VerifyApplicationModal';
import DeleteApplicationModal from '../../components/admin/DeleteApplicationModal';
import { Users, Search, Eye, MessageSquare, FileCheck, CheckCircle, XCircle, ArrowLeft, FileText, Trash2, StickyNote, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { safeFormatDateObject } from '../../utils/dateUtils';
import { useDebounce } from '../../hooks/useDebounce';
import { downloadCertificate, viewCertificate } from '../../utils/certificateGenerator';


const CircularProgress = ({
  progress,
  size = 48,
  strokeWidth = 3,
  children
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  children: React.ReactNode;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="absolute w-full h-full transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#D4AF37"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center p-1">
        {children}
      </div>
    </div>
  );
};

interface ClientWithApplication {
  userId: string;
  email: string;
  application: Application | null;
}

const ClientsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientWithApplication[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const [verifiedFilter, setVerifiedFilter] = useState<string>('all'); // 'all', 'verified', 'unverified', 'rejected', 'draft'
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [certificatesMap, setCertificatesMap] = useState<Record<string, Certificate | null>>({});
  const [generatingCert, setGeneratingCert] = useState<string | null>(null);
  const [verifyModalState, setVerifyModalState] = useState<{
    isOpen: boolean;
    applicationId: string;
    certificateNumber?: string;
    registrationDate?: string;
    certificateDetails?: CertificateDetails;
    marriageDate?: string;
  }>({
    isOpen: false,
    applicationId: '',
  });

  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    applicationId: string;
    groomName?: string;
    brideName?: string;
  }>({
    isOpen: false,
    applicationId: '',
  });

  const [commentModalState, setCommentModalState] = useState<{
    isOpen: boolean;
    applicationId: string;
    comment: string;
  }>({
    isOpen: false,
    applicationId: '',
    comment: '',
  });

  const loadClients = useCallback(async (targetPage: number = page, targetLimit: number = limit) => {
    setIsFetching(true);
    try {
      const { data: applications, count } = await adminService.getApplications(targetPage, targetLimit, {
        search: debouncedSearchTerm,
        verified: verifiedFilter,
      });

      setTotalCount(count);

      // Get unique user IDs from currently loaded applications
      const userIds = [...new Set(applications.map(app => app.userId))];

      // Fetch user emails in batch
      const emailMap = userIds.length > 0 ? await adminService.getUserEmails(userIds) : {};

      // Create client entries for EACH application
      const clientsData: ClientWithApplication[] = applications.map((application) => ({
        userId: application.userId,
        email: emailMap[application.userId] || application.proxyUserEmail || 'N/A',
        application,
      }));

      setClients(clientsData);

      // Fetch certificates for verified applications in 1 single batch query
      const verifiedAppIds = clientsData
        .filter(client => client.application?.verified && client.application?.id)
        .map(client => client.application!.id);

      if (verifiedAppIds.length > 0) {
        const certMap = await certificateService.getCertificatesByApplicationIds(verifiedAppIds);
        setCertificatesMap(certMap);
      } else {
        setCertificatesMap({});
      }
    } catch (error) {
      console.error('Failed to load clients:', error);
      showToast('Failed to load clients', 'error');
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [page, limit, debouncedSearchTerm, verifiedFilter, showToast]);

  // Reset page to 1 whenever search or filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, verifiedFilter]);

  // Load clients when page, limit, debouncedSearchTerm, or verifiedFilter changes
  useEffect(() => {
    loadClients(page, limit);
  }, [page, limit, debouncedSearchTerm, verifiedFilter, loadClients]);

  const handleUpdateComment = async () => {
    if (!user) return;
    try {
      await adminService.updateApplicationComment(
        commentModalState.applicationId,
        commentModalState.comment,
        user.id,
        user.name || user.email
      );
      showToast('Comment updated successfully', 'success');

      // Update local state without full reload
      setClients(prev => prev.map(c => {
        if (c.application?.id === commentModalState.applicationId) {
          return {
            ...c,
            application: {
              ...c.application,
              adminComment: commentModalState.comment,
            },
          };
        }
        return c;
      }));

      setCommentModalState({ isOpen: false, applicationId: '', comment: '' });
    } catch (error: any) {
      showToast(error.message || 'Failed to update comment', 'error');
    }
  };

  const handleVerify = async (certificateNumber: string, registrationDate: string, registrarName: string, certificateDetails: CertificateDetails) => {
    if (!user) return;

    try {
      await adminService.verifyApplication(
        verifyModalState.applicationId,
        user.id,
        user.name || user.email,
        certificateNumber,
        registrationDate,
        registrarName,
        certificateDetails
      );
      showToast('Application verified successfully', 'success');
      setVerifyModalState({ isOpen: false, applicationId: '' });
      await loadClients(page, limit);
    } catch (error: any) {
      showToast(error.message || 'Failed to verify application', 'error');
      throw error;
    }
  };

  const handleUnverify = async (applicationId: string) => {
    if (!user) return;
    try {
      await adminService.unverifyApplication(
        applicationId,
        user.id,
        user.name || user.email || 'Admin User'
      );
      showToast('Application unverified', 'success');
      await loadClients(page, limit);
    } catch (error) {
      showToast('Failed to unverify application', 'error');
      console.error('Failed to unverify:', error);
    }
  };

  const handleGenerateCertificate = async (applicationId: string) => {
    if (!user) return;
    setGeneratingCert(applicationId);
    try {
      await adminService.generateCertificate(
        applicationId,
        user.id,
        user.name || user.email
      );
      showToast('Certificate generated successfully', 'success');
      const cert = await certificateService.getCertificateByApplicationId(applicationId);
      setCertificatesMap(prev => ({
        ...prev,
        [applicationId]: cert || null,
      }));
    } catch (error: any) {
      showToast(error.message || 'Failed to generate certificate', 'error');
    } finally {
      setGeneratingCert(null);
    }
  };

  const handleViewCertificate = async (application: Application) => {
    try {
      await viewCertificate(application);
    } catch (error) {
      console.error('Failed to open certificate:', error);
      showToast('Failed to open certificate preview', 'error');
    }
  };

  const handleDownloadCertificate = async (application: Application) => {
    try {
      await downloadCertificate(application);
      showToast('Certificate downloaded successfully', 'success');
    } catch (error) {
      console.error('Failed to download certificate:', error);
      showToast('Failed to download certificate', 'error');
    }
  };

  const handleDeleteApplication = async (applicationId: string) => {
    if (!user) return;

    try {
      await adminService.deleteApplication(applicationId, user.id, user.name || user.email);
      showToast('Application deleted successfully', 'success');
      setDeleteModalState(prev => ({ ...prev, isOpen: false }));
      await loadClients(page, limit);
    } catch (error: any) {
      showToast(error.message || 'Failed to delete application', 'error');
      throw error;
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (page >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
      approved: 'success',
      submitted: 'info',
      under_review: 'warning',
      rejected: 'error',
      draft: 'warning',
    };
    return <Badge variant={variants[status] || 'info'}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-3 lg:mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin')}
            className="flex-shrink-0 !text-xs sm:!text-sm !px-2 sm:!px-3"
            size="sm"
          >
            <ArrowLeft size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Back
          </Button>
        </div>
        <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">Clients</h1>
        <p className="text-xs sm:text-sm text-gray-600">Manage and view all registered clients</p>
      </div>

      <Card className="p-3 sm:p-4 lg:p-6 mb-3 sm:mb-4 lg:mb-6">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 lg:gap-4">
          <div className="flex-1 min-w-0">
            <Input
              placeholder="Search by groom/bride name, email or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={16} className="sm:w-5 sm:h-5" />}
            />
          </div>
          <select
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value)}
            className="px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 rounded-lg sm:rounded-xl border border-gray-200 focus:border-gold-500 focus:ring-2 focus:ring-gold-500 focus:outline-none text-xs sm:text-sm w-full sm:w-auto"
          >
            <option value="all">All Verification</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="rejected">Rejected Documents</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </Card>

      <Card className="p-3 sm:p-4 lg:p-6">
        {isFetching && (
          <div className="flex items-center justify-center py-2 mb-3 text-xs text-gold-700 bg-gold-50/80 rounded-lg animate-pulse">
            <Loader2 size={14} className="animate-spin mr-1.5" />
            Loading applications...
          </div>
        )}
        {/* Mobile Card View */}
        <div className={`block sm:hidden space-y-3 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {clients.map((client) => {
            const groomName = client.application?.userDetails
              ? `${client.application.userDetails.firstName}${client.application.userDetails.lastName ? ' ' + client.application.userDetails.lastName : ''}`
              : '-';
            const brideName = client.application?.partnerForm
              ? `${client.application.partnerForm.firstName}${client.application.partnerForm.lastName ? ' ' + client.application.partnerForm.lastName : ''}`
              : '-';
            const groomPhone = client.application?.userDetails?.mobileNumber || '-';
            const bridePhone = client.application?.partnerForm?.mobileNumber || '-';
            const userEmail = client.email || '-';

            return (
              <Card key={client.application?.id || client.userId} className="p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="space-y-3">
                  {/* Header with Status Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CircularProgress
                        progress={client.application?.progress || 0}
                        size={52}
                      >
                        <div className="w-full h-full rounded-full bg-gradient-to-br from-gold-100 to-gold-200 flex items-center justify-center shadow-sm">
                          <Users size={18} className="text-gold-600" />
                        </div>
                      </CircularProgress>
                      <div>
                        <p className="text-[10px] font-medium text-gold-600 uppercase tracking-wide">Couple</p>
                      </div>
                    </div>
                    {client.application
                      ? getStatusBadge(client.application.status)
                      : <Badge variant="default" className="!text-[10px]">No App</Badge>
                    }
                  </div>

                  {/* Groom & Bride Names */}
                  {client.application?.adminComment && (
                    <div className="mb-2 bg-amber-50 border border-amber-200/60 rounded-xl p-2.5 shadow-sm">
                      <div className="flex items-start gap-2.5">
                        <div className="bg-amber-100 p-1 rounded-md mt-0.5">
                          <StickyNote size={12} className="text-amber-700 fill-amber-300/50" />
                        </div>
                        <p className="text-xs text-amber-900 leading-relaxed font-medium">
                          {client.application.adminComment}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs">🤵</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Groom</p>
                        <p className="font-semibold text-sm text-gray-900 truncate">{groomName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs">👰</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Bride</p>
                        <p className="font-semibold text-sm text-gray-900 truncate">{brideName}</p>
                      </div>
                    </div>
                  </div>

                  {/* Phone & Email */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-blue-50/50 rounded-lg p-2">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Groom Phone</p>
                        <p className="text-xs font-medium text-gray-800">{groomPhone}</p>
                      </div>
                      <div className="bg-pink-50/50 rounded-lg p-2">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Bride Phone</p>
                        <p className="text-xs font-medium text-gray-800">{bridePhone}</p>
                      </div>
                    </div>
                    <div className="bg-gray-50/50 rounded-lg p-2">
                      <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Email</p>
                      <p className="text-xs font-medium text-gray-800 truncate">{userEmail}</p>
                    </div>
                  </div>

                  {/* Status Info Row */}
                  <div className="grid grid-cols-1 gap-2">
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Updated</p>
                      <p className="text-[10px] font-medium text-gray-700">
                        {client.application?.lastUpdated
                          ? safeFormatDateObject(new Date(client.application.lastUpdated), 'dd-MM-yyyy')
                          : '-'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Status with Verification */}
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1.5">Status</p>
                    <div className="flex items-center justify-center gap-2">
                      {client.application
                        ? getStatusBadge(client.application.status)
                        : <Badge variant="default" className="!text-[10px]">No App</Badge>
                      }
                      {client.application?.verified !== undefined && (
                        <Badge variant={client.application.verified ? 'success' : 'default'} className="!text-[9px] !px-1.5">
                          {client.application.verified ? '✓ Verified' : 'Unverified'}
                        </Badge>
                      )}
                    </div>
                  </div>


                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    {client.application && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!text-[11px] !px-3 !py-1.5 !rounded-lg bg-gold-50 hover:bg-gold-100 text-gold-700 flex-1"
                        onClick={() => {
                          navigate(`/admin/applications/${client.application!.id}`);
                        }}
                      >
                        <Eye size={14} className="mr-1" />
                        View
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!text-[11px] !px-3 !py-1.5 !rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 flex-1"
                      onClick={() => navigate(`/admin/chat?userId=${client.userId}`)}
                    >
                      <MessageSquare size={14} className="mr-1" />
                      Message
                    </Button>
                    {client.application && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`!text-[11px] !px-3 !py-1.5 !rounded-lg ${client.application.adminComment ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'} flex-1`}
                        onClick={() => {
                          setCommentModalState({
                            isOpen: true,
                            applicationId: client.application!.id,
                            comment: client.application!.adminComment || '',
                          });
                        }}
                      >
                        <StickyNote size={14} className={`mr-1 ${client.application.adminComment ? 'fill-current' : ''}`} />
                        {client.application.adminComment ? 'Edit Note' : 'Add Note'}
                      </Button>
                    )}
                    {client.application && client.application.status === 'submitted' && (
                      <>
                        {client.application.verified ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="!text-[11px] !px-3 !py-1.5 !rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex-1"
                              onClick={() => handleUnverify(client.application!.id)}
                            >
                              <XCircle size={14} className="mr-1" />
                              Unverify
                            </Button>
                            {!certificatesMap[client.application.id] ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!text-[11px] !px-3 !py-1.5 !rounded-lg bg-green-50 hover:bg-green-100 text-green-700 flex-1"
                                disabled={generatingCert === client.application.id}
                                onClick={() => handleGenerateCertificate(client.application!.id)}
                              >
                                <FileText size={14} className="mr-1" />
                                {generatingCert === client.application.id ? 'Generating...' : 'Generate'}
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="!text-[11px] !px-3 !py-1.5 !rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 flex-1"
                                  onClick={() => handleViewCertificate(client.application!)}
                                >
                                  <FileText size={14} className="mr-1" />
                                  View Cert
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="!text-[11px] !px-3 !py-1.5 !rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex-1"
                                  onClick={() => handleDownloadCertificate(client.application!)}
                                >
                                  <FileCheck size={14} className="mr-1" />
                                  Download
                                </Button>
                              </>
                            )}
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!text-[11px] !px-3 !py-1.5 !rounded-lg bg-green-50 hover:bg-green-100 text-green-700 flex-1"
                            onClick={() => {
                              setVerifyModalState({
                                isOpen: true,
                                applicationId: client.application!.id,
                                certificateNumber: client.application?.certificateNumber,
                                registrationDate: client.application?.registrationDate,
                                certificateDetails: client.application?.certificateDetails,
                              });
                            }}
                          >
                            <CheckCircle size={14} className="mr-1" />
                            Verify
                          </Button>
                        )}
                      </>
                    )}
                    {client.application && client.application.status === 'draft' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!text-[11px] !px-3 !py-1.5 !rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex-1"
                        onClick={() => {
                          const groomName = client.application?.userDetails
                            ? `${client.application.userDetails.firstName}${client.application.userDetails.lastName ? ' ' + client.application.userDetails.lastName : ''}`
                            : undefined;
                          const brideName = client.application?.partnerForm
                            ? `${client.application.partnerForm.firstName}${client.application.partnerForm.lastName ? ' ' + client.application.partnerForm.lastName : ''}`
                            : undefined;

                          setDeleteModalState({
                            isOpen: true,
                            applicationId: client.application!.id,
                            groomName,
                            brideName,
                          });
                        }}
                      >
                        <Trash2 size={14} className="mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Desktop Table View */}
        <div className={`hidden sm:block overflow-x-auto transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Groom & Bride</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Phone & Email</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Actions</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const groomName = client.application?.userDetails
                  ? `${client.application.userDetails.firstName}${client.application.userDetails.lastName ? ' ' + client.application.userDetails.lastName : ''}`
                  : '-';
                const brideName = client.application?.partnerForm
                  ? `${client.application.partnerForm.firstName}${client.application.partnerForm.lastName ? ' ' + client.application.partnerForm.lastName : ''}`
                  : '-';
                const groomPhone = client.application?.userDetails?.mobileNumber || '-';
                const bridePhone = client.application?.partnerForm?.mobileNumber || '-';
                const userEmail = client.email || '-';

                return (
                  <tr key={client.application?.id || client.userId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <CircularProgress
                          progress={client.application?.progress || 0}
                          size={46}
                        >
                          <div className="w-full h-full rounded-full bg-gold-100 flex items-center justify-center flex-shrink-0">
                            <Users size={16} className="text-gold-600" />
                          </div>
                        </CircularProgress>
                        <div className="flex flex-col">
                          {client.application?.adminComment && (
                            <div className="mb-1.5 flex items-start gap-1.5 p-1.5 bg-amber-50/80 border border-amber-200/60 rounded-md shadow-sm w-fit max-w-[240px]">
                              <StickyNote size={11} className="mt-0.5 text-amber-600 fill-amber-100 flex-shrink-0" />
                              <span className="text-[10px] text-amber-900 font-medium line-clamp-2 leading-tight" title={client.application.adminComment}>
                                {client.application.adminComment}
                              </span>
                            </div>
                          )}
                          <span className="font-medium text-[10px] sm:text-xs lg:text-sm text-gray-900 truncate">🤵 {groomName}</span>
                          <span className="font-medium text-[10px] sm:text-xs lg:text-sm text-gray-900 truncate">👰 {brideName}</span>

                        </div>
                      </div>
                    </td>
                    <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4">
                      <div className="flex flex-col text-[10px] sm:text-xs lg:text-sm text-gray-600 gap-2">
                        <div>
                          <span className="font-medium truncate">🤵 {groomPhone}</span>
                        </div>
                        <div>
                          <span className="font-medium truncate">👰 {bridePhone}</span>
                        </div>
                        <div>
                          <span className="truncate text-[9px] sm:text-[10px] lg:text-xs text-gray-500">📧 {userEmail}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4">
                      <div className="flex flex-col gap-1.5">
                        {client.application
                          ? getStatusBadge(client.application.status)
                          : <Badge variant="default" className="!text-[10px] sm:!text-xs">No Application</Badge>
                        }
                        {client.application?.verified !== undefined && (
                          <Badge variant={client.application.verified ? 'success' : 'default'} className="!text-[10px] sm:!text-xs">
                            {client.application.verified ? '✓ Verified' : 'Unverified'}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4">
                      <div className="flex flex-wrap gap-1 sm:gap-2">
                        {client.application && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!text-[10px] sm:!text-xs !px-1.5 sm:!px-2"
                            onClick={() => {
                              navigate(`/admin/applications/${client.application!.id}`);
                            }}
                          >
                            <Eye size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="!text-[10px] sm:!text-xs !px-1.5 sm:!px-2"
                          onClick={() => navigate(`/admin/chat?userId=${client.userId}`)}
                        >
                          <MessageSquare size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                          <span className="hidden sm:inline">Message</span>
                        </Button>
                        {client.application && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`!text-[10px] sm:!text-xs !px-1.5 sm:!px-2 ${client.application.adminComment ? 'text-amber-700 hover:bg-amber-50' : ''}`}
                            onClick={() => {
                              setCommentModalState({
                                isOpen: true,
                                applicationId: client.application!.id,
                                comment: client.application!.adminComment || '',
                              });
                            }}
                            title={client.application.adminComment}
                          >
                            <StickyNote size={12} className={`sm:w-4 sm:h-4 mr-0.5 sm:mr-1 ${client.application.adminComment ? 'fill-current' : ''}`} />
                            <span className="hidden sm:inline">{client.application.adminComment ? 'Note' : 'Note'}</span>
                          </Button>
                        )}
                        {client.application && client.application.status === 'submitted' && (
                          <>
                            {client.application.verified ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="!text-[10px] sm:!text-xs !px-1.5 sm:!px-2"
                                  onClick={() => handleUnverify(client.application!.id)}
                                >
                                  <XCircle size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                                  <span className="hidden sm:inline">Unverify</span>
                                </Button>
                                {!certificatesMap[client.application.id] ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="!text-[10px] sm:!text-xs !px-1.5 sm:!px-2"
                                    disabled={generatingCert === client.application.id}
                                    onClick={() => handleGenerateCertificate(client.application!.id)}
                                  >
                                    <FileText size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                                    <span className="hidden sm:inline">
                                      {generatingCert === client.application.id ? 'Generating...' : 'Generate Cert'}
                                    </span>
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="!text-[10px] sm:!text-xs !px-1.5 sm:!px-2 text-blue-600 hover:bg-blue-50"
                                      onClick={() => handleViewCertificate(client.application!)}
                                    >
                                      <FileText size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                                      <span className="hidden sm:inline">View</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="!text-[10px] sm:!text-xs !px-1.5 sm:!px-2 text-indigo-600 hover:bg-indigo-50"
                                      onClick={() => handleDownloadCertificate(client.application!)}
                                    >
                                      <FileCheck size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                                      <span className="hidden sm:inline">Download</span>
                                    </Button>
                                  </>
                                )}
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!text-[10px] sm:!text-xs !px-1.5 sm:!px-2"
                                onClick={() => {
                                  setVerifyModalState({
                                    isOpen: true,
                                    applicationId: client.application!.id,
                                    certificateNumber: client.application?.certificateNumber,
                                    registrationDate: client.application?.registrationDate,
                                    certificateDetails: client.application?.certificateDetails,
                                    marriageDate: (client.application?.declarations as any)?.marriageDate || (client.application?.declarations as any)?.marriageRegistrationDate,
                                  });
                                }}
                              >
                                <CheckCircle size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                                <span className="hidden sm:inline">Verify</span>
                              </Button>
                            )}
                          </>
                        )}
                        {client.application && client.application.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!text-[10px] sm:!text-xs !px-1.5 sm:!px-2 text-red-600 hover:bg-red-50"
                            onClick={() => {
                              const groomName = client.application?.userDetails
                                ? `${client.application.userDetails.firstName}${client.application.userDetails.lastName ? ' ' + client.application.userDetails.lastName : ''}`
                                : undefined;
                              const brideName = client.application?.partnerForm
                                ? `${client.application.partnerForm.firstName}${client.application.partnerForm.lastName ? ' ' + client.application.partnerForm.lastName : ''}`
                                : undefined;

                              setDeleteModalState({
                                isOpen: true,
                                applicationId: client.application!.id,
                                groomName,
                                brideName,
                              });
                            }}
                            title="Delete Draft"
                          >
                            <Trash2 size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                            <span className="hidden sm:inline">Delete</span>
                          </Button>
                        )}
                      </div>
                    </td>

                    <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm text-gray-600">
                      {client.application?.lastUpdated
                        ? safeFormatDateObject(new Date(client.application.lastUpdated), 'dd-MM-yyyy')
                        : '-'
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {clients.length === 0 && (
          <div className="text-center py-6 sm:py-8 lg:py-12">
            <Users size={32} className="sm:w-12 sm:h-12 text-gray-300 mx-auto mb-2 sm:mb-3 lg:mb-4" />
            <p className="text-xs sm:text-sm text-gray-500">No clients found</p>
          </div>
        )}

        {/* Pagination Controls */}
        {totalCount > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-gray-600">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center sm:justify-start">
              <span>
                Showing <strong className="text-gray-900">{Math.min((page - 1) * limit + 1, totalCount)}</strong> to{' '}
                <strong className="text-gray-900">{Math.min(page * limit, totalCount)}</strong> of{' '}
                <strong className="text-gray-900">{totalCount}</strong> applications
              </span>
              <div className="flex items-center gap-1.5 ml-1 sm:ml-2">
                <span className="text-gray-500 text-xs hidden sm:inline">Per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs focus:ring-1 focus:ring-gold-500 focus:outline-none bg-white"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-wrap justify-center">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="!px-2 sm:!px-2.5 !py-1 text-xs"
              >
                <ChevronLeft size={14} className="mr-0.5 sm:mr-1" />
                Prev
              </Button>

              <div className="flex items-center gap-1">
                {getPageNumbers().map((p, idx) => (
                  typeof p === 'number' ? (
                    <button
                      key={idx}
                      onClick={() => setPage(p)}
                      disabled={isFetching}
                      className={`min-w-[28px] sm:min-w-[32px] h-7 sm:h-8 rounded-lg text-xs font-medium transition-colors ${
                        page === p
                          ? 'bg-gold-500 text-white shadow-sm font-semibold'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </button>
                  ) : (
                    <span key={idx} className="px-1 text-gray-400 select-none">...</span>
                  )
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="!px-2 sm:!px-2.5 !py-1 text-xs"
              >
                Next
                <ChevronRight size={14} className="ml-0.5 sm:ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Comment Modal */}
      {commentModalState.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl transform transition-all">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {commentModalState.comment ? 'Edit Application Note' : 'Add Application Note'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Private Admin Note
                </label>
                <textarea
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent resize-none"
                  placeholder="Enter internal notes about this application..."
                  value={commentModalState.comment}
                  onChange={(e) => setCommentModalState(prev => ({ ...prev, comment: e.target.value }))}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This note is only visible to admins.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setCommentModalState(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateComment}
                  className="flex-1"
                >
                  Save Note
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verify Application Modal */}
      <VerifyApplicationModal
        isOpen={verifyModalState.isOpen}
        onClose={() => setVerifyModalState({ isOpen: false, applicationId: '' })}
        onConfirm={handleVerify}
        applicationId={verifyModalState.applicationId}
        currentCertificateNumber={verifyModalState.certificateNumber}
        currentRegistrationDate={verifyModalState.registrationDate}
        initialCertificateDetails={verifyModalState.certificateDetails}
        marriageDate={verifyModalState.marriageDate}
      />

      {/* Delete Application Confirmation Modal */}
      <DeleteApplicationModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ ...deleteModalState, isOpen: false })}
        onConfirm={() => handleDeleteApplication(deleteModalState.applicationId)}
        applicationId={deleteModalState.applicationId}
        groomName={deleteModalState.groomName}
        brideName={deleteModalState.brideName}
      />
    </div>
  );
};

export default ClientsPage;

