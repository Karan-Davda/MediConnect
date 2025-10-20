import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import './Registration.css';

type Account = {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  preferences?: { theme?: string; notifications?: boolean };
};

const defaultAccount: Account = {
  id: '',
  name: '',
  email: '',
  phone: '',
  preferences: { theme: 'light', notifications: true },
};

const Registration: React.FC = () => {
  const [account, setAccount] = useState<Account>(defaultAccount);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setSidebarCollapsed(prev => !prev);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('http://localhost:4000/api/account')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Partial<Account>) => {
        // merge remote values into default shape so form always has fields
        setAccount(prev => ({ ...prev, ...(data || {}) }));
      })
      .catch(err => {
        // keep defaultAccount so form is shown even if backend missing
        console.warn('Account load failed:', err);
        setError('Could not load saved account — showing defaults.');
      })
      .finally(() => setLoading(false));
  }, []);

  function handleChange<K extends keyof Account>(k: K, v: Account[K]) {
    setAccount(prev => ({ ...prev, [k]: v } as Account));
  }

  function save() {
    setSaving(true);
    setError(null);
    fetch('http://localhost:4000/api/account', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account),
    })
      .then(r => {
        if (!r.ok) throw new Error(`Save failed ${r.status}`);
        return r.json();
      })
      .then((data: Account) => setAccount(prev => ({ ...prev, ...data })))
      .catch(err => {
        console.error('Save error', err);
        setError('Save failed — changes kept locally.');
      })
      .finally(() => setSaving(false));
  }

  return (
    <div className="dashboard-container">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="account-page">
          <h2>
            My Account {loading && <small style={{ marginLeft: 8, fontWeight: 400 }}>Loading…</small>}
          </h2>
          {error && <div className="error">{error}</div>}

          <label>
            Name
            <input value={account.name} onChange={e => handleChange('name', e.target.value)} />
          </label>

          <label>
            Email
            <input value={account.email} onChange={e => handleChange('email', e.target.value)} />
          </label>

          <label>
            Phone
            <input value={account.phone || ''} onChange={e => handleChange('phone', e.target.value)} />
          </label>

          <div className="account-row">
            <div className="field">
              <label>
                Theme
                <select
                  value={account.preferences?.theme || 'light'}
                  onChange={e =>
                    handleChange('preferences', { ...(account.preferences || {}), theme: e.target.value })
                  }
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
            </div>

            <div className="field checkbox-row">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!account.preferences?.notifications}
                  onChange={e =>
                    handleChange('preferences', {
                      ...(account.preferences || {}),
                      notifications: e.target.checked,
                    })
                  }
                />
                Notifications
              </label>
            </div>
          </div>

          <div className="actions">
            <button onClick={save} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Registration; 
