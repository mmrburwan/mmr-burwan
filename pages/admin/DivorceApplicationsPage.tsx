import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminService } from '../../services/admin';
import { DivorceApplication } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import { FileX, Search, Plus, Eye, CheckCircle2, Clock, Calendar, ChevronRight, RefreshCw } from 'lucide-react';
import { safeFormatDate } from '../../utils/dateUtils';
import { useDebounce } from '../../hooks/useDebounce';

interface DivorceApplicationsPageProps {
  isEmbedded?: boolean;
}

const DivorceApplicationsPage: React.FC<DivorceApplicationsPageProps> = ({ isEmbedded = false }) => {
  const navigate = useNavigate();
  const { showToast } = useNotification();

  const [applications, setApplications] = useState<DivorceApplication[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'unverified'>('all');

  const loadApplications = async () => {
    try {
      setIsLoading(true);
      const res = await adminService.getDivorceApplications(page, 15, {
        search: debouncedSearchTerm,
        verified: statusFilter,
      });
      setApplications(res.data);
      setTotalCount(res.count);
    } catch (error: any) {
      console.error('Failed to load divorce applications:', error);
      showToast('Failed to load divorce applications', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [page, debouncedSearchTerm, statusFilter]);

  const getStatusBadge = (app: DivorceApplication) => {
    if (app.verified) {
      return <Badge variant="success">Verified</Badge>;
    }
    if (app.status === 'submitted') {
      return <Badge variant="info">Pending Verification</Badge>;
    }
    if (app.status === 'approved') {
      return <Badge variant="success">Approved</Badge>;
    }
    if (app.status === 'rejected') {
      return <Badge variant="error">Rejected</Badge>;
    }
    return <Badge variant="default">Draft</Badge>;
  };

  return (
    <div className={isEmbedded ? "space-y-4 pt-2" : "space-y-6 max-w-7xl mx-auto pb-12"}>
      {/* Page Header */}
      {!isEmbedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-gold-600 font-medium mb-1">
              <FileX size={16} />
              <span>Admin Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900">
              Divorce Applications
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Manage and verify registered divorce applications ({totalCount} total)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={loadApplications}
              disabled={isLoading}
              size="sm"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate('/admin/create-application?type=divorce')}
              size="sm"
            >
              <Plus size={16} className="mr-1 sm:mr-2" />
              Apply For Divorce
            </Button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by husband, wife, certificate no, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('unverified')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  statusFilter === 'unverified'
                    ? 'bg-white text-amber-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('verified')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  statusFilter === 'verified'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Verified
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Applications Table / Cards */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-gold-600" />
            Loading divorce applications...
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center">
            <FileX size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="text-base font-semibold text-gray-900 mb-1">No divorce applications found</h3>
            <p className="text-xs sm:text-sm text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search query or status filter.'
                : 'Click the button below to register a divorce application.'}
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/admin/divorce/create')}
            >
              <Plus size={16} className="mr-1" />
              Apply For Divorce
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] sm:text-xs">
                <tr>
                  <th className="px-4 py-3 font-semibold">Husband & Wife</th>
                  <th className="px-4 py-3 font-semibold">Divorce Date / Type</th>
                  <th className="px-4 py-3 font-semibold">Certificate No</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applications.map((app) => {
                  const husband = app.userDetails || {};
                  const wife = (app.partnerForm as any) || {};

                  return (
                    <tr
                      key={app.id}
                      onClick={() => navigate(`/admin/divorce/applications/${app.id}`)}
                      className="hover:bg-gold-50/40 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">
                          {husband.firstName} {husband.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          & {wife.firstName} {wife.lastName}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-gray-900">
                          {app.divorceDate ? safeFormatDate(app.divorceDate, 'dd-MM-yyyy') : 'N/A'}
                        </div>
                        <div className="text-xs text-gold-700 font-medium uppercase">
                          {app.divorceType || 'TALAQ'}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {app.certificateNumber ? (
                          <span className="font-mono text-xs font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                            {app.certificateNumber}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Not Assigned</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {getStatusBadge(app)}
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-500">
                        {app.createdAt ? safeFormatDate(app.createdAt, 'dd-MM-yyyy') : 'N/A'}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/admin/divorce/applications/${app.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-gold-600 hover:text-gold-700 font-medium text-xs"
                        >
                          View
                          <ChevronRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default DivorceApplicationsPage;

