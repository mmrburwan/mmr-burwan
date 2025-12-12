import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { adminService } from '../../services/admin';
import { applicationService } from '../../services/application';
import { Application } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import { Users, FileText, CheckCircle, XCircle, Search, UserPlus } from 'lucide-react';
import { safeFormatDateObject } from '../../utils/dateUtils';
import { useDebounce } from '../../hooks/useDebounce';

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<Application[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [verifiedFilter, setVerifiedFilter] = useState<string>('all'); // 'all', 'verified', 'unverified', 'draft'
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadApplications = async () => {
      try {
        const apps = await adminService.getAllApplications();
        setApplications(apps);
        setFilteredApplications(apps);
      } catch (error) {
        console.error('Failed to load applications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadApplications();
  }, []);

  useEffect(() => {
    let filtered = applications;

    if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
      filtered = filtered.filter((app) =>
        app.id.toLowerCase().includes(debouncedSearchTerm.trim().toLowerCase())
      );
    }

    // Apply verified filter
    if (verifiedFilter !== 'all') {
      if (verifiedFilter === 'verified') {
        filtered = filtered.filter((app) => app.verified === true);
      } else if (verifiedFilter === 'unverified') {
        // Show only submitted applications that are not verified (exclude draft)
        filtered = filtered.filter((app) =>
          (app.status === 'submitted' || app.status === 'under_review') &&
          (app.verified === false || app.verified === undefined)
        );
      } else if (verifiedFilter === 'submitted') {
        filtered = filtered.filter((app) =>
          app.status === 'submitted' &&
          (app.verified === false || app.verified === undefined)
        );
      } else if (verifiedFilter === 'draft') {
        filtered = filtered.filter((app) => app.status === 'draft');
      }
    }

    setFilteredApplications(filtered);
  }, [debouncedSearchTerm, verifiedFilter, applications]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div>
            <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">Admin Dashboard</h1>
            <p className="text-xs sm:text-sm text-gray-600">Manage marriage registration applications</p>
          </div>
          <Button
            onClick={() => navigate('/admin/create-application')}
            className="w-full sm:w-auto"
          >
            <UserPlus size={16} className="mr-2" />
            Create Application for Offline User
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
        <Card
          className="p-3 sm:p-4 lg:p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
          onClick={() => {
            setVerifiedFilter('all');
            setSearchTerm('');
          }}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Total Applications</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">{applications.length}</p>
            </div>
            <FileText size={20} className="sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-gold-600 flex-shrink-0" />
          </div>
        </Card>
        <Card
          className="p-3 sm:p-4 lg:p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
          onClick={() => {
            setVerifiedFilter('all');
            setSearchTerm('');
          }}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Pending Review</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                {applications.filter((a) => a.status === 'submitted' || a.status === 'under_review').length}
              </p>
            </div>
            <Users size={20} className="sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-blue-600 flex-shrink-0" />
          </div>
        </Card>
        <Card
          className="p-3 sm:p-4 lg:p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
          onClick={() => {
            setVerifiedFilter('verified');
            setStatusFilter('all');
            setSearchTerm('');
          }}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Verified</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                {applications.filter((a) => a.verified === true).length}
              </p>
            </div>
            <CheckCircle size={20} className="sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-green-600 flex-shrink-0" />
          </div>
        </Card>
        <Card
          className="p-3 sm:p-4 lg:p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
          onClick={() => {
            setVerifiedFilter('unverified');
            setStatusFilter('all');
            setSearchTerm('');
          }}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Unverified</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                {applications.filter((a) => a.verified === false || a.verified === undefined).length}
              </p>
            </div>
            <XCircle size={20} className="sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-rose-600 flex-shrink-0" />
          </div>
        </Card>
      </div>

      <Card className="p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 lg:gap-4 mb-3 sm:mb-4 lg:mb-6">
          <div className="flex-1 min-w-0">
            <Input
              placeholder="Search applications..."
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
            <option value="submitted">Submitted</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        {/* Mobile Card View */}
        <div className="block sm:hidden space-y-2">
          {filteredApplications.map((app) => (
            <Card key={app.id} className="p-3">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-gray-500 mb-0.5">Application ID</p>
                    <p className="font-medium text-xs text-gray-900 truncate">{app.id}</p>
                  </div>
                  {getStatusBadge(app.status)}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-gray-500 mb-0.5">Verified</p>
                    {app.verified !== undefined ? (
                      <Badge variant={app.verified ? 'success' : 'default'} className="!text-[10px]">
                        {app.verified ? 'Verified' : 'Unverified'}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-gray-400">-</span>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 mb-0.5">Progress</p>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-gold-500 h-1.5 rounded-full"
                          style={{ width: `${app.progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500">{app.progress}%</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 mb-0.5">Last Updated</p>
                  <p className="text-[10px] text-gray-600">{safeFormatDateObject(new Date(app.lastUpdated), 'MMM d, yyyy')}</p>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!text-[10px] !px-2 !py-1 flex-1"
                    onClick={() => {
                      navigate(`/admin/applications/${app.id}`);
                    }}
                  >
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="!text-[10px] !px-2 !py-1 flex-1"
                    onClick={() => navigate(`/admin/chat?userId=${app.userId}`)}
                  >
                    Message
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Application ID</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Verified</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Progress</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Last Updated</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map((app) => (
                <tr key={app.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4">
                    <span className="font-medium text-[10px] sm:text-xs lg:text-sm text-gray-900 truncate block max-w-[120px] sm:max-w-none">{app.id}</span>
                  </td>
                  <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4">{getStatusBadge(app.status)}</td>
                  <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4">
                    {app.verified !== undefined ? (
                      <Badge variant={app.verified ? 'success' : 'default'} className="!text-[10px] sm:!text-xs">
                        {app.verified ? 'Verified' : 'Unverified'}
                      </Badge>
                    ) : (
                      <span className="text-[10px] sm:text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-16 sm:w-20 lg:w-24 bg-gray-200 rounded-full h-1.5 sm:h-2">
                        <div
                          className="bg-gold-500 h-1.5 sm:h-2 rounded-full"
                          style={{ width: `${app.progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] sm:text-xs text-gray-500">{app.progress}%</span>
                    </div>
                  </td>
                  <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4 text-[10px] sm:text-xs lg:text-sm text-gray-600">
                    {safeFormatDateObject(new Date(app.lastUpdated), 'MMM d, yyyy')}
                  </td>
                  <td className="py-2 sm:py-3 lg:py-4 px-2 sm:px-4">
                    <div className="flex gap-1 sm:gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!text-[10px] sm:!text-xs !px-1.5 sm:!px-2"
                        onClick={() => {
                          navigate(`/admin/applications/${app.id}`);
                        }}
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!text-[10px] sm:!text-xs !px-1.5 sm:!px-2"
                        onClick={() => navigate(`/admin/chat?userId=${app.userId}`)}
                      >
                        Message
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredApplications.length === 0 && (
          <div className="text-center py-6 sm:py-8 lg:py-12">
            <p className="text-xs sm:text-sm text-gray-500">No applications found</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminDashboardPage;

