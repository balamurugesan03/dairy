  import { useState, useEffect, useRef, useCallback } from 'react';
import { message } from '../../utils/toast';
import {
  farmerAPI, paymentAPI, farmerLedgerAPI, ledgerAPI, paymentRegisterAPI,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  Container, Card, Paper, Title, Text, Group, Stack,
  Select, NumberInput, TextInput, Button, Table, Badge,
  Loader, Box, Grid, Alert, ScrollArea, ActionIcon, Pagination,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconCurrencyRupee, IconCalendar, IconAlertCircle,
  IconRefresh, IconDeviceFloppy, IconSearch, IconX,
} from '@tabler/icons-react';
import dayjs from 'dayjs';

const PAYMENT_MODES = [
  { value: 'Cash',  label: 'Cash' },
  { value: 'Bank',  label: 'Bank Transfer' },
  { value: 'UPI',   label: 'UPI' },
];

const fmt = (v) =>
  (parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Default cycle: 1st → last day of current month
const defaultFrom = () => dayjs().startOf('month').toDate();
const defaultTo   = () => dayjs().endOf('month').toDate();

const IndividualMilkPayment = () => {
  const { canWrite } = useAuth();

  // ── Active cycle ────────────────────────────────────────────────────────────
  const [activeCycle,    setActiveCycle]    = useState(null);
  const [cycleLoading,   setCycleLoading]   = useState(true);

  // ── Cycle date range (used for milk auto-fetch) ──────────────────────────────
  const [cycleFrom, setCycleFrom] = useState(defaultFrom());
  const [cycleTo,   setCycleTo]   = useState(defaultTo());

  // ── Entry form ──────────────────────────────────────────────────────────────
  const [paymentDate,    setPaymentDate]    = useState(new Date());
  const [farmerNumber,   setFarmerNumber]   = useState('');
  const [farmerLoading,  setFarmerLoading]  = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [balancesLoading,setBalancesLoading]= useState(false);
  const [milkLoading,    setMilkLoading]    = useState(false);

  // Outstanding balances (from cycle end date)
  const [outstanding,    setOutstanding]    = useState({ cfAdvance: 0, loanAdvance: 0, cashAdvance: 0 });
  const [previousBalance,setPreviousBalance]= useState(0);

  // Welfare
  const [welfareEligible,setWelfareEligible]= useState(false);
  const [welfareMax,     setWelfareMax]     = useState(0);

  // Deductions / payment
  const [milkAmount,     setMilkAmount]     = useState('');
  const [welfareAmt,     setWelfareAmt]     = useState(0);
  const [cfAmt,          setCfAmt]          = useState(0);
  const [loanAmt,        setLoanAmt]        = useState(0);
  const [cashAmt,        setCashAmt]        = useState(0);
  const [paymentMode,    setPaymentMode]    = useState('Cash');
  const [bankLedgerId,   setBankLedgerId]   = useState('');
  const [paidAmount,     setPaidAmount]     = useState('');
  const [remarks,        setRemarks]        = useState('');

  // Bank ledgers + save
  const [bankLedgers,    setBankLedgers]    = useState([]);
  const [saving,         setSaving]         = useState(false);

  // ── List ────────────────────────────────────────────────────────────────────
  const [payments,       setPayments]       = useState([]);
  const [paymentsLoading,setPaymentsLoading]= useState(false);
  const [page,           setPage]           = useState(1);
  const [totalPages,     setTotalPages]     = useState(1);

  // ── Refs for keyboard navigation ────────────────────────────────────────────
  const dateRef        = useRef(null);
  const farmerRef      = useRef(null);
  const milkRef        = useRef(null);
  const welfareRef     = useRef(null);
  const cfRef          = useRef(null);
  const loanRef        = useRef(null);
  const cashRef        = useRef(null);
  const payModeRef     = useRef(null);
  const bankRef        = useRef(null);
  const paidRef        = useRef(null);
  const remarksRef     = useRef(null);
  const saveRef        = useRef(null);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const totalDeductions =
    (parseFloat(welfareAmt) || 0) +
    (parseFloat(cfAmt)      || 0) +
    (parseFloat(loanAmt)    || 0) +
    (parseFloat(cashAmt)    || 0);

  const balance = (parseFloat(milkAmount) || 0) - totalDeductions + (previousBalance || 0);
  const isBankMode = paymentMode !== 'Cash';
  const canSave = selectedFarmer && (parseFloat(milkAmount) || 0) > 0 && balance >= 0 && (!isBankMode || bankLedgerId);

  // ── Focus helper ─────────────────────────────────────────────────────────────
  const focusInput = (ref) => {
    setTimeout(() => {
      const el = ref?.current;
      if (!el) return;
      const inp = el.querySelector?.('input') || el;
      inp?.focus?.();
      inp?.select?.();
    }, 60);
  };

  const advance = (ref) => (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (e.key === 'Enter') e.preventDefault();
      focusInput(ref);
    }
  };

  // ── On mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadActiveCycle();
    fetchPayments(1);
    fetchBankLedgers();
  }, []); // eslint-disable-line

  const loadActiveCycle = async () => {
    setCycleLoading(true);
    try {
      const res = await paymentRegisterAPI.getLatestProducers();
      const cycle = res?.data || null;
      setActiveCycle(cycle);
      if (cycle?.fromDate) setCycleFrom(new Date(cycle.fromDate));
      if (cycle?.toDate)   setCycleTo(new Date(cycle.toDate));
    } catch (err) {
      console.error('Failed to load active cycle:', err);
    } finally {
      setCycleLoading(false);
    }
  };

  const fetchBankLedgers = async () => {
    try {
      const res = await ledgerAPI.getAll({ ledgerType: 'Bank', status: 'Active' });
      setBankLedgers((res?.data || []).map(l => ({ value: l._id, label: l.ledgerName })));
    } catch {}
  };

  const fetchPayments = async (p = 1) => {
    setPaymentsLoading(true);
    try {
      const res = await paymentAPI.getAll({
        page: p, limit: 15, sortBy: 'paymentDate', sortOrder: 'desc',
      });
      setPayments(res?.data || []);
      setTotalPages(res?.pagination?.pages || 1);
    } catch {}
    finally { setPaymentsLoading(false); }
  };

  // ── Auto-fetch milk amount from MilkCollection for cycle dates ───────────────
  const fetchMilkAmount = useCallback(async (farmerId) => {
    if (!farmerId || !cycleFrom || !cycleTo) return;
    setMilkLoading(true);
    try {
      const res = await paymentRegisterAPI.getFarmerMilkValue({
        farmerId,
        fromDate: dayjs(cycleFrom).format('YYYY-MM-DD'),
        toDate:   dayjs(cycleTo).format('YYYY-MM-DD'),
      });
      const amt = res?.data?.totalAmount || 0;
      setMilkAmount(amt > 0 ? amt : '');
    } catch (err) {
      console.error('Failed to fetch milk amount:', err);
    } finally {
      setMilkLoading(false);
    }
  }, [cycleFrom, cycleTo]);

  // ── Farmer lookup by number ──────────────────────────────────────────────────
  const handleFarmerKeyDown = async (e) => {
    if (e.key !== 'Enter' && e.key !== 'Tab') return;
    if (e.key === 'Enter') e.preventDefault();
    const num = farmerNumber.trim();
    if (!num) return;

    setFarmerLoading(true);
    try {
      const res = await farmerAPI.search(num);
      const list = res?.data || [];
      const match =
        list.find(f => f.farmerNumber?.toLowerCase() === num.toLowerCase()) ||
        list.find(f => f.farmerNumber?.toLowerCase().includes(num.toLowerCase())) ||
        list[0];

      if (!match) {
        message.error(`Farmer "${num}" not found`);
        return;
      }
      setSelectedFarmer(match);
      await Promise.all([
        loadFarmerBalances(match._id),
        fetchMilkAmount(match._id),
      ]);
    } catch {
      message.error('Failed to find farmer');
    } finally {
      setFarmerLoading(false);
    }
  };

  // ── Load farmer outstanding amounts as of cycle end date ─────────────────────
  const loadFarmerBalances = useCallback(async (farmerId) => {
    setBalancesLoading(true);
    const cycleEnd = cycleTo ? new Date(cycleTo) : new Date();

    try {
      const [outRes, welfRes, histRes] = await Promise.allSettled([
        farmerLedgerAPI.getOutstandingByType(farmerId, { asOfDate: cycleEnd.toISOString() }),
        farmerLedgerAPI.checkWelfare(
          farmerId,
          new Date().toISOString(),
          cycleFrom ? new Date(cycleFrom).toISOString() : undefined,
          cycleEnd.toISOString(),
        ),
        paymentAPI.getFarmerHistory(farmerId, { limit: 1 }),
      ]);

      // Outstanding
      const out  = outRes.status === 'fulfilled' ? outRes.value?.data || {} : {};
      const cf   = out['CF Advance']?.amount   || 0;
      const loan = out['Loan Advance']?.amount || 0;
      const cash = out['Cash Advance']?.amount || 0;
      setOutstanding({ cfAdvance: cf, loanAdvance: loan, cashAdvance: cash });
      setCfAmt(cf);
      setLoanAmt(loan);
      setCashAmt(cash);

      // Welfare
      let welMax = 0;
      let welEligible = false;
      if (welfRes.status === 'fulfilled') {
        const wd = welfRes.value?.data;
        welEligible = wd?.eligibleForDeduction || false;
        welMax = welEligible ? (wd?.amount || 0) : 0;
      }
      setWelfareEligible(welEligible);
      setWelfareMax(welMax);
      setWelfareAmt(welMax);

      // Previous balance (last unpaid amount)
      let prevBal = 0;
      if (histRes.status === 'fulfilled') {
        const hist = histRes.value?.data || [];
        prevBal = Math.max(0, hist[0]?.balanceAmount || 0);
      }
      setPreviousBalance(prevBal);

      focusInput(milkRef);
    } catch (err) {
      console.error('Failed to load farmer balances:', err);
    } finally {
      setBalancesLoading(false);
    }
  }, [cycleFrom, cycleTo]); // eslint-disable-line

  // After milk amount entered, navigate based on outstanding
  const handleMilkKeyDown = (e) => {
    if (e.key !== 'Enter' && e.key !== 'Tab') return;
    if (e.key === 'Enter') e.preventDefault();

    const hasOutstanding =
      (welfareEligible && welfareMax > 0) ||
      outstanding.cfAdvance > 0 ||
      outstanding.loanAdvance > 0 ||
      outstanding.cashAdvance > 0;

    if (hasOutstanding) {
      if (welfareEligible && welfareMax > 0) focusInput(welfareRef);
      else if (outstanding.cfAdvance > 0)    focusInput(cfRef);
      else if (outstanding.loanAdvance > 0)  focusInput(loanRef);
      else                                   focusInput(cashRef);
    } else {
      focusInput(payModeRef);
    }
  };

  const handleWelfareKeyDown = (e) => {
    if (e.key !== 'Enter' && e.key !== 'Tab') return;
    if (e.key === 'Enter') e.preventDefault();
    if (outstanding.cfAdvance > 0)    focusInput(cfRef);
    else if (outstanding.loanAdvance > 0) focusInput(loanRef);
    else if (outstanding.cashAdvance > 0) focusInput(cashRef);
    else focusInput(payModeRef);
  };

  const handleCfKeyDown = (e) => {
    if (e.key !== 'Enter' && e.key !== 'Tab') return;
    if (e.key === 'Enter') e.preventDefault();
    if (outstanding.loanAdvance > 0) focusInput(loanRef);
    else if (outstanding.cashAdvance > 0) focusInput(cashRef);
    else focusInput(payModeRef);
  };

  const handleLoanKeyDown = (e) => {
    if (e.key !== 'Enter' && e.key !== 'Tab') return;
    if (e.key === 'Enter') e.preventDefault();
    if (outstanding.cashAdvance > 0) focusInput(cashRef);
    else focusInput(payModeRef);
  };

  // ── Reset ────────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFarmerNumber('');
    setSelectedFarmer(null);
    setOutstanding({ cfAdvance: 0, loanAdvance: 0, cashAdvance: 0 });
    setPreviousBalance(0);
    setWelfareEligible(false);
    setWelfareMax(0);
    setMilkAmount('');
    setWelfareAmt(0);
    setCfAmt(0);
    setLoanAmt(0);
    setCashAmt(0);
    setPaymentMode('Cash');
    setBankLedgerId('');
    setPaidAmount('');
    setRemarks('');
    focusInput(farmerRef);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedFarmer)                        return message.error('Please select a farmer');
    if (!(parseFloat(milkAmount) > 0))          return message.error('Please enter milk amount');
    if (balance < 0)                            return message.error('Balance is negative. Reduce deductions before saving.');
    if (isBankMode && !bankLedgerId)            return message.error('Please select a bank ledger');
    if ((parseFloat(cfAmt)   || 0) > outstanding.cfAdvance   + 0.005) return message.error('CF deduction exceeds outstanding');
    if ((parseFloat(loanAmt) || 0) > outstanding.loanAdvance + 0.005) return message.error('Loan deduction exceeds outstanding');
    if ((parseFloat(cashAmt) || 0) > outstanding.cashAdvance + 0.005) return message.error('Cash deduction exceeds outstanding');

    const paidAmt = parseFloat(paidAmount) > 0 ? parseFloat(paidAmount) : balance;

    const deductions = [];
    if ((parseFloat(welfareAmt) || 0) > 0)
      deductions.push({ type: 'Welfare Recovery', amount: parseFloat(welfareAmt), description: 'Monthly welfare recovery' });
    if ((parseFloat(cfAmt) || 0) > 0)
      deductions.push({ type: 'CF Recovery',      amount: parseFloat(cfAmt),      description: 'CF Advance recovery' });
    if ((parseFloat(loanAmt) || 0) > 0)
      deductions.push({ type: 'Loan Recovery',    amount: parseFloat(loanAmt),    description: 'Loan Advance recovery' });
    if ((parseFloat(cashAmt) || 0) > 0)
      deductions.push({ type: 'Cash Recovery',    amount: parseFloat(cashAmt),    description: 'Cash Advance recovery' });

    const payload = {
      farmerId:        selectedFarmer._id,
      paymentDate,
      milkAmount:      parseFloat(milkAmount),
      advanceAmount:   (parseFloat(cfAmt) || 0) + (parseFloat(loanAmt) || 0) + (parseFloat(cashAmt) || 0),
      deductions,
      totalDeduction:  totalDeductions,
      previousBalance: previousBalance || 0,
      netPayable:      balance,
      paymentMode,
      paidAmount:      paidAmt,
      balanceAmount:   Math.max(0, balance - paidAmt),
      remarks,
      paymentSource:   'Individual',
      paymentPeriod:   { fromDate: cycleFrom, toDate: cycleTo },
      ...(isBankMode  ? { bankLedgerId } : {}),
    };

    setSaving(true);
    try {
      await paymentAPI.create(payload);
      message.success('Payment saved and ledgers auto-posted');
      resetForm();
      fetchPayments(1);
    } catch (err) {
      message.error(err.message || 'Failed to save payment');
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (d) => (d ? dayjs(d).format('DD/MM/YYYY') : '-');

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Container size="xl" py="md">
      <Stack gap="md">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <Group justify="space-between" align="flex-start">
          <Box>
            <Title order={2}>Individual Milk Payment</Title>
            {cycleLoading ? (
              <Loader size="xs" mt={4} />
            ) : activeCycle ? (
              <Group gap="xs" mt={4}>
                <Text size="sm" c="dimmed">Active Cycle:</Text>
                <Badge color="teal" size="md" variant="light">
                  {fmtDate(activeCycle.fromDate)} – {fmtDate(activeCycle.toDate)}
                </Badge>
                {activeCycle.status && (
                  <Badge color="blue" size="sm" variant="outline">{activeCycle.status}</Badge>
                )}
              </Group>
            ) : (
              <Text size="sm" c="orange" mt={4}>No payment register found — using manual date range below</Text>
            )}
          </Box>
        </Group>

        {/* ── Entry Card ──────────────────────────────────────────────────── */}
        <Card withBorder radius="md" p="md">
          <Stack gap="sm">

            {/* Row 1: Payment Date + Cycle Range + Farmer Number */}
            <Grid align="flex-end" gutter="sm">
              <Grid.Col span={{ base: 12, sm: 4, md: 2 }}>
                <div ref={dateRef}>
                  <DatePickerInput
                    label="Payment Date"
                    value={paymentDate}
                    onChange={setPaymentDate}
                    clearable={false}
                    leftSection={<IconCalendar size={16} />}
                    onKeyDown={advance(farmerRef)}
                  />
                </div>
              </Grid.Col>

              <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
                <DatePickerInput
                  label="Cycle From"
                  value={cycleFrom}
                  onChange={setCycleFrom}
                  clearable={false}
                  disabled={!!activeCycle}
                  leftSection={<IconCalendar size={16} />}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
                <DatePickerInput
                  label="Cycle To"
                  value={cycleTo}
                  onChange={setCycleTo}
                  clearable={false}
                  disabled={!!activeCycle}
                  leftSection={<IconCalendar size={16} />}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
                <div ref={farmerRef}>
                  <TextInput
                    label="Farmer Number"
                    placeholder="Enter number → press Enter"
                    value={farmerNumber}
                    onChange={(e) => setFarmerNumber(e.target.value)}
                    onKeyDown={handleFarmerKeyDown}
                    rightSection={farmerLoading ? <Loader size="xs" /> : <IconSearch size={16} />}
                  />
                </div>
              </Grid.Col>

              {selectedFarmer && (
                <Grid.Col span={{ base: 12, sm: 12, md: 3 }}>
                  <Paper withBorder p="xs" radius="md" bg="gray.0">
                    <Group gap="lg" wrap="nowrap">
                      <Box>
                        <Text size="xs" c="dimmed">Name</Text>
                        <Text size="sm" fw={600}>{selectedFarmer.personalDetails?.name}</Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">Village</Text>
                        <Text size="sm">{selectedFarmer.address?.village || '—'}</Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">Phone</Text>
                        <Text size="sm">{selectedFarmer.personalDetails?.phone || '—'}</Text>
                      </Box>
                      <ActionIcon variant="subtle" color="red" size="sm" ml="auto" onClick={resetForm}>
                        <IconX size={14} />
                      </ActionIcon>
                    </Group>
                  </Paper>
                </Grid.Col>
              )}
            </Grid>

            {/* ── After farmer selected ────────────────────────────────── */}
            {selectedFarmer && (
              <>
                {(balancesLoading || milkLoading) ? (
                  <Group gap="xs">
                    <Loader size="xs" />
                    <Text size="sm" c="dimmed">
                      {milkLoading ? 'Fetching milk amount…' : 'Loading outstanding balances…'}
                    </Text>
                  </Group>
                ) : (
                  <Paper withBorder p="xs" radius="md" bg="blue.0">
                    <Group gap="xl">
                      <Box>
                        <Text size="xs" c="dimmed">CF Outstanding</Text>
                        <Text size="sm" fw={600} c={outstanding.cfAdvance > 0 ? 'orange.8' : 'dimmed'}>
                          ₹{fmt(outstanding.cfAdvance)}
                        </Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">Loan Outstanding</Text>
                        <Text size="sm" fw={600} c={outstanding.loanAdvance > 0 ? 'red.7' : 'dimmed'}>
                          ₹{fmt(outstanding.loanAdvance)}
                        </Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">Cash Outstanding</Text>
                        <Text size="sm" fw={600} c={outstanding.cashAdvance > 0 ? 'blue.7' : 'dimmed'}>
                          ₹{fmt(outstanding.cashAdvance)}
                        </Text>
                      </Box>
                      {previousBalance > 0 && (
                        <Box>
                          <Text size="xs" c="dimmed">Prev. Balance</Text>
                          <Text size="sm" fw={600} c="grape.7">₹{fmt(previousBalance)}</Text>
                        </Box>
                      )}
                      {welfareEligible && (
                        <Badge color="grape" size="sm" variant="light">Welfare eligible ₹{welfareMax}</Badge>
                      )}
                    </Group>
                  </Paper>
                )}

                {/* Milk Amount + Deductions */}
                <Grid align="flex-end" gutter="xs">
                  {/* Milk Amount — auto-filled, still editable */}
                  <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
                    <div ref={milkRef}>
                      <NumberInput
                        label={milkLoading ? 'Milk Amount (₹) …' : 'Milk Amount (₹)'}
                        value={milkAmount}
                        onChange={setMilkAmount}
                        onKeyDown={handleMilkKeyDown}
                        placeholder="0.00"
                        min={0}
                        decimalScale={2}
                        thousandSeparator=","
                        leftSection={milkLoading ? <Loader size="xs" /> : <IconCurrencyRupee size={14} />}
                        required
                      />
                    </div>
                  </Grid.Col>

                  {/* Welfare */}
                  <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
                    <div ref={welfareRef}>
                      <NumberInput
                        label={welfareEligible ? `Welfare (₹${welfareMax})` : 'Welfare (done)'}
                        value={welfareAmt}
                        onChange={setWelfareAmt}
                        onKeyDown={handleWelfareKeyDown}
                        placeholder="0.00"
                        min={0}
                        max={welfareMax}
                        decimalScale={2}
                        disabled={!welfareEligible}
                        styles={welfareAmt > 0 ? { input: { borderColor: 'var(--mantine-color-grape-5)' } } : {}}
                      />
                    </div>
                  </Grid.Col>

                  {/* CF Recovery */}
                  <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
                    <div ref={cfRef}>
                      <NumberInput
                        label={`CF Rec. (max ₹${fmt(outstanding.cfAdvance)})`}
                        value={cfAmt}
                        onChange={setCfAmt}
                        onKeyDown={handleCfKeyDown}
                        placeholder="0.00"
                        min={0}
                        max={outstanding.cfAdvance}
                        decimalScale={2}
                        disabled={outstanding.cfAdvance === 0}
                        styles={cfAmt > 0 ? { input: { borderColor: 'var(--mantine-color-orange-5)' } } : {}}
                      />
                    </div>
                  </Grid.Col>

                  {/* Loan Recovery */}
                  <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
                    <div ref={loanRef}>
                      <NumberInput
                        label={`Loan Rec. (max ₹${fmt(outstanding.loanAdvance)})`}
                        value={loanAmt}
                        onChange={setLoanAmt}
                        onKeyDown={handleLoanKeyDown}
                        placeholder="0.00"
                        min={0}
                        max={outstanding.loanAdvance}
                        decimalScale={2}
                        disabled={outstanding.loanAdvance === 0}
                        styles={loanAmt > 0 ? { input: { borderColor: 'var(--mantine-color-red-5)' } } : {}}
                      />
                    </div>
                  </Grid.Col>

                  {/* Cash Recovery */}
                  <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
                    <div ref={cashRef}>
                      <NumberInput
                        label={`Cash Rec. (max ₹${fmt(outstanding.cashAdvance)})`}
                        value={cashAmt}
                        onChange={setCashAmt}
                        onKeyDown={advance(payModeRef)}
                        placeholder="0.00"
                        min={0}
                        max={outstanding.cashAdvance}
                        decimalScale={2}
                        disabled={outstanding.cashAdvance === 0}
                      />
                    </div>
                  </Grid.Col>
                </Grid>

                {/* Balance Summary Bar */}
                <Paper
                  withBorder p="sm" radius="md"
                  bg={balance < 0 ? 'red.0' : balance === 0 ? 'yellow.0' : 'green.0'}
                >
                  <Group gap="lg" justify="center" wrap="wrap">
                    <Box ta="center">
                      <Text size="xs" c="dimmed">Milk Amount</Text>
                      <Text size="sm" fw={600}>₹{fmt(milkAmount)}</Text>
                    </Box>
                    <Text c="dimmed" fw={600}>−</Text>
                    <Box ta="center">
                      <Text size="xs" c="dimmed">Total Deductions</Text>
                      <Text size="sm" fw={600} c="red">₹{fmt(totalDeductions)}</Text>
                    </Box>
                    {(previousBalance || 0) > 0 && (
                      <>
                        <Text c="dimmed" fw={600}>+</Text>
                        <Box ta="center">
                          <Text size="xs" c="dimmed">Prev. Balance</Text>
                          <Text size="sm" fw={600} c="grape">₹{fmt(previousBalance)}</Text>
                        </Box>
                      </>
                    )}
                    <Text c="dimmed" fw={600}>=</Text>
                    <Box ta="center">
                      <Text size="xs" c="dimmed">Balance</Text>
                      <Text size="lg" fw={700} c={balance < 0 ? 'red' : balance === 0 ? 'orange' : 'green'}>
                        ₹{fmt(balance)}
                      </Text>
                    </Box>
                  </Group>
                  {balance < 0 && (
                    <Alert color="red" mt="xs" p="xs" icon={<IconAlertCircle size={14} />}>
                      Balance is negative — reduce deductions before saving.
                    </Alert>
                  )}
                </Paper>

                {/* Payment Mode + Paid Amount + Remarks + Save */}
                <Grid align="flex-end" gutter="xs">
                  <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
                    <div ref={payModeRef}>
                      <Select
                        label="Payment Mode"
                        value={paymentMode}
                        onChange={(v) => { setPaymentMode(v); setBankLedgerId(''); }}
                        data={PAYMENT_MODES}
                        onKeyDown={advance(isBankMode ? bankRef : paidRef)}
                      />
                    </div>
                  </Grid.Col>

                  {isBankMode && (
                    <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
                      <div ref={bankRef}>
                        <Select
                          label="Bank Ledger"
                          placeholder="Select bank account"
                          value={bankLedgerId}
                          onChange={setBankLedgerId}
                          data={bankLedgers}
                          searchable
                          required
                          onKeyDown={advance(paidRef)}
                          rightSection={bankLedgers.length === 0 ? <Loader size="xs" /> : null}
                        />
                      </div>
                    </Grid.Col>
                  )}

                  <Grid.Col span={{ base: 6, sm: 4, md: 2 }}>
                    <div ref={paidRef}>
                      <NumberInput
                        label="Paid Amount (₹)"
                        value={paidAmount}
                        onChange={setPaidAmount}
                        placeholder={balance > 0 ? fmt(balance) : '0.00'}
                        min={0}
                        decimalScale={2}
                        thousandSeparator=","
                        leftSection={<IconCurrencyRupee size={14} />}
                        onKeyDown={advance(remarksRef)}
                      />
                    </div>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
                    <div ref={remarksRef}>
                      <TextInput
                        label="Remarks"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Optional"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); saveRef.current?.click(); }
                        }}
                      />
                    </div>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, sm: 4, md: 2 }}>
                    <Group gap="xs" grow>
                      <Button variant="light" color="gray" onClick={resetForm}>
                        Reset
                      </Button>
                      <Button
                        ref={saveRef}
                        leftSection={<IconDeviceFloppy size={16} />}
                        onClick={handleSave}
                        loading={saving}
                        disabled={!canSave || !canWrite('payments')}
                        color={balance < 0 ? 'red' : 'blue'}
                      >
                        Save
                      </Button>
                    </Group>
                  </Grid.Col>
                </Grid>
              </>
            )}
          </Stack>
        </Card>

        {/* ── Recent Payments ──────────────────────────────────────────────── */}
        <Card withBorder shadow="sm" radius="md" p="md">
          <Group justify="space-between" mb="sm">
            <Title order={4}>Recent Individual Payments</Title>
            <ActionIcon variant="subtle" onClick={() => fetchPayments(page)} title="Refresh">
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>

          {paymentsLoading ? (
            <Box py="xl" ta="center"><Loader size="md" /></Box>
          ) : payments.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">No payments recorded yet</Text>
          ) : (
            <>
              <ScrollArea>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Farmer</Table.Th>
                      <Table.Th>Milk Amt</Table.Th>
                      <Table.Th>Deductions</Table.Th>
                      <Table.Th>Balance</Table.Th>
                      <Table.Th>Paid</Table.Th>
                      <Table.Th>Mode</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {payments.map((p) => (
                      <Table.Tr key={p._id}>
                        <Table.Td>{fmtDate(p.paymentDate)}</Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>{p.farmerId?.farmerNumber || '—'}</Text>
                          <Text size="xs" c="dimmed">{p.farmerId?.personalDetails?.name || '—'}</Text>
                        </Table.Td>
                        <Table.Td>₹{fmt(p.milkAmount)}</Table.Td>
                        <Table.Td>
                          <Text c="red" size="sm">−₹{fmt(p.totalDeduction)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={600} c={(p.netPayable || 0) >= 0 ? 'green' : 'red'}>
                            ₹{fmt(p.netPayable)}
                          </Text>
                        </Table.Td>
                        <Table.Td>₹{fmt(p.paidAmount)}</Table.Td>
                        <Table.Td>
                          <Badge variant="light" size="sm">{p.paymentMode}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            variant="light" size="sm"
                            color={
                              p.status === 'Paid'    ? 'green' :
                              p.status === 'Partial' ? 'orange' : 'gray'
                            }
                          >
                            {p.status}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>

              {totalPages > 1 && (
                <Group justify="center" mt="md">
                  <Pagination
                    total={totalPages}
                    value={page}
                    onChange={(p) => { setPage(p); fetchPayments(p); }}
                  />
                </Group>
              )}
            </>
          )}
        </Card>

      </Stack>
    </Container>
  );
};

export default IndividualMilkPayment;
