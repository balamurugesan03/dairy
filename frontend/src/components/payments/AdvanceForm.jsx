import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import { farmerAPI, advanceAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import SearchableSelect from '../common/SearchableSelect';
import './AdvanceForm.css';

const ADVANCE_TYPES = [
  { value: 'Regular', label: 'Regular Advance' },
  { value: 'Emergency', label: 'Emergency Advance' },
  { value: 'Festival', label: 'Festival Advance' },
  { value: 'Medical', label: 'Medical Advance' },
  { value: 'Agriculture', label: 'Agriculture Advance' },
  { value: 'Cattle Purchase', label: 'Cattle Purchase' },
  { value: 'Feed', label: 'Feed Advance' },
  { value: 'Other', label: 'Other' }
];

const PAYMENT_MODES = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Bank', label: 'Bank Transfer' },
  { value: 'UPI', label: 'UPI' },
  { value: 'Cheque', label: 'Cheque' }
];

const REPAYMENT_TYPES = [
  { value: 'Lump Sum', label: 'Lump Sum' },
  { value: 'Monthly Deduction', label: 'Monthly Deduction' },
  { value: 'Per Payment Deduction', label: 'Per Payment Deduction' },
  { value: 'Custom', label: 'Custom' }
];

const AdvanceForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [farmers, setFarmers] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [farmerOutstanding, setFarmerOutstanding] = useState({ totalOutstanding: 0, count: 0 });
  const [formData, setFormData] = useState({
    farmerId: '',
    advanceDate: new Date().toISOString().split('T')[0],
    advanceType: 'Regular',
    advanceAmount: '',
    paymentMode: 'Cash',
    bankDetails: {
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      transactionId: '',
      upiId: '',
      chequeNumber: '',
      chequeDate: ''
    },
    interestRate: 0,
    repaymentType: 'Per Payment Deduction',
    monthlyDeductionAmount: '',
    deductionPercentage: '',
    expectedRepaymentDate: '',
    purpose: '',
    remarks: '',
    guarantorName: '',
    guarantorPhone: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    searchFarmer('');
  }, []);

  // Fetch farmer outstanding when farmer is selected
  useEffect(() => {
    if (formData.farmerId) {
      fetchFarmerOutstanding(formData.farmerId);
      const farmer = farmers.find(f => f._id === formData.farmerId);
      setSelectedFarmer(farmer);
    } else {
      setFarmerOutstanding({ totalOutstanding: 0, count: 0 });
      setSelectedFarmer(null);
    }
  }, [formData.farmerId, farmers]);

  const fetchFarmerOutstanding = async (farmerId) => {
    try {
      const response = await advanceAPI.getFarmerAdvances(farmerId);
      setFarmerOutstanding(response.outstanding || { totalOutstanding: 0, count: 0 });
    } catch (error) {
      console.error('Error fetching outstanding:', error);
    }
  };

  const searchFarmer = async (value) => {
    try {
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

    // Validate bank details based on payment mode
    if (formData.paymentMode === 'Bank') {
      if (!formData.bankDetails.bankName) newErrors.bankName = 'Bank name is required';
      if (!formData.bankDetails.accountNumber) newErrors.accountNumber = 'Account number is required';
    }
    if (formData.paymentMode === 'UPI' && !formData.bankDetails.upiId) {
      newErrors.upiId = 'UPI ID is required';
    }
    if (formData.paymentMode === 'Cheque') {
      if (!formData.bankDetails.chequeNumber) newErrors.chequeNumber = 'Cheque number is required';
      if (!formData.bankDetails.chequeDate) newErrors.chequeDate = 'Cheque date is required';
    }

    // Validate repayment settings
    if (formData.repaymentType === 'Monthly Deduction' && !formData.monthlyDeductionAmount) {
      newErrors.monthlyDeductionAmount = 'Monthly deduction amount is required';
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
        advanceType: formData.advanceType,
        advanceAmount: parseFloat(formData.advanceAmount),
        paymentMode: formData.paymentMode,
        bankDetails: formData.paymentMode !== 'Cash' ? formData.bankDetails : undefined,
        interestRate: parseFloat(formData.interestRate) || 0,
        repaymentType: formData.repaymentType,
        monthlyDeductionAmount: formData.monthlyDeductionAmount ? parseFloat(formData.monthlyDeductionAmount) : 0,
        deductionPercentage: formData.deductionPercentage ? parseFloat(formData.deductionPercentage) : 0,
        expectedRepaymentDate: formData.expectedRepaymentDate || undefined,
        purpose: formData.purpose,
        remarks: formData.remarks,
        guarantorName: formData.guarantorName,
        guarantorPhone: formData.guarantorPhone
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

  const farmerOptions = farmers.map(farmer => ({
    label: `${farmer.farmerNumber} - ${farmer.personalDetails?.name}`,
    value: farmer._id
  }));

  const calculateInterest = () => {
    if (formData.advanceAmount && formData.interestRate) {
      return (parseFloat(formData.advanceAmount) * parseFloat(formData.interestRate) / 100).toFixed(2);
    }
    return '0.00';
  };

  const calculateTotalDue = () => {
    const amount = parseFloat(formData.advanceAmount) || 0;
    const interest = parseFloat(calculateInterest()) || 0;
    return (amount + interest).toFixed(2);
  };

  return (
    <div className="advance-form-container">
      <PageHeader
        title="Create Advance"
        subtitle="Issue advance payment to farmer"
      />

      <div className="advance-form-card">
        <form onSubmit={handleSubmit}>
          {/* Farmer Selection Section */}
          <div className="form-section">
            <h3 className="section-title">Farmer Details</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Select Farmer <span className="required">*</span></label>
                <SearchableSelect
                  options={farmerOptions}
                  placeholder="Search farmer by number or name"
                  onSearch={searchFarmer}
                  value={formData.farmerId}
                  onChange={(value) => handleChange('farmerId', value)}
                />
                {errors.farmerId && <div className="error-text">{errors.farmerId}</div>}
              </div>
            </div>

            {/* Farmer Info Card */}
            {selectedFarmer && (
              <div className="farmer-info-card">
                <div className="info-row">
                  <span className="info-label">Farmer Number:</span>
                  <span className="info-value">{selectedFarmer.farmerNumber}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Name:</span>
                  <span className="info-value">{selectedFarmer.personalDetails?.name}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Phone:</span>
                  <span className="info-value">{selectedFarmer.contactDetails?.mobile || 'N/A'}</span>
                </div>
                <div className="info-row highlight">
                  <span className="info-label">Outstanding Advances:</span>
                  <span className="info-value outstanding">
                    ₹{farmerOutstanding.totalOutstanding?.toFixed(2) || '0.00'} ({farmerOutstanding.count || 0} active)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Advance Details Section */}
          <div className="form-section">
            <h3 className="section-title">Advance Details</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Advance Date <span className="required">*</span></label>
                <input
                  type="date"
                  value={formData.advanceDate}
                  onChange={(e) => handleChange('advanceDate', e.target.value)}
                  className="form-input"
                />
                {errors.advanceDate && <div className="error-text">{errors.advanceDate}</div>}
              </div>

              <div className="form-group">
                <label>Advance Type <span className="required">*</span></label>
                <select
                  value={formData.advanceType}
                  onChange={(e) => handleChange('advanceType', e.target.value)}
                  className="form-input"
                >
                  {ADVANCE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Advance Amount <span className="required">*</span></label>
                <div className="input-with-prefix">
                  <span className="prefix">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.advanceAmount}
                    onChange={(e) => handleChange('advanceAmount', e.target.value)}
                    placeholder="Enter amount"
                    className="form-input with-prefix"
                  />
                </div>
                {errors.advanceAmount && <div className="error-text">{errors.advanceAmount}</div>}
              </div>

              <div className="form-group">
                <label>Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.interestRate}
                  onChange={(e) => handleChange('interestRate', e.target.value)}
                  placeholder="0"
                  className="form-input"
                />
              </div>
            </div>

            {/* Amount Summary */}
            {formData.advanceAmount && (
              <div className="amount-summary">
                <div className="summary-row">
                  <span>Principal Amount:</span>
                  <span>₹{parseFloat(formData.advanceAmount).toFixed(2)}</span>
                </div>
                {formData.interestRate > 0 && (
                  <div className="summary-row">
                    <span>Interest ({formData.interestRate}%):</span>
                    <span>₹{calculateInterest()}</span>
                  </div>
                )}
                <div className="summary-row total">
                  <span>Total Due:</span>
                  <span>₹{calculateTotalDue()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Payment Mode Section */}
          <div className="form-section">
            <h3 className="section-title">Payment Details</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Payment Mode <span className="required">*</span></label>
                <select
                  value={formData.paymentMode}
                  onChange={(e) => handleChange('paymentMode', e.target.value)}
                  className="form-input"
                >
                  {PAYMENT_MODES.map(mode => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
              </div>

              {formData.paymentMode === 'Bank' && (
                <>
                  <div className="form-group">
                    <label>Bank Name <span className="required">*</span></label>
                    <input
                      type="text"
                      value={formData.bankDetails.bankName}
                      onChange={(e) => handleChange('bankDetails.bankName', e.target.value)}
                      placeholder="Enter bank name"
                      className="form-input"
                    />
                    {errors.bankName && <div className="error-text">{errors.bankName}</div>}
                  </div>
                  <div className="form-group">
                    <label>Account Number <span className="required">*</span></label>
                    <input
                      type="text"
                      value={formData.bankDetails.accountNumber}
                      onChange={(e) => handleChange('bankDetails.accountNumber', e.target.value)}
                      placeholder="Enter account number"
                      className="form-input"
                    />
                    {errors.accountNumber && <div className="error-text">{errors.accountNumber}</div>}
                  </div>
                  <div className="form-group">
                    <label>IFSC Code</label>
                    <input
                      type="text"
                      value={formData.bankDetails.ifscCode}
                      onChange={(e) => handleChange('bankDetails.ifscCode', e.target.value)}
                      placeholder="Enter IFSC code"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Transaction ID</label>
                    <input
                      type="text"
                      value={formData.bankDetails.transactionId}
                      onChange={(e) => handleChange('bankDetails.transactionId', e.target.value)}
                      placeholder="Enter transaction ID"
                      className="form-input"
                    />
                  </div>
                </>
              )}

              {formData.paymentMode === 'UPI' && (
                <>
                  <div className="form-group">
                    <label>UPI ID <span className="required">*</span></label>
                    <input
                      type="text"
                      value={formData.bankDetails.upiId}
                      onChange={(e) => handleChange('bankDetails.upiId', e.target.value)}
                      placeholder="Enter UPI ID"
                      className="form-input"
                    />
                    {errors.upiId && <div className="error-text">{errors.upiId}</div>}
                  </div>
                  <div className="form-group">
                    <label>Transaction ID</label>
                    <input
                      type="text"
                      value={formData.bankDetails.transactionId}
                      onChange={(e) => handleChange('bankDetails.transactionId', e.target.value)}
                      placeholder="Enter transaction ID"
                      className="form-input"
                    />
                  </div>
                </>
              )}

              {formData.paymentMode === 'Cheque' && (
                <>
                  <div className="form-group">
                    <label>Cheque Number <span className="required">*</span></label>
                    <input
                      type="text"
                      value={formData.bankDetails.chequeNumber}
                      onChange={(e) => handleChange('bankDetails.chequeNumber', e.target.value)}
                      placeholder="Enter cheque number"
                      className="form-input"
                    />
                    {errors.chequeNumber && <div className="error-text">{errors.chequeNumber}</div>}
                  </div>
                  <div className="form-group">
                    <label>Cheque Date <span className="required">*</span></label>
                    <input
                      type="date"
                      value={formData.bankDetails.chequeDate}
                      onChange={(e) => handleChange('bankDetails.chequeDate', e.target.value)}
                      className="form-input"
                    />
                    {errors.chequeDate && <div className="error-text">{errors.chequeDate}</div>}
                  </div>
                  <div className="form-group">
                    <label>Bank Name</label>
                    <input
                      type="text"
                      value={formData.bankDetails.bankName}
                      onChange={(e) => handleChange('bankDetails.bankName', e.target.value)}
                      placeholder="Enter bank name"
                      className="form-input"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Repayment Settings Section */}
          <div className="form-section">
            <h3 className="section-title">Repayment Settings</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Repayment Type</label>
                <select
                  value={formData.repaymentType}
                  onChange={(e) => handleChange('repaymentType', e.target.value)}
                  className="form-input"
                >
                  {REPAYMENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {formData.repaymentType === 'Monthly Deduction' && (
                <div className="form-group">
                  <label>Monthly Deduction Amount <span className="required">*</span></label>
                  <div className="input-with-prefix">
                    <span className="prefix">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.monthlyDeductionAmount}
                      onChange={(e) => handleChange('monthlyDeductionAmount', e.target.value)}
                      placeholder="Enter monthly amount"
                      className="form-input with-prefix"
                    />
                  </div>
                  {errors.monthlyDeductionAmount && <div className="error-text">{errors.monthlyDeductionAmount}</div>}
                </div>
              )}

              {formData.repaymentType === 'Per Payment Deduction' && (
                <div className="form-group">
                  <label>Deduction Percentage (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.deductionPercentage}
                    onChange={(e) => handleChange('deductionPercentage', e.target.value)}
                    placeholder="Enter percentage"
                    className="form-input"
                  />
                </div>
              )}

              <div className="form-group">
                <label>Expected Repayment Date</label>
                <input
                  type="date"
                  value={formData.expectedRepaymentDate}
                  onChange={(e) => handleChange('expectedRepaymentDate', e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
          </div>

          {/* Additional Info Section */}
          <div className="form-section">
            <h3 className="section-title">Additional Information</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Purpose</label>
                <textarea
                  value={formData.purpose}
                  onChange={(e) => handleChange('purpose', e.target.value)}
                  placeholder="Enter purpose of advance"
                  className="form-input textarea"
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label>Guarantor Name</label>
                <input
                  type="text"
                  value={formData.guarantorName}
                  onChange={(e) => handleChange('guarantorName', e.target.value)}
                  placeholder="Enter guarantor name"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Guarantor Phone</label>
                <input
                  type="text"
                  value={formData.guarantorPhone}
                  onChange={(e) => handleChange('guarantorPhone', e.target.value)}
                  placeholder="Enter guarantor phone"
                  className="form-input"
                />
              </div>

              <div className="form-group full-width">
                <label>Remarks</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  placeholder="Enter any remarks"
                  className="form-input textarea"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="form-actions">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Saving...' : 'Create Advance'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/payments/advances')}
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

export default AdvanceForm;
