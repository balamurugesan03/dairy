import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { quotationAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import LoadingSpinner from '../common/LoadingSpinner';
import { message } from '../../utils/toast';

const QuotationView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  const fetchQuotation = async () => {
    setLoading(true);
    try {
      const response = await quotationAPI.getById(id);
      setQuotation(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch quotation details');
      navigate('/quotations');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!quotation) {
    return null;
  }

  const getStatusColor = (status) => {
    const colors = {
      'Draft': '#8c8c8c',
      'Sent': '#1890ff',
      'Accepted': '#52c41a',
      'Rejected': '#ff4d4f',
      'Expired': '#faad14'
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

  const calculateTotals = () => {
    const subtotal = quotation.items?.reduce((sum, item) => sum + (item.quantity * item.rate), 0) || 0;
    const taxAmount = quotation.items?.reduce((sum, item) => {
      const itemTotal = item.quantity * item.rate;
      return sum + (itemTotal * (item.taxPercent || 0) / 100);
    }, 0) || 0;
    const totalAmount = subtotal + taxAmount - (quotation.discount || 0);

    return { subtotal, taxAmount, totalAmount };
  };

  const totals = calculateTotals();

  return (
    <div>
      <PageHeader
        title="Quotation Details"
        subtitle={`View details for quotation #${quotation.quotationNumber}`}
        extra={[
          <button
            key="back"
            className="btn btn-default"
            onClick={() => navigate('/quotations')}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
            </svg>
            Back
          </button>,
          <button
            key="edit"
            className="btn btn-primary"
            onClick={() => navigate(`/quotations/edit/${id}`)}
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
            Quotation Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Quotation Number" value={quotation.quotationNumber} />
            <DescriptionRow label="Status" value={renderStatusTag(quotation.status || 'Draft')} />
            <DescriptionRow label="Quotation Date" value={quotation.quotationDate ? dayjs(quotation.quotationDate).format('DD-MM-YYYY') : '-'} />
            <DescriptionRow label="Valid Until" value={quotation.validUntil ? dayjs(quotation.validUntil).format('DD-MM-YYYY') : '-'} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Customer Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Customer Name" value={quotation.customerName || '-'} />
            <DescriptionRow label="Phone" value={quotation.customerPhone || '-'} />
            <DescriptionRow label="Email" value={quotation.customerEmail || '-'} />
            <DescriptionRow label="Address" value={quotation.customerAddress || '-'} span={2} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Items
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '500', color: 'var(--text-secondary)' }}>#</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '500', color: 'var(--text-secondary)' }}>Item Name</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '500', color: 'var(--text-secondary)' }}>Description</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: '500', color: 'var(--text-secondary)' }}>Quantity</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: '500', color: 'var(--text-secondary)' }}>Rate</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: '500', color: 'var(--text-secondary)' }}>Tax %</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: '500', color: 'var(--text-secondary)' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {quotation.items && quotation.items.length > 0 ? (
                  quotation.items.map((item, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{index + 1}</td>
                      <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{item.itemName}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.description || '-'}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: 'var(--text-primary)' }}>{item.quantity}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: 'var(--text-primary)' }}>₹{item.rate?.toFixed(2)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: 'var(--text-primary)' }}>{item.taxPercent || 0}%</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: 'var(--text-primary)' }}>₹{item.amount?.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No items added
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', maxWidth: '300px', marginLeft: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '4px 0' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>₹{totals.subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '4px 0' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tax Amount:</span>
                <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>₹{totals.taxAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '4px 0' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Discount:</span>
                <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>₹{(quotation.discount || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '8px 0', borderTop: '2px solid var(--border-color)' }}>
                <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>Total Amount:</span>
                <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>₹{totals.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {(quotation.terms || quotation.notes) && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
              Additional Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)' }}>
              {quotation.terms && <DescriptionRow label="Terms & Conditions" value={quotation.terms} span={2} />}
              {quotation.notes && <DescriptionRow label="Notes" value={quotation.notes} span={2} />}
            </div>
          </div>
        )}

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            System Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Created At" value={quotation.createdAt ? dayjs(quotation.createdAt).format('DD-MM-YYYY HH:mm') : '-'} />
            <DescriptionRow label="Last Updated" value={quotation.updatedAt ? dayjs(quotation.updatedAt).format('DD-MM-YYYY HH:mm') : '-'} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotationView;
