import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  TextInput,
  Select,
  Badge,
  ActionIcon,
  Menu,
  Paper,
  Stack,
  Modal,
  Checkbox,
  NumberInput,
  Pagination,
  SimpleGrid,
  Card,
  Box,
  UnstyledButton
} from '@mantine/core';
import {
  IconSearch,
  IconColumns,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCoin,
  IconBuildingWarehouse,
  IconActivity,
  IconFileTypeXls,
  IconFileTypePdf,
  IconList,
  IconAlertCircle,
  IconRefresh,
  IconBarcode
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { DataTable } from 'mantine-datatable';
import { businessItemAPI, ledgerAPI, supplierAPI } from '../../services/api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const BusinessItemList = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ledgers, setLedgers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Modal states
  const [itemModalOpened, { open: openItemModal, close: closeItemModal }] = useDisclosure(false);
  const [openingBalanceModalOpened, { open: openOpeningBalanceModal, close: closeOpeningBalanceModal }] = useDisclosure(false);
  const [pricesModalOpened, { open: openPricesModal, close: closePricesModal }] = useDisclosure(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItemForBalance, setSelectedItemForBalance] = useState(null);
  const [selectedItemForPrices, setSelectedItemForPrices] = useState(null);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    code: true,
    name: true,
    barcode: true,
    category: true,
    measurement: true,
    stock: true,
    purchasePrice: true,
    salesRate: true,
    mrp: true,
    supplier: true,
    gst: true,
    status: true
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Table column filters
  const [tableFilters, setTableFilters] = useState({
    category: '',
    supplier: '',
    status: ''
  });

  // Pagination
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  // Forms
  const itemForm = useForm({
    initialValues: {
      itemCode: '',
      itemName: '',
      category: '',
      measurement: '',
      unit: '',
      barcode: '',
      supplier: '',
      purchasePrice: 0,
      salesRate: 0,
      wholesalePrice: 0,
      retailPrice: 0,
      mrp: 0,
      gstPercent: 0,
      hsnCode: '',
      lowStockAlert: 0,
      description: '',
      status: 'Active'
    },
    validate: {
      itemName: (value) => !value ? 'Item name is required' : null,
      category: (value) => !value ? 'Category is required' : null,
      measurement: (value) => !value ? 'Measurement is required' : null,
    }
  });

  const openingBalanceForm = useForm({
    initialValues: {
      openingBalance: 0,
      rate: 0
    },
    validate: {
      openingBalance: (value) => (value === undefined || value === null || value === '') ? 'Opening balance is required' : null,
      rate: (value) => (value === undefined || value === null || value === '') ? 'Rate is required' : null,
    }
  });

  const pricesForm = useForm({
    initialValues: {
      salesRate: 0,
      wholesalePrice: 0,
      retailPrice: 0,
      mrp: 0
    }
  });

  // Measurement custom input state
  const [showCustomMeasurement, setShowCustomMeasurement] = useState(false);

  useEffect(() => {
    fetchItems();
    fetchLedgers();
    fetchSuppliers();
  }, []);

  const fetchLedgers = async () => {
    try {
      const response = await ledgerAPI.getAll({ status: 'Active' });
      setLedgers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch ledgers:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await supplierAPI.getAll({ active: 'true' });
      setSuppliers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await businessItemAPI.getAll();
      setItems(response.data || []);
      setPagination(prev => ({ ...prev, total: response.data?.length || 0 }));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch business items',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setSelectedItem(null);
    itemForm.reset();
    setShowCustomMeasurement(false);
    openItemModal();
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    itemForm.setValues({
      itemCode: item.itemCode || '',
      itemName: item.itemName || '',
      category: item.category || '',
      measurement: item.measurement || '',
      unit: item.unit || '',
      barcode: item.barcode || '',
      supplier: item.supplier?._id || '',
      purchasePrice: item.purchasePrice || 0,
      salesRate: item.salesRate || 0,
      wholesalePrice: item.wholesalePrice || 0,
      retailPrice: item.retailPrice || 0,
      mrp: item.mrp || 0,
      gstPercent: item.gstPercent || 0,
      hsnCode: item.hsnCode || '',
      lowStockAlert: item.lowStockAlert || 0,
      description: item.description || '',
      status: item.status || 'Active'
    });

    const predefinedMeasurements = ['Kg', 'Ltr', 'Pcs', 'Box', 'Bag', 'Packet', 'Bottle'];
    setShowCustomMeasurement(item.measurement && !predefinedMeasurements.includes(item.measurement));
    openItemModal();
  };

  const handleDelete = async (id) => {
    modals.openConfirmModal({
      title: 'Delete Business Item',
      children: (
        <Text size="sm">
          Are you sure you want to permanently delete this item? This will also delete all stock transaction history.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await businessItemAPI.delete(id);
          notifications.show({
            title: 'Success',
            message: 'Business item deleted successfully',
            color: 'green'
          });
          fetchItems();
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: error.message || 'Failed to delete item',
            color: 'red'
          });
        }
      }
    });
  };

  const handleItemSubmit = async (values) => {
    try {
      if (selectedItem) {
        await businessItemAPI.update(selectedItem._id, values);
        notifications.show({
          title: 'Success',
          message: 'Business item updated successfully',
          color: 'green'
        });
      } else {
        await businessItemAPI.create(values);
        notifications.show({
          title: 'Success',
          message: 'Business item created successfully',
          color: 'green'
        });
      }
      closeItemModal();
      fetchItems();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save item',
        color: 'red'
      });
    }
  };

  const handleOpeningBalanceClick = (item) => {
    setSelectedItemForBalance(item);
    openingBalanceForm.setValues({
      openingBalance: item.openingBalance || 0,
      rate: item.purchasePrice || 0
    });
    openOpeningBalanceModal();
  };

  const handleOpeningBalanceSubmit = async (values) => {
    try {
      await businessItemAPI.updateOpeningBalance(selectedItemForBalance._id, values);
      notifications.show({
        title: 'Success',
        message: 'Opening balance updated successfully',
        color: 'green'
      });
      closeOpeningBalanceModal();
      fetchItems();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update opening balance',
        color: 'red'
      });
    }
  };

  const handlePricesClick = (item) => {
    setSelectedItemForPrices(item);
    pricesForm.setValues({
      salesRate: item.salesRate || 0,
      wholesalePrice: item.wholesalePrice || 0,
      retailPrice: item.retailPrice || 0,
      mrp: item.mrp || 0
    });
    openPricesModal();
  };

  const handlePricesSubmit = async (values) => {
    try {
      await businessItemAPI.updatePrices(selectedItemForPrices._id, values);
      notifications.show({
        title: 'Success',
        message: 'Prices updated successfully',
        color: 'green'
      });
      closePricesModal();
      fetchItems();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update prices',
        color: 'red'
      });
    }
  };

  const handleTableFilterChange = (column, value) => {
    setTableFilters(prev => ({ ...prev, [column]: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setStatusFilter('');
    setTableFilters({ category: '', supplier: '', status: '' });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch =
      item.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.itemCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    const matchesStatus = !statusFilter || item.status === statusFilter;
    const matchesTableCategory = !tableFilters.category || item.category === tableFilters.category;
    const matchesTableSupplier = !tableFilters.supplier || item.supplier?._id === tableFilters.supplier;
    const matchesTableStatus = !tableFilters.status || item.status === tableFilters.status;

    return matchesSearch && matchesCategory && matchesStatus &&
           matchesTableCategory && matchesTableSupplier && matchesTableStatus;
  });

  // Paginate items
  const paginatedItems = useMemo(() => {
    const startIndex = (pagination.current - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    return filteredItems.slice(startIndex, endIndex);
  }, [filteredItems, pagination]);

  // Stats
  const totalItems = items.length;
  const activeItems = items.filter(item => item.status === 'Active').length;
  const lowStock = items.filter(item => item.lowStockAlert > 0 && item.currentBalance <= item.lowStockAlert).length;

  const hasActiveFilters = searchTerm || categoryFilter || statusFilter ||
                           tableFilters.category || tableFilters.supplier || tableFilters.status;

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }));
  };

  const handleLedgerClick = (item, ledgerType) => {
    const ledger = ledgerType === 'purchase' ? item.purchaseLedger : item.salesLedger;
    if (ledger) {
      const categoryName = item.category;
      const ledgerTypeName = ledgerType === 'purchase' ? 'Purchase' : 'Sales';
      const displayName = `Business ${categoryName} ${ledgerTypeName}`;
      navigate(`/ledgers/${ledger._id}?name=${encodeURIComponent(displayName)}`);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredItems.map(item => ({
      'Code': item.itemCode,
      'Item Name': item.itemName,
      'Barcode': item.barcode || '-',
      'Category': item.category,
      'Measurement': item.measurement,
      'Stock': `${item.currentBalance} ${item.measurement}`,
      'Purchase Price': item.purchasePrice || 0,
      'Sales Rate': item.salesRate || 0,
      'MRP': item.mrp || 0,
      'Supplier': item.supplier?.name || '-',
      'GST %': `${item.gstPercent || 0}%`,
      'Status': item.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Business Items');

    ws['!cols'] = [
      { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
      { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
      { wch: 20 }, { wch: 8 }, { wch: 10 }
    ];

    XLSX.writeFile(wb, `Business_Items_${new Date().toISOString().split('T')[0]}.xlsx`);

    notifications.show({
      title: 'Success',
      message: 'Exported to Excel successfully',
      color: 'green'
    });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(16);
    doc.text('Business Item Master Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = filteredItems.map(item => [
      item.itemCode,
      item.itemName,
      item.category,
      item.measurement,
      `${item.currentBalance} ${item.measurement}`,
      item.purchasePrice || 0,
      item.salesRate || 0,
      item.mrp || 0,
      item.status
    ]);

    doc.autoTable({
      startY: 28,
      head: [['Code', 'Item Name', 'Category', 'Unit', 'Stock', 'Purchase', 'Sales', 'MRP', 'Status']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [24, 144, 255], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 18 }, 1: { cellWidth: 40 }, 2: { cellWidth: 25 },
        3: { cellWidth: 15 }, 4: { cellWidth: 25 }, 5: { cellWidth: 20 },
        6: { cellWidth: 20 }, 7: { cellWidth: 18 }, 8: { cellWidth: 15 }
      }
    });

    doc.save(`Business_Items_${new Date().toISOString().split('T')[0]}.pdf`);

    notifications.show({
      title: 'Success',
      message: 'Exported to PDF successfully',
      color: 'green'
    });
  };

  const StatCard = ({ icon, label, value, color }) => (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Group>
        <Box
          sx={(theme) => ({
            padding: theme.spacing.sm,
            borderRadius: theme.radius.md,
            backgroundColor: `${color}20`,
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          })}
        >
          {icon}
        </Box>
        <div>
          <Text fw={700} size="xl">
            {value}
          </Text>
          <Text size="sm" color="dimmed">
            {label}
          </Text>
        </div>
      </Group>
    </Card>
  );

  const tableColumns = [
    visibleColumns.code && {
      accessor: 'itemCode',
      title: 'Code',
      render: (item) => (
        <Badge color="blue" variant="light" radius="sm">
          {item.itemCode}
        </Badge>
      ),
      width: 110
    },
    visibleColumns.name && {
      accessor: 'itemName',
      title: 'Item Name',
      render: (item) => (
        <Text fw={500} size="sm">
          {item.itemName}
        </Text>
      ),
      width: 200
    },
    visibleColumns.barcode && {
      accessor: 'barcode',
      title: 'Barcode',
      render: (item) => item.barcode || '-',
      width: 120
    },
    visibleColumns.category && {
      accessor: 'category',
      title: 'Category',
      render: (item) => item.category,
      width: 120
    },
    visibleColumns.measurement && {
      accessor: 'measurement',
      title: 'Unit',
      render: (item) => item.measurement,
      width: 80
    },
    visibleColumns.stock && {
      accessor: 'stock',
      title: 'Stock',
      render: (item) => (
        <Badge
          color={
            item.lowStockAlert > 0 && item.currentBalance <= item.lowStockAlert ? 'red' :
            item.currentBalance < 50 ? 'yellow' : 'green'
          }
          variant="light"
          size="md"
        >
          {item.currentBalance} {item.measurement}
        </Badge>
      ),
      width: 120
    },
    visibleColumns.purchasePrice && {
      accessor: 'purchasePrice',
      title: 'Purchase',
      render: (item) => `Rs. ${item.purchasePrice || 0}`,
      width: 100
    },
    visibleColumns.salesRate && {
      accessor: 'salesRate',
      title: 'Sales',
      render: (item) => `Rs. ${item.salesRate || 0}`,
      width: 100
    },
    visibleColumns.mrp && {
      accessor: 'mrp',
      title: 'MRP',
      render: (item) => `Rs. ${item.mrp || 0}`,
      width: 90
    },
    visibleColumns.supplier && {
      accessor: 'supplier',
      title: 'Supplier',
      render: (item) => item.supplier?.name || '-',
      width: 150
    },
    visibleColumns.gst && {
      accessor: 'gstPercent',
      title: 'GST %',
      render: (item) => `${item.gstPercent || 0}%`,
      width: 70
    },
    visibleColumns.status && {
      accessor: 'status',
      title: 'Status',
      render: (item) => (
        <Badge
          color={item.status === 'Active' ? 'green' : 'red'}
          variant="light"
          radius="sm"
        >
          {item.status}
        </Badge>
      ),
      width: 90
    },
    {
      accessor: 'actions',
      title: 'Actions',
      render: (item) => (
        <Group spacing="xs" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="blue"
            onClick={() => handleEdit(item)}
            title="Edit"
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="green"
            onClick={() => handleOpeningBalanceClick(item)}
            title="Update Balance"
          >
            <IconCoin size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="orange"
            onClick={() => handlePricesClick(item)}
            title="Update Prices"
          >
            <IconBarcode size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => handleDelete(item._id)}
            title="Delete"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ),
      width: 160
    }
  ].filter(Boolean);

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Group position="apart" mb="xl">
        <div>
          <Title order={2}>Business Item Master</Title>
          <Text color="dimmed" size="sm">Manage your business inventory items (Vyapar)</Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={handleAdd}
          size="sm"
        >
          Add Business Item
        </Button>
      </Group>

      {/* Stats */}
      <SimpleGrid cols={4} mb="lg">
        <StatCard
          icon={<IconBuildingWarehouse size={24} />}
          label="Total Items"
          value={totalItems}
          color="#1890ff"
        />
        <StatCard
          icon={<IconActivity size={24} />}
          label="Active Items"
          value={activeItems}
          color="#52c41a"
        />
        <StatCard
          icon={<IconAlertCircle size={24} />}
          label="Low Stock"
          value={lowStock}
          color="#faad14"
        />
        <StatCard
          icon={<IconList size={24} />}
          label="Showing"
          value={filteredItems.length}
          color="#722ed1"
        />
      </SimpleGrid>

      {/* Search & Filters */}
      <Paper p="md" withBorder mb="md">
        <Stack>
          <Group position="apart">
            <TextInput
              placeholder="Search by name, code or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<IconSearch size={16} />}
              style={{ flex: 1, minWidth: 300 }}
              size="sm"
            />

            <Group spacing="xs">
              <Select
                placeholder="Category"
                value={categoryFilter}
                onChange={setCategoryFilter}
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
                size="sm"
                style={{ width: 150 }}
              />

              <Select
                placeholder="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                data={[
                  { value: '', label: 'All Status' },
                  { value: 'Active', label: 'Active' },
                  { value: 'Inactive', label: 'Inactive' }
                ]}
                size="sm"
                style={{ width: 120 }}
              />

              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Button
                    variant="default"
                    leftSection={<IconColumns size={16} />}
                    size="sm"
                  >
                    Columns
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Visible Columns</Menu.Label>
                  {[
                    { key: 'code', label: 'Code' },
                    { key: 'name', label: 'Item Name' },
                    { key: 'barcode', label: 'Barcode' },
                    { key: 'category', label: 'Category' },
                    { key: 'measurement', label: 'Unit' },
                    { key: 'stock', label: 'Stock' },
                    { key: 'purchasePrice', label: 'Purchase Price' },
                    { key: 'salesRate', label: 'Sales Rate' },
                    { key: 'mrp', label: 'MRP' },
                    { key: 'supplier', label: 'Supplier' },
                    { key: 'gst', label: 'GST %' },
                    { key: 'status', label: 'Status' }
                  ].map(col => (
                    <Menu.Item key={col.key}>
                      <Checkbox
                        label={col.label}
                        checked={visibleColumns[col.key]}
                        onChange={() => toggleColumn(col.key)}
                      />
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>

              <Button.Group>
                <Button
                  variant="default"
                  leftSection={<IconFileTypeXls size={16} />}
                  size="sm"
                  onClick={handleExportExcel}
                >
                  Excel
                </Button>
                <Button
                  variant="default"
                  leftSection={<IconFileTypePdf size={16} />}
                  size="sm"
                  onClick={handleExportPDF}
                >
                  PDF
                </Button>
              </Button.Group>

              {hasActiveFilters && (
                <Button
                  variant="subtle"
                  leftSection={<IconRefresh size={16} />}
                  size="sm"
                  onClick={clearAllFilters}
                >
                  Clear Filters
                </Button>
              )}
            </Group>
          </Group>

          {/* Table Filters */}
          <Group spacing="xs">
            <Select
              placeholder="Filter Category"
              value={tableFilters.category}
              onChange={(value) => handleTableFilterChange('category', value)}
              data={[
                { value: '', label: 'All Categories' },
                ...Array.from(new Set(items.map(item => item.category))).filter(Boolean).map(cat => ({ value: cat, label: cat }))
              ]}
              size="xs"
              style={{ width: 150 }}
            />

            <Select
              placeholder="Filter Supplier"
              value={tableFilters.supplier}
              onChange={(value) => handleTableFilterChange('supplier', value)}
              data={[
                { value: '', label: 'All Suppliers' },
                ...suppliers.map(supplier => ({ value: supplier._id, label: supplier.name }))
              ]}
              size="xs"
              style={{ width: 180 }}
            />

            <Select
              placeholder="Filter Status"
              value={tableFilters.status}
              onChange={(value) => handleTableFilterChange('status', value)}
              data={[
                { value: '', label: 'All Status' },
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' }
              ]}
              size="xs"
              style={{ width: 120 }}
            />
          </Group>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper withBorder radius="md">
        <DataTable
          columns={tableColumns}
          records={paginatedItems}
          fetching={loading}
          totalRecords={filteredItems.length}
          recordsPerPage={pagination.pageSize}
          page={pagination.current}
          onPageChange={(page) => setPagination(prev => ({ ...prev, current: page }))}
          recordsPerPageOptions={[10, 25, 50, 100]}
          onRecordsPerPageChange={(pageSize) => setPagination(prev => ({ ...prev, pageSize, current: 1 }))}
          highlightOnHover
          minHeight={300}
          noRecordsText="No business items found"
          verticalSpacing="sm"
          fontSize="sm"
        />
      </Paper>

      {/* Item Modal */}
      <Modal
        opened={itemModalOpened}
        onClose={closeItemModal}
        title={selectedItem ? 'Edit Business Item' : 'Add New Business Item'}
        size="xl"
        centered
      >
        <form onSubmit={itemForm.onSubmit(handleItemSubmit)}>
          <Stack spacing="md">
            <SimpleGrid cols={3} spacing="md">
              {selectedItem && (
                <TextInput
                  label="Item Code"
                  value={itemForm.values.itemCode}
                  disabled
                />
              )}

              <TextInput
                label="Item Name"
                placeholder="Enter item name"
                withAsterisk
                {...itemForm.getInputProps('itemName')}
              />

              <TextInput
                label="Barcode"
                placeholder="Enter barcode"
                {...itemForm.getInputProps('barcode')}
              />

              <Select
                label="Category"
                withAsterisk
                placeholder="Select category"
                data={[
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
                {...itemForm.getInputProps('category')}
              />

              {!showCustomMeasurement ? (
                <Select
                  label="Measurement"
                  withAsterisk
                  placeholder="Select measurement"
                  data={[
                    { value: 'Pcs', label: 'Pcs' },
                    { value: 'Kg', label: 'Kg' },
                    { value: 'Ltr', label: 'Ltr' },
                    { value: 'Box', label: 'Box' },
                    { value: 'Packet', label: 'Packet' },
                    { value: 'Bottle', label: 'Bottle' },
                    { value: 'Bag', label: 'Bag' },
                    { value: 'Others', label: 'Others' }
                  ]}
                  {...itemForm.getInputProps('measurement')}
                  onChange={(value) => {
                    if (value === 'Others') {
                      setShowCustomMeasurement(true);
                      itemForm.setFieldValue('measurement', '');
                    } else {
                      itemForm.setFieldValue('measurement', value);
                    }
                  }}
                />
              ) : (
                <Group align="flex-end">
                  <TextInput
                    label="Custom Measurement"
                    withAsterisk
                    placeholder="Enter custom unit"
                    style={{ flex: 1 }}
                    {...itemForm.getInputProps('measurement')}
                  />
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={() => {
                      setShowCustomMeasurement(false);
                      itemForm.setFieldValue('measurement', '');
                    }}
                  >
                    Back
                  </Button>
                </Group>
              )}

              <Select
                label="Supplier"
                placeholder="Select supplier"
                data={[
                  { value: '', label: 'No supplier' },
                  ...suppliers.map(supplier => ({
                    value: supplier._id,
                    label: `${supplier.name} (${supplier.supplierId})`
                  }))
                ]}
                {...itemForm.getInputProps('supplier')}
              />
            </SimpleGrid>

            <SimpleGrid cols={4} spacing="md">
              <NumberInput
                label="Purchase Price"
                placeholder="0"
                min={0}
                allowDecimal={true}
                decimalScale={2}
                value={itemForm.values.purchasePrice}
                onChange={(val) => itemForm.setFieldValue('purchasePrice', val || 0)}
              />

              <NumberInput
                label="Sales Rate"
                placeholder="0"
                min={0}
                allowDecimal={true}
                decimalScale={2}
                value={itemForm.values.salesRate}
                onChange={(val) => itemForm.setFieldValue('salesRate', val || 0)}
              />

              <NumberInput
                label="Wholesale Price"
                placeholder="0"
                min={0}
                allowDecimal={true}
                decimalScale={2}
                value={itemForm.values.wholesalePrice}
                onChange={(val) => itemForm.setFieldValue('wholesalePrice', val || 0)}
              />

              <NumberInput
                label="Retail Price"
                placeholder="0"
                min={0}
                allowDecimal={true}
                decimalScale={2}
                value={itemForm.values.retailPrice}
                onChange={(val) => itemForm.setFieldValue('retailPrice', val || 0)}
              />
            </SimpleGrid>

            <SimpleGrid cols={4} spacing="md">
              <NumberInput
                label="MRP"
                placeholder="0"
                min={0}
                allowDecimal={true}
                decimalScale={2}
                value={itemForm.values.mrp}
                onChange={(val) => itemForm.setFieldValue('mrp', val || 0)}
              />

              <NumberInput
                label="GST %"
                placeholder="0"
                min={0}
                max={100}
                allowDecimal={true}
                decimalScale={2}
                value={itemForm.values.gstPercent}
                onChange={(val) => itemForm.setFieldValue('gstPercent', val || 0)}
              />

              <TextInput
                label="HSN Code"
                placeholder="Enter HSN code"
                {...itemForm.getInputProps('hsnCode')}
              />

              <NumberInput
                label="Low Stock Alert"
                placeholder="0"
                min={0}
                value={itemForm.values.lowStockAlert}
                onChange={(val) => itemForm.setFieldValue('lowStockAlert', val || 0)}
              />
            </SimpleGrid>

            <SimpleGrid cols={2} spacing="md">
              <TextInput
                label="Description"
                placeholder="Item description"
                {...itemForm.getInputProps('description')}
              />

              <Select
                label="Status"
                data={[
                  { value: 'Active', label: 'Active' },
                  { value: 'Inactive', label: 'Inactive' }
                ]}
                {...itemForm.getInputProps('status')}
              />
            </SimpleGrid>

            <Group position="right" mt="md">
              <Button variant="default" onClick={closeItemModal}>
                Cancel
              </Button>
              <Button type="submit" color="blue">
                {selectedItem ? 'Update Item' : 'Create Item'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Opening Balance Modal */}
      <Modal
        opened={openingBalanceModalOpened}
        onClose={closeOpeningBalanceModal}
        title="Update Opening Balance"
        size="sm"
        centered
      >
        <form onSubmit={openingBalanceForm.onSubmit(handleOpeningBalanceSubmit)}>
          <Stack spacing="md">
            <TextInput
              label="Item Name"
              value={selectedItemForBalance?.itemName || ''}
              disabled
            />

            <TextInput
              label="Current Opening Balance"
              value={`${selectedItemForBalance?.openingBalance || 0} ${selectedItemForBalance?.measurement || ''}`}
              disabled
            />

            <NumberInput
              label="New Opening Balance"
              placeholder="Enter quantity"
              withAsterisk
              min={0}
              allowDecimal={true}
              decimalScale={2}
              value={openingBalanceForm.values.openingBalance}
              onChange={(val) => openingBalanceForm.setFieldValue('openingBalance', val || 0)}
              error={openingBalanceForm.errors.openingBalance}
            />

            <NumberInput
              label="Rate"
              placeholder="Enter rate"
              withAsterisk
              min={0}
              allowDecimal={true}
              decimalScale={2}
              value={openingBalanceForm.values.rate}
              onChange={(val) => openingBalanceForm.setFieldValue('rate', val || 0)}
              error={openingBalanceForm.errors.rate}
            />

            <Group position="right" mt="md">
              <Button variant="default" onClick={closeOpeningBalanceModal}>
                Cancel
              </Button>
              <Button type="submit" color="blue">
                Update Balance
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Prices Modal */}
      <Modal
        opened={pricesModalOpened}
        onClose={closePricesModal}
        title="Update Prices"
        size="md"
        centered
      >
        <form onSubmit={pricesForm.onSubmit(handlePricesSubmit)}>
          <Stack spacing="md">
            <TextInput
              label="Item Name"
              value={selectedItemForPrices?.itemName || ''}
              disabled
            />

            <SimpleGrid cols={2} spacing="md">
              <NumberInput
                label="Sales Rate"
                placeholder="0"
                min={0}
                allowDecimal={true}
                decimalScale={2}
                value={pricesForm.values.salesRate}
                onChange={(val) => pricesForm.setFieldValue('salesRate', val || 0)}
              />

              <NumberInput
                label="Wholesale Price"
                placeholder="0"
                min={0}
                allowDecimal={true}
                decimalScale={2}
                value={pricesForm.values.wholesalePrice}
                onChange={(val) => pricesForm.setFieldValue('wholesalePrice', val || 0)}
              />

              <NumberInput
                label="Retail Price"
                placeholder="0"
                min={0}
                allowDecimal={true}
                decimalScale={2}
                value={pricesForm.values.retailPrice}
                onChange={(val) => pricesForm.setFieldValue('retailPrice', val || 0)}
              />

              <NumberInput
                label="MRP"
                placeholder="0"
                min={0}
                allowDecimal={true}
                decimalScale={2}
                value={pricesForm.values.mrp}
                onChange={(val) => pricesForm.setFieldValue('mrp', val || 0)}
              />
            </SimpleGrid>

            <Group position="right" mt="md">
              <Button variant="default" onClick={closePricesModal}>
                Cancel
              </Button>
              <Button type="submit" color="blue">
                Update Prices
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
};

export default BusinessItemList;
