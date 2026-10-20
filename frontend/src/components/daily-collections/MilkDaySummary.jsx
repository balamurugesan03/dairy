import { useEffect, useState } from 'react';
import { Box, Group, Text, Select, Badge, ActionIcon, Loader } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconBuilding, IconUser, IconTrophy } from '@tabler/icons-react';
import { milkCollectionAPI } from '../../services/api';
import { localDateStr } from '../../utils/dateUtils';

const EMPTY = {
  purchase: { count: 0, farmers: 0, qty: 0, kg: 0, amount: 0, avgFat: 0, avgClr: 0, avgSnf: 0, avgRate: 0 },
  sales: { LOCAL: { litre: 0, amount: 0 }, CREDIT: { litre: 0, amount: 0 }, SAMPLE: { litre: 0, amount: 0 } },
  bestFarmer: null,
  centres: [],
};

const n2 = (v) => Number(v || 0).toFixed(2);
const n1 = (v) => Number(v || 0).toFixed(1);
const rs = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// One summary tile — every tile shares the same label / value / sub layout so
// the two rows line up column for column.
const Tile = ({ label, value, sub, tone = '#1e3a8a', bg = '#f8fafc', border = '#e2e8f0', span = 1, strong }) => (
  <Box className="mds-tile" style={{
    gridColumn: `span ${span}`, background: strong ? tone : bg,
    border: `1.5px solid ${strong ? tone : border}`, borderRadius: 8,
    padding: '6px 10px', minHeight: 58, minWidth: 0,
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
  }}>
    <Text size="11px" fw={700} tt="uppercase" c={strong ? 'rgba(255,255,255,0.8)' : '#64748b'} style={{ letterSpacing: '0.4px', lineHeight: 1.2 }} truncate="end">{label}</Text>
    <Text size="19px" fw={900} c={strong ? 'white' : tone} style={{ lineHeight: 1.25, whiteSpace: 'nowrap' }}>{value}</Text>
    {sub != null && <Text size="12px" fw={700} c={strong ? 'rgba(255,255,255,0.85)' : tone} style={{ lineHeight: 1.2, opacity: strong ? 1 : 0.8, whiteSpace: 'nowrap' }}>{sub}</Text>}
  </Box>
);

const RowLabel = ({ children, color }) => (
  <Box className="mds-rowlabel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: color, borderRadius: 8, padding: '0 4px' }}>
    <Text size="11px" fw={800} c="white" tt="uppercase" ta="center" style={{ letterSpacing: '0.5px', lineHeight: 1.25 }}>{children}</Text>
  </Box>
);

/**
 * Milk Purchase screen summary: purchase + sales totals for the day / shift
 * with a Best Farmer card on the right.
 *   • Admin view   — combined totals of every centre & agent, with optional
 *                    Centre / Agent filters.
 *   • Regular user — the server limits the totals to the user's own centre /
 *                    agent; no filters are offered.
 */
export default function MilkDaySummary({ date, shift, adminView, centres = [], agents = [], scopeLabel, refreshKey }) {
  const [data, setData]       = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [fCentre, setFCentre] = useState(null);
  const [fAgent, setFAgent]   = useState(null);
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('milkPurchase_summaryOpen') !== '0'; } catch { return true; }
  });

  const toggle = () => setOpen(o => {
    try { localStorage.setItem('milkPurchase_summaryOpen', o ? '0' : '1'); } catch { /* ignore */ }
    return !o;
  });

  const dateStr = date ? localDateStr(date instanceof Date ? date : new Date(date)) : '';

  useEffect(() => {
    if (!dateStr) return undefined;
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = { date: dateStr, shift };
        if (adminView && fCentre) params.collectionCenter = fCentre;
        if (adminView && fAgent)  params.agent = fAgent;
        const res = await milkCollectionAPI.getDaySummary(params);
        if (alive && res?.data) setData({ ...EMPTY, ...res.data });
      } catch { /* keep last */ }
      finally { if (alive) setLoading(false); }
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [dateStr, shift, adminView, fCentre, fAgent, refreshKey]);

  const p = data.purchase;
  const s = data.sales;
  const salesLtr = s.LOCAL.litre + s.CREDIT.litre + s.SAMPLE.litre;
  const salesAmt = s.LOCAL.amount + s.CREDIT.amount + s.SAMPLE.amount;
  const unionLtr = Math.max(0, p.qty - salesLtr);
  const best = data.bestFarmer;

  const agentOptions = agents
    .filter(a => !fCentre || a.centerId === fCentre)
    .map(({ value, label }) => ({ value, label }));

  const scopeText = adminView
    ? [fCentre ? centres.find(c => c.value === fCentre)?.label : 'All Centres',
       fAgent ? agents.find(a => a.value === fAgent)?.label : 'All Agents'].join(' · ')
    : scopeLabel;

  return (
    <Box className="mds-root" style={{ background: 'white', border: '1px solid #bfdbfe', borderTop: '2px solid #dbeafe', borderRadius: '0 0 10px 10px', padding: '6px 10px 8px' }}>
      <style>{`
        .mds-body { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 8px; }
        .mds-grid { display: grid; grid-template-columns: 74px repeat(7, minmax(0, 1fr)); gap: 6px; }
        @media (max-width: 1100px) {
          .mds-body { grid-template-columns: minmax(0, 1fr); }
          .mds-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .mds-grid .mds-tile { grid-column: span 1 !important; }
          .mds-grid .mds-rowlabel { grid-column: span 2; min-height: 22px; }
        }
      `}</style>

      {/* Header — title, scope and (admin) Centre / Agent filters */}
      <Group justify="space-between" wrap="wrap" gap={8} mb={open ? 6 : 0}>
        <Group gap={8} wrap="nowrap">
          <Text size="13px" fw={800} c="#1e3a8a" tt="uppercase" style={{ letterSpacing: '0.5px' }}>Summary</Text>
          <Badge size="md" radius="sm" variant="light" color="blue">{dateStr.split('-').reverse().join('-')} · {shift}</Badge>
          <Badge size="md" radius="sm" variant="light" color={adminView ? 'grape' : 'teal'}>{scopeText}</Badge>
          {loading && <Loader size={14} />}
        </Group>
        <Group gap={6} wrap="nowrap">
          {adminView && open && (
            <>
              <Select
                value={fCentre} onChange={v => { setFCentre(v); setFAgent(null); }}
                data={centres} placeholder="All Centres" clearable searchable
                leftSection={<IconBuilding size={13} color="#7c3aed" />}
                size="xs" radius="md" style={{ width: 170 }} comboboxProps={{ zIndex: 1000 }}
              />
              <Select
                value={fAgent} onChange={setFAgent}
                data={agentOptions} placeholder="All Agents" clearable searchable
                nothingFoundMessage="No agents"
                leftSection={<IconUser size={13} color="#7c3aed" />}
                size="xs" radius="md" style={{ width: 170 }} comboboxProps={{ zIndex: 1000 }}
              />
            </>
          )}
          <ActionIcon size="sm" variant="light" color="blue" onClick={toggle} title={open ? 'Hide summary' : 'Show summary'}>
            {open ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
          </ActionIcon>
        </Group>
      </Group>

      {open && (
        <Box className="mds-body">
          <Box className="mds-grid">
            <RowLabel color="#1e40af">Milk Purchase</RowLabel>
            <Tile label="Farmers" value={p.farmers} sub={`${p.count} records`} tone="#334155" />
            <Tile label="FAT Avg" value={n1(p.avgFat)} tone="#c2410c" bg="#fff7ed" border="#fed7aa" />
            <Tile label="CLR Avg" value={n1(p.avgClr)} tone="#6d28d9" bg="#f5f3ff" border="#ddd6fe" />
            <Tile label="SNF Avg" value={n2(p.avgSnf)} tone="#166534" bg="#f0fdf4" border="#86efac" />
            <Tile label="Rate Avg" value={rs(p.avgRate)} tone="#1e40af" bg="#eff6ff" border="#bfdbfe" />
            <Tile label="Total Qty" value={`${n2(p.qty)} L`} sub={`${n2(p.kg)} KG`} tone="#0369a1" bg="#f0f9ff" border="#bae6fd" />
            <Tile label="Total Amount" value={rs(p.amount)} tone="#1e40af" strong />

            <RowLabel color="#047857">Milk Sales</RowLabel>
            <Tile label="Local Sale"  value={`${n2(s.LOCAL.litre)} L`}  sub={rs(s.LOCAL.amount)}  tone="#065f46" bg="#ecfdf5" border="#6ee7b7" />
            <Tile label="Credit Sale" value={`${n2(s.CREDIT.litre)} L`} sub={rs(s.CREDIT.amount)} tone="#92400e" bg="#fffbeb" border="#fcd34d" />
            <Tile label="Sample Sale" value={`${n2(s.SAMPLE.litre)} L`} sub={rs(s.SAMPLE.amount)} tone="#0369a1" bg="#f0f9ff" border="#7dd3fc" />
            <Tile label="Total Sales" value={`${n2(salesLtr)} L`} sub={rs(salesAmt)} tone="#047857" bg="#f0fdf4" border="#86efac" span={2} />
            <Tile label="Union Sale (Purchase − Sales)" value={`${n2(unionLtr)} L`} sub={`${n2(p.qty)} − ${n2(salesLtr)}`} tone="#1e40af" bg="#eff6ff" border="#93c5fd" span={2} />
          </Box>

          {/* Best Farmer — highest rate of the day / shift in this scope */}
          <Box style={{
            background: 'linear-gradient(135deg,#fef9c3,#fde68a)', border: '1.5px solid #f59e0b', borderRadius: 10,
            padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0,
          }}>
            <Group gap={6} wrap="nowrap" mb={2}>
              <IconTrophy size={16} color="#b45309" />
              <Text size="12px" fw={800} c="#78350f" tt="uppercase" style={{ letterSpacing: '0.5px' }}>Best Farmer</Text>
            </Group>
            {best ? (
              <>
                <Group gap={6} wrap="nowrap">
                  <Badge size="md" color="orange" variant="filled" radius="sm">{best.farmerNumber}</Badge>
                  <Text size="18px" fw={800} c="#92400e" truncate="end" style={{ lineHeight: 1.25 }}>{best.farmerName || '—'}</Text>
                </Group>
                {best.centreName && <Text size="11px" fw={600} c="#a16207">{best.centreName}</Text>}
                <Text size="24px" fw={900} c="#b45309" style={{ lineHeight: 1.2 }}>{rs(best.rate)}<Text span size="13px" fw={700}>/Ltr</Text></Text>
                <Group gap={10} wrap="nowrap">
                  <Text size="12px" fw={700} c="#78350f">{n2(best.qty)} L</Text>
                  <Text size="12px" fw={700} c="#78350f">FAT {n1(best.fat)}</Text>
                  <Text size="12px" fw={700} c="#78350f">SNF {n2(best.snf)}</Text>
                </Group>
                <Text size="13px" fw={800} c="#92400e">{rs(best.amount)}</Text>
              </>
            ) : (
              <Text size="13px" c="#a16207" fw={600}>No entries yet</Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
