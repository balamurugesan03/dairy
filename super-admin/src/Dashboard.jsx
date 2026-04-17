import { useState, useEffect, useRef } from 'react';
import { companyAPI, milmaChartAdminAPI } from './api';
import './Dashboard.css';

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('companies'); // 'companies' | 'milma-chart'

  const [companies, setCompanies] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedCompany,   setSelectedCompany]   = useState(null);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  // ── Milma Chart state ──────────────────────────────────────────────────────
  const [milmaCompanyId,  setMilmaCompanyId]  = useState('');
  const [milmaFile,       setMilmaFile]       = useState(null);
  const [milmaUploading,  setMilmaUploading]  = useState(false);
  const [milmaMasters,    setMilmaMasters]    = useState([]);
  const [milmaLoadingList,setMilmaLoadingList]= useState(false);
  const [milmaError,      setMilmaError]      = useState('');
  const [milmaSuccess,    setMilmaSuccess]    = useState('');
  const fileInputRef = useRef(null);

  // ── Milma detail view state ────────────────────────────────────────────────
  const [milmaDetailChartId,  setMilmaDetailChartId]  = useState(null);
  const [milmaDetailRows,     setMilmaDetailRows]     = useState([]);
  const [milmaDetailTotal,    setMilmaDetailTotal]    = useState(0);
  const [milmaDetailPage,     setMilmaDetailPage]     = useState(1);
  const [milmaDetailLoading,  setMilmaDetailLoading]  = useState(false);
  const DETAIL_LIMIT = 100;
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

  // ── Milma Chart handlers ────────────────────────────────────────────────────
  const loadMilmaMasters = async (cid) => {
    if (!cid) return;
    setMilmaLoadingList(true);
    setMilmaError('');
    try {
      const res = await milmaChartAdminAPI.getMasters(cid);
      setMilmaMasters(res?.data || []);
    } catch (e) { setMilmaError(e?.message || 'Failed to load chart list'); }
    setMilmaLoadingList(false);
  };

  const handleMilmaCompanyChange = (e) => {
    const cid = e.target.value;
    setMilmaCompanyId(cid);
    setMilmaMasters([]);
    setMilmaDetailChartId(null);
    setMilmaDetailRows([]);
    if (cid && cid !== 'ALL') loadMilmaMasters(cid);
  };

  const handleMilmaUpload = async (e) => {
    e.preventDefault();
    setMilmaError(''); setMilmaSuccess('');
    if (!milmaCompanyId) { setMilmaError('Select a company first'); return; }
    if (!milmaFile)      { setMilmaError('Select the Excel file first'); return; }
    setMilmaUploading(true);

    if (milmaCompanyId === 'ALL') {
      // Upload to every company one by one
      let done = 0, failed = 0;
      for (const c of companies) {
        try {
          const fd = new FormData();
          fd.append('companyId', c._id);
          fd.append('file', milmaFile);
          setMilmaSuccess(`Uploading… ${done + 1} / ${companies.length} — ${c.companyName}`);
          await milmaChartAdminAPI.upload(fd);
          done++;
        } catch { failed++; }
      }
      setMilmaFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (failed === 0) {
        setMilmaSuccess(`✅ Uploaded to all ${done} companies successfully.`);
      } else {
        setMilmaSuccess(`⚠️ Done: ${done} succeeded, ${failed} failed.`);
      }
    } else {
      try {
        const fd = new FormData();
        fd.append('companyId', milmaCompanyId);
        fd.append('file', milmaFile);
        const res = await milmaChartAdminAPI.upload(fd);
        if (res.success) {
          setMilmaSuccess(res.message);
          setMilmaFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          loadMilmaMasters(milmaCompanyId);
        } else {
          setMilmaError(res.message || 'Upload failed');
        }
      } catch (e) { setMilmaError(e?.message || 'Upload failed'); }
    }
    setMilmaUploading(false);
  };

  const handleMilmaDelete = async () => {
    if (!milmaCompanyId) return;
    setMilmaError(''); setMilmaSuccess('');

    if (milmaCompanyId === 'ALL') {
      if (!confirm(`Delete ALL Milma chart data for EVERY company (${companies.length} companies)?\nThis cannot be undone.`)) return;
      let done = 0;
      for (const c of companies) {
        try { await milmaChartAdminAPI.deleteAll(c._id); done++; } catch { /* skip */ }
      }
      setMilmaSuccess(`Deleted chart data for ${done} companies.`);
      setMilmaMasters([]);
    } else {
      const company = companies.find(c => c._id === milmaCompanyId);
      if (!confirm(`Delete ALL Milma chart data for "${company?.companyName}"?\nThis cannot be undone.`)) return;
      try {
        const res = await milmaChartAdminAPI.deleteAll(milmaCompanyId);
        if (res.success) { setMilmaSuccess(res.message); setMilmaMasters([]); }
        else setMilmaError(res.message || 'Delete failed');
      } catch (e) { setMilmaError(e?.message || 'Delete failed'); }
    }
  };

  const loadMilmaDetail = async (chartId, page = 1) => {
    if (!milmaCompanyId || !chartId) return;
    setMilmaDetailLoading(true);
    setMilmaDetailRows([]);
    try {
      const res = await milmaChartAdminAPI.getDetail(milmaCompanyId, chartId, page, DETAIL_LIMIT);
      setMilmaDetailRows(res?.data || []);
      setMilmaDetailTotal(res?.total || 0);
      setMilmaDetailPage(page);
    } catch (e) { setMilmaError(e?.message || 'Failed to load chart detail'); }
    setMilmaDetailLoading(false);
  };

  const handleViewDetail = (chartId) => {
    if (milmaDetailChartId === chartId) {
      // toggle off
      setMilmaDetailChartId(null);
      setMilmaDetailRows([]);
      setMilmaDetailTotal(0);
      setMilmaDetailPage(1);
    } else {
      setMilmaDetailChartId(chartId);
      loadMilmaDetail(chartId, 1);
    }
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return '—';
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

      {/* Tab navigation */}
      <div className="sa-tabs">
        <button className={`sa-tab${activeTab === 'companies' ? ' active' : ''}`} onClick={() => setActiveTab('companies')}>
          🏢 Companies
        </button>
        <button className={`sa-tab${activeTab === 'milma-chart' ? ' active' : ''}`} onClick={() => setActiveTab('milma-chart')}>
          📊 Milma Rate Chart
        </button>
      </div>

      {/* ── COMPANIES TAB ─────────────────────────────────────── */}
      {activeTab === 'companies' && <>
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

      </> /* end companies tab */}

      {/* ── MILMA RATE CHART TAB ───────────────────────────────── */}
      {activeTab === 'milma-chart' && (
        <div className="sa-milma">

          <div className="sa-action-bar">
            <h2>Milma Rate Chart Upload</h2>
          </div>

          {milmaError   && <div className="sa-msg error"><span>{milmaError}</span><button onClick={() => setMilmaError('')}>×</button></div>}
          {milmaSuccess && <div className="sa-msg success"><span>{milmaSuccess}</span><button onClick={() => setMilmaSuccess('')}>×</button></div>}

          {/* Upload form — mirrors openLypsa UI minus Sub-Standard Milk & Activation Key */}
          <div className="sa-milma-form-card">
            <h3 className="sa-milma-card-title">📤 Upload New Price Chart</h3>
            <form onSubmit={handleMilmaUpload}>

              {/* Company selector */}
              <div className="sa-fg">
                <label>Select Company *</label>
                <select value={milmaCompanyId} onChange={handleMilmaCompanyChange} required>
                  <option value="">— choose a company —</option>
                  <option value="ALL">⭐ All Companies ({companies.length})</option>
                  {companies.map(c => (
                    <option key={c._id} value={c._id}>{c.companyName}</option>
                  ))}
                </select>
                {milmaCompanyId === 'ALL' && (
                  <p className="sa-milma-all-hint">
                    ⚠️ The selected Excel file will be uploaded to <strong>all {companies.length} companies</strong>.
                  </p>
                )}
              </div>

              {/* Rate chart info (reference-only, extracted from Excel automatically) */}
              <div className="sa-milma-info-box">
                <span>ℹ️</span>
                <p>
                  The <strong>Date Fix</strong>, <strong>FAT Rate/Ltr</strong>, <strong>SNF Rate/Ltr</strong>,
                  <strong> Low Rate thresholds</strong> and <strong>High Rate thresholds</strong> are all read
                  automatically from the Chart Master sheet inside the Excel file.
                  Upload the Milma Excel file with 2 sheets: <em>rate chart detail</em> and <em>chart master</em>.
                </p>
              </div>

              {/* Excel file selector */}
              <div className="sa-fg">
                <label>Select Price Chart File (Excel .xlsx) *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={e => setMilmaFile(e.target.files[0] || null)}
                  required
                />
                {milmaFile && (
                  <p className="sa-milma-file-hint">
                    ✅ {milmaFile.name} — {(milmaFile.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>

              <div className="sa-milma-form-footer">
                <button
                  type="button"
                  className="sa-btn-sec sa-btn-danger"
                  onClick={handleMilmaDelete}
                  disabled={!milmaCompanyId || milmaUploading}
                >
                  🗑 Delete All Charts
                </button>
                <button
                  type="submit"
                  className="sa-btn-primary"
                  disabled={milmaUploading || !milmaCompanyId || !milmaFile}
                >
                  {milmaUploading ? '⏳ Uploading…' : '⬆ Load Price Chart'}
                </button>
              </div>
            </form>
          </div>

          {/* Chart versions table — only for single company selection */}
          {milmaCompanyId && milmaCompanyId !== 'ALL' && (
            <div className="sa-milma-list-card">
              <h3 className="sa-milma-card-title">
                📋 Uploaded Chart Versions
                {milmaLoadingList && <span className="sa-milma-loading"> Loading…</span>}
              </h3>
              {!milmaLoadingList && milmaMasters.length === 0 && (
                <p className="sa-milma-empty">No chart data uploaded for this company yet.</p>
              )}
              {milmaMasters.length > 0 && (
                <div className="sa-table-wrap">
                  <table className="sa-table">
                    <thead>
                      <tr>
                        <th>Chart ID</th>
                        <th>Effective From</th>
                        <th>SNF Rate/Ltr</th>
                        <th>FAT Rate/Ltr</th>
                        <th>SNF Low &lt;</th>
                        <th>TS Low &lt;</th>
                        <th>SNF High ≥</th>
                        <th>TS High ≥</th>
                        <th>Rows</th>
                        <th>Remarks</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {milmaMasters.map((m, i) => (
                        <tr key={m._id} className={milmaDetailChartId === m.chartId ? 'sa-tr-active' : ''}>
                          <td className="sa-td-num">{m.chartId}</td>
                          <td>{fmtDate(m.dateFrom)}</td>
                          <td>{m.rateSNF}</td>
                          <td>{m.rateFAT}</td>
                          <td>{m.subSNF}</td>
                          <td>{m.subTotalSolids}</td>
                          <td>{m.bestSNF}</td>
                          <td>{m.bestTotalSolids}</td>
                          <td>{m.rowCount?.toLocaleString()}</td>
                          <td style={{maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{m.remarks || '—'}</td>
                          <td>
                            <button
                              className={`sa-icon-btn${milmaDetailChartId === m.chartId ? ' active' : ''}`}
                              title={milmaDetailChartId === m.chartId ? 'Hide rows' : 'View rate rows'}
                              onClick={() => handleViewDetail(m.chartId)}
                            >
                              {milmaDetailChartId === m.chartId ? '🔼' : '👁'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Rate rows detail panel ─────────────────────────────────────── */}
          {milmaDetailChartId && (
            <div className="sa-milma-detail-card">
              <div className="sa-milma-detail-header">
                <h3 className="sa-milma-card-title">
                  📊 Rate Rows — Chart ID {milmaDetailChartId}
                  {milmaDetailLoading && <span className="sa-milma-loading"> Loading…</span>}
                </h3>
                <div className="sa-milma-detail-meta">
                  {milmaDetailTotal > 0 && (
                    <span className="sa-milma-detail-count">
                      Showing {((milmaDetailPage - 1) * DETAIL_LIMIT) + 1}–{Math.min(milmaDetailPage * DETAIL_LIMIT, milmaDetailTotal)} of {milmaDetailTotal.toLocaleString()} rows
                    </span>
                  )}
                  <button className="sa-icon-btn" title="Close" onClick={() => { setMilmaDetailChartId(null); setMilmaDetailRows([]); }}>✕</button>
                </div>
              </div>

              {!milmaDetailLoading && milmaDetailRows.length === 0 && (
                <p className="sa-milma-empty">No rows found.</p>
              )}

              {milmaDetailRows.length > 0 && (
                <>
                  <div className="sa-table-wrap sa-detail-table-wrap">
                    <table className="sa-table sa-detail-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>FAT</th>
                          <th>CLR</th>
                          <th>SNF</th>
                          <th>Rate (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {milmaDetailRows.map((row, i) => (
                          <tr key={row._id || i}>
                            <td className="sa-td-num">{((milmaDetailPage - 1) * DETAIL_LIMIT) + i + 1}</td>
                            <td>{row.fat}</td>
                            <td>{row.clr}</td>
                            <td>{row.snf}</td>
                            <td className="sa-td-rate">₹{Number(row.rate).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {milmaDetailTotal > DETAIL_LIMIT && (
                    <div className="sa-milma-pagination">
                      <button
                        className="sa-btn-sec"
                        disabled={milmaDetailPage <= 1 || milmaDetailLoading}
                        onClick={() => loadMilmaDetail(milmaDetailChartId, milmaDetailPage - 1)}
                      >
                        ← Prev
                      </button>
                      <span className="sa-milma-page-info">
                        Page {milmaDetailPage} / {Math.ceil(milmaDetailTotal / DETAIL_LIMIT)}
                      </span>
                      <button
                        className="sa-btn-sec"
                        disabled={milmaDetailPage >= Math.ceil(milmaDetailTotal / DETAIL_LIMIT) || milmaDetailLoading}
                        onClick={() => loadMilmaDetail(milmaDetailChartId, milmaDetailPage + 1)}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

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
