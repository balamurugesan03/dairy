import React from 'react';
import * as XLSX from 'xlsx';

const ExportButton = ({
  data,
  filename = 'export',
  sheetName = 'Sheet1',
  buttonText = 'Export to Excel',
  className = '',
  ...rest
}) => {
  const handleExport = () => {
    if (!data || data.length === 0) {
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `${filename}_${timestamp}.xlsx`);
  };

  return (
    <button
      className={`btn btn-primary ${className}`}
      onClick={handleExport}
      disabled={!data || data.length === 0}
      {...rest}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="7 10 12 15 17 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="12" y1="15" x2="12" y2="3" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      {buttonText}
    </button>
  );
};

export default ExportButton;
