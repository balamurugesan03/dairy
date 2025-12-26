import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import { ledgerAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import './LedgerList.css';

const LedgerList = () => {
  const navigate = useNavigate();
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLedger, setEditingLedger] = useState(null);
  const [formData, setFormData] = useState({
    ledgerName: '',
    ledgerType: '',
    openingBalance: '',
    openingBalanceType: 'Dr',
    parentGroup: ''
  });
  const [errors, setErrors] = useState({});
  const [filters, setFilters] = useState({
    search: '',
    ledgerType: ''
  });

  useEffect(() => {
    fetchLedgers();
  }, []);

  const fetchLedgers = async () => {
    setLoading(true);
    try {
      const response = await ledgerAPI.getAll();
      setLedgers(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch ledgers');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingLedger(null);
    setFormData({
      ledgerName: '',
      ledgerType: '',
      openingBalance: '',
      openingBalanceType: 'Dr',
      parentGroup: ''
    });
    setErrors({});
    setModalVisible(true);
  };

  const handleEdit = (ledger) => {
    setEditingLedger(ledger);
    setFormData({
      ledgerName: ledger.ledgerName || '',
      ledgerType: ledger.ledgerType || '',
      openingBalance: ledger.openingBalance || '',
      openingBalanceType: ledger.openingBalanceType || 'Dr',
      parentGroup: ledger.parentGroup || ''
    });
    setErrors({});
    setModalVisible(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.ledgerName) newErrors.ledgerName = 'Ledger name is required';
    if (!formData.ledgerType) newErrors.ledgerType = 'Ledger type is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const payload = {
        ...formData,
        openingBalance: formData.openingBalance ? parseFloat(formData.openingBalance) : 0
      };

      if (editingLedger) {
        await ledgerAPI.update(editingLedger._id, payload);
        message.success('Ledger updated successfully');
      } else {
        await ledgerAPI.create(payload);
        message.success('Ledger created successfully');
      }
      setModalVisible(false);
      fetchLedgers();
    } catch (error) {
      message.error(error.message || 'Failed to save ledger');
    }
  };

  const getLedgerTypeColor = (type) => {
    const colorMap = {
      'Party': 'tag-info',
      'Bank': 'tag-success',
      'Cash': 'tag-warning',
      'Income': 'tag-cyan',
      'Expense': 'tag-danger',
      'Asset': 'tag-purple',
      'Liability': 'tag-magenta',
      'Capital': 'tag-blue'
    };
    return colorMap[type] || 'tag-default';
  };

  const filteredLedgers = ledgers.filter(ledger => {
    if (filters.search && !ledger.ledgerName.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.ledgerType && ledger.ledgerType !== filters.ledgerType) {
      return false;
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Ledger Management"
        subtitle="View and manage accounting ledgers"
      />

      <div className="ledger-actions">
        <button
          className="btn btn-primary"
          onClick={handleAdd}
        >
          + Add Ledger
        </button>
      </div>

      <div className="filters-container">
        <div className="search-container">
          <input
            type="text"
            className="form-input"
            placeholder="Search by ledger name"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>
        <select
          className="form-select"
          value={filters.ledgerType}
          onChange={(e) => setFilters(prev => ({ ...prev, ledgerType: e.target.value }))}
        >
          <option value="">All Types</option>
          <option value="Party">Party</option>
          <option value="Bank">Bank</option>
          <option value="Cash">Cash</option>
          <option value="Income">Income</option>
          <option value="Expense">Expense</option>
          <option value="Asset">Asset</option>
          <option value="Liability">Liability</option>
          <option value="Capital">Capital</option>
        </select>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : filteredLedgers.length === 0 ? (
          <div className="no-data">No ledgers found</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Ledger Name</th>
                <th>Ledger Type</th>
                <th>Opening Balance</th>
                <th>Current Balance</th>
                <th>Linked Entity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedgers.map((ledger) => (
                <tr key={ledger._id}>
                  <td>{ledger.ledgerName}</td>
                  <td>
                    <span className={`tag ${getLedgerTypeColor(ledger.ledgerType)}`}>
                      {ledger.ledgerType}
                    </span>
                  </td>
                  <td>₹{ledger.openingBalance?.toFixed(2) || 0} {ledger.openingBalanceType || ''}</td>
                  <td>
                    <span className={`tag ${ledger.balanceType === 'Dr' ? 'tag-danger' : 'tag-success'}`}>
                      ₹{ledger.currentBalance?.toFixed(2) || 0} {ledger.balanceType || ''}
                    </span>
                  </td>
                  <td>{ledger.linkedEntity?.entityType || '-'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-link btn-view"
                        onClick={() => navigate(`/accounting/ledgers/view/${ledger._id}`)}
                      >
                        View
                      </button>
                      <button
                        className="btn-link btn-edit"
                        onClick={() => handleEdit(ledger)}
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalVisible && (
        <div className="modal-overlay" onClick={() => setModalVisible(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingLedger ? 'Edit Ledger' : 'Add Ledger'}</h2>
              <button className="modal-close" onClick={() => setModalVisible(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label required">Ledger Name</label>
                  <input
                    type="text"
                    name="ledgerName"
                    className={`form-input ${errors.ledgerName ? 'error' : ''}`}
                    placeholder="Enter ledger name"
                    value={formData.ledgerName}
                    onChange={handleChange}
                  />
                  {errors.ledgerName && <div className="form-error">{errors.ledgerName}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label required">Ledger Type</label>
                  <select
                    name="ledgerType"
                    className={`form-select ${errors.ledgerType ? 'error' : ''}`}
                    value={formData.ledgerType}
                    onChange={handleChange}
                  >
                    <option value="">Select ledger type</option>
                    <option value="Party">Party</option>
                    <option value="Bank">Bank</option>
                    <option value="Cash">Cash</option>
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                    <option value="Asset">Asset</option>
                    <option value="Liability">Liability</option>
                    <option value="Capital">Capital</option>
                  </select>
                  {errors.ledgerType && <div className="form-error">{errors.ledgerType}</div>}
                </div>

                {!editingLedger && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Opening Balance</label>
                      <input
                        type="number"
                        name="openingBalance"
                        className="form-input"
                        placeholder="Enter opening balance"
                        value={formData.openingBalance}
                        onChange={handleChange}
                        step="0.01"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Opening Balance Type</label>
                      <select
                        name="openingBalanceType"
                        className="form-select"
                        value={formData.openingBalanceType}
                        onChange={handleChange}
                      >
                        <option value="Dr">Debit (Dr)</option>
                        <option value="Cr">Credit (Cr)</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">Parent Group</label>
                  <input
                    type="text"
                    name="parentGroup"
                    className="form-input"
                    placeholder="Enter parent group (optional)"
                    value={formData.parentGroup}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn btn-primary">
                  {editingLedger ? 'Update' : 'Save'}
                </button>
                <button
                  type="button"
                  className="btn btn-default"
                  onClick={() => setModalVisible(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LedgerList;
