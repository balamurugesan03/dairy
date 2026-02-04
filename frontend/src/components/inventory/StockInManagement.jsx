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
  ActionIcon,
  Menu,
  Tooltip,
  Paper,
  ThemeIcon,
  SimpleGrid,
  Modal
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconPackageImport,
  IconPlus,
  IconSearch,
  IconFilter,
  IconRefresh,
  IconFileInvoice,
  IconEye,
  IconDots,
  IconCalendar,
  IconCurrencyRupee,
  IconPackage,
  IconTruck,
  IconReceipt,
  IconEdit,
  IconTrash,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconDownload
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { stockAPI } from '../../services/api';
import StockInModal from './StockInModal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const StockInManagement = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    referenceType: '',
    search: ''
  });
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalQuantity: 0,
    totalAmount: 0,
    totalPaid: 0
  });

  useEffect(() => {
    fetchTransactions();
  }, [filters]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = {
        transactionType: 'in',
        ...(filters.startDate && { startDate: filters.startDate.toISOString() }),
        ...(filters.endDate && { endDate: filters.endDate.toISOString() }),
        ...(filters.referenceType && { referenceType: filters.referenceType })
      };

      const response = await stockAPI.getTransactions(params);
      let txnData = response.data || [];

      // Apply search filter on frontend
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        txnData = txnData.filter(txn =>
          txn.itemId?.itemName?.toLowerCase().includes(searchLower) ||
          txn.itemId?.itemCode?.toLowerCase().includes(searchLower) ||
          txn.invoiceNumber?.toLowerCase().includes(searchLower) ||
          txn.supplierName?.toLowerCase().includes(searchLower)
        );
      }

      setTransactions(txnData);

      // Calculate stats
      const totalTransactions = txnData.length;
      const totalQuantity = txnData.reduce((sum, txn) => sum + (txn.quantity || 0), 0);
      const totalAmount = txnData.reduce((sum, txn) => sum + (txn.totalAmount || 0), 0);
      const totalPaid = txnData.reduce((sum, txn) => sum + (txn.paidAmount || 0), 0);

      setStats({ totalTransactions, totalQuantity, totalAmount, totalPaid });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch transactions',
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
      startDate: null,
      endDate: null,
      referenceType: '',
      search: ''
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const getReferenceTypeBadge = (type) => {
    const colors = {
      'Purchase': 'blue',
      'Return': 'green',
      'Opening': 'violet',
      'Adjustment': 'orange'
    };
    return <Badge color={colors[type] || 'gray'} variant="light">{type}</Badge>;
  };

  const getPaymentModeBadge = (mode) => {
    const colors = {
      'Cash': 'green',
      'Adjustment': 'orange',
      'N/A': 'gray'
    };
    return <Badge color={colors[mode] || 'gray'} size="sm">{mode}</Badge>;
  };

  const handleEdit = (txn) => {
    setEditTransaction(txn);
    setModalOpen(true);
  };

  const handleDeleteClick = (txn) => {
    setTransactionToDelete(txn);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete) return;

    setLoading(true);
    try {
      await stockAPI.delete(transactionToDelete._id);
      notifications.show({
        title: 'Success',
        message: 'Transaction deleted successfully',
        color: 'green'
      });
      fetchTransactions();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to delete transaction',
        color: 'red'
      });
    } finally {
      setLoading(false);
      setDeleteModalOpen(false);
      setTransactionToDelete(null);
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditTransaction(null);
  };

  const exportToExcel = () => {
    const exportData = transactions.map((txn, index) => ({
      'S.No': index + 1,
      'Date': formatDate(txn.purchaseDate || txn.date),
      'Item Name': txn.itemId?.itemName || 'N/A',
      'Item Code': txn.itemId?.itemCode || '',
      'Quantity': txn.quantity || 0,
      'Unit': txn.itemId?.unit || '',
      'Free Qty': txn.freeQty || 0,
      'Rate (₹)': txn.rate || 0,
      'Amount (₹)': (txn.quantity || 0) * (txn.rate || 0),
      'Supplier': txn.supplierName || 'N/A',
      'Invoice No': txn.invoiceNumber || 'N/A',
      'Invoice Date': txn.invoiceDate ? formatDate(txn.invoiceDate) : 'N/A',
      'Payment Mode': txn.paymentMode || 'N/A',
      'Paid Amount (₹)': txn.paidAmount || 0,
      'Reference Type': txn.referenceType || 'N/A',
      'Balance After': txn.balanceAfter || 0,
      'Notes': txn.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock In Transactions');

    // Auto-width columns
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    ws['!cols'] = colWidths;

    const fileName = `Stock_In_Transactions_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    notifications.show({
      title: 'Export Success',
      message: `Data exported to ${fileName}`,
      color: 'green'
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');

    // Title
    doc.setFontSize(16);
    doc.text('Stock In - Purchase Transactions', 14, 15);

    // Date
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 22);

    // Stats summary
    doc.setFontSize(9);
    doc.text(`Total Transactions: ${stats.totalTransactions} | Total Quantity: ${stats.totalQuantity.toFixed(2)} | Total Value: ${formatCurrency(stats.totalAmount)} | Total Paid: ${formatCurrency(stats.totalPaid)}`, 14, 28);

    // Table data
    const tableData = transactions.map((txn, index) => [
      index + 1,
      formatDate(txn.purchaseDate || txn.date),
      txn.itemId?.itemName || 'N/A',
      txn.quantity || 0,
      `₹${(txn.rate || 0).toFixed(2)}`,
      `₹${((txn.quantity || 0) * (txn.rate || 0)).toFixed(2)}`,
      txn.supplierName || 'N/A',
      txn.invoiceNumber || 'N/A',
      txn.paymentMode || 'N/A',
      `₹${(txn.paidAmount || 0).toFixed(2)}`,
      txn.referenceType || 'N/A',
      txn.balanceAfter || 0
    ]);

    doc.autoTable({
      head: [[
        'S.No', 'Date', 'Item', 'Qty', 'Rate', 'Amount',
        'Supplier', 'Invoice', 'Payment', 'Paid', 'Type', 'Balance'
      ]],
      body: tableData,
      startY: 32,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] }
    });

    const fileName = `Stock_In_Transactions_${new Date().toISOString().split('T')[0]}.pdf`;
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
          <Title order={2}>Stock In - Purchase Management</Title>
          <Text size="sm" c="dimmed">Manage inventory purchases and stock additions</Text>
        </div>
        <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setModalOpen(true)}
          >
            Add Purchase
          </Button>
        <Group>
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Button
                leftSection={<IconDownload size={16} />}
                variant="light"
                color="green"
                disabled={transactions.length === 0}
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
            onClick={fetchTransactions}
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
              <IconReceipt size={30} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Total Transactions
              </Text>
              <Text fw={700} size="xl">
                {stats.totalTransactions}
              </Text>
            </div>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size={50} radius="md" color="green">
              <IconPackage size={30} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Total Quantity
              </Text>
              <Text fw={700} size="xl">
                {stats.totalQuantity.toFixed(2)}
              </Text>
            </div>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size={50} radius="md" color="violet">
              <IconCurrencyRupee size={30} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Total Purchase Value
              </Text>
              <Text fw={700} size="xl">
                {formatCurrency(stats.totalAmount)}
              </Text>
            </div>
          </Group>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group>
            <ThemeIcon size={50} radius="md" color="teal">
              <IconTruck size={30} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Total Paid
              </Text>
              <Text fw={700} size="xl">
                {formatCurrency(stats.totalPaid)}
              </Text>
              <Text size="xs" c="dimmed">
                Pending: {formatCurrency(stats.totalAmount - stats.totalPaid)}
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
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <TextInput
                placeholder="Search by item, invoice, supplier..."
                leftSection={<IconSearch size={16} />}
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DateInput
                placeholder="Start date"
                leftSection={<IconCalendar size={16} />}
                value={filters.startDate}
                onChange={(value) => handleFilterChange('startDate', value)}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DateInput
                placeholder="End date"
                leftSection={<IconCalendar size={16} />}
                value={filters.endDate}
                onChange={(value) => handleFilterChange('endDate', value)}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Select
                placeholder="Reference type"
                data={[
                  { value: '', label: 'All Types' },
                  { value: 'Purchase', label: 'Purchase' },
                  { value: 'Return', label: 'Return' },
                  { value: 'Opening', label: 'Opening Stock' },
                  { value: 'Adjustment', label: 'Adjustment' }
                ]}
                value={filters.referenceType}
                onChange={(value) => handleFilterChange('referenceType', value)}
                clearable
              />
            </Grid.Col>
          </Grid>
        </Stack>
      </Card>

      {/* Transactions Table */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text fw={600}>Stock In Transactions</Text>
          <Badge color="blue" variant="light" size="lg">
            {transactions.length} Records
          </Badge>
        </Group>

        {transactions.length > 0 ? (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Item</Table.Th>
                <Table.Th>Quantity</Table.Th>
                <Table.Th>Rate</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Supplier</Table.Th>
                <Table.Th>Invoice</Table.Th>
                <Table.Th>Payment</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Balance</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {transactions.map((txn) => (
                <Table.Tr key={txn._id}>
                  <Table.Td>
                    <Text size="sm">{formatDate(txn.purchaseDate || txn.date)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <div>
                      <Text size="sm" fw={500}>{txn.itemId?.itemName || 'N/A'}</Text>
                      <Text size="xs" c="dimmed">{txn.itemId?.itemCode || ''}</Text>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Badge color="blue" variant="light">
                      {txn.quantity} {txn.itemId?.unit || ''}
                    </Badge>
                    {txn.freeQty > 0 && (
                      <Badge color="green" variant="light" size="xs" ml={4}>
                        +{txn.freeQty} Free
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">₹{txn.rate?.toFixed(2)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {formatCurrency(txn.quantity * txn.rate)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{txn.supplierName || 'N/A'}</Text>
                  </Table.Td>
                  <Table.Td>
                    {txn.invoiceNumber ? (
                      <div>
                        <Text size="sm">{txn.invoiceNumber}</Text>
                        {txn.invoiceDate && (
                          <Text size="xs" c="dimmed">{formatDate(txn.invoiceDate)}</Text>
                        )}
                      </div>
                    ) : (
                      <Text size="sm" c="dimmed">N/A</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <div>
                      {getPaymentModeBadge(txn.paymentMode)}
                      {txn.paidAmount > 0 && (
                        <Text size="xs" c="dimmed">₹{txn.paidAmount.toFixed(2)}</Text>
                      )}
                    </div>
                  </Table.Td>
                  <Table.Td>
                    {getReferenceTypeBadge(txn.referenceType)}
                  </Table.Td>
                  <Table.Td>
                    <Badge color="green" variant="filled">
                      {txn.balanceAfter}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Menu shadow="md" width={200}>
                      <Menu.Target>
                        <ActionIcon variant="subtle">
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconEye size={14} />}>
                          View Details
                        </Menu.Item>
                        <Menu.Item leftSection={<IconFileInvoice size={14} />}>
                          View Invoice
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          leftSection={<IconEdit size={14} />}
                          onClick={() => handleEdit(txn)}
                        >
                          Edit
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconTrash size={14} />}
                          color="red"
                          onClick={() => handleDeleteClick(txn)}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Paper p="xl" ta="center">
            <IconPackageImport size={48} style={{ opacity: 0.3 }} />
            <Text c="dimmed" mt="md">
              No stock in transactions found
            </Text>
            <Button
              mt="md"
              leftSection={<IconPlus size={16} />}
              onClick={() => setModalOpen(true)}
            >
              Add First Transaction
            </Button>
          </Paper>
        )}
      </Card>

      {/* Stock In Modal */}
      <StockInModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSuccess={fetchTransactions}
        editData={editTransaction}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setTransactionToDelete(null);
        }}
        title="Confirm Delete"
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to delete this transaction?
          </Text>
          {transactionToDelete && (
            <Paper p="md" withBorder bg="gray.0">
              <Text size="sm" fw={500}>
                Item: {transactionToDelete.itemId?.itemName || 'N/A'}
              </Text>
              <Text size="sm" c="dimmed">
                Quantity: {transactionToDelete.quantity} | Amount: {formatCurrency((transactionToDelete.quantity || 0) * (transactionToDelete.rate || 0))}
              </Text>
              <Text size="sm" c="dimmed">
                Date: {formatDate(transactionToDelete.purchaseDate || transactionToDelete.date)}
              </Text>
            </Paper>
          )}
          <Text size="sm" c="red">
            This action cannot be undone. The stock balance will be adjusted accordingly.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setDeleteModalOpen(false);
                setTransactionToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={handleDeleteConfirm}
              loading={loading}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default StockInManagement;
