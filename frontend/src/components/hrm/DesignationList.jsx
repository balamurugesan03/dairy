import { useState, useEffect } from 'react';
import { designationAPI, departmentAPI } from '../../services/api';
import { message } from '../../utils/toast';
import PageHeader from '../common/PageHeader';
import { showConfirmDialog } from '../common/ConfirmDialog';
import DesignationModal from './DesignationModal';
import './DesignationList.css';

const DesignationList = () => {
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState(null);
  const [departments, setDepartments] = useState([]);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  const [filters, setFilters] = useState({
    search: '',
    status: '',
    level: ''
  });

  useEffect(() => {
    fetchDesignations();
    fetchDepartments();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchDesignations = async () => {
    setLoading(true);
    try {
      const response = await designationAPI.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      });

      setDesignations(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || 0
      }));
    } catch (error) {
      message.error(error.message || 'Failed to fetch designations');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getActive();
      setDepartments(response.data || []);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
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
    setEditingDesignation(null);
    setShowModal(true);
  };

  const handleEdit = (designation) => {
    setEditingDesignation(designation);
    setShowModal(true);
  };

  const handleDelete = async (id, name) => {
    const confirmed = await showConfirmDialog({
      title: 'Delete Designation',
      content: `Are you sure you want to delete designation "${name}"? This will change its status to Inactive.`,
      type: 'danger'
    });

    if (confirmed) {
      try {
        await designationAPI.delete(id);
        message.success('Designation deleted successfully');
        fetchDesignations();
      } catch (error) {
        message.error(error.message || 'Failed to delete designation');
      }
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingDesignation(null);
  };

  const handleModalSuccess = () => {
    setShowModal(false);
    setEditingDesignation(null);
    fetchDesignations();
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      level: ''
    });
    setPagination({ ...pagination, current: 1 });
  };

  const getStatusBadgeClass = (status) => {
    return status === 'Active' ? 'badge-success' : 'badge-danger';
  };

  const getLevelBadgeClass = (level) => {
    const classes = {
      'Entry': 'badge-info',
      'Junior': 'badge-primary',
      'Mid': 'badge-warning',
      'Senior': 'badge-success',
      'Manager': 'badge-purple',
      'Executive': 'badge-danger'
    };
    return classes[level] || 'badge-secondary';
  };

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  return (
    <div className="designation-list-container">
      <PageHeader
        title="Designation Management"
        subtitle="Manage job positions and roles"
        extra={
          <button className="btn btn-primary" onClick={handleAdd}>
            <i className="icon-plus"></i> Add Designation
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
              value={filters.level}
              onChange={(e) => handleFilterChange('level', e.target.value)}
            >
              <option value="">All Levels</option>
              <option value="Entry">Entry</option>
              <option value="Junior">Junior</option>
              <option value="Mid">Mid</option>
              <option value="Senior">Senior</option>
              <option value="Manager">Manager</option>
              <option value="Executive">Executive</option>
            </select>
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
          {(filters.search || filters.status || filters.level) && (
            <button className="btn btn-secondary" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Designation Table */}
      <div className="table-container">
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading designations...</p>
          </div>
        ) : designations.length === 0 ? (
          <div className="empty-state">
            <i className="icon-briefcase"></i>
            <h3>No designations found</h3>
            <p>Get started by adding your first designation</p>
            <button className="btn btn-primary" onClick={handleAdd}>
              Add Designation
            </button>
          </div>
        ) : (
          <>
            <table className="designation-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Level</th>
                  <th>Department</th>
                  <th>Salary Range</th>
                  <th>Employees</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {designations.map((desig) => (
                  <tr key={desig._id}>
                    <td className="designation-code">{desig.code}</td>
                    <td>
                      <div className="designation-info">
                        <div className="designation-name">{desig.name}</div>
                        {desig.description && (
                          <div className="designation-desc">{desig.description}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getLevelBadgeClass(desig.level)}`}>
                        {desig.level}
                      </span>
                    </td>
                    <td>{desig.department?.name || '-'}</td>
                    <td>
                      {desig.salaryRange?.min && desig.salaryRange?.max
                        ? `₹${desig.salaryRange.min.toLocaleString('en-IN')} - ₹${desig.salaryRange.max.toLocaleString('en-IN')}`
                        : '-'
                      }
                    </td>
                    <td>{desig.employeeCount || 0}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(desig.status)}`}>
                        {desig.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon btn-edit"
                          onClick={() => handleEdit(desig)}
                          title="Edit"
                        >
                          <i className="icon-edit"></i>
                        </button>
                        <button
                          className="btn-icon btn-delete"
                          onClick={() => handleDelete(desig._id, desig.name)}
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

      {/* Designation Modal */}
      {showModal && (
        <DesignationModal
          designation={editingDesignation}
          departments={departments}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
};

export default DesignationList;
