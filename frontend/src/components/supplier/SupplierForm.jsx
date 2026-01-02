import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supplierAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import { message } from '../../utils/toast';

const SupplierForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    supplierId: '',
    name: '',
    phone: '',
    email: '',
    gstNumber: '',
    address: '',
    openingBalance: 0,
    state: '',
    district: '',
    pincode: '',
    panNumber: '',
    active: true,
    documents: {
      aadhaar: '',
      passbook: '',
      rationCard: '',
      incomeProof: ''
    }
  });
  const [errors, setErrors] = useState({});

  const isEditMode = Boolean(id);

  useEffect(() => {
    if (isEditMode) {
      fetchSupplier();
    }
  }, [id]);

  const fetchSupplier = async () => {
    setLoading(true);
    try {
      const response = await supplierAPI.getById(id);
      setFormData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch supplier details');
      navigate('/suppliers');
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

  const handleDocumentChange = (docType, file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          documents: {
            ...prev.documents,
            [docType]: reader.result
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.supplierId) {
      newErrors.supplierId = 'Supplier ID is required';
    }

    if (!formData.name) {
      newErrors.name = 'Name is required';
    }

    if (!formData.phone) {
      newErrors.phone = 'Phone is required';
    } else if (!/^[0-9]{10}$/.test(formData.phone)) {
      newErrors.phone = 'Please enter valid 10-digit phone number';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter valid email address';
    }

    if (formData.pincode && !/^[0-9]{6}$/.test(formData.pincode)) {
      newErrors.pincode = 'Please enter valid 6-digit PIN code';
    }

    if (formData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber)) {
      newErrors.panNumber = 'Please enter valid PAN number';
    }

    if (formData.gstNumber && formData.gstNumber.length !== 15) {
      newErrors.gstNumber = 'GST number should be 15 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      message.error('Please fill all required fields correctly');
      return;
    }

    setLoading(true);
    try {
      if (isEditMode) {
        await supplierAPI.update(id, formData);
        message.success('Supplier updated successfully');
      } else {
        await supplierAPI.create(formData);
        message.success('Supplier created successfully');
      }
      navigate('/suppliers');
    } catch (error) {
      message.error(error.message || `Failed to ${isEditMode ? 'update' : 'create'} supplier`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditMode) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div className="spinner"></div>
        Loading...
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isEditMode ? 'Edit Supplier' : 'Add Supplier'}
        subtitle={isEditMode ? 'Update supplier information' : 'Create new supplier'}
      />

      <div className="billing-card">
        <form onSubmit={handleSubmit} className="billing-form">
          <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>Basic Information</h3>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label required">Supplier ID</label>
              <input
                type="text"
                className={`form-input ${errors.supplierId ? 'error' : ''}`}
                placeholder="Enter supplier ID"
                value={formData.supplierId}
                onChange={(e) => handleInputChange('supplierId', e.target.value)}
                disabled={isEditMode}
              />
              {errors.supplierId && <div className="form-error">{errors.supplierId}</div>}
            </div>

            <div className="form-group">
              <label className="form-label required">Name</label>
              <input
                type="text"
                className={`form-input ${errors.name ? 'error' : ''}`}
                placeholder="Enter supplier name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
              {errors.name && <div className="form-error">{errors.name}</div>}
            </div>

            <div className="form-group">
              <label className="form-label required">Phone</label>
              <input
                type="text"
                className={`form-input ${errors.phone ? 'error' : ''}`}
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                maxLength={10}
              />
              {errors.phone && <div className="form-error">{errors.phone}</div>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className={`form-input ${errors.email ? 'error' : ''}`}
                placeholder="Enter email address"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
              {errors.email && <div className="form-error">{errors.email}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Opening Balance</label>
              <input
                type="number"
                className="form-input"
                placeholder="Enter opening balance"
                value={formData.openingBalance}
                onChange={(e) => handleInputChange('openingBalance', parseFloat(e.target.value) || 0)}
                step="0.01"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={formData.active}
                onChange={(e) => handleInputChange('active', e.target.value === 'true')}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="divider">
            <span className="divider-text">Address Information</span>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ gridColumn: 'span 3' }}>
              <label className="form-label">Address</label>
              <textarea
                className="form-textarea"
                placeholder="Enter full address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">State</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter state"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">District</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter district"
                value={formData.district}
                onChange={(e) => handleInputChange('district', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">PIN Code</label>
              <input
                type="text"
                className={`form-input ${errors.pincode ? 'error' : ''}`}
                placeholder="Enter PIN code"
                value={formData.pincode}
                onChange={(e) => handleInputChange('pincode', e.target.value)}
                maxLength={6}
              />
              {errors.pincode && <div className="form-error">{errors.pincode}</div>}
            </div>
          </div>

          <div className="divider">
            <span className="divider-text">Tax Information</span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">GST Number</label>
              <input
                type="text"
                className={`form-input ${errors.gstNumber ? 'error' : ''}`}
                placeholder="Enter GST number"
                value={formData.gstNumber}
                onChange={(e) => handleInputChange('gstNumber', e.target.value.toUpperCase())}
                maxLength={15}
              />
              {errors.gstNumber && <div className="form-error">{errors.gstNumber}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">PAN Number</label>
              <input
                type="text"
                className={`form-input ${errors.panNumber ? 'error' : ''}`}
                placeholder="Enter PAN number"
                value={formData.panNumber}
                onChange={(e) => handleInputChange('panNumber', e.target.value.toUpperCase())}
                maxLength={10}
              />
              {errors.panNumber && <div className="form-error">{errors.panNumber}</div>}
            </div>
          </div>

          <div className="divider">
            <span className="divider-text">Documents (Optional)</span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Aadhaar Card</label>
              <input
                type="file"
                className="form-input"
                accept="image/*,.pdf"
                onChange={(e) => handleDocumentChange('aadhaar', e.target.files[0])}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Bank Passbook</label>
              <input
                type="file"
                className="form-input"
                accept="image/*,.pdf"
                onChange={(e) => handleDocumentChange('passbook', e.target.files[0])}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ration Card</label>
              <input
                type="file"
                className="form-input"
                accept="image/*,.pdf"
                onChange={(e) => handleDocumentChange('rationCard', e.target.files[0])}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Income Proof</label>
              <input
                type="file"
                className="form-input"
                accept="image/*,.pdf"
                onChange={(e) => handleDocumentChange('incomeProof', e.target.files[0])}
              />
            </div>
          </div>

          <div className="btn-group mt-24">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  {isEditMode ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z"/>
                  </svg>
                  {isEditMode ? 'Update Supplier' : 'Save Supplier'}
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-default"
              onClick={() => navigate('/suppliers')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupplierForm;
