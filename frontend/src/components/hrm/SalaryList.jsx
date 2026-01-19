import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { salaryAPI, employeeAPI } from '../../services/api';
import { message } from '../../utils/toast';
import PageHeader from '../common/PageHeader';
import './SalaryList.css';

const SalaryList = () => {
  const navigate = useNavigate();
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);

  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    employee: '',
    status: ''
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchSalaries();
  }, [filters]);

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll({ status: 'Active', limit: 1000 });
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchSalaries = async () => {
    setLoading(true);
    try {
      const response = await salaryAPI.getAll(filters);
      setSalaries(response.data || []);
    } catch (error) {
      message.error(error.message || 'Failed to fetch salaries');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    setFilters({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      employee: '',
      status: ''
    });
  };

  const handleProcess = async (id) => {
    try {
      await salaryAPI.approve(id, 'Admin');
      message.success('Salary processed successfully');
      fetchSalaries();
    } catch (error) {
      message.error(error.message || 'Failed to process salary');
    }
  };

  const handleMarkPaid = async (id) => {
    try {
      await salaryAPI.markPaid(id, { paidDate: new Date() });
      message.success('Salary marked as paid');
      fetchSalaries();
    } catch (error) {
      message.error(error.message || 'Failed to mark as paid');
    }
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      'Draft': 'badge-secondary',
      'Pending': 'badge-warning',
      'Approved': 'badge-info',
      'Paid': 'badge-success',
      'Cancelled': 'badge-danger'
    };
    return classes[status] || 'badge-secondary';
  };

  const formatMonth = (month) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1];
  };

  return (
    <div className="salary-list-container">
      <PageHeader
        title="Salary Management"
        subtitle="Process and manage employee salaries"
        extra={
          <button
            className="btn btn-primary"
            onClick={() => navigate('/hrm/salary/process')}
          >
            <i className="icon-dollar-sign"></i> Process Salary
          </button>
        }
      />

      {/* Filter Section */}
      <div className="filter-section">
        <div className="filter-row">
          <div className="filter-group">
            <label>Month</label>
            <select
              value={filters.month}
              onChange={(e) => handleFilterChange('month', parseInt(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{formatMonth(m)}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Year</label>
            <select
              value={filters.year}
              onChange={(e) => handleFilterChange('year', parseInt(e.target.value))}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

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
              <option value="Draft">Draft</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Paid">Paid</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {(filters.employee || filters.status) && (
            <button className="btn btn-secondary" onClick={clearFilters}>
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Salary Table */}
      <div className="table-container">
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading salaries...</p>
          </div>
        ) : salaries.length === 0 ? (
          <div className="empty-state">
            <i className="icon-dollar-sign"></i>
            <h3>No salary records found</h3>
            <p>No salary data for the selected period</p>
            <button className="btn btn-primary" onClick={() => navigate('/hrm/salary/process')}>
              Process Salary
            </button>
          </div>
        ) : (
          <table className="salary-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Period</th>
                <th>Basic Salary</th>
                <th>Allowances</th>
                <th>Deductions</th>
                <th>Net Salary</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {salaries.map((salary) => (
                <tr key={salary._id}>
                  <td>
                    <div className="employee-info">
                      <div className="employee-name">
                        {salary.employee?.personalDetails?.name}
                      </div>
                      <div className="employee-number">
                        {salary.employee?.employeeNumber}
                      </div>
                    </div>
                  </td>
                  <td>{formatMonth(salary.month)} {salary.year}</td>
                  <td>₹{salary.basicSalary?.toLocaleString('en-IN')}</td>
                  <td>₹{salary.totalAllowances?.toLocaleString('en-IN')}</td>
                  <td>₹{salary.totalDeductions?.toLocaleString('en-IN')}</td>
                  <td className="net-salary">₹{salary.netSalary?.toLocaleString('en-IN')}</td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(salary.status)}`}>
                      {salary.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      {salary.status === 'Pending' && (
                        <button
                          className="btn-icon btn-success"
                          onClick={() => handleProcess(salary._id)}
                          title="Approve"
                        >
                          <i className="icon-check"></i>
                        </button>
                      )}
                      {salary.status === 'Approved' && (
                        <button
                          className="btn-icon btn-primary"
                          onClick={() => handleMarkPaid(salary._id)}
                          title="Mark Paid"
                        >
                          <i className="icon-dollar-sign"></i>
                        </button>
                      )}
                      <button
                        className="btn-icon btn-view"
                        onClick={() => navigate(`/hrm/salary/${salary._id}`)}
                        title="View"
                      >
                        <i className="icon-eye"></i>
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

export default SalaryList;
