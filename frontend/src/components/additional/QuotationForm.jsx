import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate, useParams } from 'react-router-dom';
import { quotationAPI, itemAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import './QuotationForm.css';

const QuotationForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [quotationItems, setQuotationItems] = useState([]);
  const [formData, setFormData] = useState({
    quotationNumber: '',
    quotationDate: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    status: 'Draft',
    discount: 0,
    notes: '',
    termsAndConditions: ''
  });
  const [totals, setTotals] = useState({
    subtotal: 0,
    taxAmount: 0,
    discount: 0,
    totalAmount: 0
  });
  const [errors, setErrors] = useState({});

  const isEditMode = Boolean(id);

  useEffect(() => {
    fetchItems();
    if (isEditMode) {
      fetchQuotation();
    }
  }, [id]);

  const fetchItems = async () => {
    try {
      const response = await itemAPI.getAll();
      setItems(response.data || []);
    } catch (error) {
      message.error('Failed to fetch items');
    }
  };

  const fetchQuotation = async () => {
    setLoading(true);
    try {
      const response = await quotationAPI.getById(id);
      const quotation = response.data;

      setFormData({
        quotationNumber: quotation.quotationNumber || '',
        quotationDate: quotation.quotationDate ? new Date(quotation.quotationDate).toISOString().split('T')[0] : '',
        validUntil: quotation.validUntil ? new Date(quotation.validUntil).toISOString().split('T')[0] : '',
        customerName: quotation.customerName || '',
        customerPhone: quotation.customerPhone || '',
        customerEmail: quotation.customerEmail || '',
        customerAddress: quotation.customerAddress || '',
        status: quotation.status || 'Draft',
        discount: quotation.discount || 0,
        notes: quotation.notes || '',
        termsAndConditions: quotation.termsAndConditions || ''
      });

      setQuotationItems(quotation.items || []);
      calculateTotals(quotation.items || [], quotation.discount || 0);
    } catch (error) {
      message.error(error.message || 'Failed to fetch quotation details');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = (itemsList, discountAmount = 0) => {
    const subtotal = itemsList.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const taxAmount = itemsList.reduce((sum, item) => {
      const itemTotal = item.quantity * item.rate;
      return sum + (itemTotal * (item.taxPercent || 0) / 100);
    }, 0);
    const totalAmount = subtotal + taxAmount - discountAmount;

    setTotals({
      subtotal,
      taxAmount,
      discount: discountAmount,
      totalAmount
    });
  };

  const handleAddItem = () => {
    const newItem = {
      key: Date.now(),
      itemId: '',
      itemName: '',
      description: '',
      quantity: 1,
      rate: 0,
      taxPercent: 0,
      amount: 0
    };
    const updatedItems = [...quotationItems, newItem];
    setQuotationItems(updatedItems);
  };

  const handleDeleteItem = (key) => {
    const updatedItems = quotationItems.filter(item => item.key !== key);
    setQuotationItems(updatedItems);
    calculateTotals(updatedItems, formData.discount || 0);
  };

  const handleItemChange = (key, field, value) => {
    const updatedItems = quotationItems.map(item => {
      if (item.key === key) {
        const updatedItem = { ...item, [field]: value };

        if (field === 'itemId') {
          const selectedItem = items.find(i => i._id === value);
          if (selectedItem) {
            updatedItem.itemName = selectedItem.itemName;
            updatedItem.rate = selectedItem.salesRate || 0;
            updatedItem.taxPercent = selectedItem.gstPercent || 0;
          }
        }

        updatedItem.amount = updatedItem.quantity * updatedItem.rate;
        return updatedItem;
      }
      return item;
    });

    setQuotationItems(updatedItems);
    calculateTotals(updatedItems, formData.discount || 0);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'discount') {
      calculateTotals(quotationItems, parseFloat(value) || 0);
    }

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.quotationNumber?.trim()) {
      newErrors.quotationNumber = 'Please enter quotation number';
    }
    if (!formData.quotationDate) {
      newErrors.quotationDate = 'Please select date';
    }
    if (!formData.validUntil) {
      newErrors.validUntil = 'Please select valid until date';
    }
    if (!formData.customerName?.trim()) {
      newErrors.customerName = 'Please enter customer name';
    }
    if (!formData.customerPhone?.trim()) {
      newErrors.customerPhone = 'Please enter phone number';
    } else if (!/^[0-9]{10}$/.test(formData.customerPhone)) {
      newErrors.customerPhone = 'Please enter valid 10-digit phone number';
    }
    if (formData.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail)) {
      newErrors.customerEmail = 'Please enter valid email';
    }
    if (!formData.status) {
      newErrors.status = 'Please select status';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      message.error('Please fix the validation errors');
      return;
    }

    if (quotationItems.length === 0) {
      message.error('Please add at least one item');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        quotationDate: new Date(formData.quotationDate).toISOString(),
        validUntil: new Date(formData.validUntil).toISOString(),
        discount: parseFloat(formData.discount) || 0,
        items: quotationItems.map(item => ({
          itemId: item.itemId,
          itemName: item.itemName,
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          taxPercent: item.taxPercent,
          amount: item.amount
        })),
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount
      };

      if (isEditMode) {
        await quotationAPI.update(id, payload);
        message.success('Quotation updated successfully');
      } else {
        await quotationAPI.create(payload);
        message.success('Quotation created successfully');
      }
      navigate('/additional/quotations');
    } catch (error) {
      message.error(error.message || 'Failed to save quotation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="quotation-form-container">
      <PageHeader
        title={isEditMode ? 'Edit Quotation' : 'Add Quotation'}
        subtitle={isEditMode ? 'Update quotation information' : 'Create new quotation'}
      />

      <div className="quotation-form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="quotationNumber">
                Quotation Number <span className="required">*</span>
              </label>
              <input
                type="text"
                id="quotationNumber"
                name="quotationNumber"
                value={formData.quotationNumber}
                onChange={handleInputChange}
                placeholder="Enter quotation number"
                disabled={isEditMode}
                className={errors.quotationNumber ? 'error' : ''}
              />
              {errors.quotationNumber && <span className="error-message">{errors.quotationNumber}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="quotationDate">
                Quotation Date <span className="required">*</span>
              </label>
              <input
                type="date"
                id="quotationDate"
                name="quotationDate"
                value={formData.quotationDate}
                onChange={handleInputChange}
                className={errors.quotationDate ? 'error' : ''}
              />
              {errors.quotationDate && <span className="error-message">{errors.quotationDate}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="validUntil">
                Valid Until <span className="required">*</span>
              </label>
              <input
                type="date"
                id="validUntil"
                name="validUntil"
                value={formData.validUntil}
                onChange={handleInputChange}
                className={errors.validUntil ? 'error' : ''}
              />
              {errors.validUntil && <span className="error-message">{errors.validUntil}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="customerName">
                Customer Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="customerName"
                name="customerName"
                value={formData.customerName}
                onChange={handleInputChange}
                placeholder="Enter customer name"
                className={errors.customerName ? 'error' : ''}
              />
              {errors.customerName && <span className="error-message">{errors.customerName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="customerPhone">
                Customer Phone <span className="required">*</span>
              </label>
              <input
                type="tel"
                id="customerPhone"
                name="customerPhone"
                value={formData.customerPhone}
                onChange={handleInputChange}
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
                onChange={handleInputChange}
                placeholder="Enter email address"
                className={errors.customerEmail ? 'error' : ''}
              />
              {errors.customerEmail && <span className="error-message">{errors.customerEmail}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="status">
                Status <span className="required">*</span>
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className={errors.status ? 'error' : ''}
              >
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
                <option value="Expired">Expired</option>
              </select>
              {errors.status && <span className="error-message">{errors.status}</span>}
            </div>

            <div className="form-group full-width">
              <label htmlFor="customerAddress">Customer Address</label>
              <textarea
                id="customerAddress"
                name="customerAddress"
                value={formData.customerAddress}
                onChange={handleInputChange}
                placeholder="Enter customer address"
                rows={2}
              />
            </div>
          </div>

          <div className="items-section">
            <div className="items-header">
              <h3>Quotation Items</h3>
              <button type="button" onClick={handleAddItem} className="btn btn-primary">
                + Add Item
              </button>
            </div>

            <div className="table-wrapper">
              <table className="items-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Rate</th>
                    <th>Tax %</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {quotationItems.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="no-items">No items added</td>
                    </tr>
                  ) : (
                    quotationItems.map(item => (
                      <tr key={item.key}>
                        <td>
                          <select
                            value={item.itemId}
                            onChange={(e) => handleItemChange(item.key, 'itemId', e.target.value)}
                            className="item-select"
                          >
                            <option value="">Select item</option>
                            {items.map(i => (
                              <option key={i._id} value={i._id}>
                                {i.itemName}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(item.key, 'description', e.target.value)}
                            placeholder="Description"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(item.key, 'quantity', parseFloat(e.target.value) || 1)}
                            min="1"
                            className="number-input"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={item.rate}
                            onChange={(e) => handleItemChange(item.key, 'rate', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                            className="number-input"
                            placeholder="₹"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={item.taxPercent}
                            onChange={(e) => handleItemChange(item.key, 'taxPercent', parseFloat(e.target.value) || 0)}
                            min="0"
                            max="100"
                            className="number-input"
                          />
                        </td>
                        <td className="amount-cell">₹{(item.amount || 0).toFixed(2)}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.key)}
                            className="btn btn-danger btn-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="discount-section">
              <div className="form-group">
                <label htmlFor="discount">Discount Amount</label>
                <input
                  type="number"
                  id="discount"
                  name="discount"
                  value={formData.discount}
                  onChange={handleInputChange}
                  placeholder="Enter discount"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="totals-card">
              <div className="totals-row">
                <span>Subtotal:</span>
                <span>₹{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="totals-row">
                <span>Tax Amount:</span>
                <span>₹{totals.taxAmount.toFixed(2)}</span>
              </div>
              <div className="totals-row">
                <span>Discount:</span>
                <span>₹{totals.discount.toFixed(2)}</span>
              </div>
              <hr />
              <div className="totals-row total">
                <strong>Total Amount:</strong>
                <strong>₹{totals.totalAmount.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group full-width">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Enter any additional notes"
                rows={3}
              />
            </div>

            <div className="form-group full-width">
              <label htmlFor="termsAndConditions">Terms and Conditions</label>
              <textarea
                id="termsAndConditions"
                name="termsAndConditions"
                value={formData.termsAndConditions}
                onChange={handleInputChange}
                placeholder="Enter terms and conditions"
                rows={4}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : isEditMode ? 'Update' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/additional/quotations')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuotationForm;
