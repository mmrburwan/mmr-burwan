import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  UserPlus,
} from 'lucide-react';

const AgentLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('agent_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const location = useLocation();
  const navigate = useNavigate();

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('agent_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const menuItems = [
    { path: '/agent/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/agent/create-application', icon: UserPlus, label: 'Create Application' },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar - Fixed */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          bg-white border-r border-gray-200
          transform transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-16 lg:md:w-20' : 'w-56 sm:w-60 lg:w-64'}
          flex flex-col h-screen
        `}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo Header */}
          <div className="flex items-center justify-between px-3 sm:px-4 lg:px-5 py-3 sm:py-4 lg:py-5 border-b border-gray-200 flex-shrink-0 min-h-[64px] sm:min-h-[73px]">
            <Link
              to="/agent/dashboard"
              className={`flex items-center gap-2 sm:gap-3 min-w-0 hover:opacity-90 transition-opacity ${
                isCollapsed ? 'justify-center w-full' : ''
              }`}
              title="MMR Burwan Agent Portal"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-md text-white font-serif font-bold text-base sm:text-lg lg:text-xl flex-shrink-0">
                M
              </div>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-serif font-bold text-gray-900 leading-none text-sm sm:text-base lg:text-lg tracking-tight truncate">
                    MMR Burwan
                  </span>
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-blue-600 font-medium mt-0.5">
                    Agent Portal
                  </span>
                </div>
              )}
            </Link>

            {/* Mobile-only close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-gray-500 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-100"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 sm:px-3 py-3 sm:py-4 lg:py-6 space-y-1.5 min-h-0 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/agent/dashboard' && location.pathname.startsWith(item.path));

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  title={isCollapsed ? item.label : undefined}
                  className={`
                    flex items-center rounded-lg sm:rounded-xl transition-all duration-200
                    ${isCollapsed ? 'justify-center p-2.5 sm:p-3' : 'gap-2 sm:gap-3 px-2.5 sm:px-4 py-2 sm:py-2.5 lg:py-3'}
                    ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
                  {!isCollapsed && <span className="text-xs sm:text-sm truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="px-2 sm:px-3 py-2 sm:py-3 lg:py-4 border-t border-gray-200 flex-shrink-0">
            <button
              onClick={handleLogout}
              title={isCollapsed ? 'Logout' : undefined}
              className={`
                w-full flex items-center rounded-lg sm:rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200
                ${isCollapsed ? 'justify-center p-2.5 sm:p-3' : 'gap-2 sm:gap-3 px-2.5 sm:px-4 py-2 sm:py-2.5 lg:py-3'}
              `}
            >
              <LogOut size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-xs sm:text-sm">Logout</span>}
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

      {/* Main Content */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          isCollapsed ? 'md:ml-16 lg:md:ml-20' : 'md:ml-60 lg:ml-64'
        }`}
      >
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 lg:py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2">
            {/* Single Toggle Button: opens/closes on mobile, folds/unfolds on desktop */}
            <button
              onClick={() => {
                if (window.innerWidth < 768) {
                  setSidebarOpen(!sidebarOpen);
                } else {
                  toggleCollapse();
                }
              }}
              className="text-gray-600 hover:text-gray-900 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title={isCollapsed ? 'Unfold sidebar' : 'Fold sidebar'}
              aria-label="Toggle sidebar"
            >
              <Menu size={20} className="sm:w-6 sm:h-6" />
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            <div className="text-xs sm:text-sm text-gray-600">
              <span className="font-medium text-gray-900 truncate max-w-[120px] sm:max-w-none">
                {user?.name || 'Agent'}
              </span>
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

export default AgentLayout;
