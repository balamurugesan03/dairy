import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { subsidyAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import LoadingSpinner from '../common/LoadingSpinner';
import { message } from '../../utils/toast';
import './SubsidyView.css';

const SubsidyView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [subsidy, setSubsidy] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSubsidy();
  }, [id]);

  const fetchSubsidy = async () => {
    setLoading(true);
    try {
      const response = await subsidyAPI.getById(id);
      setSubsidy(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch subsidy details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!subsidy) {
    return null;
  }

  return (
    <div className="subsidy-view">
      <PageHeader
        title="Subsidy Details"
        subtitle={`View details for ${subsidy.subsidyName || 'Subsidy'}`}
      />

      <div className="view-actions">
        <button
          className="btn btn-default"
          onClick={() => navigate('/subsidies')}
        >
          Back to List
        </button>
      </div>

      <div className="view-card">
        <div className="view-section">
          <h3 className="section-title">Basic Information</h3>
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">Subsidy Name</div>
              <div className="detail-value">{subsidy.subsidyName}</div>
            </div>

            <div className="detail-item">
              <div className="detail-label">Subsidy Type</div>
              <div className="detail-value">
                <span className={`tag ${subsidy.subsidyType === 'Subsidy' ? 'tag-success' : 'tag-info'}`}>
                  {subsidy.subsidyType}
                </span>
              </div>
            </div>

            <div className="detail-item">
              <div className="detail-label">Ledger Group</div>
              <div className="detail-value">
                <span className="tag tag-blue">
                  {subsidy.ledgerGroup}
                </span>
              </div>
            </div>

            <div className="detail-item">
              <div className="detail-label">Status</div>
              <div className="detail-value">
                <span className={`tag ${subsidy.status === 'Active' ? 'tag-success' : 'tag-danger'}`}>
                  {subsidy.status}
                </span>
              </div>
            </div>

            <div className="detail-item full-width">
              <div className="detail-label">Description</div>
              <div className="detail-value">{subsidy.description || '-'}</div>
            </div>
          </div>
        </div>

        <div className="view-section">
          <h3 className="section-title">Timestamps</h3>
          <div className="detail-grid">
            <div className="detail-item">
              <div className="detail-label">Created At</div>
              <div className="detail-value">
                {dayjs(subsidy.createdAt).format('DD/MM/YYYY HH:mm')}
              </div>
            </div>

            <div className="detail-item">
              <div className="detail-label">Last Updated</div>
              <div className="detail-value">
                {dayjs(subsidy.updatedAt).format('DD/MM/YYYY HH:mm')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubsidyView;
