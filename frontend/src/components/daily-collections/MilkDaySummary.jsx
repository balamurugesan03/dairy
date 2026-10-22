import { memo, useEffect, useState } from 'react';
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
    padding: '2px 8px', minHeight: 40, minWidth: 0,
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
  }}>
    <Text size="10px" fw={700} tt="uppercase" c={strong ? 'rgba(255,255,255,0.8)' : '#64748b'} style={{ letterSpacing: '0.4px', lineHeight: 1.2 }} truncate="end">{label}</Text>
    <Text size="15px" fw={900} c={strong ? 'white' : tone} style={{ lineHeight: 1.25, whiteSpace: 'nowrap' }}>{value}</Text>
    {sub != null && <Text size="11px" fw={700} c={strong ? 'rgba(255,255,255,0.85)' : tone} style={{ lineHeight: 1.2, opacity: strong ? 1 : 0.8, whiteSpace: 'nowrap' }}>{sub}</Text>}
  </Box>
);

const RowLabel = ({ children, color }) => (
  <Box className="mds-rowlabel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: color, borderRadius: 8, padding: '0 4px' }}>
    <Text size="10px" fw={800} c="white" tt="uppercase" ta="center" style={{ letterSpacing: '0.5px', lineHeight: 1.25 }}>{children}</Text>
  </Box>
);

/**
 * Milk Purchase screen summary: purchase + sales totals for the day / shift
 * with a Best Farmer ticker in the header.
 *   • Admin view   — combined totals of every centre & agent, with optional
 *                    Centre / Agent filters.
 *   • Regular user — the server limits the totals to the user's own centre /
 *                    agent; no filters are offered.
 */
function MilkDaySummary({ date, shift, adminView, centres = [], agents = [], scopeLabel, refreshKey }) {
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
    <Box className="mds-root" style={{ background: 'white', border: '1px solid #bfdbfe', borderTop: '2px solid #dbeafe', borderRadius: '0 0 10px 10px', padding: '4px 8px 5px', flexShrink: 0 }}>
      <style>{`
        .mds-grid { display: grid; grid-template-columns: 64px repeat(7, minmax(0, 1fr)); gap: 4px; }
        .mds-ticker { flex: 1; min-width: 120px; overflow: hidden; position: relative; height: 24px;
          background: linear-gradient(90deg,#fef9c3,#fde68a); border: 1px solid #f59e0b; border-radius: 6px; }
        .mds-ticker-track { position: absolute; top: 0; left: 0; height: 100%; display: flex; align-items: center;
          white-space: nowrap; padding-left: 100%; animation: mds-scroll 18s linear infinite; }
        .mds-ticker:hover .mds-ticker-track { animation-play-state: paused; }
        @keyframes mds-scroll { from { transform: translateX(0); } to { transform: translateX(-100%); } }
        @media (prefers-reduced-motion: reduce) {
          .mds-ticker-track { animation: none; padding-left: 8px; }
        }
        @media (max-width: 1100px) {
          .mds-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .mds-grid .mds-tile { grid-column: span 1 !important; }
          .mds-grid .mds-rowlabel { grid-column: span 2; min-height: 20px; }
        }
      `}</style>

      {/* Header — title, scope, Best Farmer ticker (fills the gap) and (admin) Centre / Agent filters */}
      <Group justify="space-between" wrap="nowrap" gap={8} mb={open ? 4 : 0}>
        <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
          <Text size="12px" fw={800} c="#1e3a8a" tt="uppercase" style={{ letterSpacing: '0.5px' }}>Summary</Text>
          <Badge size="sm" radius="sm" variant="light" color="blue">{dateStr.split('-').reverse().join('-')} · {shift}</Badge>
          <Badge size="sm" radius="sm" variant="light" color={adminView ? 'grape' : 'teal'}>{scopeText}</Badge>
          {loading && <Loader size={12} />}
        </Group>

        {/* Best Farmer — highest rate of the day / shift in this scope, as a news ticker */}
        <Box className="mds-ticker" title={best ? `Best Farmer: ${best.farmerNumber} ${best.farmerName || ''}` : 'Best Farmer'}>
          <Box className="mds-ticker-track">
            <IconTrophy size={14} color="#b45309" style={{ flexShrink: 0 }} />
            <Text span size="11px" fw={800} c="#78350f" tt="uppercase" ml={4} mr={8} style={{ letterSpacing: '0.5px' }}>Best Farmer</Text>
            {best ? (
              <>
                <Badge size="sm" color="orange" variant="filled" radius="sm" mr={6}>{best.farmerNumber}</Badge>
                <Text span size="13px" fw={800} c="#92400e" mr={10}>{best.farmerName || '—'}</Text>
                {best.centreName && <Text span size="11px" fw={600} c="#a16207" mr={10}>{best.centreName}</Text>}
                <Text span size="13px" fw={900} c="#b45309" mr={10}>{rs(best.rate)}/Ltr</Text>
                <Text span size="11px" fw={700} c="#78350f" mr={10}>{n2(best.qty)} L · FAT {n1(best.fat)} · SNF {n2(best.snf)}</Text>
                <Text span size="12px" fw={800} c="#92400e">{rs(best.amount)}</Text>
              </>
            ) : (
              <Text span size="11px" c="#a16207" fw={600}>No entries yet</Text>
            )}
          </Box>
        </Box>

        <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
          {adminView && open && (
            <>
              <Select
                value={fCentre} onChange={v => { setFCentre(v); setFAgent(null); }}
                data={centres} placeholder="All Centres" clearable searchable
                leftSection={<IconBuilding size={13} color="#7c3aed" />}
                size="xs" radius="md" style={{ width: 145 }} comboboxProps={{ zIndex: 1000 }}
              />
              <Select
                value={fAgent} onChange={setFAgent}
                data={agentOptions} placeholder="All Agents" clearable searchable
                nothingFoundMessage="No agents"
                leftSection={<IconUser size={13} color="#7c3aed" />}
                size="xs" radius="md" style={{ width: 145 }} comboboxProps={{ zIndex: 1000 }}
              />
            </>
          )}
          <ActionIcon size="sm" variant="light" color="blue" onClick={toggle} title={open ? 'Hide summary' : 'Show summary'}>
            {open ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
          </ActionIcon>
        </Group>
      </Group>

      {open && (
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
      )}
    </Box>
  );
}

// Memoised: the Milk Purchase form re-renders on every keystroke, the summary only needs its own props
export default memo(MilkDaySummary);
