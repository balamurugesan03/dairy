import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import dayjs from 'dayjs';
import { farmerAPI, itemAPI, salesAPI, customerAPI, collectionCenterAPI, subsidyAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import SearchableSelect from '../common/SearchableSelect';
import { message as toast } from '../../utils/toast';
import './BillingForm.css';

const BillingForm = () => {
  const navigate = useNavigate();
  const printRef = useRef();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [collectionCenters, setCollectionCenters] = useState([]);
  const [subsidies, setSubsidies] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedFarmerNumber, setSelectedFarmerNumber] = useState('');
  const [billItems, setBillItems] = useState([]);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    customerType: 'Other',
    customerId: null,
    customerName: '',
    customerPhone: '',
    itemId: null,
    quantity: '',
    collectionCenterId: null,
    subsidyId: null,
    paymentMode: 'Cash',
    paidAmount: ''
  });

  const [calculations, setCalculations] = useState({
    subtotal: 0,
    totalGst: 0,
    grandTotal: 0,
    oldBalance: 0,
    totalDue: 0
  });
  const [showBalanceAlert, setShowBalanceAlert] = useState(false);

  useEffect(() => {
    fetchItems();
    fetchFarmers();
    fetchCustomers();
    fetchCollectionCenters();
    fetchSubsidies();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await itemAPI.getAll();
      setItems(response.data.filter(item => item.status === 'Active'));
    } catch (error) {
      toast.error(error.message || 'Failed to fetch items');
    }
  };

  const fetchFarmers = async () => {
    try {
      const response = await farmerAPI.getAll();
      setFarmers(response.data.filter(farmer => farmer.status === 'Active'));
    } catch (error) {
      toast.error(error.message || 'Failed to fetch farmers');
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await customerAPI.getAll();
      setCustomers(response.data.filter(customer => customer.active === true));
    } catch (error) {
      toast.error(error.message || 'Failed to fetch customers');
    }
  };

  const fetchCollectionCenters = async () => {
    try {
      const response = await collectionCenterAPI.getAll();
      setCollectionCenters(response.data.filter(center => center.status === 'Active'));
    } catch (error) {
      toast.error(error.message || 'Failed to fetch collection centers');
    }
  };

  const fetchSubsidies = async () => {
    try {
      const response = await subsidyAPI.getAll();
      setSubsidies(response.data.filter(subsidy => subsidy.status === 'Active'));
    } catch (error) {
      toast.error(error.message || 'Failed to fetch subsidies');
    }
  };

  const fetchPreviousBalance = async (customerId) => {
    try {
      const response = await salesAPI.getCustomerHistory(customerId);
      const sales = response.data || [];
      // Calculate total outstanding balance from previous bills
      const totalOutstanding = sales.reduce((sum, sale) => sum + (sale.balanceAmount || 0), 0);
      return totalOutstanding;
    } catch (error) {
      console.error('Error fetching previous balance:', error);
      return 0;
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

  const handleCustomerTypeChange = (e) => {
    const type = e.target.value;
    handleInputChange('customerType', type);
    setFormData(prev => ({
      ...prev,
      customerId: null,
      customerName: '',
      customerPhone: ''
    }));
    setSelectedCustomer(null);
    setSelectedFarmerNumber('');
    setCalculations(prev => ({ ...prev, oldBalance: 0 }));
    setShowBalanceAlert(false);
  };

  const handleCustomerSelect = async (e) => {
    const farmerId = e.target.value;
    if (!farmerId) {
      setSelectedCustomer(null);
      setSelectedFarmerNumber('');
      setFormData(prev => ({
        ...prev,
        customerId: null,
        customerName: '',
        customerPhone: ''
      }));
      setCalculations(prev => ({ ...prev, oldBalance: 0 }));
      setShowBalanceAlert(false);
      return;
    }

    const farmer = farmers.find(f => f._id === farmerId);
    if (farmer) {
      setSelectedCustomer(farmer);
      setSelectedFarmerNumber(farmer.farmerNumber || '');
      setFormData(prev => ({
        ...prev,
        customerId: farmerId,
        customerName: farmer.personalDetails?.name || '',
        customerPhone: farmer.personalDetails?.phone || ''
      }));

      // Fetch previous balance from sales history
      const previousBalance = await fetchPreviousBalance(farmerId);
      setCalculations(prev => ({ ...prev, oldBalance: previousBalance }));
      setShowBalanceAlert(previousBalance > 0);
    }
  };

  const handleCustomerSelectForCustomer = async (e) => {
    const customerId = e.target.value;
    if (!customerId) {
      setSelectedCustomer(null);
      setFormData(prev => ({
        ...prev,
        customerId: null,
        customerName: '',
        customerPhone: ''
      }));
      setCalculations(prev => ({ ...prev, oldBalance: 0 }));
      setShowBalanceAlert(false);
      return;
    }

    const customer = customers.find(c => c._id === customerId);
    if (customer) {
      setSelectedCustomer(customer);
      setFormData(prev => ({
        ...prev,
        customerId: customerId,
        customerName: customer.name || '',
        customerPhone: customer.phone || ''
      }));

      // Fetch previous balance from sales history
      const previousBalance = await fetchPreviousBalance(customerId);
      const totalOldBalance = (customer.openingBalance || 0) + previousBalance;

      setCalculations(prev => ({ ...prev, oldBalance: totalOldBalance }));
      setShowBalanceAlert(totalOldBalance > 0);
    }
  };

  const handleAddItem = () => {
    if (!formData.itemId || !formData.quantity) {
      toast.error('Please select item and enter quantity');
      return;
    }

    const item = items.find(i => i._id === formData.itemId);
    if (!item) return;

    if (parseFloat(formData.quantity) > item.currentBalance) {
      toast.error(`Insufficient stock! Available: ${item.currentBalance} ${item.unit}`);
      return;
    }

    const quantity = parseFloat(formData.quantity);
    const rate = item.salesRate;
    const amount = quantity * rate;
    const gstAmount = (amount * (item.gstPercent || 0)) / 100;

    const newItem = {
      itemId: item._id,
      itemName: item.itemName,
      itemCode: item.itemCode,
      unit: item.unit,
      quantity,
      rate,
      amount,
      gstPercent: item.gstPercent || 0,
      gstAmount
    };

    const updatedItems = [...billItems, newItem];
    setBillItems(updatedItems);
    calculateTotals(updatedItems);

    setFormData(prev => ({ ...prev, itemId: null, quantity: '' }));
  };

  const handleRemoveItem = (index) => {
    const updatedItems = billItems.filter((_, i) => i !== index);
    setBillItems(updatedItems);
    calculateTotals(updatedItems);
  };

  const calculateTotals = (items) => {
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const totalGst = items.reduce((sum, item) => sum + item.gstAmount, 0);
    const grandTotal = subtotal + totalGst;
    const totalDue = grandTotal + calculations.oldBalance;

    setCalculations(prev => ({
      ...prev,
      subtotal,
      totalGst,
      grandTotal,
      totalDue
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (formData.customerType === 'Farmer') {
      if (!formData.customerId) {
        newErrors.customerId = 'Please select a farmer';
      }
    } else if (formData.customerType === 'Customer') {
      if (!formData.customerId) {
        newErrors.customerId = 'Please select a customer';
      }
    } else {
      if (!formData.customerName) {
        newErrors.customerName = 'Please enter customer name';
      }
      if (!formData.customerPhone) {
        newErrors.customerPhone = 'Please enter phone number';
      } else if (!/^[0-9]{10}$/.test(formData.customerPhone)) {
        newErrors.customerPhone = 'Please enter valid 10-digit phone number';
      }
    }

    if (!formData.paymentMode) {
      newErrors.paymentMode = 'Please select payment mode';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (billItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    if (!validateForm()) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        billDate: new Date().toISOString(),
        customerType: formData.customerType,
        customerId: (formData.customerType === 'Farmer' || formData.customerType === 'Customer') ? formData.customerId : null,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        items: billItems,
        subtotal: calculations.subtotal,
        totalGst: calculations.totalGst,
        grandTotal: calculations.grandTotal,
        oldBalance: calculations.oldBalance,
        totalDue: calculations.totalDue,
        collectionCenterId: formData.collectionCenterId || null,
        subsidyId: formData.subsidyId || null,
        paymentMode: formData.paymentMode,
        paidAmount: parseFloat(formData.paidAmount) || 0,
        balanceAmount: calculations.totalDue - (parseFloat(formData.paidAmount) || 0)
      };

      const response = await salesAPI.create(payload);
      toast.success('Bill created successfully');

      if (window.confirm('Do you want to print the bill?')) {
        handlePrint();
      }

      navigate('/sales');
    } catch (error) {
      toast.error(error.message || 'Failed to create bill');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
  });

  const itemOptions = items.map(item => ({
    label: `${item.itemCode} - ${item.itemName} (Stock: ${item.currentBalance} ${item.unit})`,
    value: item._id
  }));

  return (
    <div className="billing-form-container">
      <PageHeader
        title="Create Bill"
        subtitle="Generate sales bill"
      />

      <div className="billing-card">
        <form onSubmit={handleSubmit} className="billing-form">
          {/* Customer Information */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label required">Customer Type</label>
              <select
                className="form-select"
                value={formData.customerType}
                onChange={handleCustomerTypeChange}
              >
                <option value="Farmer">Farmer</option>
                <option value="Customer">Customer</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {formData.customerType === 'Farmer' ? (
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label required">Select Farmer</label>
                <select
                  className={`form-select ${errors.customerId ? 'error' : ''}`}
                  value={formData.customerId || ''}
                  onChange={handleCustomerSelect}
                >
                  <option value="">-- Select Farmer --</option>
                  {farmers.map(farmer => (
                    <option key={farmer._id} value={farmer._id}>
                      {farmer.farmerNumber} - {farmer.personalDetails?.name || 'N/A'}
                      {farmer.memberId ? ` | Member ID: ${farmer.memberId}` : ''}
                    </option>
                  ))}
                </select>
                {errors.customerId && <div className="form-error">{errors.customerId}</div>}
              </div>
            ) : formData.customerType === 'Customer' ? (
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label required">Select Customer</label>
                <select
                  className={`form-select ${errors.customerId ? 'error' : ''}`}
                  value={formData.customerId || ''}
                  onChange={handleCustomerSelectForCustomer}
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map(customer => (
                    <option key={customer._id} value={customer._id}>
                      {customer.customerId} - {customer.name}
                      {customer.phone ? ` | ${customer.phone}` : ''}
                    </option>
                  ))}
                </select>
                {errors.customerId && <div className="form-error">{errors.customerId}</div>}
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label required">Customer Name</label>
                  <input
                    type="text"
                    className={`form-input ${errors.customerName ? 'error' : ''}`}
                    placeholder="Enter customer name"
                    value={formData.customerName}
                    onChange={(e) => handleInputChange('customerName', e.target.value)}
                  />
                  {errors.customerName && <div className="form-error">{errors.customerName}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label required">Phone</label>
                  <input
                    type="text"
                    className={`form-input ${errors.customerPhone ? 'error' : ''}`}
                    placeholder="Enter phone number"
                    value={formData.customerPhone}
                    onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                    maxLength={10}
                  />
                  {errors.customerPhone && <div className="form-error">{errors.customerPhone}</div>}
                </div>
              </>
            )}
          </div>

          {selectedCustomer && formData.customerType === 'Farmer' && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Farmer Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={selectedFarmerNumber}
                  disabled
                />
              </div>
              <div className="form-group">
                <label className="form-label">Farmer Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.customerName}
                  disabled
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.customerPhone}
                  disabled
                />
              </div>
            </div>
          )}

          {selectedCustomer && formData.customerType === 'Customer' && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Customer ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={selectedCustomer.customerId || ''}
                  disabled
                />
              </div>
              <div className="form-group">
                <label className="form-label">Customer Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.customerName}
                  disabled
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.customerPhone}
                  disabled
                />
              </div>
              {selectedCustomer.email && (
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="text"
                    className="form-input"
                    value={selectedCustomer.email}
                    disabled
                  />
                </div>
              )}
              {selectedCustomer.address && (
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Address</label>
                  <input
                    type="text"
                    className="form-input"
                    value={selectedCustomer.address}
                    disabled
                  />
                </div>
              )}
            </div>
          )}

          {/* Previous Balance Alert */}
          {showBalanceAlert && calculations.oldBalance > 0 && (
            <div style={{
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <svg
                style={{ width: '24px', height: '24px', color: '#856404', flexShrink: 0 }}
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
              </svg>
              <div style={{ flex: 1 }}>
                <strong style={{ color: '#856404', fontSize: '14px' }}>Previous Balance Outstanding</strong>
                <p style={{ margin: '4px 0 0 0', color: '#856404', fontSize: '14px' }}>
                  This {formData.customerType.toLowerCase()} has a previous outstanding balance of{' '}
                  <strong style={{ fontSize: '16px' }}>₹{calculations.oldBalance.toFixed(2)}</strong>
                  {' '}which will be added to the total due amount.
                </p>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="divider">
            <span className="divider-text">Add Items</span>
          </div>

          {/* Add Items Section */}
          <div className="form-row">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Select Item</label>
              <SearchableSelect
                options={itemOptions}
                placeholder="Select an item"
                value={formData.itemId}
                onChange={(value) => handleInputChange('itemId', value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input
                type="number"
                className="form-input"
                placeholder="Enter quantity"
                value={formData.quantity}
                onChange={(e) => handleInputChange('quantity', e.target.value)}
                min="0.01"
                step="0.01"
              />
            </div>
            <div className="form-group">
              <label className="form-label">&nbsp;</label>
              <button
                type="button"
                className="btn btn-dashed w-full"
                onClick={handleAddItem}
              >
                <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                </svg>
                Add
              </button>
            </div>
          </div>

          {/* Items Table */}
          <table className="billing-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Quantity</th>
                <th>Rate</th>
                <th>Amount</th>
                <th>GST</th>
                <th>Total</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {billItems.length === 0 ? (
                <tr>
                  <td colSpan="8" className="table-empty">
                    No items added yet
                  </td>
                </tr>
              ) : (
                billItems.map((item, index) => (
                  <tr key={`${item.itemId}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{item.itemName}</td>
                    <td>{item.quantity} {item.unit}</td>
                    <td>₹{item.rate?.toFixed(2)}</td>
                    <td>₹{item.amount?.toFixed(2)}</td>
                    <td>{item.gstPercent}% (₹{item.gstAmount?.toFixed(2)})</td>
                    <td>₹{(item.amount + item.gstAmount)?.toFixed(2)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <svg className="icon" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                          <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Summary Section */}
          <div className="summary-card">
            <div className="summary-row">
              <span className="summary-label">Subtotal:</span>
              <span className="summary-value">₹{calculations.subtotal.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Total GST:</span>
              <span className="summary-value">₹{calculations.totalGst.toFixed(2)}</span>
            </div>
            <div className="summary-row total">
              <span className="summary-label">Grand Total:</span>
              <span className="summary-value">₹{calculations.grandTotal.toFixed(2)}</span>
            </div>
            {calculations.oldBalance > 0 && (
              <>
                <div className="summary-row">
                  <span className="summary-label">Old Balance:</span>
                  <span className="summary-value">₹{calculations.oldBalance.toFixed(2)}</span>
                </div>
                <div className="summary-row total">
                  <span className="summary-label">Total Due:</span>
                  <span className="summary-value">₹{calculations.totalDue.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          {/* Divider */}
          <div className="divider">
            <span className="divider-text">Payment Details</span>
          </div>

          {/* Payment Section */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Collection Center</label>
              <select
                className="form-select"
                value={formData.collectionCenterId || ''}
                onChange={(e) => handleInputChange('collectionCenterId', e.target.value)}
              >
                <option value="">-- Select Collection Center --</option>
                {collectionCenters.map(center => (
                  <option key={center._id} value={center._id}>
                    {center.centerName} ({center.centerType})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Subsidy</label>
              <select
                className="form-select"
                value={formData.subsidyId || ''}
                onChange={(e) => handleInputChange('subsidyId', e.target.value)}
              >
                <option value="">-- Select Subsidy --</option>
                {subsidies.map(subsidy => (
                  <option key={subsidy._id} value={subsidy._id}>
                    {subsidy.subsidyName} ({subsidy.subsidyType})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label required">Payment Mode</label>
              <select
                className="form-select"
                value={formData.paymentMode}
                onChange={(e) => handleInputChange('paymentMode', e.target.value)}
              >
                <option value="Cash">Cash</option>
                <option value="Credit">Credit</option>
                <option value="Bank">Bank</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Paid Amount (₹)</label>
              <input
                type="number"
                className="form-input"
                placeholder="Enter paid amount"
                value={formData.paidAmount}
                onChange={(e) => handleInputChange('paidAmount', e.target.value)}
                min="0"
                max={calculations.totalDue}
              />
            </div>
          </div>

          {/* Form Actions */}
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
                  Save Bill
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-default"
              onClick={() => navigate('/sales')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Hidden Print Section */}
      <div style={{ display: 'none' }}>
        <div ref={printRef} style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Dairy Cooperative</h2>
          <hr />
          <p><strong>Bill Date:</strong> {dayjs().format('DD-MM-YYYY HH:mm')}</p>
          <p><strong>Customer:</strong> {formData.customerName}</p>
          <p><strong>Phone:</strong> {formData.customerPhone}</p>
          <hr />
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>#</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Item</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Quantity</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Rate</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Amount</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>GST</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {billItems.map((item, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{index + 1}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.itemName}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.quantity} {item.unit}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>₹{item.rate?.toFixed(2)}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>₹{item.amount?.toFixed(2)}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.gstPercent}% (₹{item.gstAmount?.toFixed(2)})</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>₹{(item.amount + item.gstAmount)?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr style={{ marginTop: '20px' }} />
          <div style={{ marginTop: '20px', fontSize: '16px' }}>
            <p><strong>Subtotal:</strong> ₹{calculations.subtotal.toFixed(2)}</p>
            <p><strong>Total GST:</strong> ₹{calculations.totalGst.toFixed(2)}</p>
            <p style={{ fontSize: '18px' }}><strong>Grand Total:</strong> ₹{calculations.grandTotal.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingForm;
