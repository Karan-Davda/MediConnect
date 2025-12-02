import React from 'react';
import { useNavigate } from 'react-router-dom';
import './NotificationDropdown.css';

interface Notification {
  id: string;
  patientId: string;
  type: string;
  title: string;
  message: string;
  labResult: {
    testName: string;
    result: string;
    status: 'normal' | 'abnormal' | 'critical' | 'pending';
    unit?: string;
    referenceRange?: string;
  } | null;
  medicalRecordId: string | null;
  status: 'unread' | 'read';
  createdAt: string;
  readAt: string | null;
}

interface NotificationDropdownProps {
  notifications: Notification[];
  loading: boolean;
  onClose: () => void;
  onNotificationRead: (id: string) => void;
  onMarkAllRead: () => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  notifications,
  loading,
  onClose,
  onNotificationRead,
  onMarkAllRead,
}) => {
  const navigate = useNavigate();

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (notification.status === 'unread') {
      onNotificationRead(notification.id);
    }

    // Navigate to medical records page
    if (notification.medicalRecordId) {
      navigate(`/medical-records`);
      // Could navigate to specific record if we had a detail page
      // navigate(`/medical-records/${notification.medicalRecordId}`);
    } else {
      navigate('/medical-records');
    }

    onClose();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'critical':
        return 'status-badge critical';
      case 'abnormal':
        return 'status-badge abnormal';
      case 'normal':
        return 'status-badge normal';
      default:
        return 'status-badge';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'critical':
        return 'CRITICAL';
      case 'abnormal':
        return 'ABNORMAL';
      case 'normal':
        return 'NORMAL';
      default:
        return status.toUpperCase();
    }
  };

  return (
    <>
      <div className="notification-dropdown-overlay" onClick={onClose} />
      <div className="notification-dropdown">
        <div className="notification-dropdown-header">
          <h3>Notifications</h3>
          {notifications.length > 0 && (
            <button
              className="mark-all-read-btn"
              onClick={onMarkAllRead}
              title="Mark all as read"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="notification-dropdown-content">
          {loading ? (
            <div className="notification-loading">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">
              <p>No notifications</p>
              <small>You're all caught up!</small>
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.status === 'unread' ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-item-header">
                    <h4>{notification.title}</h4>
                    {notification.labResult && (
                      <span className={getStatusBadgeClass(notification.labResult.status)}>
                        {getStatusText(notification.labResult.status)}
                      </span>
                    )}
                  </div>
                  <p className="notification-message">{notification.message}</p>
                  {notification.labResult && (
                    <div className="notification-lab-details">
                      <span className="lab-test-name">{notification.labResult.testName}</span>
                      {notification.labResult.result && (
                        <span className="lab-result">
                          Result: {notification.labResult.result}
                          {notification.labResult.unit && ` ${notification.labResult.unit}`}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="notification-footer">
                    <span className="notification-date">
                      {new Date(notification.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {notification.status === 'unread' && (
                      <span className="unread-indicator">New</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationDropdown;

