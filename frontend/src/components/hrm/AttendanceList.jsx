import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { attendanceAPI, employeeAPI } from '../../services/api';
import { message } from '../../utils/toast';
import PageHeader from '../common/PageHeader';
import DateFilterToolbar from '../common/DateFilterToolbar';
import './AttendanceList.css';

const AttendanceList = () => {
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);

  const [dateFilter, setDateFilter] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [filters, setFilters] = useState({
    employee: '',
    status: '',
    shift: ''
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [dateFilter, filters]);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll({ status: 'Active', limit: 1000 });
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const response = await attendanceAPI.getAll({
        ...dateFilter,
        ...filters
      });

      setAttendance(response.data || []);
    } catch (error) {
      message.error(error.message || 'Failed to fetch attendance');
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
      shift: ''
    });
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      'Present': 'badge-success',
      'Absent': 'badge-danger',
      'Half Day': 'badge-warning',
      'Late': 'badge-warning',
      'On Leave': 'badge-info',
      'Holiday': 'badge-secondary',
      'Week Off': 'badge-secondary'
    };
    return classes[status] || 'badge-secondary';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (time) => {
    if (!time) return '-';
    return new Date(time).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="attendance-list-container">
      <PageHeader
        title="Attendance Management"
        subtitle="Track and manage employee attendance"
        extra={
          <div className="header-actions">
            <button
              className="btn btn-outline"
              onClick={() => navigate('/hrm/attendance/report')}
            >
              <i className="icon-bar-chart"></i> View Reports
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/hrm/attendance/mark')}
            >
              <i className="icon-check"></i> Mark Attendance
            </button>
          </div>
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
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Half Day">Half Day</option>
              <option value="Late">Late</option>
              <option value="On Leave">On Leave</option>
              <option value="Holiday">Holiday</option>
              <option value="Week Off">Week Off</option>
            </select>
          </div>

          <div className="filter-group">
            <select
              value={filters.shift}
              onChange={(e) => handleFilterChange('shift', e.target.value)}
            >
              <option value="">All Shifts</option>
              <option value="Morning">Morning</option>
              <option value="Evening">Evening</option>
              <option value="Night">Night</option>
              <option value="General">General</option>
            </select>
          </div>

          {(filters.employee || filters.status || filters.shift) && (
            <button className="btn btn-secondary" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Attendance Table */}
      <div className="table-container">
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading attendance...</p>
          </div>
        ) : attendance.length === 0 ? (
          <div className="empty-state">
            <i className="icon-calendar"></i>
            <h3>No attendance records found</h3>
            <p>No attendance data for the selected period</p>
            <button className="btn btn-primary" onClick={() => navigate('/hrm/attendance/mark')}>
              Mark Attendance
            </button>
          </div>
        ) : (
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Shift</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Working Hours</th>
                <th>Overtime</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((record) => (
                <tr key={record._id}>
                  <td>{formatDate(record.date)}</td>
                  <td>
                    <div className="employee-info">
                      <div className="employee-name">
                        {record.employee?.personalDetails?.name}
                      </div>
                      <div className="employee-number">
                        {record.employee?.employeeNumber}
                      </div>
                    </div>
                  </td>
                  <td>{record.shift}</td>
                  <td>{formatTime(record.checkIn)}</td>
                  <td>{formatTime(record.checkOut)}</td>
                  <td>{record.workingHours?.toFixed(2) || '0.00'} hrs</td>
                  <td>{record.overtimeHours?.toFixed(2) || '0.00'} hrs</td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(record.status)}`}>
                      {record.status}
                    </span>
                  </td>
                  <td>{record.remarks || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AttendanceList;
