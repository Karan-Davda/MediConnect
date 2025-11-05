import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import ClinicOperationsDashboard from '../components/ClinicOperationsDashboard';

const ClinicOperations: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <div style={{
        flex: 1,
        padding: '20px',
        backgroundColor: '#f5f5f5',
        marginLeft: sidebarCollapsed ? '60px' : '250px',
        transition: 'margin-left 0.3s ease'
      }}>
        <ClinicOperationsDashboard />
      </div>
    </div>
  );
};

export default ClinicOperations;
