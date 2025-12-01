import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { adminService } from '../../services/admin';
import { applicationService } from '../../services/application';
import { profileService } from '../../services/profile';
import { certificateService } from '../../services/certificates';
import { Application, Profile } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import VerifyApplicationModal from '../../components/admin/VerifyApplicationModal';
import { Users, Search, Eye, MessageSquare, FileCheck, CheckCircle, XCircle, ArrowLeft, FileText } from 'lucide-react';
import { safeFormatDateObject } from '../../utils/dateUtils';

interface ClientWithApplication {
  userId: string;
  email: string;
  profile: Profile | null;
  application: Application | null;
}

const ClientsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientWithApplication[]>([]);
  const [filteredClients, setFilteredClients] = useState<ClientWithApplication[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
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
        const applications = await adminService.getAllApplications();
        
        // Get unique user IDs from applications, excluding mock user IDs
        const mockUserIds = ['user-1', 'admin-1'];
        const userIds = [...new Set(applications.map(app => app.userId))]
          .filter(userId => !mockUserIds.includes(userId));
        
        // Fetch user emails in batch
        const emailMap = await adminService.getUserEmails(userIds);
        
        // Load profiles and applications for each user
        const clientsData = await Promise.all(
          userIds.map(async (userId) => {
            const [profile, application] = await Promise.all([
              profileService.getProfile(userId),
              applicationService.getApplication(userId),
            ]);
            
            return {
              userId,
              email: emailMap[userId] || 'N/A',
              profile,
              application,
            };
          })
        );
        
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

  const handleVerify = async (certificateNumber: string, registrationDate: string) => {
    if (!user) return;
    
    try {
      await adminService.verifyApplication(
        verifyModalState.applicationId,
        user.id,
        user.name || user.email,
        certificateNumber,
        registrationDate
      );
      showToast('Application verified successfully', 'success');
      
      // Reload clients
      const applications = await adminService.getAllApplications();
      const mockUserIds = ['user-1', 'admin-1'];
      const userIds = [...new Set(applications.map(app => app.userId))]
        .filter(userId => !mockUserIds.includes(userId));
      const emailMap = await adminService.getUserEmails(userIds);
      const clientsData = await Promise.all(
        userIds.map(async (userId) => {
          const [profile, application] = await Promise.all([
            profileService.getProfile(userId),
            applicationService.getApplication(userId),
          ]);
          return { 
            userId, 
            email: emailMap[userId] || 'N/A',
            profile, 
            application 
          };
        })
      );
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

    if (searchTerm) {
      filtered = filtered.filter((client) => {
        const name = client.profile 
          ? `${client.profile.firstName} ${client.profile.lastName}`.toLowerCase()
          : '';
        const email = client.email || '';
        return name.includes(searchTerm.toLowerCase()) || 
               email.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    if (statusFilter !== 'all' && statusFilter) {
      filtered = filtered.filter((client) => 
        client.application?.status === statusFilter
      );
    }

    setFilteredClients(filtered);
  }, [searchTerm, statusFilter, clients]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
      approved: 'success',
      submitted: 'info',
      under_review: 'warning',
      rejected: 'error',
      draft: 'default',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
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
              placeholder="Search clients by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={16} className="sm:w-5 sm:h-5" />}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 rounded-lg sm:rounded-xl border border-gray-200 focus:border-gold-500 focus:ring-2 focus:ring-gold-500 focus:outline-none text-xs sm:text-sm w-full sm:w-auto"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </Card>

      <Card className="p-3 sm:p-4 lg:p-6">
        {/* Mobile Card View */}
        <div className="block sm:hidden space-y-2">
          {filteredClients.map((client) => {
            const name = client.profile 
              ? `${client.profile.firstName} ${client.profile.lastName}`
              : 'Unknown User';
            const email = client.email || 'N/A';
            
            return (
              <Card key={client.userId} className="p-3">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center flex-shrink-0">
                        <Users size={14} className="text-gold-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs text-gray-900 truncate">{name}</p>
                        <p className="text-[10px] text-gray-500 truncate">{email}</p>
                      </div>
                    </div>
                    {client.application 
                      ? getStatusBadge(client.application.status)
                      : <Badge variant="default" className="!text-[10px]">No App</Badge>
                    }
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-gray-500 mb-0.5">Verified</p>
                      {client.application?.verified !== undefined ? (
                        <Badge variant={client.application.verified ? 'success' : 'default'} className="!text-[10px]">
                          {client.application.verified ? 'Verified' : 'Unverified'}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-gray-400">-</span>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 mb-0.5">Progress</p>
                      {client.application ? (
                        <div className="flex items-center gap-1">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-gold-500 h-1.5 rounded-full"
                              style={{ width: `${client.application.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-500">{client.application.progress}%</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">-</span>
                      )}
                    </div>
                  </div>
                  {client.application?.lastUpdated && (
                    <div>
                      <p className="text-[10px] text-gray-500 mb-0.5">Last Updated</p>
                      <p className="text-[10px] text-gray-600">{safeFormatDateObject(new Date(client.application.lastUpdated), 'MMM d, yyyy')}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {client.application && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!text-[10px] !px-2 !py-1"
                        onClick={() => {
                          navigate(`/admin/applications/${client.application!.id}`);
                        }}
                      >
                        <Eye size={12} className="mr-0.5" />
                        View
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="!text-[10px] !px-2 !py-1"
                      onClick={() => navigate(`/admin/chat?userId=${client.userId}`)}
                    >
                      <MessageSquare size={12} className="mr-0.5" />
                      Message
                    </Button>
                    {client.application && client.application.status === 'submitted' && (
                      <>
                        {client.application.verified ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="!text-[10px] !px-2 !py-1"
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
                                  const clientsData = await Promise.all(
                                    userIds.map(async (userId) => {
                                      const [profile, application] = await Promise.all([
                                        profileService.getProfile(userId),
                                        applicationService.getApplication(userId),
                                      ]);
                                      return { userId, profile, application };
                                    })
                                  );
                                  setClients(clientsData);
                                  setFilteredClients(clientsData);
                                } catch (error) {
                                  showToast('Failed to unverify application', 'error');
                                  console.error('Failed to unverify:', error);
                                }
                              }}
                            >
                              <XCircle size={12} className="mr-0.5" />
                              Unverify
                            </Button>
                            {!certificatesMap[client.application.id] && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!text-[10px] !px-2 !py-1"
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
                                <FileText size={12} className="mr-0.5" />
                                {generatingCert === client.application.id ? 'Generating...' : 'Generate Cert'}
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!text-[10px] !px-2 !py-1"
                            onClick={() => {
                              setVerifyModalState({
                                isOpen: true,
                                applicationId: client.application!.id,
                                certificateNumber: client.application?.certificateNumber,
                                registrationDate: client.application?.registrationDate,
                              });
                            }}
                          >
                            <CheckCircle size={12} className="mr-0.5" />
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
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Client Name</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Email</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Verified</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Progress</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Last Updated</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const name = client.profile 
                  ? `${client.profile.firstName} ${client.profile.lastName}`
                  : 'Unknown User';
                const email = client.email || 'N/A';
                
                return (
                  <tr key={client.userId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-gold-100 flex items-center justify-center flex-shrink-0">
                          <Users size={14} className="sm:w-5 sm:h-5 text-gold-600" />
                        </div>
                        <span className="font-medium text-[10px] sm:text-xs lg:text-sm text-gray-900 truncate">{name}</span>
                      </div>
                    </td>
                    <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm text-gray-600 truncate max-w-[120px] sm:max-w-none">{email}</td>
                    <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4">
                      {client.application 
                        ? getStatusBadge(client.application.status)
                        : <Badge variant="default" className="!text-[10px] sm:!text-xs">No Application</Badge>
                      }
                    </td>
                    <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4">
                      {client.application?.verified !== undefined ? (
                        <Badge variant={client.application.verified ? 'success' : 'default'} className="!text-[10px] sm:!text-xs">
                          {client.application.verified ? 'Verified' : 'Unverified'}
                        </Badge>
                      ) : (
                        <span className="text-[10px] sm:text-xs text-gray-400">-</span>
                      )}
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
                                      const clientsData = await Promise.all(
                                        userIds.map(async (userId) => {
                                          const [profile, application] = await Promise.all([
                                            profileService.getProfile(userId),
                                            applicationService.getApplication(userId),
                                          ]);
                                          return { userId, profile, application };
                                        })
                                      );
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

