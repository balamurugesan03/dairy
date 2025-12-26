import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { promotionAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import LoadingSpinner from '../common/LoadingSpinner';
import { message } from '../../utils/toast';

const PromotionView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [promotion, setPromotion] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPromotion();
  }, [id]);

  const fetchPromotion = async () => {
    setLoading(true);
    try {
      const response = await promotionAPI.getById(id);
      setPromotion(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch promotion details');
      navigate('/promotions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!promotion) {
    return null;
  }

  const getTypeColor = (type) => {
    const colors = {
      'Marketing': '#1890ff',
      'Sales': '#52c41a',
      'Event': '#faad14',
      'Social Media': '#722ed1',
      'Other': '#8c8c8c'
    };
    return colors[type] || '#1890ff';
  };

  const renderTypeTag = (type) => (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500',
      background: `${getTypeColor(type)}20`,
      color: getTypeColor(type),
      border: `1px solid ${getTypeColor(type)}`
    }}>
      {type}
    </span>
  );

  const DescriptionRow = ({ label, value, span = 1 }) => (
    <div style={{
      gridColumn: span === 2 ? 'span 2' : 'span 1',
      padding: '12px',
      borderBottom: '1px solid var(--border-color)',
      display: 'grid',
      gridTemplateColumns: '150px 1fr',
      gap: '12px'
    }}>
      <div style={{ fontWeight: '500', color: 'var(--text-secondary)' }}>{label}:</div>
      <div style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Promotion Details"
        subtitle="View promotion activity details"
        extra={[
          <button
            key="back"
            className="btn btn-default"
            onClick={() => navigate('/promotions')}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
            </svg>
            Back
          </button>,
          <button
            key="edit"
            className="btn btn-primary"
            onClick={() => navigate(`/promotions/edit/${id}`)}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
            </svg>
            Edit
          </button>
        ]}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Promotion Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Promotion Date" value={promotion.promotionDate ? dayjs(promotion.promotionDate).format('DD-MM-YYYY') : '-'} />
            <DescriptionRow label="Promotion Type" value={renderTypeTag(promotion.promotionType)} />
            <DescriptionRow label="Expense" value={promotion.expense ? `₹${parseFloat(promotion.expense).toFixed(2)}` : '₹0.00'} />
            <DescriptionRow label="Recorded By" value={promotion.recordedBy || '-'} />
            <DescriptionRow label="Target Audience" value={promotion.targetAudience || '-'} span={2} />
            <DescriptionRow label="Description" value={promotion.description || '-'} span={2} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            System Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Created At" value={promotion.createdAt ? dayjs(promotion.createdAt).format('DD-MM-YYYY HH:mm') : '-'} />
            <DescriptionRow label="Last Updated" value={promotion.updatedAt ? dayjs(promotion.updatedAt).format('DD-MM-YYYY HH:mm') : '-'} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionView;
