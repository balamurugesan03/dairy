import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { advanceAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import LoadingSpinner from '../common/LoadingSpinner';
import { message } from '../../utils/toast';

const AdvanceView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [advance, setAdvance] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAdvance();
  }, [id]);

  const fetchAdvance = async () => {
    setLoading(true);
    try {
      // Since there's no getById in the API, we fetch all and filter
      const response = await advanceAPI.getAll();
      const foundAdvance = response.data?.find(adv => adv._id === id);

      if (foundAdvance) {
        setAdvance(foundAdvance);
      } else {
        message.error('Advance not found');
        navigate('/payments/advances');
      }
    } catch (error) {
      message.error(error.message || 'Failed to fetch advance details');
      navigate('/payments/advances');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!advance) {
    return null;
  }

  const getStatusColor = (status) => {
    const colors = {
      'Active': '#1890ff',
      'Partially Adjusted': '#faad14',
      'Fully Adjusted': '#52c41a',
      'Cancelled': '#ff4d4f'
    };
    return colors[status] || '#1890ff';
  };

  const renderStatusTag = (status) => (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500',
      background: `${getStatusColor(status)}20`,
      color: getStatusColor(status),
      border: `1px solid ${getStatusColor(status)}`
    }}>
      {status}
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
        title="Advance Details"
        subtitle="View farmer advance details"
        extra={[
          <button
            key="back"
            className="btn btn-default"
            onClick={() => navigate('/payments/advances')}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
            </svg>
            Back
          </button>
        ]}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Advance Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Advance Date" value={advance.advanceDate ? dayjs(advance.advanceDate).format('DD-MM-YYYY') : '-'} />
            <DescriptionRow label="Status" value={renderStatusTag(advance.status || 'Active')} />
            <DescriptionRow label="Advance Amount" value={`₹${parseFloat(advance.advanceAmount || 0).toFixed(2)}`} />
            <DescriptionRow label="Adjusted Amount" value={`₹${parseFloat(advance.adjustedAmount || 0).toFixed(2)}`} />
            <DescriptionRow label="Balance Amount" value={`₹${parseFloat(advance.balanceAmount || advance.advanceAmount || 0).toFixed(2)}`} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Farmer Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow
              label="Farmer Number"
              value={advance.farmer?.farmerNumber || advance.farmerId?.farmerNumber || '-'}
            />
            <DescriptionRow
              label="Farmer Name"
              value={advance.farmer?.personalDetails?.name || advance.farmerId?.personalDetails?.name || '-'}
            />
            <DescriptionRow
              label="Phone"
              value={advance.farmer?.personalDetails?.phone || advance.farmerId?.personalDetails?.phone || '-'}
            />
            <DescriptionRow
              label="Village"
              value={advance.farmer?.address?.village || advance.farmerId?.address?.village || '-'}
            />
          </div>
        </div>

        {advance.notes && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
              Additional Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)' }}>
              <DescriptionRow label="Notes" value={advance.notes} span={2} />
            </div>
          </div>
        )}

        {advance.adjustments && advance.adjustments.length > 0 && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
              Adjustment History
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '500', color: 'var(--text-secondary)' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '500', color: 'var(--text-secondary)' }}>Amount</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '500', color: 'var(--text-secondary)' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {advance.adjustments.map((adjustment, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', color: 'var(--text-primary)' }}>
                        {adjustment.date ? dayjs(adjustment.date).format('DD-MM-YYYY') : '-'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: 'var(--text-primary)' }}>
                        ₹{parseFloat(adjustment.amount || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                        {adjustment.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            System Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Created At" value={advance.createdAt ? dayjs(advance.createdAt).format('DD-MM-YYYY HH:mm') : '-'} />
            <DescriptionRow label="Last Updated" value={advance.updatedAt ? dayjs(advance.updatedAt).format('DD-MM-YYYY HH:mm') : '-'} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvanceView;
