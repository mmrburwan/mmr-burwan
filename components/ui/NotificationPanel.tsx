import React, { useState, useEffect, useRef } from 'react';
import { X, Bell, CheckCircle, XCircle, FileText, Info, Award } from 'lucide-react';
import { notificationService } from '../../services/notifications';
import { Notification } from '../../types';
import Button from './Button';
import NotificationModal from './NotificationModal';
import { safeFormatDate } from '../../utils/dateUtils';

interface NotificationPanelProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ userId, isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    } else {
      // Reset modal state when panel closes
      setIsModalOpen(false);
      setSelectedNotification(null);
    }
  }, [isOpen, userId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close the panel if the modal is open (clicks on modal are outside panelRef)
      if (isModalOpen) return;

      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, isModalOpen]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await notificationService.getNotifications(userId);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
    setIsModalOpen(true);
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
  };

  const truncateText = (text: string, maxLength: number = 100): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead(userId);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'document_rejected':
        return <XCircle size={14} className="sm:w-[18px] sm:h-[18px] text-rose-600" />;
      case 'document_approved':
        return <CheckCircle size={14} className="sm:w-[18px] sm:h-[18px] text-green-600" />;
      case 'application_approved':
        return <CheckCircle size={14} className="sm:w-[18px] sm:h-[18px] text-green-600" />;
      case 'application_rejected':
        return <XCircle size={14} className="sm:w-[18px] sm:h-[18px] text-rose-600" />;
      case 'application_verified':
        return <Award size={14} className="sm:w-[18px] sm:h-[18px] text-gold-600" />;
      default:
        return <Info size={14} className="sm:w-[18px] sm:h-[18px] text-blue-600" />;
    }
  };

  const groupNotificationsByDate = (notifications: Notification[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { label: string; notifications: Notification[] }[] = [
      { label: 'Today', notifications: [] },
      { label: 'Yesterday', notifications: [] },
      { label: 'Older', notifications: [] },
    ];

    notifications.forEach((notification) => {
      const notificationDate = new Date(notification.createdAt);
      notificationDate.setHours(0, 0, 0, 0);

      if (notificationDate.getTime() === today.getTime()) {
        groups[0].notifications.push(notification);
      } else if (notificationDate.getTime() === yesterday.getTime()) {
        groups[1].notifications.push(notification);
      } else {
        groups[2].notifications.push(notification);
      }
    });

    return groups.filter((group) => group.notifications.length > 0);
  };

  if (!isOpen) return null;

  const groupedNotifications = groupNotificationsByDate(notifications);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-2 sm:p-4 pt-14 sm:pt-20 md:pt-24">
      <div className="fixed inset-0 bg-black/10" onClick={() => !isModalOpen && onClose()} />
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-[calc(100vw-1rem)] sm:max-w-md bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-200 animate-fade-up max-h-[calc(100vh-5rem)] sm:max-h-[calc(100vh-8rem)] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 lg:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3">
            <Bell size={16} className="sm:w-5 sm:h-5 text-gold-600" />
            <h2 className="font-serif text-base sm:text-lg lg:text-xl font-semibold text-gray-900">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-1.5 sm:px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] sm:text-xs font-medium rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={18} className="sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Actions */}
        {unreadCount > 0 && (
          <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 border-b border-gray-200 bg-gray-50">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="!text-xs sm:!text-sm text-gray-600 hover:text-gray-900"
            >
              Mark all as read
            </Button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 sm:py-12">
              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-t-2 border-b-2 border-gold-500"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-4 sm:px-6 text-center">
              <Bell size={36} className="sm:w-12 sm:h-12 text-gray-300 mb-3 sm:mb-4" />
              <p className="text-sm sm:text-base text-gray-500 font-medium mb-0.5 sm:mb-1">No notifications</p>
              <p className="text-xs sm:text-sm text-gray-400">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {groupedNotifications.map((group) => (
                <div key={group.label}>
                  <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {group.label}
                    </p>
                  </div>
                  {group.notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`
                        px-3 sm:px-4 lg:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors cursor-pointer
                        ${!notification.read ? 'bg-blue-50/50' : ''}
                      `}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                            <h3
                              className={`text-xs sm:text-sm font-semibold ${!notification.read ? 'text-gray-900' : 'text-gray-700'
                                }`}
                            >
                              {notification.title}
                            </h3>
                            {!notification.read && (
                              <span className="flex-shrink-0 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full mt-1 sm:mt-1.5" />
                            )}
                          </div>
                          <p className="text-[11px] sm:text-sm text-gray-600 mb-1 sm:mb-2 line-clamp-2">
                            {truncateText(notification.message, 100)}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-400">
                            {safeFormatDate(notification.createdAt, 'dd-MM-yyyy HH:mm')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedNotification(null);
        }}
        onNavigate={() => {
          // Close both modal and panel when navigating
          setIsModalOpen(false);
          setSelectedNotification(null);
          onClose();
        }}
        notification={selectedNotification}
        onMarkAsRead={handleMarkAsRead}
      />
    </div>
  );
};

export default NotificationPanel;

