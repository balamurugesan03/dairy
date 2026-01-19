import { useState, useEffect } from 'react';
import { designationAPI } from '../../services/api';
import { message } from '../../utils/toast';
import './DepartmentModal.css';

const DesignationModal = ({ designation, departments, onClose, onSuccess }) => {
  const isEditMode = Boolean(designation);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    level: 'Entry',
    description: '',
    department: '',
    salaryRange: { min: 0, max: 0 },
    responsibilities: [],
    qualifications: [],
    status: 'Active',
    remarks: ''
  });

  const [responsibilityInput, setResponsibilityInput] = useState('');
  const [qualificationInput, setQualificationInput] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (designation) {
      setFormData({
        name: designation.name || '',
        code: designation.code || '',
        level: designation.level || 'Entry',
        description: designation.description || '',
        department: designation.department?._id || '',
        salaryRange: designation.salaryRange || { min: 0, max: 0 },
        responsibilities: designation.responsibilities || [],
        qualifications: designation.qualifications || [],
        status: designation.status || 'Active',
        remarks: designation.remarks || ''
      });
    }
  }, [designation]);

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const addResponsibility = () => {
    if (responsibilityInput.trim()) {
      setFormData(prev => ({
        ...prev,
        responsibilities: [...prev.responsibilities, responsibilityInput.trim()]
      }));
      setResponsibilityInput('');
    }
  };

  const removeResponsibility = (index) => {
    setFormData(prev => ({
      ...prev,
      responsibilities: prev.responsibilities.filter((_, i) => i !== index)
    }));
  };

  const addQualification = () => {
    if (qualificationInput.trim()) {
      setFormData(prev => ({
        ...prev,
        qualifications: [...prev.qualifications, qualificationInput.trim()]
      }));
      setQualificationInput('');
    }
  };

  const removeQualification = (index) => {
    setFormData(prev => ({
      ...prev,
      qualifications: prev.qualifications.filter((_, i) => i !== index)
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Designation name is required';
    }

    if (!formData.code.trim()) {
      newErrors.code = 'Designation code is required';
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
        await designationAPI.update(designation._id, formData);
        message.success('Designation updated successfully');
      } else {
        await designationAPI.create(formData);
        message.success('Designation created successfully');
      }
      onSuccess();
    } catch (error) {
      message.error(error.message || 'Failed to save designation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Designation' : 'Add New Designation'}</h2>
          <button className="modal-close" onClick={onClose}>
            <i className="icon-x"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label>
                  Designation Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={errors.name ? 'error' : ''}
                  placeholder="e.g., Production Manager"
                />
                {errors.name && <span className="error-message">{errors.name}</span>}
              </div>

              <div className="form-group">
                <label>
                  Designation Code <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                  className={errors.code ? 'error' : ''}
                  placeholder="e.g., PM"
                  disabled={isEditMode}
                />
                {errors.code && <span className="error-message">{errors.code}</span>}
              </div>

              <div className="form-group">
                <label>Level</label>
                <select
                  value={formData.level}
                  onChange={(e) => handleInputChange('level', e.target.value)}
                >
                  <option value="Entry">Entry</option>
                  <option value="Junior">Junior</option>
                  <option value="Mid">Mid</option>
                  <option value="Senior">Senior</option>
                  <option value="Manager">Manager</option>
                  <option value="Executive">Executive</option>
                </select>
              </div>

              <div className="form-group">
                <label>Department</label>
                <select
                  value={formData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group full-width">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows="3"
                  placeholder="Brief description of the designation..."
                />
              </div>

              <div className="form-group">
                <label>Minimum Salary</label>
                <input
                  type="number"
                  value={formData.salaryRange.min}
                  onChange={(e) => handleInputChange('salaryRange.min', parseFloat(e.target.value) || 0)}
                  min="0"
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label>Maximum Salary</label>
                <input
                  type="number"
                  value={formData.salaryRange.max}
                  onChange={(e) => handleInputChange('salaryRange.max', parseFloat(e.target.value) || 0)}
                  min="0"
                  placeholder="0.00"
                />
              </div>

              <div className="form-group full-width">
                <label>Responsibilities</label>
                <div className="list-input-group">
                  <input
                    type="text"
                    value={responsibilityInput}
                    onChange={(e) => setResponsibilityInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addResponsibility())}
                    placeholder="Add responsibility and press Enter"
                  />
                  <button type="button" onClick={addResponsibility} className="btn btn-secondary">
                    Add
                  </button>
                </div>
                <div className="list-items">
                  {formData.responsibilities.map((item, index) => (
                    <div key={index} className="list-item">
                      <span>{item}</span>
                      <button type="button" onClick={() => removeResponsibility(index)}>
                        <i className="icon-x"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group full-width">
                <label>Qualifications</label>
                <div className="list-input-group">
                  <input
                    type="text"
                    value={qualificationInput}
                    onChange={(e) => setQualificationInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addQualification())}
                    placeholder="Add qualification and press Enter"
                  />
                  <button type="button" onClick={addQualification} className="btn btn-secondary">
                    Add
                  </button>
                </div>
                <div className="list-items">
                  {formData.qualifications.map((item, index) => (
                    <div key={index} className="list-item">
                      <span>{item}</span>
                      <button type="button" onClick={() => removeQualification(index)}>
                        <i className="icon-x"></i>
                      </button>
                    </div>
                  ))}
                </div>
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

export default DesignationModal;
