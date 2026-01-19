import { useState, useEffect } from 'react';
import { departmentAPI, employeeAPI } from '../../services/api';
import { message } from '../../utils/toast';
import PageHeader from '../common/PageHeader';
import { showConfirmDialog } from '../common/ConfirmDialog';
import DepartmentModal from './DepartmentModal';
import './DepartmentList.css';

const DepartmentList = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [employees, setEmployees] = useState([]);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  const [filters, setFilters] = useState({
    search: '',
    status: ''
  });

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const response = await departmentAPI.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      });

      setDepartments(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || 0
      }));
    } catch (error) {
      message.error(error.message || 'Failed to fetch departments');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll({ status: 'Active', limit: 100 });
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const handleSearch = (value) => {
    setFilters({ ...filters, search: value });
    setPagination({ ...pagination, current: 1 });
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, current: 1 });
  };

  const handlePageChange = (newPage) => {
    setPagination({ ...pagination, current: newPage });
  };

  const handleAdd = () => {
    setEditingDepartment(null);
    setShowModal(true);
  };

  const handleEdit = (department) => {
    setEditingDepartment(department);
    setShowModal(true);
  };

  const handleDelete = async (id, name) => {
    const confirmed = await showConfirmDialog({
      title: 'Delete Department',
      content: `Are you sure you want to delete department "${name}"? This will change its status to Inactive.`,
      type: 'danger'
    });

    if (confirmed) {
      try {
        await departmentAPI.delete(id);
        message.success('Department deleted successfully');
        fetchDepartments();
      } catch (error) {
        message.error(error.message || 'Failed to delete department');
      }
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingDepartment(null);
  };

  const handleModalSuccess = () => {
    setShowModal(false);
    setEditingDepartment(null);
    fetchDepartments();
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: ''
    });
    setPagination({ ...pagination, current: 1 });
  };

  const getStatusBadgeClass = (status) => {
    return status === 'Active' ? 'badge-success' : 'badge-danger';
  };

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  return (
    <div className="department-list-container">
      <PageHeader
        title="Department Management"
        subtitle="Manage organizational departments"
        extra={
          <button className="btn btn-primary" onClick={handleAdd}>
            <i className="icon-plus"></i> Add Department
          </button>
        }
      />

      {/* Filter Section */}
      <div className="filter-section">
        <div className="filter-row">
          <div className="search-box">
            <i className="icon-search"></i>
            <input
              type="text"
              placeholder="Search by name or code..."
              value={filters.search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          {(filters.search || filters.status) && (
            <button className="btn btn-secondary" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Department Table */}
      <div className="table-container">
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading departments...</p>
          </div>
        ) : departments.length === 0 ? (
          <div className="empty-state">
            <i className="icon-building"></i>
            <h3>No departments found</h3>
            <p>Get started by adding your first department</p>
            <button className="btn btn-primary" onClick={handleAdd}>
              Add Department
            </button>
          </div>
        ) : (
          <>
            <table className="department-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Head of Department</th>
                  <th>Employees</th>
                  <th>Budget</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept._id}>
                    <td className="department-code">{dept.code}</td>
                    <td>
                      <div className="department-info">
                        <div className="department-name">{dept.name}</div>
                        {dept.description && (
                          <div className="department-desc">{dept.description}</div>
                        )}
                      </div>
                    </td>
                    <td>{dept.headOfDepartment?.personalDetails?.name || '-'}</td>
                    <td>{dept.employeeCount || 0}</td>
                    <td>₹{dept.budget?.toLocaleString('en-IN') || 0}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(dept.status)}`}>
                        {dept.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon btn-edit"
                          onClick={() => handleEdit(dept)}
                          title="Edit"
                        >
                          <i className="icon-edit"></i>
                        </button>
                        <button
                          className="btn-icon btn-delete"
                          onClick={() => handleDelete(dept._id, dept.name)}
                          title="Delete"
                        >
                          <i className="icon-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(pagination.current - 1)}
                  disabled={pagination.current === 1}
                >
                  Previous
                </button>
                <div className="pagination-info">
                  Page {pagination.current} of {totalPages} ({pagination.total} total)
                </div>
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(pagination.current + 1)}
                  disabled={pagination.current === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Department Modal */}
      {showModal && (
        <DepartmentModal
          department={editingDepartment}
          employees={employees}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
};

export default DepartmentList;
