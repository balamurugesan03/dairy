import { useState, useEffect } from 'react';
import { companyAPI } from './api';
import './Dashboard.css';

export default function Dashboard({ user, onLogout }) {
  const [companies, setCompanies] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedCompany,   setSelectedCompany]   = useState(null);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const emptyForm = {
    username: '', password: '',
    companyName: '', businessTypes: [],
    societyName: '', societyCode: '',
    state: '', district: '', address: '',
    phone: '', email: '',
    gstNumber: '', panNumber: '', milmaCode: '',
    dateOfRegistration: '', startDate: '',
    ssiRegistration: '', ssiRegistrationDate: '',
    yearOfAudit: '', auditClassification: ''
  };
  const [formData, setFormData] = useState(emptyForm);
  const [businessCodes, setBusinessCodes] = useState({});  // { 'Dairy Cooperative Society': '143', ... }

  const genCode = () => String(Math.floor(100 + Math.random() * 9000)); // 100–9099

  useEffect(() => { fetchCompanies(); }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await companyAPI.getAll({ all: true });
      if (res.success) setCompanies(res.data || []);
    } catch { setError('Failed to load companies'); }
    setLoading(false);
  };

  const handleInput = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const toggleBizType = (type) => {
    setFormData(p => ({
      ...p,
      businessTypes: p.businessTypes.includes(type)
        ? p.businessTypes.filter(t => t !== type)
        : [...p.businessTypes, type]
    }));
    setBusinessCodes(prev => {
      if (prev[type]) {
        // unchecking — remove code
        const copy = { ...prev };
        delete copy[type];
        return copy;
      }
      // checking — auto-generate code
      return { ...prev, [type]: genCode() };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!formData.companyName.trim()) { setError('Company name is required'); return; }
    if (!formData.businessTypes.length) { setError('Select at least one business type'); return; }
    if (!formData.username.trim()) { setError('Username is required'); return; }
    if (!formData.password || formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    try {
      const res = await companyAPI.create({
        ...formData,
        username: formData.username.trim().toLowerCase(),
        businessCodes,
        dateOfRegistration: formData.dateOfRegistration || undefined,
        startDate: formData.startDate || undefined,
        ssiRegistrationDate: formData.ssiRegistrationDate || undefined,
      });
      if (!res.success) { setError(res.message || 'Failed to create company'); return; }
      setSuccess('Company created successfully!');
      setShowModal(false);
      setFormData(emptyForm);
      setBusinessCodes({});
      fetchCompanies();
    } catch (err) { setError(err.message || 'Failed to create company'); }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    try {
      const res = await companyAPI.update(selectedCompany._id, { password: newPassword });
      if (res.success) {
        setSuccess('Password reset successfully');
        setShowPasswordModal(false);
        setSelectedCompany(null);
        setNewPassword('');
      } else { setError(res.message || 'Failed to reset password'); }
    } catch (err) { setError(err.message || 'Failed to reset password'); }
  };

  const handleToggleStatus = async (company) => {
    const ns = company.status === 'Active' ? 'Inactive' : 'Active';
    if (!confirm(`${ns === 'Inactive' ? 'Deactivate' : 'Activate'} ${company.companyName}?`)) return;
    try {
      const res = await companyAPI.update(company._id, { status: ns });
      if (res.success) { setSuccess(`Company ${ns === 'Active' ? 'activated' : 'deactivated'}`); fetchCompanies(); }
      else setError(res.message || 'Failed');
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (company) => {
    if (!confirm(`Permanently delete "${company.companyName}"?\nThis cannot be undone!`)) return;
    if (!confirm('FINAL WARNING: All data will be deleted. Click OK to proceed.')) return;
    try {
      const res = await companyAPI.delete(company._id);
      if (res.success) { setSuccess(`"${company.companyName}" deleted`); fetchCompanies(); }
      else setError(res.message || 'Failed');
    } catch (err) { setError(err.message); }
  };

  if (loading) return (
    <div className="sa-loading">
      <div className="sa-spinner"></div>
      <p>Loading...</p>
    </div>
  );

  return (
    <div className="sa-dashboard">
      {/* Header */}
      <header className="sa-header">
        <div>
          <h1>Super Admin Dashboard</h1>
          <span className="sa-user-badge">Logged in as: {user?.username}</span>
        </div>
        <button className="sa-btn-logout" onClick={onLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </header>

      {/* Messages */}
      {error   && <div className="sa-msg error"><span>{error}</span><button onClick={() => setError('')}>×</button></div>}
      {success && <div className="sa-msg success"><span>{success}</span><button onClick={() => setSuccess('')}>×</button></div>}

      {/* Stats */}
      <div className="sa-stats">
        <div className="sa-stat">
          <div className="sa-stat-icon purple">🏢</div>
          <div><span className="sa-stat-val">{companies.length}</span><span className="sa-stat-lbl">Total Companies</span></div>
        </div>
        <div className="sa-stat">
          <div className="sa-stat-icon blue">✅</div>
          <div><span className="sa-stat-val">{companies.filter(c => c.status === 'Active').length}</span><span className="sa-stat-lbl">Active Companies</span></div>
        </div>
        <div className="sa-stat">
          <div className="sa-stat-icon red">⛔</div>
          <div><span className="sa-stat-val">{companies.filter(c => c.status !== 'Active').length}</span><span className="sa-stat-lbl">Inactive</span></div>
        </div>
      </div>

      {/* Action bar */}
      <div className="sa-action-bar">
        <h2>Companies</h2>
        <button className="sa-btn-primary" onClick={() => setShowModal(true)}>+ Add Company</button>
      </div>

      {/* Table */}
      <div className="sa-table-wrap">
        <table className="sa-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Company Name</th>
              <th>Business Type</th>
              <th>Username</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c, i) => (
              <tr key={c._id}>
                <td className="sa-td-num">{i + 1}</td>
                <td className="sa-td-name">{c.companyName}</td>
                <td>
                  <div className="sa-types">
                    {c.businessTypes?.map((t, idx) => (
                      <span key={idx} className={`sa-type ${t.includes('Dairy') ? 'dairy' : 'private'}`}>
                        {t.includes('Dairy') ? 'Dairy' : 'Private'}
                      </span>
                    ))}
                  </div>
                </td>
                <td><code className="sa-code">{c.username || '-'}</code></td>
                <td>{c.phone || '-'}</td>
                <td><span className={`sa-status ${c.status?.toLowerCase()}`}>{c.status}</span></td>
                <td>
                  <div className="sa-actions">
                    <button className="sa-icon-btn" title="Reset Password" onClick={() => { setSelectedCompany(c); setShowPasswordModal(true); }}>🔑</button>
                    <button className={`sa-icon-btn ${c.status === 'Active' ? 'warn' : 'ok'}`} title={c.status === 'Active' ? 'Deactivate' : 'Activate'} onClick={() => handleToggleStatus(c)}>
                      {c.status === 'Active' ? '⏸' : '▶️'}
                    </button>
                    <button className="sa-icon-btn danger" title="Delete" onClick={() => handleDelete(c)}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr><td colSpan="7" className="sa-empty">No companies yet. Click "Add Company" to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Company Modal */}
      {showModal && (
        <div className="sa-overlay" onClick={() => setShowModal(false)}>
          <div className="sa-modal large" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-hdr">
              <h2>Add New Company</h2>
              <button onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="sa-modal-body">

              <div className="sa-section">
                <h3>Login Credentials</h3>
                <div className="sa-row2">
                  <div className="sa-fg"><label>Username *</label><input name="username" value={formData.username} onChange={handleInput} placeholder="Login username" /></div>
                  <div className="sa-fg"><label>Password *</label><input name="password" value={formData.password} onChange={handleInput} placeholder="Min 6 characters" /></div>
                </div>
              </div>

              <div className="sa-section">
                <h3>Basic Information</h3>
                <div className="sa-fg"><label>Company Name *</label><input name="companyName" value={formData.companyName} onChange={handleInput} placeholder="Company name" /></div>
                <div className="sa-fg">
                  <label>Business Type *</label>
                  <div className="sa-checks">
                    {['Dairy Cooperative Society', 'Private Firm'].map(type => (
                      <div key={type} className="sa-biz-row">
                        <label className="sa-biz-label">
                          <input
                            type="checkbox"
                            checked={formData.businessTypes.includes(type)}
                            onChange={() => toggleBizType(type)}
                          />
                          {type}
                        </label>
                        {type === 'Private Firm' && formData.businessTypes.includes(type) && (
                          <div className="sa-biz-code">
                            <span className="sa-code-label">Code</span>
                            <input
                              className="sa-code-input"
                              value={businessCodes[type] || ''}
                              onChange={e => setBusinessCodes(p => ({ ...p, [type]: e.target.value }))}
                              placeholder="Code"
                            />
                            <button
                              type="button"
                              className="sa-code-refresh"
                              title="Regenerate code"
                              onClick={() => setBusinessCodes(p => ({ ...p, [type]: genCode() }))}
                            >↺</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="sa-row2">
                  <div className="sa-fg"><label>Society Name</label><input name="societyName" value={formData.societyName} onChange={handleInput} placeholder="Society name" /></div>
                  <div className="sa-fg"><label>Society Code</label><input name="societyCode" value={formData.societyCode} onChange={handleInput} placeholder="Society code" /></div>
                </div>
              </div>

              <div className="sa-section">
                <h3>Contact & Address</h3>
                <div className="sa-row2">
                  <div className="sa-fg"><label>Phone</label><input name="phone" value={formData.phone} onChange={handleInput} placeholder="Phone number" /></div>
                  <div className="sa-fg"><label>Email</label><input type="email" name="email" value={formData.email} onChange={handleInput} placeholder="Email address" /></div>
                </div>
                <div className="sa-row2">
                  <div className="sa-fg"><label>State</label><input name="state" value={formData.state} onChange={handleInput} placeholder="State" /></div>
                  <div className="sa-fg"><label>District</label><input name="district" value={formData.district} onChange={handleInput} placeholder="District" /></div>
                </div>
                <div className="sa-fg"><label>Address</label><textarea name="address" value={formData.address} onChange={handleInput} rows="2" placeholder="Full address" /></div>
              </div>

              <div className="sa-section">
                <h3>Registration Details</h3>
                <div className="sa-row2">
                  <div className="sa-fg"><label>GST Number</label><input name="gstNumber" value={formData.gstNumber} onChange={handleInput} placeholder="GST Number" /></div>
                  <div className="sa-fg"><label>PAN Number</label><input name="panNumber" value={formData.panNumber} onChange={handleInput} placeholder="PAN Number" /></div>
                </div>
                <div className="sa-row2">
                  <div className="sa-fg"><label>Milma Code</label><input name="milmaCode" value={formData.milmaCode} onChange={handleInput} placeholder="Milma Code" /></div>
                  <div className="sa-fg"><label>SSI Registration</label><input name="ssiRegistration" value={formData.ssiRegistration} onChange={handleInput} placeholder="SSI No" /></div>
                </div>
                <div className="sa-row2">
                  <div className="sa-fg"><label>Date of Registration</label><input type="date" name="dateOfRegistration" value={formData.dateOfRegistration} onChange={handleInput} /></div>
                  <div className="sa-fg"><label>Start Date</label><input type="date" name="startDate" value={formData.startDate} onChange={handleInput} /></div>
                </div>
                <div className="sa-row2">
                  <div className="sa-fg"><label>Year of Audit</label><input name="yearOfAudit" value={formData.yearOfAudit} onChange={handleInput} placeholder="e.g. 2023-24" /></div>
                  <div className="sa-fg"><label>Audit Classification</label><input name="auditClassification" value={formData.auditClassification} onChange={handleInput} placeholder="Classification" /></div>
                </div>
              </div>

              <div className="sa-modal-footer">
                <button type="button" className="sa-btn-sec" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="sa-btn-primary">Create Company</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && selectedCompany && (
        <div className="sa-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="sa-modal small" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-hdr">
              <h2>Reset Password</h2>
              <button onClick={() => setShowPasswordModal(false)}>×</button>
            </div>
            <div className="sa-modal-body">
              <p>Company: <strong>{selectedCompany.companyName}</strong></p>
              <p style={{fontSize:12,color:'#9ca3af',marginBottom:16}}>Username: {selectedCompany.username}</p>
              <div className="sa-fg">
                <label>New Password</label>
                <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
              </div>
              <div className="sa-modal-footer">
                <button className="sa-btn-sec" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                <button className="sa-btn-primary" onClick={handleResetPassword}>Reset Password</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
