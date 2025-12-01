import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { notificationService } from '../../services/notifications';

interface NotificationIconProps {
  userId: string;
  onOpenPanel: () => void;
}

const NotificationIcon: React.FC<NotificationIconProps> = ({ userId, onOpenPanel }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const count = await notificationService.getUnreadCount(userId);
        setUnreadCount(count);
      } catch (error) {
        console.error('Failed to load unread count:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUnreadCount();

    // Poll for updates every 30 seconds
    intervalRef.current = setInterval(loadUnreadCount, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [userId]);

  return (
    <button
      onClick={onOpenPanel}
      className="relative p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2"
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      <Bell size={18} className="sm:w-5 sm:h-5" />
      {!isLoading && unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 sm:top-0 sm:right-0 flex items-center justify-center min-w-[14px] sm:min-w-[18px] h-[14px] sm:h-[18px] px-1 sm:px-1.5 bg-rose-500 text-white text-[9px] sm:text-xs font-bold rounded-full border-2 border-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

export default NotificationIcon;

