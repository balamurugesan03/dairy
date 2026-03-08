import Leave from '../models/Leave.js';
import Employee from '../models/Employee.js';

// Apply for leave
export const applyLeave = async (req, res) => {
  try {
    const { employeeId, fromDate, toDate, reason, leaveType } = req.body;

    const leave = new Leave({
      companyId: req.companyId,
      employeeId,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      reason,
      leaveType
    });
    await leave.save();
    await leave.populate('employeeId', 'name department role');
    res.status(201).json({ success: true, data: leave });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all leaves
export const getAllLeaves = async (req, res) => {
  try {
    const { startDate, endDate, employee, status, leaveType } = req.query;
    const query = { companyId: req.companyId };

    if (employee) query.employeeId = employee;
    if (status) query.status = status;
    if (leaveType) query.leaveType = leaveType;

    if (startDate || endDate) {
      query.fromDate = {};
      if (startDate) query.fromDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.fromDate.$lte = end;
      }
    }

    const leaves = await Leave.find(query)
      .populate('employeeId', 'name department role')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: leaves });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get leave by ID
export const getLeaveById = async (req, res) => {
  try {
    const leave = await Leave.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('employeeId', 'name department role');
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });
    res.json({ success: true, data: leave });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Approve leave
export const approveLeave = async (req, res) => {
  try {
    const leave = await Leave.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId, status: 'Pending' },
      { status: 'Approved' },
      { new: true }
    ).populate('employeeId', 'name department role');
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found or already processed' });
    res.json({ success: true, data: leave });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Reject leave
export const rejectLeave = async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const leave = await Leave.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId, status: 'Pending' },
      { status: 'Rejected', rejectionReason },
      { new: true }
    ).populate('employeeId', 'name department role');
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found or already processed' });
    res.json({ success: true, data: leave });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete leave
export const deleteLeave = async (req, res) => {
  try {
    const leave = await Leave.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });
    res.json({ success: true, message: 'Leave deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get leave summary for employee
export const getLeaveSummary = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const leaves = await Leave.find({ companyId: req.companyId, employeeId });
    const approved = leaves.filter(l => l.status === 'Approved').length;
    const pending = leaves.filter(l => l.status === 'Pending').length;
    const rejected = leaves.filter(l => l.status === 'Rejected').length;
    res.json({ success: true, data: { total: leaves.length, approved, pending, rejected } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
