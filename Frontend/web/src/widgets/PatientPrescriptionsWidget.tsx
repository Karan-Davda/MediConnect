import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../config/api';
import './PatientPrescriptionsWidget.css';

interface Prescription {
  id: string;
  medicationName: string;
  dosage: string;
  dosageUnit: string;
  form: string;
  frequency: string;
  duration: string;
  quantity: number;
  refills: number;
  status: string;
  pharmacyName?: string;
  pharmacyId?: string;
  sentToPharmacyDate?: string;
  filledDate?: string;
  instructions?: string;
  indication?: string;
  providerName: string;
  createdAt: string;
}

interface Props {
  patientId?: string;
}

export default function PatientPrescriptionsWidget({ patientId }: Props) {
  const { token, user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (token && user) {
      fetchPrescriptions();
    }
  }, [token, user, patientId]);

  const fetchPrescriptions = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(apiUrl('prescriptions'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch prescriptions');
      }

      const data = await response.json();
      const prescriptionsArray = Array.isArray(data) ? data : (data.prescriptions || data.data || []);
      
      // Filter to show only recent/active prescriptions (sent or filled, sorted by newest first)
      const recentPrescriptions = prescriptionsArray
        .filter((p: Prescription) => p.status === 'sent' || p.status === 'filled')
        .sort((a: Prescription, b: Prescription) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 5); // Show latest 5 prescriptions
      
      setPrescriptions(recentPrescriptions);
    } catch (err: any) {
      console.error('Error fetching prescriptions:', err);
      setError(err.message || 'Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <span className="status-badge status-sent">Sent to Pharmacy</span>;
      case 'filled':
        return <span className="status-badge status-filled">Filled</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="widget prescriptions-widget">
        <div className="widget-header">
          <span className="widget-icon">💊</span>
          <h3 className="widget-title">New Prescriptions</h3>
        </div>
        <div className="widget-content">
          <div className="loading-message">Loading prescriptions...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="widget prescriptions-widget">
        <div className="widget-header">
          <span className="widget-icon">💊</span>
          <h3 className="widget-title">New Prescriptions</h3>
        </div>
        <div className="widget-content">
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="widget prescriptions-widget">
      <div className="widget-header">
        <span className="widget-icon">💊</span>
        <h3 className="widget-title">New Prescriptions</h3>
      </div>
      <div className="widget-content">
        {prescriptions.length === 0 ? (
          <div className="no-prescriptions">
            <p>No new prescriptions at this time.</p>
          </div>
        ) : (
          <div className="prescriptions-list">
            {prescriptions.map((prescription) => (
              <div key={prescription.id} className="prescription-item">
                <div className="prescription-header-item">
                  <div className="medication-name">{prescription.medicationName}</div>
                  {getStatusBadge(prescription.status)}
                </div>
                <div className="prescription-details-item">
                  <div className="detail-line">
                    <span className="detail-label">Dosage:</span>
                    <span>{prescription.dosage} {prescription.dosageUnit} ({prescription.form})</span>
                  </div>
                  <div className="detail-line">
                    <span className="detail-label">Frequency:</span>
                    <span>{prescription.frequency}</span>
                  </div>
                  <div className="detail-line">
                    <span className="detail-label">Duration:</span>
                    <span>{prescription.duration}</span>
                  </div>
                  {prescription.pharmacyName && (
                    <div className="pharmacy-info">
                      <span className="pharmacy-icon">🏥</span>
                      <div className="pharmacy-details">
                        <div className="pharmacy-label">Pick up at:</div>
                        <div className="pharmacy-name">{prescription.pharmacyName}</div>
                      </div>
                    </div>
                  )}
                  {prescription.instructions && (
                    <div className="instructions">
                      <span className="instructions-label">Instructions:</span>
                      <span>{prescription.instructions}</span>
                    </div>
                  )}
                </div>
                <div className="prescription-footer">
                  <span className="prescribed-by">Prescribed by {prescription.providerName}</span>
                  <span className="prescription-date">
                    {new Date(prescription.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
