import { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  Text,
  Group,
  Stack,
  Title,
  Paper,
  Badge,
  ThemeIcon,
  Progress,
  Table,
  ActionIcon,
  Tooltip,
  Skeleton,
  Alert,
  RingProgress,
  SimpleGrid,
  Divider,
  Box
} from '@mantine/core';
import {
  IconUsers,
  IconPackage,
  IconReceipt,
  IconCurrencyRupee,
  IconTrendingUp,
  IconTrendingDown,
  IconShoppingCart,
  IconAlertTriangle,
  IconBuildingStore,
  IconMilk,
  IconUserPlus,
  IconCash,
  IconArrowRight,
  IconRefresh,
  IconChartBar,
  IconClipboardList,
  IconBuildingWarehouse,
  IconUserCheck,
  IconCalendarStats,
  IconReportMoney
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import AnalyticCard from '../components/common/AnalyticCard';
import BarChart from '../components/common/charts/BarChart';
import {
  farmerAPI,
  customerAPI,
  salesAPI,
  itemAPI,
  stockAPI,
  advanceAPI,
  employeeAPI,
  collectionCenterAPI
} from '../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const { selectedCompany, selectedBusinessType } = useCompany();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState({
    farmers: { total: 0, active: 0, trend: 0 },
    customers: { total: 0, trend: 0 },
    sales: { total: 0, todayCount: 0, todayAmount: 0, trend: 0 },
    inventory: { totalItems: 0, lowStock: 0, outOfStock: 0, totalValue: 0 },
    advances: { total: 0, pendingAmount: 0 },
    employees: { total: 0, active: 0 },
    collectionCenters: { total: 0, active: 0 }
  });
  const [recentSales, setRecentSales] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [salesChartData, setSalesChartData] = useState(null);

  const isDairyCooperative = selectedBusinessType === 'Dairy Cooperative Society';

  useEffect(() => {
    loadDashboardData();
  }, [selectedCompany]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadMetrics(),
        loadRecentSales(),
        loadLowStockItems(),
        loadSalesChart()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const loadMetrics = async () => {
    try {
      const [
        farmersRes,
        customersRes,
        salesRes,
        itemsRes,
        stockRes,
        advancesRes,
        employeesRes,
        centersRes
      ] = await Promise.allSettled([
        farmerAPI.getAll({ limit: 1 }),
        customerAPI.getAll({ limit: 1 }),
        salesAPI.getAll({ limit: 10 }),
        itemAPI.getAll(),
        stockAPI.getBalance(),
        advanceAPI.getAll({ status: 'Active' }),
        employeeAPI.getAll({ limit: 1 }),
        collectionCenterAPI.getAll()
      ]);

      // Process farmers
      const farmersData = farmersRes.status === 'fulfilled' ? farmersRes.value : {};
      const activeFarmers = farmersData.data?.filter(f => f.isMembership === 'Active').length || 0;

      // Process customers
      const customersData = customersRes.status === 'fulfilled' ? customersRes.value : {};

      // Process sales
      const salesData = salesRes.status === 'fulfilled' ? salesRes.value : {};
      const sales = salesData.data || [];
      const today = new Date().toISOString().split('T')[0];
      const todaySales = sales.filter(s => s.billDate?.split('T')[0] === today);
      const todayAmount = todaySales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);

      // Process items and stock
      const itemsData = itemsRes.status === 'fulfilled' ? itemsRes.value : {};
      const items = itemsData.data || [];
      const stockData = stockRes.status === 'fulfilled' ? stockRes.value : {};
      const stockItems = stockData.data || [];

      let lowStockCount = 0;
      let outOfStockCount = 0;
      let totalStockValue = 0;

      stockItems.forEach(item => {
        const balance = item.currentBalance || 0;
        const rate = item.salesRate || item.purchaseRate || 0;
        totalStockValue += balance * rate;

        if (balance === 0) outOfStockCount++;
        else if (balance <= (item.reorderLevel || 10)) lowStockCount++;
      });

      // Process advances
      const advancesData = advancesRes.status === 'fulfilled' ? advancesRes.value : {};
      const advances = advancesData.data || [];
      const pendingAdvanceAmount = advances.reduce((sum, a) => sum + (a.balanceAmount || 0), 0);

      // Process employees
      const employeesData = employeesRes.status === 'fulfilled' ? employeesRes.value : {};
      const activeEmployees = employeesData.data?.filter(e => e.status === 'Active').length || 0;

      // Process collection centers
      const centersData = centersRes.status === 'fulfilled' ? centersRes.value : {};
      const centers = centersData.data || [];
      const activeCenters = centers.filter(c => c.status === 'Active').length;

      setMetrics({
        farmers: {
          total: farmersData.pagination?.total || farmersData.data?.length || 0,
          active: activeFarmers,
          trend: 5
        },
        customers: {
          total: customersData.pagination?.total || customersData.data?.length || 0,
          trend: 3
        },
        sales: {
          total: salesData.pagination?.total || sales.length,
          todayCount: todaySales.length,
          todayAmount: todayAmount,
          trend: 8
        },
        inventory: {
          totalItems: items.length,
          lowStock: lowStockCount,
          outOfStock: outOfStockCount,
          totalValue: totalStockValue
        },
        advances: {
          total: advances.length,
          pendingAmount: pendingAdvanceAmount
        },
        employees: {
          total: employeesData.pagination?.total || employeesData.data?.length || 0,
          active: activeEmployees
        },
        collectionCenters: {
          total: centers.length,
          active: activeCenters
        }
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  const loadRecentSales = async () => {
    try {
      const response = await salesAPI.getAll({ limit: 5, sort: '-createdAt' });
      if (response.success) {
        setRecentSales(response.data || []);
      }
    } catch (error) {
      console.error('Error loading recent sales:', error);
    }
  };

  const loadLowStockItems = async () => {
    try {
      const response = await stockAPI.getBalance();
      if (response.success) {
        const items = response.data || [];
        const lowStock = items
          .filter(item => {
            const balance = item.currentBalance || 0;
            return balance > 0 && balance <= (item.reorderLevel || 10);
          })
          .slice(0, 5);
        setLowStockItems(lowStock);
      }
    } catch (error) {
      console.error('Error loading low stock items:', error);
    }
  };

  const loadSalesChart = async () => {
    try {
      const response = await salesAPI.getAll({ limit: 100 });
      if (response.success) {
        const sales = response.data || [];

        // Group sales by date (last 7 days)
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          last7Days.push(date.toISOString().split('T')[0]);
        }

        const salesByDate = last7Days.map(date => {
          const daySales = sales.filter(s => s.billDate?.split('T')[0] === date);
          return daySales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
        });

        const labels = last7Days.map(date => {
          const d = new Date(date);
          return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
        });

        setSalesChartData({
          labels,
          datasets: [
            {
              label: 'Sales (₹)',
              data: salesByDate,
              backgroundColor: 'rgba(34, 139, 230, 0.7)',
              borderColor: 'rgba(34, 139, 230, 1)',
              borderWidth: 1,
              borderRadius: 4
            }
          ]
        });
      }
    } catch (error) {
      console.error('Error loading sales chart:', error);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'green';
      case 'partial': return 'yellow';
      case 'pending': return 'red';
      default: return 'gray';
    }
  };

  if (loading) {
    return (
      <Container size="xl" py="md">
        <Stack gap="lg">
          <Skeleton height={40} width={200} />
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} height={120} radius="md" />
            ))}
          </SimpleGrid>
          <Grid>
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Skeleton height={350} radius="md" />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Skeleton height={350} radius="md" />
            </Grid.Col>
          </Grid>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>Dashboard</Title>
            <Text c="dimmed" size="sm">
              Welcome to {selectedCompany?.companyName || 'Dairy Cooperative Management System'}
            </Text>
          </div>
          <Group>
            <Badge size="lg" variant="light" color={isDairyCooperative ? 'blue' : 'violet'}>
              {selectedBusinessType || 'Dairy Cooperative Society'}
            </Badge>
            <Tooltip label="Refresh Data">
              <ActionIcon
                variant="light"
                size="lg"
                onClick={handleRefresh}
                loading={refreshing}
              >
                <IconRefresh size={20} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Key Metrics */}
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
          {isDairyCooperative && (
            <AnalyticCard
              title="Total Farmers"
              value={metrics.farmers.total}
              icon={<IconUsers size={20} />}
              color="green"
              trend={{ direction: 'up', value: metrics.farmers.trend }}
              subtitle={`${metrics.farmers.active} Active Members`}
              onClick={() => navigate('/farmers')}
            />
          )}

          <AnalyticCard
            title="Total Customers"
            value={metrics.customers.total}
            icon={<IconShoppingCart size={20} />}
            color="blue"
            trend={{ direction: 'up', value: metrics.customers.trend }}
            onClick={() => navigate('/customers')}
          />

          <AnalyticCard
            title="Today's Sales"
            value={formatCurrency(metrics.sales.todayAmount)}
            icon={<IconReceipt size={20} />}
            color="teal"
            subtitle={`${metrics.sales.todayCount} Bills Today`}
            onClick={() => navigate('/sales')}
          />

          <AnalyticCard
            title="Stock Value"
            value={formatCurrency(metrics.inventory.totalValue)}
            icon={<IconPackage size={20} />}
            color="orange"
            subtitle={`${metrics.inventory.totalItems} Items`}
            onClick={() => navigate('/inventory/stock')}
          />
        </SimpleGrid>

        {/* Secondary Metrics - Colorful Cards */}
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
          <Card
            shadow="lg"
            padding="lg"
            radius="lg"
            style={{
              background: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
              border: 'none',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              style={{
                position: 'absolute',
                top: '-15px',
                right: '-15px',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
              }}
            />
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={600} c="white">Inventory Status</Text>
              <ThemeIcon size="lg" radius="md" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <IconBuildingWarehouse size={18} color="white" />
              </ThemeIcon>
            </Group>
            <Group gap="xl">
              <div>
                <Text size="xl" fw={700} c="white">{metrics.inventory.lowStock}</Text>
                <Text size="xs" c="rgba(255,255,255,0.8)">Low Stock</Text>
              </div>
              <div>
                <Text size="xl" fw={700} c="white">{metrics.inventory.outOfStock}</Text>
                <Text size="xs" c="rgba(255,255,255,0.8)">Out of Stock</Text>
              </div>
            </Group>
          </Card>

          <Card
            shadow="lg"
            padding="lg"
            radius="lg"
            style={{
              background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
              border: 'none',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              style={{
                position: 'absolute',
                top: '-15px',
                right: '-15px',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
              }}
            />
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={600} c="white">Active Advances</Text>
              <ThemeIcon size="lg" radius="md" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <IconCash size={18} color="white" />
              </ThemeIcon>
            </Group>
            <Text size="xl" fw={700} c="white">{metrics.advances.total}</Text>
            <Text size="xs" c="rgba(255,255,255,0.8)">
              Pending: {formatCurrency(metrics.advances.pendingAmount)}
            </Text>
          </Card>

          {isDairyCooperative && (
            <Card
              shadow="lg"
              padding="lg"
              radius="lg"
              style={{
                background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                border: 'none',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Box
                style={{
                  position: 'absolute',
                  top: '-15px',
                  right: '-15px',
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                }}
              />
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={600} c="white">Collection Centers</Text>
                <ThemeIcon size="lg" radius="md" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <IconMilk size={18} color="white" />
                </ThemeIcon>
              </Group>
              <Text size="xl" fw={700} c="white">{metrics.collectionCenters.total}</Text>
              <Text size="xs" c="rgba(255,255,255,0.8)">
                {metrics.collectionCenters.active} Active
              </Text>
            </Card>
          )}

          <Card
            shadow="lg"
            padding="lg"
            radius="lg"
            style={{
              background: 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)',
              border: 'none',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              style={{
                position: 'absolute',
                top: '-15px',
                right: '-15px',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
              }}
            />
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={600} c="white">Employees</Text>
              <ThemeIcon size="lg" radius="md" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <IconUserCheck size={18} color="white" />
              </ThemeIcon>
            </Group>
            <Text size="xl" fw={700} c="white">{metrics.employees.total}</Text>
            <Text size="xs" c="rgba(255,255,255,0.8)">
              {metrics.employees.active} Active
            </Text>
          </Card>
        </SimpleGrid>

        {/* Charts and Tables */}
        <Grid>
          {/* Sales Chart */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder h="100%">
              <Group justify="space-between" mb="md">
                <Group>
                  <ThemeIcon size="lg" variant="light" color="blue">
                    <IconChartBar size={20} />
                  </ThemeIcon>
                  <div>
                    <Text fw={600}>Sales Overview</Text>
                    <Text size="xs" c="dimmed">Last 7 days</Text>
                  </div>
                </Group>
                <ActionIcon variant="subtle" onClick={() => navigate('/reports')}>
                  <IconArrowRight size={18} />
                </ActionIcon>
              </Group>
              {salesChartData ? (
                <BarChart
                  data={salesChartData}
                  height={280}
                  options={{
                    plugins: {
                      legend: { display: false }
                    }
                  }}
                />
              ) : (
                <Box
                  h={280}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Text c="dimmed">No sales data available</Text>
                </Box>
              )}
            </Card>
          </Grid.Col>

          {/* Quick Stats */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder h="100%">
              <Group justify="space-between" mb="md">
                <Group>
                  <ThemeIcon size="lg" variant="light" color="green">
                    <IconReportMoney size={20} />
                  </ThemeIcon>
                  <Text fw={600}>Business Summary</Text>
                </Group>
              </Group>

              <Stack gap="lg">
                <div>
                  <Group justify="space-between" mb={4}>
                    <Text size="sm" c="dimmed">Total Sales</Text>
                    <Text size="sm" fw={600}>{metrics.sales.total}</Text>
                  </Group>
                  <Progress value={75} color="blue" size="sm" />
                </div>

                <div>
                  <Group justify="space-between" mb={4}>
                    <Text size="sm" c="dimmed">Stock Health</Text>
                    <Text size="sm" fw={600}>
                      {metrics.inventory.totalItems > 0
                        ? Math.round(((metrics.inventory.totalItems - metrics.inventory.lowStock - metrics.inventory.outOfStock) / metrics.inventory.totalItems) * 100)
                        : 0}%
                    </Text>
                  </Group>
                  <Progress
                    value={metrics.inventory.totalItems > 0
                      ? ((metrics.inventory.totalItems - metrics.inventory.lowStock - metrics.inventory.outOfStock) / metrics.inventory.totalItems) * 100
                      : 0}
                    color="green"
                    size="sm"
                  />
                </div>

                {isDairyCooperative && (
                  <div>
                    <Group justify="space-between" mb={4}>
                      <Text size="sm" c="dimmed">Active Farmers</Text>
                      <Text size="sm" fw={600}>
                        {metrics.farmers.total > 0
                          ? Math.round((metrics.farmers.active / metrics.farmers.total) * 100)
                          : 0}%
                      </Text>
                    </Group>
                    <Progress
                      value={metrics.farmers.total > 0
                        ? (metrics.farmers.active / metrics.farmers.total) * 100
                        : 0}
                      color="teal"
                      size="sm"
                    />
                  </div>
                )}

                <Divider />

                <RingProgress
                  size={140}
                  thickness={14}
                  roundCaps
                  label={
                    <Text ta="center" size="sm" fw={600}>
                      Inventory
                    </Text>
                  }
                  sections={[
                    {
                      value: metrics.inventory.totalItems > 0
                        ? ((metrics.inventory.totalItems - metrics.inventory.lowStock - metrics.inventory.outOfStock) / metrics.inventory.totalItems) * 100
                        : 0,
                      color: 'green',
                      tooltip: 'In Stock'
                    },
                    {
                      value: metrics.inventory.totalItems > 0
                        ? (metrics.inventory.lowStock / metrics.inventory.totalItems) * 100
                        : 0,
                      color: 'yellow',
                      tooltip: 'Low Stock'
                    },
                    {
                      value: metrics.inventory.totalItems > 0
                        ? (metrics.inventory.outOfStock / metrics.inventory.totalItems) * 100
                        : 0,
                      color: 'red',
                      tooltip: 'Out of Stock'
                    }
                  ]}
                  mx="auto"
                />
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Recent Sales and Low Stock */}
        <Grid>
          {/* Recent Sales */}
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="md">
                <Group>
                  <ThemeIcon size="lg" variant="light" color="teal">
                    <IconClipboardList size={20} />
                  </ThemeIcon>
                  <Text fw={600}>Recent Sales</Text>
                </Group>
                <ActionIcon variant="subtle" onClick={() => navigate('/sales')}>
                  <IconArrowRight size={18} />
                </ActionIcon>
              </Group>

              {recentSales.length > 0 ? (
                <Table.ScrollContainer minWidth={500}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Bill No.</Table.Th>
                        <Table.Th>Customer</Table.Th>
                        <Table.Th>Amount</Table.Th>
                        <Table.Th>Status</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {recentSales.map((sale) => (
                        <Table.Tr key={sale._id}>
                          <Table.Td>{sale.billNumber}</Table.Td>
                          <Table.Td>{sale.customername || sale.customerName || '-'}</Table.Td>
                          <Table.Td fw={500}>{formatCurrency(sale.grandTotal)}</Table.Td>
                          <Table.Td>
                            <Badge
                              color={getStatusColor(sale.status)}
                              variant="light"
                              size="sm"
                            >
                              {sale.status}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              ) : (
                <Text c="dimmed" ta="center" py="xl">
                  No recent sales found
                </Text>
              )}
            </Card>
          </Grid.Col>

          {/* Low Stock Alert */}
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group justify="space-between" mb="md">
                <Group>
                  <ThemeIcon size="lg" variant="light" color="orange">
                    <IconAlertTriangle size={20} />
                  </ThemeIcon>
                  <Text fw={600}>Low Stock Alert</Text>
                </Group>
                <ActionIcon variant="subtle" onClick={() => navigate('/inventory/stock')}>
                  <IconArrowRight size={18} />
                </ActionIcon>
              </Group>

              {lowStockItems.length > 0 ? (
                <Stack gap="sm">
                  {lowStockItems.map((item) => (
                    <Paper
                      key={item._id}
                      p="sm"
                      withBorder
                      style={{ backgroundColor: 'var(--mantine-color-yellow-0)' }}
                    >
                      <Group justify="space-between">
                        <div>
                          <Text size="sm" fw={500}>{item.itemName}</Text>
                          <Text size="xs" c="dimmed">{item.category}</Text>
                        </div>
                        <Badge color="yellow" variant="filled">
                          {item.currentBalance} {item.unit}
                        </Badge>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Alert
                  icon={<IconPackage size={20} />}
                  color="green"
                  variant="light"
                >
                  All items are well stocked!
                </Alert>
              )}
            </Card>
          </Grid.Col>
        </Grid>

        {/* Quick Actions - Colorful Buttons */}
        <Card shadow="sm" padding="lg" radius="lg" withBorder>
          <Text fw={600} mb="md" size="lg">Quick Actions</Text>
          <SimpleGrid cols={{ base: 2, xs: 3, md: 6 }} spacing="md">
            {isDairyCooperative && (
              <Paper
                p="md"
                radius="lg"
                style={{
                  cursor: 'pointer',
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, rgba(17, 153, 142, 0.1) 0%, rgba(56, 239, 125, 0.1) 100%)',
                  border: '1px solid rgba(17, 153, 142, 0.2)',
                  transition: 'all 0.3s ease',
                }}
                onClick={() => navigate('/farmers')}
                className="quick-action-card"
              >
                <ThemeIcon
                  size={48}
                  radius="xl"
                  style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}
                  mx="auto"
                  mb="sm"
                >
                  <IconUserPlus size={24} color="white" />
                </ThemeIcon>
                <Text size="sm" fw={600}>Add Farmer</Text>
              </Paper>
            )}

            <Paper
              p="md"
              radius="lg"
              style={{
                cursor: 'pointer',
                textAlign: 'center',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                border: '1px solid rgba(102, 126, 234, 0.2)',
                transition: 'all 0.3s ease',
              }}
              onClick={() => navigate('/sales/new')}
              className="quick-action-card"
            >
              <ThemeIcon
                size={48}
                radius="xl"
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                mx="auto"
                mb="sm"
              >
                <IconReceipt size={24} color="white" />
              </ThemeIcon>
              <Text size="sm" fw={600}>New Sale</Text>
            </Paper>

            <Paper
              p="md"
              radius="lg"
              style={{
                cursor: 'pointer',
                textAlign: 'center',
                background: 'linear-gradient(135deg, rgba(0, 180, 219, 0.1) 0%, rgba(0, 131, 176, 0.1) 100%)',
                border: '1px solid rgba(0, 180, 219, 0.2)',
                transition: 'all 0.3s ease',
              }}
              onClick={() => navigate('/inventory/stock-in')}
              className="quick-action-card"
            >
              <ThemeIcon
                size={48}
                radius="xl"
                style={{ background: 'linear-gradient(135deg, #00b4db 0%, #0083b0 100%)' }}
                mx="auto"
                mb="sm"
              >
                <IconPackage size={24} color="white" />
              </ThemeIcon>
              <Text size="sm" fw={600}>Stock In</Text>
            </Paper>

            <Paper
              p="md"
              radius="lg"
              style={{
                cursor: 'pointer',
                textAlign: 'center',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
                border: '1px solid rgba(168, 85, 247, 0.2)',
                transition: 'all 0.3s ease',
              }}
              onClick={() => navigate('/payments/advance')}
              className="quick-action-card"
            >
              <ThemeIcon
                size={48}
                radius="xl"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' }}
                mx="auto"
                mb="sm"
              >
                <IconCash size={24} color="white" />
              </ThemeIcon>
              <Text size="sm" fw={600}>Give Advance</Text>
            </Paper>

            <Paper
              p="md"
              radius="lg"
              style={{
                cursor: 'pointer',
                textAlign: 'center',
                background: 'linear-gradient(135deg, rgba(247, 151, 30, 0.1) 0%, rgba(255, 210, 0, 0.1) 100%)',
                border: '1px solid rgba(247, 151, 30, 0.2)',
                transition: 'all 0.3s ease',
              }}
              onClick={() => navigate('/reports')}
              className="quick-action-card"
            >
              <ThemeIcon
                size={48}
                radius="xl"
                style={{ background: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' }}
                mx="auto"
                mb="sm"
              >
                <IconChartBar size={24} color="white" />
              </ThemeIcon>
              <Text size="sm" fw={600}>Reports</Text>
            </Paper>

            <Paper
              p="md"
              radius="lg"
              style={{
                cursor: 'pointer',
                textAlign: 'center',
                background: 'linear-gradient(135deg, rgba(244, 114, 182, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)',
                border: '1px solid rgba(244, 114, 182, 0.2)',
                transition: 'all 0.3s ease',
              }}
              onClick={() => navigate('/accounting/vouchers')}
              className="quick-action-card"
            >
              <ThemeIcon
                size={48}
                radius="xl"
                style={{ background: 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)' }}
                mx="auto"
                mb="sm"
              >
                <IconCalendarStats size={24} color="white" />
              </ThemeIcon>
              <Text size="sm" fw={600}>Vouchers</Text>
            </Paper>
          </SimpleGrid>

          <style>{`
            .quick-action-card:hover {
              transform: translateY(-4px);
              box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
            }
          `}</style>
        </Card>
      </Stack>
    </Container>
  );
};

export default Dashboard;
