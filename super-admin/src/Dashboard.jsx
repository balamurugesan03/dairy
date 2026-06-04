import { useState, useEffect, useRef } from 'react';
import { companyAPI, milmaChartAdminAPI } from './api';
import './Dashboard.css';

const genPassword = () => {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#';
  return Array.from({ length: 10 }, () => c[Math.floor(Math.random() * c.length)]).join('');
};
const genUsername = (name) =>
  (name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'company';
const genCode = () => String(Math.floor(100 + Math.random() * 9000));

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('companies');
  const [companies, setCompanies] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  // ── Add company ────────────────────────────────────────────────────────────
  const [showModal, setShowModal]     = useState(false);
  const [showPwd,   setShowPwd]       = useState(false);
  const [saving,    setSaving]        = useState(false);
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
  const [formData,      setFormData]      = useState(emptyForm);
  const [businessCodes, setBusinessCodes] = useState({});

  // ── Credentials reveal ─────────────────────────────────────────────────────
  const [showCredsModal,  setShowCredsModal]  = useState(false);
  const [createdCreds,    setCreatedCreds]    = useState(null);
  const [showCreatedPwd,  setShowCreatedPwd]  = useState(true);
  const [copiedField,     setCopiedField]     = useState('');

  // ── Reset password ─────────────────────────────────────────────────────────
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedCompany,   setSelectedCompany]   = useState(null);
  const [newPassword,       setNewPassword]       = useState('');
  const [showNewPwd,        setShowNewPwd]        = useState(false);
  const [resetSaving,       setResetSaving]       = useState(false);

  // ── Milma chart ────────────────────────────────────────────────────────────
  const [milmaCompanyId,     setMilmaCompanyId]     = useState('');
  const [milmaFile,          setMilmaFile]          = useState(null);
  const [milmaUploading,     setMilmaUploading]     = useState(false);
  const [milmaMasters,       setMilmaMasters]       = useState([]);
  const [milmaLoadingList,   setMilmaLoadingList]   = useState(false);
  const [milmaError,         setMilmaError]         = useState('');
  const [milmaSuccess,       setMilmaSuccess]       = useState('');
  const [milmaDetailChartId, setMilmaDetailChartId] = useState(null);
  const [milmaDetailRows,    setMilmaDetailRows]    = useState([]);
  const [milmaDetailTotal,   setMilmaDetailTotal]   = useState(0);
  const [milmaDetailPage,    setMilmaDetailPage]    = useState(1);
  const [milmaDetailLoading, setMilmaDetailLoading] = useState(false);
  const DETAIL_LIMIT = 100;
  const fileInputRef = useRef(null);

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

  const handleCompanyNameChange = (e) => {
    const v = e.target.value;
    setFormData(p => ({
      ...p,
      companyName: v,
      username: p.username === genUsername(p.companyName) || !p.username ? genUsername(v) : p.username
    }));
  };

  const openAddModal = async () => {
    const pwd = genPassword();
    setFormData({ ...emptyForm, password: pwd });
    setBusinessCodes({});
    setShowPwd(false);
    setShowModal(true);
    // Auto-fetch next society code
    try {
      const res = await companyAPI.getNextCode();
      if (res?.data?.nextCode) {
        setFormData(p => ({ ...p, societyCode: res.data.nextCode }));
      }
    } catch { /* silently ignore — user can type manually */ }
  };

  const toggleBizType = (type) => {
    setFormData(p => ({
      ...p,
      businessTypes: p.businessTypes.includes(type)
        ? p.businessTypes.filter(t => t !== type)
        : [...p.businessTypes, type]
    }));
    setBusinessCodes(prev => {
      if (prev[type]) { const c = { ...prev }; delete c[type]; return c; }
      return { ...prev, [type]: genCode() };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.companyName.trim()) { setError('Company name is required'); return; }
    if (!formData.businessTypes.length) { setError('Select at least one business type'); return; }
    if (!formData.username.trim()) { setError('Username is required'); return; }
    if (!formData.password || formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setSaving(true);
    const plainPwd = formData.password;
    try {
      const res = await companyAPI.create({
        ...formData,
        username: formData.username.trim().toLowerCase(),
        businessCodes,
        dateOfRegistration:  formData.dateOfRegistration  || undefined,
        startDate:           formData.startDate           || undefined,
        ssiRegistrationDate: formData.ssiRegistrationDate || undefined,
      });
      if (!res.success) { setError(res.message || 'Failed to create company'); return; }
      setShowModal(false);
      setFormData(emptyForm);
      setBusinessCodes({});
      fetchCompanies();
      setCreatedCreds({ username: formData.username.trim().toLowerCase(), password: plainPwd, companyName: formData.companyName });
      setShowCreatedPwd(true);
      setCopiedField('');
      setShowCredsModal(true);
    } catch (err) { setError(err.message || 'Failed to create company'); }
    setSaving(false);
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    });
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    setResetSaving(true);
    try {
      const res = await companyAPI.update(selectedCompany._id, { password: newPassword });
      if (res.success) {
        setSuccess('Password reset successfully');
        setShowPasswordModal(false);
        setSelectedCompany(null);
        setNewPassword('');
        setShowNewPwd(false);
      } else { setError(res.message || 'Failed to reset password'); }
    } catch (err) { setError(err.message || 'Failed to reset password'); }
    setResetSaving(false);
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

  // ── Milma handlers ──────────────────────────────────────────────────────────
  const loadMilmaMasters = async (cid) => {
    if (!cid) return;
    setMilmaLoadingList(true); setMilmaError('');
    try {
      const res = await milmaChartAdminAPI.getMasters(cid);
      setMilmaMasters(res?.data || []);
    } catch (e) { setMilmaError(e?.message || 'Failed to load chart list'); }
    setMilmaLoadingList(false);
  };

  const handleMilmaCompanyChange = (e) => {
    const cid = e.target.value;
    setMilmaCompanyId(cid); setMilmaMasters([]); setMilmaDetailChartId(null); setMilmaDetailRows([]);
    if (cid && cid !== 'ALL') loadMilmaMasters(cid);
  };

  const handleMilmaUpload = async (e) => {
    e.preventDefault();
    setMilmaError(''); setMilmaSuccess('');
    if (!milmaCompanyId) { setMilmaError('Select a company first'); return; }
    if (!milmaFile)      { setMilmaError('Select the Excel file first'); return; }
    setMilmaUploading(true);
    if (milmaCompanyId === 'ALL') {
      let done = 0, failed = 0;
      for (const c of companies) {
        try {
          const fd = new FormData();
          fd.append('companyId', c._id); fd.append('file', milmaFile);
          setMilmaSuccess(`Uploading… ${done + 1} / ${companies.length} — ${c.companyName}`);
          await milmaChartAdminAPI.upload(fd);
          done++;
        } catch { failed++; }
      }
      setMilmaFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMilmaSuccess(failed === 0 ? `✅ Uploaded to all ${done} companies.` : `⚠️ Done: ${done} succeeded, ${failed} failed.`);
    } else {
      try {
        const fd = new FormData();
        fd.append('companyId', milmaCompanyId); fd.append('file', milmaFile);
        const res = await milmaChartAdminAPI.upload(fd);
        if (res.success) {
          setMilmaSuccess(res.message); setMilmaFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          loadMilmaMasters(milmaCompanyId);
        } else { setMilmaError(res.message || 'Upload failed'); }
      } catch (e) { setMilmaError(e?.message || 'Upload failed'); }
    }
    setMilmaUploading(false);
  };

  const handleMilmaDelete = async () => {
    if (!milmaCompanyId) return;
    setMilmaError(''); setMilmaSuccess('');
    if (milmaCompanyId === 'ALL') {
      if (!confirm(`Delete ALL Milma chart data for EVERY company (${companies.length})?`)) return;
      let done = 0;
      for (const c of companies) { try { await milmaChartAdminAPI.deleteAll(c._id); done++; } catch {} }
      setMilmaSuccess(`Deleted chart data for ${done} companies.`); setMilmaMasters([]);
    } else {
      const company = companies.find(c => c._id === milmaCompanyId);
      if (!confirm(`Delete ALL Milma chart data for "${company?.companyName}"?`)) return;
      try {
        const res = await milmaChartAdminAPI.deleteAll(milmaCompanyId);
        if (res.success) { setMilmaSuccess(res.message); setMilmaMasters([]); }
        else setMilmaError(res.message || 'Delete failed');
      } catch (e) { setMilmaError(e?.message || 'Delete failed'); }
    }
  };

  const loadMilmaDetail = async (chartId, page = 1) => {
    if (!milmaCompanyId || !chartId) return;
    setMilmaDetailLoading(true); setMilmaDetailRows([]);
    try {
      const res = await milmaChartAdminAPI.getDetail(milmaCompanyId, chartId, page, DETAIL_LIMIT);
      setMilmaDetailRows(res?.data || []); setMilmaDetailTotal(res?.total || 0); setMilmaDetailPage(page);
    } catch (e) { setMilmaError(e?.message || 'Failed'); }
    setMilmaDetailLoading(false);
  };

  const handleViewDetail = (chartId) => {
    if (milmaDetailChartId === chartId) {
      setMilmaDetailChartId(null); setMilmaDetailRows([]); setMilmaDetailTotal(0); setMilmaDetailPage(1);
    } else { setMilmaDetailChartId(chartId); loadMilmaDetail(chartId, 1); }
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt) ? '—' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading) return (
    <div className="sa-loading">
      <div className="sa-spinner"></div>
      <p style={{ color: '#6b7280', fontSize: 14 }}>Loading...</p>
    </div>
  );

  return (
    <div className="sa-dashboard">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sa-header">
        <div className="sa-header-left">
          <div className="sa-header-icon">🛡️</div>
          <div>
            <h1>Super Admin Panel</h1>
            <span className="sa-user-badge">👤 {user?.username}</span>
          </div>
        </div>
        <button className="sa-btn-logout" onClick={onLogout}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </header>

      <div className="sa-body">

        {/* Messages */}
        {error   && <div className="sa-msg error"><span>⚠ {error}</span><button onClick={() => setError('')}>×</button></div>}
        {success && <div className="sa-msg success"><span>✓ {success}</span><button onClick={() => setSuccess('')}>×</button></div>}

        {/* ── Stats ──────────────────────────────────────────────────────────── */}
        <div className="sa-stats">
          <div className="sa-stat">
            <div className="sa-stat-icon purple">🏢</div>
            <div><span className="sa-stat-val">{companies.length}</span><span className="sa-stat-lbl">Total Companies</span></div>
          </div>
          <div className="sa-stat">
            <div className="sa-stat-icon blue">✅</div>
            <div><span className="sa-stat-val">{companies.filter(c => c.status === 'Active').length}</span><span className="sa-stat-lbl">Active</span></div>
          </div>
          <div className="sa-stat">
            <div className="sa-stat-icon red">⛔</div>
            <div><span className="sa-stat-val">{companies.filter(c => c.status !== 'Active').length}</span><span className="sa-stat-lbl">Inactive</span></div>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────────── */}
        <div className="sa-tabs">
          <button className={`sa-tab${activeTab === 'companies'   ? ' active' : ''}`} onClick={() => setActiveTab('companies')}>🏢 Companies</button>
          <button className={`sa-tab${activeTab === 'milma-chart' ? ' active' : ''}`} onClick={() => setActiveTab('milma-chart')}>📊 Milma Rate Chart</button>
        </div>

        {/* ── COMPANIES TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'companies' && (
          <div className="sa-card">
            <div className="sa-card-hdr">
              <h2>Companies</h2>
              <div className="sa-card-hdr-actions">
                <button className="sa-btn-icon refresh" title="Refresh" onClick={fetchCompanies}>🔄</button>
                <button className="sa-btn-primary" onClick={openAddModal}>＋ Add Company</button>
              </div>
            </div>

            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Company</th>
                    <th>Type</th>
                    <th>Username</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c, i) => (
                    <tr key={c._id}>
                      <td className="sa-td-num">{i + 1}</td>
                      <td>
                        <div className="sa-company-cell">
                          <div className="sa-company-avatar">{c.companyName?.charAt(0)?.toUpperCase()}</div>
                          <div>
                            <div className="sa-company-name">{c.companyName}</div>
                            {c.societyCode && <div className="sa-company-code">{c.societyCode}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="sa-types">
                          {c.businessTypes?.map((t, idx) => (
                            <span key={idx} className={`sa-type ${t.includes('Dairy') ? 'dairy' : 'private'}`}>
                              {t.includes('Dairy') ? 'Dairy' : 'Private'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td><code className="sa-code">{c.username || '—'}</code></td>
                      <td>{c.phone || '—'}</td>
                      <td><span className={`sa-status ${c.status?.toLowerCase()}`}>{c.status}</span></td>
                      <td>
                        <div className="sa-actions" style={{ justifyContent: 'flex-end' }}>
                          <button className="sa-icon-btn" title="Reset Password" onClick={() => { setSelectedCompany(c); setNewPassword(''); setShowNewPwd(false); setShowPasswordModal(true); }}>🔑</button>
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
          </div>
        )}

        {/* ── MILMA TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'milma-chart' && (
          <>
            {milmaError   && <div className="sa-msg error"><span>{milmaError}</span><button onClick={() => setMilmaError('')}>×</button></div>}
            {milmaSuccess && <div className="sa-msg success"><span>{milmaSuccess}</span><button onClick={() => setMilmaSuccess('')}>×</button></div>}

            <div className="sa-milma-form-card">
              <h3 className="sa-milma-card-title">📤 Upload New Price Chart</h3>
              <form onSubmit={handleMilmaUpload}>
                <div className="sa-fg">
                  <label>Select Company *</label>
                  <select value={milmaCompanyId} onChange={handleMilmaCompanyChange} required>
                    <option value="">— choose a company —</option>
                    <option value="ALL">⭐ All Companies ({companies.length})</option>
                    {companies.map(c => <option key={c._id} value={c._id}>{c.companyName}</option>)}
                  </select>
                  {milmaCompanyId === 'ALL' && (
                    <p className="sa-milma-all-hint">⚠️ This file will be uploaded to <strong>all {companies.length} companies</strong>.</p>
                  )}
                </div>
                <div className="sa-milma-info-box">
                  <span>ℹ️</span>
                  <p>Upload a Milma Excel with 2 sheets: <em>rate chart detail</em> and <em>chart master</em>. All parameters (Date Fix, FAT/SNF Rate, thresholds) are read automatically.</p>
                </div>
                <div className="sa-fg">
                  <label>Price Chart File (Excel .xlsx) *</label>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={e => setMilmaFile(e.target.files[0] || null)} required />
                  {milmaFile && <p className="sa-milma-file-hint">✅ {milmaFile.name} — {(milmaFile.size / 1024).toFixed(1)} KB</p>}
                </div>
                <div className="sa-milma-form-footer">
                  <button type="button" className="sa-btn-sec sa-btn-danger" onClick={handleMilmaDelete} disabled={!milmaCompanyId || milmaUploading}>
                    🗑 Delete All Charts
                  </button>
                  <button type="submit" className="sa-btn-primary" disabled={milmaUploading || !milmaCompanyId || !milmaFile}>
                    {milmaUploading ? '⏳ Uploading…' : '⬆ Load Price Chart'}
                  </button>
                </div>
              </form>
            </div>

            {milmaCompanyId && milmaCompanyId !== 'ALL' && (
              <div className="sa-milma-list-card">
                <h3 className="sa-milma-card-title">
                  📋 Uploaded Chart Versions
                  {milmaLoadingList && <span className="sa-milma-loading">Loading…</span>}
                </h3>
                {!milmaLoadingList && milmaMasters.length === 0 && <p className="sa-milma-empty">No chart data uploaded yet.</p>}
                {milmaMasters.length > 0 && (
                  <div className="sa-table-wrap">
                    <table className="sa-table">
                      <thead>
                        <tr>
                          <th>Chart ID</th><th>From</th><th>SNF Rate</th><th>FAT Rate</th>
                          <th>SNF Low</th><th>TS Low</th><th>SNF High</th><th>TS High</th>
                          <th>Rows</th><th>Remarks</th><th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {milmaMasters.map(m => (
                          <tr key={m._id} className={milmaDetailChartId === m.chartId ? 'sa-tr-active' : ''}>
                            <td className="sa-td-num">{m.chartId}</td>
                            <td>{fmtDate(m.dateFrom)}</td>
                            <td>{m.rateSNF}</td><td>{m.rateFAT}</td>
                            <td>{m.subSNF}</td><td>{m.subTotalSolids}</td>
                            <td>{m.bestSNF}</td><td>{m.bestTotalSolids}</td>
                            <td>{m.rowCount?.toLocaleString()}</td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.remarks || '—'}</td>
                            <td>
                              <button className={`sa-icon-btn${milmaDetailChartId === m.chartId ? ' active' : ''}`}
                                onClick={() => handleViewDetail(m.chartId)}>
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

            {milmaDetailChartId && (
              <div className="sa-milma-detail-card">
                <div className="sa-milma-detail-header">
                  <h3 className="sa-milma-card-title">
                    📊 Rate Rows — Chart {milmaDetailChartId}
                    {milmaDetailLoading && <span className="sa-milma-loading">Loading…</span>}
                  </h3>
                  <div className="sa-milma-detail-meta">
                    {milmaDetailTotal > 0 && (
                      <span className="sa-milma-detail-count">
                        {((milmaDetailPage - 1) * DETAIL_LIMIT) + 1}–{Math.min(milmaDetailPage * DETAIL_LIMIT, milmaDetailTotal)} / {milmaDetailTotal.toLocaleString()}
                      </span>
                    )}
                    <button className="sa-icon-btn" onClick={() => { setMilmaDetailChartId(null); setMilmaDetailRows([]); }}>✕</button>
                  </div>
                </div>
                {milmaDetailRows.length > 0 && (
                  <>
                    <div className="sa-table-wrap sa-detail-table-wrap">
                      <table className="sa-table sa-detail-table">
                        <thead><tr><th>#</th><th>FAT</th><th>CLR</th><th>SNF</th><th>Rate (₹)</th></tr></thead>
                        <tbody>
                          {milmaDetailRows.map((row, i) => (
                            <tr key={row._id || i}>
                              <td className="sa-td-num">{((milmaDetailPage - 1) * DETAIL_LIMIT) + i + 1}</td>
                              <td>{row.fat}</td><td>{row.clr}</td><td>{row.snf}</td>
                              <td className="sa-td-rate">₹{Number(row.rate).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {milmaDetailTotal > DETAIL_LIMIT && (
                      <div className="sa-milma-pagination">
                        <button className="sa-btn-sec" disabled={milmaDetailPage <= 1 || milmaDetailLoading}
                          onClick={() => loadMilmaDetail(milmaDetailChartId, milmaDetailPage - 1)}>← Prev</button>
                        <span className="sa-milma-page-info">Page {milmaDetailPage} / {Math.ceil(milmaDetailTotal / DETAIL_LIMIT)}</span>
                        <button className="sa-btn-sec"
                          disabled={milmaDetailPage >= Math.ceil(milmaDetailTotal / DETAIL_LIMIT) || milmaDetailLoading}
                          onClick={() => loadMilmaDetail(milmaDetailChartId, milmaDetailPage + 1)}>Next →</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>{/* end sa-body */}

      {/* ══ ADD COMPANY MODAL ═════════════════════════════════════════════════ */}
      {showModal && (
        <div className="sa-overlay" onClick={() => setShowModal(false)}>
          <div className="sa-modal large" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-hdr">
              <div className="sa-modal-hdr-left">
                <div className="sa-modal-hdr-icon blue">🏢</div>
                <div>
                  <h2>Add New Company</h2>
                  <p>Fill in details to create a company account</p>
                </div>
              </div>
              <button className="sa-modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="sa-modal-divider" />
            <form onSubmit={handleSubmit} className="sa-modal-body">

              <div className="sa-section">
                <div className="sa-section-title"><span>🏢</span> Basic Information</div>
                <div className="sa-fg">
                  <label>Company Name *</label>
                  <input name="companyName" value={formData.companyName} onChange={handleCompanyNameChange} placeholder="e.g. Kerala Dairy Society" />
                </div>
                <div className="sa-fg">
                  <label>Business Type *</label>
                  <div className="sa-checks">
                    {['Dairy Cooperative Society', 'Private Firm'].map(type => (
                      <div key={type} className="sa-biz-row">
                        <label className="sa-biz-label">
                          <input type="checkbox" checked={formData.businessTypes.includes(type)} onChange={() => toggleBizType(type)} />
                          {type}
                        </label>
                        {type === 'Private Firm' && formData.businessTypes.includes(type) && (
                          <div className="sa-biz-code">
                            <span className="sa-code-label">Code</span>
                            <input className="sa-code-input" value={businessCodes[type] || ''} onChange={e => setBusinessCodes(p => ({ ...p, [type]: e.target.value }))} placeholder="Code" />
                            <button type="button" className="sa-code-refresh" onClick={() => setBusinessCodes(p => ({ ...p, [type]: genCode() }))}>↺</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="sa-row2">
                  <div className="sa-fg"><label>Society Name</label><input name="societyName" value={formData.societyName} onChange={handleInput} placeholder="Society name" /></div>
                  <div className="sa-fg">
                    <label>Society Code <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 500 }}>— auto-generated (editable)</span></label>
                    <input
                      name="societyCode"
                      value={formData.societyCode}
                      onChange={handleInput}
                      placeholder="e.g. 1001"
                      style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, letterSpacing: 2, color: '#15803d', background: '#f0fdf4', borderColor: '#86efac' }}
                    />
                  </div>
                </div>
              </div>

              <div className="sa-section">
                <div className="sa-section-title"><span>🔐</span> Login Credentials <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af', textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>Auto-generated — edit if needed</span></div>
                <div className="sa-row2">
                  <div className="sa-fg">
                    <label>Username *</label>
                    <input name="username" value={formData.username} onChange={handleInput} placeholder="Login username" />
                  </div>
                  <div className="sa-fg">
                    <label>Password *</label>
                    <div className="sa-pwd-wrap">
                      <input
                        name="password" value={formData.password} onChange={handleInput}
                        placeholder="Min 6 characters"
                        type={showPwd ? 'text' : 'password'}
                        style={{ fontFamily: showPwd ? 'monospace' : undefined }}
                      />
                      <div className="sa-pwd-actions">
                        <button type="button" className="sa-pwd-btn" title={showPwd ? 'Hide' : 'Show'} onClick={() => setShowPwd(p => !p)}>
                          {showPwd ? '🙈' : '👁'}
                        </button>
                        <button type="button" className="sa-pwd-btn" title="Generate new password" onClick={() => { setFormData(p => ({ ...p, password: genPassword() })); setShowPwd(true); }}>
                          ↺
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sa-section">
                <div className="sa-section-title"><span>📍</span> Contact & Address</div>
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
                <div className="sa-section-title"><span>📋</span> Registration Details</div>
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
                <button type="submit" className="sa-btn-primary" disabled={saving}>{saving ? '⏳ Creating…' : '✓ Create Company'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ CREDENTIALS REVEAL MODAL ══════════════════════════════════════════ */}
      {showCredsModal && createdCreds && (
        <div className="sa-overlay" onClick={() => setShowCredsModal(false)}>
          <div className="sa-modal creds" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-hdr">
              <div className="sa-modal-hdr-left">
                <div className="sa-modal-hdr-icon green">✅</div>
                <div>
                  <h2>Company Created</h2>
                  <p>Save these login credentials now</p>
                </div>
              </div>
              <button className="sa-modal-close" onClick={() => setShowCredsModal(false)}>×</button>
            </div>
            <div className="sa-modal-divider" />
            <div className="sa-modal-body">
              <div className="sa-creds-company">
                <div className="sa-creds-avatar">{createdCreds.companyName.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="sa-creds-company-name">{createdCreds.companyName}</div>
                  <div className="sa-creds-company-sub">Company created successfully</div>
                </div>
              </div>

              <div className="sa-creds-box">
                <div className="sa-creds-row">
                  <div>
                    <div className="sa-creds-label">Username</div>
                    <div className="sa-creds-value">{createdCreds.username}</div>
                  </div>
                  <button className={`sa-creds-copy${copiedField === 'username' ? ' copied' : ''}`}
                    onClick={() => copyToClipboard(createdCreds.username, 'username')}
                    title="Copy username">
                    {copiedField === 'username' ? '✓' : '⎘'}
                  </button>
                </div>
                <div className="sa-creds-row">
                  <div>
                    <div className="sa-creds-label">Password</div>
                    <div className="sa-creds-value">
                      {showCreatedPwd ? createdCreds.password : '• • • • • • • • • •'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="sa-creds-copy" onClick={() => setShowCreatedPwd(p => !p)} title="Show/hide">
                      {showCreatedPwd ? '🙈' : '👁'}
                    </button>
                    <button className={`sa-creds-copy${copiedField === 'password' ? ' copied' : ''}`}
                      onClick={() => copyToClipboard(createdCreds.password, 'password')}
                      title="Copy password">
                      {copiedField === 'password' ? '✓' : '⎘'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="sa-warn-box">
                ⚠️ Note this password down now — it will not be shown again after you close this.
              </div>

              <div className="sa-modal-footer" style={{ paddingTop: 0, paddingLeft: 0, paddingRight: 0, borderTop: 'none' }}>
                <button className="sa-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowCredsModal(false)}>
                  ✓ Done — I have saved the credentials
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ RESET PASSWORD MODAL ══════════════════════════════════════════════ */}
      {showPasswordModal && selectedCompany && (
        <div className="sa-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="sa-modal small" onClick={e => e.stopPropagation()}>
            <div className="sa-modal-hdr">
              <div className="sa-modal-hdr-left">
                <div className="sa-modal-hdr-icon orange">🔑</div>
                <div>
                  <h2>Reset Password</h2>
                  <p>Set a new login password</p>
                </div>
              </div>
              <button className="sa-modal-close" onClick={() => setShowPasswordModal(false)}>×</button>
            </div>
            <div className="sa-modal-divider" />
            <div className="sa-modal-body">
              <div className="sa-rpwd-company">
                <div className="sa-rpwd-avatar">{selectedCompany.companyName.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="sa-rpwd-name">{selectedCompany.companyName}</div>
                  <div className="sa-rpwd-user">@{selectedCompany.username}</div>
                </div>
                <span className={`sa-status ${selectedCompany.status?.toLowerCase()}`} style={{ marginLeft: 'auto' }}>
                  {selectedCompany.status}
                </span>
              </div>

              <div className="sa-fg">
                <label>New Password *</label>
                <div className="sa-pwd-wrap">
                  <input
                    type={showNewPwd ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    style={{ fontFamily: showNewPwd ? 'monospace' : undefined }}
                  />
                  <div className="sa-pwd-actions">
                    <button type="button" className="sa-pwd-btn" onClick={() => setShowNewPwd(p => !p)}>
                      {showNewPwd ? '🙈' : '👁'}
                    </button>
                    <button type="button" className="sa-pwd-btn" title="Generate password"
                      onClick={() => { setNewPassword(genPassword()); setShowNewPwd(true); }}>
                      ↺
                    </button>
                  </div>
                </div>
                {newPassword.length > 0 && newPassword.length < 6 && (
                  <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>Must be at least 6 characters</p>
                )}
              </div>

              <div className="sa-modal-footer">
                <button className="sa-btn-sec" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                <button className="sa-btn-primary" disabled={newPassword.length < 6 || resetSaving} onClick={handleResetPassword}>
                  {resetSaving ? '⏳ Saving…' : '🔑 Reset Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
