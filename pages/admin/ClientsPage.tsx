import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { adminService } from '../../services/admin';
import { applicationService } from '../../services/application';
import { profileService } from '../../services/profile';
import { Application, Profile } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import { Users, Search, Eye, MessageSquare, FileCheck, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { safeFormatDateObject } from '../../utils/dateUtils';

interface ClientWithApplication {
  userId: string;
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

  useEffect(() => {
    const loadClients = async () => {
      try {
        const applications = await adminService.getAllApplications();
        
        // Get unique user IDs from applications, excluding mock user IDs
        const mockUserIds = ['user-1', 'admin-1'];
        const userIds = [...new Set(applications.map(app => app.userId))]
          .filter(userId => !mockUserIds.includes(userId));
        
        // Load profiles and applications for each user
        const clientsData = await Promise.all(
          userIds.map(async (userId) => {
            const [profile, application] = await Promise.all([
              profileService.getProfile(userId),
              applicationService.getApplication(userId),
            ]);
            
            return {
              userId,
              profile,
              application,
            };
          })
        );
        
        setClients(clientsData);
        setFilteredClients(clientsData);
      } catch (error) {
        console.error('Failed to load clients:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadClients();
  }, []);

  useEffect(() => {
    let filtered = clients;

    if (searchTerm) {
      filtered = filtered.filter((client) => {
        const name = client.profile 
          ? `${client.profile.firstName} ${client.profile.lastName}`.toLowerCase()
          : '';
        const email = client.profile?.userId || '';
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
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin')}
            className="flex-shrink-0"
          >
            <ArrowLeft size={18} className="mr-2" />
            Back
          </Button>
        </div>
        <h1 className="font-serif text-4xl font-bold text-gray-900 mb-2">Clients</h1>
        <p className="text-gray-600">Manage and view all registered clients</p>
      </div>

      <Card className="p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search clients by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={20} />}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 rounded-xl border border-gray-200 focus:border-gold-500 focus:ring-2 focus:ring-gold-500 focus:outline-none"
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

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Client Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Email</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Verified</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Progress</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Last Updated</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const name = client.profile 
                  ? `${client.profile.firstName} ${client.profile.lastName}`
                  : 'Unknown User';
                const email = client.profile?.userId || 'N/A';
                
                return (
                  <tr key={client.userId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gold-100 flex items-center justify-center">
                          <Users size={20} className="text-gold-600" />
                        </div>
                        <span className="font-medium text-gray-900">{name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">{email}</td>
                    <td className="py-4 px-4">
                      {client.application 
                        ? getStatusBadge(client.application.status)
                        : <Badge variant="default">No Application</Badge>
                      }
                    </td>
                    <td className="py-4 px-4">
                      {client.application?.verified !== undefined ? (
                        <Badge variant={client.application.verified ? 'success' : 'default'}>
                          {client.application.verified ? 'Verified' : 'Unverified'}
                        </Badge>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {client.application ? (
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-gold-500 h-2 rounded-full"
                              style={{ width: `${client.application.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{client.application.progress}%</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">
                      {client.application?.lastUpdated 
                        ? safeFormatDateObject(new Date(client.application.lastUpdated), 'MMM d, yyyy')
                        : '-'
                      }
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        {client.application && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              navigate(`/admin/applications/${client.application!.id}`);
                            }}
                          >
                            <Eye size={16} className="mr-1" />
                            View
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/admin/chat?userId=${client.userId}`)}
                        >
                          <MessageSquare size={16} className="mr-1" />
                          Message
                        </Button>
                        {client.application && client.application.status === 'submitted' && (
                          <>
                            {client.application.verified ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await adminService.unverifyApplication(
                                      client.application!.id,
                                      user?.id || 'admin-1',
                                      user?.name || 'Admin User'
                                    );
                                    showToast('Application unverified', 'success');
                                    // Reload clients
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
                                <XCircle size={16} className="mr-1" />
                                Unverify
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await adminService.verifyApplication(
                                      client.application!.id,
                                      user?.id || 'admin-1',
                                      user?.name || 'Admin User'
                                    );
                                    showToast('Application verified successfully', 'success');
                                    // Reload clients
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
                                    showToast('Failed to verify application', 'error');
                                    console.error('Failed to verify:', error);
                                  }
                                }}
                              >
                                <CheckCircle size={16} className="mr-1" />
                                Verify
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
          <div className="text-center py-12">
            <Users size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No clients found</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ClientsPage;

