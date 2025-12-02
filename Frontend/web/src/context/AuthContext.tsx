import React, { createContext, useState, useContext, useEffect } from 'react';
import { apiUrl } from '../config/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  clinicId?: string;
  profileComplete?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (roles: string[]) => boolean;
  isLoading: boolean; // Add loading state
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start with loading = true

  useEffect(() => {
    // Validate stored token on mount/refresh
    const validateStoredToken = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      // If no token stored, we're done loading immediately
      if (!storedToken || !storedUser) {
        setIsLoading(false);
        return;
      }
      
      try {
        // Validate token with backend
        const response = await fetch(apiUrl('auth/me'), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${storedToken}`,
          },
        });

        if (response.ok) {
          // Token is valid, restore user session
          const userData = await response.json();
          // The /me endpoint returns user data wrapped in { user: {...} }
          const user = userData.user || userData;
          setToken(storedToken);
          setUser(user);
          // Update localStorage with fresh user data
          localStorage.setItem('user', JSON.stringify(user));
        } else {
          // Token is invalid or expired, clear storage
          console.log('Token validation failed, clearing session');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        // Network error or other issue, try to use stored data
        console.warn('Token validation error, using stored data:', error);
        try {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        } catch (parseError) {
          // If stored user data is corrupted, clear it
          console.error('Failed to parse stored user data:', parseError);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      } finally {
        // Mark loading as complete
        setIsLoading(false);
      }
    };

    validateStoredToken();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      let loginUrl = apiUrl('auth/login');
      console.log('🔐 Attempting login to:', loginUrl);

      let response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      // Check response status and content type
      const contentType = response.headers.get('content-type');
      
      // Handle 405 Method Not Allowed - usually means nginx blocking POST or wrong route
      if (response.status === 405) {
        console.warn('⚠️ Received 405 Method Not Allowed. Trying fallback with port 3001...');
        console.error('❌ First attempt failed:', {
          status: response.status,
          statusText: response.statusText,
          contentType,
          url: loginUrl,
          method: 'POST'
        });
        
        // Fallback: Try with port 3001 if we're on AWS/hosting or IP address
        const hostname = window.location.hostname;
        const isIPAddress = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
        const isAWS = hostname.includes('ec2-') || hostname.includes('amazonaws.com');
        if ((isIPAddress || isAWS) && !loginUrl.includes(':3001')) {
          const protocol = window.location.protocol;
          const fallbackUrl = `${protocol}//${hostname}:3001/api/auth/login`;
          console.log('🔄 Retrying with fallback URL:', fallbackUrl);
          
          try {
            response = await fetch(fallbackUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email, password }),
            });
            
            console.log('📡 Fallback response status:', response.status);
            
            // Check if fallback also failed
            if (response.status === 405) {
              throw new Error(`Method Not Allowed (405). The backend server may not be configured to accept POST requests. Check nginx configuration or backend server.`);
            }
            
            const fallbackContentType = response.headers.get('content-type');
            if (!fallbackContentType || !fallbackContentType.includes('application/json')) {
              const fallbackText = await response.text();
              console.error('❌ Fallback also failed:', {
                status: response.status,
                contentType: fallbackContentType,
                url: fallbackUrl,
                preview: fallbackText.substring(0, 200)
              });
              throw new Error(`Backend server not accessible. Check if backend is running on port 3001 and firewall rules allow access. (Status: ${response.status})`);
            }
            
            // Success! Continue with normal flow
            console.log('✅ Fallback succeeded!');
          } catch (fetchError: any) {
            console.error('❌ Fallback fetch failed:', fetchError);
            if (fetchError.message.includes('405') || fetchError.message.includes('Method Not Allowed')) {
              throw fetchError;
            }
            throw new Error(`Cannot connect to backend on port 3001. Check if backend is running and AWS Security Group allows port 3001. Error: ${fetchError.message}`);
          }
        } else {
          throw new Error(`Method Not Allowed (405). Check if nginx is configured to proxy POST requests to /api/* or backend server is running correctly.`);
        }
      }
      
      // Check if response is HTML (error page) instead of JSON
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.warn('⚠️ Received HTML instead of JSON. Trying fallback with port 3001...');
        console.error('❌ First attempt failed:', {
          status: response.status,
          contentType,
          url: loginUrl,
          preview: text.substring(0, 200)
        });
        
        // Fallback: Try with port 3001 if we're on AWS/hosting or IP address
        const hostname = window.location.hostname;
        const isIPAddress = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
        const isAWS = hostname.includes('ec2-') || hostname.includes('amazonaws.com');
        if ((isIPAddress || isAWS) && !loginUrl.includes(':3001')) {
          const protocol = window.location.protocol;
          const fallbackUrl = `${protocol}//${hostname}:3001/api/auth/login`;
          console.log('🔄 Retrying with fallback URL:', fallbackUrl);
          
          response = await fetch(fallbackUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });
          
          const fallbackContentType = response.headers.get('content-type');
          if (!fallbackContentType || !fallbackContentType.includes('application/json')) {
            const fallbackText = await response.text();
            console.error('❌ Fallback also failed:', {
              status: response.status,
              contentType: fallbackContentType,
              url: fallbackUrl,
              preview: fallbackText.substring(0, 200)
            });
            throw new Error(`Backend server not accessible. Check if backend is running on port 3001 and firewall rules allow access. (Status: ${response.status})`);
          }
        } else {
          throw new Error(`Server returned invalid response. Check if backend is running and API URL is correct. (${response.status})`);
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();

      setToken(data.token);
      setUser(data.user);

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (error: any) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch('http://localhost:3001/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  };

  const isAuthenticated = !!user && !!token;

  const hasRole = (roles: string[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, hasRole, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

