import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import { farmerAPI, advanceAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import SearchableSelect from '../common/SearchableSelect';


const AdvanceForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [farmers, setFarmers] = useState([]);
  const [formData, setFormData] = useState({
    farmerId: '',
    advanceDate: new Date().toISOString().split('T')[0],
    advanceAmount: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    searchFarmer('');
  }, []);

  const searchFarmer = async (value) => {
    try {
      // Only search if query has at least 1 character, otherwise fetch all farmers
      const trimmedValue = typeof value === 'string' ? value.trim() : '';
      if (!trimmedValue || trimmedValue.length === 0) {
        const response = await farmerAPI.getAll({ limit: 100 });
        setFarmers(response.data);
      } else {
        const response = await farmerAPI.search(trimmedValue);
        setFarmers(response.data);
      }
    } catch (error) {
      message.error(error.message || 'Failed to search farmers');
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.farmerId) {
      newErrors.farmerId = 'Please select a farmer';
    }

    if (!formData.advanceDate) {
      newErrors.advanceDate = 'Please select advance date';
    }

    if (!formData.advanceAmount) {
      newErrors.advanceAmount = 'Please enter advance amount';
    } else if (parseFloat(formData.advanceAmount) <= 0) {
      newErrors.advanceAmount = 'Amount must be greater than 0';
    }

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
      const payload = {
        farmerId: formData.farmerId,
        advanceDate: new Date(formData.advanceDate).toISOString(),
        advanceAmount: parseFloat(formData.advanceAmount)
      };

      await advanceAPI.create(payload);
      message.success('Advance created successfully');
      navigate('/payments/advances');
    } catch (error) {
      message.error(error.message || 'Failed to create advance');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const farmerOptions = farmers.map(farmer => ({
    label: `${farmer.farmerNumber} - ${farmer.personalDetails?.name}`,
    value: farmer._id
  }));

  return (
    <div>
      <PageHeader
        title="Create Advance"
        subtitle="Issue advance payment to farmer"
      />

      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Select Farmer <span style={{ color: 'red' }}>*</span>
            </label>
            <SearchableSelect
              options={farmerOptions}
              placeholder="Search farmer"
              onSearch={searchFarmer}
              value={formData.farmerId}
              onChange={(value) => handleChange('farmerId', value)}
            />
            {errors.farmerId && (
              <div style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
                {errors.farmerId}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Advance Date <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="date"
              value={formData.advanceDate}
              onChange={(e) => handleChange('advanceDate', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            {errors.advanceDate && (
              <div style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
                {errors.advanceDate}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Advance Amount <span style={{ color: 'red' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#888'
              }}>
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.advanceAmount}
                onChange={(e) => handleChange('advanceAmount', e.target.value)}
                placeholder="Enter advance amount"
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 28px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            {errors.advanceAmount && (
              <div style={{ color: 'red', fontSize: '14px', marginTop: '4px' }}>
                {errors.advanceAmount}
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 16px',
                backgroundColor: loading ? '#d9d9d9' : '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginRight: '8px',
                fontSize: '14px'
              }}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/payments/advances')}
              style={{
                padding: '8px 16px',
                backgroundColor: 'white',
                color: '#000',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdvanceForm;
