import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeeAPI, departmentAPI, designationAPI } from '../../services/api';
import { message } from '../../utils/toast';
import PageHeader from '../common/PageHeader';
import { showConfirmDialog } from '../common/ConfirmDialog';
import './EmployeeList.css';

const EmployeeList = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  const [filters, setFilters] = useState({
    search: '',
    status: 'Active',
    department: '',
    designation: '',
    employmentType: ''
  });

  const [statistics, setStatistics] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    onLeave: 0
  });

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchDepartments();
    fetchDesignations();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getActive();
      setDepartments(response.data || []);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const fetchDesignations = async () => {
    try {
      const response = await designationAPI.getActive();
      setDesignations(response.data || []);
    } catch (error) {
      console.error('Failed to fetch designations:', error);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await employeeAPI.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      });

      setEmployees(response.data || []);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || 0
      }));

      if (response.statistics) {
        setStatistics(response.statistics);
      }
    } catch (error) {
      message.error(error.message || 'Failed to fetch employees');
    } finally {
      setLoading(false);
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

  const handleDelete = async (id, employeeNumber) => {
    const confirmed = await showConfirmDialog({
      title: 'Delete Employee',
      content: `Are you sure you want to delete employee ${employeeNumber}? This will change their status to Inactive.`,
      type: 'danger'
    });

    if (confirmed) {
      try {
        await employeeAPI.delete(id);
        message.success('Employee deleted successfully');
        fetchEmployees();
      } catch (error) {
        message.error(error.message || 'Failed to delete employee');
      }
    }
  };

  const handleStatusChange = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    const confirmed = await showConfirmDialog({
      title: 'Change Status',
      content: `Change employee status to ${newStatus}?`,
      type: 'warning'
    });

    if (confirmed) {
      try {
        await employeeAPI.updateStatus(id, newStatus);
        message.success('Status updated successfully');
        fetchEmployees();
      } catch (error) {
        message.error(error.message || 'Failed to update status');
      }
    }
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'Active',
      department: '',
      designation: '',
      employmentType: ''
    });
    setPagination({ ...pagination, current: 1 });
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Active': return 'badge-success';
      case 'Inactive': return 'badge-danger';
      case 'On Leave': return 'badge-warning';
      case 'Terminated': return 'badge-danger';
      case 'Resigned': return 'badge-secondary';
      default: return 'badge-secondary';
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  return (
    <div className="employee-list-container">
      <PageHeader
        title="Employee Management"
        subtitle="Manage your organization's employees"
        extra={
          <button
            className="btn btn-primary"
            onClick={() => navigate('/hrm/employees/add')}
          >
            <i className="icon-plus"></i> Add Employee
          </button>
        }
      />

      {/* Statistics Cards */}
      <div className="statistics-grid">
        <div className="stat-card stat-card-primary">
          <div className="stat-icon">
            <i className="icon-users"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{statistics.total}</div>
            <div className="stat-label">Total Employees</div>
          </div>
        </div>
        <div className="stat-card stat-card-success">
          <div className="stat-icon">
            <i className="icon-check-circle"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{statistics.active}</div>
            <div className="stat-label">Active</div>
          </div>
        </div>
        <div className="stat-card stat-card-warning">
          <div className="stat-icon">
            <i className="icon-calendar"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{statistics.onLeave}</div>
            <div className="stat-label">On Leave</div>
          </div>
        </div>
        <div className="stat-card stat-card-danger">
          <div className="stat-icon">
            <i className="icon-user-x"></i>
          </div>
          <div className="stat-content">
            <div className="stat-value">{statistics.inactive}</div>
            <div className="stat-label">Inactive</div>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="filter-section">
        <div className="filter-row">
          <div className="search-box">
            <i className="icon-search"></i>
            <input
              type="text"
              placeholder="Search by name, number, phone, or email..."
              value={filters.search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <button
            className="btn btn-outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <i className="icon-filter"></i> {showFilters ? 'Hide' : 'Show'} Filters
          </button>
        </div>

        {showFilters && (
          <div className="advanced-filters">
            <div className="filter-group">
              <label>Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="On Leave">On Leave</option>
                <option value="Terminated">Terminated</option>
                <option value="Resigned">Resigned</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Department</label>
              <select
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept._id} value={dept._id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Designation</label>
              <select
                value={filters.designation}
                onChange={(e) => handleFilterChange('designation', e.target.value)}
              >
                <option value="">All Designations</option>
                {designations.map(desig => (
                  <option key={desig._id} value={desig._id}>{desig.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Employment Type</label>
              <select
                value={filters.employmentType}
                onChange={(e) => handleFilterChange('employmentType', e.target.value)}
              >
                <option value="">All Types</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Temporary">Temporary</option>
              </select>
            </div>

            <div className="filter-actions">
              <button className="btn btn-secondary" onClick={clearFilters}>
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Employee Table */}
      <div className="table-container">
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading employees...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="empty-state">
            <i className="icon-users"></i>
            <h3>No employees found</h3>
            <p>Try adjusting your filters or add a new employee</p>
            <button className="btn btn-primary" onClick={() => navigate('/hrm/employees/add')}>
              Add Employee
            </button>
          </div>
        ) : (
          <>
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Employee No.</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Employment Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp._id}>
                    <td className="employee-number">{emp.employeeNumber}</td>
                    <td>
                      <div className="employee-info">
                        <div className="employee-name">{emp.personalDetails?.name}</div>
                        <div className="employee-email">{emp.personalDetails?.email}</div>
                      </div>
                    </td>
                    <td>{emp.personalDetails?.phone}</td>
                    <td>{emp.employmentDetails?.department?.name || '-'}</td>
                    <td>{emp.employmentDetails?.designation?.name || '-'}</td>
                    <td>{emp.employmentDetails?.employmentType}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(emp.employmentDetails?.status)}`}>
                        {emp.employmentDetails?.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon btn-view"
                          onClick={() => navigate(`/hrm/employees/${emp._id}`)}
                          title="View Details"
                        >
                          <i className="icon-eye"></i>
                        </button>
                        <button
                          className="btn-icon btn-edit"
                          onClick={() => navigate(`/hrm/employees/${emp._id}/edit`)}
                          title="Edit"
                        >
                          <i className="icon-edit"></i>
                        </button>
                        <button
                          className="btn-icon btn-toggle"
                          onClick={() => handleStatusChange(emp._id, emp.employmentDetails?.status)}
                          title={emp.employmentDetails?.status === 'Active' ? 'Deactivate' : 'Activate'}
                        >
                          <i className={emp.employmentDetails?.status === 'Active' ? 'icon-toggle-right' : 'icon-toggle-left'}></i>
                        </button>
                        <button
                          className="btn-icon btn-delete"
                          onClick={() => handleDelete(emp._id, emp.employeeNumber)}
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
    </div>
  );
};

export default EmployeeList;
