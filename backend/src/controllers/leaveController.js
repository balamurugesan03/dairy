import Leave from '../models/Leave.js';
import Employee from '../models/Employee.js';

// Apply for leave
export const applyLeave = async (req, res) => {
  try {
    const { employee, leaveType, startDate, endDate } = req.body;

    // Check if employee exists
    const emp = await Employee.findById(employee);
    if (!emp) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Create leave application
    const leave = new Leave(req.body);

    // Check for overlapping leaves
    const hasOverlap = await leave.hasOverlap();
    if (hasOverlap) {
      return res.status(400).json({
        success: false,
        message: 'Leave dates overlap with existing leave application'
      });
    }

    // Check leave balance
    const leaveTypeKey = leaveType.toLowerCase();
    const availableLeaves = emp.leaveBalance[leaveTypeKey];

    if (availableLeaves !== undefined && leave.numberOfDays > availableLeaves) {
      return res.status(400).json({
        success: false,
        message: `Insufficient ${leaveType} leave balance. Available: ${availableLeaves} days`
      });
    }

    await leave.save();
    await leave.populate('employee');

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully',
      data: leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all leaves with filters
export const getAllLeaves = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      employee = '',
      status = '',
      leaveType = '',
      startDate = '',
      endDate = ''
    } = req.query;

    const query = {};

    if (employee) query.employee = employee;
    if (status) query.status = status;
    if (leaveType) query.leaveType = leaveType;

    if (startDate && endDate) {
      query.$or = [
        { startDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
        { endDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
        {
          startDate: { $lte: new Date(startDate) },
          endDate: { $gte: new Date(endDate) }
        }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const leaves = await Leave.find(query)
      .sort({ appliedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('employee approvedBy');

    const total = await Leave.countDocuments(query);

    res.status(200).json({
      success: true,
      data: leaves,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get leave by ID
export const getLeaveById = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id)
      .populate('employee approvedBy');

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave application not found'
      });
    }

    res.status(200).json({
      success: true,
      data: leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update leave
export const updateLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave application not found'
      });
    }

    if (leave.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update leave application that is already processed'
      });
    }

    const updatedLeave = await Leave.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('employee approvedBy');

    res.status(200).json({
      success: true,
      message: 'Leave application updated successfully',
      data: updatedLeave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Approve leave
export const approveLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy, remarks } = req.body;

    const leave = await Leave.findById(id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave application not found'
      });
    }

    if (leave.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Leave application is already processed'
      });
    }

    await leave.approve(approvedBy, remarks);

    // Update employee leave balance
    const employee = await Employee.findById(leave.employee);
    const leaveTypeKey = leave.leaveType.toLowerCase();

    if (employee.leaveBalance[leaveTypeKey] !== undefined) {
      employee.leaveBalance[leaveTypeKey] -= leave.numberOfDays;
      await employee.save();
    }

    await leave.populate('employee approvedBy');

    res.status(200).json({
      success: true,
      message: 'Leave approved successfully',
      data: leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Reject leave
export const rejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy, rejectionReason } = req.body;

    const leave = await Leave.findById(id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave application not found'
      });
    }

    if (leave.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: 'Leave application is already processed'
      });
    }

    await leave.reject(approvedBy, rejectionReason);
    await leave.populate('employee approvedBy');

    res.status(200).json({
      success: true,
      message: 'Leave rejected successfully',
      data: leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Cancel leave
export const cancelLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave application not found'
      });
    }

    if (leave.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Leave is already cancelled'
      });
    }

    // If leave was approved, restore leave balance
    if (leave.status === 'Approved') {
      const employee = await Employee.findById(leave.employee);
      const leaveTypeKey = leave.leaveType.toLowerCase();

      if (employee.leaveBalance[leaveTypeKey] !== undefined) {
        employee.leaveBalance[leaveTypeKey] += leave.numberOfDays;
        await employee.save();
      }
    }

    await leave.cancel();
    await leave.populate('employee');

    res.status(200).json({
      success: true,
      message: 'Leave cancelled successfully',
      data: leave
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get pending leaves
export const getPendingLeaves = async (req, res) => {
  try {
    const leaves = await Leave.getPendingLeaves();

    res.status(200).json({
      success: true,
      data: leaves
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get leave summary for employee
export const getLeaveSummary = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { year } = req.query;

    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const summary = await Leave.getLeaveSummary(employeeId, currentYear);

    // Get employee leave balance
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        taken: summary,
        balance: employee.leaveBalance
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get upcoming leaves
export const getUpcomingLeaves = async (req, res) => {
  try {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

    const leaves = await Leave.getApprovedLeaves(today, nextMonth);

    res.status(200).json({
      success: true,
      data: leaves
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete leave
export const deleteLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave application not found'
      });
    }

    if (leave.status === 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete approved leave. Please cancel it first.'
      });
    }

    await leave.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Leave application deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
