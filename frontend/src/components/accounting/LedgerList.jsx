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
      // Income Types - Cyan/Green shades
      'Sales A/c': 'tag-cyan',
      'Trade Income': 'tag-cyan',
      'Miscellaneous Income': 'tag-cyan',
      'Other Revenue': 'tag-cyan',
      'Grants & Aid': 'tag-cyan',
      'Subsidies': 'tag-cyan',
      // Expense Types - Red/Danger shades
      'Purchases A/c': 'tag-danger',
      'Trade Expenses': 'tag-danger',
      'Establishment Charges': 'tag-danger',
      'Miscellaneous Expenses': 'tag-danger',
      // Party Types - Info
      'Accounts Due To (Sundry Creditors)': 'tag-info',
      // Liability Types - Magenta
      'Other Payable': 'tag-magenta',
      'Other Liabilities': 'tag-magenta',
      'Deposit A/c': 'tag-magenta',
      'Contingency Fund': 'tag-magenta',
      'Education Fund': 'tag-magenta',
      // Asset Types - Purple
      'Fixed Assets': 'tag-purple',
      'Movable Assets': 'tag-purple',
      'Immovable Assets': 'tag-purple',
      'Other Assets': 'tag-purple',
      'Other Receivable': 'tag-purple',
      // Investment Types - Blue
      'Investment A/c': 'tag-blue',
      'Other Investment': 'tag-blue',
      'Government Securities': 'tag-blue',
      // Capital Types - Blue
      'Share Capital': 'tag-blue',
      // Final Accounts - Warning
      'Profit & Loss A/c': 'tag-warning',
      // Legacy/Basic Types
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

          <optgroup label="Income">
            <option value="Sales A/c">Sales A/c</option>
            <option value="Trade Income">Trade Income</option>
            <option value="Miscellaneous Income">Miscellaneous Income</option>
            <option value="Other Revenue">Other Revenue</option>
            <option value="Grants & Aid">Grants & Aid</option>
            <option value="Subsidies">Subsidies</option>
          </optgroup>

          <optgroup label="Expense">
            <option value="Purchases A/c">Purchases A/c</option>
            <option value="Trade Expenses">Trade Expenses</option>
            <option value="Establishment Charges">Establishment Charges</option>
            <option value="Miscellaneous Expenses">Miscellaneous Expenses</option>
          </optgroup>

          <optgroup label="Party">
            <option value="Accounts Due To (Sundry Creditors)">Accounts Due To (Sundry Creditors)</option>
          </optgroup>

          <optgroup label="Liability">
            <option value="Other Payable">Other Payable</option>
            <option value="Other Liabilities">Other Liabilities</option>
            <option value="Deposit A/c">Deposit A/c</option>
            <option value="Contingency Fund">Contingency Fund</option>
            <option value="Education Fund">Education Fund</option>
          </optgroup>

          <optgroup label="Asset">
            <option value="Fixed Assets">Fixed Assets</option>
            <option value="Movable Assets">Movable Assets</option>
            <option value="Immovable Assets">Immovable Assets</option>
            <option value="Other Assets">Other Assets</option>
            <option value="Other Receivable">Other Receivable</option>
          </optgroup>

          <optgroup label="Investment">
            <option value="Investment A/c">Investment A/c</option>
            <option value="Other Investment">Other Investment</option>
            <option value="Government Securities">Government Securities</option>
          </optgroup>

          <optgroup label="Capital">
            <option value="Share Capital">Share Capital</option>
          </optgroup>

          <optgroup label="Final Accounts">
            <option value="Profit & Loss A/c">Profit & Loss A/c</option>
          </optgroup>w

          <optgroup label="Legacy/Basic Types">
            <option value="Party">Party</option>
            <option value="Bank">Bank</option>
            <option value="Cash">Cash</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
            <option value="Asset">Asset</option>
            <option value="Liability">Liability</option>
            <option value="Capital">Capital</option>
          </optgroup>
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
                   <option value="">Select Ledger</option>

<option value="Sales A/c" data-type="Income">Sales A/c</option>
<option value="Trade Income" data-type="Income">Trade Income</option>
<option value="Miscellaneous Income" data-type="Income">Miscellaneous Income</option>
<option value="Other Revenue" data-type="Income">Other Revenue</option>
<option value="Grants & Aid" data-type="Income">Grants & Aid</option>
<option value="Subsidies" data-type="Income">Subsidies</option>


<option value="Purchases A/c" data-type="Expense">Purchases A/c</option>
<option value="Trade Expenses" data-type="Expense">Trade Expenses</option>
<option value="Establishment Charges" data-type="Expense">Establishment Charges</option>
<option value="Miscellaneous Expenses" data-type="Expense">Miscellaneous Expenses</option>


<option value="Accounts Due To (Sundry Creditors)" data-type="Party">
  Accounts Due To (Sundry Creditors)
</option>
<option value="Other Payable" data-type="Liability">Other Payable</option>
<option value="Other Liabilities" data-type="Liability">Other Liabilities</option>
<option value="Deposit A/c" data-type="Liability">Deposit A/c</option>
<option value="Contingency Fund" data-type="Liability">Contingency Fund</option>
<option value="Education Fund" data-type="Liability">Education Fund</option>


<option value="Fixed Assets" data-type="Asset">Fixed Assets</option>
<option value="Movable Assets" data-type="Asset">Movable Assets</option>
<option value="Immovable Assets" data-type="Asset">Immovable Assets</option>
<option value="Other Assets" data-type="Asset">Other Assets</option>
<option value="Other Receivable" data-type="Asset">Other Receivable</option>


<option value="Investment A/c" data-type="Investment">Investment A/c</option>
<option value="Other Investment" data-type="Investment">Other Investment</option>
<option value="Government Securities" data-type="Investment">
  Government Securities
</option>


<option value="Share Capital" data-type="Capital">Share Capital</option>


<option value="Profit & Loss A/c" data-type="Final">
  Profit & Loss A/c
</option>

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
