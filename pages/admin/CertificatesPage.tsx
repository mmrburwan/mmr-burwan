import React, { useState, useEffect } from 'react';
import { certificateService } from '../../services/certificates';
import { notificationService } from '../../services/notifications';
import { adminService } from '../../services/admin';
import { profileService } from '../../services/profile';
import { useNotification } from '../../contexts/NotificationContext';
import { Certificate } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import { FileText, Download, Eye, Users, Calendar, Hash, Lock, Unlock, Search, Filter, X } from 'lucide-react';
import { safeFormatDateObject } from '../../utils/dateUtils';
import { useDebounce } from '../../hooks/useDebounce';

const CertificatesPage: React.FC = () => {
  const { showToast } = useNotification();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [filteredCertificates, setFilteredCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filters, setFilters] = useState({
    downloadPermission: 'all', // 'all', 'enabled', 'disabled'
    issuedDateFrom: '',
    issuedDateTo: '',
    registrationDateFrom: '',
    registrationDateTo: '',
    verificationId: '',
  });

  useEffect(() => {
    const loadCertificates = async () => {
      try {
        setIsLoading(true);
        const certs = await certificateService.getAllCertificates();
        setCertificates(certs);
        setFilteredCertificates(certs);
      } catch (error) {
        console.error('Failed to load certificates:', error);
        showToast('Failed to load certificates', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadCertificates();
  }, [showToast]);

  // Filter certificates based on search and filters
  useEffect(() => {
    let filtered = certificates;

    // Apply search filter
    if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.trim().toLowerCase();
      filtered = filtered.filter((cert) => {
        const groomName = (cert.groomName || '').trim().toLowerCase();
        const brideName = (cert.brideName || '').trim().toLowerCase();
        const certNumber = (cert.certificateNumber || '').trim().toLowerCase();
        const verificationId = (cert.verificationId || '').trim().toLowerCase();

        return (
          (groomName && groomName.includes(searchLower)) ||
          (brideName && brideName.includes(searchLower)) ||
          (certNumber && certNumber.includes(searchLower)) ||
          (verificationId && verificationId.includes(searchLower))
        );
      });
    }

    // Apply advanced filters
    if (filters.downloadPermission !== 'all') {
      filtered = filtered.filter((cert) => {
        if (filters.downloadPermission === 'enabled') {
          return cert.canDownload === true;
        } else if (filters.downloadPermission === 'disabled') {
          return cert.canDownload === false;
        }
        return true;
      });
    }

    if (filters.issuedDateFrom) {
      const fromDate = new Date(filters.issuedDateFrom);
      filtered = filtered.filter((cert) => {
        const issuedDate = new Date(cert.issuedOn);
        return issuedDate >= fromDate;
      });
    }

    if (filters.issuedDateTo) {
      const toDate = new Date(filters.issuedDateTo);
      toDate.setHours(23, 59, 59, 999); // Include the entire day
      filtered = filtered.filter((cert) => {
        const issuedDate = new Date(cert.issuedOn);
        return issuedDate <= toDate;
      });
    }

    if (filters.registrationDateFrom && filters.registrationDateFrom.trim()) {
      const fromDate = new Date(filters.registrationDateFrom);
      filtered = filtered.filter((cert) => {
        if (!cert.registrationDate) return false;
        const regDate = new Date(cert.registrationDate);
        return regDate >= fromDate;
      });
    }

    if (filters.registrationDateTo && filters.registrationDateTo.trim()) {
      const toDate = new Date(filters.registrationDateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((cert) => {
        if (!cert.registrationDate) return false;
        const regDate = new Date(cert.registrationDate);
        return regDate <= toDate;
      });
    }

    if (filters.verificationId && filters.verificationId.trim()) {
      const verificationIdLower = filters.verificationId.trim().toLowerCase();
      filtered = filtered.filter((cert) => {
        return cert.verificationId.toLowerCase().includes(verificationIdLower);
      });
    }

    setFilteredCertificates(filtered);
  }, [debouncedSearchTerm, filters, certificates]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilters({
      downloadPermission: 'all',
      issuedDateFrom: '',
      issuedDateTo: '',
      registrationDateFrom: '',
      registrationDateTo: '',
      verificationId: '',
    });
  };

  const hasActiveFilters = () => {
    return (
      filters.downloadPermission !== 'all' ||
      filters.issuedDateFrom !== '' ||
      filters.issuedDateTo !== '' ||
      filters.registrationDateFrom !== '' ||
      filters.registrationDateTo !== '' ||
      filters.verificationId !== ''
    );
  };

  const handleDownload = async (cert: Certificate) => {
    try {
      const url = await certificateService.getSignedUrl(cert.id);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Marriage-Certificate-${cert.certificateNumber || cert.verificationId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Certificate downloaded successfully', 'success');
    } catch (error) {
      showToast('Failed to generate download link', 'error');
    }
  };

  const handleView = async (cert: Certificate) => {
    try {
      const url = await certificateService.getSignedUrl(cert.id);
      window.open(url, '_blank');
    } catch (error) {
      showToast('Failed to open certificate', 'error');
    }
  };

  const handleToggleDownloadPermission = async (cert: Certificate) => {
    try {
      const newPermission = !cert.canDownload;
      await certificateService.updateDownloadPermission(cert.id, newPermission);

      // Update local state
      setCertificates(prevCerts =>
        prevCerts.map(c =>
          c.id === cert.id ? { ...c, canDownload: newPermission } : c
        )
      );

      // Send notification to user when download permission is enabled
      if (newPermission) {
        try {
          // Get user profile to personalize notification
          const profile = await profileService.getProfile(cert.userId);
          const userName = profile
            ? `${profile.firstName} ${profile.lastName || ''}`.trim() || 'Applicant'
            : 'Applicant';

          // Get certificate number for the notification
          const certNumber = cert.certificateNumber || cert.verificationId;

          await notificationService.createNotification({
            userId: cert.userId,
            applicationId: cert.applicationId,
            type: 'certificate_ready',
            title: '🎉 Certificate Download Enabled!',
            message: `Dear ${userName}, your certificate download permission has been enabled! Certificate Number: ${certNumber}. You can now download your marriage certificate from your dashboard.`,
          });
        } catch (notificationError: any) {
          // Log error but don't fail the toggle - notification is not critical
          console.error('Failed to send download enabled notification:', notificationError);
        }
      }

      showToast(
        newPermission
          ? 'Download permission enabled for user'
          : 'Download permission disabled for user',
        'success'
      );
    } catch (error) {
      console.error('Failed to update download permission:', error);
      showToast('Failed to update download permission', 'error');
    }
  };

  return (
    <div>
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">Verified Certificates</h1>
        <p className="text-xs sm:text-sm text-gray-600">View and download all verified marriage certificates</p>
      </div>

      <Card className="p-3 sm:p-4 lg:p-6 mb-3 sm:mb-4 lg:mb-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="flex-1 min-w-0">
              <Input
                placeholder="Search by groom name, bride name, or certificate number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search size={16} className="sm:w-5 sm:h-5" />}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                className={`flex-shrink-0 ${showAdvancedFilter ? 'bg-gold-50 text-gold-700' : ''}`}
                size="sm"
              >
                <Filter size={16} className="sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">Filters</span>
                {hasActiveFilters() && (
                  <span className="ml-1.5 sm:ml-2 px-1.5 py-0.5 bg-gold-500 text-white text-[10px] sm:text-xs rounded-full">
                    {[
                      filters.downloadPermission !== 'all' ? 1 : 0,
                      filters.issuedDateFrom ? 1 : 0,
                      filters.issuedDateTo ? 1 : 0,
                      filters.registrationDateFrom ? 1 : 0,
                      filters.registrationDateTo ? 1 : 0,
                      filters.verificationId ? 1 : 0,
                    ].reduce((a, b) => a + b, 0)}
                  </span>
                )}
              </Button>
              {hasActiveFilters() && (
                <Button
                  variant="ghost"
                  onClick={handleResetFilters}
                  className="flex-shrink-0"
                  size="sm"
                >
                  <X size={16} className="sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  <span className="hidden sm:inline">Clear</span>
                </Button>
              )}
            </div>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilter && (
            <div className="border-t border-gray-200 pt-3 sm:pt-4 mt-3 sm:mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {/* Download Permission Filter */}
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-2">
                    Download Permission
                  </label>
                  <select
                    value={filters.downloadPermission}
                    onChange={(e) => setFilters({ ...filters, downloadPermission: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 rounded-lg sm:rounded-xl border border-gray-200 focus:border-gold-500 focus:ring-2 focus:ring-gold-500 focus:outline-none text-xs sm:text-sm"
                  >
                    <option value="all">All</option>
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                {/* Verification ID Filter */}
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-2">
                    Verification ID
                  </label>
                  <Input
                    placeholder="Enter verification ID..."
                    value={filters.verificationId}
                    onChange={(e) => setFilters({ ...filters, verificationId: e.target.value })}
                    className="!text-xs sm:!text-sm"
                  />
                </div>

                {/* Issued Date From */}
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-2">
                    Issued Date From
                  </label>
                  <Input
                    type="date"
                    value={filters.issuedDateFrom}
                    onChange={(e) => setFilters({ ...filters, issuedDateFrom: e.target.value })}
                    className="!text-xs sm:!text-sm"
                  />
                </div>

                {/* Issued Date To */}
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-2">
                    Issued Date To
                  </label>
                  <Input
                    type="date"
                    value={filters.issuedDateTo}
                    onChange={(e) => setFilters({ ...filters, issuedDateTo: e.target.value })}
                    className="!text-xs sm:!text-sm"
                  />
                </div>

                {/* Registration Date From */}
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-2">
                    Registration Date From
                  </label>
                  <Input
                    type="date"
                    value={filters.registrationDateFrom}
                    onChange={(e) => setFilters({ ...filters, registrationDateFrom: e.target.value })}
                    className="!text-xs sm:!text-sm"
                  />
                </div>

                {/* Registration Date To */}
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-700 mb-1 sm:mb-2">
                    Registration Date To
                  </label>
                  <Input
                    type="date"
                    value={filters.registrationDateTo}
                    onChange={(e) => setFilters({ ...filters, registrationDateTo: e.target.value })}
                    className="!text-xs sm:!text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-3 sm:p-4 lg:p-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4 lg:mb-6">
          <h3 className="font-semibold text-xs sm:text-sm lg:text-base text-gray-900">
            {hasActiveFilters() || debouncedSearchTerm
              ? `Filtered Certificates (${filteredCertificates.length} of ${certificates.length})`
              : `All Verified Certificates (${certificates.length})`}
          </h3>
        </div>

        {isLoading ? (
          <div className="text-center py-8 sm:py-12 lg:py-16">
            <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-t-2 border-b-2 border-gold-500 mx-auto mb-3 sm:mb-4"></div>
            <p className="text-xs sm:text-sm text-gray-500">Loading certificates...</p>
          </div>
        ) : certificates.length === 0 ? (
          <div className="text-center py-6 sm:py-8 lg:py-12">
            <FileText size={32} className="sm:w-12 sm:h-12 text-gray-300 mx-auto mb-2 sm:mb-3 lg:mb-4" />
            <p className="text-xs sm:text-sm text-gray-500">No verified certificates yet</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-1">Certificates will appear here after applications are verified</p>
          </div>
        ) : filteredCertificates.length === 0 ? (
          <div className="text-center py-6 sm:py-8 lg:py-12">
            <FileText size={32} className="sm:w-12 sm:h-12 text-gray-300 mx-auto mb-2 sm:mb-3 lg:mb-4" />
            <p className="text-xs sm:text-sm text-gray-500">No certificates found</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-1">
              {hasActiveFilters() || debouncedSearchTerm
                ? 'Try adjusting your search or filters'
                : 'Certificates will appear here after applications are verified'}
            </p>
            {(hasActiveFilters() || debouncedSearchTerm) && (
              <Button
                variant="ghost"
                onClick={handleResetFilters}
                className="mt-3 sm:mt-4"
                size="sm"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3 lg:space-y-4">
            {filteredCertificates.map((cert) => (
              <div
                key={cert.id}
                className="p-3 sm:p-4 lg:p-5 bg-gray-50 hover:bg-gray-100 rounded-lg sm:rounded-xl transition-colors border border-gray-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-lg bg-gold-100 flex items-center justify-center flex-shrink-0">
                      <FileText size={20} className="sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-gold-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                        <p className="font-bold text-xs sm:text-sm lg:text-base text-gray-900 uppercase">
                          {cert.groomName && cert.brideName
                            ? `${cert.groomName} & ${cert.brideName}`
                            : cert.groomName || cert.brideName || 'N/A'}
                        </p>
                        <Badge variant="success" className="!text-[10px] sm:!text-xs">
                          Verified
                        </Badge>
                      </div>

                      {cert.certificateNumber && (
                        <div className="flex items-center gap-1.5 mb-1 sm:mb-1.5">
                          <p className="text-[11px] sm:text-sm lg:text-base text-gray-900 font-mono font-bold uppercase tracking-wider">
                            Certificate: {cert.certificateNumber}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="sm:w-3.5 sm:h-3.5 text-gray-400 flex-shrink-0" />
                          <p className="text-[10px] sm:text-xs text-gray-500">
                            Issued: {safeFormatDateObject(new Date(cert.issuedOn), 'dd-MM-yyyy')}
                          </p>
                        </div>
                        {cert.registrationDate && (
                          <div className="flex items-center gap-1.5">
                            <Calendar size={12} className="sm:w-3.5 sm:h-3.5 text-gray-400 flex-shrink-0" />
                            <p className="text-[10px] sm:text-xs text-gray-500">
                              Registered: {safeFormatDateObject(new Date(cert.registrationDate), 'dd-MM-yyyy')}
                            </p>
                          </div>
                        )}
                      </div>

                      <p className="text-[10px] sm:text-xs text-gray-400 mt-1.5 sm:mt-2 truncate">
                        Verification ID: {cert.verificationId}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 sm:ml-4">
                    {/* Download Permission Toggle */}
                    <div className="flex flex-col items-center gap-1 sm:gap-1.5">
                      <button
                        onClick={() => handleToggleDownloadPermission(cert)}
                        className={`
                          relative inline-flex h-6 w-11 sm:h-7 sm:w-12 items-center rounded-full transition-colors
                          focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2
                          ${cert.canDownload ? 'bg-gold-500' : 'bg-gray-300'}
                        `}
                        aria-label={cert.canDownload ? 'Disable download' : 'Enable download'}
                        title={cert.canDownload ? 'User can download - Click to disable' : 'User cannot download - Click to enable'}
                      >
                        <span
                          className={`
                            inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white transition-transform
                            ${cert.canDownload ? 'translate-x-6 sm:translate-x-7' : 'translate-x-1'}
                          `}
                        />
                      </button>
                      <div className="flex items-center gap-1">
                        {cert.canDownload ? (
                          <>
                            <Unlock size={10} className="sm:w-3 sm:h-3 text-gold-600" />
                            <span className="text-[9px] sm:text-[10px] text-gold-600 font-medium">Enabled</span>
                          </>
                        ) : (
                          <>
                            <Lock size={10} className="sm:w-3 sm:h-3 text-gray-400" />
                            <span className="text-[9px] sm:text-[10px] text-gray-400 font-medium">Disabled</span>
                          </>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="!text-[10px] sm:!text-xs !px-2 sm:!px-3"
                      onClick={() => handleView(cert)}
                    >
                      <Eye size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                      <span className="hidden sm:inline">View</span>
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="!text-[10px] sm:!text-xs !px-2 sm:!px-3"
                      onClick={() => handleDownload(cert)}
                    >
                      <Download size={14} className="sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default CertificatesPage;

