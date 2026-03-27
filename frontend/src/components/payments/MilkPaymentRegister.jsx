import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container,
  Grid,
  Card,
  Text,
  Title,
  Group,
  Stack,
  Box,
  TextInput,
  NumberInput,
  Select,
  Button,
  Divider,
  Badge,
  Paper,
  Loader,
  Alert,
  Tooltip,
  ActionIcon,
  SegmentedControl,
  Collapse,
  Modal,
  Table,
  ScrollArea,
  ThemeIcon,
  rem,
  useMantineTheme,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconCalendar,
  IconUser,
  IconCurrencyRupee,
  IconReceipt,
  IconCheck,
  IconPrinter,
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconCash,
  IconBuildingBank,
  IconFileText,
  IconMilk,
  IconPlus,
  IconMinus,
  IconWallet,
  IconCoins,
  IconTrendingUp,
  IconTrendingDown,
  IconArrowRight,
  IconX,
  IconDeviceFloppy,
  IconInfoCircle,
  IconSearch,
  IconRefresh,
} from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import dayjs from 'dayjs';
import { farmerAPI, paymentAPI, advanceAPI, producerLoanAPI, farmerLedgerAPI, milkCollectionAPI, dairySettingsAPI } from '../../services/api';
import './MilkPaymentRegister.css';

const MilkPaymentRegister = () => {
  const theme = useMantineTheme();
  const printRef = useRef();

  // Payment cycle days from DairySettings (default 15 until loaded)
  const [paymentDays, setPaymentDays] = useState(15);
  const [milkDetails, setMilkDetails] = useState({ totalQuantity: 0, morningQuantity: 0, eveningQuantity: 0, collectionDays: 0 });

  // State Management
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [farmers, setFarmers] = useState([]);
  // Map of farmerId -> farmer object (keeps farmer data separate from Select data to avoid Mantine bug)
  const farmerMapRef = useRef({});
  const [farmerSearchLoading, setFarmerSearchLoading] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [showDeductions, setShowDeductions] = useState(true);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [savedPayment, setSavedPayment] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    paymentDate: new Date(),
    fromDate: dayjs().startOf('month').toDate(),
    toDate: dayjs().endOf('month').toDate(),
    farmerId: '',
    producerName: '',
    openingBalance: 0,
    milkAmount: '',
    cfAdvanceDeduction: '',
    cashAdvanceDeduction: '',
    loanEMIDeduction: '',
    welfareRecovery: '',
    welfareRecoveryRemarks: '',
    otherDeductions: '',
    otherDeductionsRemarks: '',
    bonusIncentive: '',
    bonusRemarks: '',
    paidAmount: '',
    paymentMode: 'cash',
    referenceNumber: '',
  });

  // Snapshot of form+summary at save time — used by bill (form resets after save)
  const [billSnapshot, setBillSnapshot] = useState(null);

  // Outstanding Balances
  const [outstandingData, setOutstandingData] = useState({
    cashAdvance: 0,
    loanAdvance: 0,
    cfAdvance: 0,
    totalOutstanding: 0,
    cashAdvanceItems: [],
    loanAdvanceItems: [],
    cfAdvanceItems: [],
  });

  // Calculated Summary
  const [summary, setSummary] = useState({
    openingBalance: 0,
    totalEarnings: 0,
    totalDeductions: 0,
    netPayable: 0,
    closingBalance: 0,
  });

  // Load payment cycle days from DairySettings on mount
  useEffect(() => {
    dairySettingsAPI.get().then(res => {
      if (res?.success && res.data?.paymentDays) {
        const days = res.data.paymentDays;
        setPaymentDays(days);
        // Re-compute toDate based on loaded paymentDays and current fromDate
        setFormData(prev => ({
          ...prev,
          toDate: dayjs(prev.fromDate).add(days - 1, 'day').toDate(),
        }));
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch farmers for dropdown
  const searchFarmers = useCallback(async (query) => {
    if (!query || query.length < 2) return;

    setFarmerSearchLoading(true);
    try {
      const response = await farmerAPI.search(query);
      const rawList = Array.isArray(response.data) ? response.data : Array.isArray(response) ? response : [];
      // Only pass { value, label } to Mantine Select — extra props cause defaultOptionsFilter crash
      const farmerOptions = rawList
        .filter(f => f && f._id)
        .map((f) => {
          farmerMapRef.current[String(f._id)] = f; // store full object separately
          return {
            value: String(f._id),
            label: `${f.farmerNumber || f.producerCode || ''} | ${f.memberId || ''} - ${f.personalDetails?.name || f.name || 'Unknown'}`,
          };
        });
      setFarmers(farmerOptions);
    } catch (error) {
      console.error('Error searching farmers:', error);
    } finally {
      setFarmerSearchLoading(false);
    }
  }, []);

  // Fetch farmer outstanding balances + previous balance
  const fetchFarmerOutstanding = useCallback(async (farmerId) => {
    try {
      // 1. Outstanding advances/loans per type
      const response = await farmerLedgerAPI.getOutstandingByType(farmerId);
      const data = response.data || response;

      const cashAdvance = data['Cash Advance']?.amount || 0;
      const loanAdvance = data['Loan Advance']?.amount || 0;
      const cfAdvance   = data['CF Advance']?.amount   || 0;
      const totalOutstanding = cashAdvance + loanAdvance + cfAdvance;

      setOutstandingData({
        cashAdvance,
        loanAdvance,
        cfAdvance,
        totalOutstanding,
        cashAdvanceItems: data['Cash Advance']?.items || [],
        loanAdvanceItems: data['Loan Advance']?.items || [],
        cfAdvanceItems:   data['CF Advance']?.items   || [],
      });

      // 2. Pending / partial milk payment balances (society still owes farmer from prior cycles)
      let pendingBalance = 0;
      try {
        const payRes   = await paymentAPI.getAll({ farmerId, limit: 500 });
        const payments = payRes.data || payRes?.payments || payRes || [];
        if (Array.isArray(payments)) {
          pendingBalance = payments
            .filter(p => p.status === 'Pending' || p.status === 'Partial')
            .reduce((sum, p) => sum + (p.balanceAmount || 0), 0);
        }
      } catch (payErr) {
        console.warn('Could not fetch pending payments:', payErr.message);
      }

      // Previous balance = outstanding dues (farmer owes) + unpaid milk balance (society owes farmer)
      // Net: advances/loans are deductions, pending milk balances are credits to farmer
      const previousBalance = totalOutstanding - pendingBalance;

      setFormData((prev) => ({
        ...prev,
        openingBalance: previousBalance,
      }));
    } catch (error) {
      console.error('Error fetching farmer outstanding:', error);
      setOutstandingData({
        cashAdvance: 0,
        loanAdvance: 0,
        cfAdvance: 0,
        totalOutstanding: 0,
        cashAdvanceItems: [],
        loanAdvanceItems: [],
        cfAdvanceItems: [],
      });
    }
  }, []);

  // Auto-fetch milk amount from daily collections
  const fetchMilkAmount = useCallback(async (farmerNumber, fromDate, toDate) => {
    if (!farmerNumber || !fromDate || !toDate) return;
    try {
      const response = await milkCollectionAPI.getAll({
        farmerNumber,
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate: dayjs(toDate).format('YYYY-MM-DD'),
        limit: 1000,
      });
      const records = response.data || response || [];
      const totalAmount = records.reduce((sum, r) => sum + (r.amount || 0), 0);
      const totalQty = records.reduce((sum, r) => sum + (r.qty || 0), 0);
      const morningQty = records.filter(r => r.shift === 'Morning').reduce((sum, r) => sum + (r.qty || 0), 0);
      const eveningQty = records.filter(r => r.shift === 'Evening').reduce((sum, r) => sum + (r.qty || 0), 0);
      const uniqueDays = new Set(records.map(r => r.date?.toString().slice(0, 10))).size;
      setMilkDetails({ totalQuantity: totalQty, morningQuantity: morningQty, eveningQuantity: eveningQty, collectionDays: uniqueDays });
      if (totalAmount > 0) {
        setFormData((prev) => ({ ...prev, milkAmount: totalAmount.toFixed(2) }));
        notifications.show({
          title: 'Milk Amount Loaded',
          message: `${totalQty.toFixed(2)} L → ₹${totalAmount.toFixed(2)} from ${records.length} collection(s)`,
          color: 'teal',
        });
      }
    } catch (err) {
      console.error('Failed to fetch milk amount from collections:', err);
    }
  }, []);

  // Handle farmer selection
  const handleFarmerSelect = useCallback((value, option) => {
    if (!value) {
      setSelectedFarmer(null);
      setFormData((prev) => ({
        ...prev,
        farmerId: '',
        producerName: '',
        openingBalance: 0,
      }));
      setOutstandingData({
        cashAdvance: 0,
        loanAdvance: 0,
        cfAdvance: 0,
        totalOutstanding: 0,
        cashAdvanceItems: [],
        loanAdvanceItems: [],
        cfAdvanceItems: [],
      });
      return;
    }

    const farmer = farmerMapRef.current[value];
    if (farmer) {
      setSelectedFarmer(farmer);
      setFormData((prev) => ({
        ...prev,
        farmerId: farmer._id,
        producerName: farmer.personalDetails?.name || farmer.name || '',
      }));
      fetchFarmerOutstanding(farmer._id);
      fetchMilkAmount(
        farmer.farmerNumber || farmer.producerCode,
        formData.fromDate,
        formData.toDate
      );
    }
  }, [fetchFarmerOutstanding, fetchMilkAmount, formData.fromDate, formData.toDate]);

  // Calculate summary whenever form data changes
  useEffect(() => {
    const milkAmount = parseFloat(formData.milkAmount) || 0;
    const bonusIncentive = parseFloat(formData.bonusIncentive) || 0;
    const cfAdvanceDeduction = parseFloat(formData.cfAdvanceDeduction) || 0;
    const cashAdvanceDeduction = parseFloat(formData.cashAdvanceDeduction) || 0;
    const loanEMIDeduction = parseFloat(formData.loanEMIDeduction) || 0;
    const welfareRecovery = parseFloat(formData.welfareRecovery) || 0;
    const otherDeductions = parseFloat(formData.otherDeductions) || 0;
    const openingBalance = parseFloat(formData.openingBalance) || 0;

    const totalEarnings = milkAmount + bonusIncentive;
    const totalDeductions = cfAdvanceDeduction + cashAdvanceDeduction + loanEMIDeduction + welfareRecovery + otherDeductions;
    const netPayable = totalEarnings - totalDeductions;
    const paidAmount = parseFloat(formData.paidAmount) || 0;
    const closingBalance = netPayable - paidAmount;

    setSummary({
      openingBalance,
      totalEarnings,
      totalDeductions,
      netPayable,
      paidAmount,
      closingBalance,
    });
  }, [formData]);

  // Re-fetch milk amount when date range changes while farmer is selected
  useEffect(() => {
    if (selectedFarmer && formData.fromDate && formData.toDate) {
      fetchMilkAmount(
        selectedFarmer.farmerNumber || selectedFarmer.producerCode,
        formData.fromDate,
        formData.toDate
      );
    }
  }, [selectedFarmer, formData.fromDate, formData.toDate, fetchMilkAmount]);

  // Handle form input changes
  const handleInputChange = (name, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      // Auto-fill toDate when fromDate changes using the loaded paymentDays setting
      if (name === 'fromDate' && value) {
        updated.toDate = dayjs(value).add(paymentDays - 1, 'day').toDate();
      }
      return updated;
    });
  };

  // Validate form
  const validateForm = () => {
    if (!formData.farmerId) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please select a producer/farmer',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
      return false;
    }
    if (!formData.milkAmount || parseFloat(formData.milkAmount) <= 0) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please enter a valid milk amount',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
      return false;
    }
    if (formData.paymentMode !== 'cash' && !formData.referenceNumber) {
      notifications.show({
        title: 'Validation Error',
        message: 'Reference number is required for Bank/Cheque payments',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
      return false;
    }
    return true;
  };

  // Submit payment
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const deductions = [];

      if (formData.cfAdvanceDeduction && parseFloat(formData.cfAdvanceDeduction) > 0) {
        deductions.push({
          type: 'CF Advance',
          amount: parseFloat(formData.cfAdvanceDeduction),
          description: 'CF Advance Deduction',
        });
      }

      if (formData.cashAdvanceDeduction && parseFloat(formData.cashAdvanceDeduction) > 0) {
        deductions.push({
          type: 'Cash Advance',
          amount: parseFloat(formData.cashAdvanceDeduction),
          description: 'Cash Advance Deduction',
        });
      }

      if (formData.loanEMIDeduction && parseFloat(formData.loanEMIDeduction) > 0) {
        deductions.push({
          type: 'Loan Advance',
          amount: parseFloat(formData.loanEMIDeduction),
          description: 'Loan Advance Deduction',
        });
      }

      if (formData.welfareRecovery && parseFloat(formData.welfareRecovery) > 0) {
        deductions.push({
          type: 'Welfare Recovery',
          amount: parseFloat(formData.welfareRecovery),
          description: formData.welfareRecoveryRemarks || 'Welfare Recovery',
        });
      }

      if (formData.otherDeductions && parseFloat(formData.otherDeductions) > 0) {
        deductions.push({
          type: 'Other',
          amount: parseFloat(formData.otherDeductions),
          description: formData.otherDeductionsRemarks || 'Other Deductions',
        });
      }

      const bonuses = [];
      if (formData.bonusIncentive && parseFloat(formData.bonusIncentive) > 0) {
        bonuses.push({
          type: 'Other',
          amount: parseFloat(formData.bonusIncentive),
          description: formData.bonusRemarks || 'Bonus/Incentive',
        });
      }

      const paymentData = {
        farmerId: formData.farmerId,
        paymentDate: formData.paymentDate,
        paymentPeriod: {
          fromDate: formData.fromDate || formData.paymentDate,
          toDate: formData.toDate || formData.paymentDate,
          periodType: 'Monthly',
        },
        milkAmount: parseFloat(formData.milkAmount),
        milkDetails,
        bonuses,
        deductions,
        previousBalance: formData.openingBalance,
        paymentMode: formData.paymentMode === 'cash' ? 'Cash' : formData.paymentMode === 'bank' ? 'Bank' : 'Cheque',
        referenceNumber: formData.referenceNumber,
        paidAmount: parseFloat(formData.paidAmount) || (summary.netPayable > 0 ? summary.netPayable : 0),
        remarks: `Payment via ${formData.paymentMode}`,
      };

      const response = await paymentAPI.create(paymentData);
      const savedData = response.data || response;

      setSavedPayment({
        ...savedData,
        farmerName: formData.producerName,
        farmerId: selectedFarmer?.farmerNumber || selectedFarmer?.producerCode,
      });

      // Capture snapshot BEFORE form reset so bill modal can show correct data
      const effectivePaid = parseFloat(formData.paidAmount) || summary.netPayable;
      setBillSnapshot({
        ...formData,
        summary: {
          ...summary,
          paidAmount: effectivePaid,
          closingBalance: summary.netPayable - effectivePaid,
        },
        paymentNumber: savedData.paymentNumber,
        farmerIdDisplay: selectedFarmer?.farmerNumber || selectedFarmer?.producerCode,
        farmerName: formData.producerName,
      });

      notifications.show({
        title: 'Payment Saved',
        message: `Payment of ₹${effectivePaid.toLocaleString('en-IN')} recorded successfully`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      // Reset form
      setFormData({
        paymentDate: new Date(),
        fromDate: dayjs().startOf('month').toDate(),
        toDate: dayjs().endOf('month').toDate(),
        farmerId: '',
        producerName: '',
        openingBalance: 0,
        milkAmount: '',
        cfAdvanceDeduction: '',
        cashAdvanceDeduction: '',
        loanEMIDeduction: '',
        welfareRecovery: '',
        welfareRecoveryRemarks: '',
        otherDeductions: '',
        otherDeductionsRemarks: '',
        bonusIncentive: '',
        bonusRemarks: '',
        paidAmount: '',
        paymentMode: 'cash',
        referenceNumber: '',
      });
      setSelectedFarmer(null);
      setOutstandingData({
        cashAdvance: 0,
        loanAdvance: 0,
        cfAdvance: 0,
        totalOutstanding: 0,
        cashAdvanceItems: [],
        loanAdvanceItems: [],
        cfAdvanceItems: [],
      });

      // Open print modal
      setPrintModalOpen(true);
    } catch (error) {
      console.error('Error saving payment:', error);
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save payment',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Print voucher
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Payment_Voucher_${savedPayment?.paymentNumber || 'draft'}`,
    onAfterPrint: () => {
      notifications.show({
        title: 'Printed',
        message: 'Voucher sent to printer',
        color: 'blue',
      });
    },
  });

  // Reset form
  const handleReset = () => {
    setFormData({
      paymentDate: new Date(),
      farmerId: '',
      producerName: '',
      openingBalance: 0,
      milkAmount: '',
      cashAdvanceDeduction: '',
      loanEMIDeduction: '',
      otherDeductions: '',
      otherDeductionsRemarks: '',
      bonusIncentive: '',
      bonusRemarks: '',
      paymentMode: 'cash',
      referenceNumber: '',
    });
    setSelectedFarmer(null);
    setOutstandingData({
      cashAdvance: 0,
      loanAdvance: 0,
      cfAdvance: 0,
      totalOutstanding: 0,
    });
  };

  // Check if deductions exceed earnings
  const deductionsExceedEarnings = summary.totalDeductions > summary.totalEarnings;

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Container fluid className="milk-payment-register">
      {/* Page Header */}
      <Box mb="lg">
        <Group justify="space-between" align="center">
          <Box>
            <Title order={2} className="page-title">
              <IconMilk size={28} style={{ marginRight: 8 }} />
              Milk Payment Register
            </Title>
            <Text c="dimmed" size="sm" mt={4}>
              Record individual milk payments to producers with deductions and bonuses
            </Text>
          </Box>
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconRefresh size={16} />}
              onClick={handleReset}
            >
              Reset Form
            </Button>
          </Group>
        </Group>
      </Box>

      {/* Main Content - Split Layout */}
      <Grid gutter="lg">
        {/* LEFT SIDE - Form Section (65%) */}
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="md">
            {/* Payment Details Card */}
            <Card withBorder shadow="sm" radius="md" className="form-card">
              <Card.Section withBorder inheritPadding py="sm" className="card-header">
                <Group gap="xs">
                  <ThemeIcon variant="light" size="md" radius="md">
                    <IconReceipt size={16} />
                  </ThemeIcon>
                  <Text fw={600}>Payment Details</Text>
                </Group>
              </Card.Section>

              <Stack gap="md" mt="md">
                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <DatePickerInput
                      label="Payment Date"
                      placeholder="Select date"
                      value={formData.paymentDate}
                      onChange={(value) => handleInputChange('paymentDate', value)}
                      leftSection={<IconCalendar size={16} />}
                      required
                      maxDate={new Date()}
                      className="form-input"
                    />
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <DatePickerInput
                      label="From Date"
                      placeholder="Select from date"
                      value={formData.fromDate}
                      onChange={(value) => handleInputChange('fromDate', value)}
                      leftSection={<IconCalendar size={16} />}
                      className="form-input"
                    />
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <DatePickerInput
                      label="To Date"
                      placeholder="Select to date"
                      value={formData.toDate}
                      onChange={(value) => handleInputChange('toDate', value)}
                      leftSection={<IconCalendar size={16} />}
                      minDate={formData.fromDate || undefined}
                      className="form-input"
                    />
                  </Grid.Col>
                </Grid>

                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <Select
                      label="Producer / Farmer ID"
                      placeholder="Search by name, farmer no. or member ID..."
                      searchable
                      clearable
                      data={farmers}
                      value={formData.farmerId}
                      onChange={(value) => handleFarmerSelect(value)}
                      onSearchChange={searchFarmers}
                      leftSection={farmerSearchLoading ? <Loader size={16} /> : <IconSearch size={16} />}
                      nothingFoundMessage="No farmers found"
                      required
                      className="form-input"
                    />
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <TextInput
                      label="Producer Name"
                      value={formData.producerName}
                      readOnly
                      leftSection={<IconUser size={16} />}
                      className="form-input readonly-input"
                      styles={{
                        input: { backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' },
                      }}
                    />
                  </Grid.Col>
                </Grid>

                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <NumberInput
                      label="Previous Balance"
                      description="Outstanding advances + unpaid dues"
                      value={formData.openingBalance}
                      readOnly
                      leftSection={<IconWallet size={16} />}
                      prefix="₹ "
                      thousandSeparator=","
                      decimalScale={2}
                      className="form-input readonly-input"
                      styles={{
                        input: { backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed', color: formData.openingBalance > 0 ? '#e53e3e' : '#38a169' },
                      }}
                    />
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <NumberInput
                      label="Milk Amount"
                      placeholder="Enter milk amount"
                      value={formData.milkAmount}
                      onChange={(value) => handleInputChange('milkAmount', value)}
                      leftSection={<IconCurrencyRupee size={16} />}
                      prefix="₹ "
                      thousandSeparator=","
                      decimalScale={2}
                      min={0}
                      required
                      className="form-input milk-amount-input"
                      description="Total milk payment for this period"
                    />
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <NumberInput
                      label="Bonus / Incentive"
                      placeholder="Enter bonus amount"
                      value={formData.bonusIncentive}
                      onChange={(value) => handleInputChange('bonusIncentive', value)}
                      leftSection={<IconTrendingUp size={16} />}
                      prefix="₹ "
                      thousandSeparator=","
                      decimalScale={2}
                      min={0}
                      className="form-input optional-input"
                      description="Optional: Quality/Festival bonus"
                    />
                  </Grid.Col>
                </Grid>
              </Stack>
            </Card>

            {/* Deductions Card */}
            <Card withBorder shadow="sm" radius="md" className="form-card deductions-card">
              <Card.Section withBorder inheritPadding py="sm" className="card-header">
                <Group justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon variant="light" size="md" radius="md" color="red">
                      <IconMinus size={16} />
                    </ThemeIcon>
                    <Text fw={600}>Deductions</Text>
                    {summary.totalDeductions > 0 && (
                      <Badge color="red" variant="light" size="sm">
                        {formatCurrency(summary.totalDeductions)}
                      </Badge>
                    )}
                  </Group>
                  <ActionIcon
                    variant="subtle"
                    onClick={() => setShowDeductions(!showDeductions)}
                    size="sm"
                  >
                    {showDeductions ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                  </ActionIcon>
                </Group>
              </Card.Section>

              <Collapse in={showDeductions}>
                <Stack gap="md" mt="md">
                  {/* Outstanding Summary */}
                  {selectedFarmer && outstandingData.totalOutstanding > 0 && (
                    <Paper p="sm" radius="md" className="outstanding-summary">
                      <Group justify="space-between" wrap="wrap" gap="xs">
                        <Group gap="lg">
                          <Box>
                            <Text size="xs" c="dimmed">CF Advance</Text>
                            <Text fw={600} c="violet">{formatCurrency(outstandingData.cfAdvance)}</Text>
                          </Box>
                          <Box>
                            <Text size="xs" c="dimmed">Cash Advance</Text>
                            <Text fw={600} c="orange">{formatCurrency(outstandingData.cashAdvance)}</Text>
                          </Box>
                          <Box>
                            <Text size="xs" c="dimmed">Loan Advance</Text>
                            <Text fw={600} c="red">{formatCurrency(outstandingData.loanAdvance)}</Text>
                          </Box>
                        </Group>
                        <Box ta="right">
                          <Text size="xs" c="dimmed">Total Outstanding</Text>
                          <Text fw={700} size="lg" c="red">{formatCurrency(outstandingData.totalOutstanding)}</Text>
                        </Box>
                      </Group>
                    </Paper>
                  )}

                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="CF Advance Deduction"
                        placeholder="Enter amount"
                        value={formData.cfAdvanceDeduction}
                        onChange={(value) => handleInputChange('cfAdvanceDeduction', value)}
                        leftSection={<IconCoins size={16} />}
                        prefix="₹ "
                        thousandSeparator=","
                        decimalScale={2}
                        min={0}
                        max={outstandingData.cfAdvance || undefined}
                        className="form-input"
                        description={outstandingData.cfAdvance > 0 ? `Outstanding: ${formatCurrency(outstandingData.cfAdvance)}` : 'No outstanding balance'}
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Cash Advance Deduction"
                        placeholder="Enter amount"
                        value={formData.cashAdvanceDeduction}
                        onChange={(value) => handleInputChange('cashAdvanceDeduction', value)}
                        leftSection={<IconCash size={16} />}
                        prefix="₹ "
                        thousandSeparator=","
                        decimalScale={2}
                        min={0}
                        max={outstandingData.cashAdvance || undefined}
                        className="form-input"
                        description={outstandingData.cashAdvance > 0 ? `Outstanding: ${formatCurrency(outstandingData.cashAdvance)}` : 'No outstanding balance'}
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Loan Advance Deduction"
                        placeholder="Enter amount"
                        value={formData.loanEMIDeduction}
                        onChange={(value) => handleInputChange('loanEMIDeduction', value)}
                        leftSection={<IconCoins size={16} />}
                        prefix="₹ "
                        thousandSeparator=","
                        decimalScale={2}
                        min={0}
                        className="form-input optional-input"
                        description={outstandingData.loanAdvance > 0 ? `Outstanding: ${formatCurrency(outstandingData.loanAdvance)}` : 'Optional: Loan repayment'}
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Welfare Recovery"
                        placeholder="Enter amount"
                        value={formData.welfareRecovery}
                        onChange={(value) => handleInputChange('welfareRecovery', value)}
                        leftSection={<IconTrendingDown size={16} />}
                        prefix="₹ "
                        thousandSeparator=","
                        decimalScale={2}
                        min={0}
                        className="form-input optional-input"
                        description="Optional: Welfare fund recovery"
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <TextInput
                        label="Welfare Recovery Remarks"
                        placeholder="Specify welfare recovery type"
                        value={formData.welfareRecoveryRemarks}
                        onChange={(e) => handleInputChange('welfareRecoveryRemarks', e.target.value)}
                        leftSection={<IconFileText size={16} />}
                        className="form-input optional-input"
                        description="Optional: Description"
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        label="Other Deductions"
                        placeholder="Enter amount"
                        value={formData.otherDeductions}
                        onChange={(value) => handleInputChange('otherDeductions', value)}
                        leftSection={<IconTrendingDown size={16} />}
                        prefix="₹ "
                        thousandSeparator=","
                        decimalScale={2}
                        min={0}
                        className="form-input optional-input"
                        description="Optional: Feed, medicine, etc."
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <TextInput
                        label="Other Deductions Remarks"
                        placeholder="Specify deduction type"
                        value={formData.otherDeductionsRemarks}
                        onChange={(e) => handleInputChange('otherDeductionsRemarks', e.target.value)}
                        leftSection={<IconFileText size={16} />}
                        className="form-input optional-input"
                        description="Optional: Description"
                      />
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Collapse>
            </Card>

            {/* Payment Mode Card */}
            <Card withBorder shadow="sm" radius="md" className="form-card">
              <Card.Section withBorder inheritPadding py="sm" className="card-header">
                <Group gap="xs">
                  <ThemeIcon variant="light" size="md" radius="md" color="blue">
                    <IconBuildingBank size={16} />
                  </ThemeIcon>
                  <Text fw={600}>Payment Mode</Text>
                </Group>
              </Card.Section>

              <Stack gap="md" mt="md">
                <Grid gutter="md" align="flex-end">
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Text size="sm" fw={500} mb={6}>Select Payment Mode</Text>
                    <SegmentedControl
                      value={formData.paymentMode}
                      onChange={(value) => handleInputChange('paymentMode', value)}
                      data={[
                        {
                          value: 'cash',
                          label: (
                            <Group gap="xs" wrap="nowrap">
                              <IconCash size={16} />
                              <Text size="sm">Cash</Text>
                            </Group>
                          ),
                        },
                        {
                          value: 'bank',
                          label: (
                            <Group gap="xs" wrap="nowrap">
                              <IconBuildingBank size={16} />
                              <Text size="sm">Bank</Text>
                            </Group>
                          ),
                        },
                        {
                          value: 'cheque',
                          label: (
                            <Group gap="xs" wrap="nowrap">
                              <IconFileText size={16} />
                              <Text size="sm">Cheque</Text>
                            </Group>
                          ),
                        },
                      ]}
                      fullWidth
                      className="payment-mode-segment"
                    />
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Reference Number"
                      placeholder={
                        formData.paymentMode === 'bank'
                          ? 'Enter Transaction ID'
                          : formData.paymentMode === 'cheque'
                          ? 'Enter Cheque Number'
                          : 'Optional for cash'
                      }
                      value={formData.referenceNumber}
                      onChange={(e) => handleInputChange('referenceNumber', e.target.value)}
                      leftSection={<IconReceipt size={16} />}
                      required={formData.paymentMode !== 'cash'}
                      className="form-input"
                    />
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <NumberInput
                      label="Amount Paid Now"
                      placeholder={`Leave blank to pay full ₹${summary.netPayable.toFixed(2)}`}
                      description="Enter partial amount if not paying in full"
                      value={formData.paidAmount}
                      onChange={(value) => handleInputChange('paidAmount', value)}
                      leftSection={<IconCurrencyRupee size={16} />}
                      prefix="₹ "
                      thousandSeparator=","
                      decimalScale={2}
                      min={0}
                      max={summary.netPayable > 0 ? summary.netPayable : undefined}
                      className="form-input"
                    />
                  </Grid.Col>
                </Grid>
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>

        {/* RIGHT SIDE - Payment Summary Panel (35%) */}
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Box className="summary-sticky">
            <Card withBorder shadow="md" radius="md" className="summary-card">
              <Card.Section withBorder inheritPadding py="sm" className="summary-header">
                <Group justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon variant="filled" size="md" radius="md">
                      <IconReceipt size={16} />
                    </ThemeIcon>
                    <Text fw={600}>Payment Summary</Text>
                  </Group>
                  <Badge variant="light" color="blue">
                    {dayjs(formData.paymentDate).format('DD MMM YYYY')}
                  </Badge>
                </Group>
              </Card.Section>

              <Stack gap="md" p="md">
                {/* Selected Farmer Info */}
                {selectedFarmer && (
                  <Paper p="sm" radius="md" className="farmer-info-card">
                    <Group gap="sm">
                      <ThemeIcon variant="light" size="lg" radius="xl">
                        <IconUser size={18} />
                      </ThemeIcon>
                      <Box>
                        <Text fw={600} size="sm">{formData.producerName}</Text>
                        <Text size="xs" c="dimmed">
                          ID: {selectedFarmer.farmerNumber || selectedFarmer.producerCode || 'N/A'}
                        </Text>
                      </Box>
                    </Group>
                  </Paper>
                )}

                <Divider />

                {/* Summary Items */}
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Previous Balance</Text>
                    <Text fw={500} c={summary.openingBalance > 0 ? 'red' : 'green'}>{formatCurrency(summary.openingBalance)}</Text>
                  </Group>

                  <Divider variant="dashed" />

                  <Group justify="space-between">
                    <Group gap="xs">
                      <IconMilk size={16} className="text-primary" />
                      <Text size="sm">Milk Amount</Text>
                    </Group>
                    <Text fw={500} c="green">{formatCurrency(parseFloat(formData.milkAmount) || 0)}</Text>
                  </Group>

                  {parseFloat(formData.bonusIncentive) > 0 && (
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconPlus size={16} color="green" />
                        <Text size="sm">Bonus / Incentive</Text>
                      </Group>
                      <Text fw={500} c="green">+ {formatCurrency(parseFloat(formData.bonusIncentive))}</Text>
                    </Group>
                  )}

                  <Paper p="xs" radius="sm" className="earnings-box">
                    <Group justify="space-between">
                      <Text size="sm" fw={600}>Total Earnings</Text>
                      <Text fw={700} c="green">{formatCurrency(summary.totalEarnings)}</Text>
                    </Group>
                  </Paper>

                  <Divider variant="dashed" />

                  {/* Deductions Breakdown */}
                  {parseFloat(formData.cfAdvanceDeduction) > 0 && (
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconMinus size={16} color="red" />
                        <Text size="sm">CF Advance</Text>
                      </Group>
                      <Text fw={500} c="red">- {formatCurrency(parseFloat(formData.cfAdvanceDeduction))}</Text>
                    </Group>
                  )}

                  {parseFloat(formData.cashAdvanceDeduction) > 0 && (
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconMinus size={16} color="red" />
                        <Text size="sm">Cash Advance</Text>
                      </Group>
                      <Text fw={500} c="red">- {formatCurrency(parseFloat(formData.cashAdvanceDeduction))}</Text>
                    </Group>
                  )}

                  {parseFloat(formData.loanEMIDeduction) > 0 && (
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconMinus size={16} color="red" />
                        <Text size="sm">Loan Advance</Text>
                      </Group>
                      <Text fw={500} c="red">- {formatCurrency(parseFloat(formData.loanEMIDeduction))}</Text>
                    </Group>
                  )}

                  {parseFloat(formData.welfareRecovery) > 0 && (
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconMinus size={16} color="red" />
                        <Text size="sm">Welfare Recovery</Text>
                      </Group>
                      <Text fw={500} c="red">- {formatCurrency(parseFloat(formData.welfareRecovery))}</Text>
                    </Group>
                  )}

                  {parseFloat(formData.otherDeductions) > 0 && (
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconMinus size={16} color="red" />
                        <Text size="sm">Other Deductions</Text>
                      </Group>
                      <Text fw={500} c="red">- {formatCurrency(parseFloat(formData.otherDeductions))}</Text>
                    </Group>
                  )}

                  {summary.totalDeductions > 0 && (
                    <Paper p="xs" radius="sm" className="deductions-box">
                      <Group justify="space-between">
                        <Text size="sm" fw={600}>Total Deductions</Text>
                        <Text fw={700} c="red">{formatCurrency(summary.totalDeductions)}</Text>
                      </Group>
                    </Paper>
                  )}
                </Stack>

                <Divider />

                {/* Warning for excess deductions */}
                {deductionsExceedEarnings && (
                  <Alert
                    color="red"
                    icon={<IconAlertCircle size={16} />}
                    title="Warning"
                    variant="light"
                    className="warning-alert"
                  >
                    Deductions exceed total earnings. Please review.
                  </Alert>
                )}

                {/* Net Payable */}
                <Paper p="md" radius="md" className={`net-payable-box ${deductionsExceedEarnings ? 'warning' : ''}`}>
                  <Stack gap="xs" align="center">
                    <Text size="sm" c="dimmed" tt="uppercase" fw={600}>Net Payable Amount</Text>
                    <Text
                      size="xl"
                      fw={900}
                      className="net-payable-amount"
                      c={summary.netPayable >= 0 ? 'green' : 'red'}
                    >
                      {formatCurrency(summary.netPayable)}
                    </Text>
                    <Badge
                      variant="light"
                      color={formData.paymentMode === 'cash' ? 'green' : formData.paymentMode === 'bank' ? 'blue' : 'orange'}
                      size="lg"
                    >
                      {formData.paymentMode === 'cash' ? 'Cash Payment' : formData.paymentMode === 'bank' ? 'Bank Transfer' : 'Cheque'}
                    </Badge>
                  </Stack>
                </Paper>

                {/* Amount Paid + Closing Balance */}
                {summary.paidAmount > 0 && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Amount Paid Now</Text>
                    <Text fw={500} c="blue">{formatCurrency(summary.paidAmount)}</Text>
                  </Group>
                )}
                <Group justify="space-between" className="closing-balance">
                  <Text size="sm" fw={500}>Balance Due</Text>
                  <Text fw={700} size="lg" c={summary.closingBalance > 0 ? 'red' : 'green'}>
                    {formatCurrency(summary.closingBalance)}
                  </Text>
                </Group>

                <Divider />

                {/* Action Buttons */}
                <Stack gap="sm">
                  <Button
                    fullWidth
                    size="lg"
                    leftSection={<IconDeviceFloppy size={20} />}
                    onClick={handleSubmit}
                    loading={submitting}
                    disabled={!formData.farmerId || !formData.milkAmount || deductionsExceedEarnings}
                    className="save-button"
                  >
                    Save Payment
                  </Button>

                  <Button
                    fullWidth
                    variant="light"
                    leftSection={<IconPrinter size={18} />}
                    disabled={!savedPayment}
                    onClick={() => setPrintModalOpen(true)}
                    className="print-button"
                  >
                    Print Voucher
                  </Button>
                </Stack>
              </Stack>
            </Card>
          </Box>
        </Grid.Col>
      </Grid>

      {/* Print Voucher Modal */}
      <Modal
        opened={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        title={
          <Group gap="xs">
            <IconPrinter size={20} />
            <Text fw={600}>Payment Voucher Preview</Text>
          </Group>
        }
        size="lg"
        centered
      >
        <Box ref={printRef} className="print-voucher">
          <Box className="voucher-content" p="md">
            {/* Voucher Header */}
            <Box ta="center" mb="lg" className="voucher-header">
              <Title order={3}>MILK PAYMENT VOUCHER</Title>
              <Text size="sm" c="dimmed">Dairy Society ERP</Text>
            </Box>

            <Divider mb="md" />

            {/* Voucher Details */}
            <Grid gutter="md" mb="md">
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">Voucher No</Text>
                <Text fw={600}>{billSnapshot?.paymentNumber || savedPayment?.paymentNumber || 'DRAFT'}</Text>
              </Grid.Col>
              <Grid.Col span={6} style={{ textAlign: 'right' }}>
                <Text size="sm" c="dimmed">Date</Text>
                <Text fw={600}>{dayjs(billSnapshot?.paymentDate || formData.paymentDate).format('DD/MM/YYYY')}</Text>
              </Grid.Col>
            </Grid>

            {/* Farmer Details */}
            <Paper p="sm" withBorder mb="md">
              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Producer ID</Text>
                  <Text fw={600}>{billSnapshot?.farmerIdDisplay || savedPayment?.farmerId || 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Producer Name</Text>
                  <Text fw={600}>{billSnapshot?.farmerName || savedPayment?.farmerName || 'N/A'}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" c="dimmed">Period</Text>
                  <Text fw={600}>
                    {dayjs(billSnapshot?.fromDate).format('DD/MM/YYYY')} – {dayjs(billSnapshot?.toDate).format('DD/MM/YYYY')}
                  </Text>
                </Grid.Col>
              </Grid>
            </Paper>

            {/* Payment Details Table */}
            <Table withTableBorder withColumnBorders mb="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Particulars</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Amount (₹)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(billSnapshot?.summary?.openingBalance || 0) !== 0 && (
                  <Table.Tr>
                    <Table.Td>Previous Balance</Table.Td>
                    <Table.Td style={{ textAlign: 'right', color: billSnapshot?.summary?.openingBalance > 0 ? 'red' : 'green' }}>
                      {formatCurrency(billSnapshot?.summary?.openingBalance || 0)}
                    </Table.Td>
                  </Table.Tr>
                )}
                <Table.Tr>
                  <Table.Td>Milk Amount</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(parseFloat(billSnapshot?.milkAmount) || 0)}</Table.Td>
                </Table.Tr>
                {parseFloat(billSnapshot?.bonusIncentive) > 0 && (
                  <Table.Tr>
                    <Table.Td>Bonus / Incentive</Table.Td>
                    <Table.Td style={{ textAlign: 'right', color: 'green' }}>+ {formatCurrency(parseFloat(billSnapshot?.bonusIncentive))}</Table.Td>
                  </Table.Tr>
                )}
                <Table.Tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <Table.Td fw={600}>Total Earnings</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }} fw={600}>{formatCurrency(billSnapshot?.summary?.totalEarnings || 0)}</Table.Td>
                </Table.Tr>
                {parseFloat(billSnapshot?.cfAdvanceDeduction) > 0 && (
                  <Table.Tr>
                    <Table.Td>CF Advance Deduction</Table.Td>
                    <Table.Td style={{ textAlign: 'right', color: 'red' }}>- {formatCurrency(parseFloat(billSnapshot?.cfAdvanceDeduction))}</Table.Td>
                  </Table.Tr>
                )}
                {parseFloat(billSnapshot?.cashAdvanceDeduction) > 0 && (
                  <Table.Tr>
                    <Table.Td>Cash Advance Deduction</Table.Td>
                    <Table.Td style={{ textAlign: 'right', color: 'red' }}>- {formatCurrency(parseFloat(billSnapshot?.cashAdvanceDeduction))}</Table.Td>
                  </Table.Tr>
                )}
                {parseFloat(billSnapshot?.loanEMIDeduction) > 0 && (
                  <Table.Tr>
                    <Table.Td>Loan Advance Deduction</Table.Td>
                    <Table.Td style={{ textAlign: 'right', color: 'red' }}>- {formatCurrency(parseFloat(billSnapshot?.loanEMIDeduction))}</Table.Td>
                  </Table.Tr>
                )}
                {parseFloat(billSnapshot?.welfareRecovery) > 0 && (
                  <Table.Tr>
                    <Table.Td>Welfare Recovery ({billSnapshot?.welfareRecoveryRemarks || 'Welfare'})</Table.Td>
                    <Table.Td style={{ textAlign: 'right', color: 'red' }}>- {formatCurrency(parseFloat(billSnapshot?.welfareRecovery))}</Table.Td>
                  </Table.Tr>
                )}
                {parseFloat(billSnapshot?.otherDeductions) > 0 && (
                  <Table.Tr>
                    <Table.Td>Other Deductions ({billSnapshot?.otherDeductionsRemarks || 'Misc'})</Table.Td>
                    <Table.Td style={{ textAlign: 'right', color: 'red' }}>- {formatCurrency(parseFloat(billSnapshot?.otherDeductions))}</Table.Td>
                  </Table.Tr>
                )}
                {(billSnapshot?.summary?.totalDeductions || 0) > 0 && (
                  <Table.Tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <Table.Td fw={600}>Total Deductions</Table.Td>
                    <Table.Td style={{ textAlign: 'right', color: 'red' }} fw={600}>{formatCurrency(billSnapshot?.summary?.totalDeductions || 0)}</Table.Td>
                  </Table.Tr>
                )}
                <Table.Tr style={{ backgroundColor: 'var(--primary-light)' }}>
                  <Table.Td fw={700} size="lg">NET PAYABLE</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }} fw={700} size="lg">{formatCurrency(billSnapshot?.summary?.netPayable || 0)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td fw={600} c="blue">Amount Paid ({billSnapshot?.paymentMode ? billSnapshot.paymentMode.charAt(0).toUpperCase() + billSnapshot.paymentMode.slice(1) : 'Cash'})</Table.Td>
                  <Table.Td style={{ textAlign: 'right', color: 'blue' }} fw={600}>- {formatCurrency(billSnapshot?.summary?.paidAmount || 0)}</Table.Td>
                </Table.Tr>
                <Table.Tr style={{ backgroundColor: (billSnapshot?.summary?.closingBalance || 0) > 0 ? '#fff3f3' : '#f0fff4' }}>
                  <Table.Td fw={700}>Balance Due</Table.Td>
                  <Table.Td style={{ textAlign: 'right', color: (billSnapshot?.summary?.closingBalance || 0) > 0 ? 'red' : 'green' }} fw={700}>
                    {formatCurrency(billSnapshot?.summary?.closingBalance || 0)}
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>

            {/* Payment Mode */}
            <Group justify="space-between" mb="lg">
              <Box>
                <Text size="sm" c="dimmed">Payment Mode</Text>
                <Text fw={600} tt="capitalize">{billSnapshot?.paymentMode || 'cash'}</Text>
              </Box>
              {billSnapshot?.referenceNumber && (
                <Box style={{ textAlign: 'right' }}>
                  <Text size="sm" c="dimmed">Reference No</Text>
                  <Text fw={600}>{billSnapshot.referenceNumber}</Text>
                </Box>
              )}
            </Group>

            <Divider mb="lg" />

            {/* Signatures */}
            <Grid>
              <Grid.Col span={4} ta="center">
                <Box mt="xl" pt="xl">
                  <Divider />
                  <Text size="sm" mt="xs">Prepared By</Text>
                </Box>
              </Grid.Col>
              <Grid.Col span={4} ta="center">
                <Box mt="xl" pt="xl">
                  <Divider />
                  <Text size="sm" mt="xs">Verified By</Text>
                </Box>
              </Grid.Col>
              <Grid.Col span={4} ta="center">
                <Box mt="xl" pt="xl">
                  <Divider />
                  <Text size="sm" mt="xs">Receiver's Signature</Text>
                </Box>
              </Grid.Col>
            </Grid>
          </Box>
        </Box>

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => setPrintModalOpen(false)}>
            Close
          </Button>
          <Button leftSection={<IconPrinter size={16} />} onClick={handlePrint}>
            Print Voucher
          </Button>
        </Group>
      </Modal>
    </Container>
  );
};

export default MilkPaymentRegister;
