import { useState, useEffect } from 'react';
import { Bell, X, CheckCircle2, Trash2 } from 'lucide-react';
import { AdminNotifications } from '@/entities';
import { notificationService } from '@/utils/notificationService';
import { format } from 'date-fns';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotifications[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadNotifications();
    // Refresh notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const unread = await notificationService.getUnreadNotifications();
      setNotifications(unread);
      setUnreadCount(unread.length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    await notificationService.markAsRead(notificationId);
    loadNotifications();
  };

  const handleDelete = async (notificationId: string) => {
    await notificationService.deleteNotification(notificationId);
    loadNotifications();
  };

  const handleMarkAllAsRead = async () => {
    await notificationService.markAllAsRead();
    loadNotifications();
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-primary-foreground hover:opacity-70 transition-opacity"
        aria-label="Notifications"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-destructive text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-secondary rounded-2xl shadow-2xl z-50 border border-secondary-foreground/10">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-secondary-foreground/10">
            <h3 className="font-heading text-lg text-secondary-foreground">
              Notifications
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-secondary-foreground/60 hover:text-secondary-foreground"
            >
              <X size={20} />
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-secondary-foreground/60">
                <p className="font-paragraph text-sm">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={32} className="mx-auto mb-3 text-secondary-foreground/40" />
                <p className="font-paragraph text-sm text-secondary-foreground/60">
                  No new notifications
                </p>
              </div>
            ) : (
              <div className="divide-y divide-secondary-foreground/10">
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className="p-4 hover:bg-primary/5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <p className="font-heading text-sm text-secondary-foreground">
                          {notification.residentName}
                        </p>
                        <p className="font-paragraph text-xs text-secondary-foreground/60 mb-2">
                          {notification.residentEmail}
                        </p>
                        <p className="font-paragraph text-sm text-secondary-foreground/80">
                          {notification.message}
                        </p>
                        <p className="font-paragraph text-xs text-secondary-foreground/50 mt-2">
                          {notification.createdDate
                            ? format(new Date(notification.createdDate), 'MMM dd, yyyy HH:mm')
                            : 'N/A'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleMarkAsRead(notification._id)}
                          className="p-1 text-secondary-foreground/60 hover:text-secondary-foreground transition-colors"
                          title="Mark as read"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(notification._id)}
                          className="p-1 text-secondary-foreground/60 hover:text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-secondary-foreground/10 text-center">
              <button
                onClick={handleMarkAllAsRead}
                className="font-paragraph text-sm text-secondary-foreground hover:opacity-70 transition-opacity"
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
