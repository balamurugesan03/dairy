import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { warrantyAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import './WarrantyForm.css';

const WarrantyForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    warrantyNumber: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    product: '',
    serialNumber: '',
    purchaseDate: '',
    warrantyStartDate: '',
    warrantyPeriod: '',
    warrantyPeriodUnit: 'months',
    warrantyEndDate: '',
    terms: '',
    notes: ''
  });

  const isEditMode = Boolean(id);

  useEffect(() => {
    if (isEditMode) {
      fetchWarranty();
    }
  }, [id]);

  const fetchWarranty = async () => {
    setLoading(true);
    try {
      const response = await warrantyAPI.getById(id);
      const warranty = response.data;

      setFormData({
        ...warranty,
        purchaseDate: warranty.purchaseDate ? dayjs(warranty.purchaseDate).format('YYYY-MM-DD') : '',
        warrantyStartDate: warranty.warrantyStartDate ? dayjs(warranty.warrantyStartDate).format('YYYY-MM-DD') : '',
        warrantyEndDate: warranty.warrantyEndDate ? dayjs(warranty.warrantyEndDate).format('YYYY-MM-DD') : ''
      });
    } catch (error) {
      message.error(error.message || 'Failed to fetch warranty details');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    if (name === 'warrantyStartDate' || name === 'warrantyPeriod' || name === 'warrantyPeriodUnit') {
      setTimeout(() => calculateWarrantyEndDate(name, value), 0);
    }
  };

  const calculateWarrantyEndDate = (changedField, changedValue) => {
    const startDate = changedField === 'warrantyStartDate' ? changedValue : formData.warrantyStartDate;
    const period = changedField === 'warrantyPeriod' ? changedValue : formData.warrantyPeriod;
    const unit = changedField === 'warrantyPeriodUnit' ? changedValue : formData.warrantyPeriodUnit;

    if (startDate && period) {
      const endDate = dayjs(startDate).add(Number(period), unit).format('YYYY-MM-DD');
      setFormData(prev => ({
        ...prev,
        warrantyEndDate: endDate
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.warrantyNumber) newErrors.warrantyNumber = 'Please enter warranty number';
    if (!formData.customerName) newErrors.customerName = 'Please enter customer name';
    if (!formData.customerPhone) {
      newErrors.customerPhone = 'Please enter phone number';
    } else if (!/^[0-9]{10}$/.test(formData.customerPhone)) {
      newErrors.customerPhone = 'Please enter valid 10-digit phone number';
    }
    if (formData.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail)) {
      newErrors.customerEmail = 'Please enter valid email';
    }
    if (!formData.product) newErrors.product = 'Please enter product name';
    if (!formData.serialNumber) newErrors.serialNumber = 'Please enter serial number';
    if (!formData.purchaseDate) newErrors.purchaseDate = 'Please select purchase date';
    if (!formData.warrantyStartDate) newErrors.warrantyStartDate = 'Please select warranty start date';
    if (!formData.warrantyPeriod) newErrors.warrantyPeriod = 'Please enter warranty period';
    if (!formData.warrantyPeriodUnit) newErrors.warrantyPeriodUnit = 'Please select unit';
    if (!formData.warrantyEndDate) newErrors.warrantyEndDate = 'Please select warranty end date';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      message.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        purchaseDate: formData.purchaseDate ? new Date(formData.purchaseDate).toISOString() : null,
        warrantyStartDate: formData.warrantyStartDate ? new Date(formData.warrantyStartDate).toISOString() : null,
        warrantyEndDate: formData.warrantyEndDate ? new Date(formData.warrantyEndDate).toISOString() : null
      };

      if (isEditMode) {
        await warrantyAPI.update(id, payload);
        message.success('Warranty updated successfully');
      } else {
        await warrantyAPI.create(payload);
        message.success('Warranty created successfully');
      }
      navigate('/additional/warranty');
    } catch (error) {
      message.error(error.message || 'Failed to save warranty');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={isEditMode ? 'Edit Warranty' : 'Add Warranty'}
        subtitle={isEditMode ? 'Update warranty information' : 'Register new warranty'}
      />

      <div className="warranty-form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="warrantyNumber">Warranty Number <span className="required">*</span></label>
              <input
                type="text"
                id="warrantyNumber"
                name="warrantyNumber"
                value={formData.warrantyNumber}
                onChange={handleChange}
                placeholder="Enter warranty number"
                disabled={isEditMode}
                className={errors.warrantyNumber ? 'error' : ''}
              />
              {errors.warrantyNumber && <span className="error-message">{errors.warrantyNumber}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="customerName">Customer Name <span className="required">*</span></label>
              <input
                type="text"
                id="customerName"
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                placeholder="Enter customer name"
                className={errors.customerName ? 'error' : ''}
              />
              {errors.customerName && <span className="error-message">{errors.customerName}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="customerPhone">Customer Phone <span className="required">*</span></label>
              <input
                type="text"
                id="customerPhone"
                name="customerPhone"
                value={formData.customerPhone}
                onChange={handleChange}
                placeholder="Enter phone number"
                maxLength={10}
                className={errors.customerPhone ? 'error' : ''}
              />
              {errors.customerPhone && <span className="error-message">{errors.customerPhone}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="customerEmail">Customer Email</label>
              <input
                type="email"
                id="customerEmail"
                name="customerEmail"
                value={formData.customerEmail}
                onChange={handleChange}
                placeholder="Enter email address"
                className={errors.customerEmail ? 'error' : ''}
              />
              {errors.customerEmail && <span className="error-message">{errors.customerEmail}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="product">Product Name <span className="required">*</span></label>
              <input
                type="text"
                id="product"
                name="product"
                value={formData.product}
                onChange={handleChange}
                placeholder="Enter product name"
                className={errors.product ? 'error' : ''}
              />
              {errors.product && <span className="error-message">{errors.product}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="serialNumber">Serial Number <span className="required">*</span></label>
              <input
                type="text"
                id="serialNumber"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleChange}
                placeholder="Enter serial number"
                className={errors.serialNumber ? 'error' : ''}
              />
              {errors.serialNumber && <span className="error-message">{errors.serialNumber}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="purchaseDate">Purchase Date <span className="required">*</span></label>
              <input
                type="date"
                id="purchaseDate"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleChange}
                className={errors.purchaseDate ? 'error' : ''}
              />
              {errors.purchaseDate && <span className="error-message">{errors.purchaseDate}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="warrantyStartDate">Warranty Start Date <span className="required">*</span></label>
              <input
                type="date"
                id="warrantyStartDate"
                name="warrantyStartDate"
                value={formData.warrantyStartDate}
                onChange={handleChange}
                className={errors.warrantyStartDate ? 'error' : ''}
              />
              {errors.warrantyStartDate && <span className="error-message">{errors.warrantyStartDate}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="warrantyPeriod">Warranty Period <span className="required">*</span></label>
              <input
                type="number"
                id="warrantyPeriod"
                name="warrantyPeriod"
                value={formData.warrantyPeriod}
                onChange={handleChange}
                placeholder="Enter period"
                min="1"
                className={errors.warrantyPeriod ? 'error' : ''}
              />
              {errors.warrantyPeriod && <span className="error-message">{errors.warrantyPeriod}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="warrantyPeriodUnit">Period Unit <span className="required">*</span></label>
              <select
                id="warrantyPeriodUnit"
                name="warrantyPeriodUnit"
                value={formData.warrantyPeriodUnit}
                onChange={handleChange}
                className={errors.warrantyPeriodUnit ? 'error' : ''}
              >
                <option value="days">Days</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
              {errors.warrantyPeriodUnit && <span className="error-message">{errors.warrantyPeriodUnit}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="warrantyEndDate">Warranty End Date <span className="required">*</span></label>
              <input
                type="date"
                id="warrantyEndDate"
                name="warrantyEndDate"
                value={formData.warrantyEndDate}
                onChange={handleChange}
                className={errors.warrantyEndDate ? 'error' : ''}
              />
              {errors.warrantyEndDate && <span className="error-message">{errors.warrantyEndDate}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group full-width">
              <label htmlFor="terms">Warranty Terms and Conditions</label>
              <textarea
                id="terms"
                name="terms"
                value={formData.terms}
                onChange={handleChange}
                rows="4"
                placeholder="Enter warranty terms and conditions"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group full-width">
              <label htmlFor="notes">Additional Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
                placeholder="Enter any additional notes"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : (isEditMode ? 'Update' : 'Save')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/additional/warranty')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WarrantyForm;
