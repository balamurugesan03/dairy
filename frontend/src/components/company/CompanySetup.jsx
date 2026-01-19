import { useState } from 'react';
import { companyAPI } from '../../services/api';
import { message } from '../../utils/toast';
import './CompanySetup.css';

const CompanySetup = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessTypes: []
  });
  const [errors, setErrors] = useState({});

  const steps = [
    { title: 'Basic Information' },
    { title: 'Address Details' },
    { title: 'Society Details' },
    { title: 'Contact Information' },
    { title: 'Registration Details' },
    { title: 'Audit Information' }
  ];

  const handleInputChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleBusinessTypeChange = (type) => {
    setFormData(prev => {
      const businessTypes = prev.businessTypes || [];
      if (businessTypes.includes(type)) {
        return {
          ...prev,
          businessTypes: businessTypes.filter(t => t !== type)
        };
      } else {
        return {
          ...prev,
          businessTypes: [...businessTypes, type]
        };
      }
    });

    if (errors.businessTypes) {
      setErrors(prev => ({ ...prev, businessTypes: '' }));
    }
  };

  const validateStep = (step) => {
    const newErrors = {};

    switch (step) {
      case 0: // Basic Information
        if (!formData.companyName || !formData.companyName.trim()) {
          newErrors.companyName = 'Company name is required';
        }
        if (!formData.businessTypes || formData.businessTypes.length === 0) {
          newErrors.businessTypes = 'At least one business type must be selected';
        }
        break;
      case 3: // Contact Information
        if (formData.phone && !/^[0-9]{10}$/.test(formData.phone)) {
          newErrors.phone = 'Please enter valid 10-digit phone number';
        }
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          newErrors.email = 'Please enter valid email address';
        }
        break;
      case 4: // Registration Details
        if (formData.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstNumber)) {
          newErrors.gstNumber = 'Please enter valid GST number';
        }
        if (formData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber)) {
          newErrors.panNumber = 'Please enter valid PAN number';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    } else {
      message.error('Please fix the errors before proceeding');
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateStep(currentStep)) {
      message.error('Please fix the errors before submitting');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        dateOfRegistration: formData.dateOfRegistration ? new Date(formData.dateOfRegistration).toISOString() : null,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        ssiRegistrationDate: formData.ssiRegistrationDate ? new Date(formData.ssiRegistrationDate).toISOString() : null
      };

      const response = await companyAPI.create(payload);
      if (response.success) {
        message.success('Company created successfully');
        if (onComplete) {
          onComplete(response.data);
        }
      }
    } catch (error) {
      message.error(error.message || 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  const renderFormField = (name, label, type = 'text', required = false) => {
    const value = formData[name] || '';
    const error = errors[name];

    return (
      <div className="form-group">
        <label className={`form-label ${required ? 'required' : ''}`}>{label}</label>
        <input
          type={type}
          className={`form-input ${error ? 'error' : ''}`}
          value={value}
          onChange={(e) => handleInputChange(name, e.target.value)}
          style={name === 'gstNumber' || name === 'panNumber' ? { textTransform: 'uppercase' } : {}}
          maxLength={name === 'phone' ? 10 : name === 'gstNumber' ? 15 : name === 'panNumber' ? 10 : undefined}
        />
        {error && <div className="form-error">{error}</div>}
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Basic Information
        return (
          <div className="form-content">
            <div className="form-row">
              {renderFormField('companyName', 'Company Name', 'text', true)}
            </div>
            <div className="form-group">
              <label className="form-label required">Business Type</label>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={(formData.businessTypes || []).includes('Dairy Cooperative Society')}
                    onChange={() => handleBusinessTypeChange('Dairy Cooperative Society')}
                  />
                  <span>Dairy Cooperative Society</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={(formData.businessTypes || []).includes('Private Firm')}
                    onChange={() => handleBusinessTypeChange('Private Firm')}
                  />
                  <span>Private Firm</span>
                </label>
              </div>
              {errors.businessTypes && <div className="form-error">{errors.businessTypes}</div>}
            </div>
          </div>
        );

      case 1: // Address Details
        return (
          <div className="form-content">
            <div className="form-row">
              {renderFormField('state', 'State', 'text')}
              {renderFormField('district', 'District', 'text')}
            </div>
            <div className="form-row">
              {renderFormField('address', 'Address', 'text')}
            </div>
          </div>
        );

      case 2: // Society Details
        return (
          <div className="form-content">
            <div className="form-row">
              {renderFormField('societyName', 'Society Name', 'text')}
              {renderFormField('societyCode', 'Society Code', 'text')}
            </div>
          </div>
        );

      case 3: // Contact Information
        return (
          <div className="form-content">
            <div className="form-row">
              {renderFormField('phone', 'Phone Number', 'text')}
              {renderFormField('email', 'Email', 'email')}
            </div>
          </div>
        );

      case 4: // Registration Details
        return (
          <div className="form-content">
            <div className="form-row">
              {renderFormField('dateOfRegistration', 'Date of Registration', 'date')}
              {renderFormField('startDate', 'Start Date', 'date')}
            </div>
            <div className="form-row">
              {renderFormField('gstNumber', 'GST Number', 'text')}
              {renderFormField('milmaCode', 'Milma Code', 'text')}
            </div>
            <div className="form-row">
              {renderFormField('ssiRegistration', 'SSI Registration', 'text')}
              {renderFormField('ssiRegistrationDate', 'SSI Registration Date', 'date')}
            </div>
            <div className="form-row">
              {renderFormField('panNumber', 'PAN Number', 'text')}
            </div>
          </div>
        );

      case 5: // Audit Information
        return (
          <div className="form-content">
            <div className="form-row">
              {renderFormField('yearOfAudit', 'Year of Audit', 'text')}
              {renderFormField('auditClassification', 'Audit Classification', 'text')}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="company-setup-container">
      <div className="company-setup-card">
        <div className="company-setup-header">
          <h1>Company Setup</h1>
          <p>Create your company profile to get started</p>
        </div>

        {/* Steps indicator */}
        <div className="steps-indicator">
          {steps.map((step, index) => (
            <div key={index} className="step-item-wrapper">
              <div className={`step-item ${index <= currentStep ? 'active' : ''} ${index === currentStep ? 'current' : ''}`}>
                <div className="step-number">{index + 1}</div>
                <div className="step-title">{step.title}</div>
              </div>
              {index < steps.length - 1 && (
                <div className={`step-line ${index < currentStep ? 'active' : ''}`} />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {renderStepContent()}

          <div className="form-actions">
            {currentStep > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePrevious}
                disabled={loading}
              >
                Previous
              </button>
            )}
            <div style={{ flex: 1 }} />
            {currentStep < steps.length - 1 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNext}
                disabled={loading}
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Company'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanySetup;
