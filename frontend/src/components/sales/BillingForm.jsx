
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
  Box,
  useMantineTheme,
  Grid,
  SimpleGrid,
  Badge,
  ActionIcon,
  Modal,
  ScrollArea,
  Kbd
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
  IconQrcode,
  IconUserCircle,
  IconPercentage,
  IconReceiptRefund,
  IconReceipt2,
  IconDeviceMobile,
  IconCoin,
  IconCalendar,
  IconTag,
  IconInfoCircle
} from '@tabler/icons-react';
import { farmerAPI, itemAPI, salesAPI, customerAPI, collectionCenterAPI, subsidyAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';

const BillingForm = () => {
  const theme = useMantineTheme();
  const navigate = useNavigate();
  const printRef = useRef();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [collectionCenters, setCollectionCenters] = useState([]);
  const [subsidies, setSubsidies] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedFarmerNumber, setSelectedFarmerNumber] = useState('');
  const [billItems, setBillItems] = useState([]);
  const [showBalanceAlert, setShowBalanceAlert] = useState(false);
  const [printModalOpened, setPrintModalOpened] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [billDate, setBillDate] = useState(new Date());
  const [selectedItemPreview, setSelectedItemPreview] = useState(null);

  const form = useForm({
    initialValues: {
      customerType: 'Other',
      customerId: null,
      customerName: '',
      customerPhone: '',
      itemId: null,
      quantity: '1',
      collectionCenterId: null,
      subsidyId: null,
      paymentMode: 'Cash',
      paidAmount: ''
    },

    validate: (values) => {
      const errors = {};
      
      if (values.customerType === 'Farmer' && !values.customerId) {
        errors.customerId = 'Please select a farmer';
      } else if (values.customerType === 'Customer' && !values.customerId) {
        errors.customerId = 'Please select a customer';
      } else if (values.customerType === 'Other') {
        if (!values.customerName) {
          errors.customerName = 'Please enter customer name';
        }
      }
      
      return errors;
    },
  });

  const [calculations, setCalculations] = useState({
    subtotal: 0,
    totalGst: 0,
    grandTotal: 0,
    oldBalance: 0,
    totalDue: 0,
    discount: 0
  });

  useEffect(() => {
    fetchItems();
    fetchFarmers();
    fetchCustomers();
    fetchCollectionCenters();
    fetchSubsidies();
  }, []);

  // Calculate totals whenever billItems change
  useEffect(() => {
    calculateTotals();
  }, [billItems]);

  const fetchItems = async () => {
    try {
      const response = await itemAPI.getAll();
      setItems(response.data.filter(item => item.status === 'Active'));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch items',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  const fetchFarmers = async () => {
    try {
      const response = await farmerAPI.getAll();
      setFarmers(response.data.filter(farmer => farmer.status === 'Active'));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch farmers',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await customerAPI.getAll();
      setCustomers(response.data.filter(customer => customer.active === true));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch customers',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  const fetchCollectionCenters = async () => {
    try {
      const response = await collectionCenterAPI.getAll();
      setCollectionCenters(response.data.filter(center => center.status === 'Active'));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch collection centers',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  const fetchSubsidies = async () => {
    try {
      const response = await subsidyAPI.getAll();
      setSubsidies(response.data.filter(subsidy => subsidy.status === 'Active'));
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch subsidies',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    }
  };

  const fetchPreviousBalance = async (customerId) => {
    try {
      const response = await salesAPI.getCustomerHistory(customerId);
      const sales = response.data || [];
      return sales.reduce((sum, sale) => sum + (sale.balanceAmount || 0), 0);
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
    setShowBalanceAlert(false);
  };

  const handleFarmerSelect = async (farmerId) => {
    if (!farmerId) {
      setSelectedCustomer(null);
      setSelectedFarmerNumber('');
      form.setValues({
        ...form.values,
        customerId: null,
        customerName: '',
        customerPhone: ''
      });
      setCalculations(prev => ({ ...prev, oldBalance: 0 }));
      setShowBalanceAlert(false);
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
      setShowBalanceAlert(previousBalance > 0);
    }
  };

  const handleCustomerSelect = async (customerId) => {
    if (!customerId) {
      setSelectedCustomer(null);
      form.setValues({
        ...form.values,
        customerId: null,
        customerName: '',
        customerPhone: ''
      });
      setCalculations(prev => ({ ...prev, oldBalance: 0 }));
      setShowBalanceAlert(false);
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
      setShowBalanceAlert(totalOldBalance > 0);
    }
  };

  const handleBarcodeInput = (e) => {
    const value = e.target.value;
    setBarcodeInput(value);
    
    // Simulate barcode scanning with Enter key
    if (e.key === 'Enter' && value.trim()) {
      const item = items.find(i => i.itemCode === value.trim());
      if (item) {
        form.setFieldValue('itemId', item._id);
        setTimeout(() => handleAddItem(), 100);
      }
      setBarcodeInput('');
    }
  };

  const handleAddItem = () => {
    if (!form.values.itemId || !form.values.quantity) {
      notifications.show({
        title: 'Error',
        message: 'Please select item and enter quantity',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
      return;
    }

    const item = items.find(i => i._id === form.values.itemId);
    if (!item) return;

    if (parseFloat(form.values.quantity) > item.currentBalance) {
      notifications.show({
        title: 'Insufficient Stock',
        message: `Available: ${item.currentBalance} ${item.unit}`,
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
      return;
    }

    const quantity = parseFloat(form.values.quantity);
    const rate = item.salesRate || 0;
    const amount = quantity * rate;
    const gstAmount = (amount * (item.gstPercent || 0)) / 100;

    // Check if item already exists in bill
    const existingItemIndex = billItems.findIndex(bi => bi.itemId === item._id);
    
    if (existingItemIndex > -1) {
      // Update existing item quantity
      const updatedItems = [...billItems];
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity: updatedItems[existingItemIndex].quantity + quantity,
        amount: (updatedItems[existingItemIndex].quantity + quantity) * rate,
        gstAmount: ((updatedItems[existingItemIndex].quantity + quantity) * rate * (item.gstPercent || 0)) / 100
      };
      setBillItems(updatedItems);
    } else {
      // Add new item
      const newItem = {
        itemId: item._id,
        itemName: item.itemName,
        itemCode: item.itemCode,
        unit: item.unit,
        quantity,
        rate,
        amount,
        gstPercent: item.gstPercent || 0,
        gstAmount
      };
      setBillItems([...billItems, newItem]);
    }

    form.setFieldValue('itemId', null);
    form.setFieldValue('quantity', '1');
    setBarcodeInput('');
    setSelectedItemPreview(null);
  };

  const handleRemoveItem = (index) => {
    const updatedItems = billItems.filter((_, i) => i !== index);
    setBillItems(updatedItems);
  };

  const handleQuantityChange = (index, newQuantity) => {
    const updatedItems = [...billItems];
    const item = updatedItems[index];
    updatedItems[index] = {
      ...item,
      quantity: newQuantity,
      amount: newQuantity * item.rate,
      gstAmount: (newQuantity * item.rate * item.gstPercent) / 100
    };
    setBillItems(updatedItems);
  };

  const calculateTotals = () => {
    const subtotal = billItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalGst = billItems.reduce((sum, item) => sum + (item.gstAmount || 0), 0);
    const grandTotal = subtotal + totalGst - calculations.discount;
    const totalDue = grandTotal + calculations.oldBalance;

    setCalculations(prev => ({
      ...prev,
      subtotal,
      totalGst,
      grandTotal,
      totalDue
    }));
  };

  const handleDiscountChange = (value) => {
    const discount = Math.min(parseFloat(value) || 0, calculations.subtotal);
    setCalculations(prev => ({
      ...prev,
      discount,
      grandTotal: prev.subtotal + prev.totalGst - discount
    }));
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    onAfterPrint: () => {
      setPrintModalOpened(false);
      resetForm();
    }
  });

  const handleSubmit = async (values) => {
    if (billItems.length === 0) {
      notifications.show({
        title: 'Error',
        message: 'Please add at least one item',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        billDate: billDate ? billDate.toISOString() : new Date().toISOString(),
        customerType: values.customerType,
        customerId: (values.customerType === 'Farmer' || values.customerType === 'Customer') ? values.customerId : null,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        items: billItems,
        subtotal: calculations.subtotal,
        totalGst: calculations.totalGst,
        discount: calculations.discount,
        grandTotal: calculations.grandTotal,
        oldBalance: calculations.oldBalance,
        totalDue: calculations.totalDue,
        collectionCenterId: values.collectionCenterId || null,
        subsidyId: values.subsidyId || null,
        paymentMode: values.paymentMode,
        paidAmount: parseFloat(values.paidAmount) || 0,
        balanceAmount: calculations.totalDue - (parseFloat(values.paidAmount) || 0)
      };

      await salesAPI.create(payload);
      
      setPrintModalOpened(true);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create bill',
        color: 'red',
        icon: <IconAlertCircle size={16} />
      });
    } finally {
      setLoading(false);
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
      grandTotal: 0,
      oldBalance: 0,
      totalDue: 0,
      discount: 0
    });
    setBarcodeInput('');
    setBillDate(new Date());
    setSelectedItemPreview(null);
  };

  const itemOptions = items.map(item => ({
    value: item._id,
    label: `${item.itemCode} - ${item.itemName} (${item.currentBalance} ${item.unit})`
  }));

  const farmerOptions = farmers.map(farmer => ({
    value: farmer._id,
    label: `${farmer.farmerNumber || ''} - ${farmer.personalDetails?.name || 'N/A'} ${farmer.memberId ? ` | ${farmer.memberId}` : ''}`
  }));

  const customerOptions = customers.map(customer => ({
    value: customer._id,
    label: `${customer.customerId} - ${customer.name} ${customer.phone ? ` | ${customer.phone}` : ''}`
  }));

  const quickItems = items.slice(0, 8); // Show first 8 items as quick buttons

  return (
    <Container size="xl" py="md">
      <PageHeader
        title="POS Billing"
        subtitle="Quick billing system"
        extra={
          <Group spacing="xs">
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={resetForm}
              variant="light"
              color="gray"
              size="sm"
            >
              New Bill
            </Button>
            <Button
              leftSection={<IconPrinter size={16} />}
              onClick={() => printRef.current && handlePrint()}
              variant="light"
              size="sm"
              disabled={billItems.length === 0}
            >
              Print Preview
            </Button>
          </Group>
        }
      />

      {/* POS Layout */}
      <Grid gutter="md">
        {/* Left Panel - Product Selection */}
        <Grid.Col span={8}>
          <Paper withBorder radius="md" style={{ height: '100%' }}>
            <Stack spacing="md" p="md">
              {/* Quick Search */}
              <Box>
                <TextInput
                  placeholder="Scan barcode or search items..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeInput}
                  leftSection={<IconBarcode size={16} />}
                  rightSection={
                    <Kbd size="xs" mr="xs">
                      Enter
                    </Kbd>
                  }
                  styles={{
                    input: {
                      fontSize: '16px',
                      height: '50px'
                    }
                  }}
                />
              </Box>

              {/* Quick Item Buttons */}
              <Box>
                <Text size="sm" fw={500} mb="xs">Quick Items</Text>
                <SimpleGrid cols={4} spacing="xs">
                  {quickItems.map(item => (
                    <Button
                      key={item._id}
                      variant="light"
                      color="blue"
                      size="sm"
                      onClick={() => {
                        form.setFieldValue('itemId', item._id);
                        handleAddItem();
                      }}
                      styles={{
                        root: {
                          height: '60px',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '8px 4px'
                        }
                      }}
                    >
                      <Text size="xs" lineClamp={1} fw={500}>{item.itemName}</Text>
                      <Text size="xs" c="dimmed">₹{item.salesRate}</Text>
                    </Button>
                  ))}
                </SimpleGrid>
              </Box>

              {/* Product Search */}
              <Box>
                <Select
                  label="Search Product"
                  placeholder="Type product name or code..."
                  value={form.values.itemId}
                  onChange={(value) => {
                    form.setFieldValue('itemId', value);
                    // Set selected item preview
                    if (value) {
                      const item = items.find(i => i._id === value);
                      if (item) {
                        setSelectedItemPreview({
                          itemName: item.itemName,
                          itemCode: item.itemCode,
                          salesRate: item.salesRate || 0,
                          currentBalance: item.currentBalance || 0,
                          unit: item.unit || item.measurement || '',
                          gstPercent: item.gstPercent || 0
                        });
                      }
                    } else {
                      setSelectedItemPreview(null);
                    }
                  }}
                  data={itemOptions}
                  searchable
                  clearable
                  nothingFoundMessage="No items found"
                  leftSection={<IconSearch size={16} />}
                  styles={{
                    input: {
                      height: '40px'
                    }
                  }}
                />

                {/* Selected Item Preview Card */}
                {selectedItemPreview && (
                  <Card withBorder mt="xs" p="xs" bg="blue.0" radius="sm">
                    <Group justify="space-between" align="flex-start">
                      <Box>
                        <Group gap={4}>
                          <IconTag size={14} color="blue" />
                          <Text size="sm" fw={600}>{selectedItemPreview.itemName}</Text>
                        </Group>
                        <Text size="xs" c="dimmed">Code: {selectedItemPreview.itemCode}</Text>
                      </Box>
                      <Box ta="right">
                        <Text size="lg" fw={700} c="green">
                          ₹{selectedItemPreview.salesRate}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Stock: {selectedItemPreview.currentBalance} {selectedItemPreview.unit}
                        </Text>
                        {selectedItemPreview.gstPercent > 0 && (
                          <Text size="xs" c="orange">
                            +{selectedItemPreview.gstPercent}% GST
                          </Text>
                        )}
                      </Box>
                    </Group>
                    {/* Show calculated amount preview */}
                    {form.values.quantity && parseFloat(form.values.quantity) > 0 && (
                      <>
                        <Divider my={4} />
                        <Group justify="space-between">
                          <Text size="xs" c="dimmed">
                            {form.values.quantity} × ₹{selectedItemPreview.salesRate}
                          </Text>
                          <Text size="sm" fw={600} c="blue">
                            = ₹{(parseFloat(form.values.quantity) * selectedItemPreview.salesRate).toFixed(2)}
                            {selectedItemPreview.gstPercent > 0 && (
                              <Text span size="xs" c="dimmed">
                                {' '}(+₹{((parseFloat(form.values.quantity) * selectedItemPreview.salesRate * selectedItemPreview.gstPercent) / 100).toFixed(2)} GST)
                              </Text>
                            )}
                          </Text>
                        </Group>
                      </>
                    )}
                  </Card>
                )}

                <Grid gutter="xs" mt="xs">
                  <Grid.Col span={8}>
                    <NumberInput
                      label="Quantity"
                      value={form.values.quantity}
                      onChange={(value) => form.setFieldValue('quantity', value)}
                      min={0.01}
                      step={0.01}
                      decimalScale={2}
                      leftSection={<IconCalculator size={16} />}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Box pt={28}>
                      <Button
                        fullWidth
                        leftSection={<IconPlus size={16} />}
                        onClick={handleAddItem}
                        color="green"
                        disabled={!form.values.itemId}
                      >
                        Add
                      </Button>
                    </Box>
                  </Grid.Col>
                </Grid>
              </Box>

              {/* Customer Information */}
              <Box>
                <Divider label="Customer Information" labelPosition="center" mb="xs" />
                <Grid gutter="xs">
                  <Grid.Col span={3}>
                    <Select
                      label="Type"
                      value={form.values.customerType}
                      onChange={handleCustomerTypeChange}
                      data={[
                        { value: 'Farmer', label: 'Farmer' },
                        { value: 'Customer', label: 'Customer' },
                        { value: 'Other', label: 'Other' }
                      ]}
                      leftSection={<IconUserCircle size={16} />}
                      size="xs"
                    />
                  </Grid.Col>
                  <Grid.Col span={9}>
                    {form.values.customerType === 'Farmer' ? (
                      <Select
                        label="Select Farmer"
                        placeholder="Search farmer..."
                        value={form.values.customerId}
                        onChange={handleFarmerSelect}
                        data={farmerOptions}
                        error={form.errors.customerId}
                        searchable
                        clearable
                        size="xs"
                      />
                    ) : form.values.customerType === 'Customer' ? (
                      <Select
                        label="Select Customer"
                        placeholder="Search customer..."
                        value={form.values.customerId}
                        onChange={handleCustomerSelect}
                        data={customerOptions}
                        error={form.errors.customerId}
                        searchable
                        clearable
                        size="xs"
                      />
                    ) : (
                      <Grid gutter="xs">
                        <Grid.Col span={6}>
                          <TextInput
                            label="Name"
                            placeholder="Enter name"
                            value={form.values.customerName}
                            onChange={(e) => form.setFieldValue('customerName', e.target.value)}
                            error={form.errors.customerName}
                            size="xs"
                          />
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <TextInput
                            label="Phone"
                            placeholder="Enter phone"
                            value={form.values.customerPhone}
                            onChange={(e) => form.setFieldValue('customerPhone', e.target.value)}
                            size="xs"
                          />
                        </Grid.Col>
                      </Grid>
                    )}
                  </Grid.Col>
                </Grid>
              </Box>
            </Stack>
          </Paper>
        </Grid.Col>

        {/* Right Panel - Bill Summary */}
        <Grid.Col span={4}>
          <Paper withBorder radius="md" style={{ height: '100%' }}>
            <Stack spacing="md" p="md">
              {/* Bill Header */}
              <Group position="apart">
                <div>
                  <Text fw={700} size="xl">Bill #{dayjs().format('YYYYMMDDHHmm')}</Text>
                </div>
                <Badge color="green" size="lg" variant="filled">
                  Active
                </Badge>
              </Group>

              {/* Bill Date */}
              <DateInput
                label="Bill Date"
                placeholder="Select bill date"
                leftSection={<IconCalendar size={16} />}
                value={billDate}
                onChange={(value) => setBillDate(value)}
                size="xs"
                maxDate={new Date()}
              />

              {/* Customer Info */}
              {(form.values.customerName || selectedCustomer) && (
                <Card withBorder radius="sm" p="xs">
                  <Group position="apart">
                    <Text size="sm" fw={500}>
                      {form.values.customerName || selectedCustomer?.name}
                    </Text>
                    <Badge size="sm" color="blue">
                      {form.values.customerType}
                    </Badge>
                  </Group>
                  {form.values.customerPhone && (
                    <Text size="xs" c="dimmed">{form.values.customerPhone}</Text>
                  )}
                </Card>
              )}

              {/* Items List */}
              <ScrollArea style={{ height: 300 }}>
                <Stack spacing="xs">
                  {billItems.length === 0 ? (
                    <Center py="xl">
                      <Text c="dimmed" size="sm">No items added</Text>
                    </Center>
                  ) : (
                    billItems.map((item, index) => (
                      <Paper key={index} withBorder p="xs" radius="sm">
                        <Group position="apart" wrap="nowrap">
                          <Box style={{ flex: 1 }}>
                            <Text size="sm" fw={500} lineClamp={1}>
                              {item.itemName}
                            </Text>
                            <Group spacing="xs">
                              <Text size="xs" c="dimmed">
                                ₹{item.rate} × {item.quantity} {item.unit}
                              </Text>
                            </Group>
                          </Box>
                          <Group spacing="xs" wrap="nowrap">
                            <NumberInput
                              value={item.quantity}
                              onChange={(value) => handleQuantityChange(index, value)}
                              min={0.01}
                              step={0.01}
                              decimalScale={2}
                              size="xs"
                              style={{ width: 70 }}
                            />
                            <Text fw={600} size="sm" style={{ minWidth: 60, textAlign: 'right' }}>
                              ₹{(item.amount + item.gstAmount).toFixed(2)}
                            </Text>
                            <ActionIcon
                              color="red"
                              size="sm"
                              variant="light"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Paper>
                    ))
                  )}
                </Stack>
              </ScrollArea>

              {/* Bill Summary */}
              <Box>
                <Stack spacing={4}>
                  <Group position="apart">
                    <Text size="sm" c="dimmed">Subtotal</Text>
                    <Text size="sm">₹{calculations.subtotal.toFixed(2)}</Text>
                  </Group>
                  <Group position="apart">
                    <Text size="sm" c="dimmed">GST</Text>
                    <Text size="sm">₹{calculations.totalGst.toFixed(2)}</Text>
                  </Group>
                  <Group position="apart">
                    <Group spacing={4}>
                      <IconPercentage size={14} />
                      <Text size="sm" c="dimmed">Discount</Text>
                    </Group>
                    <NumberInput
                      value={calculations.discount}
                      onChange={handleDiscountChange}
                      min={0}
                      max={calculations.subtotal}
                      step={1}
                      size="xs"
                      style={{ width: 100 }}
                      rightSection={<IconCurrencyRupee size={12} />}
                    />
                  </Group>
                  {calculations.oldBalance > 0 && (
                    <Group position="apart">
                      <Text size="sm" c="orange">Old Balance</Text>
                      <Text size="sm" c="orange">₹{calculations.oldBalance.toFixed(2)}</Text>
                    </Group>
                  )}
                  <Divider />
                  <Group position="apart">
                    <Text fw={700} size="lg">Total Due</Text>
                    <Text fw={700} size="lg" c="blue">₹{calculations.totalDue.toFixed(2)}</Text>
                  </Group>
                </Stack>
              </Box>

              {/* Payment Section */}
              <Box>
                <Divider label="Payment" labelPosition="center" mb="xs" />
                <Grid gutter="xs">
                  <Grid.Col span={6}>
                    <Select
                      label="Mode"
                      value={form.values.paymentMode}
                      onChange={(value) => form.setFieldValue('paymentMode', value)}
                      data={[
                        { value: 'Cash', label: 'Cash' },
                        { value: 'Card', label: 'Card' },
                        { value: 'UPI', label: 'UPI' },
                        { value: 'Credit', label: 'Credit' }
                      ]}
                      leftSection={<IconCreditCard size={16} />}
                      size="xs"
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Paid Amount"
                      placeholder="Enter amount"
                      value={form.values.paidAmount}
                      onChange={(value) => form.setFieldValue('paidAmount', value)}
                      min={0}
                      max={calculations.totalDue}
                      step={0.01}
                      decimalScale={2}
                      leftSection={<IconCurrencyRupee size={16} />}
                      size="xs"
                    />
                  </Grid.Col>
                </Grid>
                {form.values.paidAmount > 0 && (
                  <Card mt="xs" p="xs" bg="green.0">
                    <Group position="apart">
                      <Text size="sm" fw={500}>Change</Text>
                      <Text size="sm" fw={600} c="green">
                        ₹{(parseFloat(form.values.paidAmount) - calculations.totalDue).toFixed(2)}
                      </Text>
                    </Group>
                  </Card>
                )}
              </Box>

              {/* Action Buttons */}
              <Button
                size="lg"
                leftSection={<IconDeviceFloppy size={20} />}
                onClick={form.onSubmit(handleSubmit)}
                loading={loading}
                disabled={billItems.length === 0}
                fullWidth
                color="green"
                styles={{
                  root: {
                    height: '50px',
                    fontSize: '16px'
                  }
                }}
              >
                {loading ? 'Processing...' : 'Save & Print Bill'}
              </Button>

              <Group grow>
                <Button
                  variant="light"
                  leftSection={<IconX size={16} />}
                  onClick={() => navigate('/sales')}
                  color="gray"
                >
                  Cancel
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconReceipt2 size={16} />}
                  onClick={resetForm}
                  color="blue"
                >
                  New Bill
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Print Confirmation Modal */}
      <Modal
        opened={printModalOpened}
        onClose={() => setPrintModalOpened(false)}
        title="Bill Created Successfully"
        centered
        size="sm"
      >
        <Stack>
          <Alert color="green" icon={<IconCheck size={16} />}>
            <Text size="sm">Bill has been saved successfully!</Text>
          </Alert>
          <Text size="sm" ta="center">Do you want to print the bill?</Text>
          <Group position="right">
            <Button
              variant="light"
              onClick={() => {
                setPrintModalOpened(false);
                resetForm();
              }}
            >
              Skip
            </Button>
            <Button
              leftSection={<IconPrinter size={16} />}
              onClick={() => {
                handlePrint();
                setPrintModalOpened(false);
              }}
              color="green"
            >
              Print
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Hidden Print Section */}
      <div style={{ display: 'none' }}>
        <div ref={printRef} style={{ padding: '20px', fontFamily: 'monospace', fontSize: '12px' }}>
          {/* Thermal Printer Style Bill */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: '5px 0' }}>DAIRY COOPERATIVE</h2>
            <p style={{ margin: '2px 0' }}>--------------------------------</p>
            <p style={{ margin: '2px 0' }}>GSTIN: XXXXXXXX</p>
            <p style={{ margin: '2px 0' }}>Phone: XXXXXXXXXX</p>
            <p style={{ margin: '2px 0' }}>{dayjs(billDate).format('DD-MM-YYYY HH:mm:ss')}</p>
            <p style={{ margin: '2px 0' }}>--------------------------------</p>
          </div>

          {/* Customer Info */}
          {(form.values.customerName || selectedCustomer) && (
            <div style={{ marginBottom: '10px' }}>
              <p style={{ margin: '2px 0' }}>
                <strong>Customer:</strong> {form.values.customerName || selectedCustomer?.name}
              </p>
              {form.values.customerPhone && (
                <p style={{ margin: '2px 0' }}>
                  <strong>Phone:</strong> {form.values.customerPhone}
                </p>
              )}
              <p style={{ margin: '2px 0' }}>
                <strong>Type:</strong> {form.values.customerType}
              </p>
            </div>
          )}

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0' }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '1px dashed #000', padding: '3px 0', textAlign: 'left' }}>Item</th>
                <th style={{ borderBottom: '1px dashed #000', padding: '3px 0', textAlign: 'right' }}>Qty</th>
                <th style={{ borderBottom: '1px dashed #000', padding: '3px 0', textAlign: 'right' }}>Price</th>
                <th style={{ borderBottom: '1px dashed #000', padding: '3px 0', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {billItems.map((item, index) => (
                <tr key={index}>
                  <td style={{ padding: '3px 0', borderBottom: '1px dotted #ccc' }}>
                    {item.itemName}
                  </td>
                  <td style={{ padding: '3px 0', textAlign: 'right', borderBottom: '1px dotted #ccc' }}>
                    {item.quantity} {item.unit}
                  </td>
                  <td style={{ padding: '3px 0', textAlign: 'right', borderBottom: '1px dotted #ccc' }}>
                    {item.rate.toFixed(2)}
                  </td>
                  <td style={{ padding: '3px 0', textAlign: 'right', borderBottom: '1px dotted #ccc' }}>
                    {(item.amount + item.gstAmount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary */}
          <div style={{ marginTop: '20px' }}>
            <p style={{ margin: '2px 0', textAlign: 'right' }}>
              Subtotal: ₹{calculations.subtotal.toFixed(2)}
            </p>
            <p style={{ margin: '2px 0', textAlign: 'right' }}>
              GST: ₹{calculations.totalGst.toFixed(2)}
            </p>
            {calculations.discount > 0 && (
              <p style={{ margin: '2px 0', textAlign: 'right' }}>
                Discount: -₹{calculations.discount.toFixed(2)}
              </p>
            )}
            {calculations.oldBalance > 0 && (
              <p style={{ margin: '2px 0', textAlign: 'right' }}>
                Old Balance: ₹{calculations.oldBalance.toFixed(2)}
              </p>
            )}
            <p style={{ margin: '5px 0', textAlign: 'right', borderTop: '1px dashed #000', paddingTop: '5px' }}>
              <strong>GRAND TOTAL: ₹{calculations.totalDue.toFixed(2)}</strong>
            </p>
            {form.values.paidAmount > 0 && (
              <>
                <p style={{ margin: '2px 0', textAlign: 'right' }}>
                  Paid: ₹{parseFloat(form.values.paidAmount).toFixed(2)}
                </p>
                <p style={{ margin: '2px 0', textAlign: 'right' }}>
                  Balance: ₹{(calculations.totalDue - parseFloat(form.values.paidAmount)).toFixed(2)}
                </p>
              </>
            )}
          </div>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <p style={{ margin: '2px 0' }}>--------------------------------</p>
            <p style={{ margin: '2px 0' }}><strong>Thank You!</strong></p>
            <p style={{ margin: '2px 0' }}>Please visit again</p>
            <p style={{ margin: '2px 0' }}>--------------------------------</p>
          </div>
        </div>
      </div>
    </Container>
  );
};

export default BillingForm;