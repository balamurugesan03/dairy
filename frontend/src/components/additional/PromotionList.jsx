import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import { promotionAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import { showConfirmDialog } from '../common/ConfirmDialog';
import dayjs from 'dayjs';
import './PromotionList.css';

const PromotionList = () => {
  const navigate = useNavigate();
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState(null);

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const response = await promotionAPI.getAll();
      setPromotions(response.data || []);
    } catch (error) {
      message.error(error.message || 'Failed to fetch promotions');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (id) => {
    navigate(`/promotions/view/${id}`);
  };

  const handleDelete = (id) => {
    showConfirmDialog({
      title: 'Delete Promotion',
      content: 'Are you sure you want to delete this promotion? This action cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await promotionAPI.delete(id);
          message.success('Promotion deleted successfully');
          fetchPromotions();
        } catch (error) {
          message.error(error.message || 'Failed to delete promotion');
        }
      }
    });
  };

  const getPromotionTypeClass = (type) => {
    const colors = {
      'Flyer': 'tag-info',
      'Marketing': 'tag-success',
      'Advertisement': 'tag-warning',
      'Campaign': 'tag-purple'
    };
    return colors[type] || 'tag-default';
  };

  const exportData = promotions.map(promo => ({
    'Date': dayjs(promo.promotionDate).format('DD-MM-YYYY'),
    'Type': promo.promotionType,
    'Description': promo.description,
    'Expense': promo.expense || 0,
    'Target Audience': promo.targetAudience || '-',
    'Recorded By': promo.recordedBy || '-'
  }));

  return (
    <div>
      <PageHeader
        title="Promotion Management"
        subtitle="Track marketing activities and promotional expenses"
      />

      <div className="actions-bar">
        <button
          className="btn btn-primary"
          onClick={() => navigate('/promotions/add')}
        >
          + Add Promotion
        </button>
        <ExportButton
          data={exportData}
          filename="promotions"
          disabled={promotions.length === 0}
        />
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : promotions.length === 0 ? (
          <div className="no-data">No promotions found</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Expense</th>
                <th>Target Audience</th>
                <th>Recorded By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((promo) => (
                <tr key={promo._id}>
                  <td>{dayjs(promo.promotionDate).format('DD-MM-YYYY')}</td>
                  <td>
                    <span className={`tag ${getPromotionTypeClass(promo.promotionType)}`}>
                      {promo.promotionType}
                    </span>
                  </td>
                  <td>{promo.description}</td>
                  <td style={{ textAlign: 'right' }}>
                    {promo.expense ? `₹${promo.expense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td>{promo.targetAudience || '-'}</td>
                  <td>{promo.recordedBy || '-'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-link btn-view"
                        onClick={() => handleView(promo._id)}
                      >
                        View
                      </button>
                      <button
                        className="btn-link btn-edit"
                        onClick={() => navigate(`/promotions/edit/${promo._id}`)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-link btn-delete"
                        onClick={() => handleDelete(promo._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {promotions.length > 0 && (
        <div className="pagination-info">
          Total {promotions.length} promotions
        </div>
      )}

      {viewModal && selectedPromotion && (
        <div className="modal-overlay" onClick={() => setViewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Promotion Details</h2>
              <button className="modal-close" onClick={() => setViewModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Date</span>
                  <span className="detail-value">{dayjs(selectedPromotion.promotionDate).format('DD-MM-YYYY')}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Type</span>
                  <span className="detail-value">
                    <span className={`tag ${getPromotionTypeClass(selectedPromotion.promotionType)}`}>
                      {selectedPromotion.promotionType}
                    </span>
                  </span>
                </div>
                <div className="detail-item full-width">
                  <span className="detail-label">Description</span>
                  <span className="detail-value">{selectedPromotion.description}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Expense</span>
                  <span className="detail-value">
                    {selectedPromotion.expense
                      ? `₹${selectedPromotion.expense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                      : '-'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Target Audience</span>
                  <span className="detail-value">{selectedPromotion.targetAudience || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Recorded By</span>
                  <span className="detail-value">{selectedPromotion.recordedBy || '-'}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-default" onClick={() => setViewModal(false)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setViewModal(false);
                  navigate(`/promotions/edit/${selectedPromotion._id}`);
                }}
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromotionList;
