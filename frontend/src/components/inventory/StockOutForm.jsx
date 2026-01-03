import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import { itemAPI, stockAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import SearchableSelect from '../common/SearchableSelect';
import './StockOutForm.css';

const StockOutForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  const [formData, setFormData] = useState({
    itemId: '',
    quantity: '',
    rate: '',
    transactionDate: new Date().toISOString().split('T')[0],
    referenceType: 'Sale',
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

  const handleItemChange = (itemId) => {
    const item = items.find(i => i._id === itemId);
    setSelectedItem(item);
    setFormData(prev => ({
      ...prev,
      itemId,
      rate: item ? item.salesRate : ''
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.itemId) {
        message.error('Please select an item');
        setLoading(false);
        return;
      }

      if (!formData.quantity || formData.quantity <= 0) {
        message.error('Please enter a valid quantity');
        setLoading(false);
        return;
      }

      if (!formData.rate || formData.rate < 0) {
        message.error('Please enter a valid rate');
        setLoading(false);
        return;
      }

      if (selectedItem && parseFloat(formData.quantity) > selectedItem.currentBalance) {
        message.error('Quantity exceeds current balance');
        setLoading(false);
        return;
      }

      const payload = {
        itemId: formData.itemId,
        quantity: parseFloat(formData.quantity),
        rate: parseFloat(formData.rate),
        transactionDate: new Date(formData.transactionDate).toISOString(),
        referenceType: formData.referenceType,
        referenceNo: formData.referenceNo,
        remarks: formData.remarks
      };

      await stockAPI.stockOut(payload);
      message.success('Stock removed successfully');
      navigate('/inventory/stock-report');
    } catch (error) {
      message.error(error.message || 'Failed to remove stock');
    } finally {
      setLoading(false);
    }
  };

  const itemOptions = items.map(item => ({
    label: `${item.itemCode} - ${item.itemName} (Available: ${item.currentBalance} ${item.measurement})`,
    value: item._id
  }));

  const isInsufficientStock = selectedItem && parseFloat(formData.quantity) > selectedItem.currentBalance;

  return (
    <div>
      <PageHeader
        title="Stock Out"
        subtitle="Remove stock from inventory"
      />

      <div className="stock-out-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="itemId">
              Select Item <span className="required">*</span>
            </label>
            <SearchableSelect
              options={itemOptions}
              placeholder="Select an item"
              onChange={handleItemChange}
            />
          </div>

          {selectedItem && (
            <div className="info-card">
              <p><strong>Current Balance:</strong> {selectedItem.currentBalance} {selectedItem.measurement}</p>
              <p><strong>Sales Rate:</strong> ₹{selectedItem.salesRate}</p>
            </div>
          )}

          {isInsufficientStock && (
            <div className="alert alert-error">
              <strong>Insufficient Stock</strong>
              <p>Available stock: {selectedItem.currentBalance} {selectedItem.measurement}. Requested: {formData.quantity} {selectedItem.measurement}</p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="quantity">
              Quantity <span className="required">*</span>
            </label>
            <div className="input-with-addon">
              <input
                type="number"
                id="quantity"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                placeholder="Enter quantity"
                min="0.01"
                step="0.01"
                required
              />
              <span className="input-addon">{selectedItem?.measurement || 'Unit'}</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="rate">
              Rate per Unit <span className="required">*</span>
            </label>
            <div className="input-with-prefix">
              <span className="input-prefix">₹</span>
              <input
                type="number"
                id="rate"
                name="rate"
                value={formData.rate}
                onChange={handleInputChange}
                placeholder="Enter rate"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="transactionDate">
              Transaction Date <span className="required">*</span>
            </label>
            <input
              type="date"
              id="transactionDate"
              name="transactionDate"
              value={formData.transactionDate}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="referenceType">
              Reference Type <span className="required">*</span>
            </label>
            <select
              id="referenceType"
              name="referenceType"
              value={formData.referenceType}
              onChange={handleInputChange}
              required
            >
              <option value="Sale">Sale</option>
              <option value="Adjustment">Adjustment</option>
              <option value="Damage">Damage</option>
              <option value="Return">Return</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="referenceNo">Reference Number</label>
            <input
              type="text"
              id="referenceNo"
              name="referenceNo"
              value={formData.referenceNo}
              onChange={handleInputChange}
              placeholder="Enter reference number (e.g., Bill No.)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="remarks">Remarks</label>
            <textarea
              id="remarks"
              name="remarks"
              value={formData.remarks}
              onChange={handleInputChange}
              rows="3"
              placeholder="Enter any remarks"
            />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || isInsufficientStock}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
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

export default StockOutForm;
