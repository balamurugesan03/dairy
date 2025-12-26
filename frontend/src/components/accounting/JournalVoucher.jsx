import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { ledgerAPI, voucherAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import SearchableSelect from '../common/SearchableSelect';
import './JournalVoucher.css';

const JournalVoucher = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ledgers, setLedgers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [totals, setTotals] = useState({ debit: 0, credit: 0 });
  const [formData, setFormData] = useState({
    voucherDate: dayjs().format('YYYY-MM-DD'),
    ledgerId: '',
    debitAmount: '',
    creditAmount: '',
    entryNarration: '',
    narration: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchLedgers();
  }, []);

  const fetchLedgers = async () => {
    try {
      const response = await ledgerAPI.getAll();
      setLedgers(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch ledgers');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleAddEntry = () => {
    const { ledgerId, debitAmount, creditAmount, entryNarration } = formData;
    const debit = parseFloat(debitAmount) || 0;
    const credit = parseFloat(creditAmount) || 0;

    if (!ledgerId) {
      message.error('Please select a ledger');
      return;
    }

    if (debit === 0 && credit === 0) {
      message.error('Please enter either debit or credit amount');
      return;
    }

    if (debit > 0 && credit > 0) {
      message.error('Please enter either debit or credit amount, not both');
      return;
    }

    const ledger = ledgers.find(l => l._id === ledgerId);
    if (!ledger) return;

    const newEntry = {
      ledgerId: ledger._id,
      ledgerName: ledger.ledgerName,
      debitAmount: debit,
      creditAmount: credit,
      narration: entryNarration
    };

    const updatedEntries = [...entries, newEntry];
    setEntries(updatedEntries);
    calculateTotals(updatedEntries);

    setFormData(prev => ({
      ...prev,
      ledgerId: '',
      debitAmount: '',
      creditAmount: '',
      entryNarration: ''
    }));
  };

  const handleRemoveEntry = (index) => {
    const updatedEntries = entries.filter((_, i) => i !== index);
    setEntries(updatedEntries);
    calculateTotals(updatedEntries);
  };

  const calculateTotals = (entries) => {
    const debit = entries.reduce((sum, entry) => sum + entry.debitAmount, 0);
    const credit = entries.reduce((sum, entry) => sum + entry.creditAmount, 0);
    setTotals({ debit, credit });
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.voucherDate) newErrors.voucherDate = 'Voucher date is required';
    if (!formData.narration) newErrors.narration = 'Narration is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (entries.length < 2) {
      message.error('Please add at least 2 entries');
      return;
    }

    if (totals.debit !== totals.credit) {
      message.error('Total debit and credit must be equal');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const payload = {
        voucherType: 'Journal',
        voucherDate: new Date(formData.voucherDate).toISOString(),
        entries: entries,
        totalDebit: totals.debit,
        totalCredit: totals.credit,
        referenceType: 'Manual',
        narration: formData.narration
      };

      await voucherAPI.create(payload);
      message.success('Journal voucher created successfully');
      navigate('/accounting/vouchers');
    } catch (error) {
      message.error(error.message || 'Failed to create journal voucher');
    } finally {
      setLoading(false);
    }
  };

  const ledgerOptions = ledgers.map(ledger => ({
    label: `${ledger.ledgerName} (${ledger.ledgerType})`,
    value: ledger._id
  }));

  const isBalanced = totals.debit === totals.credit && totals.debit > 0;

  return (
    <div>
      <PageHeader
        title="Journal Voucher"
        subtitle="Create journal voucher for adjustments and transfers"
      />

      <div className="form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label required">Voucher Date</label>
            <input
              type="date"
              name="voucherDate"
              className={`form-input ${errors.voucherDate ? 'error' : ''}`}
              value={formData.voucherDate}
              onChange={handleChange}
            />
            {errors.voucherDate && <div className="form-error">{errors.voucherDate}</div>}
          </div>

          <div className="entry-card">
            <h3 className="entry-card-title">Add Entries</h3>

            <div className="form-group">
              <label className="form-label">Select Ledger</label>
              <SearchableSelect
                options={ledgerOptions}
                placeholder="Select ledger"
                value={formData.ledgerId}
                onChange={(value) => setFormData(prev => ({ ...prev, ledgerId: value }))}
              />
            </div>

            <div className="entry-amounts">
              <div className="form-group">
                <label className="form-label">Debit Amount</label>
                <input
                  type="number"
                  name="debitAmount"
                  className="form-input"
                  placeholder="Enter debit amount"
                  value={formData.debitAmount}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Credit Amount</label>
                <input
                  type="number"
                  name="creditAmount"
                  className="form-input"
                  placeholder="Enter credit amount"
                  value={formData.creditAmount}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Entry Narration</label>
              <input
                type="text"
                name="entryNarration"
                className="form-input"
                placeholder="Enter narration for this entry"
                value={formData.entryNarration}
                onChange={handleChange}
              />
            </div>

            <button
              type="button"
              className="btn btn-default btn-block"
              onClick={handleAddEntry}
            >
              + Add Entry
            </button>
          </div>

          {entries.length > 0 && (
            <div className="table-container">
              <table className="voucher-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>#</th>
                    <th>Ledger</th>
                    <th>Narration</th>
                    <th style={{ textAlign: 'right' }}>Debit</th>
                    <th style={{ textAlign: 'right' }}>Credit</th>
                    <th style={{ width: '100px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{entry.ledgerName}</td>
                      <td>{entry.narration || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        {entry.debitAmount > 0 ? `₹${entry.debitAmount.toFixed(2)}` : '-'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {entry.creditAmount > 0 ? `₹${entry.creditAmount.toFixed(2)}` : '-'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-link btn-delete"
                          onClick={() => handleRemoveEntry(index)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 'bold', backgroundColor: '#fafafa' }}>
                    <td colSpan="3" style={{ textAlign: 'right' }}>Total:</td>
                    <td style={{ textAlign: 'right' }}>₹{totals.debit.toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>₹{totals.credit.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {entries.length > 0 && !isBalanced && (
            <div className="alert alert-error">
              <strong>Voucher Not Balanced</strong>
              <p>Total Debit: ₹{totals.debit.toFixed(2)}, Total Credit: ₹{totals.credit.toFixed(2)}. Please ensure both are equal.</p>
            </div>
          )}

          {isBalanced && (
            <div className="alert alert-success">
              <strong>Voucher Balanced</strong>
              <p>Total Debit and Credit are equal: ₹{totals.debit.toFixed(2)}</p>
            </div>
          )}

          <div className="form-group">
            <label className="form-label required">Overall Narration</label>
            <textarea
              name="narration"
              className={`form-textarea ${errors.narration ? 'error' : ''}`}
              rows="3"
              placeholder="Enter overall narration/description"
              value={formData.narration}
              onChange={handleChange}
            />
            {errors.narration && <div className="form-error">{errors.narration}</div>}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !isBalanced}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              className="btn btn-default"
              onClick={() => navigate('/accounting/vouchers')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JournalVoucher;
