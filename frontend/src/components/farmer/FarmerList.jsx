import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { farmerAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import { showConfirmDialog } from '../common/ConfirmDialog';
import { message } from '../../utils/toast';

const FarmerList = () => {
  const navigate = useNavigate();
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    status: 'Active',
    farmerType: ''
  });

  useEffect(() => {
    fetchFarmers();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchFarmers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        status: filters.status,
        farmerType: filters.farmerType,
        search: filters.search
      };
      const response = await farmerAPI.getAll(params);
      setFarmers(response.data.farmers || response.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.total || response.data.length
      }));
    } catch (error) {
      message.error(error.message || 'Failed to fetch farmers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    showConfirmDialog({
      title: 'Delete Farmer',
      content: 'Are you sure you want to deactivate this farmer?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await farmerAPI.delete(id);
          message.success('Farmer deactivated successfully');
          fetchFarmers();
        } catch (error) {
          message.error(error.message || 'Failed to deactivate farmer');
        }
      }
    });
  };

  const handleMembershipToggle = async (id, currentStatus) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    showConfirmDialog({
      title: `${currentStatus ? 'Deactivate' : 'Activate'} Membership`,
      content: `Are you sure you want to ${action} membership for this farmer?`,
      type: currentStatus ? 'warning' : 'info',
      onConfirm: async () => {
        try {
          await farmerAPI.toggleMembership(id);
          message.success(`Membership ${action}d successfully`);
          fetchFarmers();
        } catch (error) {
          message.error(error.message || `Failed to ${action} membership`);
        }
      }
    });
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
    return value === 'Active' ? '#52c41a' : '#ff4d4f';
  };

  return (
    <div>
      <PageHeader
        title="Farmer Management"
        subtitle="Manage dairy cooperative farmers"
        extra={[
          <button
            key="add"
            className="btn btn-primary"
            onClick={() => navigate('/farmers/add')}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
            </svg>
            Add Farmer
          </button>
        ]}
      />

      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            name="search"
            className="form-input"
            placeholder="Search by farmer number, name, or phone"
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
          value={filters.status}
          onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          style={{ width: '120px' }}
        >
          <option value="">All</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

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
        <table className="billing-table" style={{ minWidth: '1300px' }}>
          <thead>
            <tr>
              <th>Farmer No.</th>
              <th>Member ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Village</th>
              <th>Farmer Type</th>
              <th>Membership</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="spinner"></div>
                  Loading...
                </td>
              </tr>
            ) : farmers.length === 0 ? (
              <tr>
                <td colSpan="9" className="table-empty">
                  No farmers found
                </td>
              </tr>
            ) : (
              farmers.map((farmer) => (
                <tr key={farmer._id}>
                  <td>{farmer.farmerNumber}</td>
                  <td>{farmer.memberId || '-'}</td>
                  <td>{farmer.personalDetails?.name || '-'}</td>
                  <td>{farmer.personalDetails?.phone || '-'}</td>
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
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: farmer.isMembership ? '#52c41a20' : '#d9d9d920',
                      color: farmer.isMembership ? '#52c41a' : '#8c8c8c',
                      border: `1px solid ${farmer.isMembership ? '#52c41a' : '#d9d9d9'}`
                    }}>
                      {farmer.isMembership ? 'Member' : 'Non-Member'}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: `${getTagColor('status', farmer.status)}20`,
                      color: getTagColor('status', farmer.status),
                      border: `1px solid ${getTagColor('status', farmer.status)}`
                    }}>
                      {farmer.status}
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
                        style={{ color: farmer.isMembership ? '#faad14' : '#1890ff' }}
                        onClick={() => handleMembershipToggle(farmer._id, farmer.isMembership)}
                      >
                        {farmer.isMembership ? 'Remove Member' : 'Add Member'}
                      </button>
                      <button
                        className="btn btn-link"
                        style={{ color: '#ff4d4f' }}
                        onClick={() => handleDelete(farmer._id)}
                      >
                        Delete
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
    </div>
  );
};

export default FarmerList;
