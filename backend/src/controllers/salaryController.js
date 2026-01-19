import Salary from '../models/Salary.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';

// Create salary record
export const createSalary = async (req, res) => {
  try {
    const { employee, month, year } = req.body;

    // Check if salary already exists for this employee and month
    const existingSalary = await Salary.findOne({ employee, month, year });
    if (existingSalary) {
      return res.status(400).json({
        success: false,
        message: 'Salary record already exists for this month'
      });
    }

    // Create new salary record
    const salary = new Salary(req.body);
    await salary.save();
    await salary.populate('employee approvedBy');

    res.status(201).json({
      success: true,
      message: 'Salary record created successfully',
      data: salary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Process salary for employee (with attendance calculation)
export const processSalary = async (req, res) => {
  try {
    const { employeeId, month, year } = req.body;

    // Check if salary already exists
    const existingSalary = await Salary.findOne({
      employee: employeeId,
      month,
      year
    });

    if (existingSalary) {
      return res.status(400).json({
        success: false,
        message: 'Salary already processed for this month'
      });
    }

    // Get employee details
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Get attendance summary for the month
    const attendanceSummary = await Attendance.getMonthlySummary(employeeId, month, year);

    // Calculate salary based on employee's salary details
    const { basicSalary, allowances, deductions } = employee.salaryDetails;

    // Calculate Loss of Pay (LOP)
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const workingDays = totalDaysInMonth - attendanceSummary.weekOff - attendanceSummary.holiday;
    const lopDays = attendanceSummary.absent + (attendanceSummary.halfDay * 0.5);
    const perDaySalary = basicSalary / workingDays;
    const lopAmount = lopDays * perDaySalary;

    // Create salary record
    const salary = new Salary({
      employee: employeeId,
      month,
      year,
      earnings: {
        basicSalary,
        allowances,
        overtime: {
          hours: attendanceSummary.totalOvertimeHours,
          ratePerHour: 0, // Can be configured
          amount: 0 // Will be calculated if rate is set
        }
      },
      deductions: {
        ...deductions,
        lossOfPay: {
          days: lopDays,
          amount: lopAmount
        }
      },
      attendanceSummary: {
        totalDays: totalDaysInMonth,
        presentDays: attendanceSummary.present,
        absentDays: attendanceSummary.absent,
        halfDays: attendanceSummary.halfDay,
        paidLeaveDays: attendanceSummary.onLeave,
        holidays: attendanceSummary.holiday,
        workingHours: attendanceSummary.totalWorkingHours,
        overtimeHours: attendanceSummary.totalOvertimeHours
      },
      status: 'Processed'
    });

    await salary.save();
    await salary.populate('employee');

    res.status(201).json({
      success: true,
      message: 'Salary processed successfully',
      data: salary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all salaries with filters
export const getAllSalaries = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      employee = '',
      month = '',
      year = '',
      status = '',
      isPaid = ''
    } = req.query;

    const query = {};

    if (employee) query.employee = employee;
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (status) query.status = status;
    if (isPaid !== '') query['paymentDetails.isPaid'] = isPaid === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const salaries = await Salary.find(query)
      .sort({ year: -1, month: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('employee approvedBy');

    const total = await Salary.countDocuments(query);

    res.status(200).json({
      success: true,
      data: salaries,
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

// Get salary by ID
export const getSalaryById = async (req, res) => {
  try {
    const salary = await Salary.findById(req.params.id)
      .populate('employee approvedBy');

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: 'Salary record not found'
      });
    }

    res.status(200).json({
      success: true,
      data: salary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update salary
export const updateSalary = async (req, res) => {
  try {
    const salary = await Salary.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('employee approvedBy');

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: 'Salary record not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Salary updated successfully',
      data: salary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Approve salary
export const approveSalary = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy } = req.body;

    const salary = await Salary.findById(id);
    if (!salary) {
      return res.status(404).json({
        success: false,
        message: 'Salary record not found'
      });
    }

    await salary.approve(approvedBy);
    await salary.populate('employee approvedBy');

    res.status(200).json({
      success: true,
      message: 'Salary approved successfully',
      data: salary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Mark salary as paid
export const markSalaryAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, transactionId } = req.body;

    const salary = await Salary.findById(id);
    if (!salary) {
      return res.status(404).json({
        success: false,
        message: 'Salary record not found'
      });
    }

    if (salary.status !== 'Approved') {
      return res.status(400).json({
        success: false,
        message: 'Salary must be approved before marking as paid'
      });
    }

    await salary.markAsPaid(paymentMethod, transactionId);
    await salary.populate('employee approvedBy');

    res.status(200).json({
      success: true,
      message: 'Salary marked as paid successfully',
      data: salary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Generate payslip
export const generatePayslip = async (req, res) => {
  try {
    const { id } = req.params;

    const salary = await Salary.findById(id).populate('employee');
    if (!salary) {
      return res.status(404).json({
        success: false,
        message: 'Salary record not found'
      });
    }

    await salary.generatePayslip();

    res.status(200).json({
      success: true,
      message: 'Payslip generated successfully',
      data: salary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get pending salaries
export const getPendingSalaries = async (req, res) => {
  try {
    const salaries = await Salary.getPendingSalaries();

    res.status(200).json({
      success: true,
      data: salaries
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get unpaid salaries
export const getUnpaidSalaries = async (req, res) => {
  try {
    const salaries = await Salary.getUnpaidSalaries();

    res.status(200).json({
      success: true,
      data: salaries
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Bulk process salary for all employees
export const bulkProcessSalary = async (req, res) => {
  try {
    const { month, year, department = '', designation = '' } = req.body;

    // Build employee filter
    const employeeFilter = { 'employmentDetails.status': 'Active' };
    if (department) employeeFilter['employmentDetails.department'] = department;
    if (designation) employeeFilter['employmentDetails.designation'] = designation;

    // Get active employees
    const employees = await Employee.find(employeeFilter);

    const results = [];
    const errors = [];

    for (const employee of employees) {
      try {
        // Check if salary already exists
        const existing = await Salary.findOne({
          employee: employee._id,
          month,
          year
        });

        if (existing) {
          errors.push({
            employee: employee.employeeNumber,
            message: 'Salary already processed'
          });
          continue;
        }

        // Get attendance summary
        const attendanceSummary = await Attendance.getMonthlySummary(employee._id, month, year);

        // Calculate LOP
        const totalDaysInMonth = new Date(year, month, 0).getDate();
        const workingDays = totalDaysInMonth - attendanceSummary.weekOff - attendanceSummary.holiday;
        const lopDays = attendanceSummary.absent + (attendanceSummary.halfDay * 0.5);
        const perDaySalary = employee.salaryDetails.basicSalary / workingDays;
        const lopAmount = lopDays * perDaySalary;

        // Create salary record
        const salary = new Salary({
          employee: employee._id,
          month,
          year,
          earnings: {
            basicSalary: employee.salaryDetails.basicSalary,
            allowances: employee.salaryDetails.allowances,
            overtime: {
              hours: attendanceSummary.totalOvertimeHours,
              ratePerHour: 0,
              amount: 0
            }
          },
          deductions: {
            ...employee.salaryDetails.deductions,
            lossOfPay: {
              days: lopDays,
              amount: lopAmount
            }
          },
          attendanceSummary: {
            totalDays: totalDaysInMonth,
            presentDays: attendanceSummary.present,
            absentDays: attendanceSummary.absent,
            halfDays: attendanceSummary.halfDay,
            paidLeaveDays: attendanceSummary.onLeave,
            holidays: attendanceSummary.holiday,
            workingHours: attendanceSummary.totalWorkingHours,
            overtimeHours: attendanceSummary.totalOvertimeHours
          },
          status: 'Processed'
        });

        await salary.save();
        results.push(salary);
      } catch (error) {
        errors.push({
          employee: employee.employeeNumber,
          message: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Salary processed for ${results.length} employees`,
      data: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete salary
export const deleteSalary = async (req, res) => {
  try {
    const salary = await Salary.findById(req.params.id);

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: 'Salary record not found'
      });
    }

    if (salary.status === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete paid salary'
      });
    }

    await salary.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Salary record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
