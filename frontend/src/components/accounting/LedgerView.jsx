import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { ledgerAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import LoadingSpinner from '../common/LoadingSpinner';
import ExportButton from '../common/ExportButton';
import './LedgerView.css';


const LedgerView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchLedger();
  }, [id]);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const response = await ledgerAPI.getById(id);
      setLedger(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch ledger details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!ledger) {
    return null;
  }

  const transactions = ledger.transactions || [];

  const filteredTransactions = transactions.filter(txn => {
    if (dateRange.startDate && dateRange.endDate) {
      const txnDate = dayjs(txn.date);
      const start = dayjs(dateRange.startDate);
      const end = dayjs(dateRange.endDate);
      if (txnDate.isBefore(start, 'day') || txnDate.isAfter(end, 'day')) {
        return false;
      }
    }
    return true;
  });

  const totalDebit = filteredTransactions.reduce((sum, txn) => sum + (txn.debit || 0), 0);
  const totalCredit = filteredTransactions.reduce((sum, txn) => sum + (txn.credit || 0), 0);

  const exportData = filteredTransactions.map(txn => ({
    'Date': dayjs(txn.date).format('DD-MM-YYYY'),
    'Particulars': txn.particulars,
    'Voucher Type': txn.voucherType,
    'Debit': txn.debit || 0,
    'Credit': txn.credit || 0,
    'Balance': `${Math.abs(txn.balance)} ${txn.balanceType}`
  }));

  const getVoucherTypeClass = (type) => {
    if (type === 'Receipt') return 'tag-success';
    if (type === 'Payment') return 'tag-danger';
    if (type === 'Journal') return 'tag-info';
    return 'tag-default';
  };

  return (
    <div>
      <PageHeader
        title="Ledger Details"
        subtitle={`View ledger transactions for ${ledger.ledgerName}`}
      />

      <div className="actions-bar">
        <button
          className="btn btn-default"
          onClick={() => navigate('/accounting/ledgers')}
        >
          ← Back
        </button>
        <ExportButton
          data={exportData}
          filename={`ledger_${ledger.ledgerName}`}
          buttonText="Export"
        />
      </div>

      <div className="ledger-info-card">
        <h3>Ledger Information</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Ledger Name</span>
            <span className="info-value">{ledger.ledgerName}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Account Group</span>
            <span className="info-value">
              <span className="tag tag-info">{ledger.ledgerType}</span>
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Opening Balance</span>
            <span className="info-value">
              ₹{ledger.openingBalance?.toFixed(2) || 0} {ledger.openingBalanceType || ''}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Current Balance</span>
            <span className="info-value">
              <span className={`tag ${ledger.balanceType === 'Dr' ? 'tag-danger' : 'tag-success'}`}>
                ₹{ledger.currentBalance?.toFixed(2) || 0} {ledger.balanceType || ''}
              </span>
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Parent Group</span>
            <span className="info-value">{ledger.parentGroup || '-'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Linked Entity</span>
            <span className="info-value">{ledger.linkedEntity?.entityType || '-'}</span>
          </div>
        </div>
      </div>

      <div className="transactions-card">
        <h3>Transaction History</h3>

        <div className="date-filter">
          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              className="form-input"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              className="form-input"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
        </div>

        <div className="table-container">
          {filteredTransactions.length === 0 ? (
            <div className="no-data">No transactions found</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Particulars</th>
                  <th>Voucher Type</th>
                  <th style={{ textAlign: 'right' }}>Debit</th>
                  <th style={{ textAlign: 'right' }}>Credit</th>
                  <th style={{ textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((txn, index) => (
                  <tr key={index}>
                    <td>{dayjs(txn.date).format('DD-MM-YYYY')}</td>
                    <td>{txn.particulars}</td>
                    <td>
                      <span className={`tag ${getVoucherTypeClass(txn.voucherType)}`}>
                        {txn.voucherType}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {txn.debit > 0 ? `₹${txn.debit.toFixed(2)}` : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {txn.credit > 0 ? `₹${txn.credit.toFixed(2)}` : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`tag ${txn.balanceType === 'Dr' ? 'tag-danger' : 'tag-success'}`}>
                        ₹{Math.abs(txn.balance).toFixed(2)} {txn.balanceType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 'bold', backgroundColor: '#fafafa' }}>
                  <td colSpan="3" style={{ textAlign: 'right' }}>Total:</td>
                  <td style={{ textAlign: 'right' }}>₹{totalDebit.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>₹{totalCredit.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default LedgerView;
