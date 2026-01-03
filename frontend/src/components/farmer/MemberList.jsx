import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { farmerAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import { showConfirmDialog } from '../common/ConfirmDialog';
import { message } from '../../utils/toast';
import AddShareModal from './AddShareModal';
import TerminateModal from './TerminateModal';

const MemberList = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    farmerType: ''
  });
  const [showShareModal, setShowShareModal] = useState(false);
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState(null);

  useEffect(() => {
    fetchMembers();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        status: 'Active',
        farmerType: filters.farmerType,
        search: filters.search
      };
      const response = await farmerAPI.getAll(params);
      // Filter only members (farmers with isMembership = true)
      const memberFarmers = (response.data.farmers || response.data).filter(
        farmer => farmer.isMembership === true
      );
      setMembers(memberFarmers);
      setPagination(prev => ({
        ...prev,
        total: memberFarmers.length
      }));
    } catch (error) {
      message.error(error.message || 'Failed to fetch member farmers');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMembership = async (id) => {
    showConfirmDialog({
      title: 'Remove Membership',
      content: 'Are you sure you want to remove membership for this farmer?',
      type: 'warning',
      onConfirm: async () => {
        try {
          await farmerAPI.toggleMembership(id);
          message.success('Membership removed successfully');
          fetchMembers();
        } catch (error) {
          message.error(error.message || 'Failed to remove membership');
        }
      }
    });
  };

  const handleAddShare = (farmer) => {
    setSelectedFarmer(farmer);
    setShowShareModal(true);
  };

  const handleShareSuccess = () => {
    fetchMembers();
    setShowShareModal(false);
    setSelectedFarmer(null);
  };

  const handleTerminate = (farmer) => {
    setSelectedFarmer(farmer);
    setShowTerminateModal(true);
  };

  const handleTerminateSuccess = () => {
    fetchMembers();
    setShowTerminateModal(false);
    setSelectedFarmer(null);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, search: e.target.search.value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const getTagColor = (type, value) => {
    if (type === 'farmerType') {
      return value === 'A' ? '#1890ff' : value === 'B' ? '#52c41a' : '#faad14';
    }
    return '#52c41a';
  };

  return (
    <div>
      <PageHeader
        title="Member Farmers"
        subtitle="View and manage all member farmers"
        extra={[
          <button
            key="back"
            className="btn btn-default"
            onClick={() => navigate('/farmers')}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
            </svg>
            Back to Farmers
          </button>
        ]}
      />

      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            name="search"
            className="form-input"
            placeholder="Search by member ID, name, or phone"
            style={{ width: '350px' }}
          />
          <button type="submit" className="btn btn-default">
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
            </svg>
            Search
          </button>
        </form>

        <select
          className="form-select"
          value={filters.farmerType}
          onChange={(e) => setFilters(prev => ({ ...prev, farmerType: e.target.value }))}
          style={{ width: '120px' }}
        >
          <option value="">All Types</option>
          <option value="A">Type A</option>
          <option value="B">Type B</option>
          <option value="C">Type C</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="billing-table" style={{ minWidth: '1200px' }}>
          <thead>
            <tr>
              <th>Farmer No.</th>
              <th>Member ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Collection Center</th>
              <th>Admission Date</th>
              <th>Village</th>
              <th>Farmer Type</th>
              <th>Total Shares</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="spinner"></div>
                  Loading...
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan="10" className="table-empty">
                  No member farmers found
                </td>
              </tr>
            ) : (
              members.map((farmer) => (
                <tr key={farmer._id}>
                  <td>{farmer.farmerNumber}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: '#e6f7ff',
                      color: '#0958d9',
                      border: '1px solid #91d5ff'
                    }}>
                      {farmer.memberId || '-'}
                    </span>
                  </td>
                  <td>{farmer.personalDetails?.name || '-'}</td>
                  <td>{farmer.personalDetails?.phone || '-'}</td>
                  <td>
                    {farmer.collectionCenter ? (
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: '#f0f5ff',
                        color: '#1890ff',
                        border: '1px solid #adc6ff'
                      }}>
                        {farmer.collectionCenter.centerName}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    {farmer.admissionDate ? (
                      <span style={{
                        fontSize: '13px',
                        color: 'var(--text-primary)'
                      }}>
                        {new Date(farmer.admissionDate).toLocaleDateString('en-IN')}
                      </span>
                    ) : '-'}
                  </td>
                  <td>{farmer.address?.village || '-'}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: `${getTagColor('farmerType', farmer.farmerType)}20`,
                      color: getTagColor('farmerType', farmer.farmerType),
                      border: `1px solid ${getTagColor('farmerType', farmer.farmerType)}`
                    }}>
                      {farmer.farmerType}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontWeight: '600',
                      background: '#f0f5ff',
                      color: '#1890ff',
                      border: '1px solid #adc6ff'
                    }}>
                      {farmer.financialDetails?.totalShares || 0}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-link"
                        onClick={() => navigate(`/farmers/view/${farmer._id}`)}
                      >
                        View
                      </button>
                      <button
                        className="btn btn-link"
                        onClick={() => navigate(`/farmers/edit/${farmer._id}`)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-link"
                        style={{ color: '#1890ff' }}
                        onClick={() => handleAddShare(farmer)}
                      >
                        Add Share
                      </button>
                      <button
                        className="btn btn-link"
                        style={{ color: '#ff4d4f' }}
                        onClick={() => handleTerminate(farmer)}
                      >
                        Terminate
                      </button>
                      <button
                        className="btn btn-link"
                        style={{ color: '#faad14' }}
                        onClick={() => handleRemoveMembership(farmer._id)}
                      >
                        Remove Member
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.total > pagination.pageSize && (
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            Showing {(pagination.current - 1) * pagination.pageSize + 1} to {Math.min(pagination.current * pagination.pageSize, pagination.total)} of {pagination.total} entries
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-default"
              disabled={pagination.current === 1}
              onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
            >
              Previous
            </button>
            <button
              className="btn btn-default"
              disabled={pagination.current * pagination.pageSize >= pagination.total}
              onClick={() => setPagination(prev => ({ ...prev, current: prev.current + 1 }))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showShareModal && selectedFarmer && (
        <AddShareModal
          farmer={selectedFarmer}
          onClose={() => {
            setShowShareModal(false);
            setSelectedFarmer(null);
          }}
          onSuccess={handleShareSuccess}
        />
      )}

      {showTerminateModal && selectedFarmer && (
        <TerminateModal
          farmer={selectedFarmer}
          onClose={() => {
            setShowTerminateModal(false);
            setSelectedFarmer(null);
          }}
          onSuccess={handleTerminateSuccess}
        />
      )}
    </div>
  );
};

export default MemberList;
