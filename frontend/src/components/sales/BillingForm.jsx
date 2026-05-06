/**
 * Dairy Billing Form - Vyapar Style
 * ===================================
 * Modern invoice/billing interface for Dairy Cooperative
 * Same design layout as BusinessBillingForm
 */

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
import {
  IconPlus,
  IconTrash,
  IconX,
  IconUser,
  IconPhone,
  IconPackage,
  IconCurrencyRupee,
  IconBuilding,
  IconDiscount,
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
  IconAlertCircle,
  IconLock,
  IconCircleCheck
} from '@tabler/icons-react';
import { farmerAPI, itemAPI, salesAPI, customerAPI, collectionCenterAPI, subsidyAPI } from '../../services/api';
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
  const [printSize, setPrintSize] = useState('3'); // '2' = 58mm, '3' = 80mm
  const [barcodeInput, setBarcodeInput] = useState('');
  const [dateBills, setDateBills] = useState([]);
  const [loadingDateBills, setLoadingDateBills] = useState(false);
  const [billNumber, setBillNumber] = useState('01');
  const [formReady, setFormReady] = useState(false);
  const [dateError, setDateError] = useState('');
  const [checkingDate, setCheckingDate] = useState(false);

  const form = useForm({
    initialValues: {
      billDate: new Date(),
      customerType: 'Farmer',
      customerId: null,
      customerName: '',
      customerPhone: '',
      itemId: null,
      quantity: 1,
      rate: '',
      collectionCenterId: null,
      subsidyId: null,
      paymentMode: 'Cash',
      paidAmount: '',
      discount: 0,
      discountPercent: 0,
      roundOff: 0
    },
    validate: (values) => {
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
    subtotal: 0,
    totalGst: 0,
    discount: 0,
    totalSubsidy: 0,
    roundOff: 0,
    grandTotal: 0,
    oldBalance: 0,
    totalDue: 0
  });

  useEffect(() => {
    fetchItems();
    fetchFarmers();
    fetchCustomers();
    fetchCollectionCenters();
    fetchSubsidies();
  }, []);

  const fetchNextBillNumber = async () => {
    try {
      const response = await salesAPI.getNextBillNumber();
      if (response?.data?.billNumber) {
        setBillNumber(response.data.billNumber);
      }
    } catch (error) {
      console.error('Failed to fetch bill number:', error);
    }
  };

  const handleDateChange = async (value) => {
    form.setFieldValue('billDate', value);
    setFormReady(false);
    setDateError('');
    if (!value) return;

    setCheckingDate(true);
    try {
      const response = await salesAPI.checkDate(value.toISOString());
      if (response?.data?.blocked) {
        setDateError(response.data.message);
      } else {
        await fetchNextBillNumber();
        fetchBillsByDate(value);
        setFormReady(true);
      }
    } catch {
      // Network error — allow entry, backend will block if needed
      await fetchNextBillNumber();
      setFormReady(true);
    } finally {
      setCheckingDate(false);
    }
  };

  useEffect(() => {
    calculateTotals();
  }, [billItems, form.values.discount, form.values.discountPercent]);


  const fetchBillsByDate = async (date) => {
    try {
      setLoadingDateBills(true);
      const startDate = dayjs(date).startOf('day').toISOString();
      const endDate = dayjs(date).endOf('day').toISOString();
      const response = await salesAPI.getAll({ startDate, endDate, limit: 100 });
      const bills = response?.data || response || [];
      setDateBills(Array.isArray(bills) ? bills : []);
    } catch (error) {
      console.error('Error fetching bills by date:', error);
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
      notifications.show({ title: 'Error', message: 'Failed to fetch farmers', color: 'red' });
      setFarmers([]);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await customerAPI.getAll();
      const customersData = response?.data || response || [];
      setCustomers(Array.isArray(customersData) ? customersData.filter(c => c.active !== false) : []);
    } catch (error) {
      notifications.show({ title: 'Error', message: 'Failed to fetch customers', color: 'red' });
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
      console.error('Error fetching previous balance:', error);
      return 0;
    }
  };

  const handleCustomerTypeChange = (type) => {
    form.setValues({
      ...form.values,
      customerType: type,
      customerId: null,
      customerName: '',
      customerPhone: ''
    });
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
      form.setValues({
        ...form.values,
        customerId: farmerId,
        customerName: farmer.personalDetails?.name || '',
        customerPhone: farmer.personalDetails?.phone || ''
      });

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
      form.setValues({
        ...form.values,
        customerId: customerId,
        customerName: customer.name || '',
        customerPhone: customer.phone || ''
      });

      const previousBalance = await fetchPreviousBalance(customerId);
      const totalOldBalance = (customer.openingBalance || 0) + previousBalance;
      setCalculations(prev => ({ ...prev, oldBalance: totalOldBalance }));
    }
  };

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
      if (item) {
        form.setFieldValue('rate', item.salesRate || 0);
      }
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
      notifications.show({
        title: 'Insufficient Stock',
        message: `Available: ${item.currentBalance} ${item.unit}`,
        color: 'red'
      });
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

      updatedItems[existingIndex] = {
        ...existing,
        quantity: newQty,
        amount: newAmount,
        gstAmount: newGstAmount,
        totalAmount: newAmount + newGstAmount
      };
      setBillItems(updatedItems);
    } else {
      const newItem = {
        itemId: item._id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        hsnCode: item.hsnCode || '',
        unit: item.unit || item.measurement || '',
        quantity: qty,
        rate: itemRate,
        amount,
        gstPercent,
        gstAmount,
        totalAmount,
        subsidyId: item.subsidyId?._id || item.subsidyId || null,
        subsidyName: item.subsidyId?.subsidyName || '',
        subsidyAmount: item.subsidyAmount || 0,
        subsidyEnabled: (item.subsidyAmount || 0) > 0
      };
      setBillItems([...billItems, newItem]);
    }

    form.setFieldValue('itemId', null);
    form.setFieldValue('quantity', 1);
    form.setFieldValue('rate', '');
    setBarcodeInput('');
  };

  const handleRemoveItem = (index) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const handleItemQuantityChange = (index, newQty) => {
    const updatedItems = [...billItems];
    const item = updatedItems[index];
    const amount = newQty * item.rate;
    const gstAmount = (amount * item.gstPercent) / 100;

    updatedItems[index] = {
      ...item,
      quantity: newQty,
      amount,
      gstAmount,
      totalAmount: amount + gstAmount
    };
    setBillItems(updatedItems);
  };

  const handleItemRateChange = (index, newRate) => {
    const updatedItems = [...billItems];
    const item = updatedItems[index];
    const amount = item.quantity * newRate;
    const gstAmount = (amount * item.gstPercent) / 100;

    updatedItems[index] = {
      ...item,
      rate: newRate,
      amount,
      gstAmount,
      totalAmount: amount + gstAmount
    };
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

    setCalculations(prev => ({
      ...prev,
      subtotal,
      totalGst,
      discount,
      totalSubsidy,
      roundOff,
      grandTotal,
      totalDue: grandTotal + prev.oldBalance
    }));
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    onAfterPrint: () => {
      setPrintModalOpened(false);
      resetForm();
    }
  });

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

      await salesAPI.create(payload);

      notifications.show({ title: 'Success', message: 'Bill created successfully', color: 'green' });
      setPrintModalOpened(true);
      fetchNextBillNumber();
      if (form.values.billDate) fetchBillsByDate(form.values.billDate);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create bill',
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    form.reset();
    setBillItems([]);
    setSelectedCustomer(null);
    setSelectedFarmerNumber('');
    setCalculations({
      subtotal: 0,
      totalGst: 0,
      discount: 0,
      totalSubsidy: 0,
      roundOff: 0,
      grandTotal: 0,
      oldBalance: 0,
      totalDue: 0
    });
    setBarcodeInput('');
    setFormReady(false);
    setDateError('');
    setDateBills([]);
  };

  const itemOptions = items.map(item => ({
    value: item._id,
    label: `${item.itemCode} - ${item.itemName} (Stock: ${item.currentBalance} ${item.unit})`
  }));

  const farmerOptions = farmers.map(farmer => ({
    value: farmer._id,
    label: `${farmer.farmerNumber || ''} - ${farmer.personalDetails?.name || 'N/A'} ${farmer.memberId ? ` | ${farmer.memberId}` : ''}`
  }));

  const customerOptions = customers.map(customer => ({
    value: customer._id,
    label: `${customer.customerId || ''} - ${customer.name} ${customer.phone ? `| ${customer.phone}` : ''}`
  }));

  const paidAmount = parseFloat(form.values.paidAmount) || 0;
  const changeAmount = paidAmount - calculations.totalDue;

  return (
    <Container size="xl" py="md">
      {/* ============ HEADER ============ */}
      <Paper withBorder p="md" mb="md" radius="md">
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon size={40} radius="md" variant="light" color="blue">
              <IconFileInvoice size={24} />
            </ThemeIcon>
            <div>
              <Title order={3}>Inventory Sales</Title>
              <Text size="sm" c="dimmed">{billNumber}</Text>
            </div>
          </Group>
          <Group>
           <DateInput
  value={form.values.billDate}
  onChange={handleDateChange}
  leftSection={checkingDate ? <Loader size={14} /> : <IconCalendar size={16} />}
  placeholder="Select bill date first"
  size="xs"
  w={185}
  maxDate={new Date()}
  error={!!dateError}
  styles={{ input: { justifyContent: 'center', borderColor: dateError ? 'var(--mantine-color-red-6)' : formReady ? 'var(--mantine-color-green-6)' : undefined } }}
/>
{formReady && <IconCircleCheck size={20} color="var(--mantine-color-green-6)" />}
{dateError && <IconAlertCircle size={20} color="var(--mantine-color-red-6)" />}

            <Button
              variant="light"
              leftSection={<IconReceipt2 size={16} />}
              onClick={resetForm}
            >
              New Bill
            </Button>
            <Button
              variant="default"
              leftSection={<IconX size={16} />}
              onClick={() => navigate('/')}
            >
              Close
            </Button>
          </Group>
        </Group>
      </Paper>

   
     

      {/* ============ DATE STATUS ALERTS ============ */}
      {!form.values.billDate && (
        <Alert color="blue" icon={<IconCalendar size={16} />} mb="md" radius="md">
          Select a bill date above to start billing
        </Alert>
      )}
      {dateError && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} mb="md" radius="md" withCloseButton onClose={() => setDateError('')}>
          {dateError}
        </Alert>
      )}

      {/* ============ TWO-COLUMN GRID ============ */}
      <Grid gutter="md" style={{ opacity: formReady ? 1 : 0.45, pointerEvents: formReady ? 'auto' : 'none' }}>

        {/* ======== LEFT PANEL (span 8) ======== */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">

            {/* Customer / Party Details */}
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
                      { value: 'Farmer', label: (
                        <Center style={{ gap: 6 }}><IconTruck size={16} /><Text size="sm">Farmer</Text></Center>
                      )},
                      { value: 'Customer', label: (
                        <Center style={{ gap: 6 }}><IconUsers size={16} /><Text size="sm">Customer</Text></Center>
                      )},
                      { value: 'Other', label: (
                        <Center style={{ gap: 6 }}><IconUserCircle size={16} /><Text size="sm">Other</Text></Center>
                      )},
                    ]}
                  />
                </Grid.Col>

                {form.values.customerType === 'Farmer' ? (
                  <>
                    <Grid.Col span={6}>
                      <Select
                        label="Select Farmer"
                        placeholder="Search farmer..."
                        value={form.values.customerId}
                        onChange={handleFarmerSelect}
                        data={farmerOptions}
                        error={form.errors.customerId}
                        searchable
                        clearable
                        leftSection={<IconSearch size={16} />}
                      />
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <TextInput
                        label="Farmer Name"
                        value={form.values.customerName}
                        readOnly
                        leftSection={<IconUser size={16} />}
                      />
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <TextInput
                        label="Phone"
                        value={form.values.customerPhone}
                        readOnly
                        leftSection={<IconPhone size={16} />}
                      />
                    </Grid.Col>
                  </>
                ) : form.values.customerType === 'Customer' ? (
                  <>
                    <Grid.Col span={6}>
                      <Select
                        label="Select Customer"
                        placeholder="Search customer..."
                        value={form.values.customerId}
                        onChange={handleCustomerSelect}
                        data={customerOptions}
                        error={form.errors.customerId}
                        searchable
                        clearable
                        leftSection={<IconSearch size={16} />}
                      />
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <TextInput
                        label="Customer Name"
                        value={form.values.customerName}
                        readOnly
                        leftSection={<IconUser size={16} />}
                      />
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <TextInput
                        label="Phone"
                        value={form.values.customerPhone}
                        readOnly
                        leftSection={<IconPhone size={16} />}
                      />
                    </Grid.Col>
                  </>
                ) : (
                  <>
                    <Grid.Col span={6}>
                      <TextInput
                        label="Customer Name"
                        placeholder="Enter customer name"
                        value={form.values.customerName}
                        onChange={(e) => form.setFieldValue('customerName', e.target.value)}
                        error={form.errors.customerName}
                        leftSection={<IconUser size={16} />}
                      />
                    </Grid.Col>
                    <Grid.Col span={6}>
                      <TextInput
                        label="Phone Number"
                        placeholder="Phone number"
                        value={form.values.customerPhone}
                        onChange={(e) => form.setFieldValue('customerPhone', e.target.value)}
                        leftSection={<IconPhone size={16} />}
                      />
                    </Grid.Col>
                  </>
                )}

                {/* Collection Center & Subsidy */}
                <Grid.Col span={6}>
                  <Select
                    label="Collection Center"
                    placeholder="Select center..."
                    value={form.values.collectionCenterId}
                    onChange={(value) => form.setFieldValue('collectionCenterId', value)}
                    data={collectionCenters.map(c => ({ value: c._id, label: c.centerName || 'Unnamed Center' }))}
                    clearable
                    leftSection={<IconBuilding size={16} />}
                  />
                </Grid.Col>
                {/* <Grid.Col span={6}>
                  <Select
                    label="Subsidy"
                    placeholder="Select subsidy..."
                    value={form.values.subsidyId}
                    onChange={(value) => form.setFieldValue('subsidyId', value)}
                    data={subsidies.map(s => ({ value: s._id, label: s.subsidyName || 'Unnamed' }))}
                    clearable
                    leftSection={<IconDiscount size={16} />}
                  />
                </Grid.Col> */}
              </Grid>
            </Paper>

            {/* Item Entry */}
            <Paper withBorder p="md" radius="md">
              <Text fw={600} c="blue" mb="sm">Add Items</Text>

              {/* Barcode Scanner */}
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
                          <Group gap={6}>
                            <Text size="xs">Stock: <Text span fw={700} c={sel.currentBalance > 0 ? 'lime.3' : 'red.3'}>{sel.currentBalance} {sel.unit || sel.measurement}</Text></Text>
                          </Group>
                          <Text size="xs">Rate: <Text span fw={600}>Rs.{sel.salesRate || 0}</Text></Text>
                          {sel.subsidyAmount > 0 && (
                            <Text size="xs" c="lime.3">Subsidy: {sel.subsidyId?.subsidyName || 'Yes'} - Rs.{sel.subsidyAmount}</Text>
                          )}
                        </Stack>
                      );
                    })()}
                  >
                    <Select
                      label="Item"
                      placeholder="Search item..."
                      value={form.values.itemId}
                      onChange={handleItemSelect}
                      data={itemOptions}
                      searchable
                      clearable
                      leftSection={<IconPackage size={16} />}
                    />
                  </Tooltip>
                </Grid.Col>
                <Grid.Col span={2}>
                  <NumberInput
                    label="Qty"
                    value={form.values.quantity}
                    onChange={(value) => form.setFieldValue('quantity', value)}
                    min={0.01}
                    step={1}
                    decimalScale={2}
                  />
                </Grid.Col>
                <Grid.Col span={3}>
                  <NumberInput
                    label="Rate"
                    value={form.values.rate}
                    onChange={(value) => form.setFieldValue('rate', value)}
                    min={0}
                    decimalScale={2}
                    leftSection={<IconCurrencyRupee size={14} />}
                  />
                </Grid.Col>
                <Grid.Col span={2}>
                  <Button
                    fullWidth
                    leftSection={<IconPlus size={16} />}
                    onClick={handleAddItem}
                    color="green"
                  >
                    Add
                  </Button>
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
                    ) : (
                      billItems.map((item, index) => (
                        <Table.Tr key={index}>
                          <Table.Td>{index + 1}</Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={500}>{item.itemName}</Text>
                            <Text size="xs" c="dimmed">{item.itemCode}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs">{item.hsnCode || '-'}</Text>
                          </Table.Td>
                          <Table.Td>
                            <NumberInput
                              value={item.quantity}
                              onChange={(value) => handleItemQuantityChange(index, value)}
                              min={0.01}
                              step={1}
                              decimalScale={2}
                              size="xs"
                              w={70}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">{item.unit}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <NumberInput
                              value={item.rate}
                              onChange={(value) => handleItemRateChange(index, value)}
                              min={0}
                              decimalScale={2}
                              size="xs"
                              w={80}
                              hideControls
                            />
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
                                    const updatedItems = [...billItems];
                                    updatedItems[index] = { ...updatedItems[index], subsidyEnabled: checked };
                                    setBillItems(updatedItems);
                                  }}
                                  label={
                                    <Text size="xs" c={item.subsidyEnabled ? 'green' : 'dimmed'} fw={500}>
                                      {item.subsidyName || 'Subsidy'}
                                    </Text>
                                  }
                                  color="green"
                                />
                                {item.subsidyEnabled && (
                                  <Text size="xs" c="green" fw={600}>-{(item.subsidyAmount || 0).toFixed(2)}</Text>
                                )}
                              </Stack>
                            ) : (
                              <Text size="xs" c="dimmed">-</Text>
                            )}
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="sm" fw={600}>{item.totalAmount?.toFixed(2)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <ActionIcon
                              color="red"
                              variant="light"
                              size="sm"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Paper>

            {/* Date Bills - today's bills for reference */}
            {loadingDateBills && (
              <Paper withBorder p="sm" radius="md">
                <Center>
                  <Group gap="xs">
                    <Loader size="xs" />
                    <Text size="sm" c="dimmed">Loading bills...</Text>
                  </Group>
                </Center>
              </Paper>
            )}

            {dateBills.length > 0 && (
              <Paper withBorder p="md" radius="md">
                <Group justify="space-between" mb="sm">
                  <Group gap="xs">
                    <IconReceipt2 size={18} style={{ opacity: 0.6 }} />
                    <Text fw={600} size="sm">
                      Bills on {dayjs(form.values.billDate).format('DD-MM-YYYY')}
                    </Text>
                    <Badge size="sm" variant="light" color="blue">{dateBills.length}</Badge>
                  </Group>
                </Group>
                <ScrollArea h={dateBills.length > 5 ? 200 : undefined}>
                  <Table striped highlightOnHover withTableBorder withColumnBorders>
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
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {dateBills.map((bill, idx) => (
                        <Table.Tr key={bill._id}>
                          <Table.Td>{idx + 1}</Table.Td>
                          <Table.Td>
                            <Text size="xs" fw={500}>{bill.billNumber}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs">{bill.customerName || 'Walk-in'}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="xs" variant="light">{bill.customerType || '-'}</Badge>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="xs" fw={600}>{(bill.grandTotal || 0).toFixed(2)}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="xs" c="green">{(bill.paidAmount || 0).toFixed(2)}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="xs" c={(bill.balanceAmount || 0) > 0 ? 'red' : 'dimmed'}>
                              {(bill.balanceAmount || 0).toFixed(2)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              size="xs"
                              color={bill.status === 'Paid' ? 'green' : bill.status === 'Partial' ? 'orange' : 'red'}
                            >
                              {bill.status || 'Pending'}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">{bill.paymentMode || '-'}</Text>
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

        {/* ======== RIGHT PANEL - Summary (span 4) ======== */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder p="md" radius="md" style={{ position: 'sticky', top: 80 }}>
            <Stack gap="md">
              <Text fw={700} size="lg" ta="center" c="blue">Bill Summary</Text>

              {/* Customer Card */}
              {(form.values.customerName || selectedCustomer) && (
                <Card withBorder p="xs" radius="sm" bg="blue.0">
                  <Group justify="space-between" mb={4}>
                    <Text size="sm" fw={600}>
                      {form.values.customerName}
                    </Text>
                    <Badge color="blue" size="sm">{form.values.customerType}</Badge>
                  </Group>
                  {form.values.customerPhone && (
                    <Group gap={4}>
                      <IconPhone size={12} style={{ opacity: 0.5 }} />
                      <Text size="xs" c="dimmed">{form.values.customerPhone}</Text>
                    </Group>
                  )}
                  {selectedFarmerNumber && (
                    <Text size="xs" c="dimmed">Farmer #{selectedFarmerNumber}</Text>
                  )}
                  {calculations.oldBalance > 0 && (
                    <Badge color="orange" variant="light" size="xs" mt={4} fullWidth>
                      Old Balance: {calculations.oldBalance.toFixed(2)}
                    </Badge>
                  )}
                </Card>
              )}

              {/* Summary Details */}
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

                {/* Discount */}
                <Group justify="space-between" align="flex-start">
                  <Text size="sm" c="dimmed">Discount</Text>
                  <Group gap={4}>
                    <NumberInput
                      value={form.values.discountPercent}
                      onChange={(value) => {
                        form.setFieldValue('discountPercent', value);
                        form.setFieldValue('discount', 0);
                      }}
                      min={0}
                      max={100}
                      size="xs"
                      w={60}
                      rightSection={<Text size="xs">%</Text>}
                    />
                    <Text size="xs">or</Text>
                    <NumberInput
                      value={form.values.discount}
                      onChange={(value) => {
                        form.setFieldValue('discount', value);
                        form.setFieldValue('discountPercent', 0);
                      }}
                      min={0}
                      size="xs"
                      w={80}
                      leftSection={<Text size="xs">{'\u20B9'}</Text>}
                    />
                  </Group>
                </Group>

                {calculations.discount > 0 && (
                  <Group justify="flex-end">
                    <Text size="sm" c="red">-{calculations.discount.toFixed(2)}</Text>
                  </Group>
                )}

                {/* Subsidy */}
                {calculations.totalSubsidy > 0 && (
                  <Group justify="space-between">
                    <Text size="sm" c="green" fw={500}>Subsidy</Text>
                    <Text size="sm" c="green" fw={500}>-{calculations.totalSubsidy.toFixed(2)}</Text>
                  </Group>
                )}

                {/* Round Off */}
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Round Off</Text>
                  <NumberInput
                    value={form.values.roundOff}
                    onChange={(value) => form.setFieldValue('roundOff', value)}
                    size="xs"
                    w={80}
                    decimalScale={2}
                    step={0.01}
                  />
                </Group>

                <Divider />

                {/* Grand Total */}
                <Group justify="space-between">
                  <Text fw={700} size="lg">Grand Total</Text>
                  <Text fw={700} size="lg" c="green">{calculations.grandTotal.toFixed(2)}</Text>
                </Group>

                {/* Old Balance */}
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

              {/* Payment Section */}
              <SegmentedControl
                value={form.values.paymentMode}
                onChange={(value) => form.setFieldValue('paymentMode', value)}
                fullWidth
                size="xs"
                data={[
                  { value: 'Cash', label: (
                    <Center style={{ gap: 4 }}><IconCash size={14} /><Text size="xs">Cash</Text></Center>
                  )},
                     { value: 'Credit', label: (
                    <Center style={{ gap: 4 }}><IconCoin size={14} /><Text size="xs">Credit</Text></Center>
                  )},
                    { value: 'UPI', label: (
                    <Center style={{ gap: 4 }}><IconQrcode size={14} /><Text size="xs">UPI</Text></Center>
                  )},
                  { value: 'Card', label: (
                    <Center style={{ gap: 4 }}><IconCreditCard size={14} /><Text size="xs">Card</Text></Center>
                  )}
                
               
                ]}
              />

              <NumberInput
                label="Paid Amount"
                placeholder="Amount received"
                value={form.values.paidAmount}
                onChange={(value) => form.setFieldValue('paidAmount', value)}
                min={0}
                decimalScale={2}
                leftSection={<IconCurrencyRupee size={16} />}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && billItems.length > 0 && !saving) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />

              {paidAmount > 0 && (
                <Card p="xs" bg={changeAmount >= 0 ? 'green.0' : 'orange.0'}>
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      {changeAmount >= 0 ? 'Change' : 'Balance Due'}
                    </Text>
                    <Text size="sm" fw={600} c={changeAmount >= 0 ? 'green' : 'orange'}>
                      {Math.abs(changeAmount).toFixed(2)}
                    </Text>
                  </Group>
                </Card>
              )}

              {/* Action Buttons */}
              <Button
                size="lg"
                fullWidth
                leftSection={<IconDeviceFloppy size={20} />}
                onClick={handleSubmit}
                loading={saving}
                disabled={billItems.length === 0}
                color="green"
              >
                Save & Print Bill
              </Button>
{/* 
              <SegmentedControl
                value={printSize}
                onChange={setPrintSize}
                fullWidth
                size="xs"
                data={[
                  { value: '2', label: '2" (58mm)' },
                  { value: '3', label: '3" (80mm)' },
                ]}
              /> */}

              <Group grow>
                <Button
                  variant="light"
                  color="gray"
                  leftSection={<IconX size={14} />}
                  onClick={() => navigate('/sales/list')}
                >
                  Cancel
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconPrinter size={16} />}
                  onClick={() => printRef.current && handlePrint()}
                  disabled={billItems.length === 0}
                >
                  Print
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Print Success Modal */}
      <Modal
        opened={printModalOpened}
        onClose={() => {
          setPrintModalOpened(false);
          resetForm();
        }}
        title="Bill Created Successfully"
        centered
      >
        <Stack>
          <Alert color="green" icon={<IconCheck size={16} />}>
            <Text size="sm">Bill has been saved successfully!</Text>
          </Alert>
          <SegmentedControl
            value={printSize}
            onChange={setPrintSize}
            fullWidth
            data={[
              { value: '2', label: '2 inch (58mm)' },
              { value: '3', label: '3 inch (80mm)' },
            ]}
          />
          <Group justify="flex-end">
            <Button
              variant="light"
              onClick={() => {
                setPrintModalOpened(false);
                resetForm();
              }}
            >
              Create New
            </Button>
            <Button
              data-autofocus
              leftSection={<IconPrinter size={16} />}
              onClick={handlePrint}
              color="green"
            >
              Print Bill
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Hidden Thermal Print Section */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page { margin: 0; size: ${printSize === '2' ? '58mm' : '80mm'} auto; }
              body { margin: 0; }
            }
          `}} />
          <div style={{
            width: printSize === '2' ? '48mm' : '72mm',
            fontFamily: "'Courier New', monospace",
            fontSize: printSize === '2' ? '8px' : '10px',
            padding: printSize === '2' ? '2mm' : '4mm',
            lineHeight: 1.3
          }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '4px' }}>
              <div style={{ fontWeight: 'bold', fontSize: printSize === '2' ? '10px' : '13px' }}>
                {selectedCompany?.companyName || 'DAIRY COOPERATIVE'}
              </div>
              <div>{selectedCompany?.address || ''}</div>
              {selectedCompany?.phone && <div>Ph: {selectedCompany.phone}</div>}
              {selectedCompany?.gstNumber && <div>GSTIN: {selectedCompany.gstNumber}</div>}
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '3px 0' }} />

            {/* Bill Info */}
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: printSize === '2' ? '9px' : '11px' }}>
              SALES BILL
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>No: {billNumber}</span>
              <span>{dayjs(form.values.billDate).format('DD/MM/YY')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{form.values.customerName || 'Walk-in'}</span>
              <span>{form.values.paymentMode}</span>
            </div>
            {selectedFarmerNumber && <div>Farmer #: {selectedFarmerNumber}</div>}
            {form.values.customerPhone && <div>Ph: {form.values.customerPhone}</div>}

            <div style={{ borderTop: '1px dashed #000', margin: '3px 0' }} />

            {/* Items Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span style={{ flex: 1 }}>Item</span>
              <span style={{ width: printSize === '2' ? '28px' : '35px', textAlign: 'right' }}>Qty</span>
              <span style={{ width: printSize === '2' ? '32px' : '40px', textAlign: 'right' }}>Rate</span>
              <span style={{ width: printSize === '2' ? '36px' : '45px', textAlign: 'right' }}>Amt</span>
            </div>
            <div style={{ borderTop: '1px dashed #000', margin: '2px 0' }} />

            {/* Items */}
            {billItems.map((item, index) => (
              <div key={index} style={{ marginBottom: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.itemName}
                  </span>
                  <span style={{ width: printSize === '2' ? '28px' : '35px', textAlign: 'right' }}>{item.quantity}</span>
                  <span style={{ width: printSize === '2' ? '32px' : '40px', textAlign: 'right' }}>{item.rate.toFixed(0)}</span>
                  <span style={{ width: printSize === '2' ? '36px' : '45px', textAlign: 'right' }}>{item.totalAmount?.toFixed(2)}</span>
                </div>
                {item.gstAmount > 0 && (
                  <div style={{ fontSize: printSize === '2' ? '7px' : '8px', color: '#555', paddingLeft: '4px' }}>
                    GST {item.gstPercent}%: {item.gstAmount.toFixed(2)}
                  </div>
                )}
                {item.subsidyEnabled && item.subsidyAmount > 0 && (
                  <div style={{ fontSize: printSize === '2' ? '7px' : '8px', color: '#555', paddingLeft: '4px' }}>
                    Subsidy ({item.subsidyName}): -{item.subsidyAmount.toFixed(2)}
                  </div>
                )}
              </div>
            ))}

            <div style={{ borderTop: '1px dashed #000', margin: '3px 0' }} />

            {/* Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span>{calculations.subtotal.toFixed(2)}</span>
            </div>
            {calculations.totalGst > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>GST:</span>
                <span>+{calculations.totalGst.toFixed(2)}</span>
              </div>
            )}
            {calculations.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Discount:</span>
                <span>-{calculations.discount.toFixed(2)}</span>
              </div>
            )}
            {calculations.totalSubsidy > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subsidy:</span>
                <span>-{calculations.totalSubsidy.toFixed(2)}</span>
              </div>
            )}
            {calculations.roundOff !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Round Off:</span>
                <span>{calculations.roundOff.toFixed(2)}</span>
              </div>
            )}

            <div style={{ borderTop: '1px solid #000', margin: '3px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: printSize === '2' ? '10px' : '12px' }}>
              <span>TOTAL:</span>
              <span>Rs.{calculations.grandTotal.toFixed(2)}</span>
            </div>

            {calculations.oldBalance > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Old Balance:</span>
                  <span>{calculations.oldBalance.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Total Due:</span>
                  <span>Rs.{calculations.totalDue.toFixed(2)}</span>
                </div>
              </>
            )}

            {paidAmount > 0 && (
              <>
                <div style={{ borderTop: '1px dashed #000', margin: '3px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Paid ({form.values.paymentMode}):</span>
                  <span>{paidAmount.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Balance:</span>
                  <span>Rs.{Math.max(0, calculations.totalDue - paidAmount).toFixed(2)}</span>
                </div>
              </>
            )}

            <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

            {/* Footer */}
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
