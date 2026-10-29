import React, { useState, useEffect } from 'react';
import { divorceCertificateService } from '../../services/divorceCertificates';
import { divorceApplicationService } from '../../services/divorceApplication';
import { useNotification } from '../../contexts/NotificationContext';
import { DivorceCertificate } from '../../types';
import { downloadDivorceCertificate, viewDivorceCertificate } from '../../utils/divorceCertificateGenerator';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import {
  FileText,
  Download,
  Eye,
  Calendar,
  Lock,
  Unlock,
  Search,
  RefreshCw,
  FileX,
  Award,
} from 'lucide-react';
import { safeFormatDate } from '../../utils/dateUtils';
import { useDebounce } from '../../hooks/useDebounce';

interface DivorceCertificatesPageProps {
  isEmbedded?: boolean;
}

const DivorceCertificatesPage: React.FC<DivorceCertificatesPageProps> = ({ isEmbedded = false }) => {
  const { showToast } = useNotification();
  const [certificates, setCertificates] = useState<DivorceCertificate[]>([]);
  const [filteredCertificates, setFilteredCertificates] = useState<DivorceCertificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const [downloadPermissionFilter, setDownloadPermissionFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadCertificates = async () => {
    try {
      setIsLoading(true);
      const certs = await divorceCertificateService.getAllDivorceCertificates();
      setCertificates(certs);
      setFilteredCertificates(certs);
    } catch (error: any) {
      console.error('Failed to load divorce certificates:', error);
      showToast('Failed to load certificates', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, []);

  useEffect(() => {
    let filtered = certificates;

    if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.trim().toLowerCase();
      filtered = filtered.filter((cert) => {
        const husband = (cert.husbandName || '').toLowerCase();
        const wife = (cert.wifeName || '').toLowerCase();
        const certNo = (cert.certificateNumber || '').toLowerCase();
        const verId = (cert.verificationId || '').toLowerCase();

        return (
          husband.includes(searchLower) ||
          wife.includes(searchLower) ||
          certNo.includes(searchLower) ||
          verId.includes(searchLower)
        );
      });
    }

    if (downloadPermissionFilter !== 'all') {
      filtered = filtered.filter((cert) => {
        if (downloadPermissionFilter === 'enabled') return cert.canDownload === true;
        if (downloadPermissionFilter === 'disabled') return cert.canDownload === false;
        return true;
      });
    }

    setFilteredCertificates(filtered);
  }, [certificates, debouncedSearchTerm, downloadPermissionFilter]);

  const handleToggleDownload = async (cert: DivorceCertificate) => {
    const newStatus = !cert.canDownload;
    try {
      await divorceCertificateService.updateDownloadPermission(cert.id, newStatus);
      setCertificates((prev) =>
        prev.map((c) => (c.id === cert.id ? { ...c, canDownload: newStatus } : c))
      );
      showToast(
        newStatus ? 'Client download enabled' : 'Client download disabled',
        'success'
      );
    } catch (err: any) {
      console.error('Failed to update download permission:', err);
      showToast('Failed to update permission', 'error');
    }
  };

  const handleView = async (cert: DivorceCertificate) => {
    if (!cert.divorceApplicationId) {
      showToast('No linked divorce application found', 'error');
      return;
    }

    try {
      setActionLoadingId(cert.id);
      const app = await divorceApplicationService.getDivorceApplicationById(cert.divorceApplicationId);
      if (!app) {
        showToast('Application not found', 'error');
        return;
      }
      await viewDivorceCertificate(app);
    } catch (err: any) {
      console.error('Failed to view certificate:', err);
      showToast('Failed to generate preview', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDownload = async (cert: DivorceCertificate) => {
    if (!cert.divorceApplicationId) {
      showToast('No linked divorce application found', 'error');
      return;
    }

    try {
      setActionLoadingId(cert.id);
      const app = await divorceApplicationService.getDivorceApplicationById(cert.divorceApplicationId);
      if (!app) {
        showToast('Application not found', 'error');
        return;
      }
      await downloadDivorceCertificate(app);
      showToast('Divorce certificate downloaded', 'success');
    } catch (err: any) {
      console.error('Failed to download certificate:', err);
      showToast('Failed to download certificate', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className={isEmbedded ? "space-y-4 pt-2" : "space-y-6 max-w-7xl mx-auto pb-12"}>
      {/* Header */}
      {!isEmbedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-gold-600 font-medium mb-1">
              <Award size={16} />
              <span>Admin Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900">
              Divorce Certificates
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Manage verified divorce certificates ({filteredCertificates.length} issued)
            </p>
          </div>

          <div>
            <Button
              variant="secondary"
              onClick={loadCertificates}
              disabled={isLoading}
              size="sm"
            >
              <RefreshCw size={14} className={`mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      )}

      {/* Filter and Search */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by husband, wife, cert number, or verification ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs">
              <button
                type="button"
                onClick={() => setDownloadPermissionFilter('all')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  downloadPermissionFilter === 'all'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setDownloadPermissionFilter('enabled')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  downloadPermissionFilter === 'enabled'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Download Enabled
              </button>
              <button
                type="button"
                onClick={() => setDownloadPermissionFilter('disabled')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  downloadPermissionFilter === 'disabled'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Download Locked
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Certificates List */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-gold-600" />
            Loading certificates...
          </div>
        ) : filteredCertificates.length === 0 ? (
          <div className="p-12 text-center">
            <FileX size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="text-base font-semibold text-gray-900 mb-1">No divorce certificates found</h3>
            <p className="text-xs sm:text-sm text-gray-500">
              Certificates will appear here once divorce applications are verified by admin.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px] sm:text-xs">
                <tr>
                  <th className="px-4 py-3 font-semibold">Husband & Wife</th>
                  <th className="px-4 py-3 font-semibold">Certificate Number</th>
                  <th className="px-4 py-3 font-semibold">Registration Date</th>
                  <th className="px-4 py-3 font-semibold">Client Download</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCertificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-gold-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">
                        {cert.husbandName || 'Husband'}
                      </div>
                      <div className="text-xs text-gray-500">
                        & {cert.wifeName || 'Wife'}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        ID: {cert.verificationId}
                      </div>
                    </td>

                    <td className="px-4 py-3 font-mono font-semibold text-xs text-gray-900">
                      {cert.certificateNumber || 'N/A'}
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-600">
                      {cert.registrationDate ? safeFormatDate(cert.registrationDate, 'dd-MM-yyyy') : 'N/A'}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleDownload(cert)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          cert.canDownload
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title={cert.canDownload ? 'Click to lock client download' : 'Click to enable client download'}
                      >
                        {cert.canDownload ? (
                          <>
                            <Unlock size={12} className="text-emerald-700" />
                            Enabled
                          </>
                        ) : (
                          <>
                            <Lock size={12} className="text-gray-500" />
                            Locked
                          </>
                        )}
                      </button>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(cert)}
                          disabled={actionLoadingId === cert.id}
                          className="!p-1.5 text-gray-600 hover:text-gray-900"
                          title="Preview Certificate"
                        >
                          <Eye size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(cert)}
                          disabled={actionLoadingId === cert.id}
                          className="!p-1.5 text-gold-600 hover:text-gold-800"
                          title="Download Certificate PDF"
                        >
                          <Download size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default DivorceCertificatesPage;

