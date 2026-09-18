import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../../services/admin';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Users, Search, UserPlus, ChevronRight } from 'lucide-react';
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

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteEmail || !user) return;
    
    setIsPromoting(true);
    try {
      await adminService.promoteToAgent(promoteEmail, user.id, user.name || 'Admin');
      showToast('User promoted to agent successfully', 'success');
      setShowPromoteModal(false);
      setPromoteEmail('');
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
          onClick={() => setShowPromoteModal(true)}
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

      {/* Promote Modal */}
      {showPromoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-serif font-bold text-gray-900 mb-4">Add Agent</h2>
            <p className="text-sm text-gray-600 mb-6">
              Enter the email address of an existing user to promote them to the Agent role.
            </p>
            <form onSubmit={handlePromote}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">User Email</label>
                <Input
                  type="email"
                  value={promoteEmail}
                  onChange={(e) => setPromoteEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPromoteModal(false)}
                  disabled={isPromoting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isPromoting}
                >
                  Promote to Agent
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentsPage;
