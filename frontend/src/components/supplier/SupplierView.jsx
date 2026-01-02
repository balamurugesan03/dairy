import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { supplierAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import LoadingSpinner from '../common/LoadingSpinner';
import { message } from '../../utils/toast';

const SupplierView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSupplier();
  }, [id]);

  const fetchSupplier = async () => {
    setLoading(true);
    try {
      const response = await supplierAPI.getById(id);
      setSupplier(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch supplier details');
      navigate('/suppliers');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!supplier) {
    return null;
  }

  const getStatusColor = (active) => {
    return active ? '#52c41a' : '#ff4d4f';
  };

  const renderStatusTag = (active) => (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500',
      background: `${getStatusColor(active)}20`,
      color: getStatusColor(active),
      border: `1px solid ${getStatusColor(active)}`
    }}>
      {active ? 'Active' : 'Inactive'}
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

  const DocumentSection = ({ title, base64Data }) => {
    if (!base64Data) return null;

    const isImage = base64Data.startsWith('data:image');
    const isPdf = base64Data.startsWith('data:application/pdf');

    return (
      <div style={{ marginTop: '12px' }}>
        <div style={{ fontWeight: '500', marginBottom: '8px', color: 'var(--text-secondary)' }}>{title}</div>
        {isImage && (
          <img
            src={base64Data}
            alt={title}
            style={{ maxWidth: '300px', maxHeight: '200px', border: '1px solid var(--border-color)', borderRadius: '4px' }}
          />
        )}
        {isPdf && (
          <a
            href={base64Data}
            download={`${title}.pdf`}
            className="btn btn-link"
          >
            Download PDF
          </a>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Supplier Details"
        subtitle={`View details for ${supplier.name}`}
        extra={[
          <button
            key="back"
            className="btn btn-default"
            onClick={() => navigate('/suppliers')}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
            </svg>
            Back
          </button>,
          <button
            key="edit"
            className="btn btn-primary"
            onClick={() => navigate(`/suppliers/edit/${id}`)}
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
            Basic Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Supplier ID" value={supplier.supplierId} />
            <DescriptionRow label="Name" value={supplier.name} />
            <DescriptionRow label="Phone" value={supplier.phone} />
            <DescriptionRow label="Email" value={supplier.email || '-'} />
            <DescriptionRow label="Opening Balance" value={`₹${supplier.openingBalance?.toFixed(2) || '0.00'}`} />
            <DescriptionRow label="Status" value={renderStatusTag(supplier.active)} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Address Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Address" value={supplier.address || '-'} span={2} />
            <DescriptionRow label="State" value={supplier.state || '-'} />
            <DescriptionRow label="District" value={supplier.district || '-'} />
            <DescriptionRow label="PIN Code" value={supplier.pincode || '-'} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Tax Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="GST Number" value={supplier.gstNumber || '-'} />
            <DescriptionRow label="PAN Number" value={supplier.panNumber || '-'} />
          </div>
        </div>

        {(supplier.documents?.aadhaar || supplier.documents?.passbook || supplier.documents?.rationCard || supplier.documents?.incomeProof) && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
              Documents
            </div>
            <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <DocumentSection title="Aadhaar Card" base64Data={supplier.documents?.aadhaar} />
              <DocumentSection title="Bank Passbook" base64Data={supplier.documents?.passbook} />
              <DocumentSection title="Ration Card" base64Data={supplier.documents?.rationCard} />
              <DocumentSection title="Income Proof" base64Data={supplier.documents?.incomeProof} />
            </div>
          </div>
        )}

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            System Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Created At" value={supplier.createdAt ? dayjs(supplier.createdAt).format('DD-MM-YYYY HH:mm') : '-'} />
            <DescriptionRow label="Last Updated" value={supplier.updatedAt ? dayjs(supplier.updatedAt).format('DD-MM-YYYY HH:mm') : '-'} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierView;
