import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
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
  TextInput,
  NumberInput,
  Card,
  Alert,
  Loader,
  Center,
  Divider,
  Grid,
  Badge,
  ActionIcon,
  Modal,
  ScrollArea,
  SegmentedControl,
  ThemeIcon,
  Checkbox,
  Tooltip
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconPlus,
  IconTrash,
  IconX,
  IconUser,
  IconPhone,
  IconPackage,
  IconCurrencyRupee,
  IconBuilding,
  IconCash,
  IconPrinter,
  IconSearch,
  IconCheck,
  IconShoppingCart,
  IconBarcode,
  IconCreditCard,
  IconDeviceFloppy,
  IconFileInvoice,
  IconReceipt2,
  IconCalendar,
  IconQrcode,
  IconUserCircle,
  IconCoin,
  IconTruck,
  IconUsers,
  IconEdit,
  IconAlertTriangle
} from '@tabler/icons-react';
import { farmerAPI, itemAPI, salesAPI, customerAPI, collectionCenterAPI, subsidyAPI, stockAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

const BillingForm = () => {
  const navigate = useNavigate();
  const printRef = useRef();
  const { selectedCompany } = useCompany();

  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [collectionCenters, setCollectionCenters] = useState([]);
  const [subsidies, setSubsidies] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedFarmerNumber, setSelectedFarmerNumber] = useState('');
  const [billItems, setBillItems] = useState([]);
  const [printModalOpened, setPrintModalOpened] = useState(false);
  const [printSize, setPrintSize] = useState('3');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [dateBills, setDateBills] = useState([]);
  const [loadingDateBills, setLoadingDateBills] = useState(false);

  // New state for the improved workflow
  const [billActive, setBillActive] = useState(false);
  const [nextBillNumber, setNextBillNumber] = useState('01');
  const [editingId, setEditingId] = useState(null);
  const [editingBillNumber, setEditingBillNumber] = useState('');
  const [cycleBlocked, setCycleBlocked] = useState(false);
  const [cycleMessage, setCycleMessage] = useState('');

  const form = useForm({
    initialValues: {
      billDate: new Date(),
      collectionCenterId: null,
      customerType: 'Farmer',
      customerId: null,
      customerName: '',
      customerPhone: '',
      itemId: null,
      quantity: 1,
      rate: '',
      subsidyId: null,
      paymentMode: 'Cash',
      paidAmount: '',
      discount: 0,
      discountPercent: 0,
      roundOff: 0
    },
    validate: (values) => {
      if (!billActive) return {};
      const errors = {};
      if (values.customerType === 'Farmer' && !values.customerId) {
        errors.customerId = 'Please select a farmer';
      } else if (values.customerType === 'Customer' && !values.customerId) {
        errors.customerId = 'Please select a customer';
      } else if (values.customerType === 'Other' && !values.customerName) {
        errors.customerName = 'Please enter customer name';
      }
      return errors;
    }
  });

  const [calculations, setCalculations] = useState({
    subtotal: 0, totalGst: 0, discount: 0, totalSubsidy: 0,
    roundOff: 0, grandTotal: 0, oldBalance: 0, totalDue: 0
  });

  useEffect(() => {
    fetchItems();
    fetchFarmers();
    fetchCustomers();
    fetchCollectionCenters();
    fetchSubsidies();
    fetchNextBillNumber();
  }, []);

  useEffect(() => {
    calculateTotals();
  }, [billItems, form.values.discount, form.values.discountPercent]);

  useEffect(() => {
    if (form.values.billDate) {
      fetchBillsByDate(form.values.billDate);
    }
  }, [form.values.billDate]);

  const fetchNextBillNumber = async () => {
    try {
      const res = await salesAPI.getNextBillNumber();
      setNextBillNumber(res.data?.billNumber || '01');
    } catch (e) { /* silent */ }
  };

  const fetchBillsByDate = async (date) => {
    try {
      setLoadingDateBills(true);
      const startDate = dayjs(date).startOf('day').toISOString();
      const endDate = dayjs(date).endOf('day').toISOString();
      const response = await salesAPI.getAll({ startDate, endDate, limit: 100 });
      const bills = response?.data || response || [];
      setDateBills(Array.isArray(bills) ? bills : []);
    } catch (error) {
      setDateBills([]);
    } finally {
      setLoadingDateBills(false);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await itemAPI.getAll({ limit: 10000, status: 'Active' });
      const itemsData = response?.data || response || [];
      setItems(Array.isArray(itemsData) ? itemsData : []);
    } catch (error) {
      notifications.show({ title: 'Error', message: 'Failed to fetch items', color: 'red' });
      setItems([]);
    }
  };

  const fetchFarmers = async () => {
    try {
      const response = await farmerAPI.getAll();
      const farmersData = response?.data || response || [];
      setFarmers(Array.isArray(farmersData) ? farmersData.filter(f => f.status === 'Active') : []);
    } catch (error) {
      setFarmers([]);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await customerAPI.getAll();
      const customersData = response?.data || response || [];
      setCustomers(Array.isArray(customersData) ? customersData.filter(c => c.active !== false) : []);
    } catch (error) {
      setCustomers([]);
    }
  };

  const fetchCollectionCenters = async () => {
    try {
      const response = await collectionCenterAPI.getAll();
      const centersData = response?.data || response || [];
      setCollectionCenters(Array.isArray(centersData) ? centersData.filter(c => c.status === 'Active') : []);
    } catch (error) {
      setCollectionCenters([]);
    }
  };

  const fetchSubsidies = async () => {
    try {
      const response = await subsidyAPI.getAll();
      const subsidiesData = response?.data || response || [];
      setSubsidies(Array.isArray(subsidiesData) ? subsidiesData.filter(s => s.status === 'Active') : []);
    } catch (error) {
      setSubsidies([]);
    }
  };

  const fetchPreviousBalance = async (customerId) => {
    try {
      const response = await salesAPI.getCustomerHistory(customerId);
      const sales = response?.data || response || [];
      return Array.isArray(sales) ? sales.reduce((sum, sale) => sum + (sale.balanceAmount || 0), 0) : 0;
    } catch (error) {
      return 0;
    }
  };

  // ── Date change with cycle check ─────────────────────────────────────────
  const handleDateChange = async (value) => {
    form.setFieldValue('billDate', value);
    setCycleBlocked(false);
    setCycleMessage('');
    if (!value) return;
    try {
      const res = await stockAPI.checkSaleDate(value.toISOString());
      if (res.data?.blocked) {
        setCycleBlocked(true);
        setCycleMessage(res.data.message);
      }
    } catch (e) { /* silent */ }
  };

  // ── New Bill / Cancel ────────────────────────────────────────────────────
  const handleNewBill = () => {
    setBillItems([]);
    setSelectedCustomer(null);
    setSelectedFarmerNumber('');
    setEditingId(null);
    setEditingBillNumber('');
    form.setValues(prev => ({
      ...prev,
      customerType: 'Farmer',
      customerId: null,
      customerName: '',
      customerPhone: '',
      itemId: null,
      quantity: 1,
      rate: '',
      paymentMode: 'Cash',
      paidAmount: '',
      discount: 0,
      discountPercent: 0,
      roundOff: 0
    }));
    setCalculations({ subtotal: 0, totalGst: 0, discount: 0, totalSubsidy: 0, roundOff: 0, grandTotal: 0, oldBalance: 0, totalDue: 0 });
    setBarcodeInput('');
    setBillActive(true);
  };

  const handleCancelBill = () => {
    setBillActive(false);
    setEditingId(null);
    setEditingBillNumber('');
    setBillItems([]);
    setSelectedCustomer(null);
    setSelectedFarmerNumber('');
    form.setValues(prev => ({
      ...prev,
      customerType: 'Farmer',
      customerId: null,
      customerName: '',
      customerPhone: '',
      itemId: null,
      quantity: 1,
      rate: '',
      paymentMode: 'Cash',
      paidAmount: '',
      discount: 0,
      discountPercent: 0,
      roundOff: 0
    }));
    setCalculations({ subtotal: 0, totalGst: 0, discount: 0, totalSubsidy: 0, roundOff: 0, grandTotal: 0, oldBalance: 0, totalDue: 0 });
  };

  // ── Edit / Delete a bill from the date-bills grid ────────────────────────
  const handleEditBill = async (billId) => {
    try {
      const res = await salesAPI.getById(billId);
      const bill = res.data;

      const loadedItems = (bill.items || []).map(item => ({
        itemId: item.itemId?._id || item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        hsnCode: item.hsnCode || '',
        unit: item.unit || '',
        quantity: item.quantity,
        rate: item.rate,
        amount: item.amount,
        gstPercent: item.gstPercent || 0,
        gstAmount: item.gstAmount || 0,
        totalAmount: item.totalAmount,
        subsidyId: item.subsidyId,
        subsidyName: item.subsidyName || '',
        subsidyAmount: item.subsidyAmount || 0,
        subsidyEnabled: (item.subsidyAmount || 0) > 0
      }));

      setBillItems(loadedItems);
      setEditingId(bill._id);
      setEditingBillNumber(bill.billNumber || '');
      setBillActive(true);

      form.setValues(prev => ({
        ...prev,
        collectionCenterId: bill.collectionCenterId?._id || bill.collectionCenterId || prev.collectionCenterId,
        customerType: bill.customerType || 'Other',
        customerId: bill.customerId?._id || bill.customerId || null,
        customerName: bill.customerName || '',
        customerPhone: bill.customerPhone || '',
        paymentMode: bill.paymentMode || 'Cash',
        paidAmount: bill.paidAmount || '',
        discount: bill.discount || 0,
        discountPercent: 0,
        roundOff: bill.roundOff || 0,
        itemId: null,
        quantity: 1,
        rate: ''
      }));

      // Restore customer selection display
      if (bill.customerType === 'Farmer') {
        const cid = bill.customerId?._id || bill.customerId;
        const farmer = farmers.find(f => f._id === cid);
        if (farmer) { setSelectedCustomer(farmer); setSelectedFarmerNumber(farmer.farmerNumber || ''); }
      } else if (bill.customerType === 'Customer') {
        const cid = bill.customerId?._id || bill.customerId;
        const customer = customers.find(c => c._id === cid);
        if (customer) setSelectedCustomer(customer);
      }
    } catch (e) {
      notifications.show({ title: 'Error', message: 'Failed to load bill for editing', color: 'red' });
    }
  };

  const handleDeleteBill = (bill) => {
    modals.openConfirmModal({
      title: 'Delete Bill',
      children: (
        <Text size="sm">
          Delete Bill <strong>#{bill.billNumber}</strong> for <strong>{bill.customerName || 'Walk-in'}</strong>?
          This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await salesAPI.delete(bill._id);
          notifications.show({ title: 'Deleted', message: `Bill #${bill.billNumber} deleted`, color: 'green' });
          fetchBillsByDate(form.values.billDate);
          fetchNextBillNumber();
          if (editingId === bill._id) handleCancelBill();
        } catch (e) {
          notifications.show({ title: 'Error', message: e.message || 'Failed to delete', color: 'red' });
        }
      }
    });
  };

  // ── Customer selection ───────────────────────────────────────────────────
  const handleCustomerTypeChange = (type) => {
    form.setValues({ ...form.values, customerType: type, customerId: null, customerName: '', customerPhone: '' });
    setSelectedCustomer(null);
    setSelectedFarmerNumber('');
    setCalculations(prev => ({ ...prev, oldBalance: 0 }));
  };

  const handleFarmerSelect = async (farmerId) => {
    if (!farmerId) {
      setSelectedCustomer(null);
      setSelectedFarmerNumber('');
      form.setValues({ ...form.values, customerId: null, customerName: '', customerPhone: '' });
      setCalculations(prev => ({ ...prev, oldBalance: 0 }));
      return;
    }
    const farmer = farmers.find(f => f._id === farmerId);
    if (farmer) {
      setSelectedCustomer(farmer);
      setSelectedFarmerNumber(farmer.farmerNumber || '');
      form.setValues({ ...form.values, customerId: farmerId, customerName: farmer.personalDetails?.name || '', customerPhone: farmer.personalDetails?.phone || '' });
      const previousBalance = await fetchPreviousBalance(farmerId);
      setCalculations(prev => ({ ...prev, oldBalance: previousBalance }));
    }
  };

  const handleCustomerSelect = async (customerId) => {
    if (!customerId) {
      setSelectedCustomer(null);
      form.setValues({ ...form.values, customerId: null, customerName: '', customerPhone: '' });
      setCalculations(prev => ({ ...prev, oldBalance: 0 }));
      return;
    }
    const customer = customers.find(c => c._id === customerId);
    if (customer) {
      setSelectedCustomer(customer);
      form.setValues({ ...form.values, customerId, customerName: customer.name || '', customerPhone: customer.phone || '' });
      const previousBalance = await fetchPreviousBalance(customerId);
      setCalculations(prev => ({ ...prev, oldBalance: (customer.openingBalance || 0) + previousBalance }));
    }
  };

  // ── Item entry ───────────────────────────────────────────────────────────
  const handleBarcodeInput = (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const item = items.find(i => i.itemCode === barcodeInput.trim());
      if (item) {
        form.setFieldValue('itemId', item._id);
        form.setFieldValue('rate', item.salesRate || 0);
        setTimeout(() => handleAddItem(), 100);
      } else {
        notifications.show({ title: 'Item not found', message: 'No item found with this code', color: 'orange' });
      }
      setBarcodeInput('');
    }
  };

  const handleItemSelect = (itemId) => {
    form.setFieldValue('itemId', itemId);
    if (itemId) {
      const item = items.find(i => i._id === itemId);
      if (item) form.setFieldValue('rate', item.salesRate || 0);
    }
  };

  const handleAddItem = () => {
    const { itemId, quantity, rate } = form.values;
    if (!itemId || !quantity) {
      notifications.show({ title: 'Error', message: 'Please select item and enter quantity', color: 'red' });
      return;
    }
    const item = items.find(i => i._id === itemId);
    if (!item) return;
    const qty = parseFloat(quantity) || 0;
    const itemRate = parseFloat(rate) || item.salesRate || 0;
    if (qty > item.currentBalance) {
      notifications.show({ title: 'Insufficient Stock', message: `Available: ${item.currentBalance} ${item.unit}`, color: 'red' });
      return;
    }
    const amount = qty * itemRate;
    const gstPercent = item.gstPercent || 0;
    const gstAmount = (amount * gstPercent) / 100;
    const totalAmount = amount + gstAmount;
    const existingIndex = billItems.findIndex(bi => bi.itemId === item._id);
    if (existingIndex > -1) {
      const updatedItems = [...billItems];
      const existing = updatedItems[existingIndex];
      const newQty = existing.quantity + qty;
      const newAmount = newQty * itemRate;
      const newGstAmount = (newAmount * gstPercent) / 100;
      updatedItems[existingIndex] = { ...existing, quantity: newQty, amount: newAmount, gstAmount: newGstAmount, totalAmount: newAmount + newGstAmount };
      setBillItems(updatedItems);
    } else {
      setBillItems([...billItems, {
        itemId: item._id, itemCode: item.itemCode, itemName: item.itemName,
        hsnCode: item.hsnCode || '', unit: item.unit || item.measurement || '',
        quantity: qty, rate: itemRate, amount, gstPercent, gstAmount, totalAmount,
        subsidyId: item.subsidyId?._id || item.subsidyId || null,
        subsidyName: item.subsidyId?.subsidyName || '',
        subsidyAmount: item.subsidyAmount || 0,
        subsidyEnabled: (item.subsidyAmount || 0) > 0
      }]);
    }
    form.setFieldValue('itemId', null);
    form.setFieldValue('quantity', 1);
    form.setFieldValue('rate', '');
    setBarcodeInput('');
  };

  const handleRemoveItem = (index) => setBillItems(billItems.filter((_, i) => i !== index));

  const handleItemQuantityChange = (index, newQty) => {
    const updatedItems = [...billItems];
    const item = updatedItems[index];
    const amount = newQty * item.rate;
    const gstAmount = (amount * item.gstPercent) / 100;
    updatedItems[index] = { ...item, quantity: newQty, amount, gstAmount, totalAmount: amount + gstAmount };
    setBillItems(updatedItems);
  };

  const handleItemRateChange = (index, newRate) => {
    const updatedItems = [...billItems];
    const item = updatedItems[index];
    const amount = item.quantity * newRate;
    const gstAmount = (amount * item.gstPercent) / 100;
    updatedItems[index] = { ...item, rate: newRate, amount, gstAmount, totalAmount: amount + gstAmount };
    setBillItems(updatedItems);
  };

  const calculateTotals = () => {
    const subtotal = billItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalGst = billItems.reduce((sum, item) => sum + (item.gstAmount || 0), 0);
    const totalSubsidy = billItems.reduce((sum, item) => sum + (item.subsidyEnabled ? (item.subsidyAmount || 0) : 0), 0);
    let discount = 0;
    if (form.values.discountPercent > 0) {
      discount = (subtotal * form.values.discountPercent) / 100;
    } else {
      discount = parseFloat(form.values.discount) || 0;
    }
    const netAmount = subtotal - discount + totalGst - totalSubsidy;
    const roundOff = parseFloat(form.values.roundOff) || (Math.round(netAmount) - netAmount);
    const grandTotal = netAmount + roundOff;
    setCalculations(prev => ({ ...prev, subtotal, totalGst, discount, totalSubsidy, roundOff, grandTotal, totalDue: grandTotal + prev.oldBalance }));
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    onAfterPrint: () => {
      setPrintModalOpened(false);
      handleCancelBill();
    }
  });

  // ── Submit (create or update) ─────────────────────────────────────────────
  const handleSubmit = async () => {
    const validation = form.validate();
    if (validation.hasErrors) return;
    if (billItems.length === 0) {
      notifications.show({ title: 'Error', message: 'Please add at least one item', color: 'red' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        billDate: form.values.billDate ? form.values.billDate.toISOString() : new Date().toISOString(),
        customerType: form.values.customerType,
        customerId: (form.values.customerType === 'Farmer' || form.values.customerType === 'Customer') ? form.values.customerId : null,
        customerName: form.values.customerName,
        customerPhone: form.values.customerPhone,
        items: billItems.map(bi => ({
          ...bi,
          subsidyId: bi.subsidyEnabled ? bi.subsidyId : null,
          subsidyAmount: bi.subsidyEnabled ? bi.subsidyAmount : 0
        })),
        subtotal: calculations.subtotal,
        totalGst: calculations.totalGst,
        discount: calculations.discount,
        totalSubsidy: calculations.totalSubsidy,
        roundOff: calculations.roundOff,
        grandTotal: calculations.grandTotal,
        oldBalance: calculations.oldBalance,
        totalDue: calculations.totalDue,
        collectionCenterId: form.values.collectionCenterId || null,
        subsidyId: form.values.subsidyId || null,
        paymentMode: form.values.paymentMode,
        paidAmount: parseFloat(form.values.paidAmount) || 0,
        balanceAmount: calculations.totalDue - (parseFloat(form.values.paidAmount) || 0)
      };

      let savedBillNumber = editingBillNumber;
      if (editingId) {
        await salesAPI.update(editingId, payload);
        notifications.show({ title: 'Updated', message: `Bill #${editingBillNumber} updated`, color: 'green' });
      } else {
        const res = await salesAPI.create(payload);
        savedBillNumber = res.data?.billNumber || nextBillNumber;
        notifications.show({ title: 'Saved', message: `Bill #${savedBillNumber} created`, color: 'green' });
      }

      fetchNextBillNumber();
      fetchBillsByDate(form.values.billDate);
      setPrintModalOpened(true);
    } catch (error) {
      notifications.show({ title: 'Error', message: error.message || 'Failed to save bill', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  // ── Derived values ───────────────────────────────────────────────────────
  const itemOptions = items.map(item => ({
    value: item._id,
    label: `${item.itemCode} - ${item.itemName} (Stock: ${item.currentBalance} ${item.unit})`
  }));

  const farmerOptions = farmers.map(farmer => ({
    value: farmer._id,
    label: `${farmer.farmerNumber || ''} - ${farmer.personalDetails?.name || 'N/A'}${farmer.memberId ? ` | ${farmer.memberId}` : ''}`
  }));

  const customerOptions = customers.map(customer => ({
    value: customer._id,
    label: `${customer.customerId || ''} - ${customer.name}${customer.phone ? ` | ${customer.phone}` : ''}`
  }));

  const paidAmount = parseFloat(form.values.paidAmount) || 0;
  const changeAmount = paidAmount - calculations.totalDue;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Container size="xl" py="md">
      {/* HEADER */}
      <Paper withBorder p="md" mb="md" radius="md">
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon size={40} radius="md" variant="light" color="blue">
              <IconFileInvoice size={24} />
            </ThemeIcon>
            <div>
              <Title order={3}>Inventory Sales</Title>
              {editingId ? (
                <Text size="sm" c="orange" fw={600}>Editing Bill #{editingBillNumber}</Text>
              ) : billActive ? (
                <Text size="sm" c="teal" fw={600}>New Bill #{nextBillNumber}</Text>
              ) : (
                <Text size="sm" c="dimmed">Next Bill #{nextBillNumber}</Text>
              )}
            </div>
          </Group>
          <Button variant="default" leftSection={<IconX size={16} />} onClick={() => navigate('/')}>
            Close
          </Button>
        </Group>
      </Paper>

      <Grid gutter="md">
        {/* LEFT PANEL */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">

            {/* ── Top section: Collection Center → Date → New Bill ── */}
            <Paper withBorder p="md" radius="md">
              <Grid gutter="sm" align="flex-end">
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <Select
                    label="Collection Center"
                    placeholder="Select center..."
                    value={form.values.collectionCenterId}
                    onChange={(value) => form.setFieldValue('collectionCenterId', value)}
                    data={collectionCenters.map(c => ({ value: c._id, label: c.centerName || 'Unnamed' }))}
                    clearable
                    leftSection={<IconBuilding size={16} />}
                    disabled={billActive}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <DateInput
                    label="Date"
                    placeholder="Select date"
                    value={form.values.billDate}
                    onChange={handleDateChange}
                    leftSection={<IconCalendar size={16} />}
                    maxDate={new Date()}
                    disabled={billActive}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  {!billActive ? (
                    <Button
                      fullWidth
                      leftSection={<IconReceipt2 size={16} />}
                      onClick={handleNewBill}
                      disabled={!form.values.billDate || cycleBlocked}
                      color="teal"
                    >
                      New Bill
                    </Button>
                  ) : (
                    <Button
                      fullWidth
                      variant="light"
                      color="gray"
                      leftSection={<IconX size={16} />}
                      onClick={handleCancelBill}
                    >
                      Cancel Bill
                    </Button>
                  )}
                </Grid.Col>
              </Grid>

              {cycleBlocked && (
                <Alert icon={<IconAlertTriangle size={14} />} color="red" variant="light" mt="sm" p="xs">
                  <Text size="xs">{cycleMessage}</Text>
                </Alert>
              )}
            </Paper>

            {/* ── Bill form — shown only when billActive ── */}
            {billActive && (
              <>
                {/* Customer Details */}
                <Paper withBorder p="md" radius="md">
                  <Text fw={600} c="blue" mb="sm">Customer Details</Text>
                  <Grid gutter="sm">
                    <Grid.Col span={12}>
                      <SegmentedControl
                        value={form.values.customerType}
                        onChange={handleCustomerTypeChange}
                        fullWidth
                        size="sm"
                        data={[
                          { value: 'Farmer', label: (<Center style={{ gap: 6 }}><IconTruck size={16} /><Text size="sm">Farmer</Text></Center>) },
                          { value: 'Customer', label: (<Center style={{ gap: 6 }}><IconUsers size={16} /><Text size="sm">Customer</Text></Center>) },
                          { value: 'Other', label: (<Center style={{ gap: 6 }}><IconUserCircle size={16} /><Text size="sm">Other</Text></Center>) }
                        ]}
                      />
                    </Grid.Col>

                    {form.values.customerType === 'Farmer' ? (
                      <>
                        <Grid.Col span={6}>
                          <Select
                            label="Select Farmer" placeholder="Search farmer..."
                            value={form.values.customerId} onChange={handleFarmerSelect}
                            data={farmerOptions} error={form.errors.customerId}
                            searchable clearable leftSection={<IconSearch size={16} />}
                          />
                        </Grid.Col>
                        <Grid.Col span={3}>
                          <TextInput label="Farmer Name" value={form.values.customerName} readOnly leftSection={<IconUser size={16} />} />
                        </Grid.Col>
                        <Grid.Col span={3}>
                          <TextInput label="Phone" value={form.values.customerPhone} readOnly leftSection={<IconPhone size={16} />} />
                        </Grid.Col>
                      </>
                    ) : form.values.customerType === 'Customer' ? (
                      <>
                        <Grid.Col span={6}>
                          <Select
                            label="Select Customer" placeholder="Search customer..."
                            value={form.values.customerId} onChange={handleCustomerSelect}
                            data={customerOptions} error={form.errors.customerId}
                            searchable clearable leftSection={<IconSearch size={16} />}
                          />
                        </Grid.Col>
                        <Grid.Col span={3}>
                          <TextInput label="Customer Name" value={form.values.customerName} readOnly leftSection={<IconUser size={16} />} />
                        </Grid.Col>
                        <Grid.Col span={3}>
                          <TextInput label="Phone" value={form.values.customerPhone} readOnly leftSection={<IconPhone size={16} />} />
                        </Grid.Col>
                      </>
                    ) : (
                      <>
                        <Grid.Col span={6}>
                          <TextInput
                            label="Customer Name" placeholder="Enter customer name"
                            value={form.values.customerName} onChange={(e) => form.setFieldValue('customerName', e.target.value)}
                            error={form.errors.customerName} leftSection={<IconUser size={16} />}
                          />
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <TextInput
                            label="Phone Number" placeholder="Phone number"
                            value={form.values.customerPhone} onChange={(e) => form.setFieldValue('customerPhone', e.target.value)}
                            leftSection={<IconPhone size={16} />}
                          />
                        </Grid.Col>
                      </>
                    )}
                  </Grid>
                </Paper>

                {/* Item Entry */}
                <Paper withBorder p="md" radius="md">
                  <Text fw={600} c="blue" mb="sm">Add Items</Text>
                  <TextInput
                    placeholder="Scan barcode or enter item code and press Enter..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={handleBarcodeInput}
                    leftSection={<IconBarcode size={16} />}
                    mb="sm"
                  />
                  <Grid gutter="sm" align="flex-end">
                    <Grid.Col span={5}>
                      <Tooltip
                        opened={!!form.values.itemId}
                        position="bottom-start"
                        withArrow
                        multiline
                        w={260}
                        label={(() => {
                          if (!form.values.itemId) return '';
                          const sel = items.find(i => i._id === form.values.itemId);
                          if (!sel) return '';
                          return (
                            <Stack gap={2}>
                              <Text size="xs" fw={600}>{sel.itemName}</Text>
                              <Text size="xs">Stock: <Text span fw={700} c={sel.currentBalance > 0 ? 'lime.3' : 'red.3'}>{sel.currentBalance} {sel.unit}</Text></Text>
                              <Text size="xs">Rate: <Text span fw={600}>₹{sel.salesRate || 0}</Text></Text>
                              {sel.subsidyAmount > 0 && <Text size="xs" c="lime.3">Subsidy: ₹{sel.subsidyAmount}</Text>}
                            </Stack>
                          );
                        })()}
                      >
                        <Select
                          label="Item" placeholder="Search item..."
                          value={form.values.itemId} onChange={handleItemSelect}
                          data={itemOptions} searchable clearable
                          leftSection={<IconPackage size={16} />}
                        />
                      </Tooltip>
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <NumberInput label="Qty" value={form.values.quantity} onChange={(value) => form.setFieldValue('quantity', value)} min={0.01} step={1} decimalScale={2} />
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <NumberInput label="Rate" value={form.values.rate} onChange={(value) => form.setFieldValue('rate', value)} min={0} decimalScale={2} leftSection={<IconCurrencyRupee size={14} />} />
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <Button fullWidth leftSection={<IconPlus size={16} />} onClick={handleAddItem} color="green">Add</Button>
                    </Grid.Col>
                  </Grid>
                </Paper>

                {/* Items Table */}
                <Paper withBorder radius="md">
                  <ScrollArea h={300}>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>#</Table.Th>
                          <Table.Th>Item</Table.Th>
                          <Table.Th>HSN</Table.Th>
                          <Table.Th style={{ textAlign: 'center' }}>Qty</Table.Th>
                          <Table.Th>Unit</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Rate</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>GST</Table.Th>
                          <Table.Th style={{ textAlign: 'center' }}>Subsidy</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                          <Table.Th></Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {billItems.length === 0 ? (
                          <Table.Tr>
                            <Table.Td colSpan={10}>
                              <Center py="xl">
                                <Stack align="center" gap={4}>
                                  <IconShoppingCart size={32} style={{ opacity: 0.25 }} />
                                  <Text c="dimmed">No items added yet</Text>
                                </Stack>
                              </Center>
                            </Table.Td>
                          </Table.Tr>
                        ) : billItems.map((item, index) => (
                          <Table.Tr key={index}>
                            <Table.Td>{index + 1}</Table.Td>
                            <Table.Td>
                              <Text size="sm" fw={500}>{item.itemName}</Text>
                              <Text size="xs" c="dimmed">{item.itemCode}</Text>
                            </Table.Td>
                            <Table.Td><Text size="xs">{item.hsnCode || '-'}</Text></Table.Td>
                            <Table.Td>
                              <NumberInput value={item.quantity} onChange={(value) => handleItemQuantityChange(index, value)} min={0.01} step={1} decimalScale={2} size="xs" w={70} />
                            </Table.Td>
                            <Table.Td><Text size="xs" c="dimmed">{item.unit}</Text></Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>
                              <NumberInput value={item.rate} onChange={(value) => handleItemRateChange(index, value)} min={0} decimalScale={2} size="xs" w={80} hideControls />
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>
                              <Text size="sm">{item.gstPercent}%</Text>
                              <Text size="xs" c="dimmed">{item.gstAmount?.toFixed(2)}</Text>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              {item.subsidyAmount > 0 ? (
                                <Stack gap={2} align="center">
                                  <Checkbox
                                    size="xs"
                                    checked={item.subsidyEnabled}
                                    onChange={(e) => {
                                      const checked = e.currentTarget?.checked ?? !item.subsidyEnabled;
                                      const updated = [...billItems];
                                      updated[index] = { ...updated[index], subsidyEnabled: checked };
                                      setBillItems(updated);
                                    }}
                                    label={<Text size="xs" c={item.subsidyEnabled ? 'green' : 'dimmed'} fw={500}>{item.subsidyName || 'Subsidy'}</Text>}
                                    color="green"
                                  />
                                  {item.subsidyEnabled && <Text size="xs" c="green" fw={600}>-{(item.subsidyAmount || 0).toFixed(2)}</Text>}
                                </Stack>
                              ) : <Text size="xs" c="dimmed">-</Text>}
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>
                              <Text size="sm" fw={600}>{item.totalAmount?.toFixed(2)}</Text>
                            </Table.Td>
                            <Table.Td>
                              <ActionIcon color="red" variant="light" size="sm" onClick={() => handleRemoveItem(index)}>
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </Paper>
              </>
            )}

            {/* ── Date Bills Grid (always visible) ── */}
            {loadingDateBills && (
              <Paper withBorder p="sm" radius="md">
                <Center><Group gap="xs"><Loader size="xs" /><Text size="sm" c="dimmed">Loading bills...</Text></Group></Center>
              </Paper>
            )}

            {dateBills.length > 0 && (
              <Paper withBorder p="md" radius="md">
                <Group justify="space-between" mb="sm">
                  <Group gap="xs">
                    <IconReceipt2 size={18} style={{ opacity: 0.6 }} />
                    <Text fw={600} size="sm">Bills on {dayjs(form.values.billDate).format('DD-MM-YYYY')}</Text>
                    <Badge size="sm" variant="light" color="blue">{dateBills.length}</Badge>
                  </Group>
                </Group>
                <ScrollArea h={dateBills.length > 5 ? 220 : undefined}>
                  <Table striped highlightOnHover withTableBorder withColumnBorders size="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>#</Table.Th>
                        <Table.Th>Bill No</Table.Th>
                        <Table.Th>Customer</Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Paid</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Balance</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Payment</Table.Th>
                        <Table.Th>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {dateBills.map((bill, idx) => (
                        <Table.Tr key={bill._id} bg={editingId === bill._id ? 'var(--mantine-color-orange-0)' : undefined}>
                          <Table.Td>{idx + 1}</Table.Td>
                          <Table.Td><Text size="xs" fw={500}>{bill.billNumber}</Text></Table.Td>
                          <Table.Td><Text size="xs">{bill.customerName || 'Walk-in'}</Text></Table.Td>
                          <Table.Td><Badge size="xs" variant="light">{bill.customerType || '-'}</Badge></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text size="xs" fw={600}>{(bill.grandTotal || 0).toFixed(2)}</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text size="xs" c="green">{(bill.paidAmount || 0).toFixed(2)}</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="xs" c={(bill.balanceAmount || 0) > 0 ? 'red' : 'dimmed'}>{(bill.balanceAmount || 0).toFixed(2)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="xs" color={bill.status === 'Paid' ? 'green' : bill.status === 'Partial' ? 'orange' : 'red'}>
                              {bill.status || 'Pending'}
                            </Badge>
                          </Table.Td>
                          <Table.Td><Text size="xs" c="dimmed">{bill.paymentMode || '-'}</Text></Table.Td>
                          <Table.Td>
                            <Group gap={4}>
                              <ActionIcon size="xs" variant="light" color="blue" title="Edit"
                                onClick={() => handleEditBill(bill._id)}>
                                <IconEdit size={12} />
                              </ActionIcon>
                              <ActionIcon size="xs" variant="light" color="red" title="Delete"
                                onClick={() => handleDeleteBill(bill)}>
                                <IconTrash size={12} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Paper>
            )}
          </Stack>
        </Grid.Col>

        {/* RIGHT PANEL — Bill Summary (only when bill is active) */}
        {billActive && (
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Paper withBorder p="md" radius="md" style={{ position: 'sticky', top: 80 }}>
              <Stack gap="md">
                <Text fw={700} size="lg" ta="center" c="blue">Bill Summary</Text>

                {(form.values.customerName || selectedCustomer) && (
                  <Card withBorder p="xs" radius="sm" bg="blue.0">
                    <Group justify="space-between" mb={4}>
                      <Text size="sm" fw={600}>{form.values.customerName}</Text>
                      <Badge color="blue" size="sm">{form.values.customerType}</Badge>
                    </Group>
                    {form.values.customerPhone && (
                      <Group gap={4}>
                        <IconPhone size={12} style={{ opacity: 0.5 }} />
                        <Text size="xs" c="dimmed">{form.values.customerPhone}</Text>
                      </Group>
                    )}
                    {selectedFarmerNumber && <Text size="xs" c="dimmed">Farmer #{selectedFarmerNumber}</Text>}
                    {calculations.oldBalance > 0 && (
                      <Badge color="orange" variant="light" size="xs" mt={4} fullWidth>
                        Old Balance: {calculations.oldBalance.toFixed(2)}
                      </Badge>
                    )}
                  </Card>
                )}

                <Stack gap={6}>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Items ({billItems.length})</Text>
                    <Text size="sm">{billItems.reduce((s, i) => s + i.quantity, 0)} units</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Subtotal</Text>
                    <Text size="sm">{calculations.subtotal.toFixed(2)}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Total GST</Text>
                    <Text size="sm" c="orange">+{calculations.totalGst.toFixed(2)}</Text>
                  </Group>

                  <Divider variant="dashed" />

                  <Group justify="space-between" align="flex-start">
                    <Text size="sm" c="dimmed">Discount</Text>
                    <Group gap={4}>
                      <NumberInput value={form.values.discountPercent} onChange={(value) => { form.setFieldValue('discountPercent', value); form.setFieldValue('discount', 0); }} min={0} max={100} size="xs" w={60} rightSection={<Text size="xs">%</Text>} />
                      <Text size="xs">or</Text>
                      <NumberInput value={form.values.discount} onChange={(value) => { form.setFieldValue('discount', value); form.setFieldValue('discountPercent', 0); }} min={0} size="xs" w={80} leftSection={<Text size="xs">₹</Text>} />
                    </Group>
                  </Group>
                  {calculations.discount > 0 && <Group justify="flex-end"><Text size="sm" c="red">-{calculations.discount.toFixed(2)}</Text></Group>}
                  {calculations.totalSubsidy > 0 && (
                    <Group justify="space-between">
                      <Text size="sm" c="green" fw={500}>Subsidy</Text>
                      <Text size="sm" c="green" fw={500}>-{calculations.totalSubsidy.toFixed(2)}</Text>
                    </Group>
                  )}
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Round Off</Text>
                    <NumberInput value={form.values.roundOff} onChange={(value) => form.setFieldValue('roundOff', value)} size="xs" w={80} decimalScale={2} step={0.01} />
                  </Group>

                  <Divider />

                  <Group justify="space-between">
                    <Text fw={700} size="lg">Grand Total</Text>
                    <Text fw={700} size="lg" c="green">{calculations.grandTotal.toFixed(2)}</Text>
                  </Group>
                  {calculations.oldBalance > 0 && (
                    <>
                      <Group justify="space-between">
                        <Text size="sm" c="orange">Old Balance</Text>
                        <Text size="sm" c="orange">{calculations.oldBalance.toFixed(2)}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text fw={600}>Total Due</Text>
                        <Text fw={600} c="red">{calculations.totalDue.toFixed(2)}</Text>
                      </Group>
                    </>
                  )}
                </Stack>

                <Divider label="Payment" labelPosition="center" />

                <SegmentedControl
                  value={form.values.paymentMode}
                  onChange={(value) => form.setFieldValue('paymentMode', value)}
                  fullWidth size="xs"
                  data={[
                    { value: 'Cash', label: (<Center style={{ gap: 4 }}><IconCash size={14} /><Text size="xs">Cash</Text></Center>) },
                    { value: 'Credit', label: (<Center style={{ gap: 4 }}><IconCoin size={14} /><Text size="xs">Credit</Text></Center>) },
                    { value: 'UPI', label: (<Center style={{ gap: 4 }}><IconQrcode size={14} /><Text size="xs">UPI</Text></Center>) },
                    { value: 'Card', label: (<Center style={{ gap: 4 }}><IconCreditCard size={14} /><Text size="xs">Card</Text></Center>) }
                  ]}
                />

                <NumberInput
                  label="Paid Amount" placeholder="Amount received"
                  value={form.values.paidAmount}
                  onChange={(value) => form.setFieldValue('paidAmount', value)}
                  min={0} decimalScale={2}
                  leftSection={<IconCurrencyRupee size={16} />}
                  onKeyDown={(e) => { if (e.key === 'Enter' && billItems.length > 0 && !saving) { e.preventDefault(); handleSubmit(); } }}
                />

                {paidAmount > 0 && (
                  <Card p="xs" bg={changeAmount >= 0 ? 'green.0' : 'orange.0'}>
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>{changeAmount >= 0 ? 'Change' : 'Balance Due'}</Text>
                      <Text size="sm" fw={600} c={changeAmount >= 0 ? 'green' : 'orange'}>{Math.abs(changeAmount).toFixed(2)}</Text>
                    </Group>
                  </Card>
                )}

                <Button size="lg" fullWidth leftSection={<IconDeviceFloppy size={20} />}
                  onClick={handleSubmit} loading={saving}
                  disabled={billItems.length === 0} color="green">
                  {editingId ? 'Update Bill' : 'Save & Print Bill'}
                </Button>

                <Group grow>
                  <Button variant="light" color="gray" leftSection={<IconX size={14} />} onClick={handleCancelBill}>
                    Cancel
                  </Button>
                  <Button variant="light" leftSection={<IconPrinter size={16} />}
                    onClick={() => printRef.current && handlePrint()} disabled={billItems.length === 0}>
                    Print
                  </Button>
                </Group>
              </Stack>
            </Paper>
          </Grid.Col>
        )}
      </Grid>

      {/* Print Success Modal */}
      <Modal opened={printModalOpened} onClose={() => { setPrintModalOpened(false); handleCancelBill(); }} title="Bill Saved" centered>
        <Stack>
          <Alert color="green" icon={<IconCheck size={16} />}>
            <Text size="sm">Bill has been saved successfully!</Text>
          </Alert>
          <SegmentedControl value={printSize} onChange={setPrintSize} fullWidth
            data={[{ value: '2', label: '2 inch (58mm)' }, { value: '3', label: '3 inch (80mm)' }]} />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => { setPrintModalOpened(false); handleCancelBill(); }}>New Bill</Button>
            <Button data-autofocus leftSection={<IconPrinter size={16} />} onClick={handlePrint} color="green">Print Bill</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Hidden Thermal Print Section */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <style dangerouslySetInnerHTML={{ __html: `@media print { @page { margin: 0; size: ${printSize === '2' ? '58mm' : '80mm'} auto; } body { margin: 0; } }` }} />
          <div style={{ width: printSize === '2' ? '48mm' : '72mm', fontFamily: "'Courier New', monospace", fontSize: printSize === '2' ? '8px' : '10px', padding: printSize === '2' ? '2mm' : '4mm', lineHeight: 1.3 }}>
            <div style={{ textAlign: 'center', marginBottom: '4px' }}>
              <div style={{ fontWeight: 'bold', fontSize: printSize === '2' ? '10px' : '13px' }}>{selectedCompany?.companyName || 'DAIRY COOPERATIVE'}</div>
              <div>{selectedCompany?.address || ''}</div>
              {selectedCompany?.phone && <div>Ph: {selectedCompany.phone}</div>}
              {selectedCompany?.gstNumber && <div>GSTIN: {selectedCompany.gstNumber}</div>}
            </div>
            <div style={{ borderTop: '1px dashed #000', margin: '3px 0' }} />
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: printSize === '2' ? '9px' : '11px' }}>SALES BILL</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>No: {editingBillNumber || nextBillNumber}</span>
              <span>{dayjs(form.values.billDate).format('DD/MM/YY')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{form.values.customerName || 'Walk-in'}</span>
              <span>{form.values.paymentMode}</span>
            </div>
            {selectedFarmerNumber && <div>Farmer #: {selectedFarmerNumber}</div>}
            {form.values.customerPhone && <div>Ph: {form.values.customerPhone}</div>}
            <div style={{ borderTop: '1px dashed #000', margin: '3px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span style={{ flex: 1 }}>Item</span>
              <span style={{ width: printSize === '2' ? '28px' : '35px', textAlign: 'right' }}>Qty</span>
              <span style={{ width: printSize === '2' ? '32px' : '40px', textAlign: 'right' }}>Rate</span>
              <span style={{ width: printSize === '2' ? '36px' : '45px', textAlign: 'right' }}>Amt</span>
            </div>
            <div style={{ borderTop: '1px dashed #000', margin: '2px 0' }} />
            {billItems.map((item, index) => (
              <div key={index} style={{ marginBottom: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.itemName}</span>
                  <span style={{ width: printSize === '2' ? '28px' : '35px', textAlign: 'right' }}>{item.quantity}</span>
                  <span style={{ width: printSize === '2' ? '32px' : '40px', textAlign: 'right' }}>{item.rate.toFixed(0)}</span>
                  <span style={{ width: printSize === '2' ? '36px' : '45px', textAlign: 'right' }}>{item.totalAmount?.toFixed(2)}</span>
                </div>
                {item.gstAmount > 0 && <div style={{ fontSize: printSize === '2' ? '7px' : '8px', color: '#555', paddingLeft: '4px' }}>GST {item.gstPercent}%: {item.gstAmount.toFixed(2)}</div>}
                {item.subsidyEnabled && item.subsidyAmount > 0 && <div style={{ fontSize: printSize === '2' ? '7px' : '8px', color: '#555', paddingLeft: '4px' }}>Subsidy ({item.subsidyName}): -{item.subsidyAmount.toFixed(2)}</div>}
              </div>
            ))}
            <div style={{ borderTop: '1px dashed #000', margin: '3px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal:</span><span>{calculations.subtotal.toFixed(2)}</span></div>
            {calculations.totalGst > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>GST:</span><span>+{calculations.totalGst.toFixed(2)}</span></div>}
            {calculations.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount:</span><span>-{calculations.discount.toFixed(2)}</span></div>}
            {calculations.totalSubsidy > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subsidy:</span><span>-{calculations.totalSubsidy.toFixed(2)}</span></div>}
            {calculations.roundOff !== 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Round Off:</span><span>{calculations.roundOff.toFixed(2)}</span></div>}
            <div style={{ borderTop: '1px solid #000', margin: '3px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: printSize === '2' ? '10px' : '12px' }}>
              <span>TOTAL:</span><span>Rs.{calculations.grandTotal.toFixed(2)}</span>
            </div>
            {calculations.oldBalance > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Old Balance:</span><span>{calculations.oldBalance.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}><span>Total Due:</span><span>Rs.{calculations.totalDue.toFixed(2)}</span></div>
              </>
            )}
            {paidAmount > 0 && (
              <>
                <div style={{ borderTop: '1px dashed #000', margin: '3px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Paid ({form.values.paymentMode}):</span><span>{paidAmount.toFixed(2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}><span>Balance:</span><span>Rs.{Math.max(0, calculations.totalDue - paidAmount).toFixed(2)}</span></div>
              </>
            )}
            <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
            <div style={{ textAlign: 'center', fontSize: printSize === '2' ? '7px' : '8px' }}>
              <div>Thank you for your business!</div>
              <div>Goods once sold will not be taken back</div>
            </div>
            <div style={{ borderTop: '1px dashed #000', margin: '3px 0' }} />
          </div>
        </div>
      </div>
    </Container>
  );
};

export default BillingForm;
