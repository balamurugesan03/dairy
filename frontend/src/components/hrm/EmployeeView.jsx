import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employeeAPI } from '../../services/api';
import { message } from '../../utils/toast';
import PageHeader from '../common/PageHeader';
import './EmployeeView.css';

const EmployeeView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');

  useEffect(() => {
    fetchEmployee();
  }, [id]);

  const fetchEmployee = async () => {
    setLoading(true);
    try {
      const response = await employeeAPI.getById(id);
      if (response.success) {
        setEmployee(response.data);
      }
    } catch (error) {
      message.error(error.message || 'Failed to fetch employee details');
      navigate('/hrm/employees');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const calculateTotalSalary = () => {
    if (!employee) return 0;
    const { basicSalary, allowances } = employee.salaryDetails || {};
    const totalAllowances = Object.values(allowances || {}).reduce((sum, val) => sum + (val || 0), 0);
    return (basicSalary || 0) + totalAllowances;
  };

  const calculateTotalDeductions = () => {
    if (!employee) return 0;
    const { deductions } = employee.salaryDetails || {};
    return Object.values(deductions || {}).reduce((sum, val) => sum + (val || 0), 0);
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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading employee details...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="empty-state">
        <i className="icon-user"></i>
        <h3>Employee not found</h3>
      </div>
    );
  }

  return (
    <div className="employee-view-container">
      <PageHeader
        title="Employee Details"
        subtitle={`Employee #${employee.employeeNumber}`}
        extra={
          <div className="header-actions">
            <button
              className="btn btn-outline"
              onClick={() => navigate('/hrm/employees')}
            >
              <i className="icon-arrow-left"></i> Back
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/hrm/employees/${id}/edit`)}
            >
              <i className="icon-edit"></i> Edit
            </button>
          </div>
        }
      />

      {/* Employee Summary Card */}
      <div className="employee-summary-card">
        <div className="employee-avatar">
          <i className="icon-user"></i>
        </div>
        <div className="employee-summary-info">
          <h2>{employee.personalDetails?.name}</h2>
          <div className="summary-details">
            <div className="detail-item">
              <i className="icon-briefcase"></i>
              <span>{employee.employmentDetails?.designation?.name || '-'}</span>
            </div>
            <div className="detail-item">
              <i className="icon-building"></i>
              <span>{employee.employmentDetails?.department?.name || '-'}</span>
            </div>
            <div className="detail-item">
              <i className="icon-phone"></i>
              <span>{employee.personalDetails?.phone}</span>
            </div>
            <div className="detail-item">
              <i className="icon-mail"></i>
              <span>{employee.personalDetails?.email || '-'}</span>
            </div>
          </div>
        </div>
        <div className="employee-status">
          <span className={`badge ${getStatusBadgeClass(employee.employmentDetails?.status)}`}>
            {employee.employmentDetails?.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'personal' ? 'active' : ''}`}
            onClick={() => setActiveTab('personal')}
          >
            <i className="icon-user"></i> Personal Details
          </button>
          <button
            className={`tab ${activeTab === 'employment' ? 'active' : ''}`}
            onClick={() => setActiveTab('employment')}
          >
            <i className="icon-briefcase"></i> Employment Details
          </button>
          <button
            className={`tab ${activeTab === 'address' ? 'active' : ''}`}
            onClick={() => setActiveTab('address')}
          >
            <i className="icon-map-pin"></i> Address
          </button>
          <button
            className={`tab ${activeTab === 'salary' ? 'active' : ''}`}
            onClick={() => setActiveTab('salary')}
          >
            <i className="icon-dollar-sign"></i> Salary & Bank
          </button>
          <button
            className={`tab ${activeTab === 'emergency' ? 'active' : ''}`}
            onClick={() => setActiveTab('emergency')}
          >
            <i className="icon-phone"></i> Emergency Contact
          </button>
        </div>

        <div className="tab-content">
          {/* Personal Details Tab */}
          {activeTab === 'personal' && (
            <div className="details-section">
              <h3>Personal Information</h3>
              <div className="details-grid">
                <div className="detail-row">
                  <label>Full Name</label>
                  <span>{employee.personalDetails?.name || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Father's Name</label>
                  <span>{employee.personalDetails?.fatherName || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Date of Birth</label>
                  <span>{formatDate(employee.personalDetails?.dob)}</span>
                </div>
                <div className="detail-row">
                  <label>Gender</label>
                  <span>{employee.personalDetails?.gender || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Phone Number</label>
                  <span>{employee.personalDetails?.phone || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Alternate Phone</label>
                  <span>{employee.personalDetails?.alternatePhone || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Email</label>
                  <span>{employee.personalDetails?.email || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Marital Status</label>
                  <span>{employee.personalDetails?.maritalStatus || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Blood Group</label>
                  <span>{employee.personalDetails?.bloodGroup || '-'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Employment Details Tab */}
          {activeTab === 'employment' && (
            <div className="details-section">
              <h3>Employment Information</h3>
              <div className="details-grid">
                <div className="detail-row">
                  <label>Employee Number</label>
                  <span>{employee.employeeNumber}</span>
                </div>
                <div className="detail-row">
                  <label>Department</label>
                  <span>{employee.employmentDetails?.department?.name || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Designation</label>
                  <span>{employee.employmentDetails?.designation?.name || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Date of Joining</label>
                  <span>{formatDate(employee.employmentDetails?.dateOfJoining)}</span>
                </div>
                <div className="detail-row">
                  <label>Employment Type</label>
                  <span>{employee.employmentDetails?.employmentType || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Working Hours</label>
                  <span>{employee.employmentDetails?.workingHours || 0} hours/day</span>
                </div>
                <div className="detail-row">
                  <label>Reporting To</label>
                  <span>{employee.employmentDetails?.reportingTo?.personalDetails?.name || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Probation Period</label>
                  <span>{employee.employmentDetails?.probationPeriod || 0} months</span>
                </div>
                <div className="detail-row">
                  <label>Confirmation Date</label>
                  <span>{formatDate(employee.employmentDetails?.confirmationDate)}</span>
                </div>
                <div className="detail-row">
                  <label>Status</label>
                  <span className={`badge ${getStatusBadgeClass(employee.employmentDetails?.status)}`}>
                    {employee.employmentDetails?.status}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Address Tab */}
          {activeTab === 'address' && (
            <div className="details-section">
              <h3>Current Address</h3>
              <div className="details-grid">
                <div className="detail-row full-width">
                  <label>Street</label>
                  <span>{employee.address?.currentAddress?.street || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Village</label>
                  <span>{employee.address?.currentAddress?.village || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>City</label>
                  <span>{employee.address?.currentAddress?.city || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>District</label>
                  <span>{employee.address?.currentAddress?.district || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>State</label>
                  <span>{employee.address?.currentAddress?.state || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Pincode</label>
                  <span>{employee.address?.currentAddress?.pincode || '-'}</span>
                </div>
              </div>

              <h3 style={{ marginTop: '30px' }}>Permanent Address</h3>
              <div className="details-grid">
                <div className="detail-row full-width">
                  <label>Street</label>
                  <span>{employee.address?.permanentAddress?.street || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Village</label>
                  <span>{employee.address?.permanentAddress?.village || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>City</label>
                  <span>{employee.address?.permanentAddress?.city || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>District</label>
                  <span>{employee.address?.permanentAddress?.district || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>State</label>
                  <span>{employee.address?.permanentAddress?.state || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Pincode</label>
                  <span>{employee.address?.permanentAddress?.pincode || '-'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Salary & Bank Tab */}
          {activeTab === 'salary' && (
            <div className="details-section">
              <h3>Bank Details</h3>
              <div className="details-grid">
                <div className="detail-row">
                  <label>Account Holder Name</label>
                  <span>{employee.bankDetails?.accountHolderName || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Account Number</label>
                  <span>{employee.bankDetails?.accountNumber || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Bank Name</label>
                  <span>{employee.bankDetails?.bankName || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Branch Name</label>
                  <span>{employee.bankDetails?.branchName || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>IFSC Code</label>
                  <span>{employee.bankDetails?.ifscCode || '-'}</span>
                </div>
              </div>

              <h3 style={{ marginTop: '30px' }}>Salary Structure</h3>
              <div className="salary-breakdown">
                <div className="salary-column">
                  <h4>Earnings</h4>
                  <div className="salary-items">
                    <div className="salary-item">
                      <span>Basic Salary</span>
                      <span className="amount">₹{employee.salaryDetails?.basicSalary?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="salary-item">
                      <span>HRA</span>
                      <span className="amount">₹{employee.salaryDetails?.allowances?.hra?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="salary-item">
                      <span>DA</span>
                      <span className="amount">₹{employee.salaryDetails?.allowances?.da?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="salary-item">
                      <span>TA</span>
                      <span className="amount">₹{employee.salaryDetails?.allowances?.ta?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="salary-item">
                      <span>Medical Allowance</span>
                      <span className="amount">₹{employee.salaryDetails?.allowances?.medical?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="salary-item">
                      <span>Special Allowance</span>
                      <span className="amount">₹{employee.salaryDetails?.allowances?.special?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="salary-item total">
                      <span>Total Earnings</span>
                      <span className="amount">₹{calculateTotalSalary().toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="salary-column">
                  <h4>Deductions</h4>
                  <div className="salary-items">
                    <div className="salary-item">
                      <span>PF</span>
                      <span className="amount">₹{employee.salaryDetails?.deductions?.pf?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="salary-item">
                      <span>ESI</span>
                      <span className="amount">₹{employee.salaryDetails?.deductions?.esi?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="salary-item">
                      <span>Professional Tax</span>
                      <span className="amount">₹{employee.salaryDetails?.deductions?.pt?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="salary-item">
                      <span>TDS</span>
                      <span className="amount">₹{employee.salaryDetails?.deductions?.tds?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="salary-item">
                      <span>Loan</span>
                      <span className="amount">₹{employee.salaryDetails?.deductions?.loan?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="salary-item">
                      <span>Advance</span>
                      <span className="amount">₹{employee.salaryDetails?.deductions?.advance?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="salary-item total">
                      <span>Total Deductions</span>
                      <span className="amount">₹{calculateTotalDeductions().toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="net-salary">
                <span>Net Salary</span>
                <span className="amount">₹{(calculateTotalSalary() - calculateTotalDeductions()).toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Emergency Contact Tab */}
          {activeTab === 'emergency' && (
            <div className="details-section">
              <h3>Emergency Contact Information</h3>
              <div className="details-grid">
                <div className="detail-row">
                  <label>Contact Name</label>
                  <span>{employee.emergencyContact?.name || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Relationship</label>
                  <span>{employee.emergencyContact?.relationship || '-'}</span>
                </div>
                <div className="detail-row">
                  <label>Phone Number</label>
                  <span>{employee.emergencyContact?.phone || '-'}</span>
                </div>
                <div className="detail-row full-width">
                  <label>Address</label>
                  <span>{employee.emergencyContact?.address || '-'}</span>
                </div>
              </div>

              {employee.remarks && (
                <>
                  <h3 style={{ marginTop: '30px' }}>Remarks</h3>
                  <div className="remarks-box">
                    <p>{employee.remarks}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeView;
