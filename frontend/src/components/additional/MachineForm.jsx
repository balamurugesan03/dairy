import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { machineAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import './MachineForm.css';


const MachineForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    machineCode: '',
    machineName: '',
    category: 'Processing',
    manufacturer: '',
    model: '',
    serialNumber: '',
    purchaseDate: '',
    purchaseCost: '',
    installationDate: '',
    location: '',
    capacity: '',
    powerRating: '',
    lastMaintenanceDate: '',
    nextMaintenanceDate: '',
    maintenanceInterval: '',
    status: 'Active',
    description: '',
    specifications: '',
    maintenanceNotes: ''
  });
  const [errors, setErrors] = useState({});

  const isEditMode = Boolean(id);

  useEffect(() => {
    if (isEditMode) {
      fetchMachine();
    }
  }, [id]);

  const fetchMachine = async () => {
    setLoading(true);
    try {
      const response = await machineAPI.getById(id);
      const machine = response.data;

      setFormData({
        ...machine,
        purchaseDate: machine.purchaseDate ? dayjs(machine.purchaseDate).format('YYYY-MM-DD') : '',
        installationDate: machine.installationDate ? dayjs(machine.installationDate).format('YYYY-MM-DD') : '',
        lastMaintenanceDate: machine.lastMaintenanceDate ? dayjs(machine.lastMaintenanceDate).format('YYYY-MM-DD') : '',
        nextMaintenanceDate: machine.nextMaintenanceDate ? dayjs(machine.nextMaintenanceDate).format('YYYY-MM-DD') : ''
      });
    } catch (error) {
      message.error(error.message || 'Failed to fetch machine details');
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
    if (!formData.machineCode) newErrors.machineCode = 'Machine code is required';
    if (!formData.machineName) newErrors.machineName = 'Machine name is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.manufacturer) newErrors.manufacturer = 'Manufacturer is required';
    if (!formData.model) newErrors.model = 'Model is required';
    if (!formData.serialNumber) newErrors.serialNumber = 'Serial number is required';
    if (!formData.status) newErrors.status = 'Status is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      message.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        purchaseDate: formData.purchaseDate ? new Date(formData.purchaseDate).toISOString() : null,
        installationDate: formData.installationDate ? new Date(formData.installationDate).toISOString() : null,
        lastMaintenanceDate: formData.lastMaintenanceDate ? new Date(formData.lastMaintenanceDate).toISOString() : null,
        nextMaintenanceDate: formData.nextMaintenanceDate ? new Date(formData.nextMaintenanceDate).toISOString() : null,
        purchaseCost: formData.purchaseCost ? parseFloat(formData.purchaseCost) : null,
        maintenanceInterval: formData.maintenanceInterval ? parseInt(formData.maintenanceInterval) : null
      };

      if (isEditMode) {
        await machineAPI.update(id, payload);
        message.success('Machine updated successfully');
      } else {
        await machineAPI.create(payload);
        message.success('Machine created successfully');
      }
      navigate('/additional/machines');
    } catch (error) {
      message.error(error.message || 'Failed to save machine');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={isEditMode ? 'Edit Machine' : 'Add Machine'}
        subtitle={isEditMode ? 'Update machine information' : 'Register new machine'}
      />

      <div className="machine-form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label required">Machine Code</label>
              <input
                type="text"
                name="machineCode"
                className={`form-input ${errors.machineCode ? 'error' : ''}`}
                placeholder="Enter machine code"
                value={formData.machineCode}
                onChange={handleChange}
                disabled={isEditMode}
              />
              {errors.machineCode && <div className="form-error">{errors.machineCode}</div>}
            </div>

            <div className="form-group">
              <label className="form-label required">Machine Name</label>
              <input
                type="text"
                name="machineName"
                className={`form-input ${errors.machineName ? 'error' : ''}`}
                placeholder="Enter machine name"
                value={formData.machineName}
                onChange={handleChange}
              />
              {errors.machineName && <div className="form-error">{errors.machineName}</div>}
            </div>

            <div className="form-group">
              <label className="form-label required">Category</label>
              <select
                name="category"
                className={`form-select ${errors.category ? 'error' : ''}`}
                value={formData.category}
                onChange={handleChange}
              >
                <option value="Processing">Processing</option>
                <option value="Packaging">Packaging</option>
                <option value="Testing">Testing</option>
                <option value="Storage">Storage</option>
                <option value="Other">Other</option>
              </select>
              {errors.category && <div className="form-error">{errors.category}</div>}
            </div>

            <div className="form-group">
              <label className="form-label required">Manufacturer</label>
              <input
                type="text"
                name="manufacturer"
                className={`form-input ${errors.manufacturer ? 'error' : ''}`}
                placeholder="Enter manufacturer name"
                value={formData.manufacturer}
                onChange={handleChange}
              />
              {errors.manufacturer && <div className="form-error">{errors.manufacturer}</div>}
            </div>

            <div className="form-group">
              <label className="form-label required">Model</label>
              <input
                type="text"
                name="model"
                className={`form-input ${errors.model ? 'error' : ''}`}
                placeholder="Enter model number"
                value={formData.model}
                onChange={handleChange}
              />
              {errors.model && <div className="form-error">{errors.model}</div>}
            </div>

            <div className="form-group">
              <label className="form-label required">Serial Number</label>
              <input
                type="text"
                name="serialNumber"
                className={`form-input ${errors.serialNumber ? 'error' : ''}`}
                placeholder="Enter serial number"
                value={formData.serialNumber}
                onChange={handleChange}
              />
              {errors.serialNumber && <div className="form-error">{errors.serialNumber}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Purchase Date</label>
              <input
                type="date"
                name="purchaseDate"
                className="form-input"
                value={formData.purchaseDate}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Purchase Cost</label>
              <input
                type="number"
                name="purchaseCost"
                className="form-input"
                placeholder="Enter purchase cost"
                value={formData.purchaseCost}
                onChange={handleChange}
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Installation Date</label>
              <input
                type="date"
                name="installationDate"
                className="form-input"
                value={formData.installationDate}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Location</label>
              <input
                type="text"
                name="location"
                className="form-input"
                placeholder="Enter machine location"
                value={formData.location}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Capacity</label>
              <input
                type="text"
                name="capacity"
                className="form-input"
                placeholder="Enter capacity (e.g., 1000 liters/hour)"
                value={formData.capacity}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Power Rating</label>
              <input
                type="text"
                name="powerRating"
                className="form-input"
                placeholder="Enter power rating (e.g., 5 kW)"
                value={formData.powerRating}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Last Maintenance Date</label>
              <input
                type="date"
                name="lastMaintenanceDate"
                className="form-input"
                value={formData.lastMaintenanceDate}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Next Maintenance Date</label>
              <input
                type="date"
                name="nextMaintenanceDate"
                className="form-input"
                value={formData.nextMaintenanceDate}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Maintenance Interval (Days)</label>
              <input
                type="number"
                name="maintenanceInterval"
                className="form-input"
                placeholder="Enter maintenance interval"
                value={formData.maintenanceInterval}
                onChange={handleChange}
                min="1"
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Status</label>
              <select
                name="status"
                className={`form-select ${errors.status ? 'error' : ''}`}
                value={formData.status}
                onChange={handleChange}
              >
                <option value="Active">Active</option>
                <option value="Under Maintenance">Under Maintenance</option>
                <option value="Out of Service">Out of Service</option>
                <option value="Inactive">Inactive</option>
              </select>
              {errors.status && <div className="form-error">{errors.status}</div>}
            </div>

            <div className="form-group full-width">
              <label className="form-label">Description</label>
              <textarea
                name="description"
                className="form-textarea"
                rows="3"
                placeholder="Enter machine description"
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            <div className="form-group full-width">
              <label className="form-label">Technical Specifications</label>
              <textarea
                name="specifications"
                className="form-textarea"
                rows="4"
                placeholder="Enter technical specifications"
                value={formData.specifications}
                onChange={handleChange}
              />
            </div>

            <div className="form-group full-width">
              <label className="form-label">Maintenance Notes</label>
              <textarea
                name="maintenanceNotes"
                className="form-textarea"
                rows="3"
                placeholder="Enter maintenance notes and instructions"
                value={formData.maintenanceNotes}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  {isEditMode ? 'Updating...' : 'Saving...'}
                </>
              ) : (
                isEditMode ? 'Update' : 'Save'
              )}
            </button>
            <button
              type="button"
              className="btn btn-default"
              onClick={() => navigate('/additional/machines')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MachineForm;
