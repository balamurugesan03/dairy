import Loan from '../models/Loan.js';

// Add loan
export const addLoan = async (req, res) => {
  try {
    const { employeeId, totalAmount, purpose } = req.body;
    const loan = new Loan({
      companyId: req.companyId,
      employeeId,
      totalAmount,
      paidAmount: 0,
      purpose
    });
    await loan.save();
    await loan.populate('employeeId', 'name department role');
    res.status(201).json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all loans
export const getAllLoans = async (req, res) => {
  try {
    const { employeeId, status } = req.query;
    const query = { companyId: req.companyId };
    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;

    const loans = await Loan.find(query)
      .populate('employeeId', 'name department role')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: loans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get loan by ID
export const getLoanById = async (req, res) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('employeeId', 'name department role');
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update loan
export const updateLoan = async (req, res) => {
  try {
    const { totalAmount, purpose } = req.body;
    const loan = await Loan.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { totalAmount, purpose },
      { new: true, runValidators: true }
    ).populate('employeeId', 'name department role');
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete loan
export const deleteLoan = async (req, res) => {
  try {
    const loan = await Loan.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    res.json({ success: true, message: 'Loan deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Make a payment / deduct from loan
export const makePayment = async (req, res) => {
  try {
    const { amount } = req.body;
    const loan = await Loan.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.status === 'Closed') return res.status(400).json({ success: false, message: 'Loan already closed' });

    loan.paidAmount = (loan.paidAmount || 0) + parseFloat(amount);
    await loan.save(); // pre-save hook recalculates remainingAmount and status
    await loan.populate('employeeId', 'name department role');
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
