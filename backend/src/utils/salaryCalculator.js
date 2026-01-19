/**
 * Utility functions for salary calculations
 */

/**
 * Calculate gross salary from basic salary and allowances
 * @param {number} basicSalary - Basic salary amount
 * @param {object} allowances - Object containing all allowances
 * @returns {number} - Gross salary
 */
export const calculateGrossSalary = (basicSalary, allowances = {}) => {
  const totalAllowances = Object.values(allowances).reduce((sum, val) => sum + (val || 0), 0);
  return basicSalary + totalAllowances;
};

/**
 * Calculate total deductions
 * @param {object} deductions - Object containing all deductions
 * @returns {number} - Total deductions
 */
export const calculateTotalDeductions = (deductions = {}) => {
  let total = 0;

  // Regular deductions
  const regularDeductions = { ...deductions };
  delete regularDeductions.lossOfPay; // Handle separately

  total += Object.values(regularDeductions).reduce((sum, val) => sum + (val || 0), 0);

  // Loss of pay
  if (deductions.lossOfPay && deductions.lossOfPay.amount) {
    total += deductions.lossOfPay.amount;
  }

  return total;
};

/**
 * Calculate net salary
 * @param {number} grossSalary - Gross salary
 * @param {number} totalDeductions - Total deductions
 * @returns {number} - Net salary
 */
export const calculateNetSalary = (grossSalary, totalDeductions) => {
  return Math.max(0, grossSalary - totalDeductions);
};

/**
 * Calculate loss of pay (LOP) amount
 * @param {number} basicSalary - Basic salary
 * @param {number} workingDays - Total working days in month
 * @param {number} absentDays - Number of absent days
 * @param {number} halfDays - Number of half days
 * @returns {object} - Object containing lopDays and lopAmount
 */
export const calculateLossOfPay = (basicSalary, workingDays, absentDays = 0, halfDays = 0) => {
  const lopDays = absentDays + (halfDays * 0.5);
  const perDaySalary = workingDays > 0 ? basicSalary / workingDays : 0;
  const lopAmount = lopDays * perDaySalary;

  return {
    days: lopDays,
    amount: Math.round(lopAmount * 100) / 100 // Round to 2 decimal places
  };
};

/**
 * Calculate working days in a month (excluding weekends and holidays)
 * @param {number} totalDays - Total days in month
 * @param {number} weekOffs - Number of week offs
 * @param {number} holidays - Number of holidays
 * @returns {number} - Working days
 */
export const calculateWorkingDays = (totalDays, weekOffs = 0, holidays = 0) => {
  return Math.max(0, totalDays - weekOffs - holidays);
};

/**
 * Calculate overtime amount
 * @param {number} overtimeHours - Number of overtime hours
 * @param {number} ratePerHour - Rate per hour for overtime
 * @returns {object} - Object containing hours, ratePerHour, and amount
 */
export const calculateOvertimeAmount = (overtimeHours, ratePerHour) => {
  return {
    hours: overtimeHours,
    ratePerHour,
    amount: Math.round(overtimeHours * ratePerHour * 100) / 100
  };
};

/**
 * Calculate PF (Provident Fund) contribution
 * @param {number} basicSalary - Basic salary
 * @param {number} pfPercentage - PF percentage (default 12%)
 * @returns {number} - PF amount
 */
export const calculatePF = (basicSalary, pfPercentage = 12) => {
  return Math.round((basicSalary * pfPercentage / 100) * 100) / 100;
};

/**
 * Calculate ESI (Employee State Insurance) contribution
 * @param {number} grossSalary - Gross salary
 * @param {number} esiPercentage - ESI percentage (default 0.75%)
 * @returns {number} - ESI amount (0 if gross salary > 21000)
 */
export const calculateESI = (grossSalary, esiPercentage = 0.75) => {
  // ESI is applicable only if gross salary is <= 21000
  if (grossSalary > 21000) {
    return 0;
  }
  return Math.round((grossSalary * esiPercentage / 100) * 100) / 100;
};

/**
 * Calculate TDS (Tax Deducted at Source)
 * @param {number} annualSalary - Annual salary
 * @returns {number} - Monthly TDS amount
 */
export const calculateTDS = (annualSalary) => {
  let tax = 0;

  // Income tax slabs for FY 2024-25 (Old Regime)
  // Assuming standard deduction of 50,000
  const taxableIncome = Math.max(0, annualSalary - 50000);

  if (taxableIncome <= 250000) {
    tax = 0;
  } else if (taxableIncome <= 500000) {
    tax = (taxableIncome - 250000) * 0.05;
  } else if (taxableIncome <= 1000000) {
    tax = 12500 + (taxableIncome - 500000) * 0.20;
  } else {
    tax = 112500 + (taxableIncome - 1000000) * 0.30;
  }

  // Add 4% cess
  tax = tax * 1.04;

  // Convert to monthly TDS
  const monthlyTDS = tax / 12;

  return Math.round(monthlyTDS * 100) / 100;
};

/**
 * Calculate HRA (House Rent Allowance) as per standard rules
 * @param {number} basicSalary - Basic salary
 * @param {number} hraPercentage - HRA percentage (default 50% for metro, 40% for non-metro)
 * @returns {number} - HRA amount
 */
export const calculateHRA = (basicSalary, hraPercentage = 50) => {
  return Math.round((basicSalary * hraPercentage / 100) * 100) / 100;
};

/**
 * Calculate DA (Dearness Allowance)
 * @param {number} basicSalary - Basic salary
 * @param {number} daPercentage - DA percentage
 * @returns {number} - DA amount
 */
export const calculateDA = (basicSalary, daPercentage = 0) => {
  return Math.round((basicSalary * daPercentage / 100) * 100) / 100;
};

/**
 * Generate complete salary slip calculations
 * @param {object} employee - Employee object with salary details
 * @param {object} attendanceSummary - Attendance summary for the month
 * @param {object} additionalEarnings - Additional earnings like bonus, incentive
 * @param {object} additionalDeductions - Additional deductions like loan, advance
 * @returns {object} - Complete salary calculation
 */
export const generateSalarySlip = (
  employee,
  attendanceSummary,
  additionalEarnings = {},
  additionalDeductions = {}
) => {
  const { basicSalary, allowances, deductions } = employee.salaryDetails;

  // Calculate LOP
  const totalDaysInMonth = attendanceSummary.totalDays || 30;
  const weekOffs = attendanceSummary.weekOff || 0;
  const holidays = attendanceSummary.holiday || 0;
  const workingDays = calculateWorkingDays(totalDaysInMonth, weekOffs, holidays);
  const lop = calculateLossOfPay(
    basicSalary,
    workingDays,
    attendanceSummary.absent || 0,
    attendanceSummary.halfDay || 0
  );

  // Calculate overtime
  const overtimeHours = attendanceSummary.totalOvertimeHours || 0;
  const overtimeRate = 0; // Can be configured
  const overtime = calculateOvertimeAmount(overtimeHours, overtimeRate);

  // Earnings
  const earnings = {
    basicSalary,
    allowances: { ...allowances },
    overtime,
    bonus: additionalEarnings.bonus || 0,
    incentive: additionalEarnings.incentive || 0
  };

  // Deductions
  const salaryDeductions = {
    ...deductions,
    ...additionalDeductions,
    lossOfPay: lop
  };

  // Calculate totals
  const grossSalary = calculateGrossSalary(basicSalary, allowances) + overtime.amount + earnings.bonus + earnings.incentive;
  const totalDeductions = calculateTotalDeductions(salaryDeductions);
  const netSalary = calculateNetSalary(grossSalary, totalDeductions);

  return {
    earnings,
    deductions: salaryDeductions,
    grossSalary: Math.round(grossSalary * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netSalary: Math.round(netSalary * 100) / 100,
    attendanceSummary
  };
};

export default {
  calculateGrossSalary,
  calculateTotalDeductions,
  calculateNetSalary,
  calculateLossOfPay,
  calculateWorkingDays,
  calculateOvertimeAmount,
  calculatePF,
  calculateESI,
  calculateTDS,
  calculateHRA,
  calculateDA,
  generateSalarySlip
};
