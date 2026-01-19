import * as XLSX from 'xlsx';

/**
 * Generate and download farmer import template Excel file
 */
export const generateFarmerImportTemplate = () => {
  // Define template data with sample rows
  const template = [
    {
      'Farmer Number': 'F001',
      'Member ID': 'MEM001',
      'Name': 'John Doe',
      'Phone Number': '9876543210'
    },
    {
      'Farmer Number': 'F002',
      'Member ID': 'MEM002',
      'Name': 'Jane Smith',
      'Phone Number': '9876543211'
    }
  ];

  // Create worksheet from template data
  const ws = XLSX.utils.json_to_sheet(template);

  // Set column widths for better readability
  ws['!cols'] = [
    { wch: 15 }, // Farmer Number
    { wch: 15 }, // Member ID
    { wch: 25 }, // Name
    { wch: 15 }  // Phone Number
  ];

  // Create workbook and add worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Farmers');

  // Generate and download file
  XLSX.writeFile(wb, 'farmer_import_template.xlsx');
};
