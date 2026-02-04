import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import { producerRegisterAPI, farmerAPI } from '../../services/api';
import { message } from '../../utils/toast';
import dayjs from 'dayjs';
import './ProducerRegister.css';

const ProducerRegister = () => {
  // State
  const [farmers, setFarmers] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [registerData, setRegisterData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    fromDate: dayjs().startOf('month').format('YYYY-MM-DD'),
    toDate: dayjs().endOf('month').format('YYYY-MM-DD')
  });

  // Editable rows state
  const [rows, setRows] = useState([]);
  const [editingCell, setEditingCell] = useState(null);

  // Print ref
  const printRef = useRef();

  // Default empty rows count
  const DEFAULT_ROWS = 20;

  // Fetch farmers list
  useEffect(() => {
    fetchFarmers();
  }, []);

  const fetchFarmers = async () => {
    try {
      const response = await farmerAPI.getAll({ status: 'Active', limit: 1000 });
      setFarmers(response.data.farmers || response.data || []);
    } catch (error) {
      message.error('Failed to fetch farmers');
    }
  };

  // Fetch register data when farmer or date changes
  const fetchRegisterData = async () => {
    if (!selectedFarmer) return;

    try {
      setLoading(true);
      const response = await producerRegisterAPI.getRegister(selectedFarmer._id, {
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate
      });

      setRegisterData(response.data);

      // Convert API data to editable rows
      const apiRows = response.data.entries || [];
      const editableRows = apiRows.map((entry, index) => ({
        id: entry._id || `row-${index}`,
        date: entry.date ? dayjs(entry.date).format('DD/MM/YYYY') : '',
        morningQty: entry.morningQty || '',
        eveningQty: entry.eveningQty || '',
        totalMilk: entry.totalMilk || '',
        rate: entry.rate || '',
        totalAmount: entry.totalAmount || '',
        loanDeduction: entry.loanDeduction || '',
        cashAdvance: entry.cashAdvance || '',
        otherDeduction: entry.otherDeduction || '',
        totalDeduction: entry.totalDeduction || '',
        receiptNo: entry.receiptNo || '',
        receiptAmount: entry.receiptAmount || '',
        receiptDate: entry.receiptDate ? dayjs(entry.receiptDate).format('DD/MM/YYYY') : '',
        paidAmount: entry.paidAmount || '',
        paymentMode: entry.paymentMode || '',
        closingBalance: entry.closingBalance || ''
      }));

      // Fill remaining rows to reach minimum
      while (editableRows.length < DEFAULT_ROWS) {
        editableRows.push(createEmptyRow(editableRows.length));
      }

      setRows(editableRows);
    } catch (error) {
      message.error('Failed to fetch register data');
      // Initialize with empty rows if API fails
      initializeEmptyRows();
    } finally {
      setLoading(false);
    }
  };

  const createEmptyRow = (index) => ({
    id: `new-${index}-${Date.now()}`,
    date: '',
    morningQty: '',
    eveningQty: '',
    totalMilk: '',
    rate: '',
    totalAmount: '',
    loanDeduction: '',
    cashAdvance: '',
    otherDeduction: '',
    totalDeduction: '',
    receiptNo: '',
    receiptAmount: '',
    receiptDate: '',
    paidAmount: '',
    paymentMode: '',
    closingBalance: ''
  });

  const initializeEmptyRows = () => {
    const emptyRows = [];
    for (let i = 0; i < DEFAULT_ROWS; i++) {
      emptyRows.push(createEmptyRow(i));
    }
    setRows(emptyRows);
  };

  // Initialize empty rows on mount
  useEffect(() => {
    initializeEmptyRows();
  }, []);

  // Fetch data when farmer/date changes
  useEffect(() => {
    if (selectedFarmer) {
      fetchRegisterData();
    }
  }, [selectedFarmer, dateRange.fromDate, dateRange.toDate]);

  // Handle cell edit
  const handleCellChange = (rowIndex, field, value) => {
    const newRows = [...rows];
    newRows[rowIndex][field] = value;

    // Auto-calculate derived fields
    if (['morningQty', 'eveningQty'].includes(field)) {
      const morning = parseFloat(newRows[rowIndex].morningQty) || 0;
      const evening = parseFloat(newRows[rowIndex].eveningQty) || 0;
      newRows[rowIndex].totalMilk = (morning + evening).toFixed(2);

      // Recalculate total amount if rate exists
      const rate = parseFloat(newRows[rowIndex].rate) || 0;
      if (rate > 0) {
        newRows[rowIndex].totalAmount = ((morning + evening) * rate).toFixed(2);
      }
    }

    if (field === 'rate' && newRows[rowIndex].totalMilk) {
      const totalMilk = parseFloat(newRows[rowIndex].totalMilk) || 0;
      newRows[rowIndex].totalAmount = (totalMilk * parseFloat(value || 0)).toFixed(2);
    }

    // Auto-calculate total deduction
    if (['loanDeduction', 'cashAdvance', 'otherDeduction'].includes(field)) {
      const loan = parseFloat(newRows[rowIndex].loanDeduction) || 0;
      const cash = parseFloat(newRows[rowIndex].cashAdvance) || 0;
      const other = parseFloat(newRows[rowIndex].otherDeduction) || 0;
      newRows[rowIndex].totalDeduction = (loan + cash + other).toFixed(2);
    }

    setRows(newRows);
  };

  // Handle Enter key to add new row
  const handleKeyDown = (e, rowIndex, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      // If on last row, add new row
      if (rowIndex === rows.length - 1) {
        const newRows = [...rows, createEmptyRow(rows.length)];
        setRows(newRows);
      }

      // Move to next row, same field
      setTimeout(() => {
        const nextInput = document.querySelector(
          `[data-row="${rowIndex + 1}"][data-field="${field}"]`
        );
        if (nextInput) nextInput.focus();
      }, 0);
    }

    // Tab navigation
    if (e.key === 'Tab') {
      const fields = [
        'date', 'morningQty', 'eveningQty', 'rate',
        'loanDeduction', 'cashAdvance', 'otherDeduction',
        'receiptNo', 'receiptAmount', 'receiptDate',
        'paidAmount', 'paymentMode'
      ];

      const currentFieldIndex = fields.indexOf(field);

      if (!e.shiftKey && currentFieldIndex === fields.length - 1) {
        // Last field, move to next row first field
        e.preventDefault();
        if (rowIndex === rows.length - 1) {
          const newRows = [...rows, createEmptyRow(rows.length)];
          setRows(newRows);
        }
        setTimeout(() => {
          const nextInput = document.querySelector(
            `[data-row="${rowIndex + 1}"][data-field="date"]`
          );
          if (nextInput) nextInput.focus();
        }, 0);
      }
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    return rows.reduce((acc, row) => ({
      morningQty: acc.morningQty + (parseFloat(row.morningQty) || 0),
      eveningQty: acc.eveningQty + (parseFloat(row.eveningQty) || 0),
      totalMilk: acc.totalMilk + (parseFloat(row.totalMilk) || 0),
      totalAmount: acc.totalAmount + (parseFloat(row.totalAmount) || 0),
      loanDeduction: acc.loanDeduction + (parseFloat(row.loanDeduction) || 0),
      cashAdvance: acc.cashAdvance + (parseFloat(row.cashAdvance) || 0),
      otherDeduction: acc.otherDeduction + (parseFloat(row.otherDeduction) || 0),
      totalDeduction: acc.totalDeduction + (parseFloat(row.totalDeduction) || 0),
      receiptAmount: acc.receiptAmount + (parseFloat(row.receiptAmount) || 0),
      paidAmount: acc.paidAmount + (parseFloat(row.paidAmount) || 0)
    }), {
      morningQty: 0, eveningQty: 0, totalMilk: 0, totalAmount: 0,
      loanDeduction: 0, cashAdvance: 0, otherDeduction: 0, totalDeduction: 0,
      receiptAmount: 0, paidAmount: 0
    });
  };

  const totals = calculateTotals();
  const netPayable = totals.totalAmount - totals.totalDeduction;

  // Print handler
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Producer_Register_${selectedFarmer?.personalDetails?.name || 'Report'}`,
    pageStyle: `
      @page {
        size: A4 landscape;
        margin: 10mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .no-print {
          display: none !important;
        }
        .ledger-page {
          page-break-inside: avoid;
        }
      }
    `
  });

  // Save register data
  const handleSave = async () => {
    if (!selectedFarmer) {
      message.error('Please select a farmer first');
      return;
    }

    try {
      setLoading(true);

      // Filter out empty rows
      const dataToSave = rows.filter(row =>
        row.date || row.morningQty || row.eveningQty || row.paidAmount
      );

      await producerRegisterAPI.saveRegister(selectedFarmer._id, {
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate,
        entries: dataToSave
      });

      message.success('Register saved successfully');
    } catch (error) {
      message.error('Failed to save register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ledger-container">
      {/* Control Panel - Not Printed */}
      <div className="ledger-controls no-print">
        <div className="control-row">
          <div className="control-group">
            <label>Select Farmer:</label>
            <select
              value={selectedFarmer?._id || ''}
              onChange={(e) => {
                const farmer = farmers.find(f => f._id === e.target.value);
                setSelectedFarmer(farmer);
              }}
              className="ledger-select"
            >
              <option value="">-- Select Farmer --</option>
              {farmers.map(farmer => (
                <option key={farmer._id} value={farmer._id}>
                  {farmer.farmerNumber} - {farmer.personalDetails?.name}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>From Date:</label>
            <input
              type="date"
              value={dateRange.fromDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, fromDate: e.target.value }))}
              className="ledger-input"
            />
          </div>

          <div className="control-group">
            <label>To Date:</label>
            <input
              type="date"
              value={dateRange.toDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, toDate: e.target.value }))}
              className="ledger-input"
            />
          </div>

          <div className="control-actions">
            <button onClick={fetchRegisterData} className="ledger-btn ledger-btn-primary" disabled={!selectedFarmer}>
              Load Data
            </button>
            <button onClick={handleSave} className="ledger-btn ledger-btn-success" disabled={!selectedFarmer}>
              Save
            </button>
            <button onClick={handlePrint} className="ledger-btn ledger-btn-secondary">
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Ledger Register Page */}
      <div className="ledger-page" ref={printRef}>
        {/* Header */}
        <div className="ledger-header">
          <div className="ledger-title-block">
            <h1 className="ledger-main-title">Producer / Partner Register - Detailed</h1>
            <div className="ledger-period">
              Period: {dayjs(dateRange.fromDate).format('DD/MM/YYYY')} to {dayjs(dateRange.toDate).format('DD/MM/YYYY')}
            </div>
          </div>
        </div>

        {/* Main Register Table */}
        <div className="ledger-table-wrapper">
          <table className="ledger-table">
            <thead>
              {/* Section Headers */}
              <tr className="section-header-row">
                <th colSpan="3" className="section-header section-producer">Producer Details</th>
                <th colSpan="1" className="section-header section-opening">Opening</th>
                <th colSpan="6" className="section-header section-milk">Milk &amp; Amount Details</th>
                <th colSpan="4" className="section-header section-deduction">Deductions</th>
                <th colSpan="3" className="section-header section-receipt">Receipts</th>
                <th colSpan="3" className="section-header section-payment">Payment &amp; Balance</th>
              </tr>

              {/* Column Headers */}
              <tr className="column-header-row">
                {/* Producer Details */}
                <th className="col-header col-narrow">Pr. No</th>
                <th className="col-header col-narrow">Pr. ID</th>
                <th className="col-header col-name">Producer Name</th>

                {/* Opening Balance */}
                <th className="col-header col-amount">Op. Bal (+/-)</th>

                {/* Milk Details */}
                <th className="col-header col-date">Date</th>
                <th className="col-header col-qty">Morn Qty</th>
                <th className="col-header col-qty">Eve Qty</th>
                <th className="col-header col-qty">Total Milk</th>
                <th className="col-header col-rate">Rate</th>
                <th className="col-header col-amount">Total Amt</th>

                {/* Deductions */}
                <th className="col-header col-deduct">Loan Ded.</th>
                <th className="col-header col-deduct">Cash Adv.</th>
                <th className="col-header col-deduct">Other Ded.</th>
                <th className="col-header col-deduct">Total Ded.</th>

                {/* Receipts */}
                <th className="col-header col-narrow">Rcpt No</th>
                <th className="col-header col-amount">Rcpt Amt</th>
                <th className="col-header col-date">Rcpt Date</th>

                {/* Payment & Balance */}
                <th className="col-header col-amount">Paid Amt</th>
                <th className="col-header col-mode">Pay Mode</th>
                <th className="col-header col-amount">Closing Bal</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.id} className="ledger-row">
                  {/* Producer Details - Only show on first row */}
                  {rowIndex === 0 ? (
                    <>
                      <td className="cell cell-narrow cell-static" rowSpan={rows.length}>
                        {selectedFarmer?.farmerNumber || '-'}
                      </td>
                      <td className="cell cell-narrow cell-static" rowSpan={rows.length}>
                        {selectedFarmer?.memberId || '-'}
                      </td>
                      <td className="cell cell-name cell-static producer-name-cell" rowSpan={rows.length}>
                        <div className="producer-name-vertical">
                          {selectedFarmer?.personalDetails?.name || 'Select Farmer'}
                        </div>
                      </td>
                      <td className="cell cell-amount cell-static" rowSpan={rows.length}>
                        <span className={registerData?.openingBalance >= 0 ? 'balance-positive' : 'balance-negative'}>
                          {registerData?.openingBalance?.toFixed(2) || '0.00'}
                        </span>
                      </td>
                    </>
                  ) : null}

                  {/* Milk Details - Editable */}
                  <td className="cell cell-date">
                    <input
                      type="text"
                      value={row.date}
                      onChange={(e) => handleCellChange(rowIndex, 'date', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 'date')}
                      data-row={rowIndex}
                      data-field="date"
                      className="cell-input"
                      placeholder="DD/MM/YY"
                    />
                  </td>
                  <td className="cell cell-qty">
                    <input
                      type="number"
                      step="0.01"
                      value={row.morningQty}
                      onChange={(e) => handleCellChange(rowIndex, 'morningQty', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 'morningQty')}
                      data-row={rowIndex}
                      data-field="morningQty"
                      className="cell-input cell-input-right"
                    />
                  </td>
                  <td className="cell cell-qty">
                    <input
                      type="number"
                      step="0.01"
                      value={row.eveningQty}
                      onChange={(e) => handleCellChange(rowIndex, 'eveningQty', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 'eveningQty')}
                      data-row={rowIndex}
                      data-field="eveningQty"
                      className="cell-input cell-input-right"
                    />
                  </td>
                  <td className="cell cell-qty cell-calculated">
                    {row.totalMilk || ''}
                  </td>
                  <td className="cell cell-rate">
                    <input
                      type="number"
                      step="0.01"
                      value={row.rate}
                      onChange={(e) => handleCellChange(rowIndex, 'rate', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 'rate')}
                      data-row={rowIndex}
                      data-field="rate"
                      className="cell-input cell-input-right"
                    />
                  </td>
                  <td className="cell cell-amount cell-calculated">
                    {row.totalAmount || ''}
                  </td>

                  {/* Deductions */}
                  <td className="cell cell-deduct">
                    <input
                      type="number"
                      step="0.01"
                      value={row.loanDeduction}
                      onChange={(e) => handleCellChange(rowIndex, 'loanDeduction', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 'loanDeduction')}
                      data-row={rowIndex}
                      data-field="loanDeduction"
                      className="cell-input cell-input-right"
                    />
                  </td>
                  <td className="cell cell-deduct">
                    <input
                      type="number"
                      step="0.01"
                      value={row.cashAdvance}
                      onChange={(e) => handleCellChange(rowIndex, 'cashAdvance', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 'cashAdvance')}
                      data-row={rowIndex}
                      data-field="cashAdvance"
                      className="cell-input cell-input-right"
                    />
                  </td>
                  <td className="cell cell-deduct">
                    <input
                      type="number"
                      step="0.01"
                      value={row.otherDeduction}
                      onChange={(e) => handleCellChange(rowIndex, 'otherDeduction', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 'otherDeduction')}
                      data-row={rowIndex}
                      data-field="otherDeduction"
                      className="cell-input cell-input-right"
                    />
                  </td>
                  <td className="cell cell-deduct cell-calculated cell-deduct-total">
                    {row.totalDeduction || ''}
                  </td>

                  {/* Receipts */}
                  <td className="cell cell-narrow">
                    <input
                      type="text"
                      value={row.receiptNo}
                      onChange={(e) => handleCellChange(rowIndex, 'receiptNo', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 'receiptNo')}
                      data-row={rowIndex}
                      data-field="receiptNo"
                      className="cell-input"
                    />
                  </td>
                  <td className="cell cell-amount">
                    <input
                      type="number"
                      step="0.01"
                      value={row.receiptAmount}
                      onChange={(e) => handleCellChange(rowIndex, 'receiptAmount', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 'receiptAmount')}
                      data-row={rowIndex}
                      data-field="receiptAmount"
                      className="cell-input cell-input-right"
                    />
                  </td>
                  <td className="cell cell-date">
                    <input
                      type="text"
                      value={row.receiptDate}
                      onChange={(e) => handleCellChange(rowIndex, 'receiptDate', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 'receiptDate')}
                      data-row={rowIndex}
                      data-field="receiptDate"
                      className="cell-input"
                      placeholder="DD/MM/YY"
                    />
                  </td>

                  {/* Payment & Balance */}
                  <td className="cell cell-amount">
                    <input
                      type="number"
                      step="0.01"
                      value={row.paidAmount}
                      onChange={(e) => handleCellChange(rowIndex, 'paidAmount', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 'paidAmount')}
                      data-row={rowIndex}
                      data-field="paidAmount"
                      className="cell-input cell-input-right"
                    />
                  </td>
                  <td className="cell cell-mode">
                    <select
                      value={row.paymentMode}
                      onChange={(e) => handleCellChange(rowIndex, 'paymentMode', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIndex, 'paymentMode')}
                      data-row={rowIndex}
                      data-field="paymentMode"
                      className="cell-select"
                    >
                      <option value=""></option>
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank</option>
                      <option value="UPI">UPI</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </td>
                  <td className="cell cell-amount cell-closing-balance">
                    {row.closingBalance || ''}
                  </td>
                </tr>
              ))}

              {/* Footer Total Row */}
              <tr className="ledger-total-row">
                <td colSpan="4" className="cell cell-total-label">TOTALS</td>
                <td className="cell cell-total"></td>
                <td className="cell cell-total cell-total-value">{totals.morningQty.toFixed(2)}</td>
                <td className="cell cell-total cell-total-value">{totals.eveningQty.toFixed(2)}</td>
                <td className="cell cell-total cell-total-value cell-total-highlight">{totals.totalMilk.toFixed(2)}</td>
                <td className="cell cell-total"></td>
                <td className="cell cell-total cell-total-value cell-total-highlight">{totals.totalAmount.toFixed(2)}</td>
                <td className="cell cell-total cell-total-value">{totals.loanDeduction.toFixed(2)}</td>
                <td className="cell cell-total cell-total-value">{totals.cashAdvance.toFixed(2)}</td>
                <td className="cell cell-total cell-total-value">{totals.otherDeduction.toFixed(2)}</td>
                <td className="cell cell-total cell-total-value cell-total-highlight">{totals.totalDeduction.toFixed(2)}</td>
                <td className="cell cell-total"></td>
                <td className="cell cell-total cell-total-value">{totals.receiptAmount.toFixed(2)}</td>
                <td className="cell cell-total"></td>
                <td className="cell cell-total cell-total-value cell-total-highlight">{totals.paidAmount.toFixed(2)}</td>
                <td className="cell cell-total"></td>
                <td className="cell cell-total cell-total-value cell-net-payable">
                  {netPayable.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="ledger-footer">
          <div className="footer-summary">
            <div className="summary-item">
              <span className="summary-label">Total Milk:</span>
              <span className="summary-value">{totals.totalMilk.toFixed(2)} Ltrs</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Amount:</span>
              <span className="summary-value">Rs. {totals.totalAmount.toFixed(2)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Deduction:</span>
              <span className="summary-value">Rs. {totals.totalDeduction.toFixed(2)}</span>
            </div>
            <div className="summary-item summary-item-highlight">
              <span className="summary-label">Net Payable:</span>
              <span className="summary-value">Rs. {netPayable.toFixed(2)}</span>
            </div>
          </div>

          <div className="footer-signatures">
            <div className="signature-block">
              <div className="signature-line"></div>
              <span>Producer Signature</span>
            </div>
            <div className="signature-block">
              <div className="signature-line"></div>
              <span>Verified By</span>
            </div>
            <div className="signature-block">
              <div className="signature-line"></div>
              <span>Authorized Signatory</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProducerRegister;
