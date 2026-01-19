import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { leaveAPI, employeeAPI } from '../../services/api';
import { message } from '../../utils/toast';
import PageHeader from '../common/PageHeader';
import DateFilterToolbar from '../common/DateFilterToolbar';
import { showConfirmDialog } from '../common/ConfirmDialog';
import './LeaveList.css';

const LeaveList = () => {
  const navigate = useNavigate();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);

  const [dateFilter, setDateFilter] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [filters, setFilters] = useState({
    employee: '',
    status: '',
    leaveType: ''
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [dateFilter, filters]);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll({ status: 'Active', limit: 1000 });
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const response = await leaveAPI.getAll({
        ...dateFilter,
        ...filters
      });

      setLeaves(response.data || []);
    } catch (error) {
      message.error(error.message || 'Failed to fetch leaves');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    setFilters({
      employee: '',
      status: '',
      leaveType: ''
    });
  };

  const handleApprove = async (id, employeeName) => {
    const confirmed = await showConfirmDialog({
      title: 'Approve Leave',
      content: `Approve leave request for ${employeeName}?`,
      type: 'success'
    });

    if (confirmed) {
      try {
        await leaveAPI.approve(id, { remarks: 'Approved' });
        message.success('Leave approved successfully');
        fetchLeaves();
      } catch (error) {
        message.error(error.message || 'Failed to approve leave');
      }
    }
  };

  const handleReject = async (id, employeeName) => {
    const confirmed = await showConfirmDialog({
      title: 'Reject Leave',
      content: `Reject leave request for ${employeeName}?`,
      type: 'danger'
    });

    if (confirmed) {
      try {
        await leaveAPI.reject(id, { rejectionReason: 'Rejected' });
        message.success('Leave rejected successfully');
        fetchLeaves();
      } catch (error) {
        message.error(error.message || 'Failed to reject leave');
      }
    }
  };

  const handleDelete = async (id, employeeName) => {
    const confirmed = await showConfirmDialog({
      title: 'Delete Leave',
      content: `Delete leave request for ${employeeName}?`,
      type: 'danger'
    });

    if (confirmed) {
      try {
        await leaveAPI.delete(id);
        message.success('Leave deleted successfully');
        fetchLeaves();
      } catch (error) {
        message.error(error.message || 'Failed to delete leave');
      }
    }
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      'Pending': 'badge-warning',
      'Approved': 'badge-success',
      'Rejected': 'badge-danger',
      'Cancelled': 'badge-secondary'
    };
    return classes[status] || 'badge-secondary';
  };

  const getLeaveTypeBadgeClass = (type) => {
    const classes = {
      'Casual': 'badge-primary',
      'Sick': 'badge-danger',
      'Earned': 'badge-success',
      'Maternity': 'badge-purple',
      'Paternity': 'badge-info',
      'Unpaid': 'badge-secondary',
      'Compensatory': 'badge-warning'
    };
    return classes[type] || 'badge-secondary';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="leave-list-container">
      <PageHeader
        title="Leave Management"
        subtitle="Manage employee leave requests"
        extra={
          <button
            className="btn btn-primary"
            onClick={() => navigate('/hrm/leaves/apply')}
          >
            <i className="icon-plus"></i> Apply Leave
          </button>
        }
      />

      {/* Date Filter */}
      <DateFilterToolbar
        startDate={dateFilter.startDate}
        endDate={dateFilter.endDate}
        onStartDateChange={(date) => setDateFilter({ ...dateFilter, startDate: date })}
        onEndDateChange={(date) => setDateFilter({ ...dateFilter, endDate: date })}
      />

      {/* Filter Section */}
      <div className="filter-section">
        <div className="filter-row">
          <div className="filter-group">
            <select
              value={filters.employee}
              onChange={(e) => handleFilterChange('employee', e.target.value)}
            >
              <option value="">All Employees</option>
              {employees.map(emp => (
                <option key={emp._id} value={emp._id}>
                  {emp.personalDetails?.name} ({emp.employeeNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <select
              value={filters.leaveType}
              onChange={(e) => handleFilterChange('leaveType', e.target.value)}
            >
              <option value="">All Leave Types</option>
              <option value="Casual">Casual</option>
              <option value="Sick">Sick</option>
              <option value="Earned">Earned</option>
              <option value="Maternity">Maternity</option>
              <option value="Paternity">Paternity</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Compensatory">Compensatory</option>
            </select>
          </div>

          <div className="filter-group">
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {(filters.employee || filters.status || filters.leaveType) && (
            <button className="btn btn-secondary" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Leave Table */}
      <div className="table-container">
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading leaves...</p>
          </div>
        ) : leaves.length === 0 ? (
          <div className="empty-state">
            <i className="icon-calendar"></i>
            <h3>No leave records found</h3>
            <p>No leave applications for the selected period</p>
            <button className="btn btn-primary" onClick={() => navigate('/hrm/leaves/apply')}>
              Apply Leave
            </button>
          </div>
        ) : (
          <table className="leave-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Leave Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Applied Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((leave) => (
                <tr key={leave._id}>
                  <td>
                    <div className="employee-info">
                      <div className="employee-name">
                        {leave.employee?.personalDetails?.name}
                      </div>
                      <div className="employee-number">
                        {leave.employee?.employeeNumber}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${getLeaveTypeBadgeClass(leave.leaveType)}`}>
                      {leave.leaveType}
                    </span>
                  </td>
                  <td>{formatDate(leave.startDate)}</td>
                  <td>{formatDate(leave.endDate)}</td>
                  <td>{leave.numberOfDays}</td>
                  <td>
                    <div className="leave-reason">{leave.reason}</div>
                  </td>
                  <td>{formatDate(leave.appliedDate)}</td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(leave.status)}`}>
                      {leave.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      {leave.status === 'Pending' && (
                        <>
                          <button
                            className="btn-icon btn-success"
                            onClick={() => handleApprove(leave._id, leave.employee?.personalDetails?.name)}
                            title="Approve"
                          >
                            <i className="icon-check"></i>
                          </button>
                          <button
                            className="btn-icon btn-danger"
                            onClick={() => handleReject(leave._id, leave.employee?.personalDetails?.name)}
                            title="Reject"
                          >
                            <i className="icon-x"></i>
                          </button>
                        </>
                      )}
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(leave._id, leave.employee?.personalDetails?.name)}
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
        )}
      </div>
    </div>
  );
};

export default LeaveList;
