import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../config/api';
import NotificationDropdown from './NotificationDropdown';
import './NotificationIcon.css';

interface Notification {
  id: string;
  patientId: string;
  type: string;
  title: string;
  message: string;
  labResult: any;
  medicalRecordId: string | null;
  status: 'unread' | 'read';
  createdAt: string;
  readAt: string | null;
}

const NotificationIcon: React.FC = () => {
  const { token, user, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  // Only show for patients
  if (!isAuthenticated || user?.role !== 'patient') {
    return null;
  }

  // Fetch unread count
  const fetchUnreadCount = async () => {
    if (!token) return;

    try {
      const response = await fetch(apiUrl('notifications/unread-count'), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Fetch notifications when dropdown opens
  const fetchNotifications = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch(apiUrl('notifications'), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Poll for unread count every 30 seconds
  useEffect(() => {
    if (isAuthenticated && user?.role === 'patient') {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30 seconds
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user, token]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (showDropdown) {
      fetchNotifications();
    }
  }, [showDropdown]);

  const handleClick = () => {
    setShowDropdown(!showDropdown);
  };

  const handleNotificationRead = async (notificationId: string) => {
    if (!token) return;

    try {
      const response = await fetch(apiUrl(`notifications/${notificationId}/read`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, status: 'read' as const, readAt: new Date().toISOString() } : n
          )
        );
        // Update unread count
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    if (!token) return;

    try {
      const response = await fetch(apiUrl('notifications/read-all'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev =>
          prev.map(n => ({ ...n, status: 'read' as const, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  return (
    <div className="notification-icon-container">
      <button
        className="notification-icon-button"
        onClick={handleClick}
        aria-label="Notifications"
        title="Notifications"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>
      {showDropdown && (
        <NotificationDropdown
          notifications={notifications}
          loading={loading}
          onClose={() => setShowDropdown(false)}
          onNotificationRead={handleNotificationRead}
          onMarkAllRead={handleMarkAllRead}
        />
      )}
    </div>
  );
};

export default NotificationIcon;

