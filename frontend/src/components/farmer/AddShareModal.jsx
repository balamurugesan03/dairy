import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { message } from '../../utils/toast';
import { farmerAPI } from '../../services/api';

const AddShareModal = ({ farmer, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    transactionType: 'Allotment',
    shares: '',
    shareValue: '',
    resolutionNo: '',
    resolutionDate: '',
    remarks: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Set default transaction type based on current shares
    if (farmer?.financialDetails?.totalShares > 0) {
      setFormData(prev => ({ ...prev, transactionType: 'Additional Allotment' }));
    }
  }, [farmer]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.shares || parseFloat(formData.shares) <= 0) {
      message.error('Please enter a valid number of shares');
      return;
    }

    if (!formData.shareValue || parseFloat(formData.shareValue) <= 0) {
      message.error('Please enter a valid share value');
      return;
    }

    if (!formData.resolutionNo) {
      message.error('Resolution number is required');
      return;
    }

    if (!formData.resolutionDate) {
      message.error('Resolution date is required');
      return;
    }

    setLoading(true);
    try {
      await farmerAPI.addShares(farmer._id, {
        ...formData,
        shares: parseFloat(formData.shares),
        shareValue: parseFloat(formData.shareValue)
      });

      message.success('Shares updated successfully');
      onSuccess();
      onClose();
    } catch (error) {
      message.error(error.message || 'Failed to update shares');
    } finally {
      setLoading(false);
    }
  };

  const totalValue = (parseFloat(formData.shares) || 0) * (parseFloat(formData.shareValue) || 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Shares</h3>
          <button className="btn-icon" onClick={onClose}>
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{
              background: 'var(--bg-secondary)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '24px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Old Shares
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {farmer?.financialDetails?.oldShares || 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    New Shares
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {farmer?.financialDetails?.newShares || 0}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Total Shares
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#1890ff' }}>
                    {farmer?.financialDetails?.totalShares || 0}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label required">Transaction Type</label>
                <select
                  name="transactionType"
                  value={formData.transactionType}
                  onChange={handleChange}
                  className="form-control"
                  required
                >
                  <option value="Allotment">Allotment</option>
                  <option value="Additional Allotment">Additional Allotment</option>
                  <option value="Redemption">Redemption</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label required">Number of Shares</label>
                <input
                  type="number"
                  name="shares"
                  value={formData.shares}
                  onChange={handleChange}
                  className="form-control"
                  placeholder="Enter number of shares"
                  min="1"
                  step="1"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label required">Share Value (per share)</label>
                <input
                  type="number"
                  name="shareValue"
                  value={formData.shareValue}
                  onChange={handleChange}
                  className="form-control"
                  placeholder="Enter share value"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Total Value</label>
                <input
                  type="text"
                  value={`₹${totalValue.toFixed(2)}`}
                  className="form-control"
                  disabled
                  style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label required">Resolution Number</label>
                <input
                  type="text"
                  name="resolutionNo"
                  value={formData.resolutionNo}
                  onChange={handleChange}
                  className="form-control"
                  placeholder="Enter resolution number"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label required">Resolution Date</label>
                <input
                  type="date"
                  name="resolutionDate"
                  value={formData.resolutionDate}
                  onChange={handleChange}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Remarks</label>
                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  className="form-control"
                  placeholder="Enter remarks (optional)"
                  rows="3"
                />
              </div>
            </div>

            {formData.transactionType === 'Redemption' && (
              <div style={{
                background: '#fff7e6',
                border: '1px solid #ffd591',
                borderRadius: '8px',
                padding: '12px',
                marginTop: '16px',
                display: 'flex',
                gap: '8px'
              }}>
                <svg style={{ width: '20px', height: '20px', color: '#fa8c16', flexShrink: 0 }} viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                  <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
                </svg>
                <div style={{ fontSize: '13px', color: '#ad6800' }}>
                  <strong>Note:</strong> Shares will be redeemed from new shares first, then from old shares.
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Shares'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddShareModal;
