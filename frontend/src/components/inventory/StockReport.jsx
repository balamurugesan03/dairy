import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';
import { stockAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';
import './StockReport.css';

const StockReport = () => {
  const navigate = useNavigate();
  const [stockBalance, setStockBalance] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalValue: 0,
    lowStock: 0
  });

  // Filter states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedCentre, setSelectedCentre] = useState('');
  const [minRate, setMinRate] = useState('');
  const [maxRate, setMaxRate] = useState('');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchStockBalance();
  }, []);

  // Apply filters whenever filter values or data changes
  useEffect(() => {
    let filtered = stockBalance;

    // Text search filter
    if (searchText) {
      filtered = filtered.filter(item =>
        item.itemName?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.itemCode?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Product filter
    if (selectedProduct) {
      filtered = filtered.filter(item =>
        item.itemName?.toLowerCase().includes(selectedProduct.toLowerCase()) ||
        item.itemCode?.toLowerCase().includes(selectedProduct.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Unit filter
    if (selectedUnit) {
      filtered = filtered.filter(item => item.unit === selectedUnit);
    }

    // Centre filter (if available in data)
    if (selectedCentre) {
      filtered = filtered.filter(item => item.centre === selectedCentre || item.issueCentre === selectedCentre);
    }

    // Date range filter (based on updatedAt or createdAt)
    if (fromDate || toDate) {
      filtered = filtered.filter(item => {
        if (!item.updatedAt && !item.createdAt) return true;
        const itemDate = dayjs(item.updatedAt || item.createdAt);
        if (fromDate && itemDate.isBefore(dayjs(fromDate), 'day')) return false;
        if (toDate && itemDate.isAfter(dayjs(toDate), 'day')) return false;
        return true;
      });
    }

    // Rate range filter (using salesRate or purchaseRate)
    if (minRate !== '' || maxRate !== '') {
      filtered = filtered.filter(item => {
        const rate = item.salesRate || item.purchaseRate || 0;
        if (minRate !== '' && rate < Number(minRate)) return false;
        if (maxRate !== '' && rate > Number(maxRate)) return false;
        return true;
      });
    }

    setFilteredData(filtered);

    // Update stats based on filtered data
    const totalItems = filtered.length;
    const totalValue = filtered.reduce((sum, item) => sum + (item.currentBalance * item.salesRate), 0);
    const lowStock = filtered.filter(item => item.currentBalance < 10).length;
    setStats({ totalItems, totalValue, lowStock });
  }, [stockBalance, searchText, selectedProduct, selectedCategory, selectedUnit, selectedCentre, fromDate, toDate, minRate, maxRate]);

  const fetchStockBalance = async () => {
    setLoading(true);
    try {
      const response = await stockAPI.getBalance();
      const data = response.data || [];
      setStockBalance(data);
      setFilteredData(data);

      const totalItems = data.length;
      const totalValue = data.reduce((sum, item) => sum + (item.currentBalance * item.salesRate), 0);
      const lowStock = data.filter(item => item.currentBalance < 10).length;

      setStats({ totalItems, totalValue, lowStock });
    } catch (error) {
      message.error(error.message || 'Failed to fetch stock balance');
      setStockBalance([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

  // Get unique values for filter dropdowns
  const categories = [...new Set(stockBalance.map(item => item.category).filter(Boolean))];
  const units = [...new Set(stockBalance.map(item => item.unit).filter(Boolean))];
  const centres = [...new Set(stockBalance.map(item => item.centre || item.issueCentre).filter(Boolean))];

  // Clear all filters
  const clearAllFilters = () => {
    setSearchText('');
    setSelectedProduct('');
    setSelectedCategory('');
    setSelectedUnit('');
    setSelectedCentre('');
    setFromDate('');
    setToDate('');
    setMinRate('');
    setMaxRate('');
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text('Stock Report', 14, 20);

    // Add filters info
    doc.setFontSize(10);
    let yPosition = 30;

    if (fromDate || toDate) {
      const dateRange = `Date Range: ${fromDate ? dayjs(fromDate).format('DD/MM/YYYY') : 'Start'} - ${toDate ? dayjs(toDate).format('DD/MM/YYYY') : 'End'}`;
      doc.text(dateRange, 14, yPosition);
      yPosition += 6;
    }
    if (selectedCategory) {
      doc.text(`Category: ${selectedCategory}`, 14, yPosition);
      yPosition += 6;
    }
    if (selectedUnit) {
      doc.text(`Unit: ${selectedUnit}`, 14, yPosition);
      yPosition += 6;
    }
    if (selectedCentre) {
      doc.text(`Centre: ${selectedCentre}`, 14, yPosition);
      yPosition += 6;
    }
    if (minRate || maxRate) {
      doc.text(`Rate Range: ₹${minRate || 0} - ₹${maxRate || 'Max'}`, 14, yPosition);
      yPosition += 6;
    }
    if (selectedProduct) {
      doc.text(`Product: ${selectedProduct}`, 14, yPosition);
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
      item.currentBalance,
      `₹${item.purchaseRate?.toFixed(2) || 0}`,
      `₹${item.salesRate?.toFixed(2) || 0}`,
      `₹${(item.currentBalance * item.salesRate).toFixed(2)}`,
      getStatusText(item.currentBalance)
    ]);

    // Add table
    doc.autoTable({
      head: [[
        'Code',
        'Item Name',
        'Category',
        'Unit',
        'Balance',
        'Purchase',
        'Sales',
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
        7: { halign: 'right' }
      },
      foot: [[
        { content: 'Total Stock Value:', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `₹${stats.totalValue.toFixed(2)}`, styles: { fontStyle: 'bold' } },
        ''
      ]],
      footStyles: { fillColor: [240, 240, 240], textColor: 0 }
    });

    // Save the PDF
    const filename = `stock_report_${dayjs().format('YYYYMMDD_HHmmss')}.pdf`;
    doc.save(filename);
    message.success('PDF exported successfully');
  };

  const getBalanceClass = (balance) => {
    if (balance < 10) return 'tag-red';
    if (balance < 50) return 'tag-orange';
    return 'tag-green';
  };

  const getStatusText = (balance) => {
    if (balance < 10) return 'Low Stock';
    if (balance < 50) return 'Moderate';
    return 'Good';
  };

  const getStatusClass = (balance) => {
    if (balance < 10) return 'tag-error';
    if (balance < 50) return 'tag-warning';
    return 'tag-success';
  };

  const exportData = filteredData.map(item => ({
    'Item Code': item.itemCode,
    'Item Name': item.itemName,
    'Category': item.category,
    'Unit': item.unit,
    'Current Balance': item.currentBalance,
    'Purchase Rate': item.purchaseRate,
    'Sales Rate': item.salesRate,
    'Stock Value': (item.currentBalance * item.salesRate).toFixed(2),
    'Status': getStatusText(item.currentBalance)
  }));

  return (
    <div className="stock-report">
      <PageHeader
        title="Stock Report"
        subtitle="View current inventory stock levels"
        extra={
          <div className="header-actions">
            <button
              className="btn btn-primary"
              onClick={() => navigate('/inventory/stock-in')}
            >
              + Stock In
            </button>
            <button
              className="btn btn-danger"
              onClick={() => navigate('/inventory/stock-out')}
            >
              - Stock Out
            </button>
            <button
              className="btn btn-default"
              onClick={fetchStockBalance}
            >
              ↻ Refresh
            </button>
            <ExportButton
              data={exportData}
              filename="stock_report"
              buttonText="Export Excel"
            />
            <button
              className="btn btn-default"
              onClick={exportToPDF}
            >
              Export PDF
            </button>
          </div>
        }
      />

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Total Items</div>
          <div className="stat-value stat-blue">{stats.totalItems}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Total Stock Value</div>
          <div className="stat-value stat-green">₹{stats.totalValue.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Low Stock Items</div>
          <div className={`stat-value ${stats.lowStock > 0 ? 'stat-red' : 'stat-green'}`}>
            {stats.lowStock}
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section" style={{
        background: 'white',
        padding: '20px',
        marginBottom: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {/* Search and Basic Filters */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          marginBottom: '15px'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Search</label>
            <input
              type="text"
              placeholder="Search by name, code, category..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Unit</label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="">All Units</option>
              {units.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>

          {centres.length > 0 && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Centre</label>
              <select
                value={selectedCentre}
                onChange={(e) => setSelectedCentre(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">All Centres</option>
                {centres.map(centre => (
                  <option key={centre} value={centre}>{centre}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Advanced Filters Toggle */}
        <div style={{ marginBottom: '10px' }}>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#2980b9',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              padding: '5px 0'
            }}
          >
            {showAdvancedFilters ? '▼' : '▶'} Advanced Filters
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            padding: '15px',
            background: '#f8f9fa',
            borderRadius: '4px'
          }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Product Name/Code</label>
              <input
                type="text"
                placeholder="Filter by product..."
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Min Rate (₹)</label>
              <input
                type="number"
                placeholder="Min rate"
                value={minRate}
                onChange={(e) => setMinRate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Max Rate (₹)</label>
              <input
                type="number"
                placeholder="Max rate"
                value={maxRate}
                onChange={(e) => setMaxRate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
        )}

        {/* Clear Filters Button */}
        {(searchText || selectedCategory || selectedUnit || selectedCentre || selectedProduct || fromDate || toDate || minRate || maxRate) && (
          <div style={{ marginTop: '15px' }}>
            <button
              onClick={clearAllFilters}
              style={{
                padding: '8px 16px',
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Clear All Filters
            </button>
            <span style={{ marginLeft: '10px', color: '#7f8c8d', fontSize: '14px' }}>
              Showing {filteredData.length} of {stockBalance.length} items
            </span>
          </div>
        )}
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <table className="stock-table">
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Item Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Current Balance</th>
                <th>Purchase Rate</th>
                <th>Sales Rate</th>
                <th>Stock Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item) => (
                <tr key={item._id}>
                  <td>{item.itemCode}</td>
                  <td>{item.itemName}</td>
                  <td>{item.category}</td>
                  <td>{item.unit}</td>
                  <td>
                    <span className={`tag ${getBalanceClass(item.currentBalance)}`}>
                      {item.currentBalance} {item.unit}
                    </span>
                  </td>
                  <td>₹{item.purchaseRate?.toFixed(2) || 0}</td>
                  <td>₹{item.salesRate?.toFixed(2) || 0}</td>
                  <td>₹{(item.currentBalance * item.salesRate).toFixed(2)}</td>
                  <td>
                    <span className={`tag ${getStatusClass(item.currentBalance)}`}>
                      {getStatusText(item.currentBalance)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filteredData.length === 0 && (
          <div className="empty-state">
            {stockBalance.length === 0 ? 'No stock data available' : 'No items match the current filters'}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockReport;
