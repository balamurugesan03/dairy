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
  Pagination,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
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
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import dayjs from 'dayjs';
import { farmerAPI, paymentAPI, advanceAPI, producerLoanAPI, farmerLedgerAPI, milkCollectionAPI, dairySettingsAPI, individualDeductionEarningAPI, producerOpeningAPI } from '../../services/api';
import './MilkPaymentRegister.css';

const MilkPaymentRegister = () => {
  const theme = useMantineTheme();
  const printRef = useRef();

  // Field refs for Enter-key navigation
  const milkAmountRef      = useRef();
  const earningsRef        = useRef();
  const cfAdvanceRef       = useRef();
  const cashAdvanceRef     = useRef();
  const loanAdvanceRef     = useRef();
  const welfareRef         = useRef();
  const otherDeductionsRef = useRef();

  const focusField = (ref) => {
    setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      if (typeof el.focus === 'function') el.focus();
      else el.querySelector?.('input')?.focus();
    }, 30);
  };

  // Payment cycle days from DairySettings (default 15 until loaded)
  const [paymentDays, setPaymentDays] = useState(15);
  const [dateConfirmed, setDateConfirmed] = useState(false); // gates all other fields
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

  // Producer opening advance values (used as fallback outstanding for display)
  const [openingAdvances, setOpeningAdvances] = useState({ cfAdvance: 0, cashAdvance: 0, loanAdvance: 0 });

  // Grid state
  const [gridPayments, setGridPayments]       = useState([]);
  const [gridLoading, setGridLoading]         = useState(false);
  const [gridPage, setGridPage]               = useState(1);
  const [gridTotalPages, setGridTotalPages]   = useState(1);
  const [gridTotal, setGridTotal]             = useState(0);
  const [editId, setEditId]                   = useState(null);
  const GRID_PAGE_SIZE = 15;

  // Calculated Summary
  const [summary, setSummary] = useState({
    openingBalance: 0,
    totalEarnings: 0,
    totalAvailable: 0,        // Prev Balance + Milk + Earnings
    requestedDeductions: 0,   // what user entered
    adjustedDeductions: {     // capped to totalAvailable
      cf: 0, cash: 0, loan: 0, welfare: 0, other: 0, total: 0,
    },
    isAdjusted: false,        // true when deductions were capped
    netPayable: 0,            // always >= 0
    paidAmount: 0,
    closingBalance: 0,
  });

  // Load payment cycle days from DairySettings on mount
  useEffect(() => {
    dairySettingsAPI.get().then(res => {
      if (res?.success && res.data) {
        const days = res.data.paymentDays || 15;
        setPaymentDays(days);

        if (res.data.paymentFromDate) {
          // Use exact paymentFromDate from settings as fromDate
          const fd  = dayjs(res.data.paymentFromDate).startOf('day').toDate();
          const eom = dayjs(fd).endOf('month').toDate();
          const raw = dayjs(fd).add(days - 1, 'day').toDate();
          const td  = raw > eom ? eom : raw;
          setFormData(prev => ({ ...prev, fromDate: fd, toDate: td }));
        } else {
          // Fallback: snap to current period using today
          const [fd, td] = getCyclePeriod(days, new Date());
          setFormData(prev => ({ ...prev, fromDate: fd, toDate: td }));
        }
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

  // Fetch farmer outstanding balances + previous balance + auto-fill deductions
  const fetchFarmerOutstanding = useCallback(async (farmerId, fromDate, toDate) => {
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
      let hasAnyPayments = false;
      try {
        const payRes   = await paymentAPI.getAll({ farmerId, limit: 500 });
        const payments = payRes.data || payRes?.payments || payRes || [];
        if (Array.isArray(payments)) {
          hasAnyPayments = payments.length > 0;
          pendingBalance = payments
            .filter(p => p.status === 'Pending' || p.status === 'Partial')
            .reduce((sum, p) => sum + (p.balanceAmount || 0), 0);
        }
      } catch (payErr) {
        console.warn('Could not fetch pending payments:', payErr.message);
      }

      // 2b. Producer opening due amount — only for first-time farmers (no payment history yet)
      // Once any payment exists, use actual pending balances instead
      let openingCfAdvance = 0;
      let openingLoanAdvance = 0;
      try {
        const openingRes = await producerOpeningAPI.getByFarmer(farmerId);
        const openingData = openingRes?.data || openingRes;
        if (openingData?.dueAmount && !hasAnyPayments) {
          pendingBalance += Number(openingData.dueAmount) || 0;
        }
        if (openingData?.cfAdvance) {
          openingCfAdvance = Number(openingData.cfAdvance) || 0;
        }
        if (openingData?.loanAdvance) {
          openingLoanAdvance = Number(openingData.loanAdvance) || 0;
        }
        setOpeningAdvances({
          cfAdvance:   openingCfAdvance,
          cashAdvance: Number(openingData?.cashAdvance) || 0,
          loanAdvance: openingLoanAdvance,
        });
      } catch (openErr) {
        console.warn('Could not fetch producer opening:', openErr.message);
        setOpeningAdvances({ cfAdvance: 0, cashAdvance: 0, loanAdvance: 0 });
      }

      // 3. Welfare recovery — check periodical rule amount + eligibility
      let welfareAmount = 0;
      try {
        const welfareRes = await farmerLedgerAPI.checkWelfare(
          farmerId,
          fromDate ? dayjs(fromDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
          fromDate ? dayjs(fromDate).format('YYYY-MM-DD') : undefined,
          toDate   ? dayjs(toDate).format('YYYY-MM-DD')   : undefined,
        );
        const wd = welfareRes?.data || welfareRes;
        if (wd?.eligibleForDeduction) welfareAmount = wd.amount || 0;
      } catch (wErr) {
        console.warn('Could not fetch welfare amount:', wErr.message);
      }

      setFormData((prev) => ({
        ...prev,
        openingBalance:       pendingBalance,
        // CF Advance left empty — outstanding shown in description only
        cfAdvanceDeduction:   prev.cfAdvanceDeduction,
        cashAdvanceDeduction: prev.cashAdvanceDeduction,
        loanEMIDeduction:     prev.loanEMIDeduction,
        // Auto-fill welfare recovery from periodical rule
        welfareRecovery:      welfareAmount > 0 ? welfareAmount.toFixed(2) : prev.welfareRecovery,
        welfareRecoveryRemarks: welfareAmount > 0 ? 'Welfare Recovery' : prev.welfareRecoveryRemarks,
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

  // Auto-fetch individual EARNING records for this producer in the date range
  const fetchIndividualEarnings = useCallback(async (farmerId, fromDate, toDate) => {
    if (!farmerId || !fromDate || !toDate) return;
    try {
      const response = await individualDeductionEarningAPI.getAll({
        producerId: farmerId,
        type: 'EARNING',
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate: dayjs(toDate).format('YYYY-MM-DD'),
        limit: 500,
      });
      const records = response.data || [];
      const totalEarning = records.reduce((sum, r) => sum + (r.amount || 0), 0);
      if (totalEarning > 0) {
        setFormData(prev => ({ ...prev, bonusIncentive: totalEarning.toFixed(2) }));
        notifications.show({
          title: 'Earnings Fetched',
          message: `₹${totalEarning.toFixed(2)} from ${records.length} earning record(s)`,
          color: 'green',
        });
      }
    } catch (err) {
      console.warn('Could not fetch individual earnings:', err.message);
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
      fetchFarmerOutstanding(farmer._id, formData.fromDate, formData.toDate);
      fetchMilkAmount(
        farmer.farmerNumber || farmer.producerCode,
        formData.fromDate,
        formData.toDate
      );
      fetchIndividualEarnings(farmer._id, formData.fromDate, formData.toDate);
      focusField(milkAmountRef);

      // Check if payment already exists for this farmer in current period
      if (formData.fromDate && formData.toDate) {
        paymentAPI.getAll({
          farmerId: farmer._id,
          fromDate: dayjs(formData.fromDate).format('YYYY-MM-DD'),
          toDate:   dayjs(formData.toDate).format('YYYY-MM-DD'),
          limit: 1,
        }).then((res) => {
          const existing = res.data || res.payments || [];
          const active = Array.isArray(existing)
            ? existing.filter(p => p.status !== 'Cancelled')
            : [];
          if (active.length > 0) {
            // Auto-advance from/to dates to the next cycle
            const nextRef = dayjs(formData.toDate).add(1, 'day').toDate();
            const [fd, td] = getCyclePeriod(paymentDays, nextRef);
            setFormData(prev => ({ ...prev, fromDate: fd, toDate: td }));
            setDateConfirmed(true);
            fetchGridPayments(1, formData.paymentDate);
            fetchMilkAmount(farmer.farmerNumber || farmer.producerCode, fd, td);
            fetchFarmerOutstanding(farmer._id, fd, td);
            fetchIndividualEarnings(farmer._id, fd, td);
            notifications.show({
              title: 'Dates Advanced to Next Cycle',
              message: `${farmer.personalDetails?.name || 'This farmer'} already has payment (${active[0].paymentNumber || ''}) for this period. Moved to ${dayjs(fd).format('DD/MM')}–${dayjs(td).format('DD/MM/YYYY')}.`,
              color: 'orange',
              icon: <IconArrowRight size={16} />,
              autoClose: 6000,
            });
          }
        }).catch(() => {});
      }
    }
  }, [fetchFarmerOutstanding, fetchMilkAmount, fetchIndividualEarnings, formData.fromDate, formData.toDate]);

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

    const totalEarnings  = milkAmount + bonusIncentive;
    // Total available = Prev Balance + Milk + Other Earnings
    const totalAvailable = openingBalance + milkAmount + bonusIncentive;

    // Requested deductions (as entered)
    const reqCf      = cfAdvanceDeduction;
    const reqCash    = cashAdvanceDeduction;
    const reqLoan    = loanEMIDeduction;
    const reqOther   = otherDeductions;
    const reqWelfare = welfareRecovery;
    const requestedTotal = reqCf + reqCash + reqLoan + reqOther + reqWelfare;

    // Auto-adjust deductions so they never exceed totalAvailable (net >= 0)
    // Priority: CF Advance → Cash Advance → Loan → Other Deductions → Welfare
    let budget   = totalAvailable > 0 ? totalAvailable : 0;
    const adjCf      = Math.min(reqCf,      budget); budget -= adjCf;
    const adjCash    = Math.min(reqCash,    budget); budget -= adjCash;
    const adjLoan    = Math.min(reqLoan,    budget); budget -= adjLoan;
    const adjOther   = Math.min(reqOther,   budget); budget -= adjOther;
    const adjWelfare = Math.min(reqWelfare, budget);
    const adjTotal   = adjCf + adjCash + adjLoan + adjOther + adjWelfare;

    const isAdjusted = requestedTotal > totalAvailable && totalAvailable >= 0;
    const netPayable = Math.max(0, totalAvailable - adjTotal);

    // Default paidAmount = 0 so payment saves as Pending and appears in Bank Transfer
    const paidAmount     = parseFloat(formData.paidAmount) || 0;
    const closingBalance = netPayable - paidAmount;

    setSummary({
      openingBalance,
      totalEarnings,
      totalAvailable,
      requestedDeductions: requestedTotal,
      adjustedDeductions: { cf: adjCf, cash: adjCash, loan: adjLoan, welfare: adjWelfare, other: adjOther, total: adjTotal },
      isAdjusted,
      netPayable,
      paidAmount,
      closingBalance,
    });
  }, [formData]);

  // Re-fetch milk amount + individual earnings + welfare when date range changes while farmer is selected
  useEffect(() => {
    if (selectedFarmer && formData.fromDate && formData.toDate) {
      fetchMilkAmount(
        selectedFarmer.farmerNumber || selectedFarmer.producerCode,
        formData.fromDate,
        formData.toDate
      );
      fetchIndividualEarnings(selectedFarmer._id, formData.fromDate, formData.toDate);
      fetchFarmerOutstanding(selectedFarmer._id, formData.fromDate, formData.toDate);
    }
  }, [selectedFarmer, formData.fromDate, formData.toDate, fetchMilkAmount, fetchIndividualEarnings, fetchFarmerOutstanding]);

  /* ── Cycle boundary helpers ── */
  // Given a cycle and a date, return the cycle-period [fromDate, toDate] that date belongs to
  // Get period start/end for a given paymentDays and reference date.
  // The LAST period of the month always stretches to end-of-month
  // (e.g. 15-day cycle in a 31-day month → [1–15] and [16–31], never a stub [31–31])
  const getCyclePeriod = (days, refDate) => {
    const d   = dayjs(refDate);
    const yr  = d.year();
    const mo  = d.month();
    const day = d.date();
    const eom = dayjs(new Date(yr, mo + 1, 0)).date();

    if (!days || days >= 28) {
      return [new Date(yr, mo, 1), new Date(yr, mo, eom)];
    }
    let start = 1;
    while (start <= eom) {
      const nextStart = start + days;
      if (nextStart >= eom) {
        // Last period — always extend to end of month
        return [new Date(yr, mo, start), new Date(yr, mo, eom)];
      }
      const end = nextStart - 1;
      if (day <= end) return [new Date(yr, mo, start), new Date(yr, mo, end)];
      start = nextStart;
    }
    return [new Date(yr, mo, 1), new Date(yr, mo, eom)];
  };

  // Label for the current period
  const getPeriodLabel = (days, fromDate) => {
    if (!fromDate) return '';
    const d   = dayjs(fromDate);
    const yr  = d.year();
    const mo  = d.month();
    const eom = dayjs(new Date(yr, mo + 1, 0)).date();
    if (!days || days >= 28) return `${d.format('MMM YYYY')} (Monthly)`;
    let period = 1;
    let start  = 1;
    while (start <= eom) {
      const nextStart = start + days;
      if (nextStart >= eom) return `Period ${period} · ${start}–${eom}`;
      const end = nextStart - 1;
      if (d.date() <= end) return `Period ${period} · ${start}–${end}`;
      start = nextStart;
      period++;
    }
    return `Period ${period} · ${start}–${eom}`;
  };

  // Move to prev or next period
  const shiftPeriod = (direction) => {
    setDateConfirmed(false);
    setFormData((prev) => {
      const newRef = direction === 'prev'
        ? dayjs(prev.fromDate).subtract(1, 'day')
        : dayjs(prev.toDate).add(1, 'day');
      const [fd, td] = getCyclePeriod(paymentDays, newRef.toDate());
      return { ...prev, fromDate: fd, toDate: td };
    });
  };

  // Confirm the date range — unlocks the rest of the form
  const handleDateConfirm = () => {
    if (!formData.paymentDate) {
      notifications.show({ title: 'Select Payment Date', message: 'Please enter a payment date first', color: 'orange' });
      return;
    }
    setDateConfirmed(true);
    fetchGridPayments(1, formData.paymentDate);
    setGridPage(1);
  };

  // Handle form input changes
  const handleInputChange = (name, value) => {
    // Date changes reset confirmation
    if (name === 'fromDate' || name === 'toDate') setDateConfirmed(false);
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === 'fromDate' && value) {
        const [fd, td] = getCyclePeriod(paymentDays, value);
        updated.fromDate = fd;
        updated.toDate   = td;
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
      // Use adjusted deduction amounts (auto-capped to total available so net >= 0)
      const adj = summary.adjustedDeductions;
      const deductions = [];

      if (adj.cf > 0) deductions.push({
        type: 'CF Advance', amount: adj.cf,
        description: summary.isAdjusted && adj.cf < parseFloat(formData.cfAdvanceDeduction || 0)
          ? `CF Advance (adjusted from ₹${parseFloat(formData.cfAdvanceDeduction).toFixed(2)})`
          : 'CF Advance Deduction',
      });

      if (adj.cash > 0) deductions.push({
        type: 'Cash Advance', amount: adj.cash,
        description: summary.isAdjusted && adj.cash < parseFloat(formData.cashAdvanceDeduction || 0)
          ? `Cash Advance (adjusted from ₹${parseFloat(formData.cashAdvanceDeduction).toFixed(2)})`
          : 'Cash Advance Deduction',
      });

      if (adj.loan > 0) deductions.push({
        type: 'Loan Advance', amount: adj.loan,
        description: summary.isAdjusted && adj.loan < parseFloat(formData.loanEMIDeduction || 0)
          ? `Loan (adjusted from ₹${parseFloat(formData.loanEMIDeduction).toFixed(2)})`
          : 'Loan Advance Deduction',
      });

      if (adj.other > 0) deductions.push({
        type: 'Other', amount: adj.other,
        description: formData.otherDeductionsRemarks || 'Other Deductions',
      });

      if (adj.welfare > 0) deductions.push({
        type: 'Welfare Recovery', amount: adj.welfare,
        description: formData.welfareRecoveryRemarks || 'Welfare Recovery',
      });

      const bonuses = [];
      if (formData.bonusIncentive && parseFloat(formData.bonusIncentive) > 0) {
        bonuses.push({
          type: 'Other',
          amount: parseFloat(formData.bonusIncentive),
          description: formData.bonusRemarks || 'Earnings',
        });
      }

      const paymentData = {
        farmerId: formData.farmerId,
        farmerName: formData.producerName || '',
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
        paidAmount: summary.paidAmount > 0 ? summary.paidAmount : 0,
        paymentSource: 'PaymentRegister',
        remarks: summary.isAdjusted
          ? `Deductions adjusted: requested ₹${summary.requestedDeductions.toFixed(2)}, applied ₹${summary.adjustedDeductions.total.toFixed(2)} — ${formData.paymentMode}`
          : summary.closingBalance <= 0
          ? `Fully settled — ${formData.paymentMode}`
          : `Partial payment — balance ₹${summary.closingBalance.toFixed(2)} — ${formData.paymentMode}`,
      };

      const response = await paymentAPI.create(paymentData);
      const savedData = response.data || response;

      setSavedPayment({
        ...savedData,
        farmerName: formData.producerName,
        farmerId: selectedFarmer?.farmerNumber || selectedFarmer?.producerCode,
      });

      // Capture snapshot BEFORE form reset so bill modal can show correct data
      setBillSnapshot({
        ...formData,
        summary: { ...summary },
        milkDetails: { ...milkDetails },
        paymentNumber: savedData.paymentNumber,
        farmerIdDisplay: selectedFarmer?.farmerNumber || selectedFarmer?.producerCode,
        farmerName: formData.producerName,
      });

      notifications.show({
        title: summary.isAdjusted ? 'Payment Saved — Deductions Adjusted' : 'Payment Saved',
        message: `₹${summary.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} paid${summary.isAdjusted ? ` · Deductions auto-adjusted to ₹${summary.adjustedDeductions.total.toFixed(2)}` : ''}`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      // Reset farmer-specific fields only; keep dates confirmed for next farmer in same period
      setFormData((prev) => ({
        ...prev,
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
      }));
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

      // Refresh grid by payment date
      fetchGridPayments(1, formData.paymentDate);
      setGridPage(1);
      setEditId(null);

      // Keep the same period — do not auto-advance dates after payment
      setDateConfirmed(true);

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
    setDateConfirmed(false);
    const [fd, td] = getCyclePeriod(paymentDays, new Date());
    setFormData({
      paymentDate: new Date(),
      fromDate: fd,
      toDate: td,
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
    setFarmers([]);
    farmerMapRef.current = {};
    setMilkDetails({ totalQuantity: 0, morningQuantity: 0, eveningQuantity: 0, collectionDays: 0 });
    setOpeningAdvances({ cfAdvance: 0, cashAdvance: 0, loanAdvance: 0 });
    setOutstandingData({
      cashAdvance: 0,
      loanAdvance: 0,
      cfAdvance: 0,
      totalOutstanding: 0,
      cashAdvanceItems: [],
      loanAdvanceItems: [],
      cfAdvanceItems: [],
    });
    setEditId(null);
  };

  // Fetch payments grid for current period
  const fetchGridPayments = useCallback(async (pg = 1, date = formData.paymentDate) => {
    if (!date) return;
    setGridLoading(true);
    try {
      const d = dayjs(date).format('YYYY-MM-DD');
      const res = await paymentAPI.getAll({
        fromDate: d,
        toDate:   d,
        page: pg,
        limit: GRID_PAGE_SIZE,
      });
      setGridPayments(res.data || res.payments || []);
      setGridTotalPages(res.pagination?.pages || 1);
      setGridTotal(res.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load payments grid:', err);
    } finally {
      setGridLoading(false);
    }
  }, [formData.paymentDate]);

  useEffect(() => {
    if (formData.paymentDate) fetchGridPayments(gridPage, formData.paymentDate);
  }, [gridPage, formData.paymentDate]); // eslint-disable-line

  // Reload grid when date is confirmed (OK button clicked)
  useEffect(() => {
    if (dateConfirmed && formData.paymentDate) {
      fetchGridPayments(1, formData.paymentDate);
    }
  }, [dateConfirmed]); // eslint-disable-line

  // Load a saved payment into the form for editing
  const handleEditPayment = (pmt) => {
    setEditId(pmt._id);
    setFormData((prev) => ({
      ...prev,
      farmerId:             pmt.farmerId?._id || pmt.farmerId || '',
      producerName:         pmt.farmerName || pmt.farmerId?.personalDetails?.name || '',
      openingBalance:       pmt.previousBalance || 0,
      milkAmount:           pmt.milkAmount || '',
      cfAdvanceDeduction:   pmt.deductions?.find(d => d.type === 'CF Advance')?.amount || '',
      cashAdvanceDeduction: pmt.deductions?.find(d => d.type === 'Cash Advance')?.amount || '',
      loanEMIDeduction:     pmt.deductions?.find(d => d.type === 'Loan EMI')?.amount || '',
      welfareRecovery:      pmt.deductions?.find(d => d.type === 'Welfare Recovery')?.amount || '',
      otherDeductions:      pmt.deductions?.find(d => d.type === 'Other')?.amount || '',
      bonusIncentive:       pmt.bonuses?.find(b => b.type === 'Bonus')?.amount || '',
      paidAmount:           pmt.paidAmount || '',
      paymentMode:          (pmt.paymentMode || 'cash').toLowerCase(),
      referenceNumber:      pmt.referenceNumber || '',
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete a payment
  const handleDeletePayment = (pmt) => {
    modals.openConfirmModal({
      title: 'Delete Payment',
      centered: true,
      children: (
        <Text size="sm">
          Delete payment <strong>{pmt.paymentNumber}</strong> for <strong>{pmt.farmerName || '—'}</strong>? This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await paymentAPI.delete(pmt._id);
          notifications.show({ color: 'red', title: 'Deleted', message: 'Payment permanently deleted from database' });
          fetchGridPayments(gridPage);
        } catch (err) {
          notifications.show({ color: 'red', title: 'Error', message: err.message || 'Delete failed' });
        }
      },
    });
  };

  // True only when there is literally nothing to pay (no milk, no earnings, no prev balance)
  const deductionsExceedEarnings = summary.totalAvailable <= 0 && summary.requestedDeductions > 0;

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
              Record individual milk payments to producers with deductions and earnings
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
                {/* STEP 1 — Payment Date + OK */}
                <Grid gutter="md" align="flex-end">
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <DatePickerInput
                      label="Payment Date"
                      placeholder="Select payment date"
                      value={formData.paymentDate}
                      onChange={(value) => {
                        handleInputChange('paymentDate', value);
                        setDateConfirmed(false);
                      }}
                      leftSection={<IconCalendar size={16} />}
                      required
                      valueFormat="DD/MM/YYYY"
                      className="form-input"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <Button
                      color="teal"
                      leftSection={<IconCheck size={16} />}
                      onClick={handleDateConfirm}
                      disabled={!formData.paymentDate}
                      variant={dateConfirmed ? 'filled' : 'outline'}
                      fullWidth
                    >
                      {dateConfirmed
                        ? `OK — ${dayjs(formData.fromDate).format('DD/MM/YYYY')} to ${dayjs(formData.toDate).format('DD/MM/YYYY')}`
                        : 'OK — Confirm'}
                    </Button>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    {/* Period nav */}
                    <Group gap="xs" justify="flex-end">
                      <Button size="xs" variant="subtle" color="gray" onClick={() => shiftPeriod('prev')}>‹ Prev</Button>
                      <Badge color="teal" variant="light" size="sm">
                        {getPeriodLabel(paymentDays, formData.fromDate)}
                      </Badge>
                      <Button size="xs" variant="subtle" color="gray" onClick={() => shiftPeriod('next')}>Next ›</Button>
                    </Group>
                  </Grid.Col>
                </Grid>

                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DatePickerInput
                      label="From Date"
                      placeholder="From"
                      value={formData.fromDate}
                      onChange={(value) => handleInputChange('fromDate', value)}
                      leftSection={<IconCalendar size={16} />}
                      valueFormat="DD/MM/YYYY"
                      className="form-input"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DatePickerInput
                      label="To Date"
                      placeholder="To"
                      value={formData.toDate}
                      onChange={(value) => handleInputChange('toDate', value)}
                      leftSection={<IconCalendar size={16} />}
                      minDate={formData.fromDate || undefined}
                      valueFormat="DD/MM/YYYY"
                      className="form-input"
                    />
                  </Grid.Col>
                </Grid>

                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                  </Grid.Col>

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
                      disabled={!dateConfirmed}
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
                      disabled={!dateConfirmed}
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
                      ref={milkAmountRef}
                      label="Milk Amount"
                      placeholder="Enter milk amount"
                      value={formData.milkAmount}
                      onChange={(value) => handleInputChange('milkAmount', value)}
                      onKeyDown={(e) => e.key === 'Enter' && focusField(earningsRef)}
                      leftSection={<IconCurrencyRupee size={16} />}
                      prefix="₹ "
                      thousandSeparator=","
                      decimalScale={2}
                      min={0}
                      required
                      disabled={!dateConfirmed}
                      className="form-input milk-amount-input"
                      description={milkDetails.totalQuantity > 0 ? `Qty: ${milkDetails.totalQuantity.toFixed(2)} L  (M: ${milkDetails.morningQuantity.toFixed(2)} L  E: ${milkDetails.eveningQuantity.toFixed(2)} L)` : 'Total milk payment for this period'}
                    />
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <NumberInput
                      ref={earningsRef}
                      label="Earnings"
                      placeholder="Enter earnings amount"
                      value={formData.bonusIncentive}
                      onChange={(value) => handleInputChange('bonusIncentive', value)}
                      onKeyDown={(e) => e.key === 'Enter' && focusField(cfAdvanceRef)}
                      leftSection={<IconTrendingUp size={16} />}
                      prefix="₹ "
                      thousandSeparator=","
                      decimalScale={2}
                      min={0}
                      disabled={!dateConfirmed}
                      className="form-input optional-input"
                      description="Auto-fetched: bonus, incentive, individual earnings"
                    />
                  </Grid.Col>
                </Grid>
              </Stack>
            </Card>

            {/* Deductions Card */}
            <Card withBorder shadow="sm" radius="md" className="form-card deductions-card" style={{ opacity: dateConfirmed ? 1 : 0.45, pointerEvents: dateConfirmed ? 'auto' : 'none' }}>
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
                      {(() => {
                        const outstanding = outstandingData.cfAdvance > 0 ? outstandingData.cfAdvance : openingAdvances.cfAdvance;
                        const deducted   = parseFloat(formData.cfAdvanceDeduction) || 0;
                        const remaining  = Math.max(0, outstanding - deducted);
                        return (
                          <NumberInput
                            ref={cfAdvanceRef}
                            label="CF Advance Deduction"
                            placeholder="Enter amount"
                            value={formData.cfAdvanceDeduction}
                            onChange={(value) => handleInputChange('cfAdvanceDeduction', value)}
                            onKeyDown={(e) => e.key === 'Enter' && focusField(cashAdvanceRef)}
                            leftSection={<IconCoins size={16} />}
                            prefix="₹ "
                            thousandSeparator=","
                            decimalScale={2}
                            min={0}
                            className="form-input"
                            description={outstanding > 0
                              ? <span style={{ display: 'flex', gap: 8 }}>
                                  <span>Outstanding: <strong style={{ color: '#c92a2a' }}>{formatCurrency(outstanding)}</strong></span>
                                  <span>|</span>
                                  <span>Remaining: <strong style={{ color: remaining > 0 ? '#e67700' : '#2f9e44' }}>{formatCurrency(remaining)}</strong></span>
                                </span>
                              : 'No outstanding balance'
                            }
                          />
                        );
                      })()}
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      {(() => {
                        const outstanding = outstandingData.cashAdvance > 0 ? outstandingData.cashAdvance : openingAdvances.cashAdvance;
                        const deducted   = parseFloat(formData.cashAdvanceDeduction) || 0;
                        const remaining  = Math.max(0, outstanding - deducted);
                        return (
                          <NumberInput
                            ref={cashAdvanceRef}
                            label="Cash Advance Deduction"
                            placeholder="Enter amount"
                            value={formData.cashAdvanceDeduction}
                            onChange={(value) => handleInputChange('cashAdvanceDeduction', value)}
                            onKeyDown={(e) => e.key === 'Enter' && focusField(loanAdvanceRef)}
                            leftSection={<IconCash size={16} />}
                            prefix="₹ "
                            thousandSeparator=","
                            decimalScale={2}
                            min={0}
                            className="form-input"
                            description={outstanding > 0
                              ? <span style={{ display: 'flex', gap: 8 }}>
                                  <span>Outstanding: <strong style={{ color: '#c92a2a' }}>{formatCurrency(outstanding)}</strong></span>
                                  <span>|</span>
                                  <span>Remaining: <strong style={{ color: remaining > 0 ? '#e67700' : '#2f9e44' }}>{formatCurrency(remaining)}</strong></span>
                                </span>
                              : 'No outstanding balance'
                            }
                          />
                        );
                      })()}
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      {(() => {
                        const outstanding = outstandingData.loanAdvance > 0 ? outstandingData.loanAdvance : openingAdvances.loanAdvance;
                        const deducted   = parseFloat(formData.loanEMIDeduction) || 0;
                        const remaining  = Math.max(0, outstanding - deducted);
                        return (
                          <NumberInput
                            ref={loanAdvanceRef}
                            label="Loan Advance Deduction"
                            placeholder="Enter amount"
                            value={formData.loanEMIDeduction}
                            onChange={(value) => handleInputChange('loanEMIDeduction', value)}
                            onKeyDown={(e) => e.key === 'Enter' && focusField(welfareRef)}
                            leftSection={<IconCoins size={16} />}
                            prefix="₹ "
                            thousandSeparator=","
                            decimalScale={2}
                            min={0}
                            className="form-input optional-input"
                            description={outstanding > 0
                              ? <span style={{ display: 'flex', gap: 8 }}>
                                  <span>Outstanding: <strong style={{ color: '#c92a2a' }}>{formatCurrency(outstanding)}</strong></span>
                                  <span>|</span>
                                  <span>Remaining: <strong style={{ color: remaining > 0 ? '#e67700' : '#2f9e44' }}>{formatCurrency(remaining)}</strong></span>
                                </span>
                              : 'Optional: Loan repayment'
                            }
                          />
                        );
                      })()}
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        ref={welfareRef}
                        label="Welfare Recovery"
                        value={formData.welfareRecovery}
                        onKeyDown={(e) => e.key === 'Enter' && focusField(otherDeductionsRef)}
                        leftSection={<IconTrendingDown size={16} />}
                        prefix="₹ "
                        thousandSeparator=","
                        decimalScale={2}
                        readOnly
                        className="form-input readonly-input"
                        description="Auto-filled from welfare rules"
                        styles={{ input: { backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' } }}
                      />
                    </Grid.Col>

                    {/* <Grid.Col span={{ base: 12, sm: 6 }}>
                      <TextInput
                        label="Welfare Recovery Remarks"
                        placeholder="Specify welfare recovery type"
                        value={formData.welfareRecoveryRemarks}
                        onChange={(e) => handleInputChange('welfareRecoveryRemarks', e.target.value)}
                        leftSection={<IconFileText size={16} />}
                        className="form-input optional-input"
                        description="Optional: Description"
                      />
                    </Grid.Col> */}

                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <NumberInput
                        ref={otherDeductionsRef}
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
            <Card withBorder shadow="sm" radius="md" className="form-card" style={{ opacity: dateConfirmed ? 1 : 0.45, pointerEvents: dateConfirmed ? 'auto' : 'none' }}>
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

                {/* Formula hint */}
                <Text size="xs" c="dimmed" ta="center" ff="monospace">
                  (Prev + Milk + Earnings) − Deductions
                </Text>

                {/* Summary Items */}
                <Stack gap="sm">
                  {/* Previous Balance */}
                  <Group justify="space-between">
                    <Group gap="xs">
                      <IconArrowRight size={14} color={summary.openingBalance >= 0 ? '#38a169' : '#e53e3e'} />
                      <Text size="sm" c="dimmed">Previous Balance</Text>
                    </Group>
                    <Text fw={500} c={summary.openingBalance >= 0 ? 'teal' : 'red'}>
                      {summary.openingBalance >= 0 ? '+' : ''}{formatCurrency(summary.openingBalance)}
                    </Text>
                  </Group>

                  <Group justify="space-between">
                    <Group gap="xs">
                      <IconMilk size={16} />
                      <Text size="sm">Milk Amount</Text>
                    </Group>
                    <Text fw={500} c="green">+ {formatCurrency(parseFloat(formData.milkAmount) || 0)}</Text>
                  </Group>

                  {parseFloat(formData.bonusIncentive) > 0 && (
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconPlus size={16} color="green" />
                        <Text size="sm">Earnings</Text>
                      </Group>
                      <Text fw={500} c="green">+ {formatCurrency(parseFloat(formData.bonusIncentive))}</Text>
                    </Group>
                  )}

                  <Paper p="xs" radius="sm" className="earnings-box">
                    <Group justify="space-between">
                      <Text size="sm" fw={600}>Total Available</Text>
                      <Text fw={700} c="green">{formatCurrency(summary.totalAvailable)}</Text>
                    </Group>
                  </Paper>

                  <Divider variant="dashed" />

                  {/* Deductions — show adjusted amounts, flag if capped */}
                  {[
                    { key: 'cf',      label: 'CF Advance',      entered: parseFloat(formData.cfAdvanceDeduction) || 0,      adj: summary.adjustedDeductions.cf },
                    { key: 'cash',    label: 'Cash Advance',    entered: parseFloat(formData.cashAdvanceDeduction) || 0,    adj: summary.adjustedDeductions.cash },
                    { key: 'loan',    label: 'Loan Advance',    entered: parseFloat(formData.loanEMIDeduction) || 0,        adj: summary.adjustedDeductions.loan },
                    { key: 'other',   label: 'Other Deductions',entered: parseFloat(formData.otherDeductions) || 0,         adj: summary.adjustedDeductions.other },
                    { key: 'welfare', label: 'Welfare Recovery', entered: parseFloat(formData.welfareRecovery) || 0,        adj: summary.adjustedDeductions.welfare },
                  ].filter(d => d.entered > 0).map(d => (
                    <Group key={d.key} justify="space-between">
                      <Group gap="xs">
                        <IconMinus size={14} color="red" />
                        <Text size="sm">{d.label}</Text>
                        {summary.isAdjusted && d.adj < d.entered && (
                          <Badge color="orange" size="xs" variant="light">Adjusted</Badge>
                        )}
                      </Group>
                      <Box ta="right">
                        {summary.isAdjusted && d.adj < d.entered && (
                          <Text size="xs" c="dimmed" td="line-through">{formatCurrency(d.entered)}</Text>
                        )}
                        <Text fw={500} c={d.adj > 0 ? 'red' : 'dimmed'}>
                          {d.adj > 0 ? `- ${formatCurrency(d.adj)}` : '₹0.00'}
                        </Text>
                      </Box>
                    </Group>
                  ))}

                  {summary.adjustedDeductions.total > 0 && (
                    <Paper p="xs" radius="sm" className="deductions-box">
                      <Group justify="space-between">
                        <Text size="sm" fw={600}>Total Deductions</Text>
                        <Text fw={700} c="red">{formatCurrency(summary.adjustedDeductions.total)}</Text>
                      </Group>
                    </Paper>
                  )}

                  {summary.isAdjusted && (
                    <Alert color="orange" variant="light" icon={<IconInfoCircle size={14} />} p="xs" radius="sm">
                      <Text size="xs">
                        Deductions reduced from {formatCurrency(summary.requestedDeductions)} to {formatCurrency(summary.adjustedDeductions.total)} to match available earnings. Outstanding balance remains with the advance.
                      </Text>
                    </Alert>
                  )}
                </Stack>

                <Divider />

                {/* Warning for excess deductions */}
                {deductionsExceedEarnings && (
                  <Alert color="red" icon={<IconAlertCircle size={16} />} title="No Earnings" variant="light">
                    No milk amount or earnings available to process payment.
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
                  <Text size="sm" fw={500}>
                    {summary.closingBalance <= 0 ? 'Status' : 'Balance Due'}
                  </Text>
                  <Text fw={700} size="lg" c={summary.closingBalance <= 0 ? 'teal' : 'red'}>
                    {summary.closingBalance <= 0 ? '✓ Fully Settled' : formatCurrency(summary.closingBalance)}
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
                    disabled={!dateConfirmed || !formData.farmerId || !formData.milkAmount || deductionsExceedEarnings}
                    className="save-button"
                  >
                    {summary.isAdjusted ? 'Save (Deductions Adjusted)' : 'Save Payment'}
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
                  <Table.Td>
                    Milk Amount
                    {billSnapshot?.milkDetails?.totalQuantity > 0 && (
                      <Text size="xs" c="dimmed" mt={2}>
                        {billSnapshot.milkDetails.totalQuantity.toFixed(2)} L
                        &nbsp;(M: {billSnapshot.milkDetails.morningQuantity.toFixed(2)} L &nbsp;E: {billSnapshot.milkDetails.eveningQuantity.toFixed(2)} L)
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(parseFloat(billSnapshot?.milkAmount) || 0)}</Table.Td>
                </Table.Tr>
                {parseFloat(billSnapshot?.bonusIncentive) > 0 && (
                  <Table.Tr>
                    <Table.Td>Earnings</Table.Td>
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

      {/* ── Payments Grid ── */}
      <Paper shadow="sm" radius="md" withBorder mt="lg" style={{ overflow: 'hidden' }}>
        <Box px="md" py="sm" style={{ background: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <ThemeIcon size={28} radius="sm" color="teal" variant="light">
                <IconReceipt size={16} />
              </ThemeIcon>
              <Text fw={700} size="sm" c="dark.6">Payment Entries</Text>
              <Badge color="teal" variant="light" size="sm" radius="sm">
                {gridTotal} {gridTotal === 1 ? 'record' : 'records'}
              </Badge>
            </Group>
            <Tooltip label="Refresh">
              <ActionIcon variant="light" color="teal" size="lg" loading={gridLoading}
                onClick={() => fetchGridPayments(gridPage)}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Box>

        <Box style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover withTableBorder withColumnBorders fz="xs" style={{ minWidth: 1400 }}>
            <Table.Thead>
              <Table.Tr style={{ background: '#f8f9fa' }}>
                <Table.Th w={40}  fz="xs">#</Table.Th>
                <Table.Th w={95}  fz="xs">Pay Date</Table.Th>
                <Table.Th w={90}  fz="xs">Farmer ID</Table.Th>
                <Table.Th w={140} fz="xs">Farmer Name</Table.Th>
                <Table.Th w={80}  fz="xs" ta="right">Qty (L)</Table.Th>
                <Table.Th w={95}  fz="xs" ta="right">Milk Amt</Table.Th>
                <Table.Th w={85}  fz="xs" ta="right">Earnings</Table.Th>
                <Table.Th w={85}  fz="xs" ta="right">Prev Bal</Table.Th>
                <Table.Th w={85}  fz="xs" ta="right">CF Adv</Table.Th>
                <Table.Th w={85}  fz="xs" ta="right">Cash Adv</Table.Th>
                <Table.Th w={85}  fz="xs" ta="right">Loan EMI</Table.Th>
                <Table.Th w={85}  fz="xs" ta="right">Welfare</Table.Th>
                <Table.Th w={85}  fz="xs" ta="right">Other Ded</Table.Th>
                <Table.Th w={95}  fz="xs" ta="right">Net Pay</Table.Th>
                <Table.Th w={95}  fz="xs" ta="right">Paid Amt</Table.Th>
                <Table.Th w={85}  fz="xs" ta="right">Balance</Table.Th>
                <Table.Th w={70}  fz="xs">Mode</Table.Th>
                <Table.Th w={75}  fz="xs">Status</Table.Th>
                <Table.Th w={70}  fz="xs">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {gridLoading ? (
                <Table.Tr><Table.Td colSpan={19} ta="center" py="xl"><Loader size="sm" /></Table.Td></Table.Tr>
              ) : gridPayments.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={19} ta="center" py="xl" c="dimmed">
                    <Stack align="center" gap={4}>
                      <IconReceipt size={28} opacity={0.3} />
                      <Text size="sm">No payments for this period.</Text>
                    </Stack>
                  </Table.Td>
                </Table.Tr>
              ) : gridPayments.map((pmt, i) => {
                const deds = pmt.deductions || [];
                const cf      = deds.find(d => d.type === 'CF Advance')?.amount || 0;
                const cash    = deds.find(d => d.type === 'Cash Advance')?.amount || 0;
                const loan    = deds.find(d => d.type === 'Loan Advance')?.amount || 0;
                const welfare = deds.find(d => d.type === 'Welfare Recovery')?.amount || 0;
                const other   = deds.find(d => d.type === 'Other')?.amount || 0;
                const bonusTotal = (pmt.bonuses || []).reduce((s, b) => s + (b.amount || 0), 0);
                return (
                  <Table.Tr key={pmt._id} bg={editId === pmt._id ? '#edf2ff' : undefined}>
                    <Table.Td c="dimmed" fz="xs">{(gridPage - 1) * GRID_PAGE_SIZE + i + 1}</Table.Td>
                    <Table.Td fz="xs">{dayjs(pmt.paymentDate).format('DD/MM/YY')}</Table.Td>
                    <Table.Td fz="xs" fw={600} c="blue.8">{pmt.farmerNumber || pmt.farmerId?.farmerNumber || '—'}</Table.Td>
                    <Table.Td fz="xs">{pmt.farmerName || pmt.farmerId?.personalDetails?.name || '—'}</Table.Td>
                    <Table.Td fz="xs" ta="right">{Number(pmt.milkDetails?.totalQuantity || 0).toFixed(2)}</Table.Td>
                    <Table.Td fz="xs" ta="right" c="teal.7" fw={500}>₹{Number(pmt.milkAmount || 0).toFixed(2)}</Table.Td>
                    <Table.Td fz="xs" ta="right" c="green.7">{bonusTotal > 0 ? `₹${bonusTotal.toFixed(2)}` : '—'}</Table.Td>
                    <Table.Td fz="xs" ta="right" c={Number(pmt.previousBalance) > 0 ? 'red.6' : 'dimmed'}>
                      {Number(pmt.previousBalance || 0) > 0 ? `₹${Number(pmt.previousBalance).toFixed(2)}` : '—'}
                    </Table.Td>
                    <Table.Td fz="xs" ta="right" c="violet.7">{cf > 0 ? `₹${cf.toFixed(2)}` : '—'}</Table.Td>
                    <Table.Td fz="xs" ta="right" c="orange.7">{cash > 0 ? `₹${cash.toFixed(2)}` : '—'}</Table.Td>
                    <Table.Td fz="xs" ta="right" c="pink.7">{loan > 0 ? `₹${loan.toFixed(2)}` : '—'}</Table.Td>
                    <Table.Td fz="xs" ta="right" c="grape.7">{welfare > 0 ? `₹${welfare.toFixed(2)}` : '—'}</Table.Td>
                    <Table.Td fz="xs" ta="right" c="red.7">{other > 0 ? `₹${other.toFixed(2)}` : '—'}</Table.Td>
                    <Table.Td fz="xs" ta="right" fw={600} c="blue.8">₹{Number(pmt.netPayable || 0).toFixed(2)}</Table.Td>
                    <Table.Td fz="xs" ta="right" fw={700} c="blue.7">₹{Number(pmt.paidAmount || 0).toFixed(2)}</Table.Td>
                    <Table.Td fz="xs" ta="right" c={Number(pmt.balanceAmount) > 0 ? 'red.6' : 'green.6'}>
                      ₹{Number(pmt.balanceAmount || 0).toFixed(2)}
                    </Table.Td>
                    <Table.Td fz="xs">{pmt.paymentMode || '—'}</Table.Td>
                    <Table.Td fz="xs">
                      <Badge size="xs" variant="light"
                        color={pmt.status === 'Paid' ? 'green' : pmt.status === 'Cancelled' ? 'red' : pmt.status === 'Partial' ? 'orange' : 'gray'}>
                        {pmt.status || 'Pending'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Edit">
                          <ActionIcon variant="light" color="blue" size="sm"
                            onClick={() => handleEditPayment(pmt)}>
                            <IconEdit size={13} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon variant="light" color="red" size="sm"
                            onClick={() => handleDeletePayment(pmt)}>
                            <IconTrash size={13} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Box>

        {gridTotalPages > 1 && (
          <Group justify="center" py="sm" style={{ borderTop: '1px solid #dee2e6' }}>
            <Pagination total={gridTotalPages} value={gridPage} onChange={setGridPage}
              color="teal" radius="md" size="sm" />
          </Group>
        )}
      </Paper>

    </Container>
  );
};

export default MilkPaymentRegister;
