import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { itemAPI, stockAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import SearchableSelect from '../common/SearchableSelect';
import './StockInForm.css';

const StockInForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    itemId: null,
    quantity: '',
    rate: '',
    transactionDate: dayjs().format('YYYY-MM-DD'),
    referenceType: 'Purchase',
    referenceNo: '',
    remarks: ''
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await itemAPI.getAll();
      setItems(response.data.filter(item => item.status === 'Active'));
    } catch (error) {
      message.error(error.message || 'Failed to fetch items');
    }
  };

  const handleInputChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleItemChange = (itemId) => {
    const item = items.find(i => i._id === itemId);
    setSelectedItem(item);
    if (item) {
      setFormData(prev => ({
        ...prev,
        itemId: itemId,
        rate: item.purchaseRate
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.itemId) {
      newErrors.itemId = 'Please select an item';
    }
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      newErrors.quantity = 'Please enter a valid quantity greater than 0';
    }
    if (!formData.rate || parseFloat(formData.rate) < 0) {
      newErrors.rate = 'Please enter a valid rate';
    }
    if (!formData.transactionDate) {
      newErrors.transactionDate = 'Please select transaction date';
    }
    if (!formData.referenceType) {
      newErrors.referenceType = 'Please select reference type';
    }

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
        itemId: formData.itemId,
        quantity: parseFloat(formData.quantity),
        rate: parseFloat(formData.rate),
        transactionDate: new Date(formData.transactionDate).toISOString(),
        referenceType: formData.referenceType,
        referenceNo: formData.referenceNo,
        remarks: formData.remarks
      };

      await stockAPI.stockIn(payload);
      message.success('Stock added successfully');
      navigate('/inventory/stock-report');
    } catch (error) {
      message.error(error.message || 'Failed to add stock');
    } finally {
      setLoading(false);
    }
  };

  const itemOptions = items.map(item => ({
    label: `${item.itemCode} - ${item.itemName} (Current: ${item.currentBalance} ${item.unit})`,
    value: item._id
  }));

  return (
    <div className="stock-form-container">
      <PageHeader
        title="Stock In"
        subtitle="Add stock to inventory"
      />

      <div className="stock-card">
        <form onSubmit={handleSubmit} className="stock-form">
          <div className="form-group">
            <label className="form-label required">Select Item</label>
            <SearchableSelect
              options={itemOptions}
              placeholder="Select an item"
              value={formData.itemId}
              onChange={handleItemChange}
            />
            {errors.itemId && <div className="form-error">{errors.itemId}</div>}
          </div>

          {selectedItem && (
            <div className="info-card">
              <p><strong>Current Balance:</strong> {selectedItem.currentBalance} {selectedItem.unit}</p>
              <p><strong>Purchase Rate:</strong> ₹{selectedItem.purchaseRate}</p>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label required">Quantity</label>
              <div className="input-with-suffix">
                <input
                  type="number"
                  className={`form-input ${errors.quantity ? 'error' : ''}`}
                  placeholder="Enter quantity"
                  value={formData.quantity}
                  onChange={(e) => handleInputChange('quantity', e.target.value)}
                  min="0.01"
                  step="0.01"
                />
                <span className="input-suffix">{selectedItem?.unit || 'Unit'}</span>
              </div>
              {errors.quantity && <div className="form-error">{errors.quantity}</div>}
            </div>

            <div className="form-group">
              <label className="form-label required">Rate per Unit</label>
              <div className="input-with-prefix">
                <span className="input-prefix">₹</span>
                <input
                  type="number"
                  className={`form-input ${errors.rate ? 'error' : ''}`}
                  placeholder="Enter rate"
                  value={formData.rate}
                  onChange={(e) => handleInputChange('rate', e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              {errors.rate && <div className="form-error">{errors.rate}</div>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label required">Transaction Date</label>
              <input
                type="date"
                className={`form-input ${errors.transactionDate ? 'error' : ''}`}
                value={formData.transactionDate}
                onChange={(e) => handleInputChange('transactionDate', e.target.value)}
              />
              {errors.transactionDate && <div className="form-error">{errors.transactionDate}</div>}
            </div>

            <div className="form-group">
              <label className="form-label required">Reference Type</label>
              <select
                className={`form-select ${errors.referenceType ? 'error' : ''}`}
                value={formData.referenceType}
                onChange={(e) => handleInputChange('referenceType', e.target.value)}
              >
                <option value="Purchase">Purchase</option>
                <option value="Opening">Opening Balance</option>
                <option value="Adjustment">Adjustment</option>
                <option value="Return">Return</option>
              </select>
              {errors.referenceType && <div className="form-error">{errors.referenceType}</div>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reference Number</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter reference number (e.g., Invoice No.)"
              value={formData.referenceNo}
              onChange={(e) => handleInputChange('referenceNo', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Remarks</label>
            <textarea
              className="form-textarea"
              rows="3"
              placeholder="Enter any remarks"
              value={formData.remarks}
              onChange={(e) => handleInputChange('remarks', e.target.value)}
            />
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
                  Saving...
                </>
              ) : (
                <>
                  <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z"/>
                  </svg>
                  Save
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-default"
              onClick={() => navigate('/inventory/stock-report')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockInForm;
