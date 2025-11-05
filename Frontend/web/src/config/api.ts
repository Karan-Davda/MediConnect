// API Configuration - Dynamic based on environment
const getApiBaseUrl = (): string => {
  // Check if we have an explicit API URL from environment variable (highest priority)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Auto-detect based on current hostname and location
  const hostname = window.location.hostname;
  const protocol = window.location.protocol; // http: or https:
  const port = window.location.port;
  
  // Production/QA environments (EC2 instances, AWS, or any cloud hosting)
  if (
    hostname.includes('ec2-') || 
    hostname.includes('amazonaws.com') ||
    hostname.includes('elasticbeanstalk.com') ||
    hostname.includes('appspot.com') || // Google Cloud
    hostname.includes('azurewebsites.net') || // Azure
    hostname.includes('cloudapp.net') || // Azure
    hostname.includes('herokuapp.com') || // Heroku
    (!hostname.includes('localhost') && !hostname.includes('127.0.0.1') && !hostname.includes('192.168.') && !hostname.includes('10.') && !hostname.includes('172.'))
  ) {
    // For AWS/hosting with nginx reverse proxy:
    // - Frontend is typically on standard ports (80/443) via nginx
    // - Backend might be:
    //   1. Proxied through nginx on same domain (preferred - no port needed)
    //   2. On same hostname but different port (3001) - fallback if nginx not configured
    //   3. On subdomain (api.hostname.com)
    
    // If no port specified (standard 80/443), try same origin first (nginx proxy)
    // If that fails, fallback to port 3001
    if (!port || port === '80' || port === '443' || port === '') {
      // Try same origin first - nginx will route /api/* to backend if configured
      // If nginx isn't configured, we'll need to use port 3001 as fallback
      // This will be handled by the API call error handling
      return `${protocol}//${hostname}`;
    } else {
      // Frontend on custom port: backend might be on same host, port 3001
      return `${protocol}//${hostname}:3001`;
    }
  }
  
  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Check if backend might be on different port (common in dev)
    // Default to 3000, but can be overridden with env var
    return 'http://localhost:3000';
  }
  
  // Local network (192.168.x.x, 10.x.x.x, etc.)
  if (hostname.match(/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/)) {
    // For local network, assume backend on same host, port 3000 or 3001
    return `${protocol}//${hostname}:3001`;
  }
  
  // Default fallback
  return 'http://localhost:3000';
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function to build full API endpoint
export const apiUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/api/${cleanEndpoint}`;
};

// Export for debugging - always log in QA/Production to help troubleshoot
console.log('🌐 API Configuration:', {
  hostname: window.location.hostname,
  protocol: window.location.protocol,
  port: window.location.port || 'default',
  apiBaseUrl: API_BASE_URL,
  fullUrl: `${API_BASE_URL}/api/auth/login`,
  env: import.meta.env.MODE || 'production'
});

