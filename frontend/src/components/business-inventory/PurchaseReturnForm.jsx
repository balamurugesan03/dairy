/**
 * Business Return Form - Purchase Return (Debit Note) & Sales Return (Credit Note)
 * =================================================================================
 * Combined form with switch toggle for both return types
 * Purchase Return: Return goods TO supplier (Stock Out) - Debit Note
 * Sales Return: Customer returns goods TO us (Stock In) - Credit Note
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  Badge,
  ActionIcon,
  Modal,
  ScrollArea,
  Textarea,
  ThemeIcon,
  Collapse,
  SegmentedControl
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconTrash,
  IconUser,
  IconPhone,
  IconPackage,
  IconCurrencyRupee,
  IconCash,
  IconPrinter,
  IconCheck,
  IconDeviceFloppy,
  IconPercentage,
  IconCalendar,
  IconMapPin,
  IconId,
  IconNotes,
  IconChevronDown,
  IconChevronUp,
  IconArrowBack,
  IconArrowForward,
  IconFileInvoice,
  IconReceipt2
} from '@tabler/icons-react';
import { businessItemAPI, purchaseReturnAPI, salesReturnAPI, businessSupplierAPI, businessCustomerAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

const PurchaseReturnForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const printRef = useRef();
  const { selectedCompany } = useCompany();

  // Return type: 'purchase' (Debit Note) or 'sales' (Credit Note)
  const initialType = searchParams.get('type') || 'purchase';
  const [returnType, setReturnType] = useState(initialType);

  const isPurchaseReturn = returnType === 'purchase';
  const themeColor = isPurchaseReturn ? 'red' : 'blue';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);
  const [parties, setParties] = useState([]); // suppliers or customers
  const [selectedParty, setSelectedParty] = useState(null);
  const [billItems, setBillItems] = useState([]);
  const [printModalOpened, setPrintModalOpened] = useState(false);
  const [savedReturn, setSavedReturn] = useState(null);
  const [showMoreOptions, { toggle: toggleMoreOptions }] = useDisclosure(false);

  const form = useForm({
    initialValues: {
      returnDate: new Date(),
      partyId: null,
      partyName: '',
      partyPhone: '',
      partyAddress: '',
      partyGstin: '',
      partyState: 'Tamil Nadu',
      originalInvoiceRef: '',
      originalInvoiceDate: null,
      reason: '',
      itemId: null,
      quantity: 1,
      rate: '',
      discountPercent: 0,
      paymentMode: 'Cash',
      paidAmount: '',
      roundOff: 0,
      notes: ''
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
    roundOff: 0,
    grandTotal: 0
  });

  useEffect(() => {
    fetchItems();
    fetchParties();
    if (id) {
      fetchReturn(id);
    }
  }, [id, returnType]);

  useEffect(() => {
    calculateTotals();
  }, [billItems, form.values.partyState]);

  // Reset form when switching return type (only if not editing)
  const handleReturnTypeChange = (value) => {
    if (id) return; // don't switch if editing
    setReturnType(value);
    resetForm();
  };

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

  const fetchParties = async () => {
    try {
      if (isPurchaseReturn) {
        const response = await businessSupplierAPI.getAll();
        const data = response?.data || response || [];
        setParties(Array.isArray(data) ? data.filter(s => s.status !== 'Inactive') : []);
      } else {
        const response = await businessCustomerAPI.getAll();
        const data = response?.data || response || [];
        setParties(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: `Failed to fetch ${isPurchaseReturn ? 'suppliers' : 'customers'}`,
        color: 'red'
      });
      setParties([]);
    }
  };

  const fetchReturn = async (returnId) => {
    try {
      setLoading(true);
      const api = isPurchaseReturn ? purchaseReturnAPI : salesReturnAPI;
      const response = await api.getById(returnId);
      const returnData = response?.data || response;

      if (!returnData) {
        notifications.show({
          title: 'Error',
          message: 'Return not found',
          color: 'red'
        });
        return;
      }

      // Map fields based on return type
      if (isPurchaseReturn) {
        form.setValues({
          returnDate: returnData.returnDate ? new Date(returnData.returnDate) : new Date(),
          partyId: returnData.supplierId?._id || returnData.supplierId || null,
          partyName: returnData.supplierName || '',
          partyPhone: returnData.supplierPhone || '',
          partyAddress: returnData.supplierAddress || '',
          partyGstin: returnData.supplierGstin || '',
          partyState: returnData.supplierState || 'Tamil Nadu',
          originalInvoiceRef: returnData.originalInvoiceRef || '',
          originalInvoiceDate: returnData.originalInvoiceDate ? new Date(returnData.originalInvoiceDate) : null,
          reason: returnData.reason || '',
          paymentMode: returnData.paymentMode || 'Cash',
          paidAmount: returnData.receivedAmount || '',
          roundOff: returnData.roundOff || 0,
          notes: returnData.notes || ''
        });
        if (returnData.supplierId) {
          setSelectedParty(typeof returnData.supplierId === 'object' ? returnData.supplierId : null);
        }
      } else {
        form.setValues({
          returnDate: returnData.returnDate ? new Date(returnData.returnDate) : new Date(),
          partyId: returnData.customerId?._id || returnData.customerId || null,
          partyName: returnData.customerName || '',
          partyPhone: returnData.customerPhone || '',
          partyAddress: returnData.customerAddress || '',
          partyGstin: returnData.customerGstin || '',
          partyState: returnData.customerState || 'Tamil Nadu',
          originalInvoiceRef: returnData.originalInvoiceRef || '',
          originalInvoiceDate: returnData.originalInvoiceDate ? new Date(returnData.originalInvoiceDate) : null,
          reason: returnData.reason || '',
          paymentMode: returnData.paymentMode || 'Cash',
          paidAmount: returnData.paidAmount || '',
          roundOff: returnData.roundOff || 0,
          notes: returnData.notes || ''
        });
        if (returnData.customerId) {
          setSelectedParty(typeof returnData.customerId === 'object' ? returnData.customerId : null);
        }
      }

      const returnItems = returnData.items || [];
      setBillItems(returnItems.map(item => ({
        itemId: item.itemId?._id || item.itemId,
        itemCode: item.itemCode || '',
        itemName: item.itemName || '',
        hsnCode: item.hsnCode || '',
        quantity: item.quantity || 0,
        unit: item.unit || '',
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
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch return',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePartySelect = (partyId) => {
    if (!partyId) {
      setSelectedParty(null);
      form.setValues({
        ...form.values,
        partyId: null,
        partyName: '',
        partyPhone: '',
        partyAddress: '',
        partyGstin: '',
        partyState: 'Tamil Nadu'
      });
      return;
    }

    const party = parties.find(p => p._id === partyId);
    if (party) {
      setSelectedParty(party);
      if (isPurchaseReturn) {
        form.setValues({
          ...form.values,
          partyId: partyId,
          partyName: party.supplierName || party.name || '',
          partyPhone: party.phone || '',
          partyAddress: party.address || '',
          partyGstin: party.gstNumber || '',
          partyState: party.state || 'Tamil Nadu'
        });
      } else {
        form.setValues({
          ...form.values,
          partyId: partyId,
          partyName: party.customerName || party.name || '',
          partyPhone: party.phone || '',
          partyAddress: party.address || '',
          partyGstin: party.gstNumber || party.gstin || '',
          partyState: party.state || 'Tamil Nadu'
        });
      }
    }
  };

  const handleItemSelect = (itemId) => {
    form.setFieldValue('itemId', itemId);
    if (itemId) {
      const item = items.find(i => i._id === itemId);
      if (item) {
        // Purchase return uses purchasePrice, sales return uses salesRate (BusinessItem field)
        form.setFieldValue('rate', isPurchaseReturn ? (item.purchasePrice || 0) : (item.salesRate || item.sellingPrice || 0));
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
    const itemRate = parseFloat(rate) || (isPurchaseReturn ? item.purchasePrice : (item.salesRate || item.sellingPrice)) || 0;
    const discount = parseFloat(discountPercent) || 0;
    const gstPercent = item.gstPercent || 0;

    // Purchase return: check stock (stock goes out to supplier)
    // Sales return: no stock check (stock comes in from customer)
    if (isPurchaseReturn && qty > item.currentBalance) {
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
        unit: item.unit || '',
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
    const netAmount = taxableAmount + totalGst;
    const roundOff = parseFloat(form.values.roundOff) || (Math.round(netAmount) - netAmount);
    const grandTotal = netAmount + roundOff;

    setCalculations({
      totalQty,
      grossAmount,
      itemDiscount,
      taxableAmount,
      totalCgst,
      totalSgst,
      totalIgst,
      totalGst,
      roundOff,
      grandTotal
    });
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
      let response;
      const api = isPurchaseReturn ? purchaseReturnAPI : salesReturnAPI;

      if (isPurchaseReturn) {
        const payload = {
          returnDate: form.values.returnDate,
          supplierId: form.values.partyId || null,
          supplierName: form.values.partyName,
          supplierPhone: form.values.partyPhone,
          supplierAddress: form.values.partyAddress,
          supplierGstin: form.values.partyGstin,
          supplierState: form.values.partyState,
          originalInvoiceRef: form.values.originalInvoiceRef,
          originalInvoiceDate: form.values.originalInvoiceDate,
          reason: form.values.reason,
          items: billItems,
          roundOff: calculations.roundOff,
          paymentMode: form.values.paymentMode,
          receivedAmount: parseFloat(form.values.paidAmount) || 0,
          notes: form.values.notes
        };

        if (id) {
          response = await api.update(id, payload);
        } else {
          response = await api.create(payload);
        }
      } else {
        const payload = {
          returnDate: form.values.returnDate,
          customerId: form.values.partyId || null,
          customerName: form.values.partyName,
          customerPhone: form.values.partyPhone,
          customerAddress: form.values.partyAddress,
          customerGstin: form.values.partyGstin,
          customerState: form.values.partyState,
          originalInvoiceRef: form.values.originalInvoiceRef,
          originalInvoiceDate: form.values.originalInvoiceDate,
          reason: form.values.reason,
          items: billItems,
          roundOff: calculations.roundOff,
          paymentMode: form.values.paymentMode,
          paidAmount: parseFloat(form.values.paidAmount) || 0,
          notes: form.values.notes
        };

        if (id) {
          response = await api.update(id, payload);
        } else {
          response = await api.create(payload);
        }
      }

      notifications.show({
        title: 'Success',
        message: `${isPurchaseReturn ? 'Purchase' : 'Sales'} return ${id ? 'updated' : 'created'} successfully`,
        color: 'green'
      });

      setSavedReturn(response.data);
      setPrintModalOpened(true);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || `Failed to save ${isPurchaseReturn ? 'purchase' : 'sales'} return`,
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    form.reset();
    setBillItems([]);
    setSelectedParty(null);
    setCalculations({
      totalQty: 0,
      grossAmount: 0,
      itemDiscount: 0,
      taxableAmount: 0,
      totalCgst: 0,
      totalSgst: 0,
      totalIgst: 0,
      totalGst: 0,
      roundOff: 0,
      grandTotal: 0
    });
    setSavedReturn(null);
  };

  const itemOptions = items.map(item => ({
    value: item._id,
    label: `${item.itemCode} - ${item.itemName} (Stock: ${item.currentBalance} ${item.unit})`
  }));

  const partyOptions = parties.map(party => {
    if (isPurchaseReturn) {
      return {
        value: party._id,
        label: `${party.supplierId || ''} - ${party.supplierName || party.name} ${party.phone ? `| ${party.phone}` : ''}`
      };
    } else {
      return {
        value: party._id,
        label: `${party.customerId || ''} - ${party.customerName || party.name} ${party.phone ? `| ${party.phone}` : ''}`
      };
    }
  });

  const stateOptions = [
    'Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana',
    'Maharashtra', 'Gujarat', 'Rajasthan', 'Delhi', 'Uttar Pradesh',
    'West Bengal', 'Bihar', 'Madhya Pradesh', 'Punjab', 'Haryana'
  ].map(s => ({ value: s, label: s }));

  // Labels based on return type
  const partyLabel = isPurchaseReturn ? 'Supplier' : 'Customer';
  const noteType = isPurchaseReturn ? 'Debit Note' : 'Credit Note';
  const returnLabel = isPurchaseReturn ? 'Purchase Return' : 'Sales Return';
  const invoiceLabel = isPurchaseReturn ? 'Original purchase invoice' : 'Original sales invoice';

  if (loading) {
    return (
      <Center h={400}>
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <Container size="xl" py="md">
      {/* Header with Switch */}
      <Paper withBorder p="md" mb="md" radius="md">
        <Group justify="space-between" align="center">
          <Group>
            <ThemeIcon size={40} radius="md" variant="light" color={themeColor}>
              {isPurchaseReturn ? <IconArrowBack size={24} /> : <IconArrowForward size={24} />}
            </ThemeIcon>
            <div>
              <Title order={3}>{id ? `Edit ${returnLabel}` : `Create ${returnLabel}`}</Title>
              <Text size="sm" c="dimmed">
                {isPurchaseReturn
                  ? 'Debit Note - Return goods to supplier'
                  : 'Credit Note - Customer returns goods to you'}
              </Text>
            </div>
          </Group>
          <Group>
            <SegmentedControl
              value={returnType}
              onChange={handleReturnTypeChange}
              disabled={!!id}
              data={[
                { label: 'Purchase Return', value: 'purchase' },
                { label: 'Sales Return', value: 'sales' }
              ]}
              color={themeColor}
              size="sm"
            />
            <Button
              variant="light"
              leftSection={<IconReceipt2 size={16} />}
              onClick={resetForm}
              color={themeColor}
            >
              New Return
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
                <Text fw={600} c={themeColor}>{partyLabel} Details</Text>
                <DateInput
                  value={form.values.returnDate}
                  onChange={(value) => form.setFieldValue('returnDate', value)}
                  leftSection={<IconCalendar size={16} />}
                  placeholder="Return Date"
                  size="xs"
                  w={160}
                  maxDate={new Date()}
                />
              </Group>

              <Grid gutter="sm">
                <Grid.Col span={6}>
                  <Select
                    label={`Select ${partyLabel}`}
                    placeholder={`Search ${partyLabel.toLowerCase()}...`}
                    value={form.values.partyId}
                    onChange={handlePartySelect}
                    data={partyOptions}
                    searchable
                    clearable
                    leftSection={<IconUser size={16} />}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label={`${partyLabel} Name`}
                    placeholder={`Enter ${partyLabel.toLowerCase()} name`}
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

            {/* Original Invoice Reference */}
            <Paper withBorder p="md" radius="md">
              <Text fw={600} c={themeColor} mb="sm">Return Details</Text>
              <Grid gutter="sm">
                <Grid.Col span={4}>
                  <TextInput
                    label="Original Invoice Ref"
                    placeholder={invoiceLabel}
                    value={form.values.originalInvoiceRef}
                    onChange={(e) => form.setFieldValue('originalInvoiceRef', e.target.value)}
                    leftSection={<IconFileInvoice size={16} />}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <DateInput
                    label="Original Invoice Date"
                    value={form.values.originalInvoiceDate}
                    onChange={(value) => form.setFieldValue('originalInvoiceDate', value)}
                    leftSection={<IconCalendar size={16} />}
                    placeholder="Invoice date"
                    clearable
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <TextInput
                    label="Reason for Return"
                    placeholder="Reason..."
                    value={form.values.reason}
                    onChange={(e) => form.setFieldValue('reason', e.target.value)}
                    leftSection={<IconNotes size={16} />}
                  />
                </Grid.Col>
              </Grid>
            </Paper>

            {/* Item Entry */}
            <Paper withBorder p="md" radius="md">
              <Text fw={600} c={themeColor} mb="sm">Add Items to Return</Text>

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
                    color={themeColor}
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
                <Text fw={600} c={themeColor}>Additional Details</Text>
                {showMoreOptions ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
              </Group>

              <Collapse in={showMoreOptions}>
                <Grid gutter="sm" mt="md">
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
              <Text fw={700} size="lg" ta="center" c={themeColor}>Return Summary</Text>

              {/* Party Card */}
              {selectedParty && (
                <Card withBorder p="xs" radius="sm" bg={`${themeColor}.0`}>
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={600}>
                        {isPurchaseReturn
                          ? (selectedParty.supplierName || selectedParty.name)
                          : (selectedParty.customerName || selectedParty.name)}
                      </Text>
                      <Text size="xs" c="dimmed">{selectedParty.phone}</Text>
                    </div>
                    <Badge color={themeColor} size="sm">{partyLabel}</Badge>
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
                  <Text fw={700} size="lg" c={themeColor}>{calculations.grandTotal.toFixed(2)}</Text>
                </Group>
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
                      { value: 'Cheque', label: 'Cheque' },
                      { value: 'Adjustment', label: 'Adjustment' }
                    ]}
                    size="xs"
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput
                    label={isPurchaseReturn ? 'Received' : 'Refunded'}
                    placeholder={isPurchaseReturn ? 'Amount received' : 'Amount refunded'}
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
                <Card p="xs" bg={parseFloat(form.values.paidAmount) >= calculations.grandTotal ? 'green.0' : 'orange.0'}>
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      {parseFloat(form.values.paidAmount) >= calculations.grandTotal ? 'Excess' : 'Balance'}
                    </Text>
                    <Text size="sm" fw={600} c={parseFloat(form.values.paidAmount) >= calculations.grandTotal ? 'green' : 'orange'}>
                      {Math.abs(calculations.grandTotal - parseFloat(form.values.paidAmount)).toFixed(2)}
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
                color={themeColor}
              >
                {id ? 'Update Return' : 'Save Return'}
              </Button>

              <Group grow>
                <Button
                  variant="light"
                  color="gray"
                  onClick={() => navigate('/')}
                >
                  Cancel
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconPrinter size={16} />}
                  onClick={() => savedReturn && handlePrint()}
                  disabled={!savedReturn}
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
        title={`${returnLabel} Saved`}
        centered
      >
        <Stack>
          <Alert color="green" icon={<IconCheck size={16} />}>
            <Text size="sm">
              {noteType} <strong>{savedReturn?.returnNumber}</strong> has been saved successfully!
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
              color={themeColor}
            >
              Print {noteType}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Hidden Print Section */}
      <div style={{ display: 'none' }}>
        <div ref={printRef} style={{ padding: '20px', fontFamily: 'Arial, sans-serif', fontSize: '12px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '15px' }}>
            <h1 style={{ margin: '0', fontSize: '24px' }}>{selectedCompany?.companyName || 'BUSINESS NAME'}</h1>
            <p style={{ margin: '5px 0', fontSize: '11px' }}>{selectedCompany?.address || 'Address Line'}</p>
            <p style={{ margin: '2px 0', fontSize: '11px' }}>
              GSTIN: {selectedCompany?.gstNumber || 'XXXXXXXXX'} | Phone: {selectedCompany?.phone || 'XXXXXXXXXX'}
            </p>
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: '0', fontSize: '18px', textTransform: 'uppercase' }}>
              {isPurchaseReturn ? 'DEBIT NOTE / PURCHASE RETURN' : 'CREDIT NOTE / SALES RETURN'}
            </h2>
          </div>

          {/* Details */}
          <table style={{ width: '100%', marginBottom: '15px' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'top' }}>
                  <strong>{partyLabel}:</strong><br />
                  {form.values.partyName || '-'}<br />
                  {form.values.partyPhone && <span>Phone: {form.values.partyPhone}<br /></span>}
                  {form.values.partyGstin && <span>GSTIN: {form.values.partyGstin}<br /></span>}
                  {form.values.partyAddress && <span>{form.values.partyAddress}<br /></span>}
                  {form.values.partyState && <span>State: {form.values.partyState}</span>}
                </td>
                <td style={{ width: '50%', verticalAlign: 'top', textAlign: 'right' }}>
                  <strong>{noteType} No:</strong> {savedReturn?.returnNumber || '-'}<br />
                  <strong>Date:</strong> {dayjs(form.values.returnDate).format('DD-MM-YYYY')}<br />
                  {form.values.originalInvoiceRef && <span><strong>Orig. Invoice:</strong> {form.values.originalInvoiceRef}<br /></span>}
                  {form.values.reason && <span><strong>Reason:</strong> {form.values.reason}</span>}
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
                  <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'right' }}>{Number(item.rate).toFixed(2)}</td>
                  <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'right' }}>{Number(item.discountAmount || 0).toFixed(2)}</td>
                  <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'right' }}>
                    {item.gstPercent}%<br />
                    <span style={{ fontSize: '10px' }}>{(Number(item.cgstAmount || 0) + Number(item.sgstAmount || 0) + Number(item.igstAmount || 0)).toFixed(2)}</span>
                  </td>
                  <td style={{ border: '1px solid #333', padding: '6px', textAlign: 'right' }}>{Number(item.totalAmount || 0).toFixed(2)}</td>
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
                  <em>Rupees {Math.floor(calculations.grandTotal)} Only</em>
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
                      {isPurchaseReturn
                        ? '1. This is a debit note for goods returned to supplier.'
                        : '1. This is a credit note for goods returned by customer.'}
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
            <p style={{ margin: '0', fontSize: '10px' }}>This is a computer generated {noteType.toLowerCase()}.</p>
          </div>
        </div>
      </div>
    </Container>
  );
};

export default PurchaseReturnForm;
