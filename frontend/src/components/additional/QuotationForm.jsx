import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container, Title, Text, Button, Group, Stack, Paper, Grid, TextInput,
  Select, Textarea, NumberInput, ActionIcon, Table, Badge, Divider, Box,
  Loader, Center
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconTrash, IconArrowLeft, IconDeviceFloppy, IconRefresh
} from '@tabler/icons-react';
import { quotationAPI, customerAPI, businessItemAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import dayjs from 'dayjs';

// ── Default Terms & Conditions ────────────────────────────────
const DEFAULT_TERMS = `1. This quotation is valid for 30 days from the date of issue.
2. Prices are subject to change without prior notice after validity period.
3. Payment terms: 50% advance, balance before delivery.
4. Delivery within 7–10 working days after confirmation.
5. Goods once sold will not be taken back unless defective.
6. All disputes are subject to local jurisdiction only.`;

// ── Helpers ───────────────────────────────────────────────────
const emptyItem = () => ({
  _key: Math.random(),
  itemId: '', itemCode: '', itemName: '', hsnCode: '',
  quantity: 1, unit: '', mrp: 0, rate: 0,
  discountPercent: 0, discountAmount: 0,
  taxableAmount: 0, gstPercent: 0,
  cgstPercent: 0, cgstAmount: 0,
  sgstPercent: 0, sgstAmount: 0,
  igstPercent: 0, igstAmount: 0,
  totalAmount: 0
});

const calcItem = (item) => {
  const qty = Number(item.quantity) || 0;
  const rate = Number(item.rate) || 0;
  const discP = Number(item.discountPercent) || 0;
  const gstP = Number(item.gstPercent) || 0;

  const gross = qty * rate;
  const discAmt = +(gross * discP / 100).toFixed(2);
  const taxable = +(gross - discAmt).toFixed(2);
  const cgstP = +(gstP / 2).toFixed(2);
  const sgstP = +(gstP / 2).toFixed(2);
  const cgstAmt = +(taxable * cgstP / 100).toFixed(2);
  const sgstAmt = +(taxable * sgstP / 100).toFixed(2);
  const total = +(taxable + cgstAmt + sgstAmt).toFixed(2);

  return {
    ...item,
    discountAmount: discAmt,
    taxableAmount: taxable,
    cgstPercent: cgstP, cgstAmount: cgstAmt,
    sgstPercent: sgstP, sgstAmount: sgstAmt,
    igstPercent: 0, igstAmount: 0,
    totalAmount: total
  };
};

const calcTotals = (items, billDiscP = 0) => {
  const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const grossAmount = items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate) || 0), 0);
  const itemDiscount = items.reduce((s, i) => s + (Number(i.discountAmount) || 0), 0);
  const taxableRaw = items.reduce((s, i) => s + (Number(i.taxableAmount) || 0), 0);
  const billDiscAmt = +(taxableRaw * Number(billDiscP) / 100).toFixed(2);
  const afterBillDisc = taxableRaw - billDiscAmt;
  const totalCgst = items.reduce((s, i) => s + (Number(i.cgstAmount) || 0), 0);
  const totalSgst = items.reduce((s, i) => s + (Number(i.sgstAmount) || 0), 0);
  const totalIgst = items.reduce((s, i) => s + (Number(i.igstAmount) || 0), 0);
  const totalGst = totalCgst + totalSgst + totalIgst;
  const raw = afterBillDisc + totalGst;
  const roundOff = +(Math.round(raw) - raw).toFixed(2);
  const grandTotal = +(raw + roundOff).toFixed(2);

  return {
    totalQty,
    grossAmount: +grossAmount.toFixed(2),
    itemDiscount: +itemDiscount.toFixed(2),
    billDiscount: billDiscAmt,
    taxableAmount: +afterBillDisc.toFixed(2),
    totalCgst: +totalCgst.toFixed(2),
    totalSgst: +totalSgst.toFixed(2),
    totalIgst: +totalIgst.toFixed(2),
    totalGst: +totalGst.toFixed(2),
    roundOff,
    grandTotal
  };
};

// ── Component ─────────────────────────────────────────────────
const QuotationForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { selectedCompany } = useCompany();

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);

  // ── Form state ──────────────────────────────────────────────
  const [quotationDate, setQuotationDate] = useState(new Date());
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 30 * 86400000));
  const [status, setStatus] = useState('Draft');

  // Customer
  const [partyId, setPartyId] = useState('');
  const [partyName, setPartyName] = useState('');
  const [partyOrganization, setPartyOrganization] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyEmail, setPartyEmail] = useState('');
  const [partyAddress, setPartyAddress] = useState('');
  const [partyGstin, setPartyGstin] = useState('');
  const [partyState, setPartyState] = useState('');

  // Items
  const [lineItems, setLineItems] = useState([emptyItem()]);
  const [billDiscP, setBillDiscP] = useState(0);

  // Notes & Terms
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(DEFAULT_TERMS);

  const totals = calcTotals(lineItems, billDiscP);

  // ── Load data ───────────────────────────────────────────────
  useEffect(() => {
    loadMasterData();
    if (isEdit) loadQuotation();
  }, [id]);

  const loadMasterData = async () => {
    try {
      const [custRes, itemRes] = await Promise.all([
        customerAPI.getAll({ limit: 500 }),
        businessItemAPI.getAll({ limit: 500, status: 'Active' })
      ]);
      setCustomers(Array.isArray(custRes?.data) ? custRes.data : custRes?.data?.data || []);
      setItems(Array.isArray(itemRes?.data) ? itemRes.data : itemRes?.data?.data || []);
    } catch { /* silent */ }
  };

  const loadQuotation = async () => {
    setLoading(true);
    try {
      const res = await quotationAPI.getById(id);
      const q = res?.data || res;
      setQuotationDate(q.quotationDate ? new Date(q.quotationDate) : new Date());
      setValidUntil(q.validUntil ? new Date(q.validUntil) : new Date(Date.now() + 30 * 86400000));
      setStatus(q.status || 'Draft');
      setPartyId(q.partyId?._id || q.partyId || '');
      setPartyName(q.partyName || '');
      setPartyOrganization(q.partyOrganization || '');
      setPartyPhone(q.partyPhone || '');
      setPartyEmail(q.partyEmail || '');
      setPartyAddress(q.partyAddress || '');
      setPartyGstin(q.partyGstin || '');
      setPartyState(q.partyState || '');
      setLineItems(q.items?.map(i => ({ ...i, _key: Math.random() })) || [emptyItem()]);
      setBillDiscP(q.billDiscountPercent || 0);
      setNotes(q.notes || '');
      setTerms(q.termsAndConditions || DEFAULT_TERMS);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers ────────────────────────────────────────────────
  const handleCustomerSelect = (customerId) => {
    setPartyId(customerId);
    const cust = customers.find(c => c._id === customerId);
    if (cust) {
      setPartyName(cust.name || cust.customerName || '');
      setPartyOrganization(cust.organization || cust.companyName || '');
      setPartyPhone(cust.phone || cust.mobileNumber || '');
      setPartyEmail(cust.email || '');
      setPartyAddress(cust.address || '');
      setPartyGstin(cust.gstin || '');
      setPartyState(cust.state || '');
    }
  };

  const handleItemSelect = (idx, itemId) => {
    const item = items.find(i => i._id === itemId);
    if (!item) return;
    updateLine(idx, {
      itemId: item._id,
      itemCode: item.itemCode || '',
      itemName: item.itemName,
      hsnCode: item.hsnCode || '',
      unit: item.measurement || item.unit || '',
      mrp: item.mrp || 0,
      rate: item.salesRate || item.mrp || 0,
      gstPercent: item.gstPercent || 0
    });
  };

  const updateLine = (idx, patch) => {
    setLineItems(prev => {
      const updated = [...prev];
      const merged = calcItem({ ...updated[idx], ...patch });
      updated[idx] = merged;
      return updated;
    });
  };

  const addLine = () => setLineItems(prev => [...prev, emptyItem()]);
  const removeLine = (idx) => setLineItems(prev => prev.filter((_, i) => i !== idx));

  // Reset entire form
  const handleReset = () => {
    setQuotationDate(new Date());
    setValidUntil(new Date(Date.now() + 30 * 86400000));
    setStatus('Draft');
    setPartyId('');
    setPartyName('');
    setPartyOrganization('');
    setPartyPhone('');
    setPartyEmail('');
    setPartyAddress('');
    setPartyGstin('');
    setPartyState('');
    setLineItems([emptyItem()]);
    setBillDiscP(0);
    setNotes('');
    setTerms(DEFAULT_TERMS);
  };

  // Save → then open print template
  const handleSave = async () => {
    if (!partyName.trim()) {
      notifications.show({ title: 'Validation', message: 'Customer name is required', color: 'yellow' });
      return;
    }
    if (lineItems.every(i => !i.itemName)) {
      notifications.show({ title: 'Validation', message: 'Add at least one item', color: 'yellow' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        quotationDate, validUntil, status,
        partyId: partyId || undefined,
        partyName, partyOrganization, partyPhone, partyEmail,
        partyAddress, partyGstin, partyState,
        items: lineItems.filter(i => i.itemName),
        billDiscountPercent: billDiscP,
        notes,
        termsAndConditions: terms,
        ...totals
      };

      let savedId = id;
      if (isEdit) {
        await quotationAPI.update(id, payload);
        notifications.show({ title: 'Updated', message: 'Quotation updated successfully', color: 'green' });
      } else {
        const res = await quotationAPI.create(payload);
        savedId = res?.data?._id || res?._id;
        notifications.show({ title: 'Saved', message: 'Quotation created successfully', color: 'green' });
      }

      // Navigate to professional print/preview template
      navigate(`/quotations/print/${savedId}`);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Center h={300}><Loader /></Center>;

  // ── Render ─────────────────────────────────────────────────
  return (
    <Container size="xl" py="md">
      {/* ── Header ── */}
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={() => navigate('/quotations')}>
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Box>
            <Title order={2} fw={700}>{isEdit ? 'Edit Quotation' : 'New Quotation / Estimate'}</Title>
            <Text size="sm" c="dimmed">Fill the form and click Save to generate the invoice</Text>
          </Box>
        </Group>
        <Group>
          <Button variant="default" leftSection={<IconRefresh size={15} />} onClick={handleReset}>
            Reset
          </Button>
          <Button variant="default" onClick={() => navigate('/quotations')}>Cancel</Button>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            loading={saving}
            onClick={handleSave}
          >
            {isEdit ? 'Update & Preview' : 'Save & Preview'}
          </Button>
        </Group>
      </Group>

      {/* ── Company Auto-fill Banner ── */}
      {selectedCompany && (
        <Paper withBorder radius="md" p="sm" mb="md" bg="blue.0">
          <Group gap="xs">
            <Text size="sm" fw={600} c="blue.8">From:</Text>
            <Text size="sm" fw={700}>{selectedCompany.companyName}</Text>
            {selectedCompany.address && <Text size="sm" c="dimmed">· {selectedCompany.address}</Text>}
            {selectedCompany.phone && <Text size="sm" c="dimmed">· {selectedCompany.phone}</Text>}
          </Group>
        </Paper>
      )}

      <Grid gutter="md">
        {/* ── Left Column ── */}
        <Grid.Col span={{ base: 12, md: 8 }}>

          {/* Quotation Details */}
          <Paper withBorder radius="md" p="md" mb="md">
            <Text fw={600} mb="sm">Quotation Details</Text>
            <Grid>
              <Grid.Col span={4}>
                <DatePickerInput
                  label="Quotation Date"
                  value={quotationDate}
                  onChange={setQuotationDate}
                  required
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <DatePickerInput
                  label="Valid Until"
                  value={validUntil}
                  onChange={setValidUntil}
                  required
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <Select
                  label="Status"
                  value={status}
                  onChange={setStatus}
                  data={['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired']}
                />
              </Grid.Col>
            </Grid>
          </Paper>

          {/* Customer Details */}
          <Paper withBorder radius="md" p="md" mb="md">
            <Text fw={600} mb="sm">Customer Details</Text>
            <Grid>
              <Grid.Col span={6}>
                <Select
                  label="Select Existing Customer"
                  placeholder="Search customer..."
                  searchable
                  clearable
                  data={customers.map(c => ({ value: c._id, label: c.name || c.customerName || '' }))}
                  value={partyId}
                  onChange={handleCustomerSelect}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Customer Name"
                  value={partyName}
                  onChange={e => setPartyName(e.target.value)}
                  required
                  placeholder="Enter customer name"
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Organization / Company"
                  value={partyOrganization}
                  onChange={e => setPartyOrganization(e.target.value)}
                  placeholder="Customer's company name"
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <TextInput
                  label="Phone"
                  value={partyPhone}
                  onChange={e => setPartyPhone(e.target.value)}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <TextInput
                  label="Email"
                  value={partyEmail}
                  onChange={e => setPartyEmail(e.target.value)}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="GSTIN"
                  value={partyGstin}
                  onChange={e => setPartyGstin(e.target.value.toUpperCase())}
                />
              </Grid.Col>
              <Grid.Col span={5}>
                <Textarea
                  label="Address"
                  value={partyAddress}
                  onChange={e => setPartyAddress(e.target.value)}
                  rows={2}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <TextInput
                  label="State"
                  value={partyState}
                  onChange={e => setPartyState(e.target.value)}
                />
              </Grid.Col>
            </Grid>
          </Paper>

          {/* Items */}
          <Paper withBorder radius="md" p="md" mb="md">
            <Group justify="space-between" mb="sm">
              <Text fw={600}>Items</Text>
              <Button size="xs" leftSection={<IconPlus size={14} />} variant="light" onClick={addLine}>
                Add Item
              </Button>
            </Group>
            <Box style={{ overflowX: 'auto' }}>
              <Table striped highlightOnHover style={{ minWidth: 860 }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ minWidth: 180 }}>Item / Description</Table.Th>
                    <Table.Th style={{ width: 75 }}>HSN</Table.Th>
                    <Table.Th style={{ width: 75 }}>Qty</Table.Th>
                    <Table.Th style={{ width: 60 }}>Unit</Table.Th>
                    <Table.Th style={{ width: 95 }}>Unit Price (₹)</Table.Th>
                    <Table.Th style={{ width: 65 }}>Disc%</Table.Th>
                    <Table.Th style={{ width: 65 }}>Tax%</Table.Th>
                    <Table.Th style={{ width: 100, textAlign: 'right' }}>Total (₹)</Table.Th>
                    <Table.Th style={{ width: 36 }} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {lineItems.map((line, idx) => (
                    <Table.Tr key={line._key}>
                      <Table.Td>
                        <Select
                          placeholder="Select item"
                          searchable
                          clearable
                          data={items.map(i => ({ value: i._id, label: i.itemName }))}
                          value={line.itemId || null}
                          onChange={v => v && handleItemSelect(idx, v)}
                          size="xs"
                        />
                        {!line.itemId && (
                          <TextInput
                            size="xs"
                            mt={3}
                            placeholder="Or type product name"
                            value={line.itemName}
                            onChange={e => updateLine(idx, { itemName: e.target.value })}
                          />
                        )}
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          value={line.hsnCode}
                          onChange={e => updateLine(idx, { hsnCode: e.target.value })}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          value={line.quantity}
                          min={0}
                          decimalScale={3}
                          onChange={v => updateLine(idx, { quantity: v || 0 })}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          value={line.unit}
                          onChange={e => updateLine(idx, { unit: e.target.value })}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          value={line.rate}
                          min={0}
                          decimalScale={2}
                          prefix="₹"
                          onChange={v => updateLine(idx, { rate: v || 0 })}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          value={line.discountPercent}
                          min={0}
                          max={100}
                          decimalScale={2}
                          suffix="%"
                          onChange={v => updateLine(idx, { discountPercent: v || 0 })}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          value={line.gstPercent}
                          min={0}
                          decimalScale={2}
                          suffix="%"
                          onChange={v => updateLine(idx, { gstPercent: v || 0 })}
                        />
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" fw={700}>₹{line.totalAmount.toFixed(2)}</Text>
                        {line.discountAmount > 0 && (
                          <Text size="xs" c="dimmed" style={{ textDecoration: 'line-through' }}>
                            ₹{(line.quantity * line.rate).toFixed(2)}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          size="sm"
                          onClick={() => removeLine(idx)}
                          disabled={lineItems.length === 1}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          </Paper>

          {/* Notes & Terms */}
          <Grid>
            <Grid.Col span={6}>
              <Paper withBorder radius="md" p="md">
                <Textarea
                  label="Notes to Customer"
                  placeholder="Special instructions, delivery notes..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={4}
                />
              </Paper>
            </Grid.Col>
            <Grid.Col span={6}>
              <Paper withBorder radius="md" p="md">
                <Textarea
                  label="Terms & Conditions"
                  value={terms}
                  onChange={e => setTerms(e.target.value)}
                  rows={4}
                />
              </Paper>
            </Grid.Col>
          </Grid>
        </Grid.Col>

        {/* ── Right Column — Summary ── */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder radius="md" p="md" style={{ position: 'sticky', top: 20 }}>
            <Text fw={700} mb="md" size="lg">Summary</Text>
            <Stack gap={8}>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Gross Amount</Text>
                <Text size="sm" fw={500}>₹{totals.grossAmount.toFixed(2)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Item Discount</Text>
                <Text size="sm" c="red">- ₹{totals.itemDiscount.toFixed(2)}</Text>
              </Group>
              <Group justify="space-between" align="center">
                <Text size="sm" c="dimmed">Bill Discount</Text>
                <Group gap={6}>
                  <NumberInput
                    size="xs"
                    style={{ width: 70 }}
                    value={billDiscP}
                    min={0}
                    max={100}
                    decimalScale={2}
                    suffix="%"
                    onChange={v => setBillDiscP(v || 0)}
                  />
                  <Text size="sm" c="red">- ₹{totals.billDiscount.toFixed(2)}</Text>
                </Group>
              </Group>
              <Divider />
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Taxable Amount</Text>
                <Text size="sm">₹{totals.taxableAmount.toFixed(2)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">CGST</Text>
                <Text size="sm">₹{totals.totalCgst.toFixed(2)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">SGST</Text>
                <Text size="sm">₹{totals.totalSgst.toFixed(2)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Round Off</Text>
                <Text size="sm">₹{totals.roundOff.toFixed(2)}</Text>
              </Group>
              <Divider />
              <Group justify="space-between">
                <Text fw={700} size="lg">Grand Total</Text>
                <Text fw={800} size="xl" c="blue">₹{totals.grandTotal.toFixed(2)}</Text>
              </Group>

              {/* Item count */}
              <Badge variant="light" color="gray" size="sm">
                {lineItems.filter(i => i.itemName).length} item(s) · {totals.totalQty} qty
              </Badge>
            </Stack>

            <Divider my="md" />

            <Stack gap="xs">
              <Button
                fullWidth
                leftSection={<IconDeviceFloppy size={16} />}
                loading={saving}
                onClick={handleSave}
                size="md"
              >
                {isEdit ? 'Update & Preview Invoice' : 'Save & Preview Invoice'}
              </Button>
              <Button
                fullWidth
                variant="default"
                leftSection={<IconRefresh size={15} />}
                onClick={handleReset}
              >
                Reset Form
              </Button>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Container>
  );
};

export default QuotationForm;
