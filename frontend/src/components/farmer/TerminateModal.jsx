import { useState } from 'react';
import { message } from '../../utils/toast';
import { farmerAPI } from '../../services/api';

const TerminateModal = ({ farmer, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    retirementDate: '',
    resolutionNumber: '',
    resolutionDate: '',
    refundDate: '',
    refundAmount: '',
    refundReason: 'Voluntary',
    description: ''
  });
  const [loading, setLoading] = useState(false);

  // Calculate old share amount (total shares * share value)
  const oldShareAmount = farmer?.financialDetails?.totalShares || 0;
  const shareValue = farmer?.financialDetails?.shareValue || 0;
  const calculatedRefundAmount = oldShareAmount * shareValue;

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
    if (!formData.retirementDate) {
      message.error('Retirement date is required');
      return;
    }

    if (!formData.resolutionNumber) {
      message.error('Resolution number is required');
      return;
    }

    if (!formData.resolutionDate) {
      message.error('Resolution date is required');
      return;
    }

    if (!formData.refundDate) {
      message.error('Refund date is required');
      return;
    }

    if (!formData.refundReason) {
      message.error('Refund reason is required');
      return;
    }

    setLoading(true);
    try {
      await farmerAPI.terminate(farmer._id, {
        ...formData,
        refundAmount: formData.refundAmount ? parseFloat(formData.refundAmount) : calculatedRefundAmount
      });

      message.success('Farmer membership terminated successfully');
      onSuccess();
      onClose();
    } catch (error) {
      message.error(error.message || 'Failed to terminate membership');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Terminate Membership</h3>
          <button className="btn-icon" onClick={onClose}>
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Farmer Information */}
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
                    Farmer Name
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {farmer?.personalDetails?.name || '-'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Member ID
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {farmer?.memberId || '-'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Old Share Amount
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#1890ff' }}>
                    {oldShareAmount} shares
                  </div>
                </div>
              </div>
            </div>

            {/* Warning Message */}
            <div style={{
              background: '#fff1f0',
              border: '1px solid #ffccc7',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '24px',
              display: 'flex',
              gap: '8px'
            }}>
              <svg style={{ width: '20px', height: '20px', color: '#ff4d4f', flexShrink: 0 }} viewBox="0 0 16 16" fill="currentColor">
                <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
              </svg>
              <div style={{ fontSize: '13px', color: '#cf1322' }}>
                <strong>Warning:</strong> This action will terminate the farmer's membership and cannot be undone. The farmer will be removed from the member list.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label required">Retirement Date</label>
                <input
                  type="date"
                  name="retirementDate"
                  value={formData.retirementDate}
                  onChange={handleChange}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label required">Resolution Number</label>
                <input
                  type="text"
                  name="resolutionNumber"
                  value={formData.resolutionNumber}
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

              <div className="form-group">
                <label className="form-label required">Refund Date</label>
                <input
                  type="date"
                  name="refundDate"
                  value={formData.refundDate}
                  onChange={handleChange}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Refund Amount</label>
                <input
                  type="number"
                  name="refundAmount"
                  value={formData.refundAmount}
                  onChange={handleChange}
                  className="form-control"
                  placeholder={`Default: ₹${calculatedRefundAmount.toFixed(2)}`}
                  min="0"
                  step="0.01"
                />
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Leave empty to use calculated amount: {oldShareAmount} shares × ₹{shareValue} = ₹{calculatedRefundAmount.toFixed(2)}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label required">Refund Reason</label>
                <select
                  name="refundReason"
                  value={formData.refundReason}
                  onChange={handleChange}
                  className="form-control"
                  required
                >
                  <option value="Voluntary">Voluntary</option>
                  <option value="Banned">Banned</option>
                  <option value="Dead">Dead</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="form-control"
                  placeholder="Enter additional details about the termination (optional)"
                  rows="4"
                />
              </div>
            </div>
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
              className="btn btn-danger"
              disabled={loading}
            >
              {loading ? 'Terminating...' : 'Terminate Membership'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TerminateModal;
