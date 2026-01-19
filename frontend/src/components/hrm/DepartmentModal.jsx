import { useState, useEffect } from 'react';
import { departmentAPI } from '../../services/api';
import { message } from '../../utils/toast';
import './DepartmentModal.css';

const DepartmentModal = ({ department, employees, onClose, onSuccess }) => {
  const isEditMode = Boolean(department);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    headOfDepartment: '',
    budget: 0,
    status: 'Active',
    remarks: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name || '',
        code: department.code || '',
        description: department.description || '',
        headOfDepartment: department.headOfDepartment?._id || '',
        budget: department.budget || 0,
        status: department.status || 'Active',
        remarks: department.remarks || ''
      });
    }
  }, [department]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Department name is required';
    }

    if (!formData.code.trim()) {
      newErrors.code = 'Department code is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      if (isEditMode) {
        await departmentAPI.update(department._id, formData);
        message.success('Department updated successfully');
      } else {
        await departmentAPI.create(formData);
        message.success('Department created successfully');
      }
      onSuccess();
    } catch (error) {
      message.error(error.message || 'Failed to save department');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Department' : 'Add New Department'}</h2>
          <button className="modal-close" onClick={onClose}>
            <i className="icon-x"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label>
                  Department Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={errors.name ? 'error' : ''}
                  placeholder="e.g., Production Department"
                />
                {errors.name && <span className="error-message">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label>
                  Department Code <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                  className={errors.code ? 'error' : ''}
                  placeholder="e.g., PROD"
                  disabled={isEditMode}
                />
                {errors.code && <span className="error-message">{errors.code}</span>}
              </div>

              <div className="form-group full-width">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows="3"
                  placeholder="Brief description of the department..."
                />
              </div>

              <div className="form-group">
                <label>Head of Department</label>
                <select
                  value={formData.headOfDepartment}
                  onChange={(e) => handleInputChange('headOfDepartment', e.target.value)}
                >
                  <option value="">Select Head</option>
                  {employees.map(emp => (
                    <option key={emp._id} value={emp._id}>
                      {emp.personalDetails?.name} ({emp.employeeNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Budget</label>
                <input
                  type="number"
                  value={formData.budget}
                  onChange={(e) => handleInputChange('budget', parseFloat(e.target.value) || 0)}
                  min="0"
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="form-group full-width">
                <label>Remarks</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => handleInputChange('remarks', e.target.value)}
                  rows="3"
                  placeholder="Any additional notes..."
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : (isEditMode ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DepartmentModal;
