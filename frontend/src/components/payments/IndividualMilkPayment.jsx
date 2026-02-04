import { useState, useEffect } from 'react';
import { message } from '../../utils/toast';
import { farmerAPI, paymentAPI, advanceAPI, farmerLedgerAPI, producerLoanAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Container,
  Card,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Select,
  TextInput,
  NumberInput,
  Button,
  Table,
  Badge,
  Divider,
  Loader,
  Box,
  ActionIcon,
  Grid,
  Alert,
  Switch,
  Modal,
  ScrollArea,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconTrash, IconPlus, IconSearch, IconCurrencyRupee, IconCalendar, IconAlertCircle, IconEye } from '@tabler/icons-react';

const IndividualMilkPayment = () => {
  const { canWrite } = useAuth();
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [farmers, setFarmers] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deductions, setDeductions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [farmerAdvances, setFarmerAdvances] = useState({
    cfAdvance: 0,
    loanAdvance: 0,
    cashAdvance: 0
  });
  const [previousBalance, setPreviousBalance] = useState(0);
  const [welfareEligible, setWelfareEligible] = useState(true);
  const [welfareCheckLoading, setWelfareCheckLoading] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    farmerId: '',
    paymentDate: new Date(),
    milkAmount: '',
    welfareRecovery: 0,
    welfareRecoveryEnabled: false,
    cfAdvanceDeduction: '',
    loanAdvanceDeduction: '',
    cashAdvanceDeduction: '',
    paymentMode: 'Cash',
    paidAmount: '',
    remarks: ''
  });

  // Deduction form fields
  const [deductionForm, setDeductionForm] = useState({
    type: '',
    amount: '',
    description: ''
  });

  const [calculations, setCalculations] = useState({
    milkAmount: 0,
    welfareRecovery: 0,
    cfAdvanceDeduction: 0,
    loanAdvanceDeduction: 0,
    cashAdvanceDeduction: 0,
    totalAdvanceDeduction: 0,
    otherDeductions: 0,
    previousBalance: 0,
    totalDeduction: 0,
    netPayable: 0
  });

  useEffect(() => {
    searchFarmer('');
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setPaymentsLoading(true);
      const response = await paymentAPI.getAll({ limit: 50, sortBy: 'paymentDate', sortOrder: 'desc' });
      setPayments(response.data || []);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const searchFarmer = async (value) => {
    try {
      setSearchLoading(true);
      let response;
      if (value && value.trim().length > 0) {
        response = await farmerAPI.search(value.trim());
      } else {
        response = await farmerAPI.getAll({ status: 'Active' });
      }
      setFarmers(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to search farmers');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFarmerSelect = async (farmerId) => {
    const farmer = farmers.find(f => f._id === farmerId);
    if (farmer) {
      setSelectedFarmer(farmer);
      setFormData(prev => ({ ...prev, farmerId }));

      // Fetch farmer's outstanding by type (includes both advances and loans)
      try {
        const response = await farmerLedgerAPI.getOutstandingByType(farmerId);
        const outstanding = response.data || {};

        // Priority order: Loan Advance > CF Advance > Cash Advance
        setFarmerAdvances({
          loanAdvance: outstanding['Loan Advance']?.amount || 0,
          cfAdvance: outstanding['CF Advance']?.amount || 0,
          cashAdvance: outstanding['Cash Advance']?.amount || 0
        });
      } catch (error) {
        console.error('Failed to fetch outstanding:', error);
        setFarmerAdvances({ cfAdvance: 0, loanAdvance: 0, cashAdvance: 0 });
      }

      // Check welfare recovery eligibility for current month
      try {
        setWelfareCheckLoading(true);
        const welfareResponse = await farmerLedgerAPI.checkWelfare(farmerId, new Date().toISOString());
        setWelfareEligible(welfareResponse.data?.eligibleForDeduction || false);
        // Auto-enable welfare if eligible
        if (welfareResponse.data?.eligibleForDeduction) {
          setFormData(prev => ({
            ...prev,
            welfareRecoveryEnabled: true,
            welfareRecovery: 20
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            welfareRecoveryEnabled: false,
            welfareRecovery: 0
          }));
        }
      } catch (error) {
        console.error('Failed to check welfare eligibility:', error);
        setWelfareEligible(true); // Default to eligible if check fails
      } finally {
        setWelfareCheckLoading(false);
      }

      // Fetch previous balance from payment history
      try {
        const paymentHistory = await paymentAPI.getFarmerHistory(farmerId, { limit: 1 });
        if (paymentHistory.data && paymentHistory.data.length > 0) {
          const lastPayment = paymentHistory.data[0];
          setPreviousBalance(lastPayment.balanceAmount || 0);
        } else {
          setPreviousBalance(0);
        }
      } catch (error) {
        console.error('Failed to fetch payment history:', error);
        setPreviousBalance(0);
      }
    }
  };

  const handleAddDeduction = () => {
    const { type, amount, description } = deductionForm;

    if (!type || !amount) {
      message.error('Please enter deduction type and amount');
      return;
    }

    const newDeduction = { type, amount: parseFloat(amount), description: description || '' };
    setDeductions([...deductions, newDeduction]);

    setDeductionForm({
      type: '',
      amount: '',
      description: ''
    });
  };

  const handleRemoveDeduction = (index) => {
    setDeductions(deductions.filter((_, i) => i !== index));
  };

  const handleInputChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDeductionInputChange = (name, value) => {
    setDeductionForm(prev => ({ ...prev, [name]: value }));
  };

  const handleWelfareToggle = (checked) => {
    if (checked && !welfareEligible) {
      message.warning('Welfare recovery already deducted this month');
      return;
    }
    setFormData(prev => ({
      ...prev,
      welfareRecoveryEnabled: checked,
      welfareRecovery: checked ? 20 : 0
    }));
  };

  // Calculate totals
  useEffect(() => {
    const milkAmount = parseFloat(formData.milkAmount) || 0;
    const welfareRecovery = formData.welfareRecoveryEnabled ? 20 : 0;
    const cfAdvanceDeduction = parseFloat(formData.cfAdvanceDeduction) || 0;
    const loanAdvanceDeduction = parseFloat(formData.loanAdvanceDeduction) || 0;
    const cashAdvanceDeduction = parseFloat(formData.cashAdvanceDeduction) || 0;
    const totalAdvanceDeduction = cfAdvanceDeduction + loanAdvanceDeduction + cashAdvanceDeduction;
    const otherDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
    const totalDeduction = welfareRecovery + totalAdvanceDeduction + otherDeductions;
    const netPayable = milkAmount - totalDeduction - previousBalance;

    setCalculations({
      milkAmount,
      welfareRecovery,
      cfAdvanceDeduction,
      loanAdvanceDeduction,
      cashAdvanceDeduction,
      totalAdvanceDeduction,
      otherDeductions,
      previousBalance,
      totalDeduction,
      netPayable
    });
  }, [formData, deductions, previousBalance]);

  const resetForm = () => {
    setFormData({
      farmerId: '',
      paymentDate: new Date(),
      milkAmount: '',
      welfareRecovery: 0,
      welfareRecoveryEnabled: false,
      cfAdvanceDeduction: '',
      loanAdvanceDeduction: '',
      cashAdvanceDeduction: '',
      paymentMode: 'Cash',
      paidAmount: '',
      remarks: ''
    });
    setSelectedFarmer(null);
    setDeductions([]);
    setFarmerAdvances({ cfAdvance: 0, loanAdvance: 0, cashAdvance: 0 });
    setPreviousBalance(0);
    setWelfareEligible(true);
  };

  const handleOpenModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedFarmer) {
      message.error('Please select a farmer');
      return;
    }

    if (!formData.milkAmount) {
      message.error('Please enter milk amount');
      return;
    }

    if (!formData.paymentMode) {
      message.error('Please select payment mode');
      return;
    }

    // Validate advance deductions don't exceed available amounts
    if (parseFloat(formData.cfAdvanceDeduction) > farmerAdvances.cfAdvance) {
      message.error('CF Advance deduction exceeds available balance');
      return;
    }
    if (parseFloat(formData.loanAdvanceDeduction) > farmerAdvances.loanAdvance) {
      message.error('Loan Advance deduction exceeds available balance');
      return;
    }
    if (parseFloat(formData.cashAdvanceDeduction) > farmerAdvances.cashAdvance) {
      message.error('Cash Advance deduction exceeds available balance');
      return;
    }

    setLoading(true);
    try {
      const paidAmount = parseFloat(formData.paidAmount) || calculations.netPayable;

      // Build deductions array with all deduction types
      const allDeductions = [...deductions];

      if (formData.welfareRecoveryEnabled) {
        allDeductions.push({ type: 'Welfare Recovery', amount: 20, description: 'Monthly welfare recovery' });
      }
      if (parseFloat(formData.cfAdvanceDeduction) > 0) {
        allDeductions.push({ type: 'CF Advance', amount: parseFloat(formData.cfAdvanceDeduction), description: 'CF/Cattle Feed advance recovery' });
      }
      if (parseFloat(formData.loanAdvanceDeduction) > 0) {
        allDeductions.push({ type: 'Loan Advance', amount: parseFloat(formData.loanAdvanceDeduction), description: 'Loan advance recovery' });
      }
      if (parseFloat(formData.cashAdvanceDeduction) > 0) {
        allDeductions.push({ type: 'Cash Advance', amount: parseFloat(formData.cashAdvanceDeduction), description: 'Cash advance recovery' });
      }

      const payload = {
        farmerId: selectedFarmer._id,
        paymentDate: formData.paymentDate,
        milkAmount: parseFloat(formData.milkAmount),
        advanceAmount: calculations.totalAdvanceDeduction,
        deductions: allDeductions,
        totalDeduction: calculations.totalDeduction,
        previousBalance: previousBalance,
        netPayable: calculations.netPayable,
        paymentMode: formData.paymentMode,
        paidAmount: paidAmount,
        balanceAmount: calculations.netPayable - paidAmount,
        remarks: formData.remarks
      };

      await paymentAPI.create(payload);
      message.success('Payment created successfully');
      handleCloseModal();
      fetchPayments();
    } catch (error) {
      message.error(error.message || 'Failed to create payment');
    } finally {
      setLoading(false);
    }
  };

  const filteredFarmers = farmers.filter(farmer => {
    const searchLower = searchTerm.toLowerCase();
    return (
      farmer.farmerNumber?.toLowerCase().includes(searchLower) ||
      farmer.personalDetails?.name?.toLowerCase().includes(searchLower) ||
      farmer.personalDetails?.phone?.toLowerCase().includes(searchLower)
    );
  });

  const farmerOptions = filteredFarmers.map(farmer => ({
    value: farmer._id,
    label: `${farmer.farmerNumber} - ${farmer.personalDetails?.name} (${farmer.personalDetails?.phone})`
  }));

  const deductionTypes = [
    { value: 'Feed', label: 'Feed' },
    { value: 'Medicine', label: 'Medicine' },
    { value: 'Insurance', label: 'Insurance' },
    { value: 'Share', label: 'Share' },
    { value: 'Other', label: 'Other' },
  ];

  const paymentModes = [
    { value: 'Cash', label: 'Cash' },
    { value: 'Bank', label: 'Bank' },
    { value: 'UPI', label: 'UPI' },
  ];

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <Container size="xl" py="xl">
      <Stack spacing="xl">
        {/* Header */}
        <Group position="apart">
          <Box>
            <Title order={2}>Individual Milk Payment</Title>
            <Text color="dimmed" size="sm">Process individual farmer milk payment with deductions</Text>
          </Box>
          <Button
            leftSection={<IconPlus size={18} />}
            onClick={handleOpenModal}
            disabled={!canWrite('payments')}
          >
            New Payment
          </Button>
        </Group>

        {/* Payments List */}
        <Card withBorder shadow="sm" radius="md">
          <Title order={4} mb="md">Recent Payments</Title>
          {paymentsLoading ? (
            <Box py="xl" style={{ textAlign: 'center' }}>
              <Loader size="md" />
            </Box>
          ) : payments.length === 0 ? (
            <Text color="dimmed" align="center" py="xl">No payments found</Text>
          ) : (
            <ScrollArea>
              <Table striped highlightOnHover>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Farmer</th>
                    <th>Milk Amount</th>
                    <th>Deductions</th>
                    <th>Net Payable</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Mode</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment._id}>
                      <td>{formatDate(payment.paymentDate)}</td>
                      <td>
                        <Text size="sm" fw={500}>
                          {payment.farmerId?.farmerNumber || '-'}
                        </Text>
                        <Text size="xs" color="dimmed">
                          {payment.farmerId?.personalDetails?.name || '-'}
                        </Text>
                      </td>
                      <td>₹{(payment.milkAmount || 0).toFixed(2)}</td>
                      <td>
                        <Text color="red" size="sm">
                          -₹{(payment.totalDeduction || 0).toFixed(2)}
                        </Text>
                      </td>
                      <td>
                        <Text fw={600} color={payment.netPayable >= 0 ? 'green' : 'red'}>
                          ₹{(payment.netPayable || 0).toFixed(2)}
                        </Text>
                      </td>
                      <td>₹{(payment.paidAmount || 0).toFixed(2)}</td>
                      <td>
                        {(payment.balanceAmount || 0) > 0 ? (
                          <Text color="orange" fw={500}>₹{payment.balanceAmount.toFixed(2)}</Text>
                        ) : (
                          <Text color="green">₹0.00</Text>
                        )}
                      </td>
                      <td>
                        <Badge variant="light" color="blue">{payment.paymentMode}</Badge>
                      </td>
                      <td>
                        <Badge
                          variant="light"
                          color={(payment.balanceAmount || 0) > 0 ? 'orange' : 'green'}
                        >
                          {(payment.balanceAmount || 0) > 0 ? 'Partial' : 'Paid'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </ScrollArea>
          )}
        </Card>

        {/* Payment Modal */}
        <Modal
          opened={modalOpen}
          onClose={handleCloseModal}
          title={<Text fw={600} size="lg">New Milk Payment</Text>}
          size="xl"
          centered
        >
          <form onSubmit={handleSubmit}>
            <Stack spacing="md">
              {/* Date and Farmer Selection */}
              <Grid>
                <Grid.Col span={6}>
                  <DatePickerInput
                    label="Payment Date"
                    placeholder="Select date"
                    value={formData.paymentDate}
                    onChange={(value) => handleInputChange('paymentDate', value)}
                    leftSection={<IconCalendar size={16} />}
                    required
                    clearable={false}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Select
                    label="Select Farmer"
                    placeholder="Search by farmer number, name, or phone"
                    value={formData.farmerId}
                    onChange={handleFarmerSelect}
                    data={farmerOptions}
                    searchable
                    clearable
                    onSearchChange={(value) => {
                      setSearchTerm(value);
                      searchFarmer(value);
                    }}
                    nothingFoundMessage={searchLoading ? "Searching..." : "No farmers found"}
                    required
                    leftSection={<IconSearch size={16} />}
                    rightSection={searchLoading ? <Loader size="xs" /> : null}
                  />
                </Grid.Col>
              </Grid>

              {selectedFarmer && (
                <Paper withBorder p="sm" radius="md" bg="gray.0">
                  <Grid>
                    <Grid.Col span={3}>
                      <Text size="xs" fw={500} color="dimmed">Farmer Name</Text>
                      <Text size="sm" fw={600}>{selectedFarmer.personalDetails?.name}</Text>
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <Text size="xs" fw={500} color="dimmed">Farmer Number</Text>
                      <Text size="sm" fw={600}>{selectedFarmer.farmerNumber}</Text>
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <Text size="xs" fw={500} color="dimmed">Phone</Text>
                      <Text size="sm">{selectedFarmer.personalDetails?.phone}</Text>
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <Text size="xs" fw={500} color="dimmed">Village</Text>
                      <Text size="sm">{selectedFarmer.address?.village}</Text>
                    </Grid.Col>
                  </Grid>
                </Paper>
              )}

              {/* Milk Amount */}
              <Grid>
                <Grid.Col span={6}>
                  <NumberInput
                    label="Milk Amount (₹)"
                    value={formData.milkAmount}
                    onChange={(value) => handleInputChange('milkAmount', value)}
                    placeholder="Enter milk amount"
                    min={0}
                    step={0.01}
                    decimalScale={2}
                    required
                    leftSection={<IconCurrencyRupee size={16} />}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  {previousBalance > 0 && (
                    <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light" py="xs">
                      <Text size="sm">Previous Balance: <Text span fw={700} color="red">₹{previousBalance.toFixed(2)}</Text></Text>
                    </Alert>
                  )}
                </Grid.Col>
              </Grid>

              {/* Welfare Recovery */}
              <Paper withBorder p="sm" radius="md">
                <Group position="apart">
                  <Box>
                    <Text size="sm" fw={600}>Welfare Recovery</Text>
                    <Text size="xs" color="dimmed">
                      {welfareCheckLoading ? 'Checking eligibility...' :
                       welfareEligible ? 'Monthly welfare contribution - ₹20 per month' :
                       'Already deducted this month'}
                    </Text>
                  </Box>
                  <Switch
                    checked={formData.welfareRecoveryEnabled}
                    onChange={(e) => handleWelfareToggle(e.currentTarget.checked)}
                    label={formData.welfareRecoveryEnabled ? "₹20.00" : "Disabled"}
                    color="teal"
                    disabled={!welfareEligible || welfareCheckLoading}
                  />
                </Group>
              </Paper>

              {/* Advance Deductions */}
              <Paper withBorder p="sm" radius="md">
                <Text size="sm" fw={600} mb="sm">Advance Deductions</Text>

                {selectedFarmer && (
                  <Alert color="blue" variant="light" mb="sm" py="xs">
                    <Group position="apart">
                      <Text size="xs">Outstanding (Priority: Loan → CF → Cash):</Text>
                      <Group spacing="md">
                        <Text size="xs" c={farmerAdvances.loanAdvance > 0 ? 'red' : 'dimmed'}>Loan: <Text span fw={600}>₹{farmerAdvances.loanAdvance.toFixed(2)}</Text></Text>
                        <Text size="xs" c={farmerAdvances.cfAdvance > 0 ? 'orange' : 'dimmed'}>CF: <Text span fw={600}>₹{farmerAdvances.cfAdvance.toFixed(2)}</Text></Text>
                        <Text size="xs" c={farmerAdvances.cashAdvance > 0 ? 'blue' : 'dimmed'}>Cash: <Text span fw={600}>₹{farmerAdvances.cashAdvance.toFixed(2)}</Text></Text>
                      </Group>
                    </Group>
                  </Alert>
                )}

                <Grid gutter="sm">
                  <Grid.Col span={4}>
                    <NumberInput
                      label="Loan Advance (₹) - Priority 1"
                      value={formData.loanAdvanceDeduction}
                      onChange={(value) => handleInputChange('loanAdvanceDeduction', value)}
                      placeholder="0.00"
                      min={0}
                      max={farmerAdvances.loanAdvance}
                      step={0.01}
                      decimalScale={2}
                      size="xs"
                      styles={farmerAdvances.loanAdvance > 0 ? { input: { borderColor: 'var(--mantine-color-red-4)' } } : {}}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <NumberInput
                      label="CF Advance (₹) - Priority 2"
                      value={formData.cfAdvanceDeduction}
                      onChange={(value) => handleInputChange('cfAdvanceDeduction', value)}
                      placeholder="0.00"
                      min={0}
                      max={farmerAdvances.cfAdvance}
                      step={0.01}
                      decimalScale={2}
                      size="xs"
                      styles={farmerAdvances.cfAdvance > 0 ? { input: { borderColor: 'var(--mantine-color-orange-4)' } } : {}}
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <NumberInput
                      label="Cash Advance (₹) - Priority 3"
                      value={formData.cashAdvanceDeduction}
                      onChange={(value) => handleInputChange('cashAdvanceDeduction', value)}
                      placeholder="0.00"
                      min={0}
                      max={farmerAdvances.cashAdvance}
                      step={0.01}
                      decimalScale={2}
                      size="xs"
                    />
                  </Grid.Col>
                </Grid>
              </Paper>

              {/* Other Deductions */}
              <Paper withBorder p="sm" radius="md">
                <Text size="sm" fw={600} mb="sm">Other Deductions</Text>
                <Grid gutter="xs" align="flex-end">
                  <Grid.Col span={3}>
                    <Select
                      label="Type"
                      placeholder="Select"
                      value={deductionForm.type}
                      onChange={(value) => handleDeductionInputChange('type', value)}
                      data={deductionTypes}
                      size="xs"
                    />
                  </Grid.Col>
                  <Grid.Col span={3}>
                    <NumberInput
                      label="Amount (₹)"
                      value={deductionForm.amount}
                      onChange={(value) => handleDeductionInputChange('amount', value)}
                      placeholder="0.00"
                      min={0}
                      size="xs"
                    />
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <TextInput
                      label="Description"
                      value={deductionForm.description}
                      onChange={(e) => handleDeductionInputChange('description', e.target.value)}
                      placeholder="Description"
                      size="xs"
                    />
                  </Grid.Col>
                  <Grid.Col span={2}>
                    <Button onClick={handleAddDeduction} size="xs" variant="light" fullWidth>
                      Add
                    </Button>
                  </Grid.Col>
                </Grid>

                {deductions.length > 0 && (
                  <Box mt="sm">
                    <Table fontSize="xs">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Description</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {deductions.map((deduction, index) => (
                          <tr key={index}>
                            <td><Badge size="xs">{deduction.type}</Badge></td>
                            <td>₹{deduction.amount.toFixed(2)}</td>
                            <td>{deduction.description}</td>
                            <td>
                              <ActionIcon size="xs" color="red" onClick={() => handleRemoveDeduction(index)}>
                                <IconTrash size={12} />
                              </ActionIcon>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Box>
                )}
              </Paper>

              {/* Payment Summary */}
              <Paper withBorder p="sm" radius="md" bg="gray.0">
                <Text size="sm" fw={600} mb="xs">Payment Summary</Text>
                <Grid>
                  <Grid.Col span={6}>
                    <Stack spacing={4}>
                      <Group position="apart">
                        <Text size="xs">Milk Amount:</Text>
                        <Text size="xs" fw={500}>₹{calculations.milkAmount.toFixed(2)}</Text>
                      </Group>
                      <Group position="apart">
                        <Text size="xs" color="dimmed">Total Deductions:</Text>
                        <Text size="xs" fw={500} color="red">-₹{(calculations.totalDeduction + previousBalance).toFixed(2)}</Text>
                      </Group>
                    </Stack>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Paper p="sm" bg={calculations.netPayable >= 0 ? 'green.0' : 'red.0'} radius="md">
                      <Text size="xs" color="dimmed" align="center">Net Payable</Text>
                      <Text size="lg" fw={700} align="center" color={calculations.netPayable >= 0 ? 'green' : 'red'}>
                        ₹{calculations.netPayable.toFixed(2)}
                      </Text>
                    </Paper>
                  </Grid.Col>
                </Grid>
              </Paper>

              {/* Payment Details */}
              <Grid>
                <Grid.Col span={4}>
                  <Select
                    label="Payment Mode"
                    value={formData.paymentMode}
                    onChange={(value) => handleInputChange('paymentMode', value)}
                    data={paymentModes}
                    required
                    size="sm"
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <NumberInput
                    label="Paid Amount (₹)"
                    value={formData.paidAmount}
                    onChange={(value) => handleInputChange('paidAmount', value)}
                    placeholder={calculations.netPayable.toFixed(2)}
                    min={0}
                    decimalScale={2}
                    size="sm"
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <TextInput
                    label="Remarks"
                    value={formData.remarks}
                    onChange={(e) => handleInputChange('remarks', e.target.value)}
                    placeholder="Optional"
                    size="sm"
                  />
                </Grid.Col>
              </Grid>

              {/* Form Actions */}
              <Group position="right" mt="md">
                <Button variant="light" color="gray" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={loading}
                  disabled={!selectedFarmer || !formData.milkAmount}
                >
                  Save Payment
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>
      </Stack>
    </Container>
  );
};

export default IndividualMilkPayment;
