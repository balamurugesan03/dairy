import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { advanceAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';

const AdvanceList = () => {
  const navigate = useNavigate();
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAdvances();
  }, []);

  const fetchAdvances = async () => {
    setLoading(true);
    try {
      const response = await advanceAPI.getAll();
      setAdvances(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch advances');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'Active') return '#52c41a';
    if (status === 'Adjusted') return '#faad14';
    if (status === 'Cancelled') return '#ff4d4f';
    return '#d9d9d9';
  };

  const exportData = advances.map(advance => ({
    'Date': dayjs(advance.advanceDate).format('DD-MM-YYYY'),
    'Farmer': advance.farmerId?.personalDetails?.name || '-',
    'Advance Amount': advance.advanceAmount,
    'Adjusted': advance.adjustedAmount,
    'Balance': advance.balanceAmount,
    'Status': advance.status
  }));

  return (
    <div>
      <PageHeader
        title="Advance Management"
        subtitle="View and manage farmer advances"
        extra={[
          <button
            key="add"
            style={{
              padding: '8px 16px',
              backgroundColor: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
            onClick={() => navigate('/payments/advance')}
          >
            + New Advance
          </button>,
          <ExportButton
            key="export"
            data={exportData}
            filename="advances_report"
            buttonText="Export"
          />
        ]}
      />

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          minWidth: '1200px'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#fafafa', borderBottom: '2px solid #e8e8e8' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', width: '120px' }}>Date</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Farmer</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Advance Amount</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Adjusted</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Balance</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ padding: '24px', textAlign: 'center' }}>
                  Loading...
                </td>
              </tr>
            ) : advances.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
                  No advances found
                </td>
              </tr>
            ) : (
              advances.map((advance) => (
                <tr key={advance._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 16px' }}>
                    {dayjs(advance.advanceDate).format('DD-MM-YYYY')}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {advance.farmerId?.personalDetails?.name || '-'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    ₹{advance.advanceAmount?.toFixed(2) || 0}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    ₹{advance.adjustedAmount?.toFixed(2) || 0}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    ₹{advance.balanceAmount?.toFixed(2) || 0}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor: `${getStatusColor(advance.status)}20`,
                      color: getStatusColor(advance.status),
                      border: `1px solid ${getStatusColor(advance.status)}`
                    }}>
                      {advance.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      style={{
                        padding: '4px 12px',
                        backgroundColor: '#1890ff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                      onClick={() => navigate(`/payments/advances/view/${advance._id}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdvanceList;
