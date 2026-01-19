import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { stockAPI, itemAPI } from '../../services/api';
import { message } from '../../utils/toast';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import {
  Container,
  Grid,
  Card,
  Text,
  Title,
  Button,
  Group,
  Stack,
  Badge,
  Table,
  LoadingOverlay,
  Paper,
  SimpleGrid,
  ThemeIcon,
  Box,
  Alert
} from '@mantine/core';
import {
  IconPackage,
  IconCurrencyRupee,
  IconAlertTriangle,
  IconBan,
  IconRefresh,
  IconPackageImport,
  IconPackageExport,
  IconTransfer,
  IconSettings,
  IconClipboardList,
  IconChartBar,
  IconChartLine,
  IconTag,
  IconReload,
  IconBell
} from '@tabler/icons-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  ChartTitle,
  Tooltip,
  Legend,
  Filler
);

const StockDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    totalItems: 0,
    totalStockValue: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    totalCategories: 0,
    recentTransactions: [],
    categoryWiseStock: [],
    stockTrend: [],
    topItems: []
  });

  const [quickActions] = useState([
    { id: 1, label: 'Stock In', icon: IconPackageImport, color: 'green', route: '/inventory/stock-in' },
    { id: 2, label: 'Stock Out', icon: IconPackageExport, color: 'red', route: '/inventory/stock-out' },
    { id: 3, label: 'Transfer', icon: IconTransfer, color: 'blue', route: '/inventory/stock-transfer' },
    { id: 4, label: 'Adjustment', icon: IconSettings, color: 'orange', route: '/inventory/stock-adjustment' },
    { id: 5, label: 'Items Master', icon: IconClipboardList, color: 'violet', route: '/inventory/items' },
    { id: 6, label: 'Reports', icon: IconChartBar, color: 'teal', route: '/inventory/report' },
    { id: 7, label: 'Analytics', icon: IconChartLine, color: 'grape', route: '/inventory/analytics' },
    { id: 8, label: 'Batch Management', icon: IconTag, color: 'dark', route: '/inventory/batches' }
  ]);

  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [stockResponse, transactionsResponse] = await Promise.all([
        stockAPI.getBalance(),
        stockAPI.getTransactions({ limit: 10, sortBy: '-createdAt' })
      ]);

      const stockData = stockResponse.data || [];
      const transactions = transactionsResponse.data || [];

      // Calculate metrics
      const totalItems = stockData.length;
      const totalStockValue = stockData.reduce((sum, item) =>
        sum + (item.currentBalance * item.salesRate), 0
      );
      const lowStockItems = stockData.filter(item =>
        item.currentBalance > 0 && item.currentBalance < 10
      ).length;
      const outOfStockItems = stockData.filter(item =>
        item.currentBalance === 0
      ).length;

      // Category-wise stock
      const categoryMap = {};
      stockData.forEach(item => {
        if (!categoryMap[item.category]) {
          categoryMap[item.category] = {
            count: 0,
            value: 0,
            quantity: 0
          };
        }
        categoryMap[item.category].count += 1;
        categoryMap[item.category].value += item.currentBalance * item.salesRate;
        categoryMap[item.category].quantity += item.currentBalance;
      });

      const categoryWiseStock = Object.keys(categoryMap).map(cat => ({
        category: cat,
        ...categoryMap[cat]
      }));

      // Top 5 items by value
      const topItems = stockData
        .map(item => ({
          itemName: item.itemName,
          stockValue: item.currentBalance * item.salesRate,
          balance: item.currentBalance
        }))
        .sort((a, b) => b.stockValue - a.stockValue)
        .slice(0, 5);

      // Generate alerts
      const newAlerts = [];
      stockData.forEach(item => {
        if (item.currentBalance === 0) {
          newAlerts.push({
            type: 'critical',
            message: `${item.itemName} is out of stock`,
            itemCode: item.itemCode
          });
        } else if (item.currentBalance < 10) {
          newAlerts.push({
            type: 'warning',
            message: `${item.itemName} is running low (${item.currentBalance} ${item.unit})`,
            itemCode: item.itemCode
          });
        }
      });

      setDashboardData({
        totalItems,
        totalStockValue,
        lowStockItems,
        outOfStockItems,
        totalCategories: Object.keys(categoryMap).length,
        recentTransactions: transactions,
        categoryWiseStock,
        topItems
      });

      setAlerts(newAlerts.slice(0, 5)); // Show top 5 alerts
    } catch (error) {
      message.error(error.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Chart configurations
  const categoryChartData = {
    labels: dashboardData.categoryWiseStock.map(c => c.category),
    datasets: [{
      label: 'Stock Value (₹)',
      data: dashboardData.categoryWiseStock.map(c => c.value),
      backgroundColor: [
        'rgba(52, 152, 219, 0.7)',
        'rgba(46, 204, 113, 0.7)',
        'rgba(241, 196, 15, 0.7)',
        'rgba(231, 76, 60, 0.7)',
        'rgba(155, 89, 182, 0.7)',
        'rgba(26, 188, 156, 0.7)',
        'rgba(230, 126, 34, 0.7)'
      ],
      borderColor: [
        'rgb(52, 152, 219)',
        'rgb(46, 204, 113)',
        'rgb(241, 196, 15)',
        'rgb(231, 76, 60)',
        'rgb(155, 89, 182)',
        'rgb(26, 188, 156)',
        'rgb(230, 126, 34)'
      ],
      borderWidth: 2
    }]
  };

  const topItemsChartData = {
    labels: dashboardData.topItems.map(item => item.itemName),
    datasets: [{
      label: 'Stock Value (₹)',
      data: dashboardData.topItems.map(item => item.stockValue),
      backgroundColor: 'rgba(52, 152, 219, 0.7)',
      borderColor: 'rgb(52, 152, 219)',
      borderWidth: 2,
      borderRadius: 6
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom'
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `₹${context.parsed.toFixed(2)}`;
          }
        }
      }
    }
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `Stock Value: ₹${context.parsed.y.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => '₹' + value
        }
      }
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Container fluid p="md">
      <LoadingOverlay visible={loading} />

      {/* Header Section */}
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>Stock Dashboard</Title>
          <Text size="sm" c="dimmed">Real-time inventory overview and analytics</Text>
        </div>
        <Button
          leftSection={<IconRefresh size={16} />}
          onClick={fetchDashboardData}
          variant="light"
        >
          Refresh
        </Button>
      </Group>

      {/* Key Metrics Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="xl">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size={50} radius="md" color="blue">
              <IconPackage size={30} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Total Items
              </Text>
              <Text fw={700} size="xl">
                {dashboardData.totalItems}
              </Text>
              <Text size="xs" c="dimmed">
                {dashboardData.totalCategories} categories
              </Text>
            </div>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size={50} radius="md" color="green">
              <IconCurrencyRupee size={30} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Total Stock Value
              </Text>
              <Text fw={700} size="xl">
                {formatCurrency(dashboardData.totalStockValue)}
              </Text>
              <Text size="xs" c="dimmed">
                Current inventory worth
              </Text>
            </div>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size={50} radius="md" color="orange">
              <IconAlertTriangle size={30} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Low Stock
              </Text>
              <Text fw={700} size="xl">
                {dashboardData.lowStockItems}
              </Text>
              <Text size="xs" c="dimmed">
                Items need reorder
              </Text>
            </div>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size={50} radius="md" color="red">
              <IconBan size={30} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Out of Stock
              </Text>
              <Text fw={700} size="xl">
                {dashboardData.outOfStockItems}
              </Text>
              <Text size="xs" c="dimmed">
                Urgent attention required
              </Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Quick Actions */}
      <Card shadow="sm" padding="lg" radius="md" withBorder mb="xl">
        <Text fw={600} mb="md">Quick Actions</Text>
        <SimpleGrid cols={{ base: 2, sm: 4, lg: 8 }}>
          {quickActions.map(action => {
            const Icon = action.icon;
            return (
              <Card
                key={action.id}
                padding="md"
                radius="md"
                withBorder
                style={{ cursor: 'pointer', borderTop: `3px solid var(--mantine-color-${action.color}-6)` }}
                onClick={() => navigate(action.route)}
              >
                <Stack align="center" gap="xs">
                  <ThemeIcon size={40} radius="md" color={action.color} variant="light">
                    <Icon size={24} />
                  </ThemeIcon>
                  <Text size="sm" ta="center" fw={500}>
                    {action.label}
                  </Text>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      </Card>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder mb="xl">
          <Group justify="space-between" mb="md">
            <Group>
              <IconBell size={20} />
              <Text fw={600}>Alerts & Notifications</Text>
            </Group>
            <Badge color="red" variant="filled">{alerts.length}</Badge>
          </Group>
          <Stack gap="sm">
            {alerts.map((alert, index) => (
              <Alert
                key={index}
                variant="light"
                color={alert.type === 'critical' ? 'red' : 'orange'}
                title={alert.message}
                icon={alert.type === 'critical' ? <IconBan size={16} /> : <IconAlertTriangle size={16} />}
              >
                <Group justify="space-between">
                  <Text size="sm">Code: {alert.itemCode}</Text>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => navigate('/inventory/stock-in')}
                  >
                    Restock
                  </Button>
                </Group>
              </Alert>
            ))}
          </Stack>
        </Card>
      )}

      {/* Charts Section */}
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text fw={600} mb="md">Category Distribution</Text>
            <Box h={300}>
              {dashboardData.categoryWiseStock.length > 0 ? (
                <Doughnut data={categoryChartData} options={chartOptions} />
              ) : (
                <Text ta="center" c="dimmed" pt={100}>No data available</Text>
              )}
            </Box>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Text fw={600} mb="md">Top 5 Items by Stock Value</Text>
            <Box h={300}>
              {dashboardData.topItems.length > 0 ? (
                <Bar data={topItemsChartData} options={barChartOptions} />
              ) : (
                <Text ta="center" c="dimmed" pt={100}>No data available</Text>
              )}
            </Box>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Recent Transactions */}
      <Card shadow="sm" padding="lg" radius="md" withBorder mb="xl">
        <Group justify="space-between" mb="md">
          <Text fw={600}>Recent Transactions</Text>
          <Button
            variant="subtle"
            size="sm"
            onClick={() => navigate('/inventory/transactions')}
          >
            View All →
          </Button>
        </Group>
        {dashboardData.recentTransactions.length > 0 ? (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Item</Table.Th>
                <Table.Th>Quantity</Table.Th>
                <Table.Th>Reference</Table.Th>
                <Table.Th>Balance After</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {dashboardData.recentTransactions.map((txn, index) => (
                <Table.Tr key={index}>
                  <Table.Td>{formatDate(txn.date)}</Table.Td>
                  <Table.Td>
                    <Badge
                      color={txn.transactionType === 'Stock In' ? 'green' : 'red'}
                      variant="light"
                    >
                      {txn.transactionType}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{txn.itemId?.itemName || 'N/A'}</Table.Td>
                  <Table.Td>{txn.quantity} {txn.itemId?.unit || ''}</Table.Td>
                  <Table.Td>{txn.referenceType || 'N/A'}</Table.Td>
                  <Table.Td><strong>{txn.balanceAfter}</strong></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text ta="center" c="dimmed" py="xl">No recent transactions</Text>
        )}
      </Card>

      {/* Category Summary Table */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Text fw={600} mb="md">Category-wise Summary</Text>
        {dashboardData.categoryWiseStock.length > 0 ? (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Category</Table.Th>
                <Table.Th>Items Count</Table.Th>
                <Table.Th>Total Quantity</Table.Th>
                <Table.Th>Total Value</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {dashboardData.categoryWiseStock.map((cat, index) => (
                <Table.Tr key={index}>
                  <Table.Td>
                    <Badge variant="light">{cat.category}</Badge>
                  </Table.Td>
                  <Table.Td>{cat.count}</Table.Td>
                  <Table.Td>{cat.quantity.toFixed(2)}</Table.Td>
                  <Table.Td>{formatCurrency(cat.value)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
            <Table.Tfoot>
              <Table.Tr>
                <Table.Th><strong>Total</strong></Table.Th>
                <Table.Th><strong>{dashboardData.totalItems}</strong></Table.Th>
                <Table.Th>
                  <strong>
                    {dashboardData.categoryWiseStock.reduce((sum, c) => sum + c.quantity, 0).toFixed(2)}
                  </strong>
                </Table.Th>
                <Table.Th><strong>{formatCurrency(dashboardData.totalStockValue)}</strong></Table.Th>
              </Table.Tr>
            </Table.Tfoot>
          </Table>
        ) : (
          <Text ta="center" c="dimmed" py="xl">No category data available</Text>
        )}
      </Card>
    </Container>
  );
};

export default StockDashboard;
