import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { adminService } from '../../services/admin';
import { certificateService } from '../../services/certificates';
import { Application } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import VerifyApplicationModal from '../../components/admin/VerifyApplicationModal';
import { Users, Search, Eye, MessageSquare, FileCheck, CheckCircle, XCircle, ArrowLeft, FileText } from 'lucide-react';
import { safeFormatDateObject } from '../../utils/dateUtils';
import { useDebounce } from '../../hooks/useDebounce';

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
  const [filteredClients, setFilteredClients] = useState<ClientWithApplication[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [verifiedFilter, setVerifiedFilter] = useState<string>('all'); // 'all', 'verified', 'unverified', 'draft'
  const [isLoading, setIsLoading] = useState(true);
  const [certificatesMap, setCertificatesMap] = useState<Record<string, boolean>>({});
  const [generatingCert, setGeneratingCert] = useState<string | null>(null);
  const [verifyModalState, setVerifyModalState] = useState<{
    isOpen: boolean;
    applicationId: string;
    certificateNumber?: string;
    registrationDate?: string;
  }>({
    isOpen: false,
    applicationId: '',
  });

  useEffect(() => {
    const loadClients = async () => {
      try {
        // Get ALL applications (same as dashboard)
        const applications = await adminService.getAllApplications();

        // Get unique user IDs from all applications
        const userIds = [...new Set(applications.map(app => app.userId))];

        // Fetch user emails in batch
        const emailMap = await adminService.getUserEmails(userIds);

        // Create client entries for EACH application (not grouped by user)
        const clientsData: ClientWithApplication[] = applications.map((application) => ({
          userId: application.userId,
          email: emailMap[application.userId] || 'N/A',
          application,
        }));

        setClients(clientsData);
        setFilteredClients(clientsData);

        // Check which applications have certificates
        const certMap: Record<string, boolean> = {};
        await Promise.all(
          clientsData
            .filter(client => client.application?.verified && client.application?.id)
            .map(async (client) => {
              if (client.application?.id) {
                const cert = await certificateService.getCertificateByApplicationId(client.application.id);
                certMap[client.application.id] = !!cert;
              }
            })
        );
        setCertificatesMap(certMap);
      } catch (error) {
        console.error('Failed to load clients:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadClients();
  }, []);

  const handleVerify = async (certificateNumber: string, registrationDate: string, registrarName: string) => {
    if (!user) return;

    try {
      await adminService.verifyApplication(
        verifyModalState.applicationId,
        user.id,
        user.name || user.email,
        certificateNumber,
        registrationDate,
        registrarName
      );
      showToast('Application verified successfully', 'success');

      // Reload clients - show ALL applications
      const applications = await adminService.getAllApplications();
      const userIds = [...new Set(applications.map(app => app.userId))];
      const emailMap = await adminService.getUserEmails(userIds);
      const clientsData: ClientWithApplication[] = applications.map((application) => ({
        userId: application.userId,
        email: emailMap[application.userId] || 'N/A',
        application,
      }));
      setClients(clientsData);
      setFilteredClients(clientsData);

      // Reload certificate map
      const certMap: Record<string, boolean> = {};
      await Promise.all(
        clientsData
          .filter(client => client.application?.verified && client.application?.id)
          .map(async (client) => {
            if (client.application?.id) {
              const cert = await certificateService.getCertificateByApplicationId(client.application.id);
              certMap[client.application.id] = !!cert;
            }
          })
      );
      setCertificatesMap(certMap);

      setVerifyModalState({ isOpen: false, applicationId: '' });
    } catch (error: any) {
      showToast(error.message || 'Failed to verify application', 'error');
      throw error;
    }
  };

  useEffect(() => {
    let filtered = clients;

    if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.trim().toLowerCase();
      filtered = filtered.filter((client) => {
        // Groom name from userDetails
        const groomFirstName = client.application?.userDetails?.firstName?.trim() || '';
        const groomLastName = client.application?.userDetails?.lastName?.trim() || '';
        const groomName = groomFirstName || groomLastName
          ? `${groomFirstName} ${groomLastName}`.trim().toLowerCase()
          : '';

        // Bride name from partnerForm
        const brideFirstName = client.application?.partnerForm?.firstName?.trim() || '';
        const brideLastName = client.application?.partnerForm?.lastName?.trim() || '';
        const brideName = brideFirstName || brideLastName
          ? `${brideFirstName} ${brideLastName}`.trim().toLowerCase()
          : '';

        // Groom email (user's email)
        const groomEmail = (client.email || '').trim().toLowerCase();

        // Bride email (check if it exists in partnerForm - for future use)
        const brideEmail = ((client.application?.partnerForm as any)?.email || '').trim().toLowerCase();

        // Only check fields that have actual values
        return (
          (groomName && groomName.includes(searchLower)) ||
          (brideName && brideName.includes(searchLower)) ||
          (groomEmail && groomEmail.includes(searchLower)) ||
          (brideEmail && brideEmail.includes(searchLower))
        );
      });
    }

    // Apply verified filter
    if (verifiedFilter !== 'all') {
      if (verifiedFilter === 'verified') {
        filtered = filtered.filter((client) => client.application?.verified === true);
      } else if (verifiedFilter === 'unverified') {
        // Show only submitted applications that are not verified (exclude draft)
        filtered = filtered.filter((client) =>
          client.application &&
          (client.application.status === 'submitted' || client.application.status === 'under_review') &&
          (client.application.verified === false || client.application.verified === undefined)
        );
      } else if (verifiedFilter === 'draft') {
        filtered = filtered.filter((client) => client.application?.status === 'draft');
      }
    }

    setFilteredClients(filtered);
  }, [debouncedSearchTerm, verifiedFilter, clients]);

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
              placeholder="Search by groom/bride name or email..."
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
            <option value="draft">Draft</option>
          </select>
        </div>
      </Card>

      <Card className="p-3 sm:p-4 lg:p-6">
        {/* Mobile Card View */}
        <div className="block sm:hidden space-y-3">
          {filteredClients.map((client) => {
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
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-100 to-gold-200 flex items-center justify-center shadow-sm">
                        <Users size={18} className="text-gold-600" />
                      </div>
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
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Progress</p>
                      {client.application ? (
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-gold-500 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${client.application.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700">{client.application.progress}%</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">-</span>
                      )}
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-1">Updated</p>
                      <p className="text-[10px] font-medium text-gray-700">
                        {client.application?.lastUpdated
                          ? safeFormatDateObject(new Date(client.application.lastUpdated), 'MMM d')
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

                  {/* Action Buttons */}
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
                    {client.application && client.application.status === 'submitted' && (
                      <>
                        {client.application.verified ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="!text-[11px] !px-3 !py-1.5 !rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex-1"
                              onClick={async () => {
                                try {
                                  await adminService.unverifyApplication(
                                    client.application!.id,
                                    user?.id || 'admin-1',
                                    user?.name || 'Admin User'
                                  );
                                  showToast('Application unverified', 'success');
                                  const applications = await adminService.getAllApplications();
                                  const userIds = [...new Set(applications.map(app => app.userId))];
                                  const emailMap = await adminService.getUserEmails(userIds);
                                  const clientsData: ClientWithApplication[] = applications.map((application) => ({
                                    userId: application.userId,
                                    email: emailMap[application.userId] || 'N/A',
                                    application,
                                  }));
                                  setClients(clientsData);
                                  setFilteredClients(clientsData);
                                } catch (error) {
                                  showToast('Failed to unverify application', 'error');
                                  console.error('Failed to unverify:', error);
                                }
                              }}
                            >
                              <XCircle size={14} className="mr-1" />
                              Unverify
                            </Button>
                            {!certificatesMap[client.application.id] && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!text-[11px] !px-3 !py-1.5 !rounded-lg bg-green-50 hover:bg-green-100 text-green-700 flex-1"
                                disabled={generatingCert === client.application.id}
                                onClick={async () => {
                                  if (!user) return;
                                  setGeneratingCert(client.application!.id);
                                  try {
                                    await adminService.generateCertificate(
                                      client.application!.id,
                                      user.id,
                                      user.name || user.email
                                    );
                                    showToast('Certificate generated successfully', 'success');
                                    // Update certificate map
                                    setCertificatesMap(prev => ({
                                      ...prev,
                                      [client.application!.id]: true,
                                    }));
                                  } catch (error: any) {
                                    showToast(error.message || 'Failed to generate certificate', 'error');
                                  } finally {
                                    setGeneratingCert(null);
                                  }
                                }}
                              >
                                <FileText size={14} className="mr-1" />
                                {generatingCert === client.application.id ? 'Generating...' : 'Generate'}
                              </Button>
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
                              });
                            }}
                          >
                            <CheckCircle size={14} className="mr-1" />
                            Verify
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Groom & Bride</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Phone & Email</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Actions</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Progress</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
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
                        <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-gold-100 flex items-center justify-center flex-shrink-0">
                          <Users size={14} className="sm:w-5 sm:h-5 text-gold-600" />
                        </div>
                        <div className="flex flex-col">
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
                        {client.application && client.application.status === 'submitted' && (
                          <>
                            {client.application.verified ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="!text-[10px] sm:!text-xs !px-1.5 sm:!px-2"
                                  onClick={async () => {
                                    try {
                                      await adminService.unverifyApplication(
                                        client.application!.id,
                                        user?.id || 'admin-1',
                                        user?.name || 'Admin User'
                                      );
                                      showToast('Application unverified', 'success');
                                      const applications = await adminService.getAllApplications();
                                      const userIds = [...new Set(applications.map(app => app.userId))];
                                      const emailMap = await adminService.getUserEmails(userIds);
                                      const clientsData: ClientWithApplication[] = applications.map((application) => ({
                                        userId: application.userId,
                                        email: emailMap[application.userId] || 'N/A',
                                        application,
                                      }));
                                      setClients(clientsData);
                                      setFilteredClients(clientsData);
                                    } catch (error) {
                                      showToast('Failed to unverify application', 'error');
                                      console.error('Failed to unverify:', error);
                                    }
                                  }}
                                >
                                  <XCircle size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                                  <span className="hidden sm:inline">Unverify</span>
                                </Button>
                                {!certificatesMap[client.application.id] && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="!text-[10px] sm:!text-xs !px-1.5 sm:!px-2"
                                    disabled={generatingCert === client.application.id}
                                    onClick={async () => {
                                      if (!user) return;
                                      setGeneratingCert(client.application!.id);
                                      try {
                                        await adminService.generateCertificate(
                                          client.application!.id,
                                          user.id,
                                          user.name || user.email
                                        );
                                        showToast('Certificate generated successfully', 'success');
                                        // Update certificate map
                                        setCertificatesMap(prev => ({
                                          ...prev,
                                          [client.application!.id]: true,
                                        }));
                                      } catch (error: any) {
                                        showToast(error.message || 'Failed to generate certificate', 'error');
                                      } finally {
                                        setGeneratingCert(null);
                                      }
                                    }}
                                  >
                                    <FileText size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                                    <span className="hidden sm:inline">
                                      {generatingCert === client.application.id ? 'Generating...' : 'Generate Cert'}
                                    </span>
                                  </Button>
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
                                  });
                                }}
                              >
                                <CheckCircle size={12} className="sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                                <span className="hidden sm:inline">Verify</span>
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4">
                      {client.application ? (
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <div className="w-16 sm:w-20 lg:w-24 bg-gray-200 rounded-full h-1.5 sm:h-2">
                            <div
                              className="bg-gold-500 h-1.5 sm:h-2 rounded-full"
                              style={{ width: `${client.application.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] sm:text-xs text-gray-500">{client.application.progress}%</span>
                        </div>
                      ) : (
                        <span className="text-[10px] sm:text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm text-gray-600">
                      {client.application?.lastUpdated
                        ? safeFormatDateObject(new Date(client.application.lastUpdated), 'MMM d, yyyy')
                        : '-'
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredClients.length === 0 && (
          <div className="text-center py-6 sm:py-8 lg:py-12">
            <Users size={32} className="sm:w-12 sm:h-12 text-gray-300 mx-auto mb-2 sm:mb-3 lg:mb-4" />
            <p className="text-xs sm:text-sm text-gray-500">No clients found</p>
          </div>
        )}
      </Card>

      {/* Verify Application Modal */}
      <VerifyApplicationModal
        isOpen={verifyModalState.isOpen}
        onClose={() => setVerifyModalState({ isOpen: false, applicationId: '' })}
        onConfirm={handleVerify}
        applicationId={verifyModalState.applicationId}
        currentCertificateNumber={verifyModalState.certificateNumber}
        currentRegistrationDate={verifyModalState.registrationDate}
      />
    </div>
  );
};

export default ClientsPage;

