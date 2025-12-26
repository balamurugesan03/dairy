import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customerAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import { showConfirmDialog } from '../common/ConfirmDialog';
import { message } from '../../utils/toast';

const CustomerList = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    active: 'true'
  });

  useEffect(() => {
    fetchCustomers();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        active: filters.active,
        search: filters.search
      };
      const response = await customerAPI.getAll(params);
      setCustomers(response.data);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || response.data.length
      }));
    } catch (error) {
      message.error(error.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    showConfirmDialog({
      title: 'Delete Customer',
      content: 'Are you sure you want to deactivate this customer?',
      type: 'danger',
      onConfirm: async () => {
        try {
          await customerAPI.delete(id);
          message.success('Customer deactivated successfully');
          fetchCustomers();
        } catch (error) {
          message.error(error.message || 'Failed to deactivate customer');
        }
      }
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, search: e.target.search.value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const getStatusColor = (active) => {
    return active ? '#52c41a' : '#ff4d4f';
  };

  return (
    <div>
      <PageHeader
        title="Customer Management"
        subtitle="Manage customer information"
        extra={[
          <button
            key="add"
            className="btn btn-primary"
            onClick={() => navigate('/customers/add')}
          >
            <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
            </svg>
            Add Customer
          </button>
        ]}
      />

      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            name="search"
            className="form-input"
            placeholder="Search by customer ID, name, phone, or email"
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
          value={filters.active}
          onChange={(e) => setFilters(prev => ({ ...prev, active: e.target.value }))}
          style={{ width: '120px' }}
        >
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="billing-table" style={{ minWidth: '1200px' }}>
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>State</th>
              <th>District</th>
              <th>Opening Balance</th>
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
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan="9" className="table-empty">
                  No customers found
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer._id}>
                  <td>{customer.customerId}</td>
                  <td>{customer.name}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.email || '-'}</td>
                  <td>{customer.state || '-'}</td>
                  <td>{customer.district || '-'}</td>
                  <td>₹{customer.openingBalance?.toFixed(2) || '0.00'}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: `${getStatusColor(customer.active)}20`,
                      color: getStatusColor(customer.active),
                      border: `1px solid ${getStatusColor(customer.active)}`
                    }}>
                      {customer.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-link"
                        onClick={() => navigate(`/customers/view/${customer._id}`)}
                      >
                        View
                      </button>
                      <button
                        className="btn btn-link"
                        onClick={() => navigate(`/customers/edit/${customer._id}`)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-link"
                        style={{ color: '#ff4d4f' }}
                        onClick={() => handleDelete(customer._id)}
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

export default CustomerList;
