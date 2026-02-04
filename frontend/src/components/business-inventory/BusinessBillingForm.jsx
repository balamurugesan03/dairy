/**
 * Business Billing Form - Vyapar Style
 * =====================================
 * Modern invoice/billing interface for Private Firm
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Box,
  Grid,
  SimpleGrid,
  Badge,
  ActionIcon,
  Modal,
  ScrollArea,
  Textarea,
  Tooltip,
  ThemeIcon,
  Tabs,
  Collapse
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
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
  IconAlertCircle,
  IconPrinter,
  IconReceipt,
  IconSearch,
  IconCheck,
  IconShoppingCart,
  IconCalculator,
  IconBarcode,
  IconCreditCard,
  IconDeviceFloppy,
  IconFileInvoice,
  IconPercentage,
  IconReceipt2,
  IconCalendar,
  IconTag,
  IconMapPin,
  IconId,
  IconTruck,
  IconNotes,
  IconChevronDown,
  IconChevronUp,
  IconEdit,
  IconEye
} from '@tabler/icons-react';
import { businessItemAPI, businessSalesAPI, customerAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

const BusinessBillingForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const printRef = useRef();
  const { selectedCompany } = useCompany();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [billItems, setBillItems] = useState([]);
  const [printModalOpened, setPrintModalOpened] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState(null);
  const [showMoreOptions, { toggle: toggleMoreOptions }] = useDisclosure(false);
  const [barcodeInput, setBarcodeInput] = useState('');

  const form = useForm({
    initialValues: {
      invoiceDate: new Date(),
      invoiceType: 'Sale',
      partyId: null,
      partyName: '',
      partyPhone: '',
      partyAddress: '',
      partyGstin: '',
      partyState: 'Tamil Nadu',
      itemId: null,
      quantity: 1,
      rate: '',
      discountPercent: 0,
      paymentMode: 'Cash',
      paidAmount: '',
      billDiscount: 0,
      billDiscountPercent: 0,
      roundOff: 0,
      poNumber: '',
      poDate: null,
      ewaybillNumber: '',
      vehicleNumber: '',
      transportName: '',
      lrNumber: '',
      notes: '',
      termsAndConditions: ''
    }
  });

  const [calculations, setCalculations] = useState({
    totalQty: 0,
    grossAmount: 0,
    itemDiscount: 0,
    taxableAmount: 0,
    totalCgst: 0,
    totalSgst: 0,
    totalIgst: 0,
    totalGst: 0,
    billDiscount: 0,
    roundOff: 0,
    grandTotal: 0,
    previousBalance: 0,
    totalDue: 0
  });

  useEffect(() => {
    fetchItems();
    fetchCustomers();
    if (id) {
      fetchInvoice(id);
    }
  }, [id]);

  useEffect(() => {
    calculateTotals();
  }, [billItems, form.values.billDiscount, form.values.billDiscountPercent, form.values.partyState]);

  const fetchItems = async () => {
    try {
      const response = await businessItemAPI.getAll();
      const itemsData = response?.data || response || [];
      setItems(Array.isArray(itemsData) ? itemsData.filter(item => item.status === 'Active') : []);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch items',
        color: 'red'
      });
      setItems([]);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await customerAPI.getAll();
      const customersData = response?.data || response || [];
      setCustomers(Array.isArray(customersData) ? customersData.filter(c => c.active !== false) : []);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch customers',
        color: 'red'
      });
      setCustomers([]);
    }
  };

  const fetchInvoice = async (invoiceId) => {
    try {
      setLoading(true);
      const response = await businessSalesAPI.getById(invoiceId);
      const invoice = response?.data || response;

      if (!invoice) {
        notifications.show({
          title: 'Error',
          message: 'Invoice not found',
          color: 'red'
        });
        return;
      }

      form.setValues({
        invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date(),
        invoiceType: invoice.invoiceType || 'Sale',
        partyId: invoice.partyId?._id || invoice.partyId || null,
        partyName: invoice.partyName || '',
        partyPhone: invoice.partyPhone || '',
        partyAddress: invoice.partyAddress || '',
        partyGstin: invoice.partyGstin || '',
        partyState: invoice.partyState || 'Tamil Nadu',
        paymentMode: invoice.paymentMode || 'Cash',
        paidAmount: invoice.paidAmount || '',
        billDiscount: invoice.billDiscount || 0,
        billDiscountPercent: invoice.billDiscountPercent || 0,
        roundOff: invoice.roundOff || 0,
        poNumber: invoice.poNumber || '',
        ewaybillNumber: invoice.ewaybillNumber || '',
        vehicleNumber: invoice.vehicleNumber || '',
        transportName: invoice.transportName || '',
        lrNumber: invoice.lrNumber || '',
        notes: invoice.notes || '',
        termsAndConditions: invoice.termsAndConditions || ''
      });

      const invoiceItems = invoice.items || [];
      setBillItems(invoiceItems.map(item => ({
        itemId: item.itemId?._id || item.itemId,
        itemCode: item.itemCode || '',
        itemName: item.itemName || '',
        hsnCode: item.hsnCode || '',
        quantity: item.quantity || 0,
        freeQty: item.freeQty || 0,
        unit: item.unit || '',
        mrp: item.mrp || 0,
        rate: item.rate || 0,
        discountPercent: item.discountPercent || 0,
        discountAmount: item.discountAmount || 0,
        taxableAmount: item.taxableAmount || 0,
        gstPercent: item.gstPercent || 0,
        cgstAmount: item.cgstAmount || 0,
        sgstAmount: item.sgstAmount || 0,
        igstAmount: item.igstAmount || 0,
        totalAmount: item.totalAmount || 0
      })));

      if (invoice.partyId) {
        setSelectedCustomer(typeof invoice.partyId === 'object' ? invoice.partyId : null);
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch invoice',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSelect = async (customerId) => {
    if (!customerId) {
      setSelectedCustomer(null);
      form.setValues({
        ...form.values,
        partyId: null,
        partyName: '',
        partyPhone: '',
        partyAddress: '',
        partyGstin: '',
        partyState: 'Tamil Nadu'
      });
      setCalculations(prev => ({ ...prev, previousBalance: 0 }));
      return;
    }

    const customer = customers.find(c => c._id === customerId);
    if (customer) {
      setSelectedCustomer(customer);
      form.setValues({
        ...form.values,
        partyId: customerId,
        partyName: customer.name || '',
        partyPhone: customer.phone || '',
        partyAddress: customer.address || '',
        partyGstin: customer.gstNumber || '',
        partyState: customer.state || 'Tamil Nadu'
      });

      // Fetch previous balance
      try {
        const response = await businessSalesAPI.getPartyHistory(customerId);
        const balanceData = response?.totalBalance || response?.data?.totalBalance || 0;
        setCalculations(prev => ({
          ...prev,
          previousBalance: balanceData
        }));
      } catch (error) {
        console.error('Error fetching party balance:', error);
        setCalculations(prev => ({
          ...prev,
          previousBalance: 0
        }));
      }
    }
  };

  const handleBarcodeInput = (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const item = items.find(i =>
        i.itemCode === barcodeInput.trim() ||
        i.barcode === barcodeInput.trim()
      );
      if (item) {
        form.setFieldValue('itemId', item._id);
        form.setFieldValue('rate', item.salesRate || item.retailPrice || 0);
        setTimeout(() => handleAddItem(), 100);
      } else {
        notifications.show({
          title: 'Item not found',
          message: 'No item found with this barcode/code',
          color: 'orange'
        });
      }
      setBarcodeInput('');
    }
  };

  const handleItemSelect = (itemId) => {
    form.setFieldValue('itemId', itemId);
    if (itemId) {
      const item = items.find(i => i._id === itemId);
      if (item) {
        form.setFieldValue('rate', item.salesRate || item.retailPrice || 0);
      }
    }
  };

  const handleAddItem = () => {
    const { itemId, quantity, rate, discountPercent } = form.values;

    if (!itemId || !quantity) {
      notifications.show({
        title: 'Error',
        message: 'Please select item and enter quantity',
        color: 'red'
      });
      return;
    }

    const item = items.find(i => i._id === itemId);
    if (!item) return;

    const qty = parseFloat(quantity) || 0;
    const itemRate = parseFloat(rate) || item.salesRate || 0;
    const discount = parseFloat(discountPercent) || 0;
    const gstPercent = item.gstPercent || 0;

    // Check stock
    if (form.values.invoiceType !== 'Sale Return' && qty > item.currentBalance) {
      notifications.show({
        title: 'Insufficient Stock',
        message: `Available: ${item.currentBalance} ${item.unit}`,
        color: 'red'
      });
      return;
    }

    const amount = qty * itemRate;
    const discountAmount = (amount * discount) / 100;
    const taxableAmount = amount - discountAmount;

    // Check if inter-state (IGST) or intra-state (CGST+SGST)
    const isInterState = form.values.partyState && form.values.partyState !== 'Tamil Nadu';
    let cgst = 0, sgst = 0, igst = 0;

    if (isInterState) {
      igst = (taxableAmount * gstPercent) / 100;
    } else {
      cgst = (taxableAmount * gstPercent) / 200;
      sgst = (taxableAmount * gstPercent) / 200;
    }

    const totalAmount = taxableAmount + cgst + sgst + igst;

    // Check if item already exists
    const existingIndex = billItems.findIndex(bi => bi.itemId === item._id);

    if (existingIndex > -1) {
      const updatedItems = [...billItems];
      const existingItem = updatedItems[existingIndex];
      const newQty = existingItem.quantity + qty;
      const newAmount = newQty * itemRate;
      const newDiscountAmount = (newAmount * discount) / 100;
      const newTaxable = newAmount - newDiscountAmount;

      let newCgst = 0, newSgst = 0, newIgst = 0;
      if (isInterState) {
        newIgst = (newTaxable * gstPercent) / 100;
      } else {
        newCgst = (newTaxable * gstPercent) / 200;
        newSgst = (newTaxable * gstPercent) / 200;
      }

      updatedItems[existingIndex] = {
        ...existingItem,
        quantity: newQty,
        discountAmount: newDiscountAmount,
        taxableAmount: newTaxable,
        cgstAmount: newCgst,
        sgstAmount: newSgst,
        igstAmount: newIgst,
        totalAmount: newTaxable + newCgst + newSgst + newIgst
      };
      setBillItems(updatedItems);
    } else {
      const newItem = {
        itemId: item._id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        hsnCode: item.hsnCode || '',
        quantity: qty,
        freeQty: 0,
        unit: item.unit || '',
        mrp: item.mrp || 0,
        rate: itemRate,
        discountPercent: discount,
        discountAmount,
        taxableAmount,
        gstPercent,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalAmount
      };
      setBillItems([...billItems, newItem]);
    }

    // Reset item form
    form.setFieldValue('itemId', null);
    form.setFieldValue('quantity', 1);
    form.setFieldValue('rate', '');
    form.setFieldValue('discountPercent', 0);
    setBarcodeInput('');
  };

  const handleRemoveItem = (index) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const handleItemQuantityChange = (index, newQty) => {
    const updatedItems = [...billItems];
    const item = updatedItems[index];
    const amount = newQty * item.rate;
    const discountAmount = (amount * item.discountPercent) / 100;
    const taxable = amount - discountAmount;

    const isInterState = form.values.partyState && form.values.partyState !== 'Tamil Nadu';
    let cgst = 0, sgst = 0, igst = 0;

    if (isInterState) {
      igst = (taxable * item.gstPercent) / 100;
    } else {
      cgst = (taxable * item.gstPercent) / 200;
      sgst = (taxable * item.gstPercent) / 200;
    }

    updatedItems[index] = {
      ...item,
      quantity: newQty,
      discountAmount,
      taxableAmount: taxable,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      totalAmount: taxable + cgst + sgst + igst
    };
    setBillItems(updatedItems);
  };

  const handleItemRateChange = (index, newRate) => {
    const updatedItems = [...billItems];
    const item = updatedItems[index];
    const amount = item.quantity * newRate;
    const discountAmount = (amount * item.discountPercent) / 100;
    const taxable = amount - discountAmount;

    const isInterState = form.values.partyState && form.values.partyState !== 'Tamil Nadu';
    let cgst = 0, sgst = 0, igst = 0;

    if (isInterState) {
      igst = (taxable * item.gstPercent) / 100;
    } else {
      cgst = (taxable * item.gstPercent) / 200;
      sgst = (taxable * item.gstPercent) / 200;
    }

    updatedItems[index] = {
      ...item,
      rate: newRate,
      discountAmount,
      taxableAmount: taxable,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      totalAmount: taxable + cgst + sgst + igst
    };
    setBillItems(updatedItems);
  };

  const calculateTotals = () => {
    const isInterState = form.values.partyState && form.values.partyState !== 'Tamil Nadu';

    let totalQty = 0;
    let grossAmount = 0;
    let itemDiscount = 0;
    let taxableAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    billItems.forEach(item => {
      totalQty += item.quantity;
      grossAmount += item.quantity * item.rate;
      itemDiscount += item.discountAmount || 0;
      taxableAmount += item.taxableAmount || 0;
      totalCgst += item.cgstAmount || 0;
      totalSgst += item.sgstAmount || 0;
      totalIgst += item.igstAmount || 0;
    });

    const totalGst = totalCgst + totalSgst + totalIgst;

    // Bill discount
    let billDiscount = 0;
    if (form.values.billDiscountPercent > 0) {
      billDiscount = (taxableAmount * form.values.billDiscountPercent) / 100;
    } else {
      billDiscount = parseFloat(form.values.billDiscount) || 0;
    }

    const netAmount = taxableAmount - billDiscount + totalGst;
    const roundOff = parseFloat(form.values.roundOff) || (Math.round(netAmount) - netAmount);
    const grandTotal = netAmount + roundOff;

    setCalculations(prev => ({
      ...prev,
      totalQty,
      grossAmount,
      itemDiscount,
      taxableAmount,
      totalCgst,
      totalSgst,
      totalIgst,
      totalGst,
      billDiscount,
      roundOff,
      grandTotal,
      totalDue: grandTotal + prev.previousBalance
    }));
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    onAfterPrint: () => {
      setPrintModalOpened(false);
    }
  });

  const handleSubmit = async () => {
    if (billItems.length === 0) {
      notifications.show({
        title: 'Error',
        message: 'Please add at least one item',
        color: 'red'
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        invoiceDate: form.values.invoiceDate,
        invoiceType: form.values.invoiceType,
        partyId: form.values.partyId || null,
        partyName: form.values.partyName,
        partyPhone: form.values.partyPhone,
        partyAddress: form.values.partyAddress,
        partyGstin: form.values.partyGstin,
        partyState: form.values.partyState,
        items: billItems,
        billDiscount: calculations.billDiscount,
        billDiscountPercent: form.values.billDiscountPercent,
        roundOff: calculations.roundOff,
        paymentMode: form.values.paymentMode,
        paidAmount: parseFloat(form.values.paidAmount) || 0,
        previousBalance: calculations.previousBalance,
        poNumber: form.values.poNumber,
        poDate: form.values.poDate,
        ewaybillNumber: form.values.ewaybillNumber,
        vehicleNumber: form.values.vehicleNumber,
        transportName: form.values.transportName,
        lrNumber: form.values.lrNumber,
        notes: form.values.notes,
        termsAndConditions: form.values.termsAndConditions
      };

      let response;
      if (id) {
        response = await businessSalesAPI.update(id, payload);
        notifications.show({
          title: 'Success',
          message: 'Invoice updated successfully',
          color: 'green'
        });
      } else {
        response = await businessSalesAPI.create(payload);
        notifications.show({
          title: 'Success',
          message: 'Invoice created successfully',
          color: 'green'
        });
      }

      setSavedInvoice(response.data);
      setPrintModalOpened(true);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to save invoice',
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
    setCalculations({
      totalQty: 0,
      grossAmount: 0,
      itemDiscount: 0,
      taxableAmount: 0,
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      totalGst: 0,
      billDiscount: 0,
      roundOff: 0,
      grandTotal: 0,
      previousBalance: 0,
      totalDue: 0
    });
    setSavedInvoice(null);
  };

  const itemOptions = items.map(item => ({
    value: item._id,
    label: `${item.itemCode} - ${item.itemName} (Stock: ${item.currentBalance} ${item.unit})`
  }));

  const customerOptions = customers.map(customer => ({
    value: customer._id,
    label: `${customer.customerId || ''} - ${customer.name} ${customer.phone ? `| ${customer.phone}` : ''}`
  }));

  const stateOptions = [
    'Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana',
    'Maharashtra', 'Gujarat', 'Rajasthan', 'Delhi', 'Uttar Pradesh',
    'West Bengal', 'Bihar', 'Madhya Pradesh', 'Punjab', 'Haryana'
  ].map(s => ({ value: s, label: s }));

  if (loading) {
    return (
      <Center h={400}>
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Paper withBorder p="md" mb="md" radius="md">
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon size={40} radius="md" variant="light" color="violet">
              <IconFileInvoice size={24} />
            </ThemeIcon>
            <div>
              <Title order={3}>{id ? 'Edit Invoice' : 'Create Invoice'}</Title>
              <Text size="sm" c="dimmed">Vyapar-style billing for your business</Text>
            </div>
          </Group>
          <Group>
            <Select
              value={form.values.invoiceType}
              onChange={(value) => form.setFieldValue('invoiceType', value)}
              data={[
                { value: 'Sale', label: 'Sale Invoice' },
                { value: 'Sale Return', label: 'Sale Return' },
                { value: 'Estimate', label: 'Estimate/Quotation' },
                { value: 'Delivery Challan', label: 'Delivery Challan' },
                { value: 'Proforma', label: 'Proforma Invoice' }
              ]}
              w={180}
            />
            <Button
              variant="light"
              leftSection={<IconReceipt2 size={16} />}
              onClick={resetForm}
            >
              New Invoice
            </Button>
          </Group>
        </Group>
      </Paper>

      <Grid gutter="md">
        {/* Left Panel - Party & Items */}
        <Grid.Col span={8}>
          <Stack gap="md">
            {/* Party Details */}
            <Paper withBorder p="md" radius="md">
              <Group justify="space-between" mb="sm">
                <Text fw={600} c="blue">Party Details</Text>
                <DateInput
                  value={form.values.invoiceDate}
                  onChange={(value) => form.setFieldValue('invoiceDate', value)}
                  leftSection={<IconCalendar size={16} />}
                  placeholder="Invoice Date"
                  size="xs"
                  w={160}
                  maxDate={new Date()}
                />
              </Group>

              <Grid gutter="sm">
                <Grid.Col span={6}>
                  <Select
                    label="Select Party"
                    placeholder="Search customer..."
                    value={form.values.partyId}
                    onChange={handleCustomerSelect}
                    data={customerOptions}
                    searchable
                    clearable
                    leftSection={<IconUser size={16} />}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Party Name"
                    placeholder="Enter party name"
                    value={form.values.partyName}
                    onChange={(e) => form.setFieldValue('partyName', e.target.value)}
                    leftSection={<IconUser size={16} />}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <TextInput
                    label="Phone"
                    placeholder="Phone number"
                    value={form.values.partyPhone}
                    onChange={(e) => form.setFieldValue('partyPhone', e.target.value)}
                    leftSection={<IconPhone size={16} />}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <TextInput
                    label="GSTIN"
                    placeholder="GST Number"
                    value={form.values.partyGstin}
                    onChange={(e) => form.setFieldValue('partyGstin', e.target.value)}
                    leftSection={<IconId size={16} />}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <Select
                    label="State"
                    placeholder="Select state"
                    value={form.values.partyState}
                    onChange={(value) => form.setFieldValue('partyState', value)}
                    data={stateOptions}
                    searchable
                    leftSection={<IconMapPin size={16} />}
                  />
                </Grid.Col>
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
                <Grid.Col span={4}>
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
                <Grid.Col span={2}>
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
                  <NumberInput
                    label="Disc %"
                    value={form.values.discountPercent}
                    onChange={(value) => form.setFieldValue('discountPercent', value)}
                    min={0}
                    max={100}
                    decimalScale={2}
                    rightSection={<IconPercentage size={14} />}
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
                      <Table.Th style={{ textAlign: 'right' }}>Rate</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Disc</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>GST</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                      <Table.Th></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {billItems.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={9}>
                          <Center py="xl">
                            <Text c="dimmed">No items added yet</Text>
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
                            <Text size="sm">{item.discountPercent}%</Text>
                            <Text size="xs" c="dimmed">-{item.discountAmount?.toFixed(2)}</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="sm">{item.gstPercent}%</Text>
                            <Text size="xs" c="dimmed">
                              {item.cgstAmount > 0 ? `C+S` : `I`}: {(item.cgstAmount + item.sgstAmount + item.igstAmount).toFixed(2)}
                            </Text>
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

            {/* Additional Details (Collapsible) */}
            <Paper withBorder p="md" radius="md">
              <Group justify="space-between" onClick={toggleMoreOptions} style={{ cursor: 'pointer' }}>
                <Text fw={600} c="blue">Additional Details</Text>
                {showMoreOptions ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
              </Group>

              <Collapse in={showMoreOptions}>
                <Grid gutter="sm" mt="md">
                  <Grid.Col span={3}>
                    <TextInput
                      label="PO Number"
                      placeholder="Purchase Order"
                      value={form.values.poNumber}
                      onChange={(e) => form.setFieldValue('poNumber', e.target.value)}
                    />
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <TextInput
                      label="E-Way Bill"
                      placeholder="E-Way Bill No."
                      value={form.values.ewaybillNumber}
                      onChange={(e) => form.setFieldValue('ewaybillNumber', e.target.value)}
                    />
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <TextInput
                      label="Vehicle No."
                      placeholder="Vehicle Number"
                      value={form.values.vehicleNumber}
                      onChange={(e) => form.setFieldValue('vehicleNumber', e.target.value)}
                      leftSection={<IconTruck size={16} />}
                    />
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <TextInput
                      label="Transport"
                      placeholder="Transport Name"
                      value={form.values.transportName}
                      onChange={(e) => form.setFieldValue('transportName', e.target.value)}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Textarea
                      label="Notes"
                      placeholder="Additional notes..."
                      value={form.values.notes}
                      onChange={(e) => form.setFieldValue('notes', e.target.value)}
                      rows={2}
                    />
                  </Grid.Col>
                </Grid>
              </Collapse>
            </Paper>
          </Stack>
        </Grid.Col>

        {/* Right Panel - Summary */}
        <Grid.Col span={4}>
          <Paper withBorder p="md" radius="md" style={{ position: 'sticky', top: 80 }}>
            <Stack gap="md">
              <Text fw={700} size="lg" ta="center" c="blue">Invoice Summary</Text>

              {/* Customer Card */}
              {selectedCustomer && (
                <Card withBorder p="xs" radius="sm" bg="blue.0">
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={600}>{selectedCustomer.name}</Text>
                      <Text size="xs" c="dimmed">{selectedCustomer.phone}</Text>
                    </div>
                    <Badge color="blue" size="sm">Customer</Badge>
                  </Group>
                </Card>
              )}

              {/* Summary Details */}
              <Stack gap={6}>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Items ({billItems.length})</Text>
                  <Text size="sm">{calculations.totalQty} units</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Gross Amount</Text>
                  <Text size="sm">{calculations.grossAmount.toFixed(2)}</Text>
                </Group>
                {calculations.itemDiscount > 0 && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Item Discount</Text>
                    <Text size="sm" c="red">-{calculations.itemDiscount.toFixed(2)}</Text>
                  </Group>
                )}
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Taxable Amount</Text>
                  <Text size="sm">{calculations.taxableAmount.toFixed(2)}</Text>
                </Group>

                <Divider variant="dashed" />

                {/* GST Breakdown */}
                {calculations.totalCgst > 0 && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">CGST</Text>
                    <Text size="sm">{calculations.totalCgst.toFixed(2)}</Text>
                  </Group>
                )}
                {calculations.totalSgst > 0 && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">SGST</Text>
                    <Text size="sm">{calculations.totalSgst.toFixed(2)}</Text>
                  </Group>
                )}
                {calculations.totalIgst > 0 && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">IGST</Text>
                    <Text size="sm">{calculations.totalIgst.toFixed(2)}</Text>
                  </Group>
                )}
                <Group justify="space-between">
                  <Text size="sm" fw={500}>Total GST</Text>
                  <Text size="sm" fw={500}>{calculations.totalGst.toFixed(2)}</Text>
                </Group>

                <Divider variant="dashed" />

                {/* Bill Discount */}
                <Group justify="space-between" align="flex-start">
                  <Text size="sm" c="dimmed">Bill Discount</Text>
                  <Group gap={4}>
                    <NumberInput
                      value={form.values.billDiscountPercent}
                      onChange={(value) => {
                        form.setFieldValue('billDiscountPercent', value);
                        form.setFieldValue('billDiscount', 0);
                      }}
                      min={0}
                      max={100}
                      size="xs"
                      w={60}
                      rightSection={<Text size="xs">%</Text>}
                    />
                    <Text size="xs">or</Text>
                    <NumberInput
                      value={form.values.billDiscount}
                      onChange={(value) => {
                        form.setFieldValue('billDiscount', value);
                        form.setFieldValue('billDiscountPercent', 0);
                      }}
                      min={0}
                      size="xs"
                      w={80}
                      leftSection={<Text size="xs"></Text>}
                    />
                  </Group>
                </Group>

                {calculations.billDiscount > 0 && (
                  <Group justify="flex-end">
                    <Text size="sm" c="red">-{calculations.billDiscount.toFixed(2)}</Text>
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

                {/* Previous Balance */}
                {calculations.previousBalance > 0 && (
                  <>
                    <Group justify="space-between">
                      <Text size="sm" c="orange">Previous Balance</Text>
                      <Text size="sm" c="orange">{calculations.previousBalance.toFixed(2)}</Text>
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
              <Grid gutter="xs">
                <Grid.Col span={6}>
                  <Select
                    label="Payment Mode"
                    value={form.values.paymentMode}
                    onChange={(value) => form.setFieldValue('paymentMode', value)}
                    data={[
                      { value: 'Cash', label: 'Cash' },
                      { value: 'Credit', label: 'Credit' },
                      { value: 'Bank', label: 'Bank Transfer' },
                      { value: 'UPI', label: 'UPI' },
                      { value: 'Card', label: 'Card' },
                      { value: 'Cheque', label: 'Cheque' }
                    ]}
                    size="xs"
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput
                    label="Received"
                    placeholder="Amount received"
                    value={form.values.paidAmount}
                    onChange={(value) => form.setFieldValue('paidAmount', value)}
                    min={0}
                    decimalScale={2}
                    size="xs"
                    leftSection={<IconCurrencyRupee size={14} />}
                  />
                </Grid.Col>
              </Grid>

              {form.values.paidAmount > 0 && (
                <Card p="xs" bg={parseFloat(form.values.paidAmount) >= calculations.totalDue ? 'green.0' : 'orange.0'}>
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      {parseFloat(form.values.paidAmount) >= calculations.totalDue ? 'Change' : 'Balance'}
                    </Text>
                    <Text size="sm" fw={600} c={parseFloat(form.values.paidAmount) >= calculations.totalDue ? 'green' : 'orange'}>
                      {Math.abs(calculations.totalDue - parseFloat(form.values.paidAmount)).toFixed(2)}
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
                {id ? 'Update Invoice' : 'Save Invoice'}
              </Button>

              <Group grow>
                <Button
                  variant="light"
                  color="gray"
                  onClick={() => navigate('/business-inventory/sales/list')}
                >
                  Cancel
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconPrinter size={16} />}
                  onClick={() => savedInvoice && handlePrint()}
                  disabled={!savedInvoice}
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
          if (!id) resetForm();
        }}
        title="Invoice Saved Successfully"
        centered
      >
        <Stack>
          <Alert color="green" icon={<IconCheck size={16} />}>
            <Text size="sm">
              Invoice <strong>{savedInvoice?.invoiceNumber}</strong> has been saved successfully!
            </Text>
          </Alert>
          <Group justify="flex-end">
            <Button
              variant="light"
              onClick={() => {
                setPrintModalOpened(false);
                if (!id) resetForm();
              }}
            >
              Create New
            </Button>
            <Button
              leftSection={<IconPrinter size={16} />}
              onClick={handlePrint}
              color="green"
            >
              Print Invoice
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Hidden Print Section */}
      <div style={{ display: 'none' }}>
        <div ref={printRef} style={{ padding: '20px', fontFamily: 'Arial, sans-serif', fontSize: '12px' }}>
          {/* Invoice Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '15px' }}>
            <h1 style={{ margin: '0', fontSize: '24px' }}>{selectedCompany?.companyName || 'BUSINESS NAME'}</h1>
            <p style={{ margin: '5px 0', fontSize: '11px' }}>{selectedCompany?.address || 'Address Line'}</p>
            <p style={{ margin: '2px 0', fontSize: '11px' }}>
              GSTIN: {selectedCompany?.gstNumber || 'XXXXXXXXX'} | Phone: {selectedCompany?.phone || 'XXXXXXXXXX'}
            </p>
          </div>

          {/* Invoice Title */}
          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: '0', fontSize: '18px', textTransform: 'uppercase' }}>
              {form.values.invoiceType === 'Sale' ? 'TAX INVOICE' : form.values.invoiceType.toUpperCase()}
            </h2>
          </div>

          {/* Invoice Details */}
          <table style={{ width: '100%', marginBottom: '15px' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'top' }}>
                  <strong>Bill To:</strong><br />
                  {form.values.partyName || 'Walk-in Customer'}<br />
                  {form.values.partyPhone && <span>Phone: {form.values.partyPhone}<br /></span>}
                  {form.values.partyGstin && <span>GSTIN: {form.values.partyGstin}<br /></span>}
                  {form.values.partyAddress && <span>{form.values.partyAddress}<br /></span>}
                  {form.values.partyState && <span>State: {form.values.partyState}</span>}
                </td>
                <td style={{ width: '50%', verticalAlign: 'top', textAlign: 'right' }}>
                  <strong>Invoice No:</strong> {savedInvoice?.invoiceNumber || '-'}<br />
                  <strong>Date:</strong> {dayjs(form.values.invoiceDate).format('DD-MM-YYYY')}<br />
                  {form.values.poNumber && <span><strong>PO No:</strong> {form.values.poNumber}<br /></span>}
                  {form.values.ewaybillNumber && <span><strong>E-Way Bill:</strong> {form.values.ewaybillNumber}</span>}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ border: '1px solid #333', padding: '6px', textAlign: 'center' }}>#</th>
                <th style={{ border: '1px solid #333', padding: '6px', textAlign: 'left' }}>Item Description</th>
                <th style={{ border: '1px solid #333', padding: '6px', textAlign: 'center' }}>HSN</th>
                <th style={{ border: '1px solid #333', padding: '6px', textAlign: 'center' }}>Qty</th>
                <th style={{ border: '1px solid #333', padding: '6px', textAlign: 'right' }}>Rate</th>
                <th style={{ border: '1px solid #333', padding: '6px', textAlign: 'right' }}>Disc</th>
                <th style={{ border: '1px solid #333', padding: '6px', textAlign: 'right' }}>GST</th>
                <th style={{ border: '1px solid #333', padding: '6px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {billItems.map((item, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'center' }}>{index + 1}</td>
                  <td style={{ border: '1px solid #333', padding: '6px' }}>
                    {item.itemName}<br />
                    <span style={{ fontSize: '10px', color: '#666' }}>{item.itemCode}</span>
                  </td>
                  <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'center' }}>{item.hsnCode || '-'}</td>
                  <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'center' }}>{item.quantity} {item.unit}</td>
                  <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'right' }}>{item.rate.toFixed(2)}</td>
                  <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'right' }}>{item.discountAmount?.toFixed(2) || '0.00'}</td>
                  <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'right' }}>
                    {item.gstPercent}%<br />
                    <span style={{ fontSize: '10px' }}>{(item.cgstAmount + item.sgstAmount + item.igstAmount).toFixed(2)}</span>
                  </td>
                  <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'right' }}>{item.totalAmount?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary */}
          <table style={{ width: '100%', marginBottom: '15px' }}>
            <tbody>
              <tr>
                <td style={{ width: '60%', verticalAlign: 'top' }}>
                  <strong>Amount in Words:</strong><br />
                  <em>{/* Add number to words conversion */}Rupees {Math.floor(calculations.grandTotal)} Only</em>
                  <br /><br />
                  <strong>Bank Details:</strong><br />
                  Bank: {selectedCompany?.bankName || 'Bank Name'}<br />
                  A/C No: {selectedCompany?.accountNumber || 'XXXXXXXXXX'}<br />
                  IFSC: {selectedCompany?.ifscCode || 'XXXXXXXXX'}
                </td>
                <td style={{ width: '40%', verticalAlign: 'top' }}>
                  <table style={{ width: '100%' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '3px 0' }}>Taxable Amount:</td>
                        <td style={{ padding: '3px 0', textAlign: 'right' }}>{calculations.taxableAmount.toFixed(2)}</td>
                      </tr>
                      {calculations.totalCgst > 0 && (
                        <tr>
                          <td style={{ padding: '3px 0' }}>CGST:</td>
                          <td style={{ padding: '3px 0', textAlign: 'right' }}>{calculations.totalCgst.toFixed(2)}</td>
                        </tr>
                      )}
                      {calculations.totalSgst > 0 && (
                        <tr>
                          <td style={{ padding: '3px 0' }}>SGST:</td>
                          <td style={{ padding: '3px 0', textAlign: 'right' }}>{calculations.totalSgst.toFixed(2)}</td>
                        </tr>
                      )}
                      {calculations.totalIgst > 0 && (
                        <tr>
                          <td style={{ padding: '3px 0' }}>IGST:</td>
                          <td style={{ padding: '3px 0', textAlign: 'right' }}>{calculations.totalIgst.toFixed(2)}</td>
                        </tr>
                      )}
                      {calculations.billDiscount > 0 && (
                        <tr>
                          <td style={{ padding: '3px 0' }}>Discount:</td>
                          <td style={{ padding: '3px 0', textAlign: 'right' }}>-{calculations.billDiscount.toFixed(2)}</td>
                        </tr>
                      )}
                      {calculations.roundOff !== 0 && (
                        <tr>
                          <td style={{ padding: '3px 0' }}>Round Off:</td>
                          <td style={{ padding: '3px 0', textAlign: 'right' }}>{calculations.roundOff.toFixed(2)}</td>
                        </tr>
                      )}
                      <tr style={{ borderTop: '2px solid #333' }}>
                        <td style={{ padding: '6px 0', fontWeight: 'bold', fontSize: '14px' }}>Grand Total:</td>
                        <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '14px' }}>{calculations.grandTotal.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Footer */}
          <div style={{ marginTop: '30px' }}>
            <table style={{ width: '100%' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%' }}>
                    <strong>Terms & Conditions:</strong><br />
                    <span style={{ fontSize: '10px' }}>
                      {form.values.termsAndConditions || '1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged on delayed payments.'}
                    </span>
                  </td>
                  <td style={{ width: '50%', textAlign: 'right' }}>
                    <div style={{ marginTop: '40px' }}>
                      <strong>For {selectedCompany?.companyName || 'BUSINESS NAME'}</strong><br /><br /><br />
                      Authorized Signatory
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ textAlign: 'center', marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
            <p style={{ margin: '0', fontSize: '10px' }}>Thank you for your business!</p>
          </div>
        </div>
      </div>
    </Container>
  );
};

export default BusinessBillingForm;
