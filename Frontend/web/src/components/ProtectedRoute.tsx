import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string | string[];
  requiredPermission?: string;
  fallbackPath?: string;
  showAccessDenied?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredPermission,
  fallbackPath = '/home',
  showAccessDenied = false
}) => {
  const { isAuthenticated, user, hasRole, isLoading } = useAuth();
  const location = useLocation();

  // Show loading state while validating token
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ fontSize: '1.5rem' }}>Loading...</div>
      </div>
    );
  }

  // Check authentication (only after loading is complete)
  if (!isAuthenticated) {
    // Store the attempted location so we can redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!hasRole(roles)) {
      if (showAccessDenied) {
        return (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>Access Denied</h2>
            <p>You don't have permission to access this page.</p>
            <p>Required role: {Array.isArray(requiredRole) ? requiredRole.join(', ') : requiredRole}</p>
            <p>Your role: {user?.role}</p>
            <button onClick={() => window.history.back()}>Go Back</button>
          </div>
        );
      }
      return <Navigate to={fallbackPath} replace />;
    }
  }

  // Check permission (for future use if you implement permission checking)
  // if (requiredPermission && !userHasPermission(user, requiredPermission)) {
  //   return <Navigate to={fallbackPath} replace />;
  // }

  return <>{children}</>;
};

export default ProtectedRoute;

