import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { ledgerAPI, voucherAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import SearchableSelect from '../common/SearchableSelect';
import './PaymentVoucher.css';

const ReceiptVoucher = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ledgers, setLedgers] = useState([]);
  const [formData, setFormData] = useState({
    voucherDate: dayjs().format('YYYY-MM-DD'),
    debitLedgerId: '',
    creditLedgerId: '',
    amount: '',
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

  const validateForm = () => {
    const newErrors = {};
    if (!formData.voucherDate) newErrors.voucherDate = 'Voucher date is required';
    if (!formData.debitLedgerId) newErrors.debitLedgerId = 'Please select debit ledger';
    if (!formData.creditLedgerId) newErrors.creditLedgerId = 'Please select credit ledger';
    if (!formData.amount || parseFloat(formData.amount) <= 0) newErrors.amount = 'Please enter valid amount';
    if (!formData.narration) newErrors.narration = 'Narration is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const debitLedger = ledgers.find(l => l._id === formData.debitLedgerId);
      const creditLedger = ledgers.find(l => l._id === formData.creditLedgerId);
      const amount = parseFloat(formData.amount);

      const payload = {
        voucherType: 'Receipt',
        voucherDate: new Date(formData.voucherDate).toISOString(),
        entries: [
          {
            ledgerId: formData.debitLedgerId,
            ledgerName: debitLedger.ledgerName,
            debitAmount: amount,
            creditAmount: 0,
            narration: formData.narration
          },
          {
            ledgerId: formData.creditLedgerId,
            ledgerName: creditLedger.ledgerName,
            debitAmount: 0,
            creditAmount: amount,
            narration: formData.narration
          }
        ],
        totalDebit: amount,
        totalCredit: amount,
        referenceType: 'Manual',
        narration: formData.narration
      };

      await voucherAPI.create(payload);
      message.success('Receipt voucher created successfully');
      navigate('/accounting/vouchers');
    } catch (error) {
      message.error(error.message || 'Failed to create receipt voucher');
    } finally {
      setLoading(false);
    }
  };

  const ledgerOptions = ledgers.map(ledger => ({
    label: `${ledger.ledgerName} (${ledger.ledgerType})`,
    value: ledger._id
  }));

  return (
    <div>
      <PageHeader
        title="Receipt Voucher"
        subtitle="Create receipt voucher for money received"
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

          <div className="form-group">
            <label className="form-label required">Debit (Cash/Bank Received In)</label>
            <SearchableSelect
              options={ledgerOptions}
              placeholder="Select ledger"
              value={formData.debitLedgerId}
              onChange={(value) => {
                setFormData(prev => ({ ...prev, debitLedgerId: value }));
                if (errors.debitLedgerId) {
                  setErrors(prev => ({ ...prev, debitLedgerId: '' }));
                }
              }}
            />
            {errors.debitLedgerId && <div className="form-error">{errors.debitLedgerId}</div>}
            <div className="form-help">Select the cash or bank account where money is received</div>
          </div>

          <div className="form-group">
            <label className="form-label required">Credit (Party/Income Account)</label>
            <SearchableSelect
              options={ledgerOptions}
              placeholder="Select ledger"
              value={formData.creditLedgerId}
              onChange={(value) => {
                setFormData(prev => ({ ...prev, creditLedgerId: value }));
                if (errors.creditLedgerId) {
                  setErrors(prev => ({ ...prev, creditLedgerId: '' }));
                }
              }}
            />
            {errors.creditLedgerId && <div className="form-error">{errors.creditLedgerId}</div>}
            <div className="form-help">Select the party or income account from which money is received</div>
          </div>

          <div className="form-group">
            <label className="form-label required">Amount</label>
            <input
              type="number"
              name="amount"
              className={`form-input ${errors.amount ? 'error' : ''}`}
              placeholder="Enter amount"
              value={formData.amount}
              onChange={handleChange}
              min="0.01"
              step="0.01"
            />
            {errors.amount && <div className="form-error">{errors.amount}</div>}
          </div>

          <div className="form-group">
            <label className="form-label required">Narration</label>
            <textarea
              name="narration"
              className={`form-textarea ${errors.narration ? 'error' : ''}`}
              rows="3"
              placeholder="Enter narration/description"
              value={formData.narration}
              onChange={handleChange}
            />
            {errors.narration && <div className="form-error">{errors.narration}</div>}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
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

export default ReceiptVoucher;
