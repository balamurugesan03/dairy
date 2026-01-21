import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { companyAPI } from '../services/api';
import './SuperAdminDashboard.css';

const SuperAdminDashboard = () => {
  const { user, logout } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state for adding company
  const [formData, setFormData] = useState({
    // Login credentials
    username: '',
    password: '',
    // Company details
    companyName: '',
    businessTypes: [],
    societyName: '',
    societyCode: '',
    state: '',
    district: '',
    address: '',
    phone: '',
    email: '',
    gstNumber: '',
    panNumber: '',
    milmaCode: '',
    dateOfRegistration: '',
    startDate: '',
    ssiRegistration: '',
    ssiRegistrationDate: '',
    yearOfAudit: '',
    auditClassification: ''
  });

  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      // Fetch all companies including inactive ones for admin view
      const response = await companyAPI.getAll({ all: true });
      if (response.success) {
        setCompanies(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
      setError('Failed to load companies');
    }
    setLoading(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBusinessTypeChange = (type) => {
    setFormData(prev => {
      const types = prev.businessTypes.includes(type)
        ? prev.businessTypes.filter(t => t !== type)
        : [...prev.businessTypes, type];
      return { ...prev, businessTypes: types };
    });
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      companyName: '',
      businessTypes: [],
      societyName: '',
      societyCode: '',
      state: '',
      district: '',
      address: '',
      phone: '',
      email: '',
      gstNumber: '',
      panNumber: '',
      milmaCode: '',
      dateOfRegistration: '',
      startDate: '',
      ssiRegistration: '',
      ssiRegistrationDate: '',
      yearOfAudit: '',
      auditClassification: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!formData.companyName.trim()) {
      setError('Company name is required');
      return;
    }
    if (formData.businessTypes.length === 0) {
      setError('Select at least one business type');
      return;
    }
    if (!formData.username.trim()) {
      setError('Username is required');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      // Create company with login credentials
      const companyData = {
        username: formData.username.trim().toLowerCase(),
        password: formData.password,
        companyName: formData.companyName.trim(),
        businessTypes: formData.businessTypes,
        societyName: formData.societyName,
        societyCode: formData.societyCode,
        state: formData.state,
        district: formData.district,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        gstNumber: formData.gstNumber,
        panNumber: formData.panNumber,
        milmaCode: formData.milmaCode,
        dateOfRegistration: formData.dateOfRegistration || undefined,
        startDate: formData.startDate || undefined,
        ssiRegistration: formData.ssiRegistration,
        ssiRegistrationDate: formData.ssiRegistrationDate || undefined,
        yearOfAudit: formData.yearOfAudit,
        auditClassification: formData.auditClassification
      };

      const response = await companyAPI.create(companyData);

      if (!response.success) {
        setError(response.message || 'Failed to create company');
        return;
      }

      setSuccess('Company created successfully!');
      setShowModal(false);
      resetForm();
      fetchCompanies();
    } catch (err) {
      setError(err.message || 'Failed to create company');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      const response = await companyAPI.update(selectedCompany._id, {
        password: newPassword
      });
      if (response.success) {
        setSuccess('Password reset successfully');
        setShowPasswordModal(false);
        setSelectedCompany(null);
        setNewPassword('');
      } else {
        setError(response.message || 'Failed to reset password');
      }
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    }
  };

  const handleToggleStatus = async (company) => {
    const newStatus = company.status === 'Active' ? 'Inactive' : 'Active';
    if (!confirm(`Are you sure you want to ${newStatus === 'Inactive' ? 'deactivate' : 'activate'} this company?`)) return;

    try {
      const response = await companyAPI.update(company._id, { status: newStatus });
      if (response.success) {
        setSuccess(`Company ${newStatus === 'Active' ? 'activated' : 'deactivated'} successfully`);
        fetchCompanies();
      } else {
        setError(response.message || 'Failed to update status');
      }
    } catch (err) {
      setError(err.message || 'Failed to update status');
    }
  };

  const handleDeleteCompany = async (company) => {
    if (!confirm(`Are you sure you want to permanently delete "${company.companyName}"?\n\nThis action cannot be undone and will delete all associated data!`)) return;

    // Double confirmation for safety
    if (!confirm(`FINAL WARNING: This will permanently delete the company and ALL its data. Type 'yes' mentally and click OK to proceed.`)) return;

    try {
      const response = await companyAPI.delete(company._id);
      if (response.success) {
        setSuccess(`Company "${company.companyName}" deleted successfully`);
        fetchCompanies();
      } else {
        setError(response.message || 'Failed to delete company');
      }
    } catch (err) {
      setError(err.message || 'Failed to delete company');
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <header className="admin-header">
        <div className="header-left">
          <h1>Super Admin Dashboard</h1>
          <span className="user-badge">Logged in as: {user?.username}</span>
        </div>
        <button className="btn-logout" onClick={logout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </header>

      {/* Messages */}
      {error && (
        <div className="message error">
          <span>{error}</span>
          <button onClick={() => setError('')}>&times;</button>
        </div>
      )}
      {success && (
        <div className="message success">
          <span>{success}</span>
          <button onClick={() => setSuccess('')}>&times;</button>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon company">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18"/>
              <path d="M9 8h1"/>
              <path d="M9 12h1"/>
              <path d="M9 16h1"/>
              <path d="M14 8h1"/>
              <path d="M14 12h1"/>
              <path d="M14 16h1"/>
              <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{companies.length}</span>
            <span className="stat-label">Total Companies</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon user">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{companies.filter(c => c.status === 'Active').length}</span>
            <span className="stat-label">Active Companies</span>
          </div>
        </div>
      </div>

      {/* Add Company Button */}
      <div className="action-bar">
        <h2>Companies</h2>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Company
        </button>
      </div>

      {/* Companies Table */}
      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Business Type</th>
              <th>Username</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(company => (
              <tr key={company._id}>
                <td className="company-name">{company.companyName}</td>
                <td>
                  <div className="business-types">
                    {company.businessTypes?.map((type, idx) => (
                      <span key={idx} className={`type-badge ${type.includes('Dairy') ? 'dairy' : 'private'}`}>
                        {type === 'Dairy Cooperative Society' ? 'Dairy' : 'Private'}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="username">{company.username || '-'}</td>
                <td>{company.phone || '-'}</td>
                <td>
                  <span className={`status-badge ${company.status?.toLowerCase()}`}>
                    {company.status}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn-icon"
                      title="Reset Password"
                      onClick={() => {
                        setSelectedCompany(company);
                        setShowPasswordModal(true);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </button>
                    <button
                      className={`btn-icon ${company.status === 'Active' ? 'warning' : 'success'}`}
                      title={company.status === 'Active' ? 'Deactivate' : 'Activate'}
                      onClick={() => handleToggleStatus(company)}
                    >
                      {company.status === 'Active' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="4" y1="12" x2="20" y2="12"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                      )}
                    </button>
                    <button
                      className="btn-icon danger"
                      title="Delete Permanently"
                      onClick={() => handleDeleteCompany(company)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan="6" className="empty-row">
                  No companies added yet. Click "Add Company" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Company Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Company</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              {/* Login Credentials Section */}
              <div className="form-section">
                <h3>Login Credentials</h3>
                <div className="form-row two-cols">
                  <div className="form-group">
                    <label>Username *</label>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      placeholder="Login username"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="text"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Login password (min 6 chars)"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Basic Company Info */}
              <div className="form-section">
                <h3>Basic Information</h3>
                <div className="form-group">
                  <label>Company Name *</label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    placeholder="Enter company name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Business Type *</label>
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.businessTypes.includes('Dairy Cooperative Society')}
                        onChange={() => handleBusinessTypeChange('Dairy Cooperative Society')}
                      />
                      Dairy Cooperative Society
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.businessTypes.includes('Private Firm')}
                        onChange={() => handleBusinessTypeChange('Private Firm')}
                      />
                      Private Firm
                    </label>
                  </div>
                </div>

                <div className="form-row two-cols">
                  <div className="form-group">
                    <label>Society Name</label>
                    <input
                      type="text"
                      name="societyName"
                      value={formData.societyName}
                      onChange={handleInputChange}
                      placeholder="Society name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Society Code</label>
                    <input
                      type="text"
                      name="societyCode"
                      value={formData.societyCode}
                      onChange={handleInputChange}
                      placeholder="Society code"
                    />
                  </div>
                </div>
              </div>

              {/* Contact & Address */}
              <div className="form-section">
                <h3>Contact & Address</h3>
                <div className="form-row two-cols">
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="Phone number"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Email address"
                    />
                  </div>
                </div>

                <div className="form-row two-cols">
                  <div className="form-group">
                    <label>State</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      placeholder="State"
                    />
                  </div>
                  <div className="form-group">
                    <label>District</label>
                    <input
                      type="text"
                      name="district"
                      value={formData.district}
                      onChange={handleInputChange}
                      placeholder="District"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Address</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Full address"
                    rows="2"
                  />
                </div>
              </div>

              {/* Registration Details */}
              <div className="form-section">
                <h3>Registration Details</h3>
                <div className="form-row two-cols">
                  <div className="form-group">
                    <label>GST Number</label>
                    <input
                      type="text"
                      name="gstNumber"
                      value={formData.gstNumber}
                      onChange={handleInputChange}
                      placeholder="GST Number"
                    />
                  </div>
                  <div className="form-group">
                    <label>PAN Number</label>
                    <input
                      type="text"
                      name="panNumber"
                      value={formData.panNumber}
                      onChange={handleInputChange}
                      placeholder="PAN Number"
                    />
                  </div>
                </div>

                <div className="form-row two-cols">
                  <div className="form-group">
                    <label>Milma Code</label>
                    <input
                      type="text"
                      name="milmaCode"
                      value={formData.milmaCode}
                      onChange={handleInputChange}
                      placeholder="Milma Code"
                    />
                  </div>
                  <div className="form-group">
                    <label>SSI Registration</label>
                    <input
                      type="text"
                      name="ssiRegistration"
                      value={formData.ssiRegistration}
                      onChange={handleInputChange}
                      placeholder="SSI Registration No"
                    />
                  </div>
                </div>

                <div className="form-row two-cols">
                  <div className="form-group">
                    <label>Date of Registration</label>
                    <input
                      type="date"
                      name="dateOfRegistration"
                      value={formData.dateOfRegistration}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Start Date</label>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-row two-cols">
                  <div className="form-group">
                    <label>SSI Registration Date</label>
                    <input
                      type="date"
                      name="ssiRegistrationDate"
                      value={formData.ssiRegistrationDate}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label>Year of Audit</label>
                    <input
                      type="text"
                      name="yearOfAudit"
                      value={formData.yearOfAudit}
                      onChange={handleInputChange}
                      placeholder="e.g., 2023-24"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Audit Classification</label>
                  <input
                    type="text"
                    name="auditClassification"
                    value={formData.auditClassification}
                    onChange={handleInputChange}
                    placeholder="Audit classification"
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && selectedCompany && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reset Password</h2>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>Reset password for: <strong>{selectedCompany.companyName}</strong></p>
              <p className="text-muted">Username: {selectedCompany.username}</p>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 chars)"
                  minLength={6}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowPasswordModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleResetPassword}>
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
