import React, { useState, useEffect, useRef } from 'react';
import {
  Container, Paper, Group, Text, Title, Box, Badge,
  Button, Select, Tabs, Divider, ScrollArea,
  LoadingOverlay, ActionIcon, Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconCalendar, IconRefresh, IconPrinter, IconFileSpreadsheet,
  IconSearch, IconCheck, IconArrowLeft,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import { loanAdvanceAPI, cattleFeedAdvanceAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';

/* ─── helpers ─── */
const n   = (v) => parseFloat(v) || 0;
const fmt = (v) => n(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─── Print style ─── */
const PRINT_STYLE = `
  @media print {
    body * { visibility: hidden !important; }
    #la-print, #la-print * { visibility: visible !important; }
    #la-print { position: fixed; inset: 0; padding: 12px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #555; font-size: 10px; padding: 4px 6px; }
    .no-print { display: none !important; }
    @page { size: A4 landscape; margin: 10mm; }
  }
`;

/* ─── Style constants ─── */
const TH = (bg = '#0d3b6e') => ({
  background: bg, color: '#fff', padding: '7px 8px',
  textAlign: 'center', fontSize: 11, fontWeight: 700,
  border: '1px solid #1a4a7c', whiteSpace: 'nowrap', userSelect: 'none',
});
const TD = (extra = {}) => ({
  border: '1px solid #dde', padding: '5px 8px',
  fontSize: 11, verticalAlign: 'middle', ...extra,
});
const TD_NUM = (extra = {}) => ({
  ...TD({ textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...extra }),
});

const TYPE_LABEL = {
  ADVANCE:  { label: 'Loan Disbursement', color: '#7b341e' },
  RECOVERY: { label: 'Loan Recovery',     color: '#276749' },
};

const LoanAdvanceSummary = () => {
  const { selectedCompany } = useCompany();
  const printRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Loan_Advance_${dayjs().format('DDMMYYYY')}`,
  });

  const [activeTab,  setActiveTab]  = useState('summary');
  const [fromDate,   setFromDate]   = useState(dayjs().startOf('month').toDate());
  const [toDate,     setToDate]     = useState(dayjs().endOf('month').toDate());
  const [farmers,    setFarmers]    = useState([]);
  const [farmerId,   setFarmerId]   = useState(null);
  const [loading,    setLoading]    = useState(false);

  const [summaryRows,   setSummaryRows]   = useState([]);
  const [summaryTotals, setSummaryTotals] = useState(null);
  const [ledgerData,    setLedgerData]    = useState(null);

  /* ── Load farmer list once ── */
  useEffect(() => {
    cattleFeedAdvanceAPI.getFarmers().then(res => {
      const list = res?.data || [];
      setFarmers(list.map(f => ({
        value: f._id,
        label: `${f.farmerNumber} — ${f.name}`,
      })));
    }).catch(() => {});
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await loanAdvanceAPI.getSummary({
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate:   dayjs(toDate).format('YYYY-MM-DD'),
      });
      if (!res.success) throw new Error(res.message || 'Failed');
      setSummaryRows(res.data.rows || []);
      setSummaryTotals(res.data.grandTotals || null);
      notifications.show({
        title: 'Loaded', color: 'teal', icon: <IconCheck size={14} />,
        message: `${res.data.rows?.length || 0} producer(s) loaded`,
      });
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally { setLoading(false); }
  };

  const fetchLedger = async () => {
    if (!farmerId) {
      notifications.show({ title: 'Select Producer', message: 'Please select a producer', color: 'orange' });
      return;
    }
    setLoading(true);
    try {
      const res = await loanAdvanceAPI.getLedger({
        farmerId,
        fromDate: dayjs(fromDate).format('YYYY-MM-DD'),
        toDate:   dayjs(toDate).format('YYYY-MM-DD'),
      });
      if (!res.success) throw new Error(res.message || 'Failed');
      setLedgerData(res.data);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally { setLoading(false); }
  };

  const openLedger = (row) => {
    setFarmerId(row.farmerId);
    setActiveTab('ledger');
  };

  useEffect(() => {
    if (activeTab === 'summary') fetchSummary();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'ledger' && farmerId) fetchLedger();
  }, [farmerId, activeTab]);

  const exportSummary = () => {
    const data = summaryRows.map(r => ({
      'SN':                   r.slNo,
      'Producer ID':          r.farmerNumber,
      'Producer Name':        r.farmerName,
      'Opening Balance':      r.opening,
      'Disbursement (Credit)': r.advanced,
      'Recovery (Debit)':     r.recovery,
      'Balance':              r.balance,
    }));
    if (summaryTotals) {
      data.push({
        'SN': '', 'Producer ID': '', 'Producer Name': 'TOTAL',
        'Opening Balance':       summaryTotals.opening,
        'Disbursement (Credit)': summaryTotals.advanced,
        'Recovery (Debit)':      summaryTotals.recovery,
        'Balance':               summaryTotals.balance,
      });
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Loan Advance');
    XLSX.writeFile(wb, `Loan_Advance_${dayjs(fromDate).format('MMYYYY')}.xlsx`);
  };

  const exportLedger = () => {
    if (!ledgerData) return;
    const farmerLabel = farmers.find(f => f.value === farmerId)?.label || farmerId;
    const data = ledgerData.entries.map(e => ({
      'Date':        dayjs(e.date).format('DD/MM/YYYY'),
      'Ref No':      e.refNo || '',
      'Description': e.description,
      'Debit':       e.debit,
      'Credit':      e.credit,
      'Balance':     e.balance,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Loan Ledger');
    XLSX.writeFile(wb, `Loan_Ledger_${farmerLabel.replace(/[^a-z0-9]/gi, '_')}_${dayjs(fromDate).format('MMYYYY')}.xlsx`);
  };

  return (
    <Container fluid px="md" py="sm">
      <style>{PRINT_STYLE}</style>

      <Box mb="sm">
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
          <Box>
            <Title order={3} fw={700} c="#0d3b6e">Loan Advance</Title>
            <Text c="dimmed" size="sm">
              Producer-wise loan ledger — disbursements, recoveries &amp; running outstanding
            </Text>
          </Box>
        </Group>
      </Box>

      <Paper withBorder shadow="xs" p="sm" radius="md" mb="md" className="no-print">
        <Group wrap="wrap" gap="sm" align="flex-end">
          <DatePickerInput
            label="From Date" value={fromDate} onChange={setFromDate}
            leftSection={<IconCalendar size={15} />} valueFormat="DD/MM/YYYY"
            style={{ minWidth: 140 }} size="sm"
          />
          <DatePickerInput
            label="To Date" value={toDate} onChange={setToDate}
            leftSection={<IconCalendar size={15} />} valueFormat="DD/MM/YYYY"
            minDate={fromDate} style={{ minWidth: 140 }} size="sm"
          />

          {activeTab === 'ledger' && (
            <Select
              label="Producer"
              placeholder="Search Producer..."
              data={farmers}
              value={farmerId}
              onChange={setFarmerId}
              searchable clearable
              style={{ minWidth: 260 }} size="sm"
            />
          )}

          <Box style={{ flex: 1 }} />

          <Button
            leftSection={<IconSearch size={15} />} size="sm"
            onClick={activeTab === 'summary' ? fetchSummary : fetchLedger}
            loading={loading} color="blue"
          >
            Generate
          </Button>
          <Button
            leftSection={<IconFileSpreadsheet size={15} />} size="sm"
            variant="light" color="teal"
            onClick={activeTab === 'summary' ? exportSummary : exportLedger}
            disabled={activeTab === 'summary' ? summaryRows.length === 0 : !ledgerData}
          >
            Export Excel
          </Button>
          <Button
            leftSection={<IconPrinter size={15} />} size="sm"
            variant="outline"
            onClick={handlePrint}
          >
            Print
          </Button>
          <Tooltip label="Refresh">
            <ActionIcon variant="subtle" color="gray" size="lg"
              onClick={() => { setSummaryRows([]); setLedgerData(null); }}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Paper>

      <Paper withBorder shadow="sm" radius="md" style={{ position: 'relative' }}>
        <LoadingOverlay visible={loading} />

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List px="sm" pt="xs" className="no-print">
            <Tabs.Tab value="summary" fw={600}>All Producers — Summary</Tabs.Tab>
            <Tabs.Tab value="ledger"  fw={600}>Producer Ledger</Tabs.Tab>
          </Tabs.List>

          {/* ── SUMMARY TAB ── */}
          <Tabs.Panel value="summary" p="md">
            <div id="la-print" ref={activeTab === 'summary' ? printRef : undefined}>
              <Box ta="center" mb="sm" style={{ display: 'none' }} className="print-header">
                <Text fw={700} size="lg">{selectedCompany?.companyName || 'Dairy Cooperative Society'}</Text>
                <Text fw={600} size="md">LOAN ADVANCE — SUMMARY</Text>
                <Text size="sm">
                  Period: {dayjs(fromDate).format('DD/MM/YYYY')} to {dayjs(toDate).format('DD/MM/YYYY')}
                </Text>
                <Divider my="xs" />
              </Box>

              <Group justify="space-between" mb="xs" className="no-print">
                <Text size="sm" fw={600} c="dimmed">
                  Period: {dayjs(fromDate).format('DD MMM YYYY')} – {dayjs(toDate).format('DD MMM YYYY')}
                </Text>
                <Badge variant="light" color="blue">{summaryRows.length} Producers</Badge>
              </Group>

              <ScrollArea type="hover" scrollbarSize={6}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
                  <colgroup>
                    <col style={{ width: 46 }} />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 240 }} />
                    <col style={{ width: 130 }} />
                    <col style={{ width: 130 }} />
                    <col style={{ width: 130 }} />
                    <col style={{ width: 130 }} />
                    <col style={{ width: 70 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={TH()}>SN</th>
                      <th style={{ ...TH(), textAlign: 'left' }}>Producer ID</th>
                      <th style={{ ...TH(), textAlign: 'left' }}>Producer Name</th>
                      <th style={TH('#174a7c')}>Opening Balance</th>
                      <th style={TH('#155724')}>Credit (Disbursement)</th>
                      <th style={TH('#6e2c00')}>Debit (Recovery)</th>
                      <th style={TH('#0e5e3f')}>Balance</th>
                      <th style={{ ...TH('#2d3748') }} className="no-print">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ ...TD({ textAlign: 'center', color: '#999', padding: '24px' }) }}>
                          Click Generate to load data
                        </td>
                      </tr>
                    ) : (
                      summaryRows.map((row, idx) => {
                        const rowBg  = idx % 2 === 0 ? '#fff' : '#f5f9ff';
                        const balClr = row.balance > 0 ? '#721c24' : row.balance < 0 ? '#276749' : '#555';
                        return (
                          <tr key={row.farmerId} style={{ background: rowBg }}>
                            <td style={TD({ textAlign: 'center', color: '#666' })}>{row.slNo}</td>
                            <td style={TD()}>{row.farmerNumber}</td>
                            <td style={TD({ fontWeight: 600 })}>{row.farmerName}</td>
                            <td style={TD_NUM({ color: '#2b6cb0' })}>₹ {fmt(row.opening)}</td>
                            <td style={TD_NUM({ color: '#276749' })}>₹ {fmt(row.advanced)}</td>
                            <td style={TD_NUM({ color: '#7b341e' })}>₹ {fmt(row.recovery)}</td>
                            <td style={TD_NUM({ fontWeight: 700, color: balClr })}>₹ {fmt(row.balance)}</td>
                            <td style={{ ...TD({ textAlign: 'center', padding: '2px 4px' }) }} className="no-print">
                              <Tooltip label="View Ledger">
                                <ActionIcon size="sm" variant="light" color="blue"
                                  onClick={() => openLedger(row)}>
                                  <IconSearch size={13} />
                                </ActionIcon>
                              </Tooltip>
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {summaryTotals && (
                      <tr style={{ borderTop: '2px solid #0d3b6e', background: '#edf2f7' }}>
                        <td colSpan={3} style={{ ...TD({ fontWeight: 700, textAlign: 'center', background: '#2d3748', color: '#fff', letterSpacing: 1 }) }}>
                          TOTAL
                        </td>
                        <td style={TD_NUM({ fontWeight: 700, color: '#2b6cb0', background: '#ebf8ff' })}>₹ {fmt(summaryTotals.opening)}</td>
                        <td style={TD_NUM({ fontWeight: 700, color: '#276749', background: '#f0fff4' })}>₹ {fmt(summaryTotals.advanced)}</td>
                        <td style={TD_NUM({ fontWeight: 700, color: '#7b341e', background: '#fff5eb' })}>₹ {fmt(summaryTotals.recovery)}</td>
                        <td style={TD_NUM({ fontWeight: 700, background: '#b2f5ea' })}>₹ {fmt(summaryTotals.balance)}</td>
                        <td className="no-print" />
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          </Tabs.Panel>

          {/* ── LEDGER TAB ── */}
          <Tabs.Panel value="ledger" p="md">
            {farmerId && (
              <Button
                size="xs" variant="subtle" leftSection={<IconArrowLeft size={13} />}
                onClick={() => setActiveTab('summary')}
                mb="xs" className="no-print"
              >
                Back to Summary
              </Button>
            )}

            <div id="la-print" ref={activeTab === 'ledger' ? printRef : undefined}>
              {ledgerData ? (
                <>
                  <Box ta="center" mb="sm" style={{ display: 'none' }} className="print-header">
                    <Text fw={700} size="lg">{selectedCompany?.companyName || 'Dairy Cooperative Society'}</Text>
                    <Text fw={600} size="md">LOAN ADVANCE — PRODUCER LEDGER</Text>
                    <Text size="sm">{farmers.find(f => f.value === farmerId)?.label || farmerId}</Text>
                    <Text size="sm">
                      Period: {dayjs(fromDate).format('DD/MM/YYYY')} to {dayjs(toDate).format('DD/MM/YYYY')}
                    </Text>
                    <Divider my="xs" />
                  </Box>

                  <Group gap="sm" mb="md" className="no-print">
                    {[
                      { label: 'Opening Balance',          value: ledgerData.openingBalance, color: 'blue' },
                      { label: 'Total Credit (Disbursal)', value: ledgerData.totalCredit,    color: 'orange' },
                      { label: 'Total Debit (Recovery)',   value: ledgerData.totalDebit,     color: 'green' },
                      { label: 'Closing Balance',          value: ledgerData.closingBalance,
                        color: ledgerData.closingBalance > 0 ? 'red' : 'teal' },
                    ].map(card => (
                      <Paper key={card.label} withBorder p="sm" radius="md" style={{ minWidth: 160 }}>
                        <Text size="xs" c="dimmed" mb={2}>{card.label}</Text>
                        <Text fw={700} size="lg" c={card.color}>₹ {fmt(card.value)}</Text>
                      </Paper>
                    ))}
                  </Group>

                  <ScrollArea type="hover" scrollbarSize={6}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820 }}>
                      <colgroup>
                        <col style={{ width: 46 }} />
                        <col style={{ width: 110 }} />
                        <col style={{ width: 110 }} />
                        <col style={{ width: 320 }} />
                        <col style={{ width: 130 }} />
                        <col style={{ width: 130 }} />
                        <col style={{ width: 140 }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th style={TH()}>SN</th>
                          <th style={TH()}>Date</th>
                          <th style={TH()}>Ref No</th>
                          <th style={{ ...TH(), textAlign: 'left' }}>Description</th>
                          <th style={TH('#155724')}>Credit (Disbursal)</th>
                          <th style={TH('#6e2c00')}>Debit (Recovery)</th>
                          <th style={TH('#0e5e3f')}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ background: '#ebf8ff' }}>
                          <td style={TD({ textAlign: 'center', color: '#666' })}>—</td>
                          <td style={TD({ textAlign: 'center' })}>{dayjs(fromDate).format('DD/MM/YYYY')}</td>
                          <td style={TD({ textAlign: 'center', color: '#999' })}>—</td>
                          <td style={TD({ fontWeight: 700, color: '#2b6cb0' })}>Opening Balance</td>
                          <td style={TD_NUM()}>—</td>
                          <td style={TD_NUM()}>—</td>
                          <td style={TD_NUM({ fontWeight: 700, color: '#2b6cb0' })}>₹ {fmt(ledgerData.openingBalance)}</td>
                        </tr>

                        {ledgerData.entries.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ ...TD({ textAlign: 'center', color: '#999', padding: '20px' }) }}>
                              No transactions in this period
                            </td>
                          </tr>
                        ) : (
                          ledgerData.entries.map((entry, idx) => {
                            const isCredit = entry.credit > 0;
                            const rowBg = idx % 2 === 0 ? '#fff' : '#f9fafb';
                            const balClr = entry.balance > 0 ? '#721c24' : entry.balance < 0 ? '#276749' : '#555';
                            const typeInfo = TYPE_LABEL[entry.type] || { label: entry.type, color: '#555' };
                            return (
                              <tr key={idx} style={{ background: isCredit ? '#fffbeb' : rowBg }}>
                                <td style={TD({ textAlign: 'center', color: '#666' })}>{idx + 1}</td>
                                <td style={TD({ textAlign: 'center' })}>{dayjs(entry.date).format('DD/MM/YYYY')}</td>
                                <td style={TD({ textAlign: 'center', fontSize: 10, color: '#718096' })}>
                                  {entry.refNo || '—'}
                                </td>
                                <td style={TD()}>
                                  <Group gap={6} align="center">
                                    <Badge size="xs" variant="dot" color={isCredit ? 'orange' : 'green'} style={{ flexShrink: 0 }}>
                                      {typeInfo.label}
                                    </Badge>
                                    <Text size="xs">{entry.description}</Text>
                                  </Group>
                                </td>
                                <td style={TD_NUM({ color: entry.credit > 0 ? '#7b341e' : '#999' })}>
                                  {entry.credit > 0 ? `₹ ${fmt(entry.credit)}` : '—'}
                                </td>
                                <td style={TD_NUM({ color: entry.debit > 0 ? '#276749' : '#999' })}>
                                  {entry.debit > 0 ? `₹ ${fmt(entry.debit)}` : '—'}
                                </td>
                                <td style={TD_NUM({ fontWeight: 700, color: balClr })}>
                                  ₹ {fmt(entry.balance)}
                                </td>
                              </tr>
                            );
                          })
                        )}

                        <tr style={{ borderTop: '2px solid #0d3b6e', background: '#edf2f7' }}>
                          <td colSpan={4} style={{ ...TD({ fontWeight: 700, textAlign: 'center', background: '#2d3748', color: '#fff', letterSpacing: 1 }) }}>
                            CLOSING BALANCE
                          </td>
                          <td style={TD_NUM({ fontWeight: 700, color: '#7b341e', background: '#fff5eb' })}>₹ {fmt(ledgerData.totalCredit)}</td>
                          <td style={TD_NUM({ fontWeight: 700, color: '#276749', background: '#f0fff4' })}>₹ {fmt(ledgerData.totalDebit)}</td>
                          <td style={TD_NUM({
                            fontWeight: 800, background: '#b2f5ea',
                            color: ledgerData.closingBalance > 0 ? '#721c24' : '#276749',
                          })}>
                            ₹ {fmt(ledgerData.closingBalance)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </ScrollArea>
                </>
              ) : (
                <Box ta="center" py="xl">
                  <Text c="dimmed">
                    {farmerId
                      ? 'Click Generate to load ledger'
                      : 'Select a producer and click Generate'}
                  </Text>
                </Box>
              )}
            </div>
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Container>
  );
};

export default LoanAdvanceSummary;
