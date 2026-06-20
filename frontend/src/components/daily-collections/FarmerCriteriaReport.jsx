import { useState, useRef } from 'react';
import {
  Container, Title, Text, Button, Group, Paper, TextInput,
  Box, Stack, Table, Loader, Center, Divider, Select, NumberInput,
  Grid
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconSearch, IconPrinter, IconFileTypePdf, IconFileTypeXls, IconX
} from '@tabler/icons-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { milkCollectionAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import dayjs from 'dayjs';

const fmt2 = v => Number(v || 0).toFixed(2);
const fmt3 = v => Number(v || 0).toFixed(3);
const fmtD = d => dayjs(d).format('DD/MM/YYYY');

export default function FarmerCriteriaReport() {
  const { selectedCompany } = useCompany();

  const [fromDate, setFromDate]     = useState(null);
  const [toDate, setToDate]         = useState(null);
  const [memberType, setMemberType] = useState('all');
  const [minDays, setMinDays]       = useState('');
  const [minQty, setMinQty]         = useState('');
  const [minSolid, setMinSolid]     = useState('');
  const [caption, setCaption]       = useState('Farmer Criteria Report');

  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!fromDate || !toDate) {
      notifications.show({ color: 'red', message: 'Select From and To dates' });
      return;
    }
    setLoading(true);
    try {
      const params = {
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate:   dayjs(toDate).format('YYYY-MM-DD'),
        memberType,
      };
      if (minDays)  params.minDays       = minDays;
      if (minQty)   params.minQty        = minQty;
      if (minSolid) params.minTotalSolid = minSolid;

      const res = await milkCollectionAPI.getFarmerCriteriaSummary(params);
      setRows(res.data || []);
      setSearched(true);
    } catch (err) {
      notifications.show({ color: 'red', message: err.message || 'Failed to load report' });
    } finally {
      setLoading(false);
    }
  };

  const totals = rows.reduce(
    (acc, r) => ({
      days:   acc.days   + (r.totalDays || 0),
      shifts: acc.shifts + (r.totalShifts || 0),
      qty:    acc.qty    + (r.totalQty   || 0),
      amount: acc.amount + (r.totalAmount|| 0),
    }),
    { days: 0, shifts: 0, qty: 0, amount: 0 }
  );

  const companyName    = selectedCompany?.companyName || '';
  const companyAddress = selectedCompany?.address     || '';
  const societyCode    = selectedCompany?.societyCode || '';
  const dateRange      = fromDate && toDate ? `${fmtD(fromDate)} to ${fmtD(toDate)}` : '';

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const win = window.open('', '_blank');
    const tableRows = rows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.farmerNumber}</td>
        <td>${r.farmerName}</td>
        <td>${r.address || ''}</td>
        <td style="text-align:right">${r.totalDays}</td>
        <td style="text-align:right">${r.totalShifts}</td>
        <td style="text-align:right">${fmt3(r.totalQty)}</td>
        <td style="text-align:right">${fmt2(r.totalSolid)}</td>
        <td style="text-align:right">${fmt2(r.totalAmount)}</td>
      </tr>`).join('');

    win.document.write(`<!DOCTYPE html><html><head>
      <title>${caption}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 10mm; }
        h2, h3, h4 { margin: 2px 0; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #333; padding: 3px 5px; }
        th { background: #d0d0d0; text-align: center; }
        tfoot td { font-weight: bold; background: #eee; }
        @media print { button { display: none; } }
      </style>
    </head><body>
      <h2>${companyName}</h2>
      <h4>${companyAddress}</h4>
      ${societyCode ? `<h4>Society Code: ${societyCode}</h4>` : ''}
      <h3>${caption}</h3>
      <h4>${dateRange}</h4>
      <table>
        <thead><tr>
          <th>Sl</th><th>Farmer No</th><th>Farmer Name</th><th>Address</th>
          <th>Days</th><th>Shifts</th><th>Qty (L)</th><th>Total Solid</th><th>Amount (₹)</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr>
          <td colspan="4" style="text-align:right">TOTAL (${rows.length} farmers)</td>
          <td style="text-align:right">${totals.days}</td>
          <td style="text-align:right">${totals.shifts}</td>
          <td style="text-align:right">${fmt3(totals.qty)}</td>
          <td></td>
          <td style="text-align:right">${fmt2(totals.amount)}</td>
        </tr></tfoot>
      </table>
    </body></html>`);
    win.document.close();
    win.print();
  };

  // ── PDF ───────────────────────────────────────────────────────────────────
  const handlePDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 14;
    doc.setFontSize(13).setFont(undefined, 'bold');
    doc.text(companyName, pageW / 2, y, { align: 'center' }); y += 6;
    doc.setFontSize(10).setFont(undefined, 'normal');
    doc.text(companyAddress, pageW / 2, y, { align: 'center' }); y += 5;
    if (societyCode) { doc.text(`Society Code: ${societyCode}`, pageW / 2, y, { align: 'center' }); y += 5; }
    doc.setFontSize(11).setFont(undefined, 'bold');
    doc.text(caption, pageW / 2, y, { align: 'center' }); y += 5;
    doc.setFontSize(9).setFont(undefined, 'normal');
    doc.text(dateRange, pageW / 2, y, { align: 'center' }); y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Sl', 'Farmer No', 'Farmer Name', 'Address', 'Days', 'Shifts', 'Qty (L)', 'Total Solid', 'Amount (₹)']],
      body: rows.map((r, i) => [
        i + 1, r.farmerNumber, r.farmerName, r.address || '',
        r.totalDays, r.totalShifts, fmt3(r.totalQty), fmt2(r.totalSolid), fmt2(r.totalAmount)
      ]),
      foot: [[
        { content: `TOTAL (${rows.length} farmers)`, colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
        totals.days, totals.shifts, fmt3(totals.qty), '', fmt2(totals.amount)
      ]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 60, 120], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [220, 220, 220], fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 14 },
        5: { halign: 'right', cellWidth: 14 },
        6: { halign: 'right', cellWidth: 20 },
        7: { halign: 'right', cellWidth: 20 },
        8: { halign: 'right', cellWidth: 22 },
      },
    });

    doc.save(`farmer-criteria-report-${dayjs().format('YYYYMMDD')}.pdf`);
  };

  // ── Excel ─────────────────────────────────────────────────────────────────
  const handleExcel = async () => {
    const XLSX = await import('xlsx');
    const data = [
      [companyName],
      [companyAddress],
      societyCode ? [`Society Code: ${societyCode}`] : [],
      [caption],
      [dateRange],
      [],
      ['Sl', 'Farmer No', 'Farmer Name', 'Address', 'Days', 'Shifts', 'Qty (L)', 'Total Solid', 'Amount (₹)'],
      ...rows.map((r, i) => [
        i + 1, r.farmerNumber, r.farmerName, r.address || '',
        r.totalDays, r.totalShifts, parseFloat(fmt3(r.totalQty)), parseFloat(fmt2(r.totalSolid)), parseFloat(fmt2(r.totalAmount))
      ]),
      [],
      ['', '', '', `TOTAL (${rows.length} farmers)`, totals.days, totals.shifts, parseFloat(fmt3(totals.qty)), '', parseFloat(fmt2(totals.amount))],
    ].filter(r => r.length > 0);

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Farmer Criteria');
    XLSX.writeFile(wb, `farmer-criteria-report-${dayjs().format('YYYYMMDD')}.xlsx`);
  };

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Box ta="center" mb="xs">
        <Title order={4}>{companyName}</Title>
        {companyAddress && <Text fz="sm" c="dimmed">{companyAddress}</Text>}
        {societyCode    && <Text fz="xs" c="dimmed">Society Code: {societyCode}</Text>}
      </Box>

      <Paper withBorder p="md" mb="md">
        {/* Caption */}
        <TextInput
          label="Report Caption"
          value={caption}
          onChange={e => setCaption(e.currentTarget.value)}
          mb="sm"
          fw={600}
        />

        <Divider label="Filters" labelPosition="left" mb="sm" />

        <Grid gutter="sm">
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <DatePickerInput
              label="From Date"
              placeholder="DD/MM/YYYY"
              value={fromDate}
              onChange={setFromDate}
              valueFormat="DD/MM/YYYY"
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <DatePickerInput
              label="To Date"
              placeholder="DD/MM/YYYY"
              value={toDate}
              onChange={setToDate}
              valueFormat="DD/MM/YYYY"
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Select
              label="Farmer Type"
              data={[
                { value: 'all',       label: 'All Farmers' },
                { value: 'member',    label: 'Member Only' },
                { value: 'nonMember', label: 'Non-Member Only' },
              ]}
              value={memberType}
              onChange={v => setMemberType(v || 'all')}
            />
          </Grid.Col>
        </Grid>

        <Divider label="Criteria (minimum values)" labelPosition="left" my="sm" />

        <Grid gutter="sm">
          <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
            <NumberInput
              label="Min Days"
              placeholder="e.g. 10"
              value={minDays}
              onChange={setMinDays}
              min={0}
              hideControls
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
            <NumberInput
              label="Min Qty (Litres)"
              placeholder="e.g. 100"
              value={minQty}
              onChange={setMinQty}
              min={0}
              hideControls
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
            <NumberInput
              label="Min Total Solid (Fat%+SNF%)"
              placeholder="e.g. 20.00"
              value={minSolid}
              onChange={setMinSolid}
              min={0}
              decimalScale={2}
              hideControls
            />
          </Grid.Col>
        </Grid>

        <Group mt="md">
          <Button leftSection={<IconSearch size={16} />} onClick={handleSearch} loading={loading}>
            Generate Report
          </Button>
          {searched && rows.length > 0 && (
            <>
              <Button variant="default" leftSection={<IconPrinter size={16} />} onClick={handlePrint}>Print</Button>
              <Button variant="default" leftSection={<IconFileTypePdf size={16} />} onClick={handlePDF} color="red">PDF</Button>
              <Button variant="default" leftSection={<IconFileTypeXls size={16} />} onClick={handleExcel} color="green">Excel</Button>
            </>
          )}
          {searched && (
            <Button variant="subtle" leftSection={<IconX size={16} />} color="gray"
              onClick={() => { setRows([]); setSearched(false); }}>Clear</Button>
          )}
        </Group>
      </Paper>

      {/* Results */}
      {loading && <Center py="xl"><Loader /></Center>}

      {!loading && searched && rows.length === 0 && (
        <Center py="xl"><Text c="dimmed">No farmers match the criteria</Text></Center>
      )}

      {!loading && rows.length > 0 && (
        <Paper withBorder>
          {/* Report header for screen */}
          <Box ta="center" py="sm" style={{ borderBottom: '1px solid #dee2e6' }}>
            <Text fw={700} fz="md">{caption}</Text>
            <Text fz="sm" c="dimmed">{dateRange}</Text>
          </Box>

          <Box style={{ overflowX: 'auto' }}>
            <Table withTableBorder withColumnBorders fz={12} style={{ minWidth: 900 }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th ta="center" style={{ background: '#1e3a78', color: '#fff', width: 40 }}>Sl</Table.Th>
                  <Table.Th ta="center" style={{ background: '#1e3a78', color: '#fff', width: 90 }}>Farmer No</Table.Th>
                  <Table.Th style={{ background: '#1e3a78', color: '#fff' }}>Farmer Name</Table.Th>
                  <Table.Th style={{ background: '#1e3a78', color: '#fff' }}>Address</Table.Th>
                  <Table.Th ta="right" style={{ background: '#1e3a78', color: '#fff', width: 60 }}>Days</Table.Th>
                  <Table.Th ta="right" style={{ background: '#1e3a78', color: '#fff', width: 60 }}>Shifts</Table.Th>
                  <Table.Th ta="right" style={{ background: '#1e3a78', color: '#fff', width: 90 }}>Qty (L)</Table.Th>
                  <Table.Th ta="right" style={{ background: '#1e3a78', color: '#fff', width: 90 }}>Total Solid</Table.Th>
                  <Table.Th ta="right" style={{ background: '#1e3a78', color: '#fff', width: 100 }}>Amount (₹)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r, i) => (
                  <Table.Tr key={r.farmerNumber} style={{ background: i % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                    <Table.Td ta="center">{i + 1}</Table.Td>
                    <Table.Td ta="center">{r.farmerNumber}</Table.Td>
                    <Table.Td>{r.farmerName}</Table.Td>
                    <Table.Td fz={11} c="dimmed">{r.address || ''}</Table.Td>
                    <Table.Td ta="right">{r.totalDays}</Table.Td>
                    <Table.Td ta="right">{r.totalShifts}</Table.Td>
                    <Table.Td ta="right">{fmt3(r.totalQty)}</Table.Td>
                    <Table.Td ta="right">{fmt2(r.totalSolid)}</Table.Td>
                    <Table.Td ta="right">{fmt2(r.totalAmount)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr style={{ background: '#e8eaf6', fontWeight: 700 }}>
                  <Table.Td colSpan={4} ta="right" fw={700}>TOTAL ({rows.length} farmers)</Table.Td>
                  <Table.Td ta="right" fw={700}>{totals.days}</Table.Td>
                  <Table.Td ta="right" fw={700}>{totals.shifts}</Table.Td>
                  <Table.Td ta="right" fw={700}>{fmt3(totals.qty)}</Table.Td>
                  <Table.Td />
                  <Table.Td ta="right" fw={700}>{fmt2(totals.amount)}</Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          </Box>
        </Paper>
      )}
    </Container>
  );
}
