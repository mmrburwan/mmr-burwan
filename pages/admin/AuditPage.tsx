import React, { useState, useEffect } from 'react';
import { auditService } from '../../services/audit';
import { AuditLog } from '../../types';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import { ShieldCheck, Search } from 'lucide-react';
import { safeFormatDateObject } from '../../utils/dateUtils';

const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState({
    actorRole: 'all',
    action: 'all',
    search: '',
  });

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const auditLogs = await auditService.getLogs();
        setLogs(auditLogs);
        setFilteredLogs(auditLogs);
      } catch (error) {
        console.error('Failed to load audit logs:', error);
      }
    };

    loadLogs();
  }, []);

  useEffect(() => {
    let filtered = logs;

    if (filters.actorRole !== 'all') {
      filtered = filtered.filter((log) => log.actorRole === filters.actorRole);
    }

    if (filters.action !== 'all') {
      filtered = filtered.filter((log) => log.action.includes(filters.action));
    }

    if (filters.search) {
      filtered = filtered.filter(
        (log) =>
          log.actorName.toLowerCase().includes(filters.search.toLowerCase()) ||
          log.action.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  }, [filters, logs]);

  return (
    <div>
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">Audit Logs</h1>
        <p className="text-xs sm:text-sm text-gray-600">View all system activities and changes</p>
      </div>

      <Card className="p-3 sm:p-4 lg:p-6 mb-3 sm:mb-4 lg:mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
          <Input
            placeholder="Search logs..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            leftIcon={<Search size={16} className="sm:w-5 sm:h-5" />}
          />
          <Select
            options={[
              { value: 'all', label: 'All Roles' },
              { value: 'admin', label: 'Admin' },
              { value: 'client', label: 'Client' },
            ]}
            value={filters.actorRole}
            onChange={(e) => setFilters({ ...filters, actorRole: e.target.value })}
          />
          <Select
            options={[
              { value: 'all', label: 'All Actions' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'submitted', label: 'Submitted' },
            ]}
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          />
        </div>
      </Card>

      <Card className="p-3 sm:p-4 lg:p-6">
        <div className="space-y-2 sm:space-y-3 lg:space-y-4">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-2.5 sm:p-3 lg:p-4 bg-gray-50 rounded-lg sm:rounded-xl border-l-4 border-gold-500"
            >
              <div className="flex items-start justify-between mb-1.5 sm:mb-2 gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <ShieldCheck size={16} className="sm:w-5 sm:h-5 text-gold-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-xs sm:text-sm text-gray-900 truncate">{log.actorName}</p>
                    <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500 truncate">{log.action}</p>
                  </div>
                </div>
                <Badge variant={log.actorRole === 'admin' ? 'info' : 'default'} className="!text-[10px] sm:!text-xs flex-shrink-0">
                  {log.actorRole}
                </Badge>
              </div>
              <div className="flex items-center justify-between mt-1.5 sm:mt-2 gap-2">
                <p className="text-[10px] sm:text-xs text-gray-500 truncate min-w-0 flex-1">
                  {log.resourceType}: {log.resourceId}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 flex-shrink-0">
                  {safeFormatDateObject(new Date(log.timestamp), 'MMM d, yyyy HH:mm')}
                </p>
              </div>
            </div>
          ))}
        </div>

        {filteredLogs.length === 0 && (
          <div className="text-center py-6 sm:py-8 lg:py-12">
            <p className="text-xs sm:text-sm text-gray-500">No audit logs found</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AuditPage;

