import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../../services/admin';
import { Application } from '../../types';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { Search, FileText, CheckCircle, Clock, Users, ArrowRight, Loader2 } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { safeFormatDateObject } from '../../utils/dateUtils';

interface MentionApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (application: Application) => void;
  agentId?: string;
  userId?: string;
  role?: 'admin' | 'agent' | 'client';
}

export const MentionApplicationModal: React.FC<MentionApplicationModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  agentId,
  userId,
  role = 'agent',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<'scoped' | 'all'>(
    agentId || userId ? 'scoped' : 'all'
  );

  const fetchApplications = useCallback(async () => {
    if (!isOpen) return;
    setIsLoading(true);
    try {
      const filters: any = {
        search: debouncedSearch.trim() || undefined,
      };

      if (scopeFilter === 'scoped') {
        if (agentId) {
          filters.agentId = agentId;
        }
      }

      const { data } = await adminService.getApplications(1, 20, filters);
      setApplications(data || []);
    } catch (err) {
      console.error('Failed to load applications for mention:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, debouncedSearch, scopeFilter, agentId]);

  useEffect(() => {
    if (isOpen) {
      fetchApplications();
    }
  }, [isOpen, fetchApplications]);

  const handleSelect = (app: Application) => {
    onSelect(app);
    onClose();
  };

  const getStatusBadge = (app: Application) => {
    if (app.verified) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
          <CheckCircle size={10} />
          Verified
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full capitalize">
        <Clock size={10} />
        {app.status}
      </span>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mention an Application"
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Select an application to attach as an interactive reference in your message. Both you and the other party can click it to view details directly.
        </p>

        {/* Scope toggle if agentId is provided (e.g. for admin) */}
        {role === 'admin' && agentId && (
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit text-xs font-medium">
            <button
              type="button"
              onClick={() => setScopeFilter('scoped')}
              className={`px-3 py-1 rounded-lg transition-all ${
                scopeFilter === 'scoped'
                  ? 'bg-white text-gray-900 shadow-2xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              This Agent's Applications
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all ${
                scopeFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-2xs font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Applications
            </button>
          </div>
        )}

        {/* Search Input */}
        <div className="relative">
          <Input
            placeholder="Search by groom or bride name, phone, certificate #, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search size={16} className="text-gray-400" />}
            autoFocus
          />
        </div>

        {/* Applications List */}
        <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-xs text-gray-500 gap-2">
              <Loader2 size={16} className="animate-spin text-gold-500" />
              Loading applications...
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Users size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-gray-700">No applications found</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Try searching with different keywords or ID numbers
              </p>
            </div>
          ) : (
            applications.map((app) => {
              const groomName = app.userDetails?.firstName
                ? `${app.userDetails.firstName} ${app.userDetails.lastName || ''}`.trim()
                : 'Not specified';
              const brideName = app.partnerForm?.firstName
                ? `${app.partnerForm.firstName} ${app.partnerForm.lastName || ''}`.trim()
                : 'Not specified';

              return (
                <div
                  key={app.id}
                  onClick={() => handleSelect(app)}
                  className="p-3 hover:bg-gold-50/50 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                        🤵 {groomName} & 👰 {brideName}
                      </p>
                      {getStatusBadge(app)}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-gray-500">
                      <span className="font-mono text-gray-400 truncate">
                        ID: #{app.id.slice(0, 8)}
                      </span>
                      {app.certificateNumber && (
                        <span className="text-gold-700 font-medium">
                          Cert: {app.certificateNumber}
                        </span>
                      )}
                      {app.lastUpdated && (
                        <span>
                          {safeFormatDateObject(new Date(app.lastUpdated), 'dd MMM yyyy')}
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="!text-xs !py-1 !px-2.5 flex-shrink-0 group-hover:bg-gold-500 group-hover:text-white group-hover:border-gold-500 transition-colors"
                  >
                    Select
                    <ArrowRight size={12} className="ml-1" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose} className="!text-xs">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
