import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { agentService } from '../../services/agent';
import { certificateService } from '../../services/certificates';
import { Application, Certificate } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import DeleteApplicationModal from '../../components/admin/DeleteApplicationModal';
import {
  Users,
  Search,
  Eye,
  FileCheck,
  FileText,
  Trash2,
  StickyNote,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { safeFormatDateObject } from '../../utils/dateUtils';
import { useDebounce } from '../../hooks/useDebounce';
import { downloadCertificate, viewCertificate } from '../../utils/certificateGenerator';

const CircularProgress = ({
  progress,
  size = 48,
  strokeWidth = 3,
  children,
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

const AgentClientsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const navigate = useNavigate();

  const [applications, setApplications] = useState<Application[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const [verifiedFilter, setVerifiedFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [certificatesMap, setCertificatesMap] = useState<Record<string, Certificate | null>>({});

  // Comment Modal state
  const [commentModalState, setCommentModalState] = useState<{
    isOpen: boolean;
    applicationId: string;
    comment: string;
  }>({
    isOpen: false,
    applicationId: '',
    comment: '',
  });

  // Delete Modal state
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    applicationId: string;
    groomName?: string;
    brideName?: string;
  }>({
    isOpen: false,
    applicationId: '',
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const loadApplications = useCallback(async (
    targetPage: number = page,
    targetLimit: number = limit
  ) => {
    if (!user?.id) return;
    setIsFetching(true);
    try {
      const { data, count } = await agentService.getApplications(
        user.id,
        targetPage,
        targetLimit,
        {
          search: debouncedSearchTerm,
          verified: verifiedFilter,
        }
      );

      setApplications(data);
      setTotalCount(count);

      // Fetch certificates for verified applications
      const verifiedAppIds = data
        .filter((app) => app.verified && app.id)
        .map((app) => app.id);

      if (verifiedAppIds.length > 0) {
        try {
          const certMap = await certificateService.getCertificatesByApplicationIds(verifiedAppIds);
          setCertificatesMap(certMap || {});
        } catch (certErr) {
          console.error('Failed to load certificates map:', certErr);
        }
      } else {
        setCertificatesMap({});
      }
    } catch (error) {
      console.error('Failed to load applications:', error);
      showToast('Failed to load applications', 'error');
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [user?.id, page, limit, debouncedSearchTerm, verifiedFilter, showToast]);

  // Reset page to 1 when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, verifiedFilter]);

  // Load applications on change
  useEffect(() => {
    loadApplications(page, limit);
  }, [page, limit, debouncedSearchTerm, verifiedFilter, loadApplications]);

  const handleUpdateComment = async () => {
    if (!user) return;
    try {
      await agentService.updateApplicationComment(
        commentModalState.applicationId,
        commentModalState.comment,
        user.id,
        user.name || user.email || 'Agent'
      );
      showToast('Note updated successfully', 'success');

      setApplications((prev) =>
        prev.map((app) => {
          if (app.id === commentModalState.applicationId) {
            return {
              ...app,
              adminComment: commentModalState.comment,
            };
          }
          return app;
        })
      );

      setCommentModalState({ isOpen: false, applicationId: '', comment: '' });
    } catch (error: any) {
      showToast(error.message || 'Failed to update note', 'error');
    }
  };

  const handleDeleteApplication = async (applicationId: string) => {
    if (!user) return;
    try {
      await agentService.deleteApplication(
        applicationId,
        user.id,
        user.name || user.email || 'Agent'
      );
      showToast('Application deleted successfully', 'success');
      await loadApplications(page, limit);
    } catch (error: any) {
      showToast(error.message || 'Failed to delete application', 'error');
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
      approved: 'success',
      submitted: 'info',
      under_review: 'warning',
      rejected: 'error',
      draft: 'default',
    };
    return <Badge variant={variants[status] || 'default'}>{status.toUpperCase()}</Badge>;
  };

  // Helper for pagination numbers
  const getPageNumbers = () => {
    const delta = 1;
    const range: (number | string)[] = [];
    const left = Math.max(2, page - delta);
    const right = Math.min(totalPages - 1, page + delta);

    range.push(1);
    if (left > 2) range.push('...');
    for (let i = left; i <= right; i++) range.push(i);
    if (right < totalPages - 1) range.push('...');
    if (totalPages > 1) range.push(totalPages);

    return range;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">
            Clients
          </h1>
          <p className="text-xs sm:text-sm text-gray-600">
            View and manage all registered clients and applications under your agency
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => navigate('/agent/create-application')}
          className="w-full sm:w-auto"
        >
          <Plus size={16} className="mr-1.5" />
          New Application
        </Button>
      </div>

      {/* Toolbar / Search & Filter Controls */}
      <Card className="p-3 sm:p-4 lg:p-5 shadow-xs border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gold-500 animate-pulse"></span>
            <p className="text-xs text-gray-600 font-medium">
              Registered Client Applications
            </p>
          </div>
          <div className="text-[11px] sm:text-xs text-gray-500">
            Total Found:{' '}
            <strong className="text-gray-800 font-semibold">{totalCount}</strong>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 lg:gap-4 mt-3">
          <div className="flex-1 min-w-0">
            <Input
              placeholder="Search by groom/bride name, email or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={16} className="sm:w-5 sm:h-5 text-gray-400" />}
            />
          </div>
          <select
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value)}
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border border-gray-200 focus:border-gold-500 focus:ring-2 focus:ring-gold-500 focus:outline-none text-xs sm:text-sm w-full sm:w-auto bg-white"
          >
            <option value="all">All Verification</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="draft">Draft</option>
            <option value="rejected">Rejected Documents</option>
          </select>
        </div>
      </Card>

      {/* Main Table Card */}
      <Card className="p-0 overflow-hidden shadow-sm border border-gray-200">
        {isFetching && (
          <div className="flex items-center justify-center py-2 text-xs text-gold-700 bg-gold-50/80 border-b border-gold-100">
            <Loader2 size={14} className="animate-spin mr-1.5" />
            Loading applications...
          </div>
        )}

        {/* Desktop / Tablet Table View */}
        <div className={`hidden sm:block overflow-x-auto transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/75 text-[11px] uppercase tracking-wider font-semibold text-gray-500">
                <th className="py-3.5 px-4 w-[28%]">Groom & Bride</th>
                <th className="py-3.5 px-4 w-[24%]">Phone & Email</th>
                <th className="py-3.5 px-4 w-[14%]">Status</th>
                <th className="py-3.5 px-4 w-[20%]">Actions</th>
                <th className="py-3.5 px-4 w-[14%]">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users size={32} className="text-gray-300" />
                      <p className="text-sm font-medium text-gray-600">No applications found</p>
                      <p className="text-xs text-gray-400">Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                applications.map((app) => {
                  const groomName = app.userDetails
                    ? `${app.userDetails.firstName}${app.userDetails.lastName ? ' ' + app.userDetails.lastName : ''}`
                    : '-';
                  const brideName = app.partnerForm
                    ? `${app.partnerForm.firstName}${app.partnerForm.lastName ? ' ' + app.partnerForm.lastName : ''}`
                    : '-';
                  const groomPhone = app.userDetails?.mobileNumber || '-';
                  const bridePhone = app.partnerForm?.mobileNumber || '-';
                  const userEmail = app.proxyUserEmail || '-';

                  return (
                    <tr key={app.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Groom & Bride Column */}
                      <td className="py-3 lg:py-4 px-4">
                        <div className="flex items-start gap-3">
                          <CircularProgress
                            progress={app.progress || (app.status === 'approved' || app.verified ? 100 : 70)}
                            size={44}
                          >
                            <div className="w-full h-full rounded-full bg-gold-100 flex items-center justify-center">
                              <Users size={16} className="text-gold-600" />
                            </div>
                          </CircularProgress>

                          <div className="min-w-0 space-y-1">
                            {/* Admin / Agent Note Preview Banner */}
                            {app.adminComment && (
                              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200/80 rounded px-2 py-0.5 max-w-[220px]">
                                <StickyNote size={11} className="text-amber-700 fill-amber-300/40 flex-shrink-0" />
                                <span className="text-[11px] text-amber-900 font-medium truncate" title={app.adminComment}>
                                  {app.adminComment}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs">🤵</span>
                              <span className="font-semibold text-gray-900 text-xs lg:text-sm">
                                {groomName}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs">👰</span>
                              <span className="font-semibold text-gray-900 text-xs lg:text-sm">
                                {brideName}
                              </span>
                            </div>

                            <div className="pt-0.5 flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                <UserCheck size={10} />
                                Client
                              </span>
                              {app.certificateNumber && (
                                <span className="text-[10px] text-gray-500 font-mono">
                                  #{app.certificateNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone & Email Column */}
                      <td className="py-3 lg:py-4 px-4">
                        <div className="space-y-1 text-xs lg:text-sm text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">🤵</span>
                            <span>{groomPhone}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">👰</span>
                            <span>{bridePhone}</span>
                          </div>
                          <div className="text-[11px] lg:text-xs text-gray-500 font-mono truncate max-w-[220px]" title={userEmail}>
                            📧 {userEmail}
                          </div>
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="py-3 lg:py-4 px-4">
                        <div className="flex flex-col gap-1.5">
                          {getStatusBadge(app.status)}
                          {app.verified !== undefined && (
                            <Badge
                              variant={app.verified ? 'success' : 'default'}
                              className="!text-[10px] sm:!text-xs"
                            >
                              {app.verified ? '✓ Verified' : 'Unverified'}
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td className="py-3 lg:py-4 px-4">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                          {/* View Application */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="!text-[10px] sm:!text-xs !px-2"
                            onClick={() => navigate(`/agent/applications/${app.id}`)}
                            title="View application details"
                          >
                            <Eye size={13} className="mr-1 text-gray-600" />
                            <span>View</span>
                          </Button>

                          {/* Note */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`!text-[10px] sm:!text-xs !px-2 ${
                              app.adminComment ? 'text-amber-700 hover:bg-amber-50' : 'text-gray-700'
                            }`}
                            onClick={() =>
                              setCommentModalState({
                                isOpen: true,
                                applicationId: app.id,
                                comment: app.adminComment || '',
                              })
                            }
                            title={app.adminComment || 'Add / View Note'}
                          >
                            <StickyNote
                              size={13}
                              className={`mr-1 ${app.adminComment ? 'fill-current text-amber-600' : ''}`}
                            />
                            <span>Note</span>
                          </Button>

                          {/* View Certificate & Download Certificate */}
                          {(app.verified || certificatesMap[app.id]) && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!text-[10px] sm:!text-xs !px-2 text-blue-600 hover:bg-blue-50"
                                onClick={() => handleViewCertificate(app)}
                                title="View certificate preview"
                              >
                                <FileText size={13} className="mr-1" />
                                <span>View</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!text-[10px] sm:!text-xs !px-2 text-indigo-600 hover:bg-indigo-50"
                                onClick={() => handleDownloadCertificate(app)}
                                title="Download certificate PDF"
                              >
                                <FileCheck size={13} className="mr-1" />
                                <span>Download</span>
                              </Button>
                            </>
                          )}

                          {/* Resume if Draft */}
                          {app.status === 'draft' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!text-[10px] sm:!text-xs !px-2 text-gold-700 hover:bg-gold-50"
                                onClick={() => navigate(`/agent/create-application?resume=${app.id}`)}
                                title="Resume draft application"
                              >
                                <span>Resume</span>
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                className="!text-[10px] sm:!text-xs !px-1.5 text-rose-600 hover:bg-rose-50"
                                onClick={() =>
                                  setDeleteModalState({
                                    isOpen: true,
                                    applicationId: app.id,
                                    groomName,
                                    brideName,
                                  })
                                }
                                title="Delete draft application"
                              >
                                <Trash2 size={13} />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Last Updated Column */}
                      <td className="py-3 lg:py-4 px-4 text-xs lg:text-sm text-gray-600">
                        {app.lastUpdated
                          ? safeFormatDateObject(new Date(app.lastUpdated), 'dd-MM-yyyy')
                          : app.submittedAt
                          ? safeFormatDateObject(new Date(app.submittedAt), 'dd-MM-yyyy')
                          : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className={`block sm:hidden divide-y divide-gray-100 ${isFetching ? 'opacity-60' : ''}`}>
          {applications.length === 0 ? (
            <div className="py-10 text-center text-gray-500">
              <Users size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-medium">No applications found</p>
            </div>
          ) : (
            applications.map((app) => {
              const groomName = app.userDetails
                ? `${app.userDetails.firstName}${app.userDetails.lastName ? ' ' + app.userDetails.lastName : ''}`
                : '-';
              const brideName = app.partnerForm
                ? `${app.partnerForm.firstName}${app.partnerForm.lastName ? ' ' + app.partnerForm.lastName : ''}`
                : '-';
              const groomPhone = app.userDetails?.mobileNumber || '-';
              const bridePhone = app.partnerForm?.mobileNumber || '-';
              const userEmail = app.proxyUserEmail || '-';

              return (
                <div key={app.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CircularProgress
                        progress={app.progress || (app.status === 'approved' || app.verified ? 100 : 70)}
                        size={44}
                      >
                        <div className="w-full h-full rounded-full bg-gold-100 flex items-center justify-center">
                          <Users size={15} className="text-gold-600" />
                        </div>
                      </CircularProgress>
                      <div>
                        <p className="text-[10px] font-medium text-gold-600 uppercase tracking-wide">Couple</p>
                        <span className="text-[10px] font-medium text-blue-600">Client</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(app.status)}
                      {app.verified !== undefined && (
                        <Badge variant={app.verified ? 'success' : 'default'} className="!text-[9px]">
                          {app.verified ? '✓ Verified' : 'Unverified'}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {app.adminComment && (
                    <div className="bg-amber-50 border border-amber-200/80 rounded-lg p-2 flex items-start gap-1.5">
                      <StickyNote size={12} className="text-amber-700 fill-amber-300/40 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-amber-900 font-medium">{app.adminComment}</span>
                    </div>
                  )}

                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">🤵 Groom:</span>
                      <span className="font-semibold text-gray-900">{groomName} ({groomPhone})</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">👰 Bride:</span>
                      <span className="font-semibold text-gray-900">{brideName} ({bridePhone})</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono text-gray-600 border-t border-gray-200/60 pt-1.5">
                      <span className="text-gray-500 font-sans">Email:</span>
                      <span className="truncate max-w-[190px]">{userEmail}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-gray-400">
                      {app.lastUpdated
                        ? safeFormatDateObject(new Date(app.lastUpdated), 'dd-MM-yyyy')
                        : '-'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!text-xs !py-1 !px-2"
                        onClick={() => navigate(`/agent/applications/${app.id}`)}
                      >
                        <Eye size={13} className="mr-1" />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!text-xs !py-1 !px-2"
                        onClick={() =>
                          setCommentModalState({
                            isOpen: true,
                            applicationId: app.id,
                            comment: app.adminComment || '',
                          })
                        }
                      >
                        <StickyNote size={13} className="mr-1" />
                        Note
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Bar */}
        {totalCount > 0 && (
          <div className="px-4 sm:px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>
                Showing{' '}
                <strong className="text-gray-900">
                  {Math.min((page - 1) * limit + 1, totalCount)}
                </strong>
                -
                <strong className="text-gray-900">
                  {Math.min(page * limit, totalCount)}
                </strong>{' '}
                of <strong className="text-gray-900">{totalCount}</strong> applications
              </span>
              <div className="flex items-center gap-1.5 ml-2">
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
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="!px-2 sm:!px-2.5 !py-1 text-xs"
              >
                <ChevronLeft size={14} className="mr-0.5 sm:mr-1" />
                Prev
              </Button>

              <div className="flex items-center gap-1">
                {getPageNumbers().map((p, idx) =>
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
                    <span key={idx} className="px-1 text-gray-400 select-none">
                      ...
                    </span>
                  )
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="!px-2 sm:!px-2.5 !py-1 text-xs"
              >
                Next
                <ChevronRight size={14} className="ml-0.5 sm:ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Note / Comment Modal */}
      {commentModalState.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl transform transition-all">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {commentModalState.comment ? 'Edit Application Note' : 'Add Application Note'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Private Note
                </label>
                <textarea
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent resize-none text-sm"
                  placeholder="Enter internal notes about this client application..."
                  value={commentModalState.comment}
                  onChange={(e) =>
                    setCommentModalState((prev) => ({ ...prev, comment: e.target.value }))
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  Internal notes for tracking this application.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setCommentModalState((prev) => ({ ...prev, isOpen: false }))}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button onClick={handleUpdateComment} className="flex-1">
                  Save Note
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Application Modal */}
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

export default AgentClientsPage;
