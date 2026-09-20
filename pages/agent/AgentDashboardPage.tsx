import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { agentService } from '../../services/agent';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import {
  Users,
  FileText,
  Plus,
  Clock,
  CheckCircle,
  ChevronRight,
  FileEdit,
  ArrowRight
} from 'lucide-react';

const AgentDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const navigate = useNavigate();

  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0, draft: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadStats();
    }
  }, [user?.id]);

  const loadStats = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const statsData = await agentService.getApplicationStats(user.id);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load stats:', error);
      showToast('Failed to load dashboard statistics', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Agent Dashboard</h1>
          <p className="text-sm text-gray-600">Overview of your agency activities and clients</p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => navigate('/agent/clients')}
            className="flex-1 sm:flex-initial"
          >
            <Users size={16} className="mr-1.5" />
            Clients Directory
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/agent/create-application')}
            className="flex-1 sm:flex-initial"
          >
            <Plus size={16} className="mr-1.5" />
            New Application
          </Button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          onClick={() => navigate('/agent/clients')}
          className="p-4 sm:p-5 flex flex-col justify-center border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-700 group-hover:scale-105 transition-transform">
                <FileText size={20} />
              </div>
              <h3 className="font-medium text-gray-600 text-sm">Total Applications</h3>
            </div>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.total}</p>
        </Card>

        <Card
          onClick={() => navigate('/agent/clients')}
          className="p-4 sm:p-5 flex flex-col justify-center border border-gray-200 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700 group-hover:scale-105 transition-transform">
                <CheckCircle size={20} />
              </div>
              <h3 className="font-medium text-gray-600 text-sm">Approved</h3>
            </div>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.approved}</p>
        </Card>

        <Card
          onClick={() => navigate('/agent/clients')}
          className="p-4 sm:p-5 flex flex-col justify-center border border-gray-200 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-700 group-hover:scale-105 transition-transform">
                <Clock size={20} />
              </div>
              <h3 className="font-medium text-gray-600 text-sm">Pending Review</h3>
            </div>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.pending}</p>
        </Card>

        <Card
          onClick={() => navigate('/agent/clients')}
          className="p-4 sm:p-5 flex flex-col justify-center border border-gray-200 hover:border-gray-400 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg text-gray-700 group-hover:scale-105 transition-transform">
                <FileEdit size={20} />
              </div>
              <h3 className="font-medium text-gray-600 text-sm">Drafts</h3>
            </div>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.draft}</p>
        </Card>
      </div>

      {/* Quick Action Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div
          onClick={() => navigate('/agent/clients')}
          className="bg-white p-6 rounded-2xl border border-gray-200 hover:border-gold-400 hover:shadow-lg transition-all cursor-pointer group flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gold-50 border border-gold-200 flex items-center justify-center text-gold-700 group-hover:scale-110 transition-transform">
              <Users size={28} />
            </div>
            <div>
              <h3 className="font-serif font-bold text-gray-900 text-lg group-hover:text-gold-700 transition-colors">
                Clients Directory
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                View, search, filter and manage all your clients' marriage applications with full pagination.
              </p>
            </div>
          </div>
          <div className="flex items-center text-xs font-semibold text-gold-700 group-hover:translate-x-1 transition-transform ml-2">
            <span>Open</span>
            <ArrowRight size={16} className="ml-1" />
          </div>
        </div>

        <div
          onClick={() => navigate('/agent/create-application')}
          className="bg-white p-6 rounded-2xl border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer group flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 group-hover:scale-110 transition-transform">
              <Plus size={28} />
            </div>
            <div>
              <h3 className="font-serif font-bold text-gray-900 text-lg group-hover:text-blue-700 transition-colors">
                Create New Application
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Register a new client account and prepare an offline marriage registration draft application.
              </p>
            </div>
          </div>
          <div className="flex items-center text-xs font-semibold text-blue-700 group-hover:translate-x-1 transition-transform ml-2">
            <span>Start</span>
            <ArrowRight size={16} className="ml-1" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentDashboardPage;
