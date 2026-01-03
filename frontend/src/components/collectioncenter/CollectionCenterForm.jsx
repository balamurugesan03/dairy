import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collectionCenterAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import { message } from '../../utils/toast';

const CollectionCenterForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [formData, setFormData] = useState({
    centerName: '',
    startDate: '',
    centerType: '',
    status: 'Active',
    'address.street': '',
    'address.village': '',
    'address.district': '',
    'address.state': '',
    'address.pincode': '',
    'contactDetails.phone': '',
    'contactDetails.email': '',
    'contactDetails.incharge': '',
    description: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      fetchCenter();
    }
  }, [id]);

  const fetchCenter = async () => {
    try {
      const response = await collectionCenterAPI.getById(id);
      const center = response.data;

      setFormData({
        centerName: center.centerName || '',
        startDate: center.startDate ? new Date(center.startDate).toISOString().split('T')[0] : '',
        centerType: center.centerType || '',
        status: center.status || 'Active',
        'address.street': center.address?.street || '',
        'address.village': center.address?.village || '',
        'address.district': center.address?.district || '',
        'address.state': center.address?.state || '',
        'address.pincode': center.address?.pincode || '',
        'contactDetails.phone': center.contactDetails?.phone || '',
        'contactDetails.email': center.contactDetails?.email || '',
        'contactDetails.incharge': center.contactDetails?.incharge || '',
        description: center.description || ''
      });
    } catch (error) {
      message.error(error.message || 'Failed to fetch collection center');
      navigate('/collection-centers');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.centerName.trim()) {
      newErrors.centerName = 'Center name is required';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.centerType) {
      newErrors.centerType = 'Center type is required';
    }

    if (formData['contactDetails.phone'] && !/^\d{10}$/.test(formData['contactDetails.phone'])) {
      newErrors['contactDetails.phone'] = 'Phone number must be 10 digits';
    }

    if (formData['contactDetails.email'] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData['contactDetails.email'])) {
      newErrors['contactDetails.email'] = 'Invalid email format';
    }

    if (formData['address.pincode'] && !/^\d{6}$/.test(formData['address.pincode'])) {
      newErrors['address.pincode'] = 'Pincode must be 6 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      message.error('Please fix the errors in the form');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        centerName: formData.centerName,
        startDate: formData.startDate,
        centerType: formData.centerType,
        status: formData.status,
        address: {
          street: formData['address.street'],
          village: formData['address.village'],
          district: formData['address.district'],
          state: formData['address.state'],
          pincode: formData['address.pincode']
        },
        contactDetails: {
          phone: formData['contactDetails.phone'],
          email: formData['contactDetails.email'],
          incharge: formData['contactDetails.incharge']
        },
        description: formData.description
      };

      if (isEditMode) {
        await collectionCenterAPI.update(id, payload);
        message.success('Collection center updated successfully');
      } else {
        await collectionCenterAPI.create(payload);
        message.success('Collection center created successfully');
      }

      navigate('/collection-centers');
    } catch (error) {
      message.error(error.message || `Failed to ${isEditMode ? 'update' : 'create'} collection center`);
    } finally {
      setLoading(false);
    }
  };

  const renderFormField = (name, label, type = 'text', required = false, options = null, placeholder = '') => (
    <div className="form-group">
      <label className="form-label">
        {label} {required && <span className="required">*</span>}
      </label>
      {type === 'select' ? (
        <select
          name={name}
          className={`form-select ${errors[name] ? 'error' : ''}`}
          value={formData[name]}
          onChange={handleChange}
          required={required}
        >
          <option value="">Select {label}</option>
          {options?.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          name={name}
          className={`form-input ${errors[name] ? 'error' : ''}`}
          value={formData[name]}
          onChange={handleChange}
          required={required}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          type={type}
          name={name}
          className={`form-input ${errors[name] ? 'error' : ''}`}
          value={formData[name]}
          onChange={handleChange}
          required={required}
          placeholder={placeholder}
        />
      )}
      {errors[name] && <div className="form-error">{errors[name]}</div>}
    </div>
  );

  return (
    <div>
      <PageHeader
        title={isEditMode ? 'Edit Collection Center' : 'Add Collection Center'}
        subtitle={isEditMode ? 'Update collection center information' : 'Create a new collection center'}
        onBack={() => navigate('/collection-centers')}
      />

      <div className="form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3 className="form-section-title">Basic Information</h3>
            <div className="form-row">
              {renderFormField('centerName', 'Center Name', 'text', true, null, 'Enter center name')}
              {renderFormField('centerType', 'Center Type', 'select', true, [
                { value: 'Head Office', label: 'Head Office' },
                { value: 'Sub Centre', label: 'Sub Centre' }
              ])}
            </div>
            <div className="form-row">
              {renderFormField('startDate', 'Start Date', 'date', true)}
              {renderFormField('status', 'Status', 'select', true, [
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' }
              ])}
            </div>
            <div className="form-row">
              {renderFormField('description', 'Description', 'textarea', false, null, 'Enter description')}
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Address Details</h3>
            <div className="form-row">
              {renderFormField('address.street', 'Street', 'text', false, null, 'Enter street address')}
              {renderFormField('address.village', 'Village', 'text', false, null, 'Enter village')}
            </div>
            <div className="form-row">
              {renderFormField('address.district', 'District', 'text', false, null, 'Enter district')}
              {renderFormField('address.state', 'State', 'text', false, null, 'Enter state')}
            </div>
            <div className="form-row">
              {renderFormField('address.pincode', 'Pincode', 'text', false, null, 'Enter 6-digit pincode')}
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Contact Details</h3>
            <div className="form-row">
              {renderFormField('contactDetails.incharge', 'Incharge Name', 'text', false, null, 'Enter incharge name')}
              {renderFormField('contactDetails.phone', 'Phone', 'tel', false, null, 'Enter 10-digit phone number')}
            </div>
            <div className="form-row">
              {renderFormField('contactDetails.email', 'Email', 'email', false, null, 'Enter email address')}
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-default"
              onClick={() => navigate('/collection-centers')}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : (isEditMode ? 'Update Center' : 'Create Center')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CollectionCenterForm;
