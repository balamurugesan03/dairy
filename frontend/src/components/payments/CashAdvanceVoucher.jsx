import { useState, useEffect, useRef, useCallback } from 'react';
import { message } from '../../utils/toast';
import { farmerAPI, advanceAPI, producerOpeningAPI } from '../../services/api';
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
  NumberInput,
  TextInput,
  Textarea,
  Button,
  Grid,
  Loader,
  Box,
  Divider,
  Alert,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
  Pagination,
  ThemeIcon,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconSearch,
  IconCalendar,
  IconCurrencyRupee,
  IconPrinter,
  IconDeviceFloppy,
  IconAlertCircle,
  IconRefresh,
  IconCash,
  IconX,
} from '@tabler/icons-react';

const PAGE_SIZE = 15;

const fmtAmt = (v) =>
  v != null ? `₹ ${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const CashAdvanceVoucher = () => {
  const { canWrite } = useAuth();
  const printRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [farmers, setFarmers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [savedVoucher, setSavedVoucher] = useState(null);

  const [formData, setFormData] = useState({
    farmerId: '',
    advanceDate: new Date(),
    advanceCategory: 'Cash Advance',
    advanceAmount: '',
    paymentMode: 'Cash',
    purpose: '',
    remarks: '',
  });

  const [balances, setBalances] = useState({
    openingBalance: 0,
    closingBalance: 0,
  });

  // Grid state
  const [advances, setAdvances]     = useState([]);
  const [gridLoading, setGridLoading] = useState(false);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // ── Fetch all advances for grid ──────────────────────────────────
  const fetchAdvances = useCallback(async (pg = 1) => {
    setGridLoading(true);
    try {
      const res = await advanceAPI.getAll({ page: pg, limit: PAGE_SIZE, advanceCategory: 'Cash Advance' });
      setAdvances(res.data || res.advances || []);
      setTotalPages(res.pagination?.pages || 1);
      setTotalRecords(res.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load advances:', err);
    } finally {
      setGridLoading(false);
    }
  }, []);

  useEffect(() => { searchFarmers(''); }, []);
  useEffect(() => { fetchAdvances(page); }, [page, fetchAdvances]);

  // Recalculate closing balance whenever amount or opening balance changes
  useEffect(() => {
    const amt = parseFloat(formData.advanceAmount) || 0;
    setBalances((prev) => ({ ...prev, closingBalance: prev.openingBalance + amt }));
  }, [formData.advanceAmount, balances.openingBalance]);

  const searchFarmers = async (query) => {
    try {
      setSearchLoading(true);
      let response;
      if (query && query.trim().length > 0) {
        response = await farmerAPI.search(query.trim());
      } else {
        response = await farmerAPI.getAll({ status: 'Active', limit: 50 });
      }
      setFarmers(response.data || []);
    } catch (error) {
      console.error('Failed to search farmers:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFarmerSelect = async (farmerId) => {
    const farmer = farmers.find((f) => f._id === farmerId);
    setSelectedFarmer(farmer || null);
    setFormData((prev) => ({ ...prev, farmerId: farmerId || '' }));

    if (!farmerId) {
      setBalances({ openingBalance: 0, closingBalance: 0 });
      return;
    }

    // Opening balance = Producer Opening cfAdvance + sum of all previous advances for this farmer
    try {
      const [openingRes, advancesRes] = await Promise.all([
        producerOpeningAPI.getByFarmer(farmerId).catch(() => null),
        advanceAPI.getFarmerAdvances(farmerId, { limit: 1000 }).catch(() => null),
      ]);

      const cfAdvance = Number(openingRes?.data?.cashAdvance || openingRes?.cashAdvance) || 0;

      const advancesList = advancesRes?.data || advancesRes?.advances || advancesRes || [];
      const previousAdvancesTotal = Array.isArray(advancesList)
        ? advancesList
            .filter((a) => a.status !== 'Cancelled')
            .reduce((sum, a) => sum + (Number(a.advanceAmount) || 0), 0)
        : 0;

      const opening = cfAdvance + previousAdvancesTotal;
      const amt = parseFloat(formData.advanceAmount) || 0;
      setBalances({ openingBalance: opening, closingBalance: opening + amt });
    } catch (err) {
      console.warn('Could not fetch opening balance:', err.message);
      setBalances({ openingBalance: 0, closingBalance: parseFloat(formData.advanceAmount) || 0 });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      farmerId: '',
      advanceDate: new Date(),
      advanceCategory: 'Cash Advance',
      advanceAmount: '',
      paymentMode: 'Cash',
      purpose: '',
      remarks: '',
    });
    setSelectedFarmer(null);
    setBalances({ openingBalance: 0, closingBalance: 0 });
    setSavedVoucher(null);
    setShowPrintPreview(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.farmerId) {
      message.error('Please select a farmer');
      return;
    }
    if (!formData.advanceAmount || formData.advanceAmount <= 0) {
      message.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        farmerId: formData.farmerId,
        advanceDate: formData.advanceDate,
        advanceType: 'Regular',
        advanceCategory: formData.advanceCategory,
        advanceAmount: parseFloat(formData.advanceAmount),
        balanceAmount: parseFloat(formData.advanceAmount),
        paymentMode: formData.paymentMode,
        purpose: formData.purpose,
        remarks: formData.remarks,
      };

      const response = await advanceAPI.create(payload);
      message.success('Cash advance created successfully');

      setSavedVoucher({
        ...response.data,
        farmer: selectedFarmer,
        openingBalance: balances.openingBalance,
        closingBalance: balances.closingBalance,
      });
      setShowPrintPreview(true);
      fetchAdvances(1);
      setPage(1);
    } catch (error) {
      message.error(error.message || 'Failed to create advance');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Cash Advance Voucher - ${savedVoucher?.advanceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
            .title { font-size: 18px; font-weight: bold; margin: 0; }
            .subtitle { font-size: 14px; color: #666; margin: 5px 0 0 0; }
            .voucher-no { font-size: 12px; margin-top: 5px; }
            .row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #ccc; }
            .label { color: #666; font-size: 12px; }
            .value { font-weight: 500; }
            .amount-section { background: #f5f5f5; padding: 10px; border-radius: 5px; margin: 15px 0; }
            .amount-row { display: flex; justify-content: space-between; padding: 5px 0; }
            .amount-row.total { font-size: 16px; font-weight: bold; border-top: 1px solid #333; margin-top: 5px; padding-top: 10px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
            .signature-box { text-align: center; width: 45%; }
            .signature-line { border-top: 1px solid #333; margin-top: 30px; padding-top: 5px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <p class="title">Dairy Society</p>
            <p class="subtitle">Cash Advance Voucher</p>
            <p class="voucher-no">No: ${savedVoucher?.advanceNumber}</p>
          </div>
          <div>
            <div class="row"><span class="label">Date:</span><span class="value">${new Date(savedVoucher?.advanceDate).toLocaleDateString('en-IN')}</span></div>
            <div class="row"><span class="label">Farmer ID:</span><span class="value">${savedVoucher?.farmer?.farmerNumber}</span></div>
            <div class="row"><span class="label">Farmer Name:</span><span class="value">${savedVoucher?.farmer?.personalDetails?.name}</span></div>
            <div class="row"><span class="label">Village:</span><span class="value">${savedVoucher?.farmer?.address?.village || '-'}</span></div>
            <div class="row"><span class="label">Payment Mode:</span><span class="value">${savedVoucher?.paymentMode}</span></div>
          </div>
          <div class="amount-section">
            <div class="amount-row"><span>Opening Balance:</span><span>₹${savedVoucher?.openingBalance?.toFixed(2)}</span></div>
            <div class="amount-row"><span>Amount Paid:</span><span>₹${savedVoucher?.advanceAmount?.toFixed(2)}</span></div>
            <div class="amount-row total"><span>Closing Balance:</span><span>₹${savedVoucher?.closingBalance?.toFixed(2)}</span></div>
          </div>
          ${savedVoucher?.purpose ? `<p><strong>Purpose:</strong> ${savedVoucher.purpose}</p>` : ''}
          <div class="signatures">
            <div class="signature-box"><div class="signature-line">Farmer Signature</div></div>
            <div class="signature-box"><div class="signature-line">Authorized Signature</div></div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const farmerOptions = farmers.map((f) => ({
    value: f._id,
    label: `${f.farmerNumber} - ${f.personalDetails?.name} (${f.personalDetails?.phone || 'No phone'})`,
  }));

  const advanceCategoryOptions = [
    { value: 'Cash Advance', label: 'Cash Advance' },
    { value: 'CF Advance', label: 'CF Advance (Cattle Feed)' },
    { value: 'Loan Advance', label: 'Loan Advance' },
  ];

  const paymentModeOptions = [
    { value: 'Cash', label: 'Cash' },
    { value: 'Bank', label: 'Bank Transfer' },
    { value: 'UPI', label: 'UPI' },
  ];

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount || 0);

  // ── Grid rows ────────────────────────────────────────────────────
  const gridRows = advances.map((adv, i) => (
    <Table.Tr key={adv._id}>
      <Table.Td c="dimmed" fz="xs">{(page - 1) * PAGE_SIZE + i + 1}</Table.Td>
      <Table.Td fz="sm">{fmtDate(adv.advanceDate)}</Table.Td>
      <Table.Td fz="sm" fw={600} c="blue.8">{adv.farmerNumber || adv.farmerId?.farmerNumber || '—'}</Table.Td>
      <Table.Td fz="sm">{adv.farmerName || adv.farmerId?.personalDetails?.name || '—'}</Table.Td>
      <Table.Td fz="sm">
        <Badge size="xs" variant="light" color={adv.advanceCategory === 'CF Advance' ? 'teal' : adv.advanceCategory === 'Loan Advance' ? 'orange' : 'blue'}>
          {adv.advanceCategory}
        </Badge>
      </Table.Td>
      <Table.Td fz="sm" ta="right" fw={600} c="blue.7">{fmtAmt(adv.advanceAmount)}</Table.Td>
      <Table.Td fz="sm" ta="right" c="orange.7">{fmtAmt(adv.balanceAmount)}</Table.Td>
      <Table.Td fz="sm">{adv.paymentMode || '—'}</Table.Td>
      <Table.Td fz="sm">
        <Badge size="xs" color={adv.status === 'Active' ? 'green' : adv.status === 'Cancelled' ? 'red' : 'gray'} variant="light">
          {adv.status || 'Active'}
        </Badge>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">

        {/* ── Entry Form + Balance Summary ── */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card withBorder shadow="sm" radius="md" p="lg">
              {showPrintPreview && savedVoucher ? (
                <Stack>
                  <Alert color="green" title="Voucher Created Successfully" icon={<IconAlertCircle />}>
                    Advance voucher <strong>{savedVoucher.advanceNumber}</strong> has been created.
                  </Alert>

                  <Paper ref={printRef} withBorder p="lg" radius="md">
                    <Stack gap="md">
                      <Box ta="center">
                        <Title order={3}>Dairy Society</Title>
                        <Text c="dimmed">Cash Advance Voucher</Text>
                        <Text fw={500}>No: {savedVoucher.advanceNumber}</Text>
                      </Box>
                      <Divider />
                      <Grid>
                        <Grid.Col span={6}>
                          <Text size="sm" c="dimmed">Date</Text>
                          <Text fw={500}>{new Date(savedVoucher.advanceDate).toLocaleDateString('en-IN')}</Text>
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <Text size="sm" c="dimmed">Farmer ID</Text>
                          <Text fw={500}>{savedVoucher.farmer?.farmerNumber}</Text>
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <Text size="sm" c="dimmed">Farmer Name</Text>
                          <Text fw={500}>{savedVoucher.farmer?.personalDetails?.name}</Text>
                        </Grid.Col>
                        <Grid.Col span={6}>
                          <Text size="sm" c="dimmed">Village</Text>
                          <Text fw={500}>{savedVoucher.farmer?.address?.village || '-'}</Text>
                        </Grid.Col>
                      </Grid>
                      <Paper withBorder p="md" radius="md" bg="gray.0">
                        <Stack gap="xs">
                          <Group justify="space-between">
                            <Text>Opening Balance:</Text>
                            <Text fw={500}>{formatCurrency(savedVoucher.openingBalance)}</Text>
                          </Group>
                          <Group justify="space-between">
                            <Text>Amount Paid:</Text>
                            <Text fw={600} c="blue">{formatCurrency(savedVoucher.advanceAmount)}</Text>
                          </Group>
                          <Divider />
                          <Group justify="space-between">
                            <Text fw={600}>Closing Balance:</Text>
                            <Text fw={700} c="orange" size="lg">{formatCurrency(savedVoucher.closingBalance)}</Text>
                          </Group>
                        </Stack>
                      </Paper>
                      {savedVoucher.purpose && (
                        <Box>
                          <Text size="sm" c="dimmed">Purpose</Text>
                          <Text>{savedVoucher.purpose}</Text>
                        </Box>
                      )}
                    </Stack>
                  </Paper>

                  <Group justify="center" mt="md">
                    <Button variant="light" onClick={resetForm}>New Voucher</Button>
                    <Button leftSection={<IconPrinter size={16} />} onClick={handlePrint}>Print Voucher</Button>
                  </Group>
                </Stack>
              ) : (
                <form onSubmit={handleSubmit}>
                  <Stack gap="md">
                    <Grid>
                      <Grid.Col span={6}>
                        <DatePickerInput
                          label="Date"
                          placeholder="Select date"
                          value={formData.advanceDate}
                          onChange={(value) => handleInputChange('advanceDate', value)}
                          leftSection={<IconCalendar size={16} />}
                          required
                          clearable={false}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Select
                          label="Advance Type"
                          value={formData.advanceCategory}
                          onChange={(value) => handleInputChange('advanceCategory', value)}
                          data={advanceCategoryOptions}
                          required
                        />
                      </Grid.Col>
                    </Grid>

                    <Select
                      label="Select Farmer"
                      placeholder="Search by farmer number, name, or phone"
                      value={formData.farmerId}
                      onChange={handleFarmerSelect}
                      data={farmerOptions}
                      searchable
                      clearable
                      onSearchChange={searchFarmers}
                      nothingFoundMessage={searchLoading ? 'Searching...' : 'No farmers found'}
                      required
                      leftSection={<IconSearch size={16} />}
                      rightSection={searchLoading ? <Loader size="xs" /> : null}
                    />

                    {selectedFarmer && (
                      <Paper withBorder p="sm" radius="md" bg="gray.0">
                        <Grid>
                          <Grid.Col span={4}>
                            <Text size="xs" fw={500} c="dimmed">Farmer Name</Text>
                            <Text size="sm" fw={600}>{selectedFarmer.personalDetails?.name}</Text>
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <Text size="xs" fw={500} c="dimmed">Farmer Code</Text>
                            <Text size="sm" fw={600}>{selectedFarmer.farmerNumber}</Text>
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <Text size="xs" fw={500} c="dimmed">Village</Text>
                            <Text size="sm">{selectedFarmer.address?.village || '-'}</Text>
                          </Grid.Col>
                        </Grid>
                      </Paper>
                    )}

                    <Grid>
                      <Grid.Col span={6}>
                        <NumberInput
                          label="Amount"
                          value={formData.advanceAmount}
                          onChange={(value) => handleInputChange('advanceAmount', value)}
                          placeholder="Enter amount"
                          min={1}
                          required
                          leftSection={<IconCurrencyRupee size={16} />}
                          thousandSeparator=","
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Select
                          label="Payment Mode"
                          value={formData.paymentMode}
                          onChange={(value) => handleInputChange('paymentMode', value)}
                          data={paymentModeOptions}
                          required
                        />
                      </Grid.Col>
                    </Grid>

                    <TextInput
                      label="Purpose"
                      value={formData.purpose}
                      onChange={(e) => handleInputChange('purpose', e.target.value)}
                      placeholder="Purpose of advance"
                    />

                    <Textarea
                      label="Remarks"
                      value={formData.remarks}
                      onChange={(e) => handleInputChange('remarks', e.target.value)}
                      placeholder="Additional notes"
                      rows={2}
                    />

                    <Group justify="flex-end" mt="md">
                      <Button variant="light" onClick={resetForm}>Clear</Button>
                      <Button
                        type="submit"
                        leftSection={<IconDeviceFloppy size={16} />}
                        loading={loading}
                        disabled={!formData.farmerId || !formData.advanceAmount || !canWrite('payments')}
                      >
                        Save & Print
                      </Button>
                    </Group>
                  </Stack>
                </form>
              )}
            </Card>
          </Grid.Col>

          {/* Balance Summary */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder shadow="sm" radius="md" p="lg">
              <Title order={4} mb="md">Balance Summary</Title>
              <Stack gap="md">
                <Paper withBorder p="md" radius="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Opening Balance (Cash Advance)</Text>
                  <Text size="xl" fw={600} c={balances.openingBalance > 0 ? 'red' : 'green'}>
                    {formatCurrency(balances.openingBalance)}
                  </Text>
                </Paper>
                <Paper withBorder p="md" radius="md" bg="blue.0">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Amount Paid</Text>
                  <Text size="xl" fw={700} c="blue">{formatCurrency(formData.advanceAmount || 0)}</Text>
                </Paper>
                <Paper withBorder p="md" radius="md" bg="orange.0">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Closing Balance (Due)</Text>
                  <Text size="xl" fw={700} c="orange">{formatCurrency(balances.closingBalance)}</Text>
                </Paper>
              </Stack>
              {balances.closingBalance > 0 && (
                <Alert color="yellow" mt="md" icon={<IconAlertCircle />}>
                  <Text size="sm">Farmer will owe {formatCurrency(balances.closingBalance)} after this advance.</Text>
                </Alert>
              )}
            </Card>
          </Grid.Col>
        </Grid>

        {/* ── Grid ── */}
        <Paper shadow="sm" radius="md" withBorder style={{ overflow: 'hidden' }}>
          <Box px="md" py="sm" style={{ background: '#f1f3f5', borderBottom: '2px solid #dee2e6' }}>
            <Group justify="space-between" align="center">
              <Group gap="xs">
                <ThemeIcon size={28} radius="sm" color="blue" variant="light">
                  <IconCash size={16} />
                </ThemeIcon>
                <Text fw={700} size="sm" c="dark.6">Advance Entries</Text>
                <Badge color="blue" variant="light" size="sm" radius="sm">
                  {totalRecords} {totalRecords === 1 ? 'record' : 'records'}
                </Badge>
              </Group>
              <Tooltip label="Refresh">
                <ActionIcon variant="light" color="blue" size="lg" loading={gridLoading} onClick={() => fetchAdvances(page)}>
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Box>

          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
              <Table.Thead>
                <Table.Tr style={{ background: '#f8f9fa' }}>
                  <Table.Th w={50} fz="xs">Sl.</Table.Th>
                  <Table.Th w={110} fz="xs">Date</Table.Th>
                  <Table.Th w={110} fz="xs">Farmer ID</Table.Th>
                  <Table.Th fz="xs">Farmer Name</Table.Th>
                  <Table.Th w={130} fz="xs">Type</Table.Th>
                  <Table.Th w={120} fz="xs" ta="right">Amount</Table.Th>
                  <Table.Th w={120} fz="xs" ta="right">Balance</Table.Th>
                  <Table.Th w={100} fz="xs">Mode</Table.Th>
                  <Table.Th w={90} fz="xs">Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {gridLoading ? (
                  <Table.Tr>
                    <Table.Td colSpan={9} ta="center" py="xl">
                      <Loader size="sm" />
                    </Table.Td>
                  </Table.Tr>
                ) : advances.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={9} ta="center" py="xl" c="dimmed">
                      <Stack align="center" gap={4}>
                        <IconCash size={28} opacity={0.3} />
                        <Text size="sm">No advance entries yet.</Text>
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  gridRows
                )}
              </Table.Tbody>
            </Table>
          </Box>

          {totalPages > 1 && (
            <Group justify="center" py="sm" style={{ borderTop: '1px solid #dee2e6' }}>
              <Pagination total={totalPages} value={page} onChange={setPage} color="blue" radius="md" size="sm" />
            </Group>
          )}
        </Paper>

      </Stack>
    </Container>
  );
};

export default CashAdvanceVoucher;
