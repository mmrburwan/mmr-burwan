import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/admin';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Users, Search, UserPlus, ChevronRight, RefreshCw, ShieldAlert, AlertTriangle } from 'lucide-react';
import { safeFormatDate } from '../../utils/dateUtils';

interface Agent {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

const AgentsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const navigate = useNavigate();
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promoteEmail, setPromoteEmail] = useState('');
  const [isPromoting, setIsPromoting] = useState(false);

  // Captcha & Consent State
  const [captchaCode, setCaptchaCode] = useState('');
  const [typedCaptcha, setTypedCaptcha] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const [showConsentModal, setShowConsentModal] = useState(false);

  const generateCaptcha = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setCaptchaCode(code);
    setCaptchaError('');
    return code;
  };

  const handleOpenPromote = () => {
    setPromoteEmail('');
    setTypedCaptcha('');
    setCaptchaError('');
    generateCaptcha();
    setShowConsentModal(false);
    setShowPromoteModal(true);
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getAgents();
      setAgents(data || []);
    } catch (error: any) {
      console.error('Failed to load agents:', error);
      showToast(error.message || 'Failed to load agents', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToConsent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteEmail.trim()) {
      showToast('Please enter the user email', 'error');
      return;
    }
    
    // Captcha validation
    if (typedCaptcha.trim() !== captchaCode) {
      setCaptchaError('Incorrect verification code. Please enter the 4-digit code shown.');
      generateCaptcha();
      setTypedCaptcha('');
      return;
    }

    setCaptchaError('');
    setShowConsentModal(true);
  };

  const handleConfirmPromote = async () => {
    if (!promoteEmail || !user) return;
    
    setIsPromoting(true);
    try {
      await adminService.promoteToAgent(promoteEmail.trim(), user.id, user.name || 'Admin');
      showToast('User promoted to agent successfully', 'success');
      setShowConsentModal(false);
      setShowPromoteModal(false);
      setPromoteEmail('');
      setTypedCaptcha('');
      setCaptchaError('');
      loadAgents(); // Reload the list
    } catch (error: any) {
      showToast(error.message || 'Failed to promote user', 'error');
    } finally {
      setIsPromoting(false);
    }
  };

  const filteredAgents = agents.filter(agent => 
    agent.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (agent.name && agent.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gray-900 mb-1">Agents</h1>
          <p className="text-sm text-gray-600">Manage agents and view their applications</p>
        </div>
        <Button 
          variant="primary"
          onClick={handleOpenPromote}
        >
          <UserPlus size={18} className="mr-2" />
          Add Agent
        </Button>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search agents by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500 text-sm"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : filteredAgents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Name / Email</th>
                  <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAgents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                          <Users size={16} />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{agent.name || 'No Name'}</div>
                          <div className="text-xs text-gray-500">{agent.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-900">
                        {safeFormatDate(agent.createdAt, 'MMM d, yyyy')}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/agents/${agent.id}`)}
                      >
                        View Dashboard
                        <ChevronRight size={16} className="ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No agents found</h3>
            <p className="text-gray-500">
              {searchQuery ? 'No agents match your search criteria.' : 'There are currently no agents in the system.'}
            </p>
          </div>
        )}
      </Card>

      {/* Step 1: Promote Modal with 4-Digit Captcha */}
      {showPromoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-serif font-bold text-gray-900 mb-2">Add Agent</h2>
            <p className="text-sm text-gray-600 mb-5">
              Enter the email address of an existing user to promote them to the Agent role.
            </p>
            <form onSubmit={handleProceedToConsent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">User Email</label>
                <Input
                  type="email"
                  value={promoteEmail}
                  onChange={(e) => setPromoteEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>

              {/* 4-Digit Captcha Validation */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Security Verification
                  </label>
                  <button
                    type="button"
                    onClick={generateCaptcha}
                    className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-medium transition-colors"
                    title="Generate new code"
                  >
                    <RefreshCw size={13} />
                    <span>Change code</span>
                  </button>
                </div>

                <p className="text-xs text-gray-500">
                  Type the 4-digit code shown below to verify this request:
                </p>

                <div className="flex items-center gap-3">
                  {/* CAPTCHA badge display */}
                  <div className="select-none px-4 py-2 bg-gradient-to-r from-amber-100 via-gray-100 to-amber-50 border-2 border-dashed border-amber-300 rounded-lg shadow-inner font-mono text-2xl font-black tracking-[0.35em] text-gray-800 flex items-center justify-center">
                    <span className="line-through decoration-amber-500/60 decoration-2 select-none">
                      {captchaCode}
                    </span>
                  </div>

                  {/* Input */}
                  <div className="flex-1">
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={typedCaptcha}
                      onChange={(e) => {
                        setTypedCaptcha(e.target.value.replace(/\D/g, '').slice(0, 4));
                        if (captchaError) setCaptchaError('');
                      }}
                      placeholder="4-digit code"
                      className="text-center font-mono text-lg font-bold tracking-widest"
                      required
                    />
                  </div>
                </div>

                {captchaError && (
                  <p className="text-xs font-medium text-red-600 flex items-center gap-1 pt-1">
                    <AlertTriangle size={13} className="shrink-0" />
                    {captchaError}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPromoteModal(false);
                    setShowConsentModal(false);
                    setPromoteEmail('');
                    setTypedCaptcha('');
                    setCaptchaError('');
                  }}
                  disabled={isPromoting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                >
                  Continue
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Step 2: Consent Popup Modal (Yes, Sure on LEFT, No on RIGHT) */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-amber-200">
            {/* Warning Shield */}
            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-4 shadow-sm">
              <ShieldAlert size={28} />
            </div>

            <h3 className="text-xl font-serif font-bold text-gray-900 text-center mb-2">
              Confirm Agent Promotion
            </h3>

            <p className="text-sm text-gray-600 text-center mb-4">
              Are you sure you want to promote <span className="font-semibold text-gray-900">{promoteEmail}</span> to the <span className="font-semibold text-amber-700">Agent</span> role?
            </p>

            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 mb-6 text-xs text-amber-900 leading-relaxed">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-950 block mb-0.5">Important Access Warning:</span>
                  Agents obtain access to the dedicated Agent Portal, allowing them to initiate client applications, handle documents, and represent applicants.
                </div>
              </div>
            </div>

            {/* Crucial: 'Yes, Sure' on the LEFT, 'No' on the RIGHT to manipulate muscle memory */}
            <div className="flex flex-row items-center justify-between gap-3 pt-2 border-t border-gray-100">
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmPromote}
                isLoading={isPromoting}
                disabled={isPromoting}
                className="flex-1 !bg-amber-600 hover:!bg-amber-700 !border-amber-600 text-white font-semibold shadow-md"
              >
                Yes, Sure
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConsentModal(false)}
                disabled={isPromoting}
                className="flex-1 text-gray-700 hover:bg-gray-100 font-medium"
              >
                No
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentsPage;
