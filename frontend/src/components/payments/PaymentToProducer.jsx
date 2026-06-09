import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container,
  Grid,
  Card,
  Title,
  Text,
  Group,
  Stack,
  Box,
  Button,
  TextInput,
  NumberInput,
  Select,
  Checkbox,
  Table,
  Badge,
  ActionIcon,
  Pagination,
  Loader,
  Center,
  Divider,
  Paper,
  Alert,
  Radio,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconCash,
  IconPrinter,
  IconSearch,
  IconRefresh,
  IconEdit,
  IconTrash,
  IconCheck,
  IconBuildingBank,
  IconUser,
  IconFileText,
  IconListDetails,
} from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import dayjs from 'dayjs';
import { collectionCenterAPI, farmerAPI, producerPaymentAPI, ledgerAPI } from '../../services/api';

/* ─── Formatters ─────────────────────────────────────────────────────────────── */
const fmt = (v) =>
  parseFloat(v || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '-');

/* ─── Print styles ────────────────────────────────────────────────────────────── */
const PRINT_STYLE = `
  @media print {
    body * { visibility: hidden !important; }
    #ptp-print-area, #ptp-print-area * { visibility: visible !important; }
    #ptp-print-area { position: fixed; inset: 0; padding: 16px; }
    table { page-break-inside: auto; border-collapse: collapse; width: 100%; }
    tr { page-break-inside: avoid; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 11px; }
    @page { size: A4 landscape; margin: 10mm; }
    .no-print { display: none !important; }
    .print-only { display: block !important; }
  }
`;

const DETAIL_PRINT_STYLE = `
  @media print {
    body * { visibility: hidden !important; }
    #ptp-detail-area, #ptp-detail-area * { visibility: visible !important; }
    #ptp-detail-area { position: fixed !important; inset: 0 !important; padding: 16px; }
    table { page-break-inside: auto; border-collapse: collapse; width: 100%; }
    tr { page-break-inside: avoid; }
    th, td { border: 1px solid #ccc; padding: 5px 6px; font-size: 10px; }
    @page { size: A4 landscape; margin: 10mm; }
    .no-print { display: none !important; }
    .print-only { display: block !important; }
  }
`;

const VOUCHER_PRINT_STYLE = `
  @media print {
    body * { visibility: hidden !important; }
    #ptp-voucher-area, #ptp-voucher-area * { visibility: visible !important; }
    #ptp-voucher-area { position: fixed !important; inset: 0 !important; padding: 24px; }
    @page { size: A5; margin: 10mm; }
    .no-print { display: none !important; }
    .print-only { display: block !important; }
  }
`;

/* ════════════════════════════════════════════════════════════════════════════ */
export default function PaymentToProducer() {
  // ── Payment type: Settlement (cycle-based) | Partial (no cycle required) ───
  const [paymentType, setPaymentType] = useState('Settlement');

  // ── Period / Filter state ───────────────────────────────────────────────────
  const [periodConfirmed, setPeriodConfirmed] = useState(false);
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [centerId, setCenterId] = useState(null);
  const [centerName, setCenterName] = useState('All');
  const [centers, setCenters] = useState([]);

  // ── Payment Details form state ──────────────────────────────────────────────
  const [last5Days, setLast5Days] = useState(false);
  const [producerIdInput, setProducerIdInput] = useState('');
  const [refNo, setRefNo] = useState('');
  const [abstractBalance, setAbstractBalance] = useState(0);
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [bankLedgers, setBankLedgers] = useState([]);
  const [bankLedgerId, setBankLedgerId] = useState(null);
  const [bankLedgerName, setBankLedgerName] = useState('');
  const [printSlip, setPrintSlip] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [bankTransferPaid, setBankTransferPaid] = useState(false);
  const [alreadyPaidCash, setAlreadyPaidCash] = useState(false);
  const [cashPaymentInfo, setCashPaymentInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // ── Table state ─────────────────────────────────────────────────────────────
  const [payments, setPayments] = useState([]);
  const [bankTransferRows, setBankTransferRows] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [tableSearch, setTableSearch] = useState('');

  // ── Voucher print state ─────────────────────────────────────────────────────
  const [voucherData, setVoucherData] = useState(null);

  // ── Derived flags (must be before callbacks that reference them) ─────────────
  const isPartial  = paymentType === 'Partial';
  const formActive = isPartial || periodConfirmed;

  const printRef = useRef();
  const detailPrintRef = useRef();
  const voucherPrintRef = useRef();
  const amountPaidWrapRef = useRef(null);
  const producerIdRef    = useRef(null);
  const saveButtonRef    = useRef(null);
  // Prevents onBlur double-fetch when Enter/Tab already triggered the lookup
  const keydownFetchedRef = useRef(false);

  // ─── Load collection centers + cycles + bank ledgers on mount ────────────────
  useEffect(() => {
    collectionCenterAPI
      .getAll({ status: 'Active' })
      .then((res) => {
        const list = res?.data || [];
        setCenters(list.map((c) => ({ value: c._id, label: c.centerName })));
        // Restore last used center from localStorage
        const savedId   = localStorage.getItem('ptp_lastCenterId');
        const savedName = localStorage.getItem('ptp_lastCenterName');
        if (savedId && list.some((c) => c._id === savedId)) {
          setCenterId(savedId);
          setCenterName(savedName || 'All');
        }
      })
      .catch(() => setCenters([]));

    producerPaymentAPI.getCycles()
      .then((res) => {
        const list = res?.data || [];
        setCycles(list);
        // Auto-select last used cycle (or most recent if no saved preference)
        const savedKey = localStorage.getItem('ptp_lastCycleKey');
        const match = savedKey
          ? list.find(c => `${dayjs(c.fromDate).format('YYYY-MM-DD')}|${dayjs(c.toDate).format('YYYY-MM-DD')}` === savedKey)
          : null;
        const def = match || list[0] || null;
        if (def) {
          setSelectedCycle({ fromDate: new Date(def.fromDate), toDate: new Date(def.toDate), label: def.label });
        }
      })
      .catch(() => setCycles([]));

    ledgerAPI.getAll({ status: 'Active' })
      .then((res) => {
        const BANK_TYPES = ['Bank', 'Bank Accounts', 'Bank Account'];
        const filtered = (res?.data || []).filter(l => BANK_TYPES.includes(l.ledgerType));
        setBankLedgers(filtered.map(l => ({ value: l._id, label: l.ledgerName })));
      })
      .catch(() => setBankLedgers([]));
  }, []);

  // ─── Load payments when filters/pagination change (and period confirmed) ────
  const loadPayments = useCallback(async () => {
    if (!formActive) return;
    setTableLoading(true);
    try {
      const params = {
        page,
        limit,
        search: tableSearch || undefined,
        centerId: centerId || undefined,
      };

      if (last5Days) {
        params.last5Days = 'true';
      } else if (selectedCycle) {
        params.cycleFromDate = dayjs(selectedCycle.fromDate).format('YYYY-MM-DD');
        params.cycleToDate   = dayjs(selectedCycle.toDate).format('YYYY-MM-DD');
      }

      const res = await producerPaymentAPI.getAll(params);
      if (res?.success) {
        setPayments(res.data || []);
        setTotalPages(res.pagination?.pages || 1);
        setTotalCount(res.pagination?.total || 0);
        setGrandTotal(res.summary?.totalAmount || 0);
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to load payments', color: 'red' });
    } finally {
      setTableLoading(false);
    }
  }, [formActive, page, limit, last5Days, selectedCycle, centerId, tableSearch]);

  // ─── Load bank-transfer-paid rows for the selected cycle ────────────────────
  const loadBankTransferRows = useCallback(async () => {
    if (!formActive || !selectedCycle) { setBankTransferRows([]); return; }
    try {
      const res = await producerPaymentAPI.getBankTransferPaid({
        cycleFromDate: dayjs(selectedCycle.fromDate).format('YYYY-MM-DD'),
        cycleToDate:   dayjs(selectedCycle.toDate).format('YYYY-MM-DD'),
      });
      setBankTransferRows(res?.data || []);
    } catch {
      setBankTransferRows([]);
    }
  }, [formActive, selectedCycle]);

  useEffect(() => {
    if (formActive) {
      loadPayments();
      loadBankTransferRows();
    }
  }, [loadPayments, loadBankTransferRows]);

  // ─── Handle period OK / Cancel ──────────────────────────────────────────────
  const handleOK = () => {
    if (!isPartial && !selectedCycle) {
      notifications.show({ title: 'Validation', message: 'Please select a payment cycle', color: 'orange' });
      return;
    }
    setPeriodConfirmed(true);
    // Move cursor to Producer ID field after confirming
    setTimeout(() => producerIdRef.current?.focus(), 150);
  };

  const handleCancel = () => {
    setPeriodConfirmed(false);
    resetDetailsForm();
  };

  // ─── Fetch producer balance on producer ID blur / Enter ──────────────────────
  const fetchProducerBalance = useCallback(async () => {
    if (!producerIdInput?.trim()) return null;

    setBalanceLoading(true);
    try {
      const searchRes = await farmerAPI.search(producerIdInput.trim());
      const farmers = searchRes?.data || [];
      if (farmers.length === 0) {
        notifications.show({ title: 'Not Found', message: `No producer found with ID "${producerIdInput}"`, color: 'orange' });
        setSelectedFarmer(null);
        setAbstractBalance(0);
        setAmountPaid('');
        setBankTransferPaid(false);
        return null;
      }

      const farmer = farmers[0];
      const periodParams = {};
      if (!isPartial && selectedCycle) {
        periodParams.fromDate = dayjs(selectedCycle.fromDate).format('YYYY-MM-DD');
        periodParams.toDate   = dayjs(selectedCycle.toDate).format('YYYY-MM-DD');
      }

      const balanceRes = await producerPaymentAPI.getProducerBalance(farmer._id, periodParams);

      if (balanceRes?.success) {
        // In Partial mode, ignore already-paid guards — allow multiple partial payments
        const isBT       = !isPartial && (balanceRes.data?.bankTransferPaid || false);
        const isCashPaid = !isPartial && (balanceRes.data?.alreadyPaidCash  || false);
        const cashInfo   = balanceRes.data?.cashPayment || null;
        const netPay     = balanceRes.data?.balance || 0;

        setAbstractBalance(netPay);
        if (!isBT && !isCashPaid) {
          setAmountPaid(netPay > 0 ? netPay : '');
        }
        setSelectedFarmer({
          _id:           farmer._id,
          farmerNumber:  farmer.farmerNumber,
          name:          farmer.personalDetails?.name || '',
          bankName:      balanceRes.data?.farmer?.bankName || farmer.bankDetails?.bankName || '',
          accountNumber: balanceRes.data?.farmer?.accountNumber || farmer.bankDetails?.accountNumber || '',
        });
        setBankTransferPaid(isBT);
        setAlreadyPaidCash(isCashPaid);
        setCashPaymentInfo(cashInfo);

        if (isBT) {
          notifications.show({
            title: 'Already Paid',
            message: 'This producer has already been paid via Bank Transfer for this cycle.',
            color: 'orange',
            icon: <IconBuildingBank size={16} />,
          });
        } else if (isCashPaid) {
          notifications.show({
            title: 'Already Paid',
            message: `This producer was already paid in this cycle on ${cashInfo?.paymentDate ? dayjs(cashInfo.paymentDate).format('DD/MM/YYYY') : '-'} (₹${fmt(cashInfo?.amountPaid)}).`,
            color: 'orange',
            icon: <IconCash size={16} />,
          });
        }
        return { bankTransferPaid: isBT, alreadyPaidCash: isCashPaid };
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: err?.message || 'Failed to fetch producer balance', color: 'red' });
      setSelectedFarmer(null);
      setAbstractBalance(0);
      setAmountPaid('');
      setBankTransferPaid(false);
      setAlreadyPaidCash(false);
      setCashPaymentInfo(null);
    } finally {
      setBalanceLoading(false);
    }
    return null;
  }, [producerIdInput, selectedCycle]);

  // ─── Enter / Tab on producer ID ─────────────────────────────────────────────
  // Settlement: fetch balance → focus Save button (Amount Paid is read-only)
  // Partial:    fetch balance → focus Amount Paid
  const handleProducerIdKeyDown = async (e) => {
    if (e.key !== 'Enter' && e.key !== 'Tab') return;
    e.preventDefault();
    keydownFetchedRef.current = true;
    const result = await fetchProducerBalance();
    if (!result || result.bankTransferPaid || result.alreadyPaidCash) return;
    setTimeout(() => {
      if (isPartial) {
        amountPaidWrapRef.current?.querySelector('input')?.focus();
      } else {
        saveButtonRef.current?.focus();
      }
    }, 50);
  };

  // ─── Enter / Tab on amount paid → save ──────────────────────────────────────
  const handleAmountPaidKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      handleSave();
    }
  };

  // ─── Save (create or update) ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedFarmer) {
      notifications.show({ title: 'Validation', message: 'Please enter a valid Producer ID', color: 'orange' });
      return;
    }
    if (!isPartial && bankTransferPaid) {
      notifications.show({ title: 'Blocked', message: 'This producer is already paid via Bank Transfer', color: 'orange' });
      return;
    }
    if (!isPartial && alreadyPaidCash && !editingId) {
      notifications.show({
        title: 'Blocked',
        message: 'This producer has already been paid in this cycle. Re-entry is not allowed.',
        color: 'orange',
      });
      return;
    }
    if (!isPartial && !selectedCycle) {
      notifications.show({ title: 'Validation', message: 'Please select a payment cycle', color: 'orange' });
      return;
    }
    const paid = parseFloat(amountPaid);
    if (!paid || paid <= 0) {
      notifications.show({ title: 'Validation', message: 'Amount Paid must be greater than 0', color: 'orange' });
      return;
    }
    if (paymentMode !== 'Cash' && !bankLedgerId) {
      notifications.show({ title: 'Validation', message: 'Please select a Bank Ledger for non-cash payments', color: 'orange' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        farmerId:          selectedFarmer._id,
        producerNumber:    selectedFarmer.farmerNumber,
        producerName:      selectedFarmer.name,
        amountPaid:        paid,
        processingPeriod:  selectedCycle
          ? { fromDate: dayjs(selectedCycle.fromDate).toISOString(), toDate: dayjs(selectedCycle.toDate).toISOString() }
          : { fromDate: dayjs(paymentDate).toISOString(),            toDate: dayjs(paymentDate).toISOString() },
        paymentDate:        dayjs(paymentDate).format('YYYY-MM-DD'),
        isPartialPayment:   isPartial,
        paymentCenter:     centerId || null,
        paymentCenterName: centerName || 'All',
        refNo,
        lastAbstractBalance: abstractBalance,
        printSlip,
        paymentMode,
        bankLedgerId:   paymentMode !== 'Cash' ? bankLedgerId : null,
        bankLedgerName: paymentMode !== 'Cash' ? bankLedgerName : '',
      };

      const res = editingId
        ? await producerPaymentAPI.update(editingId, payload)
        : await producerPaymentAPI.create(payload);

      if (res?.success) {
        notifications.show({
          title: 'Success',
          message: editingId ? 'Payment updated' : 'Payment saved',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        resetDetailsForm();
        loadPayments();
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: err?.message || 'Failed to save payment', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Edit ───────────────────────────────────────────────────────────────────
  const handleEdit = (payment) => {
    setEditingId(payment._id);
    setProducerIdInput(payment.producerNumber || '');
    setSelectedFarmer({
      _id:          payment.farmerId?._id || payment.farmerId,
      farmerNumber: payment.producerNumber || '',
      name:         payment.producerName || '',
    });
    setRefNo(payment.refNo || '');
    setAbstractBalance(payment.lastAbstractBalance || 0);
    setAmountPaid(payment.amountPaid || '');
    setPaymentMode(payment.paymentMode || 'Cash');
    setBankLedgerId(payment.bankLedgerId || null);
    setBankLedgerName(payment.bankLedgerName || '');
    setPrintSlip(payment.printSlip || false);
    setBankTransferPaid(false);
  };

  // ─── Delete (permanent) ─────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this payment? This cannot be undone.')) return;
    try {
      const res = await producerPaymentAPI.delete(id);
      if (res?.success) {
        notifications.show({ title: 'Deleted', message: 'Payment has been permanently deleted', color: 'red' });
        loadPayments();
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: err?.message || 'Failed to delete payment', color: 'red' });
    }
  };

  // ─── Reset form ─────────────────────────────────────────────────────────────
  const resetDetailsForm = () => {
    setProducerIdInput('');
    setRefNo('');
    setAbstractBalance(0);
    setAmountPaid('');
    setPaymentMode('Cash');
    setBankLedgerId(null);
    setBankLedgerName('');
    setPrintSlip(false);
    setSelectedFarmer(null);
    setEditingId(null);
    setBankTransferPaid(false);
    setAlreadyPaidCash(false);
    setCashPaymentInfo(null);
  };

  // ─── Print handlers (react-to-print v3: contentRef instead of content) ─────
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Payment to Producer',
    pageStyle: PRINT_STYLE,
  });

  const handlePrintDetailed = useReactToPrint({
    contentRef: detailPrintRef,
    documentTitle: 'Payment to Producer - Detailed',
    pageStyle: DETAIL_PRINT_STYLE,
  });

  const handlePrintVoucher = useReactToPrint({
    contentRef: voucherPrintRef,
    documentTitle: 'Payment Voucher',
    pageStyle: VOUCHER_PRINT_STYLE,
  });

  const triggerVoucherPrint = (pmt) => {
    setVoucherData(pmt);
    setTimeout(() => handlePrintVoucher(), 100);
  };

  // ─── Sheet total (current page) ─────────────────────────────────────────────
  const sheetTotal = payments
    .filter((p) => p.status !== 'Cancelled')
    .reduce((sum, p) => sum + (p.amountPaid || 0), 0);

  const cycleSelectData = cycles.map(c => ({
    value: `${dayjs(c.fromDate).format('YYYY-MM-DD')}|${dayjs(c.toDate).format('YYYY-MM-DD')}`,
    label: c.label,
  }));

  const isBankMode = paymentMode !== 'Cash';

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <Container fluid px="md" py="sm">
      <style>{PRINT_STYLE}</style>

      {/* Hidden voucher print area */}
      <Box
        ref={voucherPrintRef}
        id="ptp-voucher-area"
        style={{ position: 'absolute', top: -9999, left: -9999, width: 480 }}
      >
        {voucherData && (
          <Box p="lg" style={{ border: '1px solid #333', fontFamily: 'serif' }}>
            <Title order={3} ta="center" mb={4}>PAYMENT VOUCHER</Title>
            <Text ta="center" size="xs" mb="sm">Payment to Producer</Text>
            <Divider mb="sm" />
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                <tr><td style={{ padding: '4px 0', width: '45%', fontWeight: 600 }}>Payment No</td><td>{voucherData.paymentNumber || '-'}</td></tr>
                <tr><td style={{ padding: '4px 0', fontWeight: 600 }}>Date</td><td>{fmtDate(voucherData.paymentDate)}</td></tr>
                <tr><td style={{ padding: '4px 0', fontWeight: 600 }}>Producer No</td><td>{voucherData.producerNumber || '-'}</td></tr>
                <tr><td style={{ padding: '4px 0', fontWeight: 600 }}>Producer Name</td><td>{voucherData.producerName || '-'}</td></tr>
                <tr><td style={{ padding: '4px 0', fontWeight: 600 }}>Cycle</td><td>{voucherData.processingPeriod ? `${fmtDate(voucherData.processingPeriod.fromDate)} – ${fmtDate(voucherData.processingPeriod.toDate)}` : '-'}</td></tr>
                <tr><td style={{ padding: '4px 0', fontWeight: 600 }}>Center</td><td>{voucherData.paymentCenterName || 'All'}</td></tr>
                <tr><td style={{ padding: '4px 0', fontWeight: 600 }}>Payment Mode</td><td>{voucherData.paymentMode || 'Cash'}</td></tr>
                {voucherData.bankLedgerName && (
                  <tr><td style={{ padding: '4px 0', fontWeight: 600 }}>Bank Ledger</td><td>{voucherData.bankLedgerName}</td></tr>
                )}
                {voucherData.refNo && (
                  <tr><td style={{ padding: '4px 0', fontWeight: 600 }}>Ref No</td><td>{voucherData.refNo}</td></tr>
                )}
                <tr><td style={{ padding: '4px 0', fontWeight: 600 }}>Abstract Balance</td><td>₹ {fmt(voucherData.lastAbstractBalance)}</td></tr>
              </tbody>
            </table>
            <Divider my="sm" />
            <Group justify="space-between">
              <Text fw={700} size="sm">Amount Paid</Text>
              <Text fw={800} size="lg">₹ {fmt(voucherData.amountPaid)}</Text>
            </Group>
            <Divider my="sm" />
            <Group justify="space-between" mt="xl">
              <Text size="xs" c="dimmed">Receiver's Signature</Text>
              <Text size="xs" c="dimmed">Authorised Signatory</Text>
            </Group>
          </Box>
        )}
      </Box>

      {/* Hidden detailed print area */}
      <Box
        ref={detailPrintRef}
        id="ptp-detail-area"
        style={{ position: 'absolute', top: -9999, left: -9999, width: 1100 }}
      >
        <Box mb="sm">
          <Title order={4} ta="center">Payment to Producer — Detailed Report</Title>
          <Text ta="center" size="xs">
            Cycle: {selectedCycle?.label || '-'} &nbsp;|&nbsp; Center: {centerName || 'All'}
          </Text>
          <Divider my="xs" />
        </Box>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ background: '#f1f3f5' }}>
              <th style={{ border: '1px solid #ccc', padding: '5px 6px' }}>Sl.No</th>
              <th style={{ border: '1px solid #ccc', padding: '5px 6px' }}>Pro.No</th>
              <th style={{ border: '1px solid #ccc', padding: '5px 6px' }}>Name</th>
              <th style={{ border: '1px solid #ccc', padding: '5px 6px' }}>Ref No</th>
              <th style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'right' }}>Abs.Balance</th>
              <th style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'right' }}>Amt Paid</th>
              <th style={{ border: '1px solid #ccc', padding: '5px 6px' }}>Mode</th>
              <th style={{ border: '1px solid #ccc', padding: '5px 6px' }}>Bank Ledger</th>
              <th style={{ border: '1px solid #ccc', padding: '5px 6px' }}>Center</th>
              <th style={{ border: '1px solid #ccc', padding: '5px 6px' }}>Date</th>
              <th style={{ border: '1px solid #ccc', padding: '5px 6px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((pmt, idx) => (
              <tr key={pmt._id} style={{ textDecoration: pmt.status === 'Cancelled' ? 'line-through' : 'none', color: pmt.status === 'Cancelled' ? '#adb5bd' : 'inherit' }}>
                <td style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'center' }}>{(page - 1) * limit + idx + 1}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px 6px' }}>{pmt.producerNumber || '-'}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px 6px' }}>{pmt.producerName || '-'}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px 6px' }}>{pmt.refNo || '-'}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'right' }}>₹ {fmt(pmt.lastAbstractBalance)}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'right' }}>₹ {fmt(pmt.amountPaid)}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px 6px' }}>{pmt.paymentMode || '-'}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px 6px' }}>{pmt.bankLedgerName || '-'}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px 6px' }}>{pmt.paymentCenterName || 'All'}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px 6px' }}>{fmtDate(pmt.paymentDate)}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px 6px' }}>{pmt.status || 'Active'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f8f9fa', fontWeight: 700 }}>
              <td colSpan={5} style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'right' }}>Total (this page):</td>
              <td style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'right' }}>₹ {fmt(sheetTotal)}</td>
              <td colSpan={5} style={{ border: '1px solid #ccc', padding: '5px 6px' }}></td>
            </tr>
            <tr style={{ background: '#e9ecef', fontWeight: 700 }}>
              <td colSpan={5} style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'right' }}>Grand Total:</td>
              <td style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'right' }}>₹ {fmt(grandTotal)}</td>
              <td colSpan={5} style={{ border: '1px solid #ccc', padding: '5px 6px' }}></td>
            </tr>
          </tfoot>
        </table>
      </Box>

      <Grid gutter="md">
        {/* ══ LEFT COLUMN ══════════════════════════════════════════════════════ */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
            {/* ── Card 1: Period setup ─────────────────────────────────────── */}
            <Card withBorder shadow="sm" radius="md" p="md">
              <Group gap="xs" mb="sm">
                <IconCash size={20} color="#228be6" />
                <Title order={5} c="blue" fw={700}>
                  Payment to Producer
                </Title>
              </Group>

              <Stack gap="sm">
                {/* Payment type selector */}
                <Radio.Group
                  value={paymentType}
                  onChange={(val) => {
                    setPaymentType(val);
                    setPeriodConfirmed(false);
                    resetDetailsForm();
                  }}
                  label="Payment Type"
                >
                  <Group mt={6} gap="lg">
                    <Radio value="Settlement" label="Settlement" color="blue" />
                    <Radio value="Partial"    label="Partial Payment" color="orange" />
                  </Group>
                </Radio.Group>

                {/* Date */}
                <DatePickerInput
                  label="Payment Date"
                  placeholder="Select payment date"
                  value={paymentDate}
                  onChange={setPaymentDate}
                  clearable={false}
                  required
                />

                {/* Payment Cycle — hidden in Partial mode */}
                {!isPartial && (
                  <Select
                    label="Payment Cycle"
                    placeholder="Select cycle..."
                    data={cycleSelectData}
                    value={selectedCycle
                      ? `${dayjs(selectedCycle.fromDate).format('YYYY-MM-DD')}|${dayjs(selectedCycle.toDate).format('YYYY-MM-DD')}`
                      : null}
                    onChange={(val) => {
                      if (!val) { setSelectedCycle(null); setPeriodConfirmed(false); localStorage.removeItem('ptp_lastCycleKey'); return; }
                      const [from, to] = val.split('|');
                      const found = cycles.find(c =>
                        dayjs(c.fromDate).format('YYYY-MM-DD') === from &&
                        dayjs(c.toDate).format('YYYY-MM-DD') === to
                      );
                      setSelectedCycle(found ? { fromDate: new Date(found.fromDate), toDate: new Date(found.toDate), label: found.label } : null);
                      localStorage.setItem('ptp_lastCycleKey', val);
                      setPeriodConfirmed(false);
                      resetDetailsForm();
                    }}
                    clearable
                    searchable
                    nothingFoundMessage="No saved cycles found"
                  />
                )}

                <Select
                  label="Payment Center"
                  placeholder="All Centers"
                  data={centers}
                  value={centerId}
                  onChange={(val, option) => {
                    setCenterId(val);
                    setCenterName(option?.label || 'All');
                    setPeriodConfirmed(false);
                    if (val) {
                      localStorage.setItem('ptp_lastCenterId', val);
                      localStorage.setItem('ptp_lastCenterName', option?.label || 'All');
                    } else {
                      localStorage.removeItem('ptp_lastCenterId');
                      localStorage.removeItem('ptp_lastCenterName');
                    }
                  }}
                  clearable
                  searchable
                />

                <Group justify="flex-start" mt="xs">
                  <Button color="blue" onClick={handleOK}>
                    OK
                  </Button>
                  <Button variant="outline" color="red" onClick={handleCancel}>
                    Cancel
                  </Button>
                </Group>
              </Stack>
            </Card>

            {/* ── Card 2: Payment Details form ─────────────────────────────── */}
            <Card withBorder shadow="sm" radius="md" p="md">
              <Title order={5} fw={600} mb="sm" c={formActive ? 'dark' : 'dimmed'}>
                Payment Details
                {isPartial && (
                  <Badge ml="xs" color="orange" variant="light" size="sm">Partial</Badge>
                )}
              </Title>

              <Stack gap="sm" style={{ opacity: formActive ? 1 : 0.4, pointerEvents: formActive ? 'auto' : 'none' }}>
                {/* Auto-filled context info */}
                {formActive && (
                  <Paper p="xs" bg={isPartial ? 'orange.0' : 'blue.0'} radius="sm">
                    {isPartial ? (
                      <Text size="xs" c="orange.8" fw={500}>
                        Partial Payment — no cycle restriction
                      </Text>
                    ) : (
                      <>
                        <Text size="xs" c="blue.8" fw={500}>
                          Cycle: {selectedCycle?.label || '-'}
                        </Text>
                        <Text size="xs" c="blue.7">
                          Center: {centerName || 'All'}
                        </Text>
                      </>
                    )}
                  </Paper>
                )}

                <Checkbox
                  label="Display Last 5 Days Payments"
                  checked={last5Days}
                  onChange={(e) => {
                    setLast5Days(e.currentTarget.checked);
                    setPage(1);
                  }}
                />

                <Box pos="relative">
                  <TextInput
                    ref={producerIdRef}
                    label="Producer ID"
                    placeholder="Enter Producer ID and press Enter / Tab"
                    value={producerIdInput}
                    onChange={(e) => {
                      setProducerIdInput(e.currentTarget.value);
                      setSelectedFarmer(null);
                      setBankTransferPaid(false);
                      setAbstractBalance(0);
                      setAmountPaid('');
                    }}
                    onBlur={() => {
                      // Skip if Enter/Tab already triggered the fetch
                      if (keydownFetchedRef.current) {
                        keydownFetchedRef.current = false;
                        return;
                      }
                      fetchProducerBalance();
                    }}
                    onKeyDown={handleProducerIdKeyDown}
                    rightSection={balanceLoading ? <Loader size="xs" /> : null}
                  />
                  {selectedFarmer && !bankTransferPaid && (
                    <Text size="xs" c="teal" mt={2}>
                      <IconUser size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {selectedFarmer.name}
                      {selectedFarmer.bankName ? ` — ${selectedFarmer.bankName}` : ''}
                    </Text>
                  )}
                  {bankTransferPaid && (
                    <Alert
                      mt={4}
                      p="xs"
                      color="orange"
                      icon={<IconBuildingBank size={14} />}
                    >
                      <Text size="xs" fw={600}>Already paid by Bank Transfer for this cycle</Text>
                    </Alert>
                  )}
                  {alreadyPaidCash && !bankTransferPaid && (
                    <Alert
                      mt={4}
                      p="xs"
                      color="orange"
                      icon={<IconCash size={14} />}
                    >
                      <Text size="xs" fw={600}>
                        Already paid in this cycle
                        {cashPaymentInfo?.paymentDate && ` on ${dayjs(cashPaymentInfo.paymentDate).format('DD/MM/YYYY')}`}
                        {cashPaymentInfo?.amountPaid != null && ` — ₹ ${fmt(cashPaymentInfo.amountPaid)}`}
                        {cashPaymentInfo?.refNo && `, Ref ${cashPaymentInfo.refNo}`}
                      </Text>
                    </Alert>
                  )}
                </Box>

                <NumberInput
                  label="Last Abstract Balance"
                  value={abstractBalance}
                  readOnly
                  decimalScale={2}
                  prefix="₹ "
                  styles={{ input: { backgroundColor: '#f8f9fa', color: '#495057', cursor: 'default' } }}
                />

                <Box ref={amountPaidWrapRef}>
                  <NumberInput
                    label="Amount Paid"
                    placeholder="0.00"
                    value={amountPaid}
                    onChange={setAmountPaid}
                    onKeyDown={handleAmountPaidKeyDown}
                    min={0}
                    decimalScale={2}
                    prefix="₹ "
                    // Settlement mode: always read-only (amount is auto-filled from abstract balance)
                    readOnly={!isPartial}
                    disabled={!isPartial && (bankTransferPaid || (alreadyPaidCash && !editingId))}
                    styles={!isPartial ? { input: { backgroundColor: '#f8f9fa', color: '#495057', cursor: 'default' } } : undefined}
                  />
                </Box>

                <Select
                  label="Payment Mode"
                  data={['Cash', 'Bank', 'Cheque', 'UPI', 'NEFT', 'RTGS']}
                  value={paymentMode}
                  onChange={(val) => {
                    setPaymentMode(val || 'Cash');
                    if (val === 'Cash') {
                      setBankLedgerId(null);
                      setBankLedgerName('');
                    }
                  }}
                  disabled={!isPartial && (bankTransferPaid || (alreadyPaidCash && !editingId))}
                />

                {/* Bank Ledger — shown for non-cash modes */}
                {isBankMode && (
                  <Select
                    label="Bank Ledger"
                    placeholder="Select bank ledger..."
                    data={bankLedgers}
                    value={bankLedgerId}
                    onChange={(val, option) => {
                      setBankLedgerId(val);
                      setBankLedgerName(option?.label || '');
                    }}
                    required
                    searchable
                    nothingFoundMessage="No bank ledgers found"
                    disabled={!isPartial && (bankTransferPaid || (alreadyPaidCash && !editingId))}
                    leftSection={<IconBuildingBank size={14} />}
                  />
                )}

                <TextInput
                  label="Ref No"
                  placeholder="Reference number (optional)"
                  value={refNo}
                  onChange={(e) => setRefNo(e.currentTarget.value)}
                />

                <Checkbox
                  label="Print Slip"
                  checked={printSlip}
                  onChange={(e) => setPrintSlip(e.currentTarget.checked)}
                />

                <Group justify="flex-start" mt="xs">
                  <Button
                    ref={saveButtonRef}
                    color={isPartial ? 'orange' : 'blue'}
                    loading={saving}
                    onClick={handleSave}
                    disabled={!isPartial && (bankTransferPaid || (alreadyPaidCash && !editingId))}
                  >
                    Save
                  </Button>
                  <Button variant="outline" onClick={resetDetailsForm}>
                    Cancel
                  </Button>
                </Group>
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>

        {/* ══ RIGHT COLUMN ═════════════════════════════════════════════════════ */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card withBorder shadow="sm" radius="md" p="md" h="100%">
            {/* Header */}
            <Group justify="space-between" mb="sm">
              <Group gap="xs">
                <Title order={5} fw={600}>
                  Payment Details
                </Title>
                <Badge color="blue" variant="filled" size="sm">
                  {totalCount}
                </Badge>
                {selectedCycle && (
                  <Badge color="teal" variant="light" size="sm">
                    {selectedCycle.label}
                  </Badge>
                )}
              </Group>
              <Group gap="xs" className="no-print">
                <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={() => { loadPayments(); loadBankTransferRows(); }}>
                  Refresh
                </Button>
                <Button size="xs" variant="light" color="teal" leftSection={<IconPrinter size={14} />} onClick={handlePrint}>
                  Print
                </Button>
                <Button size="xs" variant="light" color="indigo" leftSection={<IconListDetails size={14} />} onClick={handlePrintDetailed}>
                  Detailed Print
                </Button>
              </Group>
            </Group>

            {/* Search + entries row */}
            <Group justify="space-between" mb="sm" className="no-print">
              <Group gap="xs">
                <Text size="sm">Show</Text>
                <Select
                  size="xs"
                  data={['10', '25', '50', '100']}
                  value={String(limit)}
                  onChange={(val) => { setLimit(parseInt(val)); setPage(1); }}
                  w={70}
                />
                <Text size="sm">entries</Text>
              </Group>
              <TextInput
                size="xs"
                placeholder="Search producer / ref..."
                leftSection={<IconSearch size={13} />}
                value={tableSearch}
                onChange={(e) => { setTableSearch(e.currentTarget.value); setPage(1); }}
                w={220}
              />
            </Group>

            {/* Table */}
            <Box ref={printRef} id="ptp-print-area">
              {/* Print header (hidden on screen) */}
              <Box style={{ display: 'none' }} className="print-only" mb="sm">
                <Title order={4} ta="center">Payment to Producer</Title>
                <Text ta="center" size="sm">
                  Cycle: {selectedCycle?.label || '-'}
                </Text>
                <Divider my="xs" />
              </Box>

              {tableLoading ? (
                <Center py="xl"><Loader size="md" /></Center>
              ) : payments.length === 0 && bankTransferRows.length === 0 ? (
                <Center py="xl">
                  <Text c="dimmed" size="sm">
                    {formActive
                      ? 'No payments found for the selected filters.'
                      : isPartial
                        ? 'Click OK to start recording partial payments.'
                        : 'Select a payment cycle and click OK to load payments.'}
                  </Text>
                </Center>
              ) : (
                <Table striped highlightOnHover withTableBorder withColumnBorders verticalSpacing="xs" fz="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th ta="center" w={40}>Sl.No</Table.Th>
                      <Table.Th>Pro.No</Table.Th>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Ref No</Table.Th>
                      <Table.Th ta="right">Amt Paid</Table.Th>
                      <Table.Th>Mode</Table.Th>
                      <Table.Th>Date</Table.Th>
                      <Table.Th ta="center" className="no-print">Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {payments.map((pmt, idx) => (
                      <Table.Tr
                        key={pmt._id}
                        style={{
                          textDecoration: pmt.status === 'Cancelled' ? 'line-through' : 'none',
                          color: pmt.status === 'Cancelled' ? '#adb5bd' : 'inherit',
                        }}
                      >
                        <Table.Td ta="center">{(page - 1) * limit + idx + 1}</Table.Td>
                        <Table.Td>{pmt.producerNumber || pmt.farmerId?.farmerNumber || '-'}</Table.Td>
                        <Table.Td>{pmt.producerName || pmt.farmerId?.personalDetails?.name || '-'}</Table.Td>
                        <Table.Td>{pmt.refNo || '-'}</Table.Td>
                        <Table.Td ta="right">₹ {fmt(pmt.amountPaid)}</Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            <Text size="sm">{pmt.paymentMode || '-'}</Text>
                            {pmt.isPartialPayment && (
                              <Badge size="xs" color="orange" variant="light">Partial</Badge>
                            )}
                          </Group>
                          {pmt.bankLedgerName && (
                            <Text size="xs" c="dimmed">{pmt.bankLedgerName}</Text>
                          )}
                        </Table.Td>
                        <Table.Td>{fmtDate(pmt.paymentDate)}</Table.Td>
                        <Table.Td ta="center" className="no-print">
                          {pmt.status !== 'Cancelled' && (
                            <Group gap={4} justify="center">
                              <ActionIcon size="sm" variant="subtle" color="blue" title="Edit" onClick={() => handleEdit(pmt)}>
                                <IconEdit size={14} />
                              </ActionIcon>
                              <ActionIcon size="sm" variant="subtle" color="teal" title="Print Voucher" onClick={() => triggerVoucherPrint(pmt)}>
                                <IconFileText size={14} />
                              </ActionIcon>
                              <ActionIcon size="sm" variant="subtle" color="red" title="Delete" onClick={() => handleDelete(pmt._id)}>
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Group>
                          )}
                          {pmt.status === 'Cancelled' && (
                            <Badge size="xs" color="red" variant="light">Cancelled</Badge>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}

                    {/* ── Bank Transfer rows ─────────────────────────────── */}
                    {bankTransferRows.length > 0 && (
                      <Table.Tr style={{ background: 'var(--mantine-color-indigo-0)' }}>
                        <Table.Td colSpan={8} py={4}>
                          <Group gap="xs">
                            <IconBuildingBank size={13} color="var(--mantine-color-indigo-6)" />
                            <Text size="xs" fw={700} c="indigo.7">
                              Already Paid via Bank Transfer ({bankTransferRows.length} farmer{bankTransferRows.length > 1 ? 's' : ''})
                            </Text>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    )}
                    {bankTransferRows.map((row, idx) => (
                      <Table.Tr key={row._id} style={{ background: 'var(--mantine-color-indigo-0)', color: '#495057' }}>
                        <Table.Td ta="center">
                          <Text size="xs" c="dimmed">{idx + 1}</Text>
                        </Table.Td>
                        <Table.Td><Text size="xs">{row.producerNumber || '-'}</Text></Table.Td>
                        <Table.Td><Text size="xs">{row.producerName || '-'}</Text></Table.Td>
                        <Table.Td><Text size="xs" c="dimmed">—</Text></Table.Td>
                        <Table.Td ta="right"><Text size="xs">₹ {fmt(row.amountPaid)}</Text></Table.Td>
                        <Table.Td>
                          <Badge size="xs" color="indigo" variant="filled" leftSection={<IconBuildingBank size={9} />}>
                            Bank Transfer
                          </Badge>
                        </Table.Td>
                        <Table.Td><Text size="xs">{fmtDate(row.paymentDate)}</Text></Table.Td>
                        <Table.Td ta="center">
                          <Badge size="xs" color="green" variant="light">Paid</Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Box>

            {/* Pagination */}
            {totalPages > 1 && (
              <Group justify="center" mt="md" className="no-print">
                <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
              </Group>
            )}

            {/* Summary rows */}
            <Divider mt="md" mb="xs" />
            <Paper px="md" py="xs" bg="teal.0" radius="sm">
              <Group justify="space-between">
                <Text fw={600} size="sm" c="teal.8">Amount Total in Sheet:</Text>
                <Text fw={700} size="sm" c="teal.8">₹ {fmt(sheetTotal)}</Text>
              </Group>
              <Group justify="space-between" mt={4}>
                <Text fw={600} size="sm" c="teal.9">Grand Total:</Text>
                <Text fw={700} size="sm" c="teal.9">₹ {fmt(grandTotal)}</Text>
              </Group>
            </Paper>
          </Card>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
