// import { useState, useEffect } from 'react';
// import { message } from '../../utils/toast';
// import { useNavigate } from 'react-router-dom';
// import dayjs from 'dayjs';
// import { salesAPI } from '../../services/api';
// import PageHeader from '../common/PageHeader';
// import ExportButton from '../common/ExportButton';
// import { showConfirmDialog } from '../common/ConfirmDialog';
// import './SalesList.css';


// const SalesList = () => {
//   const navigate = useNavigate();
//   const [sales, setSales] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [filters, setFilters] = useState({
//     dateRange: null,
//     status: ''
//   });

//   useEffect(() => {
//     fetchSales();
//   }, []);

//   const fetchSales = async () => {
//     setLoading(true);
//     try {
//       const response = await salesAPI.getAll();
//       setSales(response.data);
//     } catch (error) {
//       message.error(error.message || 'Failed to fetch sales');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleDelete = async (id) => {
//     showConfirmDialog({
//       title: 'Delete Sale',
//       content: 'Are you sure you want to delete this sale? This will reverse the stock.',
//       type: 'danger',
//       onConfirm: async () => {
//         try {
//           await salesAPI.delete(id);
//           message.success('Sale deleted successfully');
//           fetchSales();
//         } catch (error) {
//           message.error(error.message || 'Failed to delete sale');
//         }
//       }
//     });
//   };

//   const getStatusClass = (status) => {
//     if (status === 'Paid') return 'status-paid';
//     if (status === 'Partial') return 'status-partial';
//     if (status === 'Pending') return 'status-pending';
//     return 'status-default';
//   };

//   const getCustomerTypeClass = (type) => {
//     return type === 'Farmer' ? 'type-farmer' : 'type-retailer';
//   };

//   const filteredSales = sales.filter(sale => {
//     if (filters.status && sale.status !== filters.status) return false;
//     if (filters.dateRange) {
//       const [startDate, endDate] = filters.dateRange;
//       if (startDate && endDate) {
//         const saleDate = dayjs(sale.billDate);
//         if (saleDate.isBefore(startDate, 'day') || saleDate.isAfter(endDate, 'day')) {
//           return false;
//         }
//       }
//     }
//     return true;
//   });

//   const exportData = filteredSales.map(sale => ({
//     'Bill No': sale.billNumber,
//     'Bill Date': dayjs(sale.billDate).format('DD-MM-YYYY'),
//     'Customer': sale.customerName,
//     'Phone': sale.customerPhone,
//     'Customer Type': sale.customerType,
//     'Grand Total': sale.grandTotal,
//     'Paid Amount': sale.paidAmount,
//     'Balance': sale.balanceAmount,
//     'Payment Mode': sale.paymentMode,
//     'Status': sale.status
//   }));

//   return (
//     <div className="sales-list-container">
//       <PageHeader
//         title="Sales Management"
//         subtitle="View and manage sales bills"
//         extra={[
//           <button
//             key="add"
//             className="btn btn-primary"
//             onClick={() => navigate('/sales/create')}
//           >
//             + Create Bill
//           </button>,
//           <ExportButton
//             key="export"
//             data={exportData}
//             filename="sales_report"
//             buttonText="Export"
//           />
//         ]}
//       />

//       <div className="filters-container">
//         <div className="date-range-filter">
//           <label>Start Date:</label>
//           <input
//             type="date"
//             value={filters.dateRange?.[0] ? dayjs(filters.dateRange[0]).format('YYYY-MM-DD') : ''}
//             onChange={(e) => {
//               const startDate = e.target.value ? dayjs(e.target.value) : null;
//               setFilters(prev => ({
//                 ...prev,
//                 dateRange: [startDate, prev.dateRange?.[1] || null]
//               }));
//             }}
//           />
//           <label>End Date:</label>
//           <input
//             type="date"
//             value={filters.dateRange?.[1] ? dayjs(filters.dateRange[1]).format('YYYY-MM-DD') : ''}
//             onChange={(e) => {
//               const endDate = e.target.value ? dayjs(e.target.value) : null;
//               setFilters(prev => ({
//                 ...prev,
//                 dateRange: [prev.dateRange?.[0] || null, endDate]
//               }));
//             }}
//           />
//         </div>
//         <select
//           className="status-filter"
//           value={filters.status}
//           onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
//         >
//           <option value="">All Status</option>
//           <option value="Paid">Paid</option>
//           <option value="Partial">Partial</option>
//           <option value="Pending">Pending</option>
//         </select>
//       </div>

//       <div className="table-container">
//         {loading ? (
//           <div className="loading">Loading...</div>
//         ) : (
//           <table className="sales-table">
//             <thead>
//               <tr>
//                 <th>Bill No.</th>
//                 <th>Bill Date</th>
//                 <th>Customer</th>
//                 <th>Phone</th>
//                 <th>Customer Type</th>
//                 <th>Grand Total</th>
//                 <th>Paid Amount</th>
//                 <th>Balance</th>
//                 <th>Payment Mode</th>
//                 <th>Status</th>
//                 <th>Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {filteredSales.length === 0 ? (
//                 <tr>
//                   <td colSpan="11" className="no-data">No sales found</td>
//                 </tr>
//               ) : (
//                 filteredSales.map((sale) => (
//                   <tr key={sale._id}>
//                     <td>{sale.billNumber}</td>
//                     <td>{dayjs(sale.billDate).format('DD-MM-YYYY')}</td>
//                     <td>{sale.customerName}</td>
//                     <td>{sale.customerPhone}</td>
//                     <td>
//                       <span className={`tag ${getCustomerTypeClass(sale.customerType)}`}>
//                         {sale.customerType}
//                       </span>
//                     </td>
//                     <td>₹{sale.grandTotal?.toFixed(2) || 0}</td>
//                     <td>₹{sale.paidAmount?.toFixed(2) || 0}</td>
//                     <td>
//                       <span style={{ color: sale.balanceAmount > 0 ? 'red' : 'green' }}>
//                         ₹{sale.balanceAmount?.toFixed(2) || 0}
//                       </span>
//                     </td>
//                     <td>{sale.paymentMode}</td>
//                     <td>
//                       <span className={`tag ${getStatusClass(sale.status)}`}>
//                         {sale.status}
//                       </span>
//                     </td>
//                     <td>
//                       <div className="actions">
//                         <button
//                           className="btn btn-link"
//                           onClick={() => navigate(`/sales/view/${sale._id}`)}
//                         >
//                           View
//                         </button>
//                         <button
//                           className="btn btn-link btn-danger"
//                           onClick={() => handleDelete(sale._id)}
//                         >
//                           Delete
//                         </button>
//                       </div>
//                     </td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         )}
//       </div>
//     </div>
//   );
// };

// export default SalesList;


import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Paper,
  Table,
  Select,
  Badge,
  Loader,
  Center,
  ActionIcon,
  Box,
  useMantineTheme,
  Grid,
  Card,
  SimpleGrid,
  Divider,
  TextInput,
  ScrollArea,
  Modal,
  NumberInput,
  Kbd,
  Tooltip,
  Switch,
  Tabs,
  Avatar,
  Menu,
  Input
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconTrash,
  IconEye,
  IconDownload,
  IconCalendar,
  IconFilter,
  IconReceipt,
  IconUser,
  IconPhone,
  IconCash,
  IconCurrencyRupee,
  IconAlertCircle,
  IconRefresh,
  IconFileTypePdf,
  IconQrcode,
  IconSearch,
  IconPrinter,
  IconChevronRight,
  IconEdit,
  IconReceiptRefund,
  IconClock,
  IconCheck,
  IconX,
  IconFilterOff,
  IconArrowsSort,
  IconList,
  IconGridDots,
  IconDotsVertical,
  IconBarcode,
  IconReceipt2,
  IconChartBar,
  IconTrendingUp,
  IconTrendingDown
} from '@tabler/icons-react';
import { salesAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ExportButton from '../common/ExportButton';
import { showConfirmDialog } from '../common/ConfirmDialog';

const SalesList = () => {
  const theme = useMantineTheme();
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [quickSearch, setQuickSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [viewModalOpened, setViewModalOpened] = useState(false);
  const [printModalOpened, setPrintModalOpened] = useState(false);
  const [statsTimeRange, setStatsTimeRange] = useState('today'); // today, week, month, year

  const form = useForm({
    initialValues: {
      dateRange: null,
      status: '',
      paymentMode: '',
      customerType: '',
      minAmount: '',
      maxAmount: '',
      quickFilter: 'all' // all, today, yesterday, week, month
    }
  });

  useEffect(() => {
    fetchSales();
    // Focus search input on mount
    if (searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const response = await salesAPI.getAll();
      setSales(response.data || []);
      notifications.show({
        title: 'Success',
        message: 'Sales data refreshed',
        color: 'green',
        icon: <IconCheck size={16} />
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch sales',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    showConfirmDialog({
      title: 'Delete Sale',
      content: 'Are you sure you want to delete this sale? This will reverse the stock.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await salesAPI.delete(id);
          notifications.show({
            title: 'Success',
            message: 'Sale deleted successfully',
            color: 'green',
            icon: <IconTrash size={16} />
          });
          fetchSales();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: error.message || 'Failed to delete sale',
            color: 'red',
            icon: <IconAlertCircle size={16} />
          });
        }
      }
    });
  };

  const handleViewDetails = (sale) => {
    setSelectedSale(sale);
    setViewModalOpened(true);
  };

  const handlePrintReceipt = (sale) => {
    setSelectedSale(sale);
    setPrintModalOpened(true);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'green';
      case 'partial': return 'yellow';
      case 'pending': return 'red';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid': return <IconCheck size={12} />;
      case 'partial': return <IconClock size={12} />;
      case 'pending': return <IconAlertCircle size={12} />;
      default: return null;
    }
  };

  const getPaymentModeColor = (mode) => {
    switch (mode?.toLowerCase()) {
      case 'cash': return 'green';
      case 'card': return 'blue';
      case 'upi': return 'violet';
      case 'credit': return 'orange';
      default: return 'gray';
    }
  };

  const getCustomerTypeColor = (type) => {
    return type === 'Farmer' ? 'blue' : 'orange';
  };

  // Apply all filters
  const filteredSales = sales.filter(sale => {
    const values = form.values;
    const saleDate = dayjs(sale.billDate);
    const today = dayjs().startOf('day');
    
    // Quick time filters
    if (values.quickFilter !== 'all') {
      switch (values.quickFilter) {
        case 'today':
          if (!saleDate.isSame(today, 'day')) return false;
          break;
        case 'yesterday':
          if (!saleDate.isSame(today.subtract(1, 'day'), 'day')) return false;
          break;
        case 'week':
          if (saleDate.isBefore(today.subtract(7, 'day'))) return false;
          break;
        case 'month':
          if (saleDate.isBefore(today.subtract(30, 'day'))) return false;
          break;
      }
    }

    // Custom date range
    if (values.dateRange) {
      const [startDate, endDate] = values.dateRange;
      if (startDate && saleDate.isBefore(dayjs(startDate), 'day')) return false;
      if (endDate && saleDate.isAfter(dayjs(endDate), 'day')) return false;
    }

    // Status filter
    if (values.status && sale.status !== values.status) return false;

    // Payment mode filter
    if (values.paymentMode && sale.paymentMode !== values.paymentMode) return false;

    // Customer type filter
    if (values.customerType && sale.customerType !== values.customerType) return false;

    // Amount range filter
    if (values.minAmount && sale.grandTotal < parseFloat(values.minAmount)) return false;
    if (values.maxAmount && sale.grandTotal > parseFloat(values.maxAmount)) return false;

    // Quick search
    if (quickSearch) {
      const searchTerm = quickSearch.toLowerCase();
      const matches = 
        (sale.billNumber || '').toLowerCase().includes(searchTerm) ||
        (sale.customerName || '').toLowerCase().includes(searchTerm) ||
        (sale.customerPhone || '').includes(searchTerm) ||
        (sale._id || '').toLowerCase().includes(searchTerm);
      if (!matches) return false;
    }

    return true;
  });

  // Calculate statistics
  const calculateStats = (salesData) => {
    const now = dayjs();
    let filteredStats = salesData;

    if (statsTimeRange === 'today') {
      filteredStats = salesData.filter(s => dayjs(s.billDate).isSame(now, 'day'));
    } else if (statsTimeRange === 'week') {
      filteredStats = salesData.filter(s => dayjs(s.billDate).isAfter(now.subtract(7, 'day')));
    } else if (statsTimeRange === 'month') {
      filteredStats = salesData.filter(s => dayjs(s.billDate).isAfter(now.subtract(30, 'day')));
    }

    return {
      count: filteredStats.length,
      amount: filteredStats.reduce((sum, s) => sum + (s.grandTotal || 0), 0),
      paid: filteredStats.reduce((sum, s) => sum + (s.paidAmount || 0), 0),
      balance: filteredStats.reduce((sum, s) => sum + (s.balanceAmount || 0), 0),
      avgBill: filteredStats.length > 0 ? filteredStats.reduce((sum, s) => sum + (s.grandTotal || 0), 0) / filteredStats.length : 0
    };
  };

  const stats = calculateStats(filteredSales);
  const allTimeStats = calculateStats(sales);

  // Sort sales by date (newest first)
  const sortedSales = [...filteredSales].sort((a, b) => 
    dayjs(b.billDate).valueOf() - dayjs(a.billDate).valueOf()
  );

  // Get recent sales (last 5)
  const recentSales = sortedSales.slice(0, 5);

  const clearFilters = () => {
    form.reset();
    setQuickSearch('');
  };

  const handleQuickFilter = (filter) => {
    form.setFieldValue('quickFilter', filter);
  };

  const exportData = filteredSales.map(sale => ({
    'Bill No': sale.billNumber || `BILL-${sale._id.slice(-6)}`,
    'Bill Date': dayjs(sale.billDate).format('DD-MM-YYYY HH:mm'),
    'Customer': sale.customerName,
    'Phone': sale.customerPhone,
    'Customer Type': sale.customerType,
    'Grand Total': sale.grandTotal?.toFixed(2),
    'Paid Amount': sale.paidAmount?.toFixed(2),
    'Balance': sale.balanceAmount?.toFixed(2),
    'Payment Mode': sale.paymentMode,
    'Status': sale.status,
    'Items Count': sale.items?.length || 0
  }));

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  // Format time
  const formatTime = (date) => {
    return dayjs(date).format('hh:mm A');
  };

  // Format date
  const formatDate = (date) => {
    return dayjs(date).format('DD MMM YYYY');
  };

  const hasActiveFilters = form.values.quickFilter !== 'all' || 
    form.values.dateRange || 
    form.values.status || 
    form.values.paymentMode || 
    form.values.customerType || 
    form.values.minAmount || 
    form.values.maxAmount || 
    quickSearch;

  return (
    <Container size="xl" py="md">
      <PageHeader
        title="POS Sales Dashboard"
        subtitle="Real-time sales monitoring and management"
        extra={
          <Group spacing="xs">
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => navigate('/sales/create')}
              color="green"
              size="sm"
            >
              New Bill
            </Button>
            <Button
              leftSection={<IconReceipt size={16} />}
              onClick={() => navigate('/sales')}
              variant="light"
              color="blue"
              size="sm"
            >
              All Sales
            </Button>
          </Group>
        }
      />

      {/* Quick Stats Bar */}
      <Paper withBorder radius="md" p="md" mb="md">
        <Group position="apart">
          <Group spacing="lg">
            <Button.Group>
              <Button
                variant={statsTimeRange === 'today' ? 'filled' : 'light'}
                onClick={() => setStatsTimeRange('today')}
                size="xs"
                color="blue"
              >
                Today
              </Button>
              <Button
                variant={statsTimeRange === 'week' ? 'filled' : 'light'}
                onClick={() => setStatsTimeRange('week')}
                size="xs"
                color="blue"
              >
                Week
              </Button>
              <Button
                variant={statsTimeRange === 'month' ? 'filled' : 'light'}
                onClick={() => setStatsTimeRange('month')}
                size="xs"
                color="blue"
              >
                Month
              </Button>
            </Button.Group>
          </Group>
          <Group spacing="xs">
            <Button
              leftSection={<IconRefresh size={14} />}
              onClick={fetchSales}
              variant="light"
              size="xs"
              loading={loading}
            >
              Refresh
            </Button>
            <ExportButton
              data={exportData}
              filename={`sales_${dayjs().format('YYYYMMDD')}`}
              buttonText="Export"
              variant="light"
              size="xs"
            />
          </Group>
        </Group>

        <SimpleGrid cols={4} spacing="md" mt="md">
          <Card withBorder radius="sm" p="sm">
            <Group position="apart">
              <div>
                <Text size="xs" color="dimmed">Total Bills</Text>
                <Text fw={700} size="xl">{stats.count}</Text>
              </div>
              <Avatar color="blue" radius="sm" variant="light">
                <IconReceipt size={20} />
              </Avatar>
            </Group>
            <Text size="xs" color="dimmed" mt={4}>
              {allTimeStats.count} total
            </Text>
          </Card>

          <Card withBorder radius="sm" p="sm">
            <Group position="apart">
              <div>
                <Text size="xs" color="dimmed">Total Amount</Text>
                <Text fw={700} size="xl">{formatCurrency(stats.amount)}</Text>
              </div>
              <Avatar color="green" radius="sm" variant="light">
                <IconCurrencyRupee size={20} />
              </Avatar>
            </Group>
            <Text size="xs" color="dimmed" mt={4}>
              Avg: {formatCurrency(stats.avgBill)}
            </Text>
          </Card>

          <Card withBorder radius="sm" p="sm">
            <Group position="apart">
              <div>
                <Text size="xs" color="dimmed">Paid Amount</Text>
                <Text fw={700} size="xl">{formatCurrency(stats.paid)}</Text>
              </div>
              <Avatar color="teal" radius="sm" variant="light">
                <IconCash size={20} />
              </Avatar>
            </Group>
            <Group spacing={4} mt={4}>
              <Text size="xs" color="dimmed">Collection:</Text>
              <Text size="xs" color="green" fw={500}>
                {stats.amount > 0 ? ((stats.paid / stats.amount) * 100).toFixed(1) : 0}%
              </Text>
            </Group>
          </Card>

          <Card withBorder radius="sm" p="sm">
            <Group position="apart">
              <div>
                <Text size="xs" color="dimmed">Balance Due</Text>
                <Text fw={700} size="xl">{formatCurrency(stats.balance)}</Text>
              </div>
              <Avatar color={stats.balance > 0 ? "orange" : "gray"} radius="sm" variant="light">
                <IconAlertCircle size={20} />
              </Avatar>
            </Group>
            <Group spacing={4} mt={4}>
              <Text size="xs" color="dimmed">Pending Bills:</Text>
              <Text size="xs" color="orange" fw={500}>
                {filteredSales.filter(s => s.balanceAmount > 0).length}
              </Text>
            </Group>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* Main Content Area */}
      <Grid gutter="md">
        {/* Left Panel - Recent Sales & Quick Actions */}
        <Grid.Col span={4}>
          <Stack spacing="md">
            {/* Quick Search */}
            <Paper withBorder radius="md" p="md">
              <Stack spacing="sm">
                <Group position="apart">
                  <Text fw={600} size="sm">Quick Search</Text>
                  <ActionIcon
                    size="sm"
                    variant="light"
                    color="blue"
                    onClick={() => setQuickSearch('')}
                    disabled={!quickSearch}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
                <TextInput
                  ref={searchInputRef}
                  placeholder="Search bill number, customer, phone..."
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  icon={<IconSearch size={16} />}
                  rightSection={
                    <Kbd size="xs" mr="xs">
                      /
                    </Kbd>
                  }
                  size="sm"
                />
              </Stack>
            </Paper>

            {/* Quick Filters */}
            <Paper withBorder radius="md" p="md">
              <Stack spacing="sm">
                <Text fw={600} size="sm">Quick Filters</Text>
                <Group spacing="xs" grow>
                  <Button
                    variant={form.values.quickFilter === 'today' ? 'filled' : 'light'}
                    onClick={() => handleQuickFilter('today')}
                    size="xs"
                    color="blue"
                  >
                    Today
                  </Button>
                  <Button
                    variant={form.values.quickFilter === 'yesterday' ? 'filled' : 'light'}
                    onClick={() => handleQuickFilter('yesterday')}
                    size="xs"
                    color="blue"
                  >
                    Yesterday
                  </Button>
                  <Button
                    variant={form.values.quickFilter === 'week' ? 'filled' : 'light'}
                    onClick={() => handleQuickFilter('week')}
                    size="xs"
                    color="blue"
                  >
                    Week
                  </Button>
                </Group>
              </Stack>
            </Paper>

            {/* Recent Sales */}
            <Paper withBorder radius="md" p="md">
              <Stack spacing="sm">
                <Group position="apart">
                  <Text fw={600} size="sm">Recent Sales</Text>
                  <Badge size="sm" variant="light">
                    {recentSales.length}
                  </Badge>
                </Group>
                <ScrollArea style={{ height: 300 }}>
                  <Stack spacing="xs">
                    {recentSales.map((sale) => (
                      <Card 
                        key={sale._id} 
                        withBorder 
                        radius="sm" 
                        p="xs"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleViewDetails(sale)}
                      >
                        <Group position="apart" wrap="nowrap">
                          <div style={{ flex: 1 }}>
                            <Group spacing="xs" wrap="nowrap">
                              <Text size="sm" fw={500} lineClamp={1}>
                                {sale.billNumber || `BILL-${sale._id.slice(-6)}`}
                              </Text>
                              <Badge 
                                color={getStatusColor(sale.status)} 
                                size="xs"
                                variant="light"
                              >
                                {sale.status}
                              </Badge>
                            </Group>
                            <Text size="xs" color="dimmed">
                              {sale.customerName} • {formatTime(sale.billDate)}
                            </Text>
                          </div>
                          <Text fw={600} size="sm">
                            {formatCurrency(sale.grandTotal)}
                          </Text>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                </ScrollArea>
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>

        {/* Right Panel - Sales List */}
        <Grid.Col span={8}>
          <Paper withBorder radius="md" style={{ height: '100%' }}>
            <Stack spacing={0} style={{ height: '100%' }}>
              {/* Table Header */}
              <Group position="apart" p="md" style={{ borderBottom: `1px solid ${theme.colors.gray[3]}` }}>
                <Group spacing="xs">
                  <IconReceipt2 size={20} />
                  <Text fw={600}>Sales Bills</Text>
                  <Badge variant="light" color="blue">
                    {filteredSales.length}
                  </Badge>
                </Group>
                <Group spacing="xs">
                  {hasActiveFilters && (
                    <Button
                      variant="light"
                      color="red"
                      size="xs"
                      leftSection={<IconFilterOff size={14} />}
                      onClick={clearFilters}
                    >
                      Clear Filters
                    </Button>
                  )}
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconFilter size={14} />}
                    onClick={() => {/* Open advanced filters modal */}}
                  >
                    More Filters
                  </Button>
                  <Button.Group>
                    <Button
                      variant={viewMode === 'grid' ? 'filled' : 'light'}
                      onClick={() => setViewMode('grid')}
                      size="xs"
                      px={8}
                    >
                      <IconGridDots size={14} />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'filled' : 'light'}
                      onClick={() => setViewMode('list')}
                      size="xs"
                      px={8}
                    >
                      <IconList size={14} />
                    </Button>
                  </Button.Group>
                </Group>
              </Group>

              {/* Sales Table/Grid */}
              <ScrollArea style={{ flex: 1 }}>
                {viewMode === 'list' ? (
                  // List View
                  <Table verticalSpacing="xs" fontSize="sm" highlightOnHover>
                    <thead>
                      <tr>
                        <th>Bill No.</th>
                        <th>Time</th>
                        <th>Customer</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Payment</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSales.map((sale) => (
                        <tr key={sale._id}>
                          <td>
                            <Text fw={500} size="sm">
                              {sale.billNumber || `BILL-${sale._id.slice(-6)}`}
                            </Text>
                          </td>
                          <td>
                            <Text size="sm">{formatTime(sale.billDate)}</Text>
                            <Text size="xs" color="dimmed">{formatDate(sale.billDate)}</Text>
                          </td>
                          <td>
                            <Text size="sm" fw={500}>{sale.customerName}</Text>
                            <Text size="xs" color="dimmed">{sale.customerPhone || 'No phone'}</Text>
                          </td>
                          <td>
                            <Text fw={600} size="sm">
                              {formatCurrency(sale.grandTotal)}
                            </Text>
                            {sale.balanceAmount > 0 && (
                              <Text size="xs" color="orange">
                                Due: {formatCurrency(sale.balanceAmount)}
                              </Text>
                            )}
                          </td>
                          <td>
                            <Badge
                              color={getStatusColor(sale.status)}
                              variant="light"
                              size="sm"
                              leftSection={getStatusIcon(sale.status)}
                            >
                              {sale.status}
                            </Badge>
                          </td>
                          <td>
                            <Badge
                              color={getPaymentModeColor(sale.paymentMode)}
                              variant="light"
                              size="sm"
                            >
                              {sale.paymentMode}
                            </Badge>
                          </td>
                          <td>
                            <Group spacing={4} wrap="nowrap">
                              <Tooltip label="View details">
                                <ActionIcon
                                  color="blue"
                                  variant="light"
                                  size="sm"
                                  onClick={() => handleViewDetails(sale)}
                                >
                                  <IconEye size={14} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Print receipt">
                                <ActionIcon
                                  color="green"
                                  variant="light"
                                  size="sm"
                                  onClick={() => handlePrintReceipt(sale)}
                                >
                                  <IconPrinter size={14} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Delete">
                                <ActionIcon
                                  color="red"
                                  variant="light"
                                  size="sm"
                                  onClick={() => handleDelete(sale._id)}
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  // Grid View
                  <SimpleGrid cols={2} spacing="md" p="md">
                    {sortedSales.map((sale) => (
                      <Card key={sale._id} withBorder radius="md" shadow="sm">
                        <Stack spacing="xs">
                          <Group position="apart">
                            <Badge
                              color={getStatusColor(sale.status)}
                              variant="light"
                              size="sm"
                            >
                              {sale.status}
                            </Badge>
                            <Text size="xs" color="dimmed">
                              {formatTime(sale.billDate)}
                            </Text>
                          </Group>
                          
                          <Group position="apart">
                            <div>
                              <Text fw={600} size="sm">
                                {sale.billNumber || `BILL-${sale._id.slice(-6)}`}
                              </Text>
                              <Text size="xs" color="dimmed">{sale.customerName}</Text>
                            </div>
                            <Text fw={700} size="lg" color="blue">
                              {formatCurrency(sale.grandTotal)}
                            </Text>
                          </Group>

                          <Divider />

                          <Group position="apart">
                            <Badge
                              color={getPaymentModeColor(sale.paymentMode)}
                              variant="light"
                              size="xs"
                            >
                              {sale.paymentMode}
                            </Badge>
                            {sale.balanceAmount > 0 && (
                              <Text size="xs" color="orange" fw={500}>
                                Due: {formatCurrency(sale.balanceAmount)}
                              </Text>
                            )}
                          </Group>

                          <Group grow>
                            <Button
                              variant="light"
                              size="xs"
                              leftSection={<IconEye size={12} />}
                              onClick={() => handleViewDetails(sale)}
                            >
                              View
                            </Button>
                            <Button
                              variant="light"
                              size="xs"
                              leftSection={<IconPrinter size={12} />}
                              onClick={() => handlePrintReceipt(sale)}
                            >
                              Print
                            </Button>
                          </Group>
                        </Stack>
                      </Card>
                    ))}
                  </SimpleGrid>
                )}
              </ScrollArea>

              {/* Table Footer */}
              {!loading && filteredSales.length > 0 && (
                <Group position="apart" p="md" style={{ borderTop: `1px solid ${theme.colors.gray[3]}` }}>
                  <Text size="sm" color="dimmed">
                    Showing {Math.min(filteredSales.length, 50)} of {filteredSales.length} bills
                  </Text>
                  <Group spacing="lg">
                    <Group spacing="xs">
                      <Text size="sm" color="dimmed">Total:</Text>
                      <Text fw={600}>{formatCurrency(stats.amount)}</Text>
                    </Group>
                    <Group spacing="xs">
                      <Text size="sm" color="dimmed">Paid:</Text>
                      <Text fw={600} color="green">{formatCurrency(stats.paid)}</Text>
                    </Group>
                    <Group spacing="xs">
                      <Text size="sm" color="dimmed">Balance:</Text>
                      <Text fw={600} color="orange">{formatCurrency(stats.balance)}</Text>
                    </Group>
                  </Group>
                </Group>
              )}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* View Details Modal */}
      <Modal
        opened={viewModalOpened}
        onClose={() => setViewModalOpened(false)}
        title="Sale Details"
        size="lg"
        centered
      >
        {selectedSale && (
          <Stack>
            <Card withBorder>
              <Group position="apart">
                <div>
                  <Text fw={700} size="lg">{selectedSale.billNumber || `BILL-${selectedSale._id.slice(-6)}`}</Text>
                  <Text size="sm" color="dimmed">
                    {formatDate(selectedSale.billDate)} • {formatTime(selectedSale.billDate)}
                  </Text>
                </div>
                <Badge
                  color={getStatusColor(selectedSale.status)}
                  size="lg"
                  variant="light"
                >
                  {selectedSale.status}
                </Badge>
              </Group>
            </Card>

            <Grid gutter="md">
              <Grid.Col span={6}>
                <Text size="sm" color="dimmed">Customer</Text>
                <Text fw={500}>{selectedSale.customerName}</Text>
                {selectedSale.customerPhone && (
                  <Text size="sm" color="dimmed">{selectedSale.customerPhone}</Text>
                )}
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" color="dimmed">Payment Mode</Text>
                <Badge
                  color={getPaymentModeColor(selectedSale.paymentMode)}
                  variant="light"
                >
                  {selectedSale.paymentMode}
                </Badge>
              </Grid.Col>
            </Grid>

            <Divider />

            <Text fw={600} size="sm">Items</Text>
            <Table fontSize="sm">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(selectedSale.items || []).map((item, index) => (
                  <tr key={index}>
                    <td>{item.itemName}</td>
                    <td>{item.quantity} {item.unit}</td>
                    <td>{formatCurrency(item.rate)}</td>
                    <td>{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <Divider />

            <Group position="apart">
              <Stack spacing={4}>
                <Text size="sm" color="dimmed">Subtotal</Text>
                <Text size="sm" color="dimmed">Tax</Text>
                <Text fw={600} size="lg">Total</Text>
                <Text size="sm" color="dimmed">Paid</Text>
                <Text size="sm" color="dimmed">Balance</Text>
              </Stack>
              <Stack spacing={4} style={{ textAlign: 'right' }}>
                <Text size="sm">{formatCurrency(selectedSale.subtotal)}</Text>
                <Text size="sm">{formatCurrency(selectedSale.totalGst || 0)}</Text>
                <Text fw={600} size="lg">{formatCurrency(selectedSale.grandTotal)}</Text>
                <Text size="sm" color="green">{formatCurrency(selectedSale.paidAmount)}</Text>
                <Text size="sm" color={selectedSale.balanceAmount > 0 ? "orange" : "green"}>
                  {formatCurrency(selectedSale.balanceAmount)}
                </Text>
              </Stack>
            </Group>

            <Group position="right" mt="md">
              <Button
                variant="light"
                leftSection={<IconPrinter size={16} />}
                onClick={() => {
                  setViewModalOpened(false);
                  handlePrintReceipt(selectedSale);
                }}
              >
                Print Receipt
              </Button>
              <Button
                color="blue"
                onClick={() => {
                  setViewModalOpened(false);
                  navigate(`/sales/view/${selectedSale._id}`);
                }}
              >
                Full Details
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Print Modal */}
      <Modal
        opened={printModalOpened}
        onClose={() => setPrintModalOpened(false)}
        title="Print Receipt"
        size="sm"
        centered
      >
        <Stack>
          <Text size="sm">Print receipt for {selectedSale?.billNumber}?</Text>
          <Group position="right">
            <Button
              variant="light"
              onClick={() => setPrintModalOpened(false)}
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconPrinter size={16} />}
              onClick={() => {
                // Implement print functionality
                setPrintModalOpened(false);
                notifications.show({
                  title: 'Printing',
                  message: 'Receipt sent to printer',
                  color: 'blue'
                });
              }}
            >
              Print
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default SalesList;