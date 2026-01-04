import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { itemAPI, stockAPI, collectionCenterAPI, subsidyAPI, supplierAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import SearchableSelect from '../common/SearchableSelect';
import './StockInForm.css';

const StockInForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [collectionCenters, setCollectionCenters] = useState([]);
  const [subsidies, setSubsidies] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showSubsidy, setShowSubsidy] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    purchaseDate: dayjs().format('YYYY-MM-DD'),
    invoiceDate: dayjs().format('YYYY-MM-DD'),
    invoiceNumber: '',
    issueCentre: null,
    subsidyId: null,
    subsidyAmount: '',
    referenceType: 'Purchase',
    remarks: '',
    supplierId: null,
    paymentMode: 'Adjustment',
    paidAmount: ''
  });

  const [productRows, setProductRows] = useState([
    {
      id: Date.now(),
      itemId: null,
      quantity: '',
      freeQty: '',
      rate: '',
      selectedItem: null
    }
  ]);

  useEffect(() => {
    fetchItems();
    fetchCollectionCenters();
    fetchSubsidies();
    fetchSuppliers();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await itemAPI.getAll();
      setItems(response.data.filter(item => item.status === 'Active'));
    } catch (error) {
      message.error(error.message || 'Failed to fetch items');
    }
  };

  const fetchCollectionCenters = async () => {
    try {
      const response = await collectionCenterAPI.getAll({ status: 'Active', limit: 1000 });
      setCollectionCenters(response.data || []);
    } catch (error) {
      message.error(error.message || 'Failed to fetch collection centers');
    }
  };

  const fetchSubsidies = async () => {
    try {
      const response = await subsidyAPI.getAll({ status: 'Active', limit: 1000 });
      setSubsidies(response.data || []);
    } catch (error) {
      message.error(error.message || 'Failed to fetch subsidies');
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await supplierAPI.getAll({ status: 'Active', limit: 1000 });
      setSuppliers(response.data || []);
    } catch (error) {
      message.error(error.message || 'Failed to fetch suppliers');
    }
  };

  const handleInputChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleProductChange = (index, field, value) => {
    const updatedRows = [...productRows];
    updatedRows[index][field] = value;

    // If item is changed, update the selected item and rate
    if (field === 'itemId') {
      const item = items.find(i => i._id === value);
      updatedRows[index].selectedItem = item;
      updatedRows[index].rate = item?.salesRate || '';
    }

    setProductRows(updatedRows);

    // Clear error for this field
    const errorKey = `product_${index}_${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const addProductRow = () => {
    setProductRows([
      ...productRows,
      {
        id: Date.now(),
        itemId: null,
        quantity: '',
        freeQty: '',
        rate: '',
        selectedItem: null
      }
    ]);
  };

  const removeProductRow = (index) => {
    if (productRows.length === 1) {
      message.error('At least one product is required');
      return;
    }
    const updatedRows = productRows.filter((_, i) => i !== index);
    setProductRows(updatedRows);
  };

  const validateForm = () => {
    const newErrors = {};

    // Validate form fields
    if (!formData.purchaseDate) {
      newErrors.purchaseDate = 'Purchase date is required';
    }
    if (!formData.invoiceDate) {
      newErrors.invoiceDate = 'Invoice date is required';
    }
    if (!formData.invoiceNumber || formData.invoiceNumber.trim() === '') {
      newErrors.invoiceNumber = 'Invoice number is required';
    }
    if (!formData.issueCentre) {
      newErrors.issueCentre = 'Issue centre is required';
    }

    // Validate subsidy if shown
    if (showSubsidy) {
      if (!formData.subsidyId) {
        newErrors.subsidyId = 'Please select a subsidy';
      }
      if (!formData.subsidyAmount || parseFloat(formData.subsidyAmount) <= 0) {
        newErrors.subsidyAmount = 'Please enter a valid subsidy amount';
      }
    }

    // Validate product rows
    productRows.forEach((row, index) => {
      if (!row.itemId) {
        newErrors[`product_${index}_itemId`] = 'Please select an item';
      }
      if (!row.quantity || parseFloat(row.quantity) <= 0) {
        newErrors[`product_${index}_quantity`] = 'Please enter a valid quantity';
      }
      if (!row.rate || parseFloat(row.rate) < 0) {
        newErrors[`product_${index}_rate`] = 'Please enter a valid rate';
      }
    });

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
        items: productRows.map(row => ({
          itemId: row.itemId,
          quantity: parseFloat(row.quantity),
          freeQty: parseFloat(row.freeQty) || 0,
          rate: parseFloat(row.rate)
        })),
        purchaseDate: new Date(formData.purchaseDate).toISOString(),
        invoiceDate: new Date(formData.invoiceDate).toISOString(),
        invoiceNumber: formData.invoiceNumber,
        issueCentre: formData.issueCentre,
        subsidyId: showSubsidy ? formData.subsidyId : null,
        subsidyAmount: showSubsidy ? parseFloat(formData.subsidyAmount) : 0,
        referenceType: formData.referenceType,
        notes: formData.remarks,
        supplierId: formData.supplierId,
        paymentMode: formData.paymentMode,
        paidAmount: parseFloat(formData.paidAmount) || 0
      };

      const response = await stockAPI.stockIn(payload);

      if (response.data?.voucher) {
        message.success(`Stock added successfully! Voucher created: ${response.data.voucher.voucherNumber}`);
      } else {
        message.success('Stock added successfully');
      }
      navigate('/inventory/stock-report');
    } catch (error) {
      message.error(error.message || 'Failed to add stock');
    } finally {
      setLoading(false);
    }
  };

  const itemOptions = items.map(item => ({
    label: `${item.itemCode} - ${item.itemName} (Current: ${item.currentBalance} ${item.measurement})`,
    value: item._id
  }));

  const collectionCenterOptions = collectionCenters.map(center => ({
    label: `${center.centerName} (${center.centerType})`,
    value: center._id
  }));

  const subsidyOptions = subsidies.map(subsidy => ({
    label: `${subsidy.subsidyName} - ${subsidy.subsidyType}`,
    value: subsidy._id
  }));

  const supplierOptions = suppliers.map(supplier => ({
    label: `${supplier.supplierId} - ${supplier.name}`,
    value: supplier._id
  }));

  // Calculate total amount
  const totalAmount = productRows.reduce((sum, row) => {
    const quantity = parseFloat(row.quantity) || 0;
    const rate = parseFloat(row.rate) || 0;
    return sum + (quantity * rate);
  }, 0);

  return (
    <div className="stock-form-container">
      <PageHeader
        title="Stock In / Purchase"
        subtitle="Add stock to inventory"
      />

      <div className="stock-card">
        <form onSubmit={handleSubmit} className="stock-form">
          {/* Header Information */}
          <div className="form-section">
            <h3 className="section-title">Purchase Information</h3>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Purchase Date</label>
                <input
                  type="date"
                  className={`form-input ${errors.purchaseDate ? 'error' : ''}`}
                  value={formData.purchaseDate}
                  onChange={(e) => handleInputChange('purchaseDate', e.target.value)}
                />
                {errors.purchaseDate && <div className="form-error">{errors.purchaseDate}</div>}
              </div>

              <div className="form-group">
                <label className="form-label required">Invoice Date</label>
                <input
                  type="date"
                  className={`form-input ${errors.invoiceDate ? 'error' : ''}`}
                  value={formData.invoiceDate}
                  onChange={(e) => handleInputChange('invoiceDate', e.target.value)}
                />
                {errors.invoiceDate && <div className="form-error">{errors.invoiceDate}</div>}
              </div>

              <div className="form-group">
                <label className="form-label required">Invoice Number</label>
                <input
                  type="text"
                  className={`form-input ${errors.invoiceNumber ? 'error' : ''}`}
                  placeholder="Enter invoice number"
                  value={formData.invoiceNumber}
                  onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                />
                {errors.invoiceNumber && <div className="form-error">{errors.invoiceNumber}</div>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Issue Centre</label>
                <SearchableSelect
                  options={collectionCenterOptions}
                  placeholder="Select collection center"
                  value={formData.issueCentre}
                  onChange={(value) => handleInputChange('issueCentre', value)}
                />
                {errors.issueCentre && <div className="form-error">{errors.issueCentre}</div>}
              </div>

              <div className="form-group">
                <label className="form-label required">Reference Type</label>
                <select
                  className="form-select"
                  value={formData.referenceType}
                  onChange={(e) => handleInputChange('referenceType', e.target.value)}
                >
                  <option value="Purchase">Purchase</option>
                  <option value="Opening">Opening Balance</option>
                  <option value="Adjustment">Adjustment</option>
                  <option value="Return">Return</option>
                </select>
              </div>
            </div>

            {/* Subsidy Section */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={showSubsidy}
                  onChange={(e) => {
                    setShowSubsidy(e.target.checked);
                    if (!e.target.checked) {
                      setFormData(prev => ({
                        ...prev,
                        subsidyId: null,
                        subsidyAmount: ''
                      }));
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.subsidyId;
                        delete newErrors.subsidyAmount;
                        return newErrors;
                      });
                    }
                  }}
                />
                <span className="checkbox-text">Include Subsidy</span>
              </label>
            </div>

            {showSubsidy && (
              <div className="form-row subsidy-section">
                <div className="form-group">
                  <label className="form-label required">Subsidy</label>
                  <SearchableSelect
                    options={subsidyOptions}
                    placeholder="Select subsidy"
                    value={formData.subsidyId}
                    onChange={(value) => handleInputChange('subsidyId', value)}
                  />
                  {errors.subsidyId && <div className="form-error">{errors.subsidyId}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label required">Subsidy Amount</label>
                  <div className="input-with-prefix">
                    <span className="input-prefix">₹</span>
                    <input
                      type="number"
                      className={`form-input ${errors.subsidyAmount ? 'error' : ''}`}
                      placeholder="Enter subsidy amount"
                      value={formData.subsidyAmount}
                      onChange={(e) => handleInputChange('subsidyAmount', e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  {errors.subsidyAmount && <div className="form-error">{errors.subsidyAmount}</div>}
                </div>
              </div>
            )}
          </div>

          {/* Supplier & Payment Section */}
          <div className="form-section">
            <h3 className="section-title">Supplier & Payment Details</h3>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Supplier</label>
                <SearchableSelect
                  options={supplierOptions}
                  placeholder="Select supplier (optional)"
                  value={formData.supplierId}
                  onChange={(value) => handleInputChange('supplierId', value)}
                />
                <p className="form-help">Select supplier to enable automatic accounting</p>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select
                  className="form-select"
                  value={formData.paymentMode}
                  onChange={(e) => handleInputChange('paymentMode', e.target.value)}
                >
                  <option value="Adjustment">Credit Purchase (Adjustment)</option>
                  <option value="Cash">Cash Payment</option>
                </select>
              </div>
            </div>

            {formData.paymentMode === 'Cash' && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Paid Amount</label>
                  <div className="input-with-prefix">
                    <span className="input-prefix">₹</span>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Enter paid amount"
                      value={formData.paidAmount}
                      onChange={(e) => handleInputChange('paidAmount', e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <p className="form-help">
                    Total Amount: ₹{totalAmount.toFixed(2)} |
                    Balance: ₹{(totalAmount - (parseFloat(formData.paidAmount) || 0)).toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Products Section */}
          <div className="form-section">
            <div className="section-header">
              <h3 className="section-title">Products</h3>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={addProductRow}
              >
                <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                </svg>
                Add Product
              </button>
            </div>

            {productRows.map((row, index) => (
              <div key={row.id} className="product-row-card">
                <div className="product-row-header">
                  <span className="product-row-number">Product #{index + 1}</span>
                  {productRows.length > 1 && (
                    <button
                      type="button"
                      className="btn-icon btn-danger-icon"
                      onClick={() => removeProductRow(index)}
                      title="Remove product"
                    >
                      <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                      </svg>
                    </button>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label required">Select Item</label>
                  <SearchableSelect
                    options={itemOptions}
                    placeholder="Select an item"
                    value={row.itemId}
                    onChange={(value) => handleProductChange(index, 'itemId', value)}
                  />
                  {errors[`product_${index}_itemId`] && (
                    <div className="form-error">{errors[`product_${index}_itemId`]}</div>
                  )}
                </div>

                {row.selectedItem && (
                  <div className="info-card">
                    <p><strong>Current Balance:</strong> {row.selectedItem.currentBalance} {row.selectedItem.measurement}</p>
                    <p><strong>Sale Price:</strong> ₹{row.selectedItem.salesRate}</p>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label required">Quantity</label>
                    <div className="input-with-suffix">
                      <input
                        type="number"
                        className={`form-input ${errors[`product_${index}_quantity`] ? 'error' : ''}`}
                        placeholder="Enter quantity"
                        value={row.quantity}
                        onChange={(e) => handleProductChange(index, 'quantity', e.target.value)}
                        min="0.01"
                        step="0.01"
                      />
                      <span className="input-suffix">{row.selectedItem?.measurement || 'Unit'}</span>
                    </div>
                    {errors[`product_${index}_quantity`] && (
                      <div className="form-error">{errors[`product_${index}_quantity`]}</div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Free Quantity</label>
                    <div className="input-with-suffix">
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Enter free quantity"
                        value={row.freeQty}
                        onChange={(e) => handleProductChange(index, 'freeQty', e.target.value)}
                        min="0"
                        step="0.01"
                      />
                      <span className="input-suffix">{row.selectedItem?.measurement || 'Unit'}</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label required">Rate per Unit</label>
                    <div className="input-with-prefix">
                      <span className="input-prefix">₹</span>
                      <input
                        type="number"
                        className={`form-input ${errors[`product_${index}_rate`] ? 'error' : ''}`}
                        placeholder="Enter rate"
                        value={row.rate}
                        onChange={(e) => handleProductChange(index, 'rate', e.target.value)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    {errors[`product_${index}_rate`] && (
                      <div className="form-error">{errors[`product_${index}_rate`]}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
