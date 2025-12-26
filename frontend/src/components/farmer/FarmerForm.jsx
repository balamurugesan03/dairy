import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { farmerAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import { message } from '../../utils/toast';

const FarmerForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  const isEditMode = Boolean(id);

  useEffect(() => {
    if (isEditMode) {
      fetchFarmer();
    }
  }, [id]);

  const fetchFarmer = async () => {
    setLoading(true);
    try {
      const response = await farmerAPI.getById(id);
      const farmer = response.data;

      const formattedData = {
        ...farmer,
        farmerNumber: farmer.farmerNumber,
        memberId: farmer.memberId,
        farmerType: farmer.farmerType,
        cowType: farmer.cowType,
        'personalDetails.name': farmer.personalDetails?.name,
        'personalDetails.fatherName': farmer.personalDetails?.fatherName,
        'personalDetails.age': farmer.personalDetails?.age,
        'personalDetails.dob': farmer.personalDetails?.dob || '',
        'personalDetails.gender': farmer.personalDetails?.gender,
        'personalDetails.phone': farmer.personalDetails?.phone,
        'address.ward': farmer.address?.ward,
        'address.village': farmer.address?.village,
        'address.panchayat': farmer.address?.panchayat,
        'address.pin': farmer.address?.pin,
        'identityDetails.aadhaar': farmer.identityDetails?.aadhaar,
        'identityDetails.pan': farmer.identityDetails?.pan,
        'identityDetails.welfareNo': farmer.identityDetails?.welfareNo,
        'identityDetails.ksheerasreeId': farmer.identityDetails?.ksheerasreeId,
        'bankDetails.accountNumber': farmer.bankDetails?.accountNumber,
        'bankDetails.bankName': farmer.bankDetails?.bankName,
        'bankDetails.branch': farmer.bankDetails?.branch,
        'bankDetails.ifsc': farmer.bankDetails?.ifsc,
        'financialDetails.shareValue': farmer.financialDetails?.shareValue,
        'financialDetails.resolutionNo': farmer.financialDetails?.resolutionNo,
        'financialDetails.resolutionDate': farmer.financialDetails?.resolutionDate || '',
        'financialDetails.admissionFee': farmer.financialDetails?.admissionFee,
        'documents.aadhaar': farmer.documents?.aadhaar,
        'documents.bankPassbook': farmer.documents?.bankPassbook,
        'documents.rationCard': farmer.documents?.rationCard,
        'documents.incomeProof': farmer.documents?.incomeProof,
      };

      setFormData(formattedData);
    } catch (error) {
      message.error(error.message || 'Failed to fetch farmer details');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileChange = (name, file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          [name]: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateStep = (step) => {
    const newErrors = {};

    switch (step) {
      case 0: // Personal Details
        if (!formData.farmerNumber) newErrors.farmerNumber = 'Farmer number is required';
        if (!formData['personalDetails.name']) newErrors['personalDetails.name'] = 'Name is required';
        if (!formData['personalDetails.age']) newErrors['personalDetails.age'] = 'Age is required';
        if (!formData['personalDetails.gender']) newErrors['personalDetails.gender'] = 'Gender is required';
        if (formData['personalDetails.phone'] && !/^[0-9]{10}$/.test(formData['personalDetails.phone'])) {
          newErrors['personalDetails.phone'] = 'Please enter valid 10-digit phone number';
        }
        break;
      case 1: // Address
        if (!formData['address.pin']) {
          newErrors['address.pin'] = 'PIN code is required';
        } else if (!/^[0-9]{6}$/.test(formData['address.pin'])) {
          newErrors['address.pin'] = 'Please enter valid 6-digit PIN code';
        }
        break;
      case 2: // Identity Details
        if (!formData['identityDetails.aadhaar']) {
          newErrors['identityDetails.aadhaar'] = 'Aadhaar is required';
        } else if (!/^[0-9]{12}$/.test(formData['identityDetails.aadhaar'])) {
          newErrors['identityDetails.aadhaar'] = 'Please enter valid 12-digit Aadhaar number';
        }
        if (formData['identityDetails.pan'] && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData['identityDetails.pan'])) {
          newErrors['identityDetails.pan'] = 'Please enter valid PAN number';
        }
        break;
      case 3: // Farmer Type
        if (!formData.farmerType) newErrors.farmerType = 'Farmer type is required';
        if (!formData.cowType) newErrors.cowType = 'Cow type is required';
        break;
      case 4: // Bank Details
        if (!formData['bankDetails.accountNumber']) newErrors['bankDetails.accountNumber'] = 'Account number is required';
        if (!formData['bankDetails.bankName']) newErrors['bankDetails.bankName'] = 'Bank name is required';
        if (!formData['bankDetails.branch']) newErrors['bankDetails.branch'] = 'Branch is required';
        if (formData['bankDetails.ifsc'] && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData['bankDetails.ifsc'])) {
          newErrors['bankDetails.ifsc'] = 'Please enter valid IFSC code';
        }
        break;
      case 5: // Financial Details
        if (!formData['financialDetails.shareValue']) newErrors['financialDetails.shareValue'] = 'Share value is required';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    } else {
      message.error('Please fill all required fields');
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateStep(currentStep)) {
      message.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        farmerNumber: formData.farmerNumber,
        memberId: formData.memberId,
        personalDetails: {
          name: formData['personalDetails.name'],
          fatherName: formData['personalDetails.fatherName'],
          age: parseInt(formData['personalDetails.age']),
          dob: formData['personalDetails.dob'] ? new Date(formData['personalDetails.dob']).toISOString() : null,
          gender: formData['personalDetails.gender'],
          phone: formData['personalDetails.phone'],
        },
        address: {
          ward: formData['address.ward'],
          village: formData['address.village'],
          panchayat: formData['address.panchayat'],
          pin: formData['address.pin'],
        },
        identityDetails: {
          aadhaar: formData['identityDetails.aadhaar'],
          pan: formData['identityDetails.pan'],
          welfareNo: formData['identityDetails.welfareNo'],
          ksheerasreeId: formData['identityDetails.ksheerasreeId'],
        },
        farmerType: formData.farmerType,
        cowType: formData.cowType,
        bankDetails: {
          accountNumber: formData['bankDetails.accountNumber'],
          bankName: formData['bankDetails.bankName'],
          branch: formData['bankDetails.branch'],
          ifsc: formData['bankDetails.ifsc'],
        },
        financialDetails: {
          shareValue: parseFloat(formData['financialDetails.shareValue']),
          resolutionNo: formData['financialDetails.resolutionNo'],
          resolutionDate: formData['financialDetails.resolutionDate'] ? new Date(formData['financialDetails.resolutionDate']).toISOString() : null,
          admissionFee: parseFloat(formData['financialDetails.admissionFee']) || 0,
        },
        documents: {
          aadhaar: formData['documents.aadhaar'],
          bankPassbook: formData['documents.bankPassbook'],
          rationCard: formData['documents.rationCard'],
          incomeProof: formData['documents.incomeProof'],
        },
      };

      if (isEditMode) {
        await farmerAPI.update(id, payload);
        message.success('Farmer updated successfully');
      } else {
        await farmerAPI.create(payload);
        message.success('Farmer created successfully');
      }
      navigate('/farmers');
    } catch (error) {
      message.error(error.message || 'Failed to save farmer');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { title: 'Personal Details' },
    { title: 'Address' },
    { title: 'Identity Details' },
    { title: 'Farmer Type' },
    { title: 'Bank Details' },
    { title: 'Financial Details' },
    { title: 'Documents' },
  ];

  const renderFormField = (name, label, type = 'text', required = false, options = null, placeholder = '') => {
    const value = formData[name] || '';
    const error = errors[name];

    if (type === 'select') {
      return (
        <div className="form-group">
          <label className={`form-label ${required ? 'required' : ''}`}>{label}</label>
          <select
            className={`form-select ${error ? 'error' : ''}`}
            value={value}
            onChange={(e) => handleInputChange(name, e.target.value)}
          >
            <option value="">Select {label.toLowerCase()}</option>
            {options && options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {error && <div className="form-error">{error}</div>}
        </div>
      );
    }

    return (
      <div className="form-group">
        <label className={`form-label ${required ? 'required' : ''}`}>{label}</label>
        <input
          type={type}
          className={`form-input ${error ? 'error' : ''}`}
          value={value}
          onChange={(e) => handleInputChange(name, e.target.value)}
          placeholder={placeholder}
          disabled={name === 'farmerNumber' && isEditMode}
          min={type === 'number' ? 0 : undefined}
          max={type === 'number' && name === 'personalDetails.age' ? 100 : undefined}
          maxLength={name === 'personalDetails.phone' ? 10 : name === 'address.pin' ? 6 : name === 'identityDetails.aadhaar' ? 12 : name === 'identityDetails.pan' ? 10 : name === 'bankDetails.ifsc' ? 11 : undefined}
          style={name === 'identityDetails.pan' || name === 'bankDetails.ifsc' ? { textTransform: 'uppercase' } : {}}
        />
        {error && <div className="form-error">{error}</div>}
      </div>
    );
  };

  const renderFileField = (name, label, required = false) => {
    const value = formData[name] || '';
    const error = errors[name];

    return (
      <div className="form-group">
        <label className={`form-label ${required ? 'required' : ''}`}>{label}</label>
        <input
          type="file"
          className={`form-input ${error ? 'error' : ''}`}
          onChange={(e) => handleFileChange(name, e.target.files[0])}
          accept="image/*,.pdf"
        />
        {value && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            {value.startsWith('data:') ? 'File selected' : 'Previously uploaded'}
          </div>
        )}
        {error && <div className="form-error">{error}</div>}
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="form-row">
            {renderFormField('farmerNumber', 'Farmer Number', 'text', true, null, 'Enter farmer number')}
            {renderFormField('memberId', 'Member ID', 'text', false, null, 'Enter member ID')}
            {renderFormField('personalDetails.name', 'Name', 'text', true, null, 'Enter name')}
            {renderFormField('personalDetails.fatherName', "Father's Name", 'text', false, null, "Enter father's name")}
            {renderFormField('personalDetails.age', 'Age', 'number', true, null, 'Enter age')}
            {renderFormField('personalDetails.dob', 'Date of Birth', 'date', false)}
            {renderFormField('personalDetails.gender', 'Gender', 'select', true, [
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' },
              { value: 'Other', label: 'Other' }
            ])}
            {renderFormField('personalDetails.phone', 'Phone', 'text', false, null, 'Enter phone number')}
          </div>
        );

      case 1:
        return (
          <div className="form-row">
            {renderFormField('address.ward', 'Ward', 'text', false, null, 'Enter ward')}
            {renderFormField('address.village', 'Village', 'text', false, null, 'Enter village')}
            {renderFormField('address.panchayat', 'Panchayat', 'text', false, null, 'Enter panchayat')}
            {renderFormField('address.pin', 'PIN Code', 'text', true, null, 'Enter PIN code')}
          </div>
        );

      case 2:
        return (
          <div className="form-row">
            {renderFormField('identityDetails.aadhaar', 'Aadhaar Number', 'text', true, null, 'Enter Aadhaar number')}
            {renderFormField('identityDetails.pan', 'PAN Number', 'text', false, null, 'Enter PAN number')}
            {renderFormField('identityDetails.welfareNo', 'Welfare Number', 'text', false, null, 'Enter welfare number')}
            {renderFormField('identityDetails.ksheerasreeId', 'Ksheerasree ID', 'text', false, null, 'Enter Ksheerasree ID')}
          </div>
        );

      case 3:
        return (
          <div className="form-row">
            {renderFormField('farmerType', 'Farmer Type', 'select', true, [
              { value: 'A', label: 'Type A' },
              { value: 'B', label: 'Type B' },
              { value: 'C', label: 'Type C' }
            ])}
            {renderFormField('cowType', 'Cow Type', 'select', true, [
              { value: 'Desi', label: 'Desi' },
              { value: 'Crossbreed', label: 'Crossbreed' },
              { value: 'Jersey', label: 'Jersey' },
              { value: 'HF', label: 'HF (Holstein Friesian)' }
            ])}
          </div>
        );

      case 4:
        return (
          <div className="form-row">
            {renderFormField('bankDetails.accountNumber', 'Account Number', 'text', true, null, 'Enter account number')}
            {renderFormField('bankDetails.bankName', 'Bank Name', 'text', true, null, 'Enter bank name')}
            {renderFormField('bankDetails.branch', 'Branch', 'text', true, null, 'Enter branch')}
            {renderFormField('bankDetails.ifsc', 'IFSC Code', 'text', false, null, 'Enter IFSC code')}
          </div>
        );

      case 5:
        return (
          <div className="form-row">
            {renderFormField('financialDetails.shareValue', 'Share Value', 'number', true, null, 'Enter share value')}
            {renderFormField('financialDetails.admissionFee', 'Admission Fee', 'number', false, null, 'Enter admission fee')}
            {renderFormField('financialDetails.resolutionNo', 'Resolution Number', 'text', false, null, 'Enter resolution number')}
            {renderFormField('financialDetails.resolutionDate', 'Resolution Date', 'date', false)}
          </div>
        );

      case 6:
        return (
          <div className="form-row">
            {renderFileField('documents.aadhaar', 'Aadhaar Document', false)}
            {renderFileField('documents.bankPassbook', 'Bank Passbook', false)}
            {renderFileField('documents.rationCard', 'Ration Card', false)}
            {renderFileField('documents.incomeProof', 'Income Proof', false)}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      <PageHeader
        title={isEditMode ? 'Edit Farmer' : 'Add Farmer'}
        subtitle={isEditMode ? 'Update farmer information' : 'Register new farmer'}
      />

      <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '24px' }}>
        {/* Steps indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', position: 'relative' }}>
          {steps.map((step, index) => (
            <div key={index} style={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: index <= currentStep ? 'var(--primary-color)' : 'var(--bg-secondary)',
                color: index <= currentStep ? '#fff' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 8px',
                border: '2px solid',
                borderColor: index <= currentStep ? 'var(--primary-color)' : 'var(--border-color)',
                fontWeight: '600'
              }}>
                {index + 1}
              </div>
              <div style={{
                fontSize: '12px',
                color: index <= currentStep ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: index === currentStep ? '600' : '400'
              }}>
                {step.title}
              </div>
              {index < steps.length - 1 && (
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: 'calc(50% + 16px)',
                  width: 'calc(100% - 32px)',
                  height: '2px',
                  background: index < currentStep ? 'var(--primary-color)' : 'var(--border-color)',
                  zIndex: 0
                }} />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {renderStepContent()}

          <div style={{ marginTop: '24px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            {currentStep > 0 && (
              <button
                type="button"
                className="btn btn-default"
                onClick={handlePrevious}
              >
                Previous
              </button>
            )}
            {currentStep < steps.length - 1 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNext}
              >
                Next
              </button>
            )}
            {currentStep === steps.length - 1 && (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="spinner"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z"/>
                    </svg>
                    {isEditMode ? 'Update' : 'Save'}
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              className="btn btn-default"
              onClick={() => navigate('/farmers')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FarmerForm;
