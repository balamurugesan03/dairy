import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate, useParams } from 'react-router-dom';
import { promotionAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import dayjs from 'dayjs';
import './PromotionForm.css';

const PromotionForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const isEditMode = !!id;
  const [formData, setFormData] = useState({
    promotionDate: dayjs().format('YYYY-MM-DD'),
    promotionType: 'Marketing',
    description: '',
    expense: '',
    targetAudience: '',
    recordedBy: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isEditMode) {
      fetchPromotion();
    }
  }, [id]);

  const fetchPromotion = async () => {
    setLoading(true);
    try {
      const response = await promotionAPI.getById(id);
      const promotion = response.data;

      setFormData({
        ...promotion,
        promotionDate: promotion.promotionDate ? dayjs(promotion.promotionDate).format('YYYY-MM-DD') : ''
      });
    } catch (error) {
      message.error(error.message || 'Failed to fetch promotion details');
    } finally {
      setLoading(false);
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
    if (!formData.promotionDate) newErrors.promotionDate = 'Promotion date is required';
    if (!formData.promotionType) newErrors.promotionType = 'Promotion type is required';
    if (!formData.description) newErrors.description = 'Description is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const submitData = {
        ...formData,
        promotionDate: new Date(formData.promotionDate).toISOString(),
        expense: formData.expense ? parseFloat(formData.expense) : 0
      };

      if (isEditMode) {
        await promotionAPI.update(id, submitData);
        message.success('Promotion updated successfully');
      } else {
        await promotionAPI.create(submitData);
        message.success('Promotion created successfully');
      }

      navigate('/promotions');
    } catch (error) {
      message.error(error.message || `Failed to ${isEditMode ? 'update' : 'create'} promotion`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={isEditMode ? 'Edit Promotion' : 'Add New Promotion'}
        subtitle={isEditMode ? 'Update promotion details' : 'Record a new marketing activity'}
      />

      <div className="form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label required">Promotion Date</label>
            <input
              type="date"
              name="promotionDate"
              className={`form-input ${errors.promotionDate ? 'error' : ''}`}
              value={formData.promotionDate}
              onChange={handleChange}
            />
            {errors.promotionDate && <div className="form-error">{errors.promotionDate}</div>}
          </div>

          <div className="form-group">
            <label className="form-label required">Promotion Type</label>
            <select
              name="promotionType"
              className={`form-select ${errors.promotionType ? 'error' : ''}`}
              value={formData.promotionType}
              onChange={handleChange}
            >
              <option value="Flyer">Flyer</option>
              <option value="Marketing">Marketing</option>
              <option value="Advertisement">Advertisement</option>
              <option value="Campaign">Campaign</option>
            </select>
            {errors.promotionType && <div className="form-error">{errors.promotionType}</div>}
          </div>

          <div className="form-group">
            <label className="form-label required">Description</label>
            <textarea
              name="description"
              className={`form-textarea ${errors.description ? 'error' : ''}`}
              rows="4"
              placeholder="Enter promotion description"
              value={formData.description}
              onChange={handleChange}
            />
            {errors.description && <div className="form-error">{errors.description}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Expense</label>
            <input
              type="number"
              name="expense"
              className="form-input"
              placeholder="Enter expense amount"
              value={formData.expense}
              onChange={handleChange}
              min="0"
              step="0.01"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Target Audience</label>
            <input
              type="text"
              name="targetAudience"
              className="form-input"
              placeholder="Enter target audience"
              value={formData.targetAudience}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Recorded By</label>
            <input
              type="text"
              name="recordedBy"
              className="form-input"
              placeholder="Enter recorder name"
              value={formData.recordedBy}
              onChange={handleChange}
            />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : (isEditMode ? 'Update' : 'Save')} Promotion
            </button>
            <button
              type="button"
              className="btn btn-default"
              onClick={() => navigate('/promotions')}
            >
              Back to List
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PromotionForm;
