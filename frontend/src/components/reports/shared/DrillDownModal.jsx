import { useState, useEffect } from 'react';
import { message } from '../../../utils/toast';
import dayjs from 'dayjs';
import './DrillDownModal.css';

/**
 * Modal for showing transaction/voucher details
 * @param {Boolean} visible - Modal visibility
 * @param {String} transactionId - Transaction/Voucher ID
 * @param {String} type - Type (voucher, sale, etc.)
 * @param {Function} onClose - Close callback
 */
const DrillDownModal = ({ visible, transactionId, type = 'voucher', onClose }) => {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);

  useEffect(() => {
    if (visible && transactionId) {
      fetchDetails();
    }
  }, [visible, transactionId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      // TODO: Implement API call based on type
      // const response = await api.getTransactionDetails(transactionId, type);
      // setDetails(response.data);

      // Placeholder
      setTimeout(() => {
        setDetails({
          voucherNumber: 'RV001',
          voucherType: 'Receipt',
          voucherDate: new Date(),
          narration: 'Sale transaction',
          entries: [
            { ledgerName: 'Cash', debitAmount: 1000, creditAmount: 0 },
            { ledgerName: 'Sales', debitAmount: 0, creditAmount: 1000 }
          ]
        });
        setLoading(false);
      }, 500);
    } catch (error) {
      message.error('Failed to fetch details');
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;
  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  if (!visible) return null;

  return (
    <div className="drill-down-overlay" onClick={onClose}>
      <div className="drill-down-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <h3>Transaction Details</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {loading ? (
            <div className="loading">Loading details...</div>
          ) : details ? (
            <>
              <div className="detail-section">
                <div className="detail-row">
                  <span className="detail-label">Voucher Number:</span>
                  <span className="detail-value">{details.voucherNumber}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Voucher Type:</span>
                  <span className="detail-value">{details.voucherType}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Date:</span>
                  <span className="detail-value">{formatDate(details.voucherDate)}</span>
                </div>
                {details.narration && (
                  <div className="detail-row">
                    <span className="detail-label">Narration:</span>
                    <span className="detail-value">{details.narration}</span>
                  </div>
                )}
              </div>

              {/* Entries Table */}
              {details.entries && details.entries.length > 0 && (
                <div className="entries-section">
                  <h4>Ledger Entries</h4>
                  <table className="entries-table">
                    <thead>
                      <tr>
                        <th>Ledger</th>
                        <th className="amount-col">Debit</th>
                        <th className="amount-col">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.entries.map((entry, idx) => (
                        <tr key={idx}>
                          <td>{entry.ledgerName}</td>
                          <td className="amount-col">
                            {entry.debitAmount > 0 ? formatCurrency(entry.debitAmount) : '-'}
                          </td>
                          <td className="amount-col">
                            {entry.creditAmount > 0 ? formatCurrency(entry.creditAmount) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="no-data">No details available</div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DrillDownModal;
