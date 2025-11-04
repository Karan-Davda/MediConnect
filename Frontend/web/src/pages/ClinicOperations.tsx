import React from 'react';
import Sidebar from '../components/Sidebar';
import ClinicOperationsDashboard from '../components/ClinicOperationsDashboard';

const ClinicOperations: React.FC = () => {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '20px', backgroundColor: '#f5f5f5' }}>
        <ClinicOperationsDashboard />
      </div>
    </div>
  );
};

export default ClinicOperations;
