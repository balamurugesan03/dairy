import { useState, useEffect } from 'react';
import {
  Container,
  Card,
  Title,
  Text,
  Button,
  Group,
  Table,
  Badge,
  LoadingOverlay,
  Stack,
  TextInput,
  Select,
  Grid,
  Paper,
  ThemeIcon,
  SimpleGrid,
  Menu
} from '@mantine/core';
import {
  IconSearch,
  IconFilter,
  IconRefresh,
  IconPackage,
  IconCurrencyRupee,
  IconAlertTriangle,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconDownload,
  IconBox
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { businessStockAPI } from '../../services/api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const BusinessStockReport = () => {
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    status: 'Active',
    search: ''
  });
  const [stats, setStats] = useState({
    totalItems: 0,
    totalValue: 0,
    lowStockItems: 0,
    outOfStock: 0
  });

  useEffect(() => {
    fetchStockData();
  }, [filters.category, filters.status]);

  const fetchStockData = async () => {
    setLoading(true);
    try {
      const params = {
        ...(filters.category && { category: filters.category }),
        ...(filters.status && { status: filters.status })
      };

      const response = await businessStockAPI.getBalance(params);
      let data = response.data || [];

      // Apply search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        data = data.filter(item =>
          item.itemName?.toLowerCase().includes(searchLower) ||
          item.itemCode?.toLowerCase().includes(searchLower)
        );
      }

      setStockData(data);

      // Calculate stats
      const totalItems = data.length;
      const totalValue = data.reduce((sum, item) => sum + (item.stockValue || 0), 0);
      const lowStockItems = data.filter(item => item.isLowStock).length;
      const outOfStock = data.filter(item => item.currentBalance === 0).length;

      setStats({ totalItems, totalValue, lowStockItems, outOfStock });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch stock data',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      status: 'Active',
      search: ''
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const exportToExcel = () => {
    const exportData = stockData.map((item, index) => ({
      'S.No': index + 1,
      'Item Code': item.itemCode,
      'Item Name': item.itemName,
      'Category': item.category || '-',
      'Unit': item.measurement || '-',
      'Opening Balance': item.openingBalance || 0,
      'Current Stock': item.currentBalance || 0,
      'Purchase Price': item.purchasePrice || 0,
      'Sales Rate': item.salesRate || 0,
      'MRP': item.mrp || 0,
      'Stock Value': item.stockValue || 0,
      'Low Stock Alert': item.lowStockAlert || 0,
      'Status': item.isLowStock ? 'Low Stock' : (item.currentBalance === 0 ? 'Out of Stock' : 'In Stock')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Business Stock Report');

    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    ws['!cols'] = colWidths;

    const fileName = `Business_Stock_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    notifications.show({
      title: 'Export Success',
      message: `Data exported to ${fileName}`,
      color: 'green'
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');

    doc.setFontSize(16);
    doc.text('Business Stock Report', 14, 15);

    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 22);

    doc.setFontSize(9);
    doc.text(`Total Items: ${stats.totalItems} | Total Value: ${formatCurrency(stats.totalValue)} | Low Stock: ${stats.lowStockItems} | Out of Stock: ${stats.outOfStock}`, 14, 28);

    const tableData = stockData.map((item, index) => [
      index + 1,
      item.itemCode,
      item.itemName,
      item.category || '-',
      item.measurement || '-',
      item.currentBalance || 0,
      `Rs.${(item.purchasePrice || 0).toFixed(2)}`,
      `Rs.${(item.salesRate || 0).toFixed(2)}`,
      `Rs.${(item.stockValue || 0).toFixed(2)}`,
      item.isLowStock ? 'Low' : (item.currentBalance === 0 ? 'Out' : 'OK')
    ]);

    doc.autoTable({
      head: [['#', 'Code', 'Item Name', 'Category', 'Unit', 'Stock', 'Purchase', 'Sales', 'Value', 'Status']],
      body: tableData,
      startY: 32,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] }
    });

    const fileName = `Business_Stock_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);

    notifications.show({
      title: 'Export Success',
      message: `Data exported to ${fileName}`,
      color: 'green'
    });
  };

  return (
    <Container fluid p="md">
      <LoadingOverlay visible={loading} />

      {/* Header */}
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>Business Stock Report</Title>
          <Text size="sm" c="dimmed">View current stock levels and values</Text>
        </div>
        <Group>
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Button
                leftSection={<IconDownload size={16} />}
                variant="light"
                color="green"
                disabled={stockData.length === 0}
              >
                Export
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Export Options</Menu.Label>
              <Menu.Item
                leftSection={<IconFileSpreadsheet size={16} />}
                onClick={exportToExcel}
              >
                Export to Excel
              </Menu.Item>
              <Menu.Item
                leftSection={<IconFileTypePdf size={16} />}
                onClick={exportToPDF}
              >
                Export to PDF
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={fetchStockData}
            variant="light"
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {/* Stats Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="xl">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size={50} radius="md" color="blue">
              <IconBox size={30} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Total Items
              </Text>
              <Text fw={700} size="xl">
                {stats.totalItems}
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
                {formatCurrency(stats.totalValue)}
              </Text>
            </div>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size={50} radius="md" color="yellow">
              <IconAlertTriangle size={30} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Low Stock Items
              </Text>
              <Text fw={700} size="xl" c="yellow">
                {stats.lowStockItems}
              </Text>
            </div>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size={50} radius="md" color="red">
              <IconPackage size={30} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Out of Stock
              </Text>
              <Text fw={700} size="xl" c="red">
                {stats.outOfStock}
              </Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Filters */}
      <Card shadow="sm" padding="lg" radius="md" withBorder mb="xl">
        <Stack gap="md">
          <Group justify="space-between">
            <Group>
              <IconFilter size={20} />
              <Text fw={600}>Filters</Text>
            </Group>
            <Button size="xs" variant="subtle" onClick={clearFilters}>
              Clear All
            </Button>
          </Group>

          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <TextInput
                placeholder="Search by item name or code..."
                leftSection={<IconSearch size={16} />}
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Select
                placeholder="Category"
                data={[
                  { value: '', label: 'All Categories' },
                  { value: 'Electronics', label: 'Electronics' },
                  { value: 'Groceries', label: 'Groceries' },
                  { value: 'Clothing', label: 'Clothing' },
                  { value: 'Hardware', label: 'Hardware' },
                  { value: 'Stationery', label: 'Stationery' },
                  { value: 'Medical', label: 'Medical' },
                  { value: 'Cosmetics', label: 'Cosmetics' },
                  { value: 'Food', label: 'Food & Beverages' },
                  { value: 'Other', label: 'Other' }
                ]}
                value={filters.category}
                onChange={(value) => handleFilterChange('category', value)}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <Select
                placeholder="Status"
                data={[
                  { value: '', label: 'All Status' },
                  { value: 'Active', label: 'Active' },
                  { value: 'Inactive', label: 'Inactive' }
                ]}
                value={filters.status}
                onChange={(value) => handleFilterChange('status', value)}
                clearable
              />
            </Grid.Col>
          </Grid>
        </Stack>
      </Card>

      {/* Stock Table */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text fw={600}>Stock Details</Text>
          <Badge color="blue" variant="light" size="lg">
            {stockData.length} Items
          </Badge>
        </Group>

        {stockData.length > 0 ? (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Item Code</Table.Th>
                <Table.Th>Item Name</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Unit</Table.Th>
                <Table.Th>Current Stock</Table.Th>
                <Table.Th>Purchase Price</Table.Th>
                <Table.Th>Sales Rate</Table.Th>
                <Table.Th>Stock Value</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {stockData.map((item, index) => (
                <Table.Tr key={item._id}>
                  <Table.Td>{index + 1}</Table.Td>
                  <Table.Td>
                    <Badge color="blue" variant="light">{item.itemCode}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>{item.itemName}</Text>
                  </Table.Td>
                  <Table.Td>{item.category || '-'}</Table.Td>
                  <Table.Td>{item.measurement || '-'}</Table.Td>
                  <Table.Td>
                    <Badge
                      color={
                        item.currentBalance === 0 ? 'red' :
                        item.isLowStock ? 'yellow' : 'green'
                      }
                      variant="light"
                    >
                      {item.currentBalance || 0}
                    </Badge>
                  </Table.Td>
                  <Table.Td>Rs.{(item.purchasePrice || 0).toFixed(2)}</Table.Td>
                  <Table.Td>Rs.{(item.salesRate || 0).toFixed(2)}</Table.Td>
                  <Table.Td>
                    <Text fw={600}>{formatCurrency(item.stockValue || 0)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={
                        item.currentBalance === 0 ? 'red' :
                        item.isLowStock ? 'yellow' : 'green'
                      }
                    >
                      {item.currentBalance === 0 ? 'Out of Stock' :
                       item.isLowStock ? 'Low Stock' : 'In Stock'}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Paper p="xl" ta="center">
            <IconPackage size={48} style={{ opacity: 0.3 }} />
            <Text c="dimmed" mt="md">
              No stock data found
            </Text>
          </Paper>
        )}
      </Card>
    </Container>
  );
};

export default BusinessStockReport;
