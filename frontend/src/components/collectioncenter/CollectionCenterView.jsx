import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collectionCenterAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import { message } from '../../utils/toast';

const CollectionCenterView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [center, setCenter] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCenter();
  }, [id]);

  const fetchCenter = async () => {
    try {
      const response = await collectionCenterAPI.getById(id);
      setCenter(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch collection center');
      navigate('/collection-centers');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    return status === 'Active' ? '#52c41a' : '#ff4d4f';
  };

  const getCenterTypeColor = (type) => {
    return type === 'Head Office' ? '#1890ff' : '#722ed1';
  };

  const renderInfoRow = (label, value, highlight = false) => (
    <div className="info-row">
      <div className="info-label">{label}</div>
      <div className={`info-value ${highlight ? 'highlight' : ''}`}>
        {value || '-'}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!center) {
    return null;
  }

  return (
    <div>
      <PageHeader
        title="Collection Center Details"
        subtitle="View collection center information"
        onBack={() => navigate('/collection-centers')}
        extra={[
          <button
            key="edit"
            className="btn btn-primary"
            onClick={() => navigate(`/collection-centers/edit/${id}`)}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
            </svg>
            Edit
          </button>
        ]}
      />

      <div className="view-card">
        <div className="view-section">
          <h3 className="view-section-title">Basic Information</h3>
          <div className="view-grid">
            {renderInfoRow('Center Name', center.centerName, true)}
            {renderInfoRow(
              'Center Type',
              <span
                className="tag"
                style={{
                  backgroundColor: getCenterTypeColor(center.centerType) + '15',
                  color: getCenterTypeColor(center.centerType)
                }}
              >
                {center.centerType}
              </span>
            )}
            {renderInfoRow('Start Date', formatDate(center.startDate))}
            {renderInfoRow(
              'Status',
              <span
                className="tag"
                style={{
                  backgroundColor: getStatusColor(center.status) + '15',
                  color: getStatusColor(center.status)
                }}
              >
                {center.status}
              </span>
            )}
            {renderInfoRow('Description', center.description)}
          </div>
        </div>

        <div className="view-section">
          <h3 className="view-section-title">Address Details</h3>
          <div className="view-grid">
            {renderInfoRow('Street', center.address?.street)}
            {renderInfoRow('Village', center.address?.village)}
            {renderInfoRow('District', center.address?.district)}
            {renderInfoRow('State', center.address?.state)}
            {renderInfoRow('Pincode', center.address?.pincode)}
          </div>
        </div>

        <div className="view-section">
          <h3 className="view-section-title">Contact Details</h3>
          <div className="view-grid">
            {renderInfoRow('Incharge Name', center.contactDetails?.incharge)}
            {renderInfoRow('Phone', center.contactDetails?.phone)}
            {renderInfoRow('Email', center.contactDetails?.email)}
          </div>
        </div>

        <div className="view-section">
          <h3 className="view-section-title">System Information</h3>
          <div className="view-grid">
            {renderInfoRow('Created At', formatDate(center.createdAt))}
            {renderInfoRow('Last Updated', formatDate(center.updatedAt))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectionCenterView;
