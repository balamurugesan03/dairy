import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { employeeAPI, departmentAPI, designationAPI } from '../../services/api';
import { message } from '../../utils/toast';
import PageHeader from '../common/PageHeader';
import './EmployeeForm.css';

const EmployeeForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [employees, setEmployees] = useState([]); // For reporting to

  const [formData, setFormData] = useState({
    employeeNumber: '',
    personalDetails: {
      name: '',
      fatherName: '',
      dob: '',
      gender: 'Male',
      phone: '',
      alternatePhone: '',
      email: '',
      maritalStatus: '',
      bloodGroup: ''
    },
    employmentDetails: {
      designation: '',
      department: '',
      dateOfJoining: '',
      employmentType: 'Full-time',
      workingHours: 8,
      reportingTo: '',
      probationPeriod: 3,
      confirmationDate: '',
      status: 'Active'
    },
    address: {
      currentAddress: {
        street: '',
        village: '',
        city: '',
        district: '',
        state: '',
        pincode: ''
      },
      permanentAddress: {
        street: '',
        village: '',
        city: '',
        district: '',
        state: '',
        pincode: '',
        sameAsCurrent: false
      }
    },
    bankDetails: {
      accountNumber: '',
      accountHolderName: '',
      bankName: '',
      branchName: '',
      ifscCode: ''
    },
    salaryDetails: {
      basicSalary: 0,
      allowances: {
        hra: 0,
        da: 0,
        ta: 0,
        medical: 0,
        special: 0,
        other: 0
      },
      deductions: {
        pf: 0,
        esi: 0,
        pt: 0,
        tds: 0,
        loan: 0,
        advance: 0,
        other: 0
      }
    },
    emergencyContact: {
      name: '',
      relationship: '',
      phone: '',
      address: ''
    },
    remarks: ''
  });

  const [errors, setErrors] = useState({});

  const steps = [
    { title: 'Personal Details', icon: 'icon-user' },
    { title: 'Employment Details', icon: 'icon-briefcase' },
    { title: 'Address Information', icon: 'icon-map-pin' },
    { title: 'Bank & Salary', icon: 'icon-dollar-sign' },
    { title: 'Emergency Contact', icon: 'icon-phone' }
  ];

  useEffect(() => {
    fetchDepartments();
    fetchDesignations();
    fetchEmployees();
    if (isEditMode) {
      fetchEmployee();
    }
  }, [id]);

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
    try {
      const response = await employeeAPI.getAll({ status: 'Active', limit: 100 });
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchEmployee = async () => {
    setLoading(true);
    try {
      const response = await employeeAPI.getById(id);
      if (response.success && response.data) {
        setFormData(response.data);
      }
    } catch (error) {
      message.error(error.message || 'Failed to fetch employee');
      navigate('/hrm/employees');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (path, value) => {
    const keys = path.split('.');
    setFormData(prev => {
      const newData = { ...prev };
      let current = newData;

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newData;
    });

    // Clear error for this field
    if (errors[path]) {
      setErrors(prev => ({ ...prev, [path]: '' }));
    }
  };

  const handleSameAsCurrentAddress = (checked) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          permanentAddress: {
            ...prev.address.currentAddress,
            sameAsCurrent: true
          }
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          permanentAddress: {
            street: '',
            village: '',
            city: '',
            district: '',
            state: '',
            pincode: '',
            sameAsCurrent: false
          }
        }
      }));
    }
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 0) {
      if (!formData.employeeNumber) newErrors['employeeNumber'] = 'Employee number is required';
      if (!formData.personalDetails.name) newErrors['personalDetails.name'] = 'Name is required';
      if (!formData.personalDetails.phone) newErrors['personalDetails.phone'] = 'Phone is required';
      if (!formData.personalDetails.gender) newErrors['personalDetails.gender'] = 'Gender is required';
    } else if (step === 1) {
      if (!formData.employmentDetails.department) newErrors['employmentDetails.department'] = 'Department is required';
      if (!formData.employmentDetails.designation) newErrors['employmentDetails.designation'] = 'Designation is required';
      if (!formData.employmentDetails.dateOfJoining) newErrors['employmentDetails.dateOfJoining'] = 'Date of joining is required';
    } else if (step === 3) {
      if (!formData.salaryDetails.basicSalary || formData.salaryDetails.basicSalary <= 0) {
        newErrors['salaryDetails.basicSalary'] = 'Basic salary must be greater than 0';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateStep(currentStep)) {
      return;
    }

    setLoading(true);
    try {
      let response;
      if (isEditMode) {
        response = await employeeAPI.update(id, formData);
        message.success('Employee updated successfully');
      } else {
        response = await employeeAPI.create(formData);
        message.success('Employee created successfully');
      }

      navigate('/hrm/employees');
    } catch (error) {
      message.error(error.message || 'Failed to save employee');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderPersonalDetails();
      case 1:
        return renderEmploymentDetails();
      case 2:
        return renderAddressDetails();
      case 3:
        return renderBankSalaryDetails();
      case 4:
        return renderEmergencyContact();
      default:
        return null;
    }
  };

  const renderPersonalDetails = () => (
    <div className="form-section">
      <h3 className="section-title">Personal Information</h3>
      <div className="form-grid">
        <div className="form-group">
          <label>Employee Number <span className="required">*</span></label>
          <input
            type="text"
            value={formData.employeeNumber}
            onChange={(e) => handleInputChange('employeeNumber', e.target.value)}
            className={errors['employeeNumber'] ? 'error' : ''}
            disabled={isEditMode}
          />
          {errors['employeeNumber'] && <span className="error-message">{errors['employeeNumber']}</span>}
        </div>

        <div className="form-group">
          <label>Full Name <span className="required">*</span></label>
          <input
            type="text"
            value={formData.personalDetails.name}
            onChange={(e) => handleInputChange('personalDetails.name', e.target.value)}
            className={errors['personalDetails.name'] ? 'error' : ''}
          />
          {errors['personalDetails.name'] && <span className="error-message">{errors['personalDetails.name']}</span>}
        </div>

        <div className="form-group">
          <label>Father's Name</label>
          <input
            type="text"
            value={formData.personalDetails.fatherName}
            onChange={(e) => handleInputChange('personalDetails.fatherName', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Date of Birth</label>
          <input
            type="date"
            value={formData.personalDetails.dob}
            onChange={(e) => handleInputChange('personalDetails.dob', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Gender <span className="required">*</span></label>
          <select
            value={formData.personalDetails.gender}
            onChange={(e) => handleInputChange('personalDetails.gender', e.target.value)}
            className={errors['personalDetails.gender'] ? 'error' : ''}
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="form-group">
          <label>Phone Number <span className="required">*</span></label>
          <input
            type="tel"
            value={formData.personalDetails.phone}
            onChange={(e) => handleInputChange('personalDetails.phone', e.target.value)}
            className={errors['personalDetails.phone'] ? 'error' : ''}
          />
          {errors['personalDetails.phone'] && <span className="error-message">{errors['personalDetails.phone']}</span>}
        </div>

        <div className="form-group">
          <label>Alternate Phone</label>
          <input
            type="tel"
            value={formData.personalDetails.alternatePhone}
            onChange={(e) => handleInputChange('personalDetails.alternatePhone', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={formData.personalDetails.email}
            onChange={(e) => handleInputChange('personalDetails.email', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Marital Status</label>
          <select
            value={formData.personalDetails.maritalStatus}
            onChange={(e) => handleInputChange('personalDetails.maritalStatus', e.target.value)}
          >
            <option value="">Select Status</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Divorced">Divorced</option>
            <option value="Widowed">Widowed</option>
          </select>
        </div>

        <div className="form-group">
          <label>Blood Group</label>
          <select
            value={formData.personalDetails.bloodGroup}
            onChange={(e) => handleInputChange('personalDetails.bloodGroup', e.target.value)}
          >
            <option value="">Select Blood Group</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderEmploymentDetails = () => (
    <div className="form-section">
      <h3 className="section-title">Employment Information</h3>
      <div className="form-grid">
        <div className="form-group">
          <label>Department <span className="required">*</span></label>
          <select
            value={formData.employmentDetails.department}
            onChange={(e) => handleInputChange('employmentDetails.department', e.target.value)}
            className={errors['employmentDetails.department'] ? 'error' : ''}
          >
            <option value="">Select Department</option>
            {departments.map(dept => (
              <option key={dept._id} value={dept._id}>{dept.name}</option>
            ))}
          </select>
          {errors['employmentDetails.department'] && <span className="error-message">{errors['employmentDetails.department']}</span>}
        </div>

        <div className="form-group">
          <label>Designation <span className="required">*</span></label>
          <select
            value={formData.employmentDetails.designation}
            onChange={(e) => handleInputChange('employmentDetails.designation', e.target.value)}
            className={errors['employmentDetails.designation'] ? 'error' : ''}
          >
            <option value="">Select Designation</option>
            {designations.map(desig => (
              <option key={desig._id} value={desig._id}>{desig.name}</option>
            ))}
          </select>
          {errors['employmentDetails.designation'] && <span className="error-message">{errors['employmentDetails.designation']}</span>}
        </div>

        <div className="form-group">
          <label>Date of Joining <span className="required">*</span></label>
          <input
            type="date"
            value={formData.employmentDetails.dateOfJoining}
            onChange={(e) => handleInputChange('employmentDetails.dateOfJoining', e.target.value)}
            className={errors['employmentDetails.dateOfJoining'] ? 'error' : ''}
          />
          {errors['employmentDetails.dateOfJoining'] && <span className="error-message">{errors['employmentDetails.dateOfJoining']}</span>}
        </div>

        <div className="form-group">
          <label>Employment Type</label>
          <select
            value={formData.employmentDetails.employmentType}
            onChange={(e) => handleInputChange('employmentDetails.employmentType', e.target.value)}
          >
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Contract">Contract</option>
            <option value="Temporary">Temporary</option>
          </select>
        </div>

        <div className="form-group">
          <label>Working Hours (per day)</label>
          <input
            type="number"
            value={formData.employmentDetails.workingHours}
            onChange={(e) => handleInputChange('employmentDetails.workingHours', parseInt(e.target.value))}
            min="1"
            max="24"
          />
        </div>

        <div className="form-group">
          <label>Reporting To</label>
          <select
            value={formData.employmentDetails.reportingTo}
            onChange={(e) => handleInputChange('employmentDetails.reportingTo', e.target.value)}
          >
            <option value="">Select Manager</option>
            {employees.filter(emp => emp._id !== id).map(emp => (
              <option key={emp._id} value={emp._id}>
                {emp.personalDetails.name} ({emp.employeeNumber})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Probation Period (months)</label>
          <input
            type="number"
            value={formData.employmentDetails.probationPeriod}
            onChange={(e) => handleInputChange('employmentDetails.probationPeriod', parseInt(e.target.value))}
            min="0"
          />
        </div>

        <div className="form-group">
          <label>Confirmation Date</label>
          <input
            type="date"
            value={formData.employmentDetails.confirmationDate}
            onChange={(e) => handleInputChange('employmentDetails.confirmationDate', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Status</label>
          <select
            value={formData.employmentDetails.status}
            onChange={(e) => handleInputChange('employmentDetails.status', e.target.value)}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="On Leave">On Leave</option>
            <option value="Terminated">Terminated</option>
            <option value="Resigned">Resigned</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderAddressDetails = () => (
    <div className="form-section">
      <h3 className="section-title">Current Address</h3>
      <div className="form-grid">
        <div className="form-group full-width">
          <label>Street Address</label>
          <input
            type="text"
            value={formData.address.currentAddress.street}
            onChange={(e) => handleInputChange('address.currentAddress.street', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Village</label>
          <input
            type="text"
            value={formData.address.currentAddress.village}
            onChange={(e) => handleInputChange('address.currentAddress.village', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>City</label>
          <input
            type="text"
            value={formData.address.currentAddress.city}
            onChange={(e) => handleInputChange('address.currentAddress.city', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>District</label>
          <input
            type="text"
            value={formData.address.currentAddress.district}
            onChange={(e) => handleInputChange('address.currentAddress.district', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>State</label>
          <input
            type="text"
            value={formData.address.currentAddress.state}
            onChange={(e) => handleInputChange('address.currentAddress.state', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Pincode</label>
          <input
            type="text"
            value={formData.address.currentAddress.pincode}
            onChange={(e) => handleInputChange('address.currentAddress.pincode', e.target.value)}
          />
        </div>
      </div>

      <h3 className="section-title" style={{ marginTop: '30px' }}>Permanent Address</h3>
      <div className="form-group full-width">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.address.permanentAddress.sameAsCurrent}
            onChange={(e) => handleSameAsCurrentAddress(e.target.checked)}
          />
          Same as Current Address
        </label>
      </div>

      {!formData.address.permanentAddress.sameAsCurrent && (
        <div className="form-grid">
          <div className="form-group full-width">
            <label>Street Address</label>
            <input
              type="text"
              value={formData.address.permanentAddress.street}
              onChange={(e) => handleInputChange('address.permanentAddress.street', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Village</label>
            <input
              type="text"
              value={formData.address.permanentAddress.village}
              onChange={(e) => handleInputChange('address.permanentAddress.village', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>City</label>
            <input
              type="text"
              value={formData.address.permanentAddress.city}
              onChange={(e) => handleInputChange('address.permanentAddress.city', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>District</label>
            <input
              type="text"
              value={formData.address.permanentAddress.district}
              onChange={(e) => handleInputChange('address.permanentAddress.district', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>State</label>
            <input
              type="text"
              value={formData.address.permanentAddress.state}
              onChange={(e) => handleInputChange('address.permanentAddress.state', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Pincode</label>
            <input
              type="text"
              value={formData.address.permanentAddress.pincode}
              onChange={(e) => handleInputChange('address.permanentAddress.pincode', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderBankSalaryDetails = () => (
    <div className="form-section">
      <h3 className="section-title">Bank Details</h3>
      <div className="form-grid">
        <div className="form-group">
          <label>Account Holder Name</label>
          <input
            type="text"
            value={formData.bankDetails.accountHolderName}
            onChange={(e) => handleInputChange('bankDetails.accountHolderName', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Account Number</label>
          <input
            type="text"
            value={formData.bankDetails.accountNumber}
            onChange={(e) => handleInputChange('bankDetails.accountNumber', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Bank Name</label>
          <input
            type="text"
            value={formData.bankDetails.bankName}
            onChange={(e) => handleInputChange('bankDetails.bankName', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Branch Name</label>
          <input
            type="text"
            value={formData.bankDetails.branchName}
            onChange={(e) => handleInputChange('bankDetails.branchName', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>IFSC Code</label>
          <input
            type="text"
            value={formData.bankDetails.ifscCode}
            onChange={(e) => handleInputChange('bankDetails.ifscCode', e.target.value.toUpperCase())}
          />
        </div>
      </div>

      <h3 className="section-title" style={{ marginTop: '30px' }}>Salary Details</h3>
      <div className="form-grid">
        <div className="form-group">
          <label>Basic Salary <span className="required">*</span></label>
          <input
            type="number"
            value={formData.salaryDetails.basicSalary}
            onChange={(e) => handleInputChange('salaryDetails.basicSalary', parseFloat(e.target.value) || 0)}
            className={errors['salaryDetails.basicSalary'] ? 'error' : ''}
            min="0"
          />
          {errors['salaryDetails.basicSalary'] && <span className="error-message">{errors['salaryDetails.basicSalary']}</span>}
        </div>

        <div className="form-group">
          <label>HRA</label>
          <input
            type="number"
            value={formData.salaryDetails.allowances.hra}
            onChange={(e) => handleInputChange('salaryDetails.allowances.hra', parseFloat(e.target.value) || 0)}
            min="0"
          />
        </div>

        <div className="form-group">
          <label>DA</label>
          <input
            type="number"
            value={formData.salaryDetails.allowances.da}
            onChange={(e) => handleInputChange('salaryDetails.allowances.da', parseFloat(e.target.value) || 0)}
            min="0"
          />
        </div>

        <div className="form-group">
          <label>TA</label>
          <input
            type="number"
            value={formData.salaryDetails.allowances.ta}
            onChange={(e) => handleInputChange('salaryDetails.allowances.ta', parseFloat(e.target.value) || 0)}
            min="0"
          />
        </div>

        <div className="form-group">
          <label>Medical Allowance</label>
          <input
            type="number"
            value={formData.salaryDetails.allowances.medical}
            onChange={(e) => handleInputChange('salaryDetails.allowances.medical', parseFloat(e.target.value) || 0)}
            min="0"
          />
        </div>

        <div className="form-group">
          <label>Special Allowance</label>
          <input
            type="number"
            value={formData.salaryDetails.allowances.special}
            onChange={(e) => handleInputChange('salaryDetails.allowances.special', parseFloat(e.target.value) || 0)}
            min="0"
          />
        </div>

        <div className="form-group">
          <label>PF Deduction</label>
          <input
            type="number"
            value={formData.salaryDetails.deductions.pf}
            onChange={(e) => handleInputChange('salaryDetails.deductions.pf', parseFloat(e.target.value) || 0)}
            min="0"
          />
        </div>

        <div className="form-group">
          <label>ESI Deduction</label>
          <input
            type="number"
            value={formData.salaryDetails.deductions.esi}
            onChange={(e) => handleInputChange('salaryDetails.deductions.esi', parseFloat(e.target.value) || 0)}
            min="0"
          />
        </div>

        <div className="form-group">
          <label>Professional Tax</label>
          <input
            type="number"
            value={formData.salaryDetails.deductions.pt}
            onChange={(e) => handleInputChange('salaryDetails.deductions.pt', parseFloat(e.target.value) || 0)}
            min="0"
          />
        </div>
      </div>
    </div>
  );

  const renderEmergencyContact = () => (
    <div className="form-section">
      <h3 className="section-title">Emergency Contact Information</h3>
      <div className="form-grid">
        <div className="form-group">
          <label>Contact Name</label>
          <input
            type="text"
            value={formData.emergencyContact.name}
            onChange={(e) => handleInputChange('emergencyContact.name', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Relationship</label>
          <input
            type="text"
            value={formData.emergencyContact.relationship}
            onChange={(e) => handleInputChange('emergencyContact.relationship', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Phone Number</label>
          <input
            type="tel"
            value={formData.emergencyContact.phone}
            onChange={(e) => handleInputChange('emergencyContact.phone', e.target.value)}
          />
        </div>

        <div className="form-group full-width">
          <label>Address</label>
          <textarea
            value={formData.emergencyContact.address}
            onChange={(e) => handleInputChange('emergencyContact.address', e.target.value)}
            rows="3"
          />
        </div>

        <div className="form-group full-width">
          <label>Remarks</label>
          <textarea
            value={formData.remarks}
            onChange={(e) => handleInputChange('remarks', e.target.value)}
            rows="4"
            placeholder="Any additional notes or remarks..."
          />
        </div>
      </div>
    </div>
  );

  if (loading && isEditMode) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading employee details...</p>
      </div>
    );
  }

  return (
    <div className="employee-form-container">
      <PageHeader
        title={isEditMode ? 'Edit Employee' : 'Add New Employee'}
        subtitle={isEditMode ? 'Update employee information' : 'Fill in the employee details'}
      />

      {/* Progress Steps */}
      <div className="form-steps">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`form-step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
            onClick={() => index < currentStep && setCurrentStep(index)}
          >
            <div className="step-icon">
              <i className={step.icon}></i>
            </div>
            <div className="step-title">{step.title}</div>
            {index < steps.length - 1 && <div className="step-line"></div>}
          </div>
        ))}
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="employee-form">
        <div className="form-content">
          {renderStepContent()}
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/hrm/employees')}
          >
            Cancel
          </button>

          <div className="action-group">
            {currentStep > 0 && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={handlePrevious}
              >
                Previous
              </button>
            )}

            {currentStep < steps.length - 1 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNext}
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-success"
                disabled={loading}
              >
                {loading ? 'Saving...' : (isEditMode ? 'Update Employee' : 'Create Employee')}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default EmployeeForm;
