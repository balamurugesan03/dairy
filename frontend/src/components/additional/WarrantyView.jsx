import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { warrantyAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import LoadingSpinner from '../common/LoadingSpinner';
import { message } from '../../utils/toast';

const WarrantyView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [warranty, setWarranty] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWarranty();
  }, [id]);

  const fetchWarranty = async () => {
    setLoading(true);
    try {
      const response = await warrantyAPI.getById(id);
      setWarranty(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch warranty details');
      navigate('/warranty');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!warranty) {
    return null;
  }

  const getStatusColor = () => {
    const endDate = dayjs(warranty.warrantyEndDate);
    const today = dayjs();

    if (endDate.isBefore(today)) {
      return '#ff4d4f'; // Expired - red
    } else if (endDate.diff(today, 'day') <= 30) {
      return '#faad14'; // Expiring soon - orange
    } else {
      return '#52c41a'; // Active - green
    }
  };

  const getStatusText = () => {
    const endDate = dayjs(warranty.warrantyEndDate);
    const today = dayjs();

    if (endDate.isBefore(today)) {
      return 'Expired';
    } else if (endDate.diff(today, 'day') <= 30) {
      return 'Expiring Soon';
    } else {
      return 'Active';
    }
  };

  const renderStatusTag = () => (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500',
      background: `${getStatusColor()}20`,
      color: getStatusColor(),
      border: `1px solid ${getStatusColor()}`
    }}>
      {getStatusText()}
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
        title="Warranty Details"
        subtitle={`View details for warranty #${warranty.warrantyNumber}`}
        extra={[
          <button
            key="back"
            className="btn btn-default"
            onClick={() => navigate('/warranty')}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
            </svg>
            Back
          </button>,
          <button
            key="edit"
            className="btn btn-primary"
            onClick={() => navigate(`/warranty/edit/${id}`)}
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
            Warranty Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Warranty Number" value={warranty.warrantyNumber} />
            <DescriptionRow label="Status" value={renderStatusTag()} />
            <DescriptionRow label="Product" value={warranty.product || '-'} />
            <DescriptionRow label="Serial Number" value={warranty.serialNumber || '-'} />
            <DescriptionRow label="Purchase Date" value={warranty.purchaseDate ? dayjs(warranty.purchaseDate).format('DD-MM-YYYY') : '-'} />
            <DescriptionRow label="Warranty Start" value={warranty.warrantyStartDate ? dayjs(warranty.warrantyStartDate).format('DD-MM-YYYY') : '-'} />
            <DescriptionRow label="Warranty Period" value={`${warranty.warrantyPeriod || 0} ${warranty.warrantyPeriodUnit || 'months'}`} />
            <DescriptionRow label="Warranty End" value={warranty.warrantyEndDate ? dayjs(warranty.warrantyEndDate).format('DD-MM-YYYY') : '-'} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Customer Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Customer Name" value={warranty.customerName} />
            <DescriptionRow label="Phone" value={warranty.customerPhone} />
            <DescriptionRow label="Email" value={warranty.customerEmail || '-'} span={2} />
          </div>
        </div>

        {(warranty.terms || warranty.notes) && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
              Additional Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)' }}>
              {warranty.terms && <DescriptionRow label="Terms" value={warranty.terms} span={2} />}
              {warranty.notes && <DescriptionRow label="Notes" value={warranty.notes} span={2} />}
            </div>
          </div>
        )}

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            System Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Created At" value={warranty.createdAt ? dayjs(warranty.createdAt).format('DD-MM-YYYY HH:mm') : '-'} />
            <DescriptionRow label="Last Updated" value={warranty.updatedAt ? dayjs(warranty.updatedAt).format('DD-MM-YYYY HH:mm') : '-'} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarrantyView;
