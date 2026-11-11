/**
 * Producer Dues → Regional Reports → Milk Bill (Karur, Tamil Nadu)
 *
 * Built on Milk Bill (Producers): same bill heading, info bar and day-wise milk
 * collection table, but without the deduction detail. Previous balance and Net
 * Payable come from the cycle's saved Payment Register (settled) entry (the
 * Producer Dues figures). Company header + logo from Settings → Society Info.
 *
 * Print: A4 portrait, bills one under another — two to a page when they fit
 * (a 10-day cycle is about half a page), never split across pages.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Container, Paper, Group, Text, Button, Select, MultiSelect, Badge, Alert, Center, Loader, ScrollArea, Box, Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPrinter, IconRefresh, IconAlertCircle } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { milkBillAPI, karurPaymentRegisterAPI, societyInfoAPI } from '../../services/api';
import { useCompany } from '../../context/CompanyContext';
import { BILL_CSS, billHtml, printBills, fD } from '../../utils/milkBillKarurPrint';

/* ══════════════════════════════════════════════════════════════════════════════ */
export default function MilkBillKarur() {
  const { selectedCompany } = useCompany();
  const [centres, setCentres] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [centerId, setCenterId] = useState(null);
  const [producers, setProducers] = useState([]);
  const [selected, setSelected] = useState([]);     // [] = all producers of the centre
  const [cycleId, setCycleId] = useState(null);
  const [loadingOpts, setLoadingOpts] = useState(true);
  const [loadingProd, setLoadingProd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bills, setBills] = useState(null);
  const [error, setError] = useState('');
  const [society, setSociety] = useState({ info: null, logo: '' });

  // Centres + saved payment cycles (same cycle list as Payment Register (Karur))
  useEffect(() => {
    karurPaymentRegisterAPI.getOptions()
      .then((res) => {
        const d = res.data || {};
        setCentres((d.centres || []).map((c) => ({ value: String(c._id), label: [c.centerCode, c.centerName].filter(Boolean).join(' - ') })));
        const list = (d.cycles || []).map((c) => ({
          value: String(c.sourceRegisterId),
          label: `${fD(c.fromDate)} – ${fD(c.toDate)}  (${dayjs(c.toDate).diff(dayjs(c.fromDate), 'day') + 1} days)`,
          fromDate: c.fromDate, toDate: c.toDate,
        }));
        setCycles(list);
        if (list.length) setCycleId((p) => p || list[0].value);
      })
      .catch((err) => notifications.show({ color: 'red', message: err?.message || 'Could not load centres / cycles' }))
      .finally(() => setLoadingOpts(false));
    // Society Info: details + the logo already uploaded there
    Promise.all([societyInfoAPI.get().catch(() => null), societyInfoAPI.getBranding().catch(() => null)])
      .then(([info, brand]) => setSociety({ info: info?.data?.info || null, logo: brand?.data?.logo || info?.data?.info?.logo || '' }));
  }, []);

  // Producers of the selected centre only
  useEffect(() => {
    setProducers([]);
    setSelected([]);
    setBills(null);
    if (!centerId) return;
    setLoadingProd(true);
    milkBillAPI.getKarurProducers(centerId)
      .then((res) => setProducers((res.data || []).map((p) => ({
        value: String(p._id),
        label: `${p.producerId} — ${p.name}${p.status && p.status !== 'Active' ? ` (${p.status})` : ''}`,
      }))))
      .catch((err) => notifications.show({ color: 'red', message: err?.message || 'Could not load producers' }))
      .finally(() => setLoadingProd(false));
  }, [centerId]);

  const cycle = useMemo(() => cycles.find((c) => c.value === cycleId) || null, [cycles, cycleId]);

  const org = useMemo(() => {
    const i = society.info || {};
    return {
      name: (i.societyName || selectedCompany?.societyName || selectedCompany?.companyName || 'DAIRY CO-OPERATIVE SOCIETY').trim(),
      code: (i.societyCode || '').trim(),
      address: [i.doorNo, i.city, [i.state, i.pinCode].filter(Boolean).join(' - ')].map((x) => (x || '').trim()).filter(Boolean).join(', ')
        || selectedCompany?.address || '',
      contact: [i.phone ? `Ph: ${i.phone}` : '', i.email ? `Email: ${i.email}` : ''].filter(Boolean).join('  |  '),
      logo: society.logo,
    };
  }, [society, selectedCompany]);

  const generate = useCallback(async () => {
    if (!centerId) return notifications.show({ color: 'orange', message: 'Select a center' });
    if (!cycle) return notifications.show({ color: 'orange', message: 'Select a payment cycle' });
    setLoading(true);
    setError('');
    setBills(null);
    try {
      const res = await milkBillAPI.getKarurBills({
        fromDate: dayjs(cycle.fromDate).format('YYYY-MM-DD'),
        toDate: dayjs(cycle.toDate).format('YYYY-MM-DD'),
        centerId,
        farmerIds: selected.join(','),
      });
      setBills(res.bills || []);
    } catch (err) {
      setError(err?.message || 'Could not generate the milk bills');
    } finally {
      setLoading(false);
    }
  }, [centerId, cycle, selected]);

  const titleOf = (list) => (list.length === 1
    ? `Milk Bill ${list[0].farmer?.producerId || ''} ${cycle?.label || ''}`
    : `Milk Bills ${centres.find((c) => c.value === centerId)?.label || ''} ${cycle?.label || ''}`);

  return (
    <Container fluid px="md" py="sm">
      <style>{`${BILL_CSS} .kb-screen .kb-bill { max-width: 820px; margin: 0 auto 14px; padding: 10px 12px; border: 1px solid #999; }`}</style>

      <Paper withBorder p="sm" radius="md" mb="md" style={{ background: '#f8f9fa' }}>
        <Text fw={700} mb={6}>Milk Bill (Karur, Tamil Nadu)</Text>
        <Group wrap="wrap" gap="sm" align="flex-end">
          <Select
            label="Center" w={220} data={centres} value={centerId} onChange={setCenterId}
            placeholder={loadingOpts ? 'Loading…' : 'Select center'} searchable nothingFoundMessage="No center" withAsterisk
          />
          <MultiSelect
            label="Producer (number or name)" w={380} data={producers} value={selected}
            onChange={(v) => { setSelected(v); setBills(null); }}
            placeholder={!centerId ? 'Select a center first' : loadingProd ? 'Loading…' : selected.length ? '' : 'All producers of the center — or search…'}
            searchable clearable disabled={!centerId} maxDropdownHeight={300} nothingFoundMessage="No producer in this center"
            rightSection={loadingProd ? <Loader size={14} /> : undefined} hidePickedOptions
          />
          <Select
            label="Payment Cycle" w={270} data={cycles} value={cycleId} onChange={(v) => { setCycleId(v); setBills(null); }}
            placeholder={loadingOpts ? 'Loading…' : 'No saved cycle'} nothingFoundMessage="No saved cycles" withAsterisk allowDeselect={false}
          />
          <Button leftSection={<IconRefresh size={14} />} loading={loading} onClick={generate}>Generate Report</Button>
          <Button leftSection={<IconPrinter size={14} />} variant="outline" disabled={!bills?.length}
            onClick={() => printBills(bills, org, titleOf(bills))}>
            Print All{bills?.length ? ` (${bills.length})` : ''}
          </Button>
          {bills && <Badge size="lg" variant="light" ml="auto">{bills.length} bill{bills.length !== 1 ? 's' : ''}</Badge>}
        </Group>
        <Text size="xs" c="dimmed" mt={6}>
          Leave Producer empty for all producers of the center. Cycles are the ones saved in Payment Register (settled); Net Payable is as settled there.
          Print: A4 portrait, two bills per page when they fit.
        </Text>
      </Paper>

      {error && <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">{error}</Alert>}
      {loading && <Center py="xl"><Loader /></Center>}
      {!loading && !bills && !error && (
        <Center py="xl"><Text c="dimmed" size="sm">Select the center, producer(s) and payment cycle, then click <b>Generate Report</b>.</Text></Center>
      )}
      {!loading && bills?.length === 0 && (
        <Center py="xl"><Text c="dimmed" size="sm">No bills — none of the selected producers has milk or a settled amount in this cycle.</Text></Center>
      )}

      {!loading && bills?.length > 0 && (
        <ScrollArea h="calc(100vh - 230px)" type="always" offsetScrollbars>
          <div className="kb-screen">
            {bills.map((b) => (
              <Box key={b.farmer?._id} pos="relative">
                <Group justify="center" mb={4}>
                  <Tooltip label="Print only this producer's bill">
                    <Button size="compact-xs" variant="light" leftSection={<IconPrinter size={12} />}
                      onClick={() => printBills([b], org, titleOf([b]))}>
                      Print {b.farmer?.producerId}
                    </Button>
                  </Tooltip>
                </Group>
                {/* eslint-disable-next-line react/no-danger -- every value is escaped in billHtml */}
                <div dangerouslySetInnerHTML={{ __html: billHtml(b, org) }} />
              </Box>
            ))}
          </div>
        </ScrollArea>
      )}
    </Container>
  );
}
