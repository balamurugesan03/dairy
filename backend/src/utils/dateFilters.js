// Date filter utility functions for reports

/**
 * Get date range based on filter type
 * @param {string} filterType - Type of filter (thisMonth, lastMonth, thisQuarter, thisYear, financialYear, custom)
 * @param {string} customStart - Custom start date (for custom filter)
 * @param {string} customEnd - Custom end date (for custom filter)
 * @param {string} financialYearStart - Financial year start month (default: 'April')
 * @returns {Object} { startDate, endDate }
 */
export const getDateRange = (filterType, customStart, customEnd, financialYearStart = 'April') => {
  const now = new Date();
  let startDate, endDate;

  switch (filterType) {
    case 'thisMonth':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;

    case 'lastMonth':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;

    case 'thisQuarter':
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), quarterMonth, 1);
      endDate = new Date(now.getFullYear(), quarterMonth + 3, 0, 23, 59, 59, 999);
      break;

    case 'thisYear':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;

    case 'financialYear':
      // Financial year: April to March (default)
      const fyStartMonth = financialYearStart === 'April' ? 3 : 0; // April = month 3 (0-indexed)
      const currentMonth = now.getMonth();

      if (currentMonth >= fyStartMonth) {
        // Current FY
        startDate = new Date(now.getFullYear(), fyStartMonth, 1);
        endDate = new Date(now.getFullYear() + 1, fyStartMonth, 0, 23, 59, 59, 999);
      } else {
        // Previous FY
        startDate = new Date(now.getFullYear() - 1, fyStartMonth, 1);
        endDate = new Date(now.getFullYear(), fyStartMonth, 0, 23, 59, 59, 999);
      }
      break;

    case 'custom':
      startDate = customStart ? new Date(customStart) : new Date(now.getFullYear(), 0, 1);
      endDate = customEnd ? new Date(customEnd) : now;
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);
      break;

    default:
      // Default to current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return { startDate, endDate };
};

/**
 * Get list of financial years for dropdown
 * @param {number} yearsBack - Number of past financial years to include (default: 5)
 * @returns {Array} Array of FY objects with value, label, startDate, endDate
 */
export const getFinancialYears = (yearsBack = 5) => {
  const years = [];
  const now = new Date();
  const currentMonth = now.getMonth();

  // If before April, we're still in the previous FY
  let startYear = currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  for (let i = 0; i < yearsBack; i++) {
    const year = startYear - i;
    years.push({
      value: year,
      label: `FY ${year}-${(year + 1).toString().slice(-2)}`,
      startDate: new Date(year, 3, 1), // April 1
      endDate: new Date(year + 1, 2, 31, 23, 59, 59, 999) // March 31
    });
  }

  return years;
};

/**
 * Get list of months for a given year
 * @param {number} year - Year (default: current year)
 * @returns {Array} Array of month objects with value, label, startDate, endDate
 */
export const getMonths = (year = new Date().getFullYear()) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return months.map((name, index) => ({
    value: index,
    label: name,
    startDate: new Date(year, index, 1),
    endDate: new Date(year, index + 1, 0, 23, 59, 59, 999)
  }));
};

/**
 * Get year range for dropdown
 * @param {number} yearsBack - Number of past years to include (default: 5)
 * @param {number} yearsFuture - Number of future years to include (default: 1)
 * @returns {Array} Array of year values
 */
export const getYearRange = (yearsBack = 5, yearsFuture = 1) => {
  const currentYear = new Date().getFullYear();
  const years = [];

  for (let i = -yearsBack; i <= yearsFuture; i++) {
    years.push(currentYear + i);
  }

  return years.sort((a, b) => b - a); // Descending order
};

/**
 * Format date for display
 * @param {Date} date - Date object
 * @param {string} format - Format string (default: 'DD/MM/YYYY')
 * @returns {string} Formatted date string
 */
export const formatDate = (date, format = 'DD/MM/YYYY') => {
  if (!date) return '';

  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  switch (format) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    default:
      return `${day}/${month}/${year}`;
  }
};

export default {
  getDateRange,
  getFinancialYears,
  getMonths,
  getYearRange,
  formatDate
};
