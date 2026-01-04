import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { reportAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import dayjs from 'dayjs';
import './StockReportView.css';

const StockReportView = () => {
  const [loading, setLoading] = useState(false);
  const [stockData, setStockData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [stockStatusFilter, setStockStatusFilter] = useState('');
  const [minBalance, setMinBalance] = useState('');
  const [maxBalance, setMaxBalance] = useState('');

  useEffect(() => {
    fetchStockReport();
  }, []);

  useEffect(() => {
    let filtered = stockData;

    // Text search filter
    if (searchText) {
      filtered = filtered.filter(item =>
        item.itemName?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.itemCode?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Date range filter
    if (fromDate || toDate) {
      filtered = filtered.filter(item => {
        if (!item.updatedAt && !item.createdAt) return true;
        const itemDate = dayjs(item.updatedAt || item.createdAt);
        if (fromDate && itemDate.isBefore(dayjs(fromDate), 'day')) return false;
        if (toDate && itemDate.isAfter(dayjs(toDate), 'day')) return false;
        return true;
      });
    }

    // Stock status filter
    if (stockStatusFilter) {
      filtered = filtered.filter(item => {
        const status = getStockStatus(item.currentBalance).text;
        return status === stockStatusFilter;
      });
    }

    // Balance range filter
    if (minBalance !== '' || maxBalance !== '') {
      filtered = filtered.filter(item => {
        const balance = item.currentBalance || 0;
        if (minBalance !== '' && balance < Number(minBalance)) return false;
        if (maxBalance !== '' && balance > Number(maxBalance)) return false;
        return true;
      });
    }

    setFilteredData(filtered);
    setCurrentPage(1);
  }, [searchText, selectedCategory, stockData, fromDate, toDate, stockStatusFilter, minBalance, maxBalance]);

  const fetchStockReport = async () => {
    setLoading(true);
    try {
      const response = await reportAPI.stock();
      const data = Array.isArray(response.data) ? response.data : [];
      setStockData(data);
      setFilteredData(data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch stock report');
      setStockData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (balance, minStock = 10) => {
    if (balance === 0) return { text: 'Out of Stock', color: '#dc3545' };
    if (balance < minStock) return { text: 'Low Stock', color: '#fd7e14' };
    if (balance < minStock * 3) return { text: 'Normal', color: '#0d6efd' };
    return { text: 'In Stock', color: '#198754' };
  };

  const categories = ['Feed', 'Medicine', 'Equipment', 'Dairy Products', 'Other'];

  const exportData = Array.isArray(filteredData) ? filteredData.map(item => ({
    'Item Code': item.itemCode,
    'Item Name': item.itemName,
    'Category': item.category,
    'Unit': item.unit,
    'Opening Balance': item.openingBalance || 0,
    'Stock In': item.stockIn || 0,
    'Stock Out': item.stockOut || 0,
    'Current Balance': item.currentBalance || 0,
    'Purchase Rate': (item.purchaseRate || 0).toFixed(2),
    'Stock Value': ((item.currentBalance || 0) * (item.purchaseRate || 0)).toFixed(2),
    'Status': getStockStatus(item.currentBalance).text
  })) : [];

  const totalStockValue = Array.isArray(filteredData) ? filteredData.reduce(
    (sum, item) => sum + ((item.currentBalance || 0) * (item.purchaseRate || 0)),
    0
  ) : 0;

  const exportToPDF = () => {
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text('Stock Report', 14, 20);

    // Add date range if applied
    doc.setFontSize(10);
    let yPosition = 30;
    if (fromDate || toDate) {
      const dateRange = `Date Range: ${fromDate ? dayjs(fromDate).format('DD/MM/YYYY') : 'Start'} - ${toDate ? dayjs(toDate).format('DD/MM/YYYY') : 'End'}`;
      doc.text(dateRange, 14, yPosition);
      yPosition += 6;
    }

    // Add filters info
    if (selectedCategory) {
      doc.text(`Category: ${selectedCategory}`, 14, yPosition);
      yPosition += 6;
    }
    if (stockStatusFilter) {
      doc.text(`Status: ${stockStatusFilter}`, 14, yPosition);
      yPosition += 6;
    }

    doc.text(`Generated: ${dayjs().format('DD/MM/YYYY HH:mm')}`, 14, yPosition);
    yPosition += 10;

    // Prepare table data
    const tableData = filteredData.map(item => [
      item.itemCode,
      item.itemName,
      item.category,
      item.unit,
      item.openingBalance || 0,
      item.stockIn || 0,
      item.stockOut || 0,
      item.currentBalance || 0,
      `₹${((item.currentBalance || 0) * (item.purchaseRate || 0)).toFixed(2)}`,
      getStockStatus(item.currentBalance).text
    ]);

    // Add table
    doc.autoTable({
      head: [[
        'Item Code',
        'Item Name',
        'Category',
        'Unit',
        'Opening',
        'Stock In',
        'Stock Out',
        'Current',
        'Value',
        'Status'
      ]],
      body: tableData,
      startY: yPosition,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' }
      },
      foot: [[
        { content: 'Total Stock Value:', colSpan: 8, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `₹${totalStockValue.toFixed(2)}`, styles: { fontStyle: 'bold' } },
        ''
      ]],
      footStyles: { fillColor: [240, 240, 240], textColor: 0 }
    });

    // Save the PDF
    const filename = `stock_report_${dayjs().format('YYYYMMDD_HHmmss')}.pdf`;
    doc.save(filename);
    message.success('PDF exported successfully');
  };

  const clearAllFilters = () => {
    setSearchText('');
    setSelectedCategory('');
    setFromDate('');
    setToDate('');
    setStockStatusFilter('');
    setMinBalance('');
    setMaxBalance('');
  };

  const totalPages = Math.ceil((filteredData?.length || 0) / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = Array.isArray(filteredData) ? filteredData.slice(startIndex, endIndex) : [];

  return (
    <div>
      <PageHeader
        title="Stock Report"
        subtitle="Current stock levels and inventory balance"
      />

      <div className="stock-report-card">
        <div className="stock-report-controls">
          <div className="stock-report-controls-left">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search by item name, code, or category"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="search-input"
              />
              {searchText && (
                <button
                  className="clear-button"
                  onClick={() => setSearchText('')}
                >
                  ✕
                </button>
              )}
            </div>
            <select
              className="category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <button
              className="refresh-button"
              onClick={fetchStockReport}
              disabled={loading}
            >
              {loading ? 'Loading...' : '↻ Refresh'}
            </button>
          </div>
          <div className="export-buttons">
            <ExportButton
              data={exportData}
              filename="stock_report"
              buttonText="Export to Excel"
            />
            <button
              className="refresh-button"
              onClick={exportToPDF}
              style={{ marginLeft: '10px' }}
            >
              Export to PDF
            </button>
          </div>
        </div>

        <div className="date-filter-row">
          <div className="date-filter">
            <label>From Date:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="date-input"
            />
          </div>
          <div className="date-filter">
            <label>To Date:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="date-input"
            />
          </div>
          <button
            className="filter-toggle-button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            {showAdvancedFilters ? '▼' : '▶'} Advanced Filters
          </button>
          {(fromDate || toDate || selectedCategory || searchText || stockStatusFilter || minBalance || maxBalance) && (
            <button
              className="clear-all-button"
              onClick={clearAllFilters}
            >
              Clear All Filters
            </button>
          )}
        </div>

        {showAdvancedFilters && (
          <div className="advanced-filters-panel">
            <div className="filter-group">
              <label>Stock Status:</label>
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">All Status</option>
                <option value="Out of Stock">Out of Stock</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Normal">Normal</option>
                <option value="In Stock">In Stock</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Min Balance:</label>
              <input
                type="number"
                value={minBalance}
                onChange={(e) => setMinBalance(e.target.value)}
                placeholder="Min"
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>Max Balance:</label>
              <input
                type="number"
                value={maxBalance}
                onChange={(e) => setMaxBalance(e.target.value)}
                placeholder="Max"
                className="filter-input"
              />
            </div>
          </div>
        )}

        <div className="results-summary">
          Showing {filteredData?.length || 0} of {stockData?.length || 0} items
          {totalStockValue > 0 && (
            <span className="total-value"> | Total Value: ₹{totalStockValue.toFixed(2)}</span>
          )}
        </div>

        {loading ? (
          <div className="loading-spinner">Loading...</div>
        ) : (
          <>
            <div className="table-container">
              <table className="stock-report-table">
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th className="text-right">Opening Balance</th>
                    <th className="text-right">Stock In</th>
                    <th className="text-right">Stock Out</th>
                    <th className="text-right">Current Balance</th>
                    <th className="text-right">Stock Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="no-data">No data available</td>
                    </tr>
                  ) : (
                    paginatedData.map((item) => {
                      const status = getStockStatus(item.currentBalance);
                      return (
                        <tr key={item._id}>
                          <td>{item.itemCode}</td>
                          <td>{item.itemName}</td>
                          <td>{item.category}</td>
                          <td>{item.unit}</td>
                          <td className="text-right">{item.openingBalance || 0} {item.unit}</td>
                          <td className="text-right">{item.stockIn || 0} {item.unit}</td>
                          <td className="text-right">{item.stockOut || 0} {item.unit}</td>
                          <td className="text-right">{item.currentBalance || 0} {item.unit}</td>
                          <td className="text-right">
                            ₹{((item.currentBalance || 0) * (item.purchaseRate || 0)).toFixed(2)}
                          </td>
                          <td>
                            <span className="status-badge" style={{ backgroundColor: status.color }}>
                              {status.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td colSpan="8" className="text-right"><strong>Total Stock Value:</strong></td>
                    <td className="text-right"><strong>₹{totalStockValue.toFixed(2)}</strong></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="pagination-controls">
              <div className="pagination-info">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredData?.length || 0)} of {filteredData?.length || 0} items
              </div>
              <div className="pagination-buttons">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="pagination-button"
                >
                  Previous
                </button>
                <span className="pagination-pages">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="pagination-button"
                >
                  Next
                </button>
                <select
                  className="page-size-select"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StockReportView;
