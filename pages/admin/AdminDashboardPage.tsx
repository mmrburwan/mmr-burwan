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
import { Users, FileText, CheckCircle, XCircle, Search, UserPlus, ChevronLeft, ChevronRight, QrCode, CalendarCheck, Award } from 'lucide-react';
import { safeFormatDateObject } from '../../utils/dateUtils';
import { useDebounce } from '../../hooks/useDebounce';

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  // State for data
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, verified: 0, unverified: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // State for pagination and filters
  const [page, setPage] = useState(1);
  const [limit] = useState(10); // Items per page
  const [totalCount, setTotalCount] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [verifiedFilter, setVerifiedFilter] = useState<string>('all'); // 'all', 'verified', 'unverified', 'draft'

  const totalPages = Math.ceil(totalCount / limit);

  // Load Stats (Initial only or on specific actions if needed)
  useEffect(() => {
    const loadStats = async () => {
      try {
        const statsData = await adminService.getApplicationStats();
        setStats(statsData);
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    };
    loadStats();
  }, []); // Run once on mount

  // Load Applications (On filter/page change)
  useEffect(() => {
    const loadApplications = async () => {
      setIsLoading(true);
      try {
        const { data, count } = await adminService.getApplications(page, limit, {
          search: debouncedSearchTerm,
          verified: verifiedFilter
        });
        setApplications(data);
        setTotalCount(count);
      } catch (error) {
        console.error('Failed to load applications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadApplications();
  }, [page, limit, debouncedSearchTerm, verifiedFilter]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, verifiedFilter]);

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

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

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
          className="p-3 sm:p-4 lg:p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] border-l-2 border-l-gray-900"
          onClick={() => {
            setVerifiedFilter('all');
            setSearchTerm('');
          }}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Total Applications</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">{stats.total}</p>
            </div>
            <FileText size={20} className="sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-gold-600 flex-shrink-0" />
          </div>
        </Card>
        <Card
          className="p-3 sm:p-4 lg:p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] border-l-2 border-l-gray-900"
          onClick={() => {
            setVerifiedFilter('unverified'); // 'unverified' in filter logic maps to submitted/under_view pending verification
            // Actually stats.pending maps to status in [submitted, under_review].
            // To emulate "Pending Review" click, we might want 'submitted' filter or similar.
            // Let's assume 'submitted' filter covers pending review items effectively.
            setVerifiedFilter('submitted');
            setSearchTerm('');
          }}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Draft</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                {stats.pending}
              </p>
            </div>
            <Users size={20} className="sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-blue-600 flex-shrink-0" />
          </div>
        </Card>
        <Card
          className="p-3 sm:p-4 lg:p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] border-l-2 border-l-gray-900"
          onClick={() => {
            setVerifiedFilter('verified');
            setSearchTerm('');
          }}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Verified</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                {stats.verified}
              </p>
            </div>
            <CheckCircle size={20} className="sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-green-600 flex-shrink-0" />
          </div>
        </Card>
        <Card
          className="p-3 sm:p-4 lg:p-6 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] border-l-2 border-l-gray-900"
          onClick={() => {
            setVerifiedFilter('unverified');
            setSearchTerm('');
          }}
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-gray-500 mb-0.5 sm:mb-1">Unverified</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                {stats.unverified}
              </p>
            </div>
            <XCircle size={20} className="sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-rose-600 flex-shrink-0" />
          </div>
        </Card>
      </div>

      {/* Quick Action Bar */}
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <h2 className="font-serif text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Create New Application */}
          <button
            onClick={() => navigate('/admin/create-application')}
            className="group p-4 sm:p-5 lg:p-6 bg-white rounded-xl sm:rounded-2xl border border-gray-200 border-l-2 border-l-gray-900 hover:shadow-md transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
          >
            <div className="flex flex-col items-center text-center gap-2 sm:gap-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-rose-50 flex items-center justify-center">
                <UserPlus size={24} className="sm:w-7 sm:h-7 text-rose-600" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-gray-900 leading-tight">Create New Application</span>
            </div>
          </button>

          {/* View Applications */}
          <button
            onClick={() => navigate('/admin/clients')}
            className="group p-4 sm:p-5 lg:p-6 bg-white rounded-xl sm:rounded-2xl border border-gray-200 border-l-2 border-l-gray-900 hover:shadow-md transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2"
          >
            <div className="flex flex-col items-center text-center gap-2 sm:gap-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gold-50 flex items-center justify-center">
                <FileText size={24} className="sm:w-7 sm:h-7 text-gold-600" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-gray-900 leading-tight">View Applications</span>
            </div>
          </button>

          {/* Manage Appointments */}
          <button
            onClick={() => navigate('/admin/appointments')}
            className="group p-4 sm:p-5 lg:p-6 bg-white rounded-xl sm:rounded-2xl border border-gray-200 border-l-2 border-l-gray-900 hover:shadow-md transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <div className="flex flex-col items-center text-center gap-2 sm:gap-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-50 flex items-center justify-center">
                <CalendarCheck size={24} className="sm:w-7 sm:h-7 text-blue-600" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-gray-900 leading-tight">Manage Appointments</span>
            </div>
          </button>

          {/* View Certificates */}
          <button
            onClick={() => navigate('/admin/certificates')}
            className="group p-4 sm:p-5 lg:p-6 bg-white rounded-xl sm:rounded-2xl border border-gray-200 border-l-2 border-l-gray-900 hover:shadow-md transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            <div className="flex flex-col items-center text-center gap-2 sm:gap-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-green-50 flex items-center justify-center">
                <Award size={24} className="sm:w-7 sm:h-7 text-green-600" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-gray-900 leading-tight">View Certificates</span>
            </div>
          </button>

          {/* Scan QR Code */}
          <button
            onClick={() => navigate('/admin/scanner')}
            className="group p-4 sm:p-5 lg:p-6 bg-white rounded-xl sm:rounded-2xl border border-gray-200 border-l-2 border-l-gray-900 hover:shadow-md transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
          >
            <div className="flex flex-col items-center text-center gap-2 sm:gap-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-rose-50 flex items-center justify-center">
                <QrCode size={24} className="sm:w-7 sm:h-7 text-rose-600" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-gray-900 leading-tight">Scan QR Code</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;

