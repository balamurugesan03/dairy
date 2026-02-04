import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Table,
  Badge,
  Button,
  LoadingOverlay,
  Center,
  Box,
  Grid,
  Card,
  ThemeIcon,
  Divider,
  ActionIcon,
  Tooltip,
  Collapse,
  Select,
  Tabs,
  ScrollArea,
  Progress
} from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import {
  IconFileInvoice,
  IconCalendar,
  IconPrinter,
  IconFileSpreadsheet,
  IconRefresh,
  IconChevronDown,
  IconChevronRight,
  IconBuilding,
  IconUsers,
  IconReceipt,
  IconFileExport,
  IconCreditCard,
  IconBan,
  IconWorld,
  IconCheck,
  IconX,
  IconShoppingCart,
  IconCash,
  IconArrowUpRight,
  IconArrowDownRight,
  IconReceiptTax
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { useCompany } from '../../../context/CompanyContext';
import { reportAPI } from '../../../services/api';
import { message } from '../../../utils/toast';

const VyaparGSTR2 = () => {
  const { selectedBusinessType } = useCompany();
  const navigate = useNavigate();
  const printRef = useRef();

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState('summary');
  const [expandedSections, setExpandedSections] = useState({
    b2b: true,
    imports: false,
    creditNotes: false,
    nilRated: false,
    itc: true
  });

  // Redirect if wrong business type
  useEffect(() => {
    if (selectedBusinessType !== 'Private Firm') {
      message.warning('This report is only available for Private Firm');
      navigate('/');
    }
  }, [selectedBusinessType, navigate]);

  // Fetch report on mount
  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const month = selectedMonth.getMonth() + 1;
      const year = selectedMonth.getFullYear();
      const returnPeriod = `${String(month).padStart(2, '0')}${year}`;

      const response = await reportAPI.vyaparGSTR2({ returnPeriod });
      setReportData(response.data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch GSTR-2 report');
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (date) => {
    setSelectedMonth(date);
  };

  const handleApplyFilter = () => {
    fetchReport();
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!reportData) {
      message.warning('No data to export');
      return;
    }

    const wb = XLSX.utils.book_new();

    // B2B Sheet
    if (reportData.sections.b2b.invoices.length > 0) {
      const b2bData = reportData.sections.b2b.invoices.map((inv, idx) => ({
        '#': idx + 1,
        'GSTIN': inv.gstin,
        'Supplier Name': inv.supplierName,
        'Invoice Number': inv.invoiceNumber,
        'Invoice Date': formatDate(inv.invoiceDate),
        'Place of Supply': inv.state,
        'Taxable Value': inv.taxableValue.toFixed(2),
        'CGST': inv.cgst.toFixed(2),
        'SGST': inv.sgst.toFixed(2),
        'IGST': inv.igst.toFixed(2),
        'Invoice Value': inv.invoiceValue.toFixed(2),
        'ITC Eligible': inv.itcEligible ? 'Yes' : 'No',
        'ITC CGST': (inv.itcCgst || 0).toFixed(2),
        'ITC SGST': (inv.itcSgst || 0).toFixed(2),
        'ITC IGST': (inv.itcIgst || 0).toFixed(2)
      }));
      const b2bSheet = XLSX.utils.json_to_sheet(b2bData);
      XLSX.utils.book_append_sheet(wb, b2bSheet, 'B2B Purchases');
    }

    // ITC Summary Sheet
    const itcData = [
      { 'Type': 'Eligible ITC', 'CGST': reportData.itcSummary.eligible.cgst.toFixed(2), 'SGST': reportData.itcSummary.eligible.sgst.toFixed(2), 'IGST': reportData.itcSummary.eligible.igst.toFixed(2), 'Total': reportData.itcSummary.eligible.total.toFixed(2) },
      { 'Type': 'ITC Availed', 'CGST': reportData.itcSummary.availed.cgst.toFixed(2), 'SGST': reportData.itcSummary.availed.sgst.toFixed(2), 'IGST': reportData.itcSummary.availed.igst.toFixed(2), 'Total': reportData.itcSummary.availed.total.toFixed(2) },
      { 'Type': 'ITC Reversed', 'CGST': reportData.itcSummary.reversed.cgst.toFixed(2), 'SGST': reportData.itcSummary.reversed.sgst.toFixed(2), 'IGST': reportData.itcSummary.reversed.igst.toFixed(2), 'Total': reportData.itcSummary.reversed.total.toFixed(2) },
      { 'Type': 'Net ITC Available', 'CGST': reportData.itcSummary.net.cgst.toFixed(2), 'SGST': reportData.itcSummary.net.sgst.toFixed(2), 'IGST': reportData.itcSummary.net.igst.toFixed(2), 'Total': reportData.itcSummary.net.total.toFixed(2) }
    ];
    const itcSheet = XLSX.utils.json_to_sheet(itcData);
    XLSX.utils.book_append_sheet(wb, itcSheet, 'ITC Summary');

    // Summary Sheet
    const summaryData = [
      { 'Section': 'B2B Purchases', 'Count': reportData.sections.b2b.summary.count, 'Taxable Value': reportData.sections.b2b.summary.taxableValue.toFixed(2), 'Total Tax': (reportData.sections.b2b.summary.cgst + reportData.sections.b2b.summary.sgst + reportData.sections.b2b.summary.igst).toFixed(2), 'Invoice Value': reportData.sections.b2b.summary.invoiceValue.toFixed(2) },
      { 'Section': 'Nil Rated', 'Count': reportData.sections.nilRated.summary.count, 'Taxable Value': '-', 'Total Tax': '-', 'Invoice Value': reportData.sections.nilRated.summary.nilRated.toFixed(2) },
      { 'Section': 'GRAND TOTAL', 'Count': reportData.grandTotal.invoiceCount, 'Taxable Value': reportData.grandTotal.taxableValue.toFixed(2), 'Total Tax': reportData.grandTotal.totalTax.toFixed(2), 'Invoice Value': reportData.grandTotal.invoiceValue.toFixed(2) }
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // Download
    const month = String(selectedMonth.getMonth() + 1).padStart(2, '0');
    const year = selectedMonth.getFullYear();
    XLSX.writeFile(wb, `GSTR2_${month}${year}.xlsx`);
    message.success('GSTR-2 report exported successfully');
  };

  // Print functionality
  const handlePrint = () => {
    const printContent = printRef.current;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>GSTR-2 Report - ${reportData?.returnPeriod?.periodString || ''}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            h1, h2, h3 { color: #333; }
            .summary-card { display: inline-block; padding: 10px 20px; margin: 5px; border: 1px solid #ddd; border-radius: 4px; }
            .itc-highlight { background-color: #e6f7ff; padding: 15px; border-radius: 8px; margin: 10px 0; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (selectedBusinessType !== 'Private Firm') {
    return null;
  }

  return (
    <Container size="xl" py="md">
      <Paper p="md" withBorder>
        <LoadingOverlay visible={loading} />

        {/* Header */}
        <Group justify="space-between" mb="md">
          <div>
            <Title order={2} c="blue.7">GSTR-2 Report</Title>
            <Text c="dimmed" size="sm">Inward Supplies Return for GST Filing</Text>
          </div>
          <Group>
            <MonthPickerInput
              label="Return Period"
              placeholder="Select month"
              value={selectedMonth}
              onChange={handleMonthChange}
              leftSection={<IconCalendar size={16} />}
              maxDate={new Date()}
              w={180}
            />
            <Button
              variant="filled"
              leftSection={<IconRefresh size={16} />}
              onClick={handleApplyFilter}
              mt={24}
            >
              Generate
            </Button>
          </Group>
        </Group>

        <Divider my="md" />

        {/* Action Buttons */}
        <Group justify="flex-end" mb="md">
          <Button
            variant="light"
            color="green"
            leftSection={<IconFileSpreadsheet size={16} />}
            onClick={handleExportExcel}
            disabled={!reportData}
          >
            Export Excel
          </Button>
          <Button
            variant="light"
            color="blue"
            leftSection={<IconPrinter size={16} />}
            onClick={handlePrint}
            disabled={!reportData}
          >
            Print
          </Button>
        </Group>

        {/* Report Content */}
        <div ref={printRef}>
          {reportData ? (
            <Stack gap="lg">
              {/* Period Info */}
              <Paper p="sm" bg="blue.0" radius="md">
                <Group justify="center">
                  <Text fw={500}>
                    Return Period: {reportData.returnPeriod.periodString} |
                    From: {formatDate(reportData.returnPeriod.startDate)} |
                    To: {formatDate(reportData.returnPeriod.endDate)}
                  </Text>
                </Group>
              </Paper>

              {/* Summary Cards */}
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Card shadow="sm" p="lg" radius="md" withBorder>
                    <Group justify="space-between">
                      <div>
                        <Text c="dimmed" size="xs" tt="uppercase" fw={700}>Total Invoices</Text>
                        <Text fw={700} size="xl">{reportData.grandTotal.invoiceCount}</Text>
                      </div>
                      <ThemeIcon color="blue" size="lg" radius="md">
                        <IconFileInvoice size={20} />
                      </ThemeIcon>
                    </Group>
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Card shadow="sm" p="lg" radius="md" withBorder>
                    <Group justify="space-between">
                      <div>
                        <Text c="dimmed" size="xs" tt="uppercase" fw={700}>Taxable Value</Text>
                        <Text fw={700} size="xl">{formatCurrency(reportData.grandTotal.taxableValue)}</Text>
                      </div>
                      <ThemeIcon color="cyan" size="lg" radius="md">
                        <IconShoppingCart size={20} />
                      </ThemeIcon>
                    </Group>
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Card shadow="sm" p="lg" radius="md" withBorder>
                    <Group justify="space-between">
                      <div>
                        <Text c="dimmed" size="xs" tt="uppercase" fw={700}>Total Tax Paid</Text>
                        <Text fw={700} size="xl" c="red.7">{formatCurrency(reportData.grandTotal.totalTax)}</Text>
                      </div>
                      <ThemeIcon color="red" size="lg" radius="md">
                        <IconReceiptTax size={20} />
                      </ThemeIcon>
                    </Group>
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Card shadow="sm" p="lg" radius="md" withBorder style={{ borderColor: '#52c41a' }}>
                    <Group justify="space-between">
                      <div>
                        <Text c="dimmed" size="xs" tt="uppercase" fw={700}>Net ITC Available</Text>
                        <Text fw={700} size="xl" c="green.7">{formatCurrency(reportData.itcSummary.net.total)}</Text>
                      </div>
                      <ThemeIcon color="green" size="lg" radius="md">
                        <IconCash size={20} />
                      </ThemeIcon>
                    </Group>
                  </Card>
                </Grid.Col>
              </Grid>

              {/* ITC Summary Box */}
              <Paper p="md" withBorder radius="md" bg="green.0">
                <Title order={4} mb="md" c="green.8">
                  <Group gap="xs">
                    <IconCash size={20} />
                    Input Tax Credit (ITC) Summary
                  </Group>
                </Title>
                <Grid>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Table striped withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Description</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>CGST</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>SGST</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>IGST</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Total</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        <Table.Tr>
                          <Table.Td><Badge color="blue" variant="light">Eligible ITC</Badge></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.itcSummary.eligible.cgst)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.itcSummary.eligible.sgst)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.itcSummary.eligible.igst)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text fw={600}>{formatCurrency(reportData.itcSummary.eligible.total)}</Text></Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><Badge color="cyan" variant="light">ITC Availed</Badge></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.itcSummary.availed.cgst)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.itcSummary.availed.sgst)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.itcSummary.availed.igst)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text fw={600}>{formatCurrency(reportData.itcSummary.availed.total)}</Text></Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><Badge color="red" variant="light">ITC Reversed</Badge></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.itcSummary.reversed.cgst)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.itcSummary.reversed.sgst)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.itcSummary.reversed.igst)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text fw={600}>{formatCurrency(reportData.itcSummary.reversed.total)}</Text></Table.Td>
                        </Table.Tr>
                        <Table.Tr style={{ backgroundColor: '#d9f7be' }}>
                          <Table.Td><Badge color="green" variant="filled">Net ITC Available</Badge></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="green.7">{formatCurrency(reportData.itcSummary.net.cgst)}</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="green.7">{formatCurrency(reportData.itcSummary.net.sgst)}</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="green.7">{formatCurrency(reportData.itcSummary.net.igst)}</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text fw={700} size="lg" c="green.7">{formatCurrency(reportData.itcSummary.net.total)}</Text></Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Stack gap="md" h="100%" justify="center">
                      <div>
                        <Text size="sm" c="dimmed" mb={5}>ITC Utilization Rate</Text>
                        <Progress
                          value={reportData.itcSummary.eligible.total > 0 ? (reportData.itcSummary.net.total / reportData.itcSummary.eligible.total) * 100 : 0}
                          color="green"
                          size="xl"
                          radius="xl"
                        />
                        <Text size="xs" c="dimmed" mt={5}>
                          {reportData.itcSummary.eligible.total > 0 ? ((reportData.itcSummary.net.total / reportData.itcSummary.eligible.total) * 100).toFixed(1) : 0}% of eligible ITC available
                        </Text>
                      </div>
                      <Grid>
                        <Grid.Col span={4}>
                          <Paper p="sm" bg="red.1" radius="md">
                            <Text size="xs" c="dimmed">CGST Credit</Text>
                            <Text fw={700} c="red.7">{formatCurrency(reportData.itcSummary.net.cgst)}</Text>
                          </Paper>
                        </Grid.Col>
                        <Grid.Col span={4}>
                          <Paper p="sm" bg="orange.1" radius="md">
                            <Text size="xs" c="dimmed">SGST Credit</Text>
                            <Text fw={700} c="orange.7">{formatCurrency(reportData.itcSummary.net.sgst)}</Text>
                          </Paper>
                        </Grid.Col>
                        <Grid.Col span={4}>
                          <Paper p="sm" bg="blue.1" radius="md">
                            <Text size="xs" c="dimmed">IGST Credit</Text>
                            <Text fw={700} c="blue.7">{formatCurrency(reportData.itcSummary.net.igst)}</Text>
                          </Paper>
                        </Grid.Col>
                      </Grid>
                    </Stack>
                  </Grid.Col>
                </Grid>
              </Paper>

              {/* Tabs for different sections */}
              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                  <Tabs.Tab value="summary" leftSection={<IconFileInvoice size={14} />}>Summary</Tabs.Tab>
                  <Tabs.Tab value="b2b" leftSection={<IconBuilding size={14} />}>
                    B2B ({reportData.sections.b2b.summary.count})
                  </Tabs.Tab>
                  <Tabs.Tab value="imports" leftSection={<IconWorld size={14} />}>
                    Imports ({reportData.sections.importGoods.summary.count + reportData.sections.importServices.summary.count})
                  </Tabs.Tab>
                  <Tabs.Tab value="nilRated" leftSection={<IconBan size={14} />}>
                    Nil Rated ({reportData.sections.nilRated.summary.count})
                  </Tabs.Tab>
                </Tabs.List>

                {/* Summary Tab */}
                <Tabs.Panel value="summary" pt="md">
                  <Paper p="md" withBorder>
                    <Title order={4} mb="md">Section-wise Summary</Title>
                    <Table striped highlightOnHover withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Section</Table.Th>
                          <Table.Th style={{ textAlign: 'center' }}>No. of Invoices</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Taxable Value</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>CGST</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>SGST</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>IGST</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Invoice Value</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        <Table.Tr>
                          <Table.Td><Badge color="blue" variant="light">B2B</Badge> Registered Suppliers</Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}>{reportData.sections.b2b.summary.count}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2b.summary.taxableValue)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2b.summary.cgst)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2b.summary.sgst)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2b.summary.igst)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.b2b.summary.invoiceValue)}</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><Badge color="cyan" variant="light">IMP-G</Badge> Import of Goods</Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}>{reportData.sections.importGoods.summary.count}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.importGoods.summary.taxableValue)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>-</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>-</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.importGoods.summary.igst)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.importGoods.summary.invoiceValue)}</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><Badge color="violet" variant="light">IMP-S</Badge> Import of Services</Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}>{reportData.sections.importServices.summary.count}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.importServices.summary.taxableValue)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>-</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>-</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.importServices.summary.igst)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.importServices.summary.invoiceValue)}</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td><Badge color="gray" variant="light">NIL</Badge> Nil Rated / Exempt</Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}>{reportData.sections.nilRated.summary.count}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>-</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>-</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>-</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>-</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(reportData.sections.nilRated.summary.nilRated)}</Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                      <Table.Tfoot>
                        <Table.Tr style={{ backgroundColor: '#e8f5e9' }}>
                          <Table.Td><Text fw={700}>GRAND TOTAL</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}><Text fw={700}>{reportData.grandTotal.invoiceCount}</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text fw={700}>{formatCurrency(reportData.grandTotal.taxableValue)}</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="red.7">{formatCurrency(reportData.grandTotal.cgst)}</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="orange.7">{formatCurrency(reportData.grandTotal.sgst)}</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="blue.7">{formatCurrency(reportData.grandTotal.igst)}</Text></Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="green.7">{formatCurrency(reportData.grandTotal.invoiceValue)}</Text></Table.Td>
                        </Table.Tr>
                      </Table.Tfoot>
                    </Table>
                  </Paper>
                </Tabs.Panel>

                {/* B2B Tab */}
                <Tabs.Panel value="b2b" pt="md">
                  <Paper p="md" withBorder>
                    <Group justify="space-between" mb="md">
                      <div>
                        <Title order={4}>{reportData.sections.b2b.title}</Title>
                        <Text size="sm" c="dimmed">{reportData.sections.b2b.description}</Text>
                      </div>
                      <Badge color="blue" size="lg">{reportData.sections.b2b.summary.count} Invoices</Badge>
                    </Group>

                    {reportData.sections.b2b.invoices.length > 0 ? (
                      <ScrollArea>
                        <Table striped highlightOnHover withTableBorder>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>#</Table.Th>
                              <Table.Th>GSTIN</Table.Th>
                              <Table.Th>Supplier Name</Table.Th>
                              <Table.Th>Invoice No.</Table.Th>
                              <Table.Th>Invoice Date</Table.Th>
                              <Table.Th>Place of Supply</Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>Taxable Value</Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>CGST</Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>SGST</Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>IGST</Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>Invoice Value</Table.Th>
                              <Table.Th style={{ textAlign: 'center' }}>ITC Eligible</Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>ITC Amount</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {reportData.sections.b2b.invoices.map((inv, idx) => (
                              <Table.Tr key={inv._id || idx}>
                                <Table.Td>{idx + 1}</Table.Td>
                                <Table.Td><Text size="xs" ff="monospace">{inv.gstin || '-'}</Text></Table.Td>
                                <Table.Td>{inv.supplierName}</Table.Td>
                                <Table.Td><Text fw={500}>{inv.invoiceNumber}</Text></Table.Td>
                                <Table.Td>{formatDate(inv.invoiceDate)}</Table.Td>
                                <Table.Td>{inv.state}</Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(inv.taxableValue)}</Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(inv.cgst)}</Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(inv.sgst)}</Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(inv.igst)}</Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}><Text fw={600}>{formatCurrency(inv.invoiceValue)}</Text></Table.Td>
                                <Table.Td style={{ textAlign: 'center' }}>
                                  {inv.itcEligible !== false ? (
                                    <Badge color="green" variant="light" leftSection={<IconCheck style={{ width: 12, height: 12 }} />}>Yes</Badge>
                                  ) : (
                                    <Tooltip label={inv.itcReason || 'Not eligible'}>
                                      <Badge color="red" variant="light" leftSection={<IconX style={{ width: 12, height: 12 }} />}>No</Badge>
                                    </Tooltip>
                                  )}
                                </Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>
                                  <Text fw={600} c="green.7">
                                    {formatCurrency((inv.itcCgst || 0) + (inv.itcSgst || 0) + (inv.itcIgst || 0))}
                                  </Text>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                          <Table.Tfoot>
                            <Table.Tr style={{ backgroundColor: '#f0f0f0' }}>
                              <Table.Td colSpan={6}><Text fw={700}>TOTAL</Text></Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}><Text fw={700}>{formatCurrency(reportData.sections.b2b.summary.taxableValue)}</Text></Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}><Text fw={700}>{formatCurrency(reportData.sections.b2b.summary.cgst)}</Text></Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}><Text fw={700}>{formatCurrency(reportData.sections.b2b.summary.sgst)}</Text></Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}><Text fw={700}>{formatCurrency(reportData.sections.b2b.summary.igst)}</Text></Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}><Text fw={700}>{formatCurrency(reportData.sections.b2b.summary.invoiceValue)}</Text></Table.Td>
                              <Table.Td></Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text fw={700} c="green.7">
                                  {formatCurrency(reportData.sections.b2b.summary.itcCgst + reportData.sections.b2b.summary.itcSgst + reportData.sections.b2b.summary.itcIgst)}
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          </Table.Tfoot>
                        </Table>
                      </ScrollArea>
                    ) : (
                      <Center py="xl">
                        <Stack align="center">
                          <IconBuilding size={48} color="gray" />
                          <Text c="dimmed">No B2B purchase invoices found for this period</Text>
                        </Stack>
                      </Center>
                    )}
                  </Paper>
                </Tabs.Panel>

                {/* Imports Tab */}
                <Tabs.Panel value="imports" pt="md">
                  <Paper p="md" withBorder>
                    <Group justify="space-between" mb="md">
                      <div>
                        <Title order={4}>Import of Goods & Services</Title>
                        <Text size="sm" c="dimmed">Inward supplies from overseas with IGST paid</Text>
                      </div>
                    </Group>

                    <Center py="xl">
                      <Stack align="center">
                        <IconWorld size={48} color="gray" />
                        <Text c="dimmed">No import invoices found for this period</Text>
                        <Text size="xs" c="dimmed">Import transactions will appear here when recorded</Text>
                      </Stack>
                    </Center>
                  </Paper>
                </Tabs.Panel>

                {/* Nil Rated Tab */}
                <Tabs.Panel value="nilRated" pt="md">
                  <Paper p="md" withBorder>
                    <Group justify="space-between" mb="md">
                      <div>
                        <Title order={4}>{reportData.sections.nilRated.title}</Title>
                        <Text size="sm" c="dimmed">{reportData.sections.nilRated.description}</Text>
                      </div>
                      <Badge color="gray" size="lg">{reportData.sections.nilRated.summary.count} Supplies</Badge>
                    </Group>

                    {reportData.sections.nilRated.supplies.length > 0 ? (
                      <Table striped highlightOnHover withTableBorder>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>#</Table.Th>
                            <Table.Th>Supplier Name</Table.Th>
                            <Table.Th>Invoice No.</Table.Th>
                            <Table.Th>Invoice Date</Table.Th>
                            <Table.Th>Supply Type</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>Invoice Value</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {reportData.sections.nilRated.supplies.map((supply, idx) => (
                            <Table.Tr key={supply._id || idx}>
                              <Table.Td>{idx + 1}</Table.Td>
                              <Table.Td>{supply.supplierName}</Table.Td>
                              <Table.Td>{supply.invoiceNumber}</Table.Td>
                              <Table.Td>{formatDate(supply.invoiceDate)}</Table.Td>
                              <Table.Td><Badge color="gray" variant="light">{supply.supplyType}</Badge></Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(supply.invoiceValue)}</Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    ) : (
                      <Center py="xl">
                        <Stack align="center">
                          <IconBan size={48} color="gray" />
                          <Text c="dimmed">No nil rated / exempt supplies found for this period</Text>
                        </Stack>
                      </Center>
                    )}
                  </Paper>
                </Tabs.Panel>
              </Tabs>

              {/* Tax Breakdown */}
              <Paper p="md" withBorder>
                <Title order={4} mb="md">Tax Breakdown</Title>
                <Grid>
                  <Grid.Col span={{ base: 6, md: 3 }}>
                    <Card p="md" bg="red.0" radius="md">
                      <Text size="xs" c="dimmed" tt="uppercase">CGST</Text>
                      <Text size="xl" fw={700} c="red.7">{formatCurrency(reportData.grandTotal.cgst)}</Text>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={{ base: 6, md: 3 }}>
                    <Card p="md" bg="orange.0" radius="md">
                      <Text size="xs" c="dimmed" tt="uppercase">SGST</Text>
                      <Text size="xl" fw={700} c="orange.7">{formatCurrency(reportData.grandTotal.sgst)}</Text>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={{ base: 6, md: 3 }}>
                    <Card p="md" bg="blue.0" radius="md">
                      <Text size="xs" c="dimmed" tt="uppercase">IGST</Text>
                      <Text size="xl" fw={700} c="blue.7">{formatCurrency(reportData.grandTotal.igst)}</Text>
                    </Card>
                  </Grid.Col>
                  <Grid.Col span={{ base: 6, md: 3 }}>
                    <Card p="md" bg="violet.0" radius="md">
                      <Text size="xs" c="dimmed" tt="uppercase">CESS</Text>
                      <Text size="xl" fw={700} c="violet.7">{formatCurrency(reportData.grandTotal.cess || 0)}</Text>
                    </Card>
                  </Grid.Col>
                </Grid>
              </Paper>
            </Stack>
          ) : (
            <Center py="xl">
              <Stack align="center">
                <IconFileInvoice size={48} color="gray" />
                <Text c="dimmed">Select a return period and click Generate to view GSTR-2 report</Text>
              </Stack>
            </Center>
          )}
        </div>
      </Paper>
    </Container>
  );
};

export default VyaparGSTR2;
