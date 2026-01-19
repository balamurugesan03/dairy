// import { useState, useEffect } from 'react';
// import { message } from '../../utils/toast';
// import { useNavigate } from 'react-router-dom';
// import { stockAPI } from '../../services/api';
// import PageHeader from '../common/PageHeader';
// import ExportButton from '../common/ExportButton';
// import { jsPDF } from 'jspdf';
// import autoTable from 'jspdf-autotable';
// import dayjs from 'dayjs';
// import './StockReport.css';

// const StockReport = () => {
//   const navigate = useNavigate();
//   const [stockBalance, setStockBalance] = useState([]);
//   const [filteredData, setFilteredData] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [stats, setStats] = useState({
//     totalItems: 0,
//     totalValue: 0,
//     lowStock: 0
//   });

//   // Filter states
//   const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
//   const [fromDate, setFromDate] = useState('');
//   const [toDate, setToDate] = useState('');
//   const [selectedProduct, setSelectedProduct] = useState('');
//   const [selectedCategory, setSelectedCategory] = useState('');
//   const [selectedUnit, setSelectedUnit] = useState('');
//   const [selectedCentre, setSelectedCentre] = useState('');
//   const [minRate, setMinRate] = useState('');
//   const [maxRate, setMaxRate] = useState('');
//   const [searchText, setSearchText] = useState('');

//   useEffect(() => {
//     fetchStockBalance();
//   }, []);

//   // Apply filters whenever filter values or data changes
//   useEffect(() => {
//     let filtered = stockBalance;

//     // Text search filter
//     if (searchText) {
//       filtered = filtered.filter(item =>
//         item.itemName?.toLowerCase().includes(searchText.toLowerCase()) ||
//         item.itemCode?.toLowerCase().includes(searchText.toLowerCase()) ||
//         item.category?.toLowerCase().includes(searchText.toLowerCase())
//       );
//     }

//     // Product filter
//     if (selectedProduct) {
//       filtered = filtered.filter(item =>
//         item.itemName?.toLowerCase().includes(selectedProduct.toLowerCase()) ||
//         item.itemCode?.toLowerCase().includes(selectedProduct.toLowerCase())
//       );
//     }

//     // Category filter
//     if (selectedCategory) {
//       filtered = filtered.filter(item => item.category === selectedCategory);
//     }

//     // Unit filter
//     if (selectedUnit) {
//       filtered = filtered.filter(item => item.unit === selectedUnit);
//     }

//     // Centre filter (if available in data)
//     if (selectedCentre) {
//       filtered = filtered.filter(item => item.centre === selectedCentre || item.issueCentre === selectedCentre);
//     }

//     // Date range filter (based on updatedAt or createdAt)
//     if (fromDate || toDate) {
//       filtered = filtered.filter(item => {
//         if (!item.updatedAt && !item.createdAt) return true;
//         const itemDate = dayjs(item.updatedAt || item.createdAt);
//         if (fromDate && itemDate.isBefore(dayjs(fromDate), 'day')) return false;
//         if (toDate && itemDate.isAfter(dayjs(toDate), 'day')) return false;
//         return true;
//       });
//     }

//     // Rate range filter (using salesRate or purchaseRate)
//     if (minRate !== '' || maxRate !== '') {
//       filtered = filtered.filter(item => {
//         const rate = item.salesRate || item.purchaseRate || 0;
//         if (minRate !== '' && rate < Number(minRate)) return false;
//         if (maxRate !== '' && rate > Number(maxRate)) return false;
//         return true;
//       });
//     }

//     setFilteredData(filtered);

//     // Update stats based on filtered data
//     const totalItems = filtered.length;
//     const totalValue = filtered.reduce((sum, item) => sum + (item.currentBalance * item.salesRate), 0);
//     const lowStock = filtered.filter(item => item.currentBalance < 10).length;
//     setStats({ totalItems, totalValue, lowStock });
//   }, [stockBalance, searchText, selectedProduct, selectedCategory, selectedUnit, selectedCentre, fromDate, toDate, minRate, maxRate]);

//   const fetchStockBalance = async () => {
//     setLoading(true);
//     try {
//       const response = await stockAPI.getBalance();
//       const data = response.data || [];
//       setStockBalance(data);
//       setFilteredData(data);

//       const totalItems = data.length;
//       const totalValue = data.reduce((sum, item) => sum + (item.currentBalance * item.salesRate), 0);
//       const lowStock = data.filter(item => item.currentBalance < 10).length;

//       setStats({ totalItems, totalValue, lowStock });
//     } catch (error) {
//       message.error(error.message || 'Failed to fetch stock balance');
//       setStockBalance([]);
//       setFilteredData([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Get unique values for filter dropdowns
//   const categories = [...new Set(stockBalance.map(item => item.category).filter(Boolean))];
//   const units = [...new Set(stockBalance.map(item => item.unit).filter(Boolean))];
//   const centres = [...new Set(stockBalance.map(item => item.centre || item.issueCentre).filter(Boolean))];

//   // Clear all filters
//   const clearAllFilters = () => {
//     setSearchText('');
//     setSelectedProduct('');
//     setSelectedCategory('');
//     setSelectedUnit('');
//     setSelectedCentre('');
//     setFromDate('');
//     setToDate('');
//     setMinRate('');
//     setMaxRate('');
//   };

//   // Export to PDF
//   const exportToPDF = () => {
//     const doc = new jsPDF();

//     // Add title
//     doc.setFontSize(18);
//     doc.text('Stock Report', 14, 20);

//     // Add filters info
//     doc.setFontSize(10);
//     let yPosition = 30;

//     if (fromDate || toDate) {
//       const dateRange = `Date Range: ${fromDate ? dayjs(fromDate).format('DD/MM/YYYY') : 'Start'} - ${toDate ? dayjs(toDate).format('DD/MM/YYYY') : 'End'}`;
//       doc.text(dateRange, 14, yPosition);
//       yPosition += 6;
//     }
//     if (selectedCategory) {
//       doc.text(`Category: ${selectedCategory}`, 14, yPosition);
//       yPosition += 6;
//     }
//     if (selectedUnit) {
//       doc.text(`Unit: ${selectedUnit}`, 14, yPosition);
//       yPosition += 6;
//     }
//     if (selectedCentre) {
//       doc.text(`Centre: ${selectedCentre}`, 14, yPosition);
//       yPosition += 6;
//     }
//     if (minRate || maxRate) {
//       doc.text(`Rate Range: ₹${minRate || 0} - ₹${maxRate || 'Max'}`, 14, yPosition);
//       yPosition += 6;
//     }
//     if (selectedProduct) {
//       doc.text(`Product: ${selectedProduct}`, 14, yPosition);
//       yPosition += 6;
//     }

//     doc.text(`Generated: ${dayjs().format('DD/MM/YYYY HH:mm')}`, 14, yPosition);
//     yPosition += 10;

//     // Prepare table data
//     const tableData = filteredData.map(item => [
//       item.itemCode,
//       item.itemName,
//       item.category,
//       item.unit,
//       item.currentBalance,
//       `₹${item.purchaseRate?.toFixed(2) || 0}`,
//       `₹${item.salesRate?.toFixed(2) || 0}`,
//       `₹${(item.currentBalance * item.salesRate).toFixed(2)}`,
//       getStatusText(item.currentBalance)
//     ]);

//     // Add table
//     doc.autoTable({
//       head: [[
//         'Code',
//         'Item Name',
//         'Category',
//         'Unit',
//         'Balance',
//         'Purchase',
//         'Sales',
//         'Value',
//         'Status'
//       ]],
//       body: tableData,
//       startY: yPosition,
//       styles: { fontSize: 8, cellPadding: 2 },
//       headStyles: { fillColor: [41, 128, 185], textColor: 255 },
//       columnStyles: {
//         4: { halign: 'right' },
//         5: { halign: 'right' },
//         6: { halign: 'right' },
//         7: { halign: 'right' }
//       },
//       foot: [[
//         { content: 'Total Stock Value:', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
//         { content: `₹${stats.totalValue.toFixed(2)}`, styles: { fontStyle: 'bold' } },
//         ''
//       ]],
//       footStyles: { fillColor: [240, 240, 240], textColor: 0 }
//     });

//     // Save the PDF
//     const filename = `stock_report_${dayjs().format('YYYYMMDD_HHmmss')}.pdf`;
//     doc.save(filename);
//     message.success('PDF exported successfully');
//   };

//   const getBalanceClass = (balance) => {
//     if (balance < 10) return 'tag-red';
//     if (balance < 50) return 'tag-orange';
//     return 'tag-green';
//   };

//   const getStatusText = (balance) => {
//     if (balance < 10) return 'Low Stock';
//     if (balance < 50) return 'Moderate';
//     return 'Good';
//   };

//   const getStatusClass = (balance) => {
//     if (balance < 10) return 'tag-error';
//     if (balance < 50) return 'tag-warning';
//     return 'tag-success';
//   };

//   const exportData = filteredData.map(item => ({
//     'Item Code': item.itemCode,
//     'Item Name': item.itemName,
//     'Category': item.category,
//     'Unit': item.unit,
//     'Current Balance': item.currentBalance,
//     'Purchase Rate': item.purchaseRate,
//     'Sales Rate': item.salesRate,
//     'Stock Value': (item.currentBalance * item.salesRate).toFixed(2),
//     'Status': getStatusText(item.currentBalance)
//   }));

//   return (
//     <div className="stock-report">
//       <PageHeader
//         title="Stock Report"
//         subtitle="View current inventory stock levels"
//         extra={
//           <div className="header-actions">
//             <button
//               className="btn btn-primary"
//               onClick={() => navigate('/inventory/stock-in')}
//             >
//               + Stock In
//             </button>
//             <button
//               className="btn btn-danger"
//               onClick={() => navigate('/inventory/stock-out')}
//             >
//               - Stock Out
//             </button>
//             <button
//               className="btn btn-default"
//               onClick={fetchStockBalance}
//             >
//               ↻ Refresh
//             </button>
//             <ExportButton
//               data={exportData}
//               filename="stock_report"
//               buttonText="Export Excel"
//             />
//             <button
//               className="btn btn-default"
//               onClick={exportToPDF}
//             >
//               Export PDF
//             </button>
//           </div>
//         }
//       />

//       <div className="stats-grid">
//         <div className="stat-card">
//           <div className="stat-title">Total Items</div>
//           <div className="stat-value stat-blue">{stats.totalItems}</div>
//         </div>
//         <div className="stat-card">
//           <div className="stat-title">Total Stock Value</div>
//           <div className="stat-value stat-green">₹{stats.totalValue.toFixed(2)}</div>
//         </div>
//         <div className="stat-card">
//           <div className="stat-title">Low Stock Items</div>
//           <div className={`stat-value ${stats.lowStock > 0 ? 'stat-red' : 'stat-green'}`}>
//             {stats.lowStock}
//           </div>
//         </div>
//       </div>

//       {/* Filters Section */}
//       <div className="filters-section" style={{
//         background: 'white',
//         padding: '20px',
//         marginBottom: '20px',
//         borderRadius: '8px',
//         boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
//       }}>
//         {/* Search and Basic Filters */}
//         <div style={{
//           display: 'grid',
//           gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
//           gap: '15px',
//           marginBottom: '15px'
//         }}>
//           <div>
//             <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Search</label>
//             <input
//               type="text"
//               placeholder="Search by name, code, category..."
//               value={searchText}
//               onChange={(e) => setSearchText(e.target.value)}
//               style={{
//                 width: '100%',
//                 padding: '8px 12px',
//                 border: '1px solid #ddd',
//                 borderRadius: '4px',
//                 fontSize: '14px'
//               }}
//             />
//           </div>

//           <div>
//             <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Category</label>
//             <select
//               value={selectedCategory}
//               onChange={(e) => setSelectedCategory(e.target.value)}
//               style={{
//                 width: '100%',
//                 padding: '8px 12px',
//                 border: '1px solid #ddd',
//                 borderRadius: '4px',
//                 fontSize: '14px'
//               }}
//             >
//               <option value="">All Categories</option>
//               {categories.map(cat => (
//                 <option key={cat} value={cat}>{cat}</option>
//               ))}
//             </select>
//           </div>

//           <div>
//             <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Unit</label>
//             <select
//               value={selectedUnit}
//               onChange={(e) => setSelectedUnit(e.target.value)}
//               style={{
//                 width: '100%',
//                 padding: '8px 12px',
//                 border: '1px solid #ddd',
//                 borderRadius: '4px',
//                 fontSize: '14px'
//               }}
//             >
//               <option value="">All Units</option>
//               {units.map(unit => (
//                 <option key={unit} value={unit}>{unit}</option>
//               ))}
//             </select>
//           </div>

//           {centres.length > 0 && (
//             <div>
//               <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Centre</label>
//               <select
//                 value={selectedCentre}
//                 onChange={(e) => setSelectedCentre(e.target.value)}
//                 style={{
//                   width: '100%',
//                   padding: '8px 12px',
//                   border: '1px solid #ddd',
//                   borderRadius: '4px',
//                   fontSize: '14px'
//                 }}
//               >
//                 <option value="">All Centres</option>
//                 {centres.map(centre => (
//                   <option key={centre} value={centre}>{centre}</option>
//                 ))}
//               </select>
//             </div>
//           )}
//         </div>

//         {/* Advanced Filters Toggle */}
//         <div style={{ marginBottom: '10px' }}>
//           <button
//             onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
//             style={{
//               background: 'transparent',
//               border: 'none',
//               color: '#2980b9',
//               cursor: 'pointer',
//               fontSize: '14px',
//               fontWeight: '500',
//               padding: '5px 0'
//             }}
//           >
//             {showAdvancedFilters ? '▼' : '▶'} Advanced Filters
//           </button>
//         </div>

//         {/* Advanced Filters Panel */}
//         {showAdvancedFilters && (
//           <div style={{
//             display: 'grid',
//             gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
//             gap: '15px',
//             padding: '15px',
//             background: '#f8f9fa',
//             borderRadius: '4px'
//           }}>
//             <div>
//               <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>From Date</label>
//               <input
//                 type="date"
//                 value={fromDate}
//                 onChange={(e) => setFromDate(e.target.value)}
//                 style={{
//                   width: '100%',
//                   padding: '8px 12px',
//                   border: '1px solid #ddd',
//                   borderRadius: '4px',
//                   fontSize: '14px'
//                 }}
//               />
//             </div>

//             <div>
//               <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>To Date</label>
//               <input
//                 type="date"
//                 value={toDate}
//                 onChange={(e) => setToDate(e.target.value)}
//                 style={{
//                   width: '100%',
//                   padding: '8px 12px',
//                   border: '1px solid #ddd',
//                   borderRadius: '4px',
//                   fontSize: '14px'
//                 }}
//               />
//             </div>

//             <div>
//               <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Product Name/Code</label>
//               <input
//                 type="text"
//                 placeholder="Filter by product..."
//                 value={selectedProduct}
//                 onChange={(e) => setSelectedProduct(e.target.value)}
//                 style={{
//                   width: '100%',
//                   padding: '8px 12px',
//                   border: '1px solid #ddd',
//                   borderRadius: '4px',
//                   fontSize: '14px'
//                 }}
//               />
//             </div>

//             <div>
//               <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Min Rate (₹)</label>
//               <input
//                 type="number"
//                 placeholder="Min rate"
//                 value={minRate}
//                 onChange={(e) => setMinRate(e.target.value)}
//                 style={{
//                   width: '100%',
//                   padding: '8px 12px',
//                   border: '1px solid #ddd',
//                   borderRadius: '4px',
//                   fontSize: '14px'
//                 }}
//               />
//             </div>

//             <div>
//               <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Max Rate (₹)</label>
//               <input
//                 type="number"
//                 placeholder="Max rate"
//                 value={maxRate}
//                 onChange={(e) => setMaxRate(e.target.value)}
//                 style={{
//                   width: '100%',
//                   padding: '8px 12px',
//                   border: '1px solid #ddd',
//                   borderRadius: '4px',
//                   fontSize: '14px'
//                 }}
//               />
//             </div>
//           </div>
//         )}

//         {/* Clear Filters Button */}
//         {(searchText || selectedCategory || selectedUnit || selectedCentre || selectedProduct || fromDate || toDate || minRate || maxRate) && (
//           <div style={{ marginTop: '15px' }}>
//             <button
//               onClick={clearAllFilters}
//               style={{
//                 padding: '8px 16px',
//                 background: '#e74c3c',
//                 color: 'white',
//                 border: 'none',
//                 borderRadius: '4px',
//                 cursor: 'pointer',
//                 fontSize: '14px',
//                 fontWeight: '500'
//               }}
//             >
//               Clear All Filters
//             </button>
//             <span style={{ marginLeft: '10px', color: '#7f8c8d', fontSize: '14px' }}>
//               Showing {filteredData.length} of {stockBalance.length} items
//             </span>
//           </div>
//         )}
//       </div>

//       <div className="table-container">
//         {loading ? (
//           <div className="loading">Loading...</div>
//         ) : (
//           <table className="stock-table">
//             <thead>
//               <tr>
//                 <th>Item Code</th>
//                 <th>Item Name</th>
//                 <th>Category</th>
//                 <th>Unit</th>
//                 <th>Current Balance</th>
//                 <th>Purchase Rate</th>
//                 <th>Sales Rate</th>
//                 <th>Stock Value</th>
//                 <th>Status</th>
//               </tr>
//             </thead>
//             <tbody>
//               {filteredData.map((item) => (
//                 <tr key={item._id}>
//                   <td>{item.itemCode}</td>
//                   <td>{item.itemName}</td>
//                   <td>{item.category}</td>
//                   <td>{item.unit}</td>
//                   <td>
//                     <span className={`tag ${getBalanceClass(item.currentBalance)}`}>
//                       {item.currentBalance} {item.unit}
//                     </span>
//                   </td>
//                   <td>₹{item.purchaseRate?.toFixed(2) || 0}</td>
//                   <td>₹{item.salesRate?.toFixed(2) || 0}</td>
//                   <td>₹{(item.currentBalance * item.salesRate).toFixed(2)}</td>
//                   <td>
//                     <span className={`tag ${getStatusClass(item.currentBalance)}`}>
//                       {getStatusText(item.currentBalance)}
//                     </span>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         )}
//         {!loading && filteredData.length === 0 && (
//           <div className="empty-state">
//             {stockBalance.length === 0 ? 'No stock data available' : 'No items match the current filters'}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default StockReport;


import { useState, useEffect, useMemo } from 'react';
import { 
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Paper,
  Table,
  Badge,
  Select,
  TextInput,
  NumberInput,
  Card,
  SimpleGrid,
  Loader,
  Center,
  ActionIcon,
  Collapse,
  Divider,
  Box,
  useMantineTheme,
  ScrollArea,
  Grid,
  Tooltip,
  ThemeIcon,
  Progress,
  Modal,
  Menu
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconMinus,
  IconRefresh,
  IconDownload,
  IconFileTypePdf,
  IconFilter,
  IconSearch,
  IconX,
  IconPackage,
  IconCurrencyRupee,
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconEye,
  IconEdit,
  IconChartBar,
  IconTrendingUp,
  IconShoppingCart,
  IconBox,
  IconBuildingWarehouse,
  IconArrowsLeftRight,
  IconSortAscending,
  IconSortDescending,
  IconDotsVertical,
  IconHistory,
  IconReportAnalytics
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { stockAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

const StockReport = () => {
  const theme = useMantineTheme();
  const navigate = useNavigate();
  const [stockBalance, setStockBalance] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'itemName', direction: 'asc' });
  const [quickViewModal, setQuickViewModal] = useState({ opened: false, item: null });

  // Filter states
  const [filters, setFilters] = useState({
    searchText: '',
    selectedProduct: '',
    selectedCategory: '',
    selectedUnit: '',
    selectedCentre: '',
    fromDate: null,
    toDate: null,
    minRate: '',
    maxRate: '',
    minStock: '',
    maxStock: ''
  });

  // Calculate comprehensive statistics
  const stats = useMemo(() => {
    const totalItems = filteredData.length;
    const totalStockValue = filteredData.reduce((sum, item) => 
      sum + ((item.currentBalance || 0) * (item.salesRate || 0)), 0);
    
    const totalPurchaseValue = filteredData.reduce((sum, item) => 
      sum + ((item.currentBalance || 0) * (item.purchaseRate || 0)), 0);
    
    const lowStockItems = filteredData.filter(item => (item.currentBalance || 0) <= 10);
    const outOfStockItems = filteredData.filter(item => (item.currentBalance || 0) <= 0);
    const highValueItems = filteredData.filter(item => 
      ((item.currentBalance || 0) * (item.salesRate || 0)) > 10000
    );

    const avgStockValue = totalItems > 0 ? totalStockValue / totalItems : 0;
    const stockTurnover = totalItems > 0 ? 
      filteredData.filter(item => (item.monthlySales || 0) > 0).length / totalItems : 0;

    return { 
      totalItems, 
      totalStockValue, 
      totalPurchaseValue,
      lowStockItems: lowStockItems.length,
      outOfStockItems: outOfStockItems.length,
      highValueItems: highValueItems.length,
      avgStockValue,
      stockTurnover,
      items: filteredData
    };
  }, [filteredData]);

  useEffect(() => {
    fetchStockBalance();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [stockBalance, filters, sortConfig]);

  const fetchStockBalance = async () => {
    setLoading(true);
    try {
      const response = await stockAPI.getBalance();
      const data = response.data || [];
      setStockBalance(data);
      notifications.show({
        title: 'Success',
        message: `Loaded ${data.length} inventory items`,
        color: 'green',
        icon: <IconPackage size={16} />
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch stock balance',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
      setStockBalance([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...stockBalance];

    // Text search filter
    if (filters.searchText) {
      filtered = filtered.filter(item =>
        (item.itemName?.toLowerCase() || '').includes(filters.searchText.toLowerCase()) ||
        (item.itemCode?.toLowerCase() || '').includes(filters.searchText.toLowerCase()) ||
        (item.category?.toLowerCase() || '').includes(filters.searchText.toLowerCase()) ||
        (item.description?.toLowerCase() || '').includes(filters.searchText.toLowerCase())
      );
    }

    // Product filter
    if (filters.selectedProduct) {
      filtered = filtered.filter(item =>
        item.itemName?.toLowerCase() === filters.selectedProduct.toLowerCase() ||
        item.itemCode?.toLowerCase() === filters.selectedProduct.toLowerCase()
      );
    }

    // Category filter
    if (filters.selectedCategory) {
      filtered = filtered.filter(item => item.category === filters.selectedCategory);
    }

    // Unit filter
    if (filters.selectedUnit) {
      filtered = filtered.filter(item => item.unit === filters.selectedUnit);
    }

    // Centre filter
    if (filters.selectedCentre) {
      filtered = filtered.filter(item => 
        item.centre === filters.selectedCentre || item.issueCentre === filters.selectedCentre
      );
    }

    // Date range filter
    if (filters.fromDate || filters.toDate) {
      filtered = filtered.filter(item => {
        if (!item.updatedAt && !item.createdAt) return true;
        const itemDate = dayjs(item.updatedAt || item.createdAt);
        if (filters.fromDate && itemDate.isBefore(dayjs(filters.fromDate), 'day')) return false;
        if (filters.toDate && itemDate.isAfter(dayjs(filters.toDate), 'day')) return false;
        return true;
      });
    }

    // Rate range filter
    if (filters.minRate !== '' || filters.maxRate !== '') {
      filtered = filtered.filter(item => {
        const rate = item.salesRate || item.purchaseRate || 0;
        if (filters.minRate !== '' && rate < Number(filters.minRate)) return false;
        if (filters.maxRate !== '' && rate > Number(filters.maxRate)) return false;
        return true;
      });
    }

    // Stock quantity range filter
    if (filters.minStock !== '' || filters.maxStock !== '') {
      filtered = filtered.filter(item => {
        const stock = item.currentBalance || 0;
        if (filters.minStock !== '' && stock < Number(filters.minStock)) return false;
        if (filters.maxStock !== '' && stock > Number(filters.maxStock)) return false;
        return true;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === 'stockValue') {
        aValue = (a.currentBalance || 0) * (a.salesRate || 0);
        bValue = (b.currentBalance || 0) * (b.salesRate || 0);
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    setFilteredData(filtered);
  };

  // Get unique values for filter dropdowns
  const categories = useMemo(() => 
    [...new Set(stockBalance.map(item => item.category).filter(Boolean))], 
    [stockBalance]
  );
  
  const units = useMemo(() => 
    [...new Set(stockBalance.map(item => item.unit).filter(Boolean))], 
    [stockBalance]
  );
  
  const centres = useMemo(() => 
    [...new Set(stockBalance.map(item => item.centre || item.issueCentre).filter(Boolean))], 
    [stockBalance]
  );

  const clearAllFilters = () => {
    setFilters({
      searchText: '',
      selectedProduct: '',
      selectedCategory: '',
      selectedUnit: '',
      selectedCentre: '',
      fromDate: null,
      toDate: null,
      minRate: '',
      maxRate: '',
      minStock: '',
      maxStock: ''
    });
    setSortConfig({ key: 'itemName', direction: 'asc' });
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');

    // Add title and header
    doc.setFontSize(20);
    doc.setTextColor(41, 128, 185);
    doc.text('Inventory Stock Report', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${dayjs().format('DD/MM/YYYY HH:mm:ss')}`, 14, 30);
    doc.text(`Total Items: ${stats.totalItems} | Total Value: ₹${stats.totalStockValue.toFixed(2)}`, 14, 36);

    // Add summary section
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('Summary:', 14, 45);
    
    const summaryY = 50;
    doc.setFontSize(9);
    doc.text(`• Total Stock Value: ₹${stats.totalStockValue.toFixed(2)}`, 20, summaryY);
    doc.text(`• Low Stock Items: ${stats.lowStockItems}`, 20, summaryY + 5);
    doc.text(`• Out of Stock: ${stats.outOfStockItems}`, 20, summaryY + 10);
    doc.text(`• High Value Items (>₹10k): ${stats.highValueItems}`, 20, summaryY + 15);

    // Prepare table data
    const tableData = filteredData.map(item => [
      item.itemCode || '-',
      item.itemName || '-',
      item.category || '-',
      item.unit || '-',
      item.currentBalance || 0,
      `₹${(item.purchaseRate || 0).toFixed(2)}`,
      `₹${(item.salesRate || 0).toFixed(2)}`,
      `₹${((item.currentBalance || 0) * (item.salesRate || 0)).toFixed(2)}`,
      getStockLevel(item.currentBalance || 0)
    ]);

    // Add table
    autoTable(doc, {
      head: [[
        'Code',
        'Item Name',
        'Category',
        'Unit',
        'Balance',
        'Purchase Rate',
        'Sales Rate',
        'Stock Value',
        'Status'
      ]],
      body: tableData,
      startY: summaryY + 25,
      styles: { 
        fontSize: 8, 
        cellPadding: 3,
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [41, 128, 185], 
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 40 },
        2: { cellWidth: 30 },
        3: { cellWidth: 20 },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 30, halign: 'right' },
        6: { cellWidth: 30, halign: 'right' },
        7: { cellWidth: 35, halign: 'right' },
        8: { cellWidth: 25, halign: 'center' }
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248]
      },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${data.pageNumber}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10);
      }
    });

    // Save the PDF
    const filename = `inventory_report_${dayjs().format('YYYYMMDD_HHmmss')}.pdf`;
    doc.save(filename);
    
    notifications.show({
      title: 'Success',
      message: 'PDF report exported successfully',
      color: 'green',
      icon: <IconDownload size={16} />
    });
  };

  const getStockLevel = (balance) => {
    if (balance <= 0) return 'Out of Stock';
    if (balance <= 10) return 'Low Stock';
    if (balance <= 50) return 'Moderate';
    return 'Good';
  };

  const getStatusColor = (balance) => {
    if (balance <= 0) return 'red';
    if (balance <= 10) return 'orange';
    if (balance <= 50) return 'yellow';
    return 'green';
  };

  const getStockValueColor = (value) => {
    if (value > 10000) return 'red';
    if (value > 5000) return 'orange';
    if (value > 1000) return 'yellow';
    return 'blue';
  };

  const getStockPercentage = (item) => {
    const maxStock = item.maxStock || 100;
    return ((item.currentBalance || 0) / maxStock) * 100;
  };

  const exportData = filteredData.map(item => ({
    'Item Code': item.itemCode,
    'Item Name': item.itemName,
    'Category': item.category,
    'Unit': item.unit,
    'Current Balance': item.currentBalance,
    'Min Stock': item.minStock || 10,
    'Max Stock': item.maxStock || 100,
    'Purchase Rate': item.purchaseRate,
    'Sales Rate': item.salesRate,
    'Stock Value': ((item.currentBalance || 0) * (item.salesRate || 0)).toFixed(2),
    'Status': getStockLevel(item.currentBalance || 0),
    'Last Updated': item.updatedAt ? dayjs(item.updatedAt).format('DD/MM/YYYY HH:mm') : '-'
  }));

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== null && value !== '' && value !== undefined
  );

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <IconArrowsLeftRight size={14} />;
    return sortConfig.direction === 'asc' ? 
      <IconSortAscending size={14} /> : 
      <IconSortDescending size={14} />;
  };

  const QuickViewModal = () => (
    <Modal
      opened={quickViewModal.opened}
      onClose={() => setQuickViewModal({ opened: false, item: null })}
      title="Stock Item Details"
      size="lg"
    >
      {quickViewModal.item && (
        <Stack spacing="md">
          <SimpleGrid cols={2}>
            <div>
              <Text size="sm" color="dimmed">Item Code</Text>
              <Text fw={500}>{quickViewModal.item.itemCode}</Text>
            </div>
            <div>
              <Text size="sm" color="dimmed">Category</Text>
              <Text fw={500}>{quickViewModal.item.category || '-'}</Text>
            </div>
          </SimpleGrid>
          
          <div>
            <Text size="sm" color="dimmed">Item Name</Text>
            <Title order={4}>{quickViewModal.item.itemName}</Title>
          </div>

          <Divider />

          <SimpleGrid cols={3}>
            <div>
              <Text size="sm" color="dimmed">Current Stock</Text>
              <Group spacing="xs">
                <Text fw={700} size="xl">{quickViewModal.item.currentBalance || 0}</Text>
                <Text color="dimmed">{quickViewModal.item.unit}</Text>
              </Group>
            </div>
            <div>
              <Text size="sm" color="dimmed">Stock Value</Text>
              <Text fw={700} size="xl" color="green">
                ₹{((quickViewModal.item.currentBalance || 0) * (quickViewModal.item.salesRate || 0)).toFixed(2)}
              </Text>
            </div>
            <div>
              <Text size="sm" color="dimmed">Status</Text>
              <Badge 
                color={getStatusColor(quickViewModal.item.currentBalance || 0)}
                size="lg"
                variant="filled"
              >
                {getStockLevel(quickViewModal.item.currentBalance || 0)}
              </Badge>
            </div>
          </SimpleGrid>

          <SimpleGrid cols={2}>
            <div>
              <Text size="sm" color="dimmed">Purchase Rate</Text>
              <Text fw={500}>₹{(quickViewModal.item.purchaseRate || 0).toFixed(2)}</Text>
            </div>
            <div>
              <Text size="sm" color="dimmed">Sales Rate</Text>
              <Text fw={500} color="green">₹{(quickViewModal.item.salesRate || 0).toFixed(2)}</Text>
            </div>
          </SimpleGrid>

          <Progress 
            value={getStockPercentage(quickViewModal.item)} 
            size="lg"
            color={getStatusColor(quickViewModal.item.currentBalance || 0)}
            label={`${Math.round(getStockPercentage(quickViewModal.item))}% of max stock`}
            mt="md"
          />

          <Group position="right" mt="md">
            <Button 
              variant="light" 
              onClick={() => {
                setQuickViewModal({ opened: false, item: null });
                navigate(`/inventory/items/${quickViewModal.item._id}`);
              }}
              leftSection={<IconEdit size={16} />}
            >
              Edit Item
            </Button>
            <Button 
              onClick={() => {
                setQuickViewModal({ opened: false, item: null });
                navigate('/inventory/stock-in', { state: { item: quickViewModal.item } });
              }}
              leftSection={<IconPlus size={16} />}
              color="blue"
            >
              Add Stock
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );

  return (
    <Container fluid py="md">
      {/* Quick View Modal */}
      <QuickViewModal />

      {/* Header Section */}
      <Paper withBorder radius="md" p="md" mb="md" bg="blue.0">
        <Grid align="center">
          <Grid.Col span="auto">
            <Group spacing="xs">
              <ThemeIcon size="xl" color="blue" variant="light" radius="md">
                <IconBuildingWarehouse size={24} />
              </ThemeIcon>
              <div>
                <Title order={2} color="blue.7">Inventory Stock Report</Title>
                <Text color="dimmed">Comprehensive view of current inventory levels and values</Text>
              </div>
            </Group>
          </Grid.Col>
          <Grid.Col span="content">
            <Group spacing="xs">
              <Button
                leftSection={<IconReportAnalytics size={16} />}
                onClick={() => navigate('/reports/stock-analytics')}
                variant="light"
                color="grape"
              >
                Analytics
              </Button>
              <Button
                leftSection={<IconHistory size={16} />}
                onClick={() => navigate('/inventory/transactions')}
                variant="light"
                color="orange"
              >
                Transactions
              </Button>
            </Group>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Action Bar */}
      <Paper withBorder radius="md" p="md" mb="md">
        <Group position="apart">
          <Group>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => navigate('/inventory/stock-in')}
              color="green"
              size="md"
            >
              Stock In
            </Button>
            <Button
              leftSection={<IconMinus size={16} />}
              onClick={() => navigate('/inventory/stock-out')}
              color="red"
              size="md"
              variant="light"
            >
              Stock Out
            </Button>
            <Button
              leftSection={<IconBox size={16} />}
              onClick={() => navigate('/inventory/items/new')}
              color="blue"
              size="md"
              variant="light"
            >
              New Item
            </Button>
          </Group>
          
          <Group>
            <Tooltip label="Refresh Data">
              <ActionIcon 
                size="lg" 
                color="blue" 
                variant="light"
                onClick={fetchStockBalance}
                loading={loading}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            
            <ExportButton
              data={exportData}
              filename="inventory_report"
              buttonText="Excel"
              variant="light"
              size="md"
            />
            
            <Button
              leftSection={<IconFileTypePdf size={16} />}
              onClick={exportToPDF}
              variant="light"
              size="md"
              color="red"
            >
              PDF Report
            </Button>
            
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon size="lg" variant="subtle">
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Reports</Menu.Label>
                <Menu.Item icon={<IconChartBar size={14} />}>
                  Stock Analysis
                </Menu.Item>
                <Menu.Item icon={<IconTrendingUp size={14} />}>
                  Stock Trends
                </Menu.Item>
                <Menu.Item icon={<IconShoppingCart size={14} />}>
                  Reorder List
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Paper>

      {/* Filters Section */}
      <Paper withBorder radius="md" p="lg" mb="md">
        <Stack spacing="lg">
          <Group position="apart">
            <Group spacing="xs">
              <ThemeIcon color="blue" variant="light">
                <IconFilter size={18} />
              </ThemeIcon>
              <Title order={4}>Filters & Search</Title>
              {hasActiveFilters && (
                <Badge color="blue" variant="light" size="sm">
                  {filteredData.length} results
                </Badge>
              )}
            </Group>
            <Group spacing="xs">
              <Button
                variant="light"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                leftSection={showAdvancedFilters ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
              >
                {showAdvancedFilters ? 'Simple View' : 'Advanced Filters'}
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="light"
                  color="red"
                  size="sm"
                  onClick={clearAllFilters}
                  leftSection={<IconX size={14} />}
                >
                  Clear All
                </Button>
              )}
            </Group>
          </Group>

          {/* Quick Filters */}
          <SimpleGrid cols={4} spacing="md">
            <TextInput
              label="Search Inventory"
              placeholder="Search by name, code, category..."
              value={filters.searchText}
              onChange={(e) => updateFilter('searchText', e.target.value)}
              icon={<IconSearch size={16} />}
              rightSection={filters.searchText && (
                <ActionIcon size="xs" onClick={() => updateFilter('searchText', '')}>
                  <IconX size={14} />
                </ActionIcon>
              )}
            />

            <Select
              label="Category"
              placeholder="All Categories"
              value={filters.selectedCategory}
              onChange={(value) => updateFilter('selectedCategory', value)}
              data={categories.map(cat => ({ value: cat, label: cat }))}
              clearable
              searchable
            />

            <Select
              label="Unit"
              placeholder="All Units"
              value={filters.selectedUnit}
              onChange={(value) => updateFilter('selectedUnit', value)}
              data={units.map(unit => ({ value: unit, label: unit }))}
              clearable
            />

            <Select
              label="Stock Status"
              placeholder="All Status"
              onChange={(value) => {
                if (value === 'low') updateFilter('maxStock', '10');
                else if (value === 'out') updateFilter('maxStock', '0');
                else {
                  updateFilter('minStock', '');
                  updateFilter('maxStock', '');
                }
              }}
              data={[
                { value: 'all', label: 'All Status' },
                { value: 'good', label: 'Good Stock' },
                { value: 'low', label: 'Low Stock (≤10)' },
                { value: 'out', label: 'Out of Stock' }
              ]}
              clearable
            />
          </SimpleGrid>

          {/* Advanced Filters */}
          <Collapse in={showAdvancedFilters}>
            <Divider my="sm" />
            <SimpleGrid cols={4} spacing="md">
              <DateInput
                label="From Date"
                value={filters.fromDate}
                onChange={(value) => updateFilter('fromDate', value)}
                maxDate={filters.toDate || undefined}
                clearable
                placeholder="Start date"
              />

              <DateInput
                label="To Date"
                value={filters.toDate}
                onChange={(value) => updateFilter('toDate', value)}
                minDate={filters.fromDate || undefined}
                clearable
                placeholder="End date"
              />

              <NumberInput
                label="Min Stock Qty"
                placeholder="Minimum quantity"
                value={filters.minStock}
                onChange={(value) => updateFilter('minStock', value)}
                min={0}
                precision={0}
              />

              <NumberInput
                label="Max Stock Qty"
                placeholder="Maximum quantity"
                value={filters.maxStock}
                onChange={(value) => updateFilter('maxStock', value)}
                min={0}
                precision={0}
              />

              <NumberInput
                label="Min Rate (₹)"
                placeholder="Minimum rate"
                value={filters.minRate}
                onChange={(value) => updateFilter('minRate', value)}
                min={0}
                step={0.01}
                precision={2}
              />

              <NumberInput
                label="Max Rate (₹)"
                placeholder="Maximum rate"
                value={filters.maxRate}
                onChange={(value) => updateFilter('maxRate', value)}
                min={0}
                step={0.01}
                precision={2}
              />

              <Select
                label="Centre"
                placeholder="All Centres"
                value={filters.selectedCentre}
                onChange={(value) => updateFilter('selectedCentre', value)}
                data={centres.map(centre => ({ value: centre, label: centre }))}
                clearable
                searchable
              />
            </SimpleGrid>
          </Collapse>
        </Stack>
      </Paper>

      {/* Data Table */}
      <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
        <ScrollArea>
          <Table verticalSpacing="md" fontSize="md" highlightOnHover>
            <thead style={{ backgroundColor: theme.colors.blue[0] }}>
              <tr>
                <th style={{ width: '60px' }}>#</th>
                <th>
                  <Button 
                    variant="subtle" 
                    size="xs" 
                    onClick={() => handleSort('itemCode')}
                    rightSection={<SortIcon columnKey="itemCode" />}
                  >
                    Code
                  </Button>
                </th>
                <th>
                  <Button 
                    variant="subtle" 
                    size="xs" 
                    onClick={() => handleSort('itemName')}
                    rightSection={<SortIcon columnKey="itemName" />}
                  >
                    Item Name
                  </Button>
                </th>
                <th>Category</th>
                <th>Unit</th>
                <th>
                  <Button 
                    variant="subtle" 
                    size="xs" 
                    onClick={() => handleSort('currentBalance')}
                    rightSection={<SortIcon columnKey="currentBalance" />}
                  >
                    Stock Qty
                  </Button>
                </th>
                <th>Purchase Rate</th>
                <th>Sales Rate</th>
                <th>
                  <Button 
                    variant="subtle" 
                    size="xs" 
                    onClick={() => handleSort('stockValue')}
                    rightSection={<SortIcon columnKey="stockValue" />}
                  >
                    Stock Value
                  </Button>
                </th>
                <th>Status</th>
                <th style={{ width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11}>
                    <Center py="xl">
                      <Stack align="center">
                        <Loader size="lg" />
                        <Text mt="md" color="dimmed">Loading inventory data...</Text>
                      </Stack>
                    </Center>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <Center py="xl">
                      <Stack align="center" spacing="xs">
                        <IconPackage size={48} color={theme.colors.gray[5]} />
                        <Text color="dimmed" size="lg">
                          {stockBalance.length === 0 ? 'No inventory data available' : 'No items match the current filters'}
                        </Text>
                        {stockBalance.length > 0 && hasActiveFilters && (
                          <Button 
                            variant="light" 
                            size="sm" 
                            onClick={clearAllFilters}
                            mt="sm"
                          >
                            Clear filters
                          </Button>
                        )}
                      </Stack>
                    </Center>
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr key={item._id || index}>
                    <td>
                      <Text size="sm" color="dimmed">{index + 1}</Text>
                    </td>
                    <td>
                      <Badge variant="light" color="blue">
                        {item.itemCode}
                      </Badge>
                    </td>
                    <td>
                      <Text fw={500}>{item.itemName}</Text>
                      {item.description && (
                        <Text size="xs" color="dimmed" lineClamp={1}>
                          {item.description}
                        </Text>
                      )}
                    </td>
                    <td>
                      <Badge variant="outline" color="gray">
                        {item.category || '-'}
                      </Badge>
                    </td>
                    <td>
                      <Text fw={500}>{item.unit || '-'}</Text>
                    </td>
                    <td>
                      <Group spacing="xs">
                        <Text fw={600} size="lg">
                          {item.currentBalance || 0}
                        </Text>
                        <Progress 
                          value={getStockPercentage(item)} 
                          size="sm" 
                          style={{ flex: 1 }}
                          color={getStatusColor(item.currentBalance || 0)}
                        />
                      </Group>
                    </td>
                    <td>
                      <Text fw={500}>₹{(item.purchaseRate || 0).toFixed(2)}</Text>
                    </td>
                    <td>
                      <Text fw={600} color="green">₹{(item.salesRate || 0).toFixed(2)}</Text>
                    </td>
                    <td>
                      <Badge 
                        color={getStockValueColor((item.currentBalance || 0) * (item.salesRate || 0))}
                        variant="light"
                        size="lg"
                      >
                        ₹{((item.currentBalance || 0) * (item.salesRate || 0)).toFixed(2)}
                      </Badge>
                    </td>
                    <td>
                      <Badge 
                        color={getStatusColor(item.currentBalance || 0)} 
                        variant="filled"
                        size="md"
                        radius="sm"
                      >
                        {getStockLevel(item.currentBalance || 0)}
                      </Badge>
                    </td>
                    <td>
                      <Group spacing="xs" wrap="nowrap">
                        <Tooltip label="Quick View">
                          <ActionIcon 
                            color="blue" 
                            variant="light"
                            onClick={() => setQuickViewModal({ opened: true, item })}
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Edit">
                          <ActionIcon 
                            color="orange" 
                            variant="light"
                            onClick={() => navigate(`/inventory/items/${item._id}`)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Stock In">
                          <ActionIcon 
                            color="green" 
                            variant="light"
                            onClick={() => navigate('/inventory/stock-in', { state: { item } })}
                          >
                            <IconPlus size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </ScrollArea>
      </Paper>

      {/* Footer Stats */}
      {filteredData.length > 0 && (
        <Paper withBorder radius="md" mt="md" p="md" bg="gray.0">
          <Group position="apart">
            <Group spacing="lg">
              <div>
                <Text size="sm" color="dimmed">Showing</Text>
                <Text fw={600}>{filteredData.length} of {stockBalance.length} items</Text>
              </div>
              <Divider orientation="vertical" />
              <div>
                <Text size="sm" color="dimmed">Total Value</Text>
                <Text fw={600} color="green">₹{stats.totalStockValue.toLocaleString('en-IN')}</Text>
              </div>
              <Divider orientation="vertical" />
              <div>
                <Text size="sm" color="dimmed">Low Stock Items</Text>
                <Text fw={600} color="orange">{stats.lowStockItems}</Text>
              </div>
              <Divider orientation="vertical" />
              <div>
                <Text size="sm" color="dimmed">Avg Stock Value</Text>
                <Text fw={600}>₹{(stats.avgStockValue || 0).toFixed(2)}</Text>
              </div>
            </Group>
            <Text size="sm" color="dimmed">
              Last updated: {dayjs().format('DD MMM YYYY, HH:mm')}
            </Text>
          </Group>
        </Paper>
      )}
    </Container>
  );
};

export default StockReport;