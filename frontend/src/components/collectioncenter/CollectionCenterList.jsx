import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collectionCenterAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import { showConfirmDialog } from '../common/ConfirmDialog';
import { message } from '../../utils/toast';

const CollectionCenterList = () => {
  const navigate = useNavigate();
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    centerType: '',
    status: ''
  });

  useEffect(() => {
    fetchCenters();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchCenters = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        search: filters.search,
        centerType: filters.centerType,
        status: filters.status
      };
      const response = await collectionCenterAPI.getAll(params);
      setCenters(response.data);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.totalItems || response.data.length
      }));
    } catch (error) {
      message.error(error.message || 'Failed to fetch collection centers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    showConfirmDialog({
      title: 'Deactivate Collection Center',
      content: 'Are you sure you want to deactivate this collection center?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await collectionCenterAPI.delete(id);
          message.success('Collection center deactivated successfully');
          fetchCenters();
        } catch (error) {
          message.error(error.message || 'Failed to deactivate collection center');
        }
      }
    });
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const action = currentStatus === 'Active' ? 'deactivate' : 'activate';
    showConfirmDialog({
      title: `${currentStatus === 'Active' ? 'Deactivate' : 'Activate'} Collection Center`,
      content: `Are you sure you want to ${action} this collection center?`,
      type: currentStatus === 'Active' ? 'warning' : 'info',
      onConfirm: async () => {
        try {
          await collectionCenterAPI.toggleStatus(id);
          message.success(`Collection center ${action}d successfully`);
          fetchCenters();
        } catch (error) {
          message.error(error.message || `Failed to ${action} collection center`);
        }
      }
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, search: e.target.search.value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const getStatusColor = (status) => {
    return status === 'Active' ? '#52c41a' : '#ff4d4f';
  };

  const getCenterTypeColor = (type) => {
    return type === 'Head Office' ? '#1890ff' : '#722ed1';
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div>
      <PageHeader
        title="Collection Center Management"
        subtitle="Manage collection center information"
        extra={[
          <button
            key="add"
            className="btn btn-primary"
            onClick={() => navigate('/collection-centers/add')}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
            </svg>
            Add Collection Center
          </button>
        ]}
      />

      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            name="search"
            className="form-input"
            placeholder="Search by center name, village, or incharge"
            style={{ width: '320px' }}
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
          value={filters.centerType}
          onChange={(e) => {
            setFilters(prev => ({ ...prev, centerType: e.target.value }));
            setPagination(prev => ({ ...prev, current: 1 }));
          }}
          style={{ width: '180px' }}
        >
          <option value="">All Types</option>
          <option value="Head Office">Head Office</option>
          <option value="Sub Centre">Sub Centre</option>
        </select>

        <select
          className="form-select"
          value={filters.status}
          onChange={(e) => {
            setFilters(prev => ({ ...prev, status: e.target.value }));
            setPagination(prev => ({ ...prev, current: 1 }));
          }}
          style={{ width: '150px' }}
        >
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="billing-table" style={{ minWidth: '1000px' }}>
          <thead>
            <tr>
              <th>Center Name</th>
              <th>Center Type</th>
              <th>Start Date</th>
              <th>Village</th>
              <th>Incharge</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="loading">Loading...</div>
                </td>
              </tr>
            ) : centers.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No collection centers found
                </td>
              </tr>
            ) : (
              centers.map((center) => (
                <tr key={center._id}>
                  <td>
                    <div style={{ fontWeight: '500' }}>{center.centerName}</div>
                  </td>
                  <td>
                    <span
                      className="tag"
                      style={{
                        backgroundColor: getCenterTypeColor(center.centerType) + '15',
                        color: getCenterTypeColor(center.centerType)
                      }}
                    >
                      {center.centerType}
                    </span>
                  </td>
                  <td>{formatDate(center.startDate)}</td>
                  <td>{center.address?.village || '-'}</td>
                  <td>{center.contactDetails?.incharge || '-'}</td>
                  <td>{center.contactDetails?.phone || '-'}</td>
                  <td>
                    <span
                      className="tag"
                      style={{
                        backgroundColor: getStatusColor(center.status) + '15',
                        color: getStatusColor(center.status)
                      }}
                    >
                      {center.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon"
                        title="View"
                        onClick={() => navigate(`/collection-centers/view/${center._id}`)}
                      >
                        <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                          <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                        </svg>
                      </button>
                      <button
                        className="btn-icon"
                        title="Edit"
                        onClick={() => navigate(`/collection-centers/edit/${center._id}`)}
                      >
                        <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                        </svg>
                      </button>
                      <button
                        className="btn-icon"
                        title={center.status === 'Active' ? 'Deactivate' : 'Activate'}
                        onClick={() => handleToggleStatus(center._id, center.status)}
                        style={{ color: center.status === 'Active' ? '#ff4d4f' : '#52c41a' }}
                      >
                        <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                          <path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && centers.length > 0 && (
        <div className="pagination">
          <div className="pagination-info">
            Showing {((pagination.current - 1) * pagination.pageSize) + 1} to{' '}
            {Math.min(pagination.current * pagination.pageSize, pagination.total)} of{' '}
            {pagination.total} entries
          </div>
          <div className="pagination-buttons">
            <button
              className="btn btn-default"
              disabled={pagination.current === 1}
              onClick={() => setPagination(prev => ({ ...prev, current: prev.current - 1 }))}
            >
              Previous
            </button>
            <span className="pagination-current">Page {pagination.current}</span>
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

export default CollectionCenterList;
