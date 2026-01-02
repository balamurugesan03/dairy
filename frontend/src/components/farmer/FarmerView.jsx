import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { farmerAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import LoadingSpinner from '../common/LoadingSpinner';
import { message } from '../../utils/toast';

const FarmerView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [farmer, setFarmer] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFarmer();
  }, [id]);

  const fetchFarmer = async () => {
    setLoading(true);
    try {
      const response = await farmerAPI.getById(id);
      setFarmer(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch farmer details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!farmer) {
    return null;
  }

  const getTagColor = (type, value) => {
    if (type === 'status') {
      return value === 'Active' ? '#52c41a' : '#ff4d4f';
    }
    if (type === 'farmerType') {
      return value === 'A' ? '#1890ff' : value === 'B' ? '#52c41a' : '#faad14';
    }
    return '#1890ff';
  };

  const renderTag = (type, value) => (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500',
      background: `${getTagColor(type, value)}20`,
      color: getTagColor(type, value),
      border: `1px solid ${getTagColor(type, value)}`
    }}>
      {value}
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
        title="Farmer Details"
        subtitle={`View details for ${farmer.personalDetails?.name || 'Farmer'}`}
        extra={[
          <button
            key="back"
            className="btn btn-default"
            onClick={() => navigate('/farmers')}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
            </svg>
            Back
          </button>,
          <button
            key="edit"
            className="btn btn-primary"
            onClick={() => navigate(`/farmers/edit/${id}`)}
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
            <DescriptionRow label="Farmer ID" value={farmer.farmerId} />
            <DescriptionRow label="Farmer Number" value={farmer.farmerNumber} />
            <DescriptionRow label="Member ID" value={farmer.memberId || '-'} />
            <DescriptionRow label="Status" value={renderTag('status', farmer.status)} />
            <DescriptionRow label="Farmer Type" value={renderTag('farmerType', `Type ${farmer.farmerType}`)} />
            <DescriptionRow label="Cow Type" value={farmer.cowType || '-'} />
            <DescriptionRow label="Ledger ID" value={farmer.ledgerId?.ledgerName || farmer.ledgerId || '-'} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Personal Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Name" value={farmer.personalDetails?.name || '-'} />
            <DescriptionRow label="Father's Name" value={farmer.personalDetails?.fatherName || '-'} />
            <DescriptionRow label="Age" value={farmer.personalDetails?.age || '-'} />
            <DescriptionRow label="Date of Birth" value={farmer.personalDetails?.dob ? dayjs(farmer.personalDetails.dob).format('DD-MM-YYYY') : '-'} />
            <DescriptionRow label="Gender" value={farmer.personalDetails?.gender || '-'} />
            <DescriptionRow label="Phone" value={farmer.personalDetails?.phone || '-'} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Address
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Ward" value={farmer.address?.ward || '-'} />
            <DescriptionRow label="Village" value={farmer.address?.village || '-'} />
            <DescriptionRow label="Panchayat" value={farmer.address?.panchayat || '-'} />
            <DescriptionRow label="PIN Code" value={farmer.address?.pin || '-'} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Identity Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Aadhaar Number" value={farmer.identityDetails?.aadhaar || '-'} />
            <DescriptionRow label="PAN Number" value={farmer.identityDetails?.pan || '-'} />
            <DescriptionRow label="Welfare Number" value={farmer.identityDetails?.welfareNo || '-'} />
            <DescriptionRow label="Ksheerasree ID" value={farmer.identityDetails?.ksheerasreeId || '-'} />
            <DescriptionRow label="ID Card Number" value={farmer.identityDetails?.idCardNumber || '-'} />
            <DescriptionRow label="Issue Date" value={farmer.identityDetails?.issueDate ? dayjs(farmer.identityDetails.issueDate).format('DD-MM-YYYY') : '-'} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Bank Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Account Number" value={farmer.bankDetails?.accountNumber || '-'} />
            <DescriptionRow label="Bank Name" value={farmer.bankDetails?.bankName || '-'} />
            <DescriptionRow label="Branch" value={farmer.bankDetails?.branch || '-'} />
            <DescriptionRow label="IFSC Code" value={farmer.bankDetails?.ifsc || '-'} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Financial Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Share Value" value={`₹${farmer.financialDetails?.shareValue || 0}`} />
            <DescriptionRow label="Admission Fee" value={`₹${farmer.financialDetails?.admissionFee || 0}`} />
            <DescriptionRow label="Resolution Number" value={farmer.financialDetails?.resolutionNo || '-'} />
            <DescriptionRow label="Resolution Date" value={farmer.financialDetails?.resolutionDate ? dayjs(farmer.financialDetails.resolutionDate).format('DD-MM-YYYY') : '-'} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            Documents
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Aadhaar Document" value={farmer.documents?.aadhaar ? 'Uploaded' : '-'} />
            <DescriptionRow label="Bank Passbook" value={farmer.documents?.bankPassbook ? 'Uploaded' : '-'} />
            <DescriptionRow label="Ration Card" value={farmer.documents?.rationCard ? 'Uploaded' : '-'} />
            <DescriptionRow label="Income Proof" value={farmer.documents?.incomeProof ? 'Uploaded' : '-'} />
            {farmer.documents?.additionalDocuments && farmer.documents.additionalDocuments.length > 0 && (
              <DescriptionRow
                label="Additional Documents"
                value={`${farmer.documents.additionalDocuments.length} document(s) uploaded`}
                span={2}
              />
            )}
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', fontSize: '16px' }}>
            System Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <DescriptionRow label="Created At" value={farmer.createdAt ? dayjs(farmer.createdAt).format('DD-MM-YYYY HH:mm:ss') : '-'} />
            <DescriptionRow label="Updated At" value={farmer.updatedAt ? dayjs(farmer.updatedAt).format('DD-MM-YYYY HH:mm:ss') : '-'} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FarmerView;
