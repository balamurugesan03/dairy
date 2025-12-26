import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import { farmerAPI, paymentAPI, advanceAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import './MilkPaymentForm.css';

const MilkPaymentForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [farmers, setFarmers] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deductions, setDeductions] = useState([]);

  // Form fields
  const [formData, setFormData] = useState({
    farmerId: '',
    milkAmount: '',
    advanceAmount: '',
    paymentMode: 'Cash',
    paidAmount: ''
  });

  // Deduction form fields
  const [deductionForm, setDeductionForm] = useState({
    type: '',
    amount: '',
    description: ''
  });

  const [calculations, setCalculations] = useState({
    milkAmount: 0,
    advanceAmount: 0,
    totalDeduction: 0,
    netPayable: 0
  });

  useEffect(() => {
    searchFarmer('');
  }, []);

  const searchFarmer = async (value) => {
    try {
      let response;
      if (value && value.trim().length > 0) {
        response = await farmerAPI.search(value.trim());
      } else {
        response = await farmerAPI.getAll({ status: 'Active' });
      }
      setFarmers(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to search farmers');
    }
  };

  const handleFarmerSelect = async (e) => {
    const farmerId = e.target.value;
    const farmer = farmers.find(f => f._id === farmerId);
    if (farmer) {
      setSelectedFarmer(farmer);
      setFormData(prev => ({ ...prev, farmerId }));
      // Fetch farmer's advance balance
      try {
        const response = await advanceAPI.getFarmerAdvances(farmerId);
        const activeAdvances = response.data.filter(adv => adv.status === 'Active');
        const totalAdvance = activeAdvances.reduce((sum, adv) => sum + adv.balanceAmount, 0);
        setFormData(prev => ({ ...prev, advanceAmount: totalAdvance }));
      } catch (error) {
        console.error('Failed to fetch advances:', error);
      }
    }
  };

  const handleAddDeduction = () => {
    const { type, amount, description } = deductionForm;

    if (!type || !amount) {
      message.error('Please enter deduction type and amount');
      return;
    }

    const newDeduction = { type, amount: parseFloat(amount), description: description || '' };
    setDeductions([...deductions, newDeduction]);

    setDeductionForm({
      type: '',
      amount: '',
      description: ''
    });
  };

  const handleRemoveDeduction = (index) => {
    setDeductions(deductions.filter((_, i) => i !== index));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDeductionInputChange = (e) => {
    const { name, value } = e.target;
    setDeductionForm(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const milkAmount = parseFloat(formData.milkAmount) || 0;
    const advanceAmount = parseFloat(formData.advanceAmount) || 0;
    const totalDeduction = deductions.reduce((sum, d) => sum + d.amount, 0);
    const netPayable = milkAmount - advanceAmount - totalDeduction;

    setCalculations({
      milkAmount,
      advanceAmount,
      totalDeduction,
      netPayable
    });
  }, [formData.milkAmount, formData.advanceAmount, deductions]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedFarmer) {
      message.error('Please select a farmer');
      return;
    }

    if (!formData.milkAmount) {
      message.error('Please enter milk amount');
      return;
    }

    if (!formData.paymentMode) {
      message.error('Please select payment mode');
      return;
    }

    setLoading(true);
    try {
      const paidAmount = parseFloat(formData.paidAmount) || calculations.netPayable;

      const payload = {
        farmerId: selectedFarmer._id,
        milkAmount: parseFloat(formData.milkAmount),
        advanceAmount: parseFloat(formData.advanceAmount) || 0,
        deductions: deductions,
        totalDeduction: calculations.totalDeduction,
        netPayable: calculations.netPayable,
        paymentMode: formData.paymentMode,
        paidAmount: paidAmount,
        balanceAmount: calculations.netPayable - paidAmount
      };

      await paymentAPI.create(payload);
      message.success('Payment created successfully');
      navigate('/payments/history');
    } catch (error) {
      message.error(error.message || 'Failed to create payment');
    } finally {
      setLoading(false);
    }
  };

  const filteredFarmers = farmers.filter(farmer => {
    const searchLower = searchTerm.toLowerCase();
    return (
      farmer.farmerNumber?.toLowerCase().includes(searchLower) ||
      farmer.personalDetails?.name?.toLowerCase().includes(searchLower) ||
      farmer.personalDetails?.phone?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="milk-payment-container">
      <PageHeader
        title="Milk Payment"
        subtitle="Process farmer milk payment"
      />

      <div className="payment-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="farmerId">Select Farmer *</label>
            <input
              type="text"
              placeholder="Search by farmer number, name, or phone"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                searchFarmer(e.target.value);
              }}
              className="form-control"
            />
            <select
              id="farmerId"
              name="farmerId"
              value={formData.farmerId}
              onChange={handleFarmerSelect}
              required
              className="form-control"
            >
              <option value="">-- Select Farmer --</option>
              {filteredFarmers.map(farmer => (
                <option key={farmer._id} value={farmer._id}>
                  {farmer.farmerNumber} - {farmer.personalDetails?.name} ({farmer.personalDetails?.phone})
                </option>
              ))}
            </select>
          </div>

          {selectedFarmer && (
            <div className="farmer-info-card">
              <p><strong>Farmer:</strong> {selectedFarmer.personalDetails?.name}</p>
              <p><strong>Phone:</strong> {selectedFarmer.personalDetails?.phone}</p>
              <p><strong>Village:</strong> {selectedFarmer.address?.village}</p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="milkAmount">Milk Amount (₹) *</label>
            <input
              type="number"
              id="milkAmount"
              name="milkAmount"
              value={formData.milkAmount}
              onChange={handleInputChange}
              placeholder="Enter milk amount"
              min="0"
              step="0.01"
              required
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="advanceAmount">Advance Amount to Deduct (₹)</label>
            <input
              type="number"
              id="advanceAmount"
              name="advanceAmount"
              value={formData.advanceAmount}
              onChange={handleInputChange}
              placeholder="Enter advance amount"
              min="0"
              step="0.01"
              className="form-control"
            />
          </div>

          <div className="deductions-card">
            <h3>Deductions</h3>
            <div className="deduction-inputs">
              <div className="form-group-inline">
                <label htmlFor="type">Type</label>
                <select
                  id="type"
                  name="type"
                  value={deductionForm.type}
                  onChange={handleDeductionInputChange}
                  className="form-control-sm"
                >
                  <option value="">Select type</option>
                  <option value="Feed">Feed</option>
                  <option value="Medicine">Medicine</option>
                  <option value="Loan">Loan</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group-inline">
                <label htmlFor="amount">Amount (₹)</label>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  value={deductionForm.amount}
                  onChange={handleDeductionInputChange}
                  placeholder="Amount"
                  min="0"
                  step="0.01"
                  className="form-control-sm"
                />
              </div>
              <div className="form-group-inline">
                <label htmlFor="description">Description</label>
                <input
                  type="text"
                  id="description"
                  name="description"
                  value={deductionForm.description}
                  onChange={handleDeductionInputChange}
                  placeholder="Description"
                  className="form-control-sm"
                />
              </div>
              <button type="button" onClick={handleAddDeduction} className="btn-add">
                Add
              </button>
            </div>

            {deductions.length > 0 && (
              <table className="deductions-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Description</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deductions.map((deduction, index) => (
                    <tr key={index}>
                      <td>{deduction.type}</td>
                      <td>₹{deduction.amount.toFixed(2)}</td>
                      <td>{deduction.description}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleRemoveDeduction(index)}
                          className="btn-remove"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="calculations-card">
            <div className="calc-row">
              <strong>Milk Amount:</strong>
              <span>₹{calculations.milkAmount.toFixed(2)}</span>
            </div>
            <div className="calc-row">
              <strong>Advance Deduction:</strong>
              <span>₹{calculations.advanceAmount.toFixed(2)}</span>
            </div>
            <div className="calc-row">
              <strong>Total Deductions:</strong>
              <span>₹{calculations.totalDeduction.toFixed(2)}</span>
            </div>
            <div className="calc-row net-payable">
              <strong>Net Payable:</strong>
              <strong>₹{calculations.netPayable.toFixed(2)}</strong>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="paymentMode">Payment Mode *</label>
            <select
              id="paymentMode"
              name="paymentMode"
              value={formData.paymentMode}
              onChange={handleInputChange}
              required
              className="form-control"
            >
              <option value="Cash">Cash</option>
              <option value="Bank">Bank</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="paidAmount">Paid Amount (₹)</label>
            <input
              type="number"
              id="paidAmount"
              name="paidAmount"
              value={formData.paidAmount}
              onChange={handleInputChange}
              placeholder="Enter paid amount"
              min="0"
              max={calculations.netPayable}
              step="0.01"
              className="form-control"
            />
          </div>

          <div className="form-actions">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Saving...' : 'Save Payment'}
            </button>
            <button type="button" onClick={() => navigate('/payments/history')} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MilkPaymentForm;
