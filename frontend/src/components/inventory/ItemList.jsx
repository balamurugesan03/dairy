import { useState, useEffect, useRef,useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  TextInput,
  Select,
  Table,
  Badge,
  ActionIcon,
  Menu,
  Paper,
  Stack,
  Grid,
  Modal,
  Checkbox,
  NumberInput,
  Textarea,
  Pagination,
  Loader,
  Center,
  SimpleGrid,
  Card,
  Divider,
  ScrollArea,
  Box,
  Input,
  UnstyledButton
} from '@mantine/core';
import {
  IconSearch,
  IconFilter,
  IconColumns,
  IconFileExport,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCoin,
  IconBuildingWarehouse,
  IconPercentage,
  IconActivity,
  IconX,
  IconEye,
  IconSortAscending,
  IconSortDescending,
  IconArrowsSort,
  IconFileTypeXls,
  IconFileTypePdf,
  IconLayoutGrid,
  IconList,
  IconChartBar,
  IconAlertCircle,
  IconChevronDown,
  IconSettings,
  IconRefresh
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { DataTable } from 'mantine-datatable';
import { itemAPI, ledgerAPI, supplierAPI } from '../../services/api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ItemList = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ledgers, setLedgers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  
  // Modal states
  const [itemModalOpened, { open: openItemModal, close: closeItemModal }] = useDisclosure(false);
  const [openingBalanceModalOpened, { open: openOpeningBalanceModal, close: closeOpeningBalanceModal }] = useDisclosure(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItemForBalance, setSelectedItemForBalance] = useState(null);
  
  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    code: true,
    name: true,
    category: true,
    measurement: true,
    stock: true,
    supplier: true,
    purchaseLedger: true,
    salesLedger: true,
    gst: true,
    status: true
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Sort state
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

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
      supplier: '',
      gstPercent: 0,
      hsnCode: '',
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
      const response = await itemAPI.getAll();
      setItems(response.data || []);
      setPagination(prev => ({ ...prev, total: response.data?.length || 0 }));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch items',
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
      supplier: item.supplier?._id || '',
      gstPercent: item.gstPercent || 0,
      hsnCode: item.hsnCode || '',
      status: item.status || 'Active'
    });

    const predefinedMeasurements = ['Kg', 'Ltr', 'Pcs', 'Box', 'Bag'];
    setShowCustomMeasurement(item.measurement && !predefinedMeasurements.includes(item.measurement));
    openItemModal();
  };

  const handleDelete = async (id) => {
    modals.openConfirmModal({
      title: 'Delete Item',
      children: (
        <Text size="sm">
          Are you sure you want to permanently delete this item? This will also delete all stock transaction history.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await itemAPI.delete(id);
          notifications.show({
            title: 'Success',
            message: 'Item deleted successfully',
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
        await itemAPI.update(selectedItem._id, values);
        notifications.show({
          title: 'Success',
          message: 'Item updated successfully',
          color: 'green'
        });
      } else {
        await itemAPI.create(values);
        notifications.show({
          title: 'Success',
          message: 'Item created successfully',
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
      rate: item.salesRate || 0
    });
    openOpeningBalanceModal();
  };

  const handleOpeningBalanceSubmit = async (values) => {
    try {
      await itemAPI.updateOpeningBalance(selectedItemForBalance._id, values);
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

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
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
    setSortConfig({ key: null, direction: 'asc' });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  // Filter and sort items
  const filteredItems = items.filter(item => {
    const matchesSearch =
      item.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.itemCode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || item.category === categoryFilter;
    const matchesStatus = !statusFilter || item.status === statusFilter;
    const matchesTableCategory = !tableFilters.category || item.category === tableFilters.category;
    const matchesTableSupplier = !tableFilters.supplier || item.supplier?._id === tableFilters.supplier;
    const matchesTableStatus = !tableFilters.status || item.status === tableFilters.status;

    return matchesSearch && matchesCategory && matchesStatus &&
           matchesTableCategory && matchesTableSupplier && matchesTableStatus;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (!sortConfig.key) return 0;

    let aValue, bValue;

    switch (sortConfig.key) {
      case 'code': aValue = a.itemCode || ''; bValue = b.itemCode || ''; break;
      case 'name': aValue = a.itemName || ''; bValue = b.itemName || ''; break;
      case 'category': aValue = a.category || ''; bValue = b.category || ''; break;
      case 'measurement': aValue = a.measurement || ''; bValue = b.measurement || ''; break;
      case 'stock': aValue = a.currentBalance || 0; bValue = b.currentBalance || 0; break;
      case 'gst': aValue = a.gstPercent || 0; bValue = b.gstPercent || 0; break;
      case 'status': aValue = a.status || ''; bValue = b.status || ''; break;
      default: return 0;
    }

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginate items
  const paginatedItems = useMemo(() => {
    const startIndex = (pagination.current - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    return sortedItems.slice(startIndex, endIndex);
  }, [sortedItems, pagination]);

  // Stats
  const totalItems = items.length;
  const activeItems = items.filter(item => item.status === 'Active').length;
  const lowStock = items.filter(item => item.currentBalance < 10).length;

  const hasActiveFilters = searchTerm || categoryFilter || statusFilter ||
                           tableFilters.category || tableFilters.supplier || tableFilters.status;

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }));
  };

  const handleLedgerClick = (item, ledgerType) => {
    const ledger = ledgerType === 'purchase' ? item.purchaseLedger : item.salesLedger;
    if (ledger) {
      const categoryName = item.category;
      const ledgerTypeName = ledgerType === 'purchase' ? 'Purchase Ledger' : 'Sales Ledger';
      const displayName = `${categoryName} ${ledgerTypeName}`;
      navigate(`/ledgers/${ledger._id}?name=${encodeURIComponent(displayName)}`);
    }
  };

  const handleExportExcel = () => {
    const exportData = sortedItems.map(item => ({
      'Code': item.itemCode,
      'Item Name': item.itemName,
      'Category': item.category,
      'Measurement': item.measurement,
      'Stock': `${item.currentBalance} ${item.measurement}`,
      'Supplier': item.supplier?.name || '-',
      'Purchase Ledger': item.purchaseLedger?.ledgerName || '-',
      'Sales Ledger': item.salesLedger?.ledgerName || '-',
      'GST %': `${item.gstPercent || 0}%`,
      'Status': item.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Items');

    ws['!cols'] = [
      { wch: 10 }, { wch: 25 }, { wch: 15 }, { wch: 12 },
      { wch: 15 }, { wch: 20 }, { wch: 25 },
      { wch: 25 }, { wch: 8 }, { wch: 10 }
    ];

    XLSX.writeFile(wb, `Items_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    notifications.show({
      title: 'Success',
      message: 'Exported to Excel successfully',
      color: 'green'
    });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(16);
    doc.text('Item Master Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = sortedItems.map(item => [
      item.itemCode,
      item.itemName,
      item.category,
      item.measurement,
      `${item.currentBalance} ${item.measurement}`,
      item.supplier?.name || '-',
      item.purchaseLedger?.ledgerName || '-',
      item.salesLedger?.ledgerName || '-',
      `${item.gstPercent || 0}%`,
      item.status
    ]);

    doc.autoTable({
      startY: 28,
      head: [['Code', 'Item Name', 'Category', 'Unit', 'Stock', 'Supplier', 'Purchase Ledger', 'Sales Ledger', 'GST%', 'Status']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [24, 144, 255], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 15 }, 1: { cellWidth: 30 }, 2: { cellWidth: 20 },
        3: { cellWidth: 12 }, 4: { cellWidth: 20 }, 5: { cellWidth: 25 },
        6: { cellWidth: 30 }, 7: { cellWidth: 30 }, 8: { cellWidth: 12 },
        9: { cellWidth: 15 }
      }
    });

    doc.save(`Items_${new Date().toISOString().split('T')[0]}.pdf`);
    
    notifications.show({
      title: 'Success',
      message: 'Exported to PDF successfully',
      color: 'green'
    });
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <IconArrowsSort size={14} />;
    }
    return sortConfig.direction === 'asc' ? 
      <IconSortAscending size={14} /> : 
      <IconSortDescending size={14} />;
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
      width: 100
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
    visibleColumns.category && {
      accessor: 'category',
      title: 'Category',
      render: (item) => item.category,
      width: 120
    },
    visibleColumns.measurement && {
      accessor: 'measurement',
      title: 'Measurement',
      render: (item) => item.measurement,
      width: 100
    },
    visibleColumns.stock && {
      accessor: 'stock',
      title: 'Stock',
      render: (item) => (
        <Badge
          color={
            item.currentBalance < 10 ? 'red' :
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
    visibleColumns.supplier && {
      accessor: 'supplier',
      title: 'Supplier',
      render: (item) => item.supplier?.name || '-',
      width: 150
    },
    visibleColumns.purchaseLedger && {
      accessor: 'purchaseLedger',
      title: 'Purchase Ledger',
      render: (item) => (
        item.purchaseLedger ? (
          <UnstyledButton
            onClick={(e) => {
              e.stopPropagation();
              handleLedgerClick(item, 'purchase');
            }}
            style={{ textDecoration: 'underline', color: 'blue' }}
          >
            {item.purchaseLedger.ledgerName}
          </UnstyledButton>
        ) : '-'
      ),
      width: 180
    },
    visibleColumns.salesLedger && {
      accessor: 'salesLedger',
      title: 'Sales Ledger',
      render: (item) => (
        item.salesLedger ? (
          <UnstyledButton
            onClick={(e) => {
              e.stopPropagation();
              handleLedgerClick(item, 'sales');
            }}
            style={{ textDecoration: 'underline', color: 'green' }}
          >
            {item.salesLedger.ledgerName}
          </UnstyledButton>
        ) : '-'
      ),
      width: 180
    },
    visibleColumns.gst && {
      accessor: 'gstPercent',
      title: 'GST %',
      render: (item) => `${item.gstPercent || 0}%`,
      width: 80
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
      width: 100
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
            color="red"
            onClick={() => handleDelete(item._id)}
            title="Delete"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ),
      width: 140
    }
  ].filter(Boolean);

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Group position="apart" mb="xl">
        <div>
          <Title order={2}>Item Master</Title>
          <Text color="dimmed" size="sm">Manage your inventory items</Text>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={handleAdd}
          size="sm"
        >
          Add Item
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
          value={sortedItems.length}
          color="#722ed1"
        />
      </SimpleGrid>

      {/* Search & Filters */}
      <Paper p="md" withBorder mb="md">
        <Stack>
          <Group position="apart">
            <TextInput
              placeholder="Search by name or code..."
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
                  { value: 'Feed', label: 'Feeds' },
                  { value: 'CattleFeed', label: 'CattleFeed' },
                  { value: 'Medicine', label: 'Medicine' },
                  { value: 'Equipment', label: 'Equipment' },
                  { value: 'Dairy Products', label: 'Dairy Products' },
                  { value: 'Minerals', label: 'Minerals' },
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
                    { key: 'category', label: 'Category' },
                    { key: 'measurement', label: 'Measurement' },
                    { key: 'stock', label: 'Stock' },
                    { key: 'supplier', label: 'Supplier' },
                    { key: 'purchaseLedger', label: 'Purchase Ledger' },
                    { key: 'salesLedger', label: 'Sales Ledger' },
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
                ...Array.from(new Set(items.map(item => item.category))).map(cat => ({ value: cat, label: cat }))
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
          noRecordsText="No items found"
          verticalSpacing="sm"
          fontSize="sm"
        />
      </Paper>

      {/* Item Modal */}
      <Modal
        opened={itemModalOpened}
        onClose={closeItemModal}
        title={selectedItem ? 'Edit Item' : 'Add New Item'}
        size="lg"
        centered
      >
        <form onSubmit={itemForm.onSubmit(handleItemSubmit)}>
          <Stack spacing="md">
            <SimpleGrid cols={2} spacing="md">
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
              
              <Select
                label="Category"
                withAsterisk
                placeholder="Select category"
                data={[
                  { value: 'Feed', label: 'Feeds' },
                  { value: 'CattleFeed', label: 'CattleFeed' },
                  { value: 'Medicine', label: 'Medicine' },
                  { value: 'Equipment', label: 'Equipment' },
                  { value: 'Dairy Products', label: 'Dairy Products' },
                  { value: 'Minerals', label: 'Minerals' },
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
                    { value: 'Kg', label: 'Kg' },
                    { value: 'Ltr', label: 'Ltr' },
                    { value: 'Pcs', label: 'Pcs' },
                    { value: 'Box', label: 'Box' },
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
              
              <TextInput
                label="Unit (Optional)"
                placeholder="Count/Number"
                {...itemForm.getInputProps('unit')}
              />
              
              <Select
                label="Supplier (Optional)"
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
    </Container>
  );
};

export default ItemList;