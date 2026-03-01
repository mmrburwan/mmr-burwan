import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  MessageSquare,
  QrCode,
  ShieldCheck,
  Settings,
  LogOut,
  Menu,
  X,
  UserPlus
} from 'lucide-react';

const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/create-application', icon: UserPlus, label: 'Create Application' },
    { path: '/admin/clients', icon: Users, label: 'Clients' },
    { path: '/admin/appointments', icon: Calendar, label: 'Appointments' },
    { path: '/admin/certificates', icon: FileText, label: 'Certificates' },
    { path: '/admin/chat', icon: MessageSquare, label: 'Messages' },
    { path: '/admin/scanner', icon: QrCode, label: 'QR Scanner' },
    { path: '/admin/audit', icon: ShieldCheck, label: 'Audit Logs' },
    { path: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
      // Navigate anyway to ensure user is redirected
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar - Always fixed, never scrolls */}
      <aside className={`
        fixed inset-y-0 left-0 z-50
        w-56 sm:w-60 lg:w-64 bg-white border-r border-gray-200
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        flex flex-col h-screen
      `}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <Link to="/admin" className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 lg:py-6 border-b border-gray-200 hover:bg-gray-50 transition-colors flex-shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-md text-white font-serif font-bold text-base sm:text-lg lg:text-xl flex-shrink-0">
              M
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-serif font-bold text-gray-900 leading-none text-sm sm:text-base lg:text-lg tracking-tight truncate">MMR Burwan</span>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-gold-600 font-medium">Admin Portal</span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex-1 px-2 sm:px-4 py-3 sm:py-4 lg:py-6 space-y-1.5 sm:space-y-2 min-h-0 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path ||
                (item.path !== '/admin' && location.pathname.startsWith(item.path));

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-2 sm:py-2.5 lg:py-3 rounded-lg sm:rounded-xl
                    transition-all duration-200
                    ${isActive
                      ? 'bg-gold-50 text-gold-700 font-medium shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon size={16} className="sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="text-xs sm:text-sm truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="px-2 sm:px-4 py-2 sm:py-3 lg:py-4 border-t border-gray-200 flex-shrink-0">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-2 sm:py-2.5 lg:py-3 rounded-lg sm:rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200"
            >
              <LogOut size={16} className="sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="text-xs sm:text-sm">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content - Has left margin to account for fixed sidebar on desktop */}
      <div className="flex flex-col min-h-screen md:ml-60 lg:ml-64">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 lg:py-4 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden text-gray-600 hover:text-gray-900 p-1"
          >
            {sidebarOpen ? <X size={20} className="sm:w-6 sm:h-6" /> : <Menu size={20} className="sm:w-6 sm:h-6" />}
          </button>

          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            <div className="text-xs sm:text-sm text-gray-600">
              <span className="font-medium text-gray-900 truncate max-w-[120px] sm:max-w-none">{user?.name || 'Admin User'}</span>
            </div>
          </div>
        </header>

        {/* Page Content - Scrollable */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;

