import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, Title, Text, Group, Stack, SimpleGrid,
  Card, Badge, Tabs, Table, Loader, Center, Button,
  ScrollArea, TextInput, Pagination, ActionIcon
} from '@mantine/core';
import {
  IconArrowLeft, IconUsers, IconUserCheck,
  IconGenderMale, IconBuildingCommunity,
  IconRefresh, IconPrinter, IconSearch, IconEye, IconFileSpreadsheet
} from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import { farmerAPI } from '../../services/api';
import { printReport } from '../../utils/printReport';

const StatCard = ({ label, value, color }) => (
  <Card withBorder radius="md" p="md">
    <Text size="xs" c="dimmed" mb={4}>{label}</Text>
    <Text size="xl" fw={700} c={color}>{value ?? 0}</Text>
  </Card>
);

const SummaryTable = ({ columns, rows, onRowClick, selectedKey }) => (
  <ScrollArea>
    <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
      <Table.Thead>
        <Table.Tr>
          {columns.map(c => (
            <Table.Th key={c.key} ta={c.align || 'left'}>{c.label}</Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={columns.length}>
              <Center py="md"><Text c="dimmed" size="sm">No data</Text></Center>
            </Table.Td>
          </Table.Tr>
        ) : rows.map((row, i) => (
          <Table.Tr
            key={i}
            onClick={() => onRowClick && onRowClick(row)}
            style={onRowClick ? { cursor: 'pointer' } : {}}
            bg={selectedKey !== undefined && row._key === selectedKey ? 'var(--mantine-color-blue-light)' : undefined}
          >
            {columns.map(c => (
              <Table.Td key={c.key} ta={c.align || 'left'}>
                {c.render ? c.render(row) : row[c.key]}
              </Table.Td>
            ))}
          </Table.Tr>
        ))}
        {rows.length > 0 && (
          <Table.Tr fw={700} bg="var(--mantine-color-gray-light)">
            {columns.map((c, ci) => (
              <Table.Td key={c.key} ta={c.align || 'left'}>
                {c.total ? rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0) : ci === 0 ? 'Total' : ''}
              </Table.Td>
            ))}
          </Table.Tr>
        )}
      </Table.Tbody>
    </Table>
  </ScrollArea>
);

const FarmerList = ({ filters }) => {
  const navigate = useNavigate();
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 15;

  const filtersKey = JSON.stringify(filters);

  const fetchFarmers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_SIZE, search, ...filters };
      const res = await farmerAPI.getAll(params);
      if (res?.success) {
        setFarmers(res.data || []);
        setTotal(res.pagination?.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, filtersKey]);

  useEffect(() => { setPage(1); }, [filtersKey]);
  useEffect(() => { fetchFarmers(); }, [fetchFarmers]);

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <Stack gap="xs" mt="md">
      <Group justify="space-between" data-no-print>
        <TextInput
          placeholder="Search name / farmer no."
          leftSection={<IconSearch size={14} />}
          size="xs"
          value={search}
          onChange={e => { setSearch(e.currentTarget.value); setPage(1); }}
          w={240}
        />
        <Text size="xs" c="dimmed">{total} farmer(s)</Text>
      </Group>

      {loading ? (
        <Center py="xl"><Loader size="sm" /></Center>
      ) : (
        <>
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder withColumnBorders fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Farmer No.</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Gender</Table.Th>
                  <Table.Th>Caste</Table.Th>
                  <Table.Th>Centre</Table.Th>
                  <Table.Th>Member</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th data-no-print></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {farmers.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={9}>
                      <Center py="md"><Text c="dimmed" size="sm">No farmers found</Text></Center>
                    </Table.Td>
                  </Table.Tr>
                ) : farmers.map((f, i) => (
                  <Table.Tr key={f._id}>
                    <Table.Td>{(page - 1) * PAGE_SIZE + i + 1}</Table.Td>
                    <Table.Td>{f.farmerNumber}</Table.Td>
                    <Table.Td>{f.personalDetails?.name}</Table.Td>
                    <Table.Td>{f.personalDetails?.gender || '—'}</Table.Td>
                    <Table.Td>{f.personalDetails?.caste || '—'}</Table.Td>
                    <Table.Td>{f.collectionCenter?.centerName || '—'}</Table.Td>
                    <Table.Td>{f.isMembership ? 'Member' : 'Non-Member'}</Table.Td>
                    <Table.Td>{f.status}</Table.Td>
                    <Table.Td data-no-print>
                      <ActionIcon size="xs" variant="subtle" onClick={() => navigate(`/farmers/view/${f._id}`)}>
                        <IconEye size={13} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          {pages > 1 && (
            <Center data-no-print>
              <Pagination total={pages} value={page} onChange={setPage} size="xs" />
            </Center>
          )}
        </>
      )}
    </Stack>
  );
};

const FarmerReport = () => {
  const navigate = useNavigate();
  const printRef = useRef(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('member');
  const [drillFilter, setDrillFilter] = useState({});

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await farmerAPI.getReport();
      if (res?.success) setReportData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, []);
  useEffect(() => { setDrillFilter({}); }, [activeTab]);

  const summary = reportData?.summary || {};

  const memberRows = (reportData?.memberReport || []).map(r => ({
    _key: String(r._id),
    status: r._id ? 'Member' : 'Non-Member',
    count: r.count,
    male: r.male,
    female: r.female,
    active: r.active,
    isMembership: r._id
  }));

  const casteRows = (reportData?.casteReport || []).map(r => ({
    _key: String(r._id),
    caste: r._id || 'Not Specified',
    count: r.count,
    members: r.members,
    nonMembers: r.nonMembers,
    male: r.male,
    female: r.female
  }));

  const genderRows = (reportData?.genderReport || []).map(r => ({
    _key: String(r._id),
    gender: r._id || 'Not Specified',
    count: r.count,
    members: r.members,
    nonMembers: r.nonMembers
  }));

  const centreRows = (reportData?.centreReport || []).map(r => ({
    _key: String(r._id?.centreId),
    centreName: r._id?.centreName || 'No Centre Assigned',
    centreId: r._id?.centreId,
    count: r.count,
    members: r.members,
    nonMembers: r.nonMembers,
    male: r.male,
    female: r.female
  }));

  // ── Excel Export — all 5 sheets in one file ───────────────────────────────
  const handleExcelExport = () => {
    if (!reportData) return;
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summarySheet = XLSX.utils.json_to_sheet([
      { Category: 'Total Farmers',  Count: summary.total },
      { Category: 'Members',        Count: summary.members },
      { Category: 'Non-Members',    Count: summary.nonMembers },
      { Category: 'Active',         Count: summary.active },
      { Category: 'Male',           Count: summary.male },
      { Category: 'Female',         Count: summary.female }
    ]);
    summarySheet['!cols'] = [{ wch: 20 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // Member / Non-Member sheet
    const memSheet = XLSX.utils.json_to_sheet(
      memberRows.map(r => ({ Status: r.status, Total: r.count, Male: r.male, Female: r.female, Active: r.active }))
    );
    memSheet['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, memSheet, 'Member Report');

    // Caste sheet
    const casteSheet = XLSX.utils.json_to_sheet(
      casteRows.map(r => ({ Caste: r.caste, Total: r.count, Members: r.members, 'Non-Members': r.nonMembers, Male: r.male, Female: r.female }))
    );
    casteSheet['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, casteSheet, 'Caste Report');

    // Gender sheet
    const genderSheet = XLSX.utils.json_to_sheet(
      genderRows.map(r => ({ Gender: r.gender, Total: r.count, Members: r.members, 'Non-Members': r.nonMembers }))
    );
    genderSheet['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, genderSheet, 'Gender Report');

    // Centre sheet
    const centreSheet = XLSX.utils.json_to_sheet(
      centreRows.map(r => ({ 'Collection Centre': r.centreName, Total: r.count, Members: r.members, 'Non-Members': r.nonMembers, Male: r.male, Female: r.female }))
    );
    centreSheet['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, centreSheet, 'Centre Report');

    XLSX.writeFile(wb, `farmer_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => printReport(printRef, { title: 'Farmer Report', orientation: 'landscape' });

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Group justify="space-between" mb="md" data-no-print>
        <Group>
          <ActionIcon variant="subtle" onClick={() => navigate('/farmers')}>
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Title order={3}>Farmer Report</Title>
        </Group>
        <Group>
          <Button leftSection={<IconRefresh size={14} />} variant="light" size="xs" onClick={fetchReport} loading={loading}>
            Refresh
          </Button>
          <Button leftSection={<IconFileSpreadsheet size={14} />} color="green" variant="light" size="xs" onClick={handleExcelExport} disabled={!reportData}>
            Export Excel
          </Button>
          <Button leftSection={<IconPrinter size={14} />} variant="light" size="xs" onClick={handlePrint} disabled={!reportData}>
            Print
          </Button>
        </Group>
      </Group>

      {loading && !reportData ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <div ref={printRef}>
          <Stack gap="md">
            {/* Summary Cards */}
            <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }}>
              <StatCard label="Total Farmers" value={summary.total} color="blue" />
              <StatCard label="Members" value={summary.members} color="green" />
              <StatCard label="Non-Members" value={summary.nonMembers} color="orange" />
              <StatCard label="Active" value={summary.active} color="teal" />
              <StatCard label="Male" value={summary.male} color="indigo" />
              <StatCard label="Female" value={summary.female} color="pink" />
            </SimpleGrid>

            {/* Tabbed Reports */}
            <Paper withBorder radius="md" p="md">
              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List mb="md" data-no-print>
                  <Tabs.Tab value="member" leftSection={<IconUserCheck size={14} />}>Member / Non-Member</Tabs.Tab>
                  <Tabs.Tab value="caste" leftSection={<IconUsers size={14} />}>Caste-wise</Tabs.Tab>
                  <Tabs.Tab value="gender" leftSection={<IconGenderMale size={14} />}>Gender-wise</Tabs.Tab>
                  <Tabs.Tab value="centre" leftSection={<IconBuildingCommunity size={14} />}>Centre-wise</Tabs.Tab>
                </Tabs.List>

                {/* ── Member / Non-Member ── */}
                <Tabs.Panel value="member">
                  <Text size="sm" c="dimmed" mb="xs" data-no-print>Click a row to see the farmer list below.</Text>
                  <SummaryTable
                    columns={[
                      { key: 'status', label: 'Status' },
                      { key: 'count', label: 'Total', align: 'right', total: true },
                      { key: 'male', label: 'Male', align: 'right', total: true },
                      { key: 'female', label: 'Female', align: 'right', total: true },
                      { key: 'active', label: 'Active', align: 'right', total: true }
                    ]}
                    rows={memberRows}
                    selectedKey={drillFilter.isMembership !== undefined ? String(drillFilter.isMembership) : undefined}
                    onRowClick={row => setDrillFilter(
                      drillFilter.isMembership === row.isMembership ? {} : { isMembership: row.isMembership }
                    )}
                  />
                  <FarmerList
                    filters={drillFilter.isMembership !== undefined ? { isMembership: String(drillFilter.isMembership) } : {}}
                  />
                </Tabs.Panel>

                {/* ── Caste-wise ── */}
                <Tabs.Panel value="caste">
                  <Text size="sm" c="dimmed" mb="xs" data-no-print>Click a row to filter farmer list by caste.</Text>
                  <SummaryTable
                    columns={[
                      { key: 'caste', label: 'Caste' },
                      { key: 'count', label: 'Total', align: 'right', total: true },
                      { key: 'members', label: 'Members', align: 'right', total: true },
                      { key: 'nonMembers', label: 'Non-Members', align: 'right', total: true },
                      { key: 'male', label: 'Male', align: 'right', total: true },
                      { key: 'female', label: 'Female', align: 'right', total: true }
                    ]}
                    rows={casteRows}
                    selectedKey={drillFilter._casteKey !== undefined ? drillFilter._casteKey : undefined}
                    onRowClick={row => {
                      const casteVal = row.caste === 'Not Specified' ? '' : row.caste;
                      setDrillFilter(prev => prev._casteKey === row._key ? {} : { casteFilter: casteVal, _casteKey: row._key });
                    }}
                  />
                  <FarmerList
                    filters={drillFilter.casteFilter !== undefined ? { casteFilter: drillFilter.casteFilter } : {}}
                  />
                </Tabs.Panel>

                {/* ── Gender-wise ── */}
                <Tabs.Panel value="gender">
                  <Text size="sm" c="dimmed" mb="xs" data-no-print>Click a row to filter farmer list by gender.</Text>
                  <SummaryTable
                    columns={[
                      { key: 'gender', label: 'Gender' },
                      { key: 'count', label: 'Total', align: 'right', total: true },
                      { key: 'members', label: 'Members', align: 'right', total: true },
                      { key: 'nonMembers', label: 'Non-Members', align: 'right', total: true }
                    ]}
                    rows={genderRows}
                    selectedKey={drillFilter._genderKey !== undefined ? drillFilter._genderKey : undefined}
                    onRowClick={row => {
                      const gVal = row.gender === 'Not Specified' ? '' : row.gender;
                      setDrillFilter(prev => prev._genderKey === row._key ? {} : { gender: gVal, _genderKey: row._key });
                    }}
                  />
                  <FarmerList
                    filters={drillFilter.gender !== undefined ? { gender: drillFilter.gender } : {}}
                  />
                </Tabs.Panel>

                {/* ── Centre-wise ── */}
                <Tabs.Panel value="centre">
                  <Text size="sm" c="dimmed" mb="xs" data-no-print>Click a row to filter farmer list by collection centre.</Text>
                  <SummaryTable
                    columns={[
                      { key: 'centreName', label: 'Collection Centre' },
                      { key: 'count', label: 'Total', align: 'right', total: true },
                      { key: 'members', label: 'Members', align: 'right', total: true },
                      { key: 'nonMembers', label: 'Non-Members', align: 'right', total: true },
                      { key: 'male', label: 'Male', align: 'right', total: true },
                      { key: 'female', label: 'Female', align: 'right', total: true }
                    ]}
                    rows={centreRows}
                    selectedKey={drillFilter.centreId !== undefined ? String(drillFilter.centreId ?? '') : undefined}
                    onRowClick={row => {
                      setDrillFilter(prev =>
                        prev.centreId === row.centreId ? {} : { centreId: row.centreId, collectionCenter: row.centreId || null }
                      );
                    }}
                  />
                  <FarmerList
                    filters={drillFilter.collectionCenter !== undefined
                      ? (drillFilter.collectionCenter ? { collectionCenter: drillFilter.collectionCenter } : {})
                      : {}}
                  />
                </Tabs.Panel>
              </Tabs>
            </Paper>
          </Stack>
        </div>
      )}
    </Container>
  );
};

export default FarmerReport;
