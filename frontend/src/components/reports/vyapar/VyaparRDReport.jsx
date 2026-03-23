import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Text, Group, Title, Button, Stack,
  LoadingOverlay, Table, Divider, Badge
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconPrinter, IconCalendar, IconRefresh } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';

const fmt = (v) =>
  `₹${Math.abs(parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const VyaparRDReport = () => {
  const { selectedCompany, selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const printRef = useRef();
  const companyName = selectedCompany?.companyName || 'Private Firm';

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month').toDate(),
    dayjs().endOf('month').toDate()
  ]);

  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  useEffect(() => { fetchReport(); }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await reportAPI.vyaparRD({
        filterType: 'custom',
        customStart: dayjs(dateRange[0]).format('YYYY-MM-DD'),
        customEnd:   dayjs(dateRange[1]).format('YYYY-MM-DD')
      });
      setData(res.data);
    } catch (err) {
      message.error(err.message || 'Failed to fetch R&D report');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const pw = window.open('', '_blank');
    if (!pw) { alert('Pop-up blocked'); return; }
    pw.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>R&D – ${companyName}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; padding: 10mm; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 4px 8px; }
  th { background: #f0f0f0; font-weight: bold; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .section-header { background: #e8e8e8 !important; font-weight: bold; }
  h2, h3 { margin: 0 0 4px 0; }
  .header { text-align: center; margin-bottom: 8px; }
</style></head><body>${el.innerHTML}</body></html>`);
    pw.document.close();
    setTimeout(() => { pw.focus(); pw.print(); }, 400);
  };

  return (
    <Container size="lg" py="md">
      <Paper withBorder p="md" mb="md" radius="md">
        <Group justify="space-between" align="center">
          <div>
            <Title order={3}>Receipt &amp; Disbursement</Title>
            <Text size="sm" c="dimmed">Private Firm — Cash / Bank movements</Text>
          </div>
          <Group>
            <DatePickerInput
              type="range"
              value={dateRange}
              onChange={setDateRange}
              leftSection={<IconCalendar size={16} />}
              placeholder="Select period"
            />
            <Button leftSection={<IconRefresh size={16} />} onClick={fetchReport} variant="light">
              Generate
            </Button>
            <Button leftSection={<IconPrinter size={16} />} onClick={handlePrint} variant="light" color="dark" disabled={!data}>
              Print
            </Button>
          </Group>
        </Group>
      </Paper>

      <Paper withBorder radius="md" pos="relative">
        <LoadingOverlay visible={loading} />

        {!data ? (
          <Text c="dimmed" ta="center" py="xl">Select a period and click Generate</Text>
        ) : (
          <div ref={printRef}>
            {/* Print header */}
            <Stack gap={2} ta="center" p="md" style={{ borderBottom: '2px solid #dee2e6' }}>
              <Text fw={700} size="lg">{companyName}</Text>
              <Text fw={600}>RECEIPT AND DISBURSEMENT REPORT</Text>
              <Text size="sm" c="dimmed">
                Period: {dayjs(dateRange[0]).format('DD/MM/YYYY')} to {dayjs(dateRange[1]).format('DD/MM/YYYY')}
              </Text>
            </Stack>

            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Voucher No</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Particulars</Table.Th>
                  <Table.Th ta="right">Receipt (₹)</Table.Th>
                  <Table.Th ta="right">Payment (₹)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {/* Opening Balance */}
                <Table.Tr style={{ background: '#f8f9fa' }}>
                  <Table.Td colSpan={4}><Text fw={600}>Opening Balance (b/d)</Text></Table.Td>
                  <Table.Td ta="right">
                    <Text fw={600} c={data.openingBalance >= 0 ? 'blue' : 'red'}>
                      {data.openingBalance >= 0 ? fmt(data.openingBalance) : ''}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fw={600} c="red">
                      {data.openingBalance < 0 ? fmt(Math.abs(data.openingBalance)) : ''}
                    </Text>
                  </Table.Td>
                </Table.Tr>

                {/* RECEIPTS header */}
                <Table.Tr style={{ background: '#e8f5e9' }}>
                  <Table.Td colSpan={6}>
                    <Text fw={700} c="green.8">RECEIPTS (Money In)</Text>
                  </Table.Td>
                </Table.Tr>

                {data.receipts.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6} ta="center">
                      <Text c="dimmed" size="sm">No receipts</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  data.receipts.map((r, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{dayjs(r.date).format('DD/MM/YYYY')}</Table.Td>
                      <Table.Td>{r.voucherNumber}</Table.Td>
                      <Table.Td>
                        <Badge size="xs" color="green" variant="light">{r.voucherType}</Badge>
                      </Table.Td>
                      <Table.Td>{r.particulars}</Table.Td>
                      <Table.Td ta="right" c="green.7" fw={500}>{fmt(r.amount)}</Table.Td>
                      <Table.Td />
                    </Table.Tr>
                  ))
                )}

                {/* Receipt subtotal */}
                <Table.Tr style={{ background: '#e8f5e9' }}>
                  <Table.Td colSpan={4}><Text fw={700}>Total Receipts</Text></Table.Td>
                  <Table.Td ta="right"><Text fw={700} c="green.8">{fmt(data.totalReceipts)}</Text></Table.Td>
                  <Table.Td />
                </Table.Tr>

                {/* PAYMENTS header */}
                <Table.Tr style={{ background: '#fff3e0' }}>
                  <Table.Td colSpan={6}>
                    <Text fw={700} c="orange.8">PAYMENTS / DISBURSEMENTS (Money Out)</Text>
                  </Table.Td>
                </Table.Tr>

                {data.disbursements.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6} ta="center">
                      <Text c="dimmed" size="sm">No payments</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  data.disbursements.map((d, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{dayjs(d.date).format('DD/MM/YYYY')}</Table.Td>
                      <Table.Td>{d.voucherNumber}</Table.Td>
                      <Table.Td>
                        <Badge size="xs" color="orange" variant="light">{d.voucherType}</Badge>
                      </Table.Td>
                      <Table.Td>{d.particulars}</Table.Td>
                      <Table.Td />
                      <Table.Td ta="right" c="orange.7" fw={500}>{fmt(d.amount)}</Table.Td>
                    </Table.Tr>
                  ))
                )}

                {/* Payment subtotal */}
                <Table.Tr style={{ background: '#fff3e0' }}>
                  <Table.Td colSpan={4}><Text fw={700}>Total Payments</Text></Table.Td>
                  <Table.Td />
                  <Table.Td ta="right"><Text fw={700} c="orange.8">{fmt(data.totalDisbursements)}</Text></Table.Td>
                </Table.Tr>

                {/* Closing Balance */}
                <Table.Tr style={{ background: '#e3f2fd' }}>
                  <Table.Td colSpan={4}><Text fw={700}>Closing Balance (c/d)</Text></Table.Td>
                  <Table.Td ta="right">
                    <Text fw={700} c="blue">
                      {data.closingBalance >= 0 ? fmt(data.closingBalance) : ''}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fw={700} c="red">
                      {data.closingBalance < 0 ? fmt(Math.abs(data.closingBalance)) : ''}
                    </Text>
                  </Table.Td>
                </Table.Tr>

                {/* Grand Total row */}
                <Table.Tr style={{ background: '#1a237e' }}>
                  <Table.Td colSpan={4}>
                    <Text fw={800} c="white">GRAND TOTAL</Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fw={800} c="white">
                      {fmt(data.openingBalance + data.totalReceipts)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fw={800} c="white">
                      {fmt(data.totalDisbursements + Math.max(0, data.closingBalance))}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>

            {/* Summary cards */}
            <Group p="md" grow>
              <Paper withBorder p="sm" radius="sm" ta="center">
                <Text size="xs" c="dimmed">Opening Balance</Text>
                <Text fw={700} c="blue">{fmt(data.openingBalance)}</Text>
              </Paper>
              <Paper withBorder p="sm" radius="sm" ta="center">
                <Text size="xs" c="dimmed">Total Receipts</Text>
                <Text fw={700} c="green">{fmt(data.totalReceipts)}</Text>
              </Paper>
              <Paper withBorder p="sm" radius="sm" ta="center">
                <Text size="xs" c="dimmed">Total Payments</Text>
                <Text fw={700} c="orange">{fmt(data.totalDisbursements)}</Text>
              </Paper>
              <Paper withBorder p="sm" radius="sm" ta="center">
                <Text size="xs" c="dimmed">Closing Balance</Text>
                <Text fw={700} c={data.closingBalance >= 0 ? 'blue' : 'red'}>
                  {fmt(data.closingBalance)}
                </Text>
              </Paper>
            </Group>
          </div>
        )}
      </Paper>
    </Container>
  );
};

export default VyaparRDReport;
