import { useState, useEffect, useRef } from 'react';
import { Box, Group, Button, Select, Text, Paper, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPrinter, IconRefresh } from '@tabler/icons-react';
import { reportAPI } from '../../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
].map((label, i) => ({ value: String(i + 1), label }));

const CY = new Date().getFullYear();
const YEARS = Array.from({ length: CY - 2009 + 2 }, (_, i) => {
  const y = 2009 + i;
  return { value: String(y), label: String(y) };
}).reverse();

// ─── Initial form state ───────────────────────────────────────────────────────
const INIT = () => ({
  apcosNumber: '', district: '', societyCode: '',
  // 1.1
  memberQty: '', nonMemberQty: '', totalQty: '',
  localSalesLitre: '', schoolSalesLitre: '', dairyLitre: '',
  dairyKg: '', spoiledKg: '',
  societyFat: '', societySnf: '', dairyFat: '', dairySnf: '',
  // 1.2
  meetingDate: '', maleParticipants: '', femaleParticipants: '',
  obcParticipants: '', scstParticipants: '', totalParticipants: '',
  totalRegisteredMembers: '', pouringMembers: '', pouringNonMembers: '',
  followupMeetingDate: '', modelAward: '',
  // 2. Financial (editable inputs)
  dairySalesAmt: '', localSalesAmt: '', sampleSalesAmt: '',
  milkPurchaseAmt: '', tradeExpense: '', salary: '',
  otherIncome: '', otherExpenses: '',
  profitPercentage: '', avgPricePaidPerLitre: '', avgPriceFromUnionPerKg: '',
  // 6.2
  balancedFeedSales: '', milmaFeedBags: '', otherFeedBags: '', feedReceiptDate: '',
  newGrassCultivation: '', areaPerFarmer: '',
  baledStrawSales: '', baledStrawFarmers: '',
  strawPelletsSales: '', strawPelletsFarmers: '',
  mineralMixtureQty: '',
  // 7.
  milkContainerType: '', adKitUsage: '', cleaningChemicals: '',
  electronicScale: '', amcuImplemented: '', bmcCapacity: '', bmcAvgStorage: '',
  // 3.
  presidentGender: '', totalBoardMembers: '', milkPouringBoardMembers: '',
  lastGBMDate: '', nextElectionDate: '',
  // 4.
  programImplemented: '', implementationDate: '',
  boardMembersAttended: '', employeesTrained: '',
  // 5.
  farmerTrainingM: '', farmerTrainingF: '',
  studyVisitM: '', studyVisitF: '',
  boardTrainingM: '', boardTrainingF: '',
  secretaryTrainingM: '', secretaryTrainingF: '',
  productionMeansM: '', productionMeansF: '',
  penM: '', penF: '',
  // 6.
  aiNew: '', aiRepeat: '', aiAmount: '', twoWheeler: '',
  pregnancyPos: '', pregnancyNeg: '', infertiilityCamps: '',
  mastitisUsers: '', cattleShedSubsidy: '',
  // 8.
  wccpSubjects: '', wccpClasses: '', wccpHousesVisited: '', wccpAnand: '',
  // 9.
  t1Name: '', t1Parts: '', t1Target: '',
  t2Name: '', t2Parts: '', t2Target: '',
  t3Name: '', t3Parts: '', t3Target: '',
  // 10–12
  socialInsured: '', socialBeneficiaries: '', socialFunded: '',
  farmerInsured: '', farmerBeneficiaries: '', farmerFunded: '',
  auditYear: '', auditClass: '',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const n = v => Number(v) || 0;
const rs = v => Math.floor(n(v));
const ps = v => String(Math.round((n(v) % 1) * 100)).padStart(2, '0');

export default function MonthlyMISReport() {
  const [month,   setMonth]   = useState(String(new Date().getMonth() + 1));
  const [year,    setYear]    = useState(String(new Date().getFullYear()));
  const [form,    setForm]    = useState(INIT());
  const [loading, setLoading] = useState(false);
  const printRef = useRef(null);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // ── Computed financial totals ──────────────────────────────────────────────
  const totalIncome1   = n(form.dairySalesAmt) + n(form.localSalesAmt) + n(form.sampleSalesAmt);
  const totalExpense1  = n(form.milkPurchaseAmt) + n(form.tradeExpense);
  const tradeProfit    = totalIncome1 - totalExpense1;
  const totalIncome2   = tradeProfit + n(form.otherIncome);
  const totalExpenses2 = n(form.salary) + n(form.otherExpenses);
  const netProfit      = totalIncome2 - totalExpenses2;

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await reportAPI.monthlyMIS({ month, year });
      const d = res?.data || {};
      setForm(prev => ({
        ...prev,
        memberQty:             d.memberQty ?? '',
        nonMemberQty:          d.nonMemberQty ?? '',
        totalQty:              d.totalQty ?? '',
        localSalesLitre:       d.localLitre ?? '',
        schoolSalesLitre:      d.creditLitre ?? '',
        dairyLitre:            d.dairyLitre ?? '',
        societyFat:            d.avgFat ?? '',
        societySnf:            d.avgSnf ?? '',
        totalRegisteredMembers:d.totalRegisteredMembers ?? '',
        pouringMembers:        d.pouringMembers ?? '',
        pouringNonMembers:     d.pouringNonMembers ?? '',
        maleParticipants:      d.maleMembers ?? '',
        femaleParticipants:    d.femaleMembers ?? '',
        obcParticipants:       d.obcMembers ?? '',
        scstParticipants:      (n(d.scMembers) + n(d.stMembers)) || '',
        localSalesAmt:         d.localAmt ?? '',
        sampleSalesAmt:        d.sampleAmt ?? '',
        milkPurchaseAmt:       d.totalAmt ?? '',
        tradeExpense:          d.tradeExpenses ?? '',
        salary:                d.salary ?? '',
        otherIncome:           d.otherIncome ?? '',
        avgPricePaidPerLitre:  d.avgPricePaidToFarmer ?? '',
      }));
    } catch (err) {
      notifications.show({ color: 'red', message: err?.response?.data?.message || 'Load failed' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [month, year]); // eslint-disable-line

  const monthLabel = MONTHS.find(m => m.value === month)?.label || '';

  // ── Input cell ────────────────────────────────────────────────────────────
  const I = ({ f: fld, w = '100%', align = 'center', readOnly = false, val }) => (
    <input
      value={val !== undefined ? val : (form[fld] ?? '')}
      readOnly={readOnly}
      onChange={readOnly ? undefined : (e => set(fld, e.target.value))}
      style={{
        border: 'none', borderBottom: '1px dotted #444',
        outline: 'none', width: w, fontSize: 8,
        fontFamily: '"Times New Roman", serif',
        background: readOnly ? '#f5f5f5' : 'transparent',
        textAlign: align, padding: '0 2px',
      }}
    />
  );

  // ── Simple 2-col row inside left/right table ────────────────────────────
  const Row = ({ label, fld, val, readOnly }) => (
    <tr>
      <td style={LC}>{label}</td>
      <td style={VC}><I f={fld} val={val} readOnly={readOnly} /></td>
    </tr>
  );

  // Styles
  const SH  = { background: '#000', color: '#fff', fontWeight: 'bold', fontSize: 8, padding: '2px 4px', colSpan: 2 };
  const SSH = { background: '#ddd', fontWeight: 'bold', fontSize: 8, padding: '1px 3px' };
  const LC  = { fontSize: 8, padding: '1px 3px', width: '58%', fontFamily: '"Times New Roman", serif' };
  const VC  = { fontSize: 8, padding: '1px 3px', width: '42%', textAlign: 'center', fontFamily: '"Times New Roman", serif' };
  const TH  = { ...SSH, textAlign: 'center' };

  return (
    <Box p="md">
      <style>{`
        @media print {
          .mis-no-print { display: none !important; }
          body { margin: 0; padding: 0; background: white; }
          .mis-wrap { padding: 0 !important; }
          @page { size: A4 portrait; margin: 6mm 8mm; }
        }
        .mis-table { border-collapse: collapse; width: 100%; }
        .mis-table td, .mis-table th {
          border: 1px solid #000;
          padding: 1px 3px;
          font-size: 8px;
          font-family: "Times New Roman", serif;
          vertical-align: top;
        }
        input { font-family: "Times New Roman", serif; }
        input:focus { background: #fffde7; }
        @media print { input:focus, input { background: transparent !important; } }
      `}</style>

      {/* Controls */}
      <Paper className="mis-no-print" withBorder p="sm" mb="md">
        <Group>
          <Text fw={700} size="md">Monthly Report (MIS) — Dairy Co-operative Society</Text>
          <Select data={MONTHS} value={month} onChange={v => v && setMonth(v)} size="sm" style={{ width: 140 }} />
          <Select data={YEARS}  value={year}  onChange={v => v && setYear(v)}  size="sm" style={{ width: 90 }} />
          <Button size="sm" variant="light"
            leftSection={loading ? <Loader size={12} /> : <IconRefresh size={14} />}
            onClick={fetchData} loading={loading}>
            Load Data
          </Button>
          <Button size="sm" color="dark" leftSection={<IconPrinter size={14} />}
            onClick={() => window.print()}>
            Print A4
          </Button>
        </Group>
      </Paper>

      {/* ═══ PRINTABLE FORM ════════════════════════════════════════════════ */}
      <div className="mis-wrap" ref={printRef} style={{ background: '#fff', padding: '6px' }}>

        {/* Top header lines */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
          <tbody>
            <tr>
              <td style={{ border: 'none', fontSize: 9, fontFamily: '"Times New Roman", serif', padding: '1px 0' }}>
                Apcos Number&nbsp;
                <span style={{ display: 'inline-block', width: 220, borderBottom: '1px solid #000' }}>&nbsp;</span>
              </td>
            </tr>
            <tr>
              <td style={{ border: 'none', fontSize: 9, fontFamily: '"Times New Roman", serif', padding: '1px 0' }}>
                District&nbsp;
                <span style={{ display: 'inline-block', width: 240, borderBottom: '1px solid #000' }}>&nbsp;</span>
              </td>
            </tr>
            <tr>
              <td style={{ border: 'none', textAlign: 'center', padding: '4px 0 2px' }}>
                <span style={{ fontSize: 15, fontWeight: 'bold', fontFamily: '"Times New Roman", serif', textDecoration: 'underline' }}>
                  MONTHLY REPORT
                </span>
              </td>
            </tr>
            <tr>
              <td style={{ border: 'none', fontSize: 9, fontFamily: '"Times New Roman", serif', padding: '1px 0' }}>
                Society Code:&nbsp;
                <span style={{ display: 'inline-block', width: 80, borderBottom: '1px solid #000' }}>&nbsp;</span>
                &emsp; Month: <strong>{monthLabel}</strong>
                &emsp; Year: <strong>{year}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── TWO-COLUMN BODY ── */}
        <table className="mis-table" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '50%' }} />
            <col style={{ width: '50%' }} />
          </colgroup>
          <tbody>
            <tr>
              {/* ════════════ LEFT COLUMN ════════════ */}
              <td style={{ verticalAlign: 'top', padding: 0 }}>
                <table className="mis-table">
                  <tbody>

                    {/* 1. PROCUREMENT ─────────────────────────────────── */}
                    <tr><td colSpan={2} style={SH}>1. PROCUREMENT</td></tr>
                    <tr><td colSpan={2} style={SSH}>1.1 Milk Procurement (Litres)</td></tr>
                    <Row label="From Members"                  fld="memberQty" />
                    <Row label="From Non Members"              fld="nonMemberQty" />
                    <Row label="Total Collection"              fld="totalQty" readOnly val={String(n(form.memberQty) + n(form.nonMemberQty) || form.totalQty || '')} />
                    <Row label="Local Sales"                   fld="localSalesLitre" />
                    <Row label="School / Anganavadi Sales"     fld="schoolSalesLitre" />
                    <Row label="Milk sent to Dairy (Litres)"   fld="dairyLitre" />
                    <Row label="Milk obtained from Dairy (Kg)" fld="dairyKg" />
                    <Row label="Spoiled Milk (Kg)"             fld="spoiledKg" />
                    <tr>
                      <td style={LC}>Society FAT / SNF</td>
                      <td style={VC}>
                        <I f="societyFat" w="46%" /> / <I f="societySnf" w="46%" />
                      </td>
                    </tr>
                    <tr>
                      <td style={LC}>Dairy FAT / SNF</td>
                      <td style={VC}>
                        <I f="dairyFat" w="46%" /> / <I f="dairySnf" w="46%" />
                      </td>
                    </tr>

                    {/* 1.2 ──────────────────────────────────────────────── */}
                    <tr><td colSpan={2} style={SSH}>1.2 Dairy Farmers Meeting</td></tr>
                    <Row label="Date of Meeting"              fld="meetingDate" />
                    <tr>
                      <td style={LC}>Male / Female / OBC / SC-ST</td>
                      <td style={{ ...VC, display: 'flex', gap: 1 }}>
                        <I f="maleParticipants"  w="23%" />
                        <I f="femaleParticipants" w="23%" />
                        <I f="obcParticipants"   w="23%" />
                        <I f="scstParticipants"  w="23%" />
                      </td>
                    </tr>
                    <Row label="Number of Participants"       fld="totalParticipants" />
                    <Row label="Total Registered Members"     fld="totalRegisteredMembers" />
                    <Row label="Milk Pouring Members"         fld="pouringMembers" />
                    <Row label="Milk Pouring Non Members"     fld="pouringNonMembers" />
                    <Row label="Date of Follow-up Meeting"    fld="followupMeetingDate" />
                    <Row label="Award – Model DCS (Yes/No)"   fld="modelAward" />

                    {/* 2. FINANCIAL AFFAIRS ────────────────────────────── */}
                    <tr><td colSpan={2} style={SH}>2. SOCIETY FINANCIAL AFFAIRS</td></tr>
                    <tr>
                      <td style={{ ...SSH, width: '55%' }}>Particulars</td>
                      <td colSpan={1} style={{ ...TH, width: '25%' }}>Rs</td>
                      <td style={{ ...TH, width: '20%' }}>Ps</td>
                    </tr>
                    {[
                      ['1. Milk Sales to Dairy',              'dairySalesAmt',  false],
                      ['2. Local Sales',                       'localSalesAmt',  false],
                      ['3. Sample / Credit Sales',             'sampleSalesAmt', false],
                      ['4. Total (1+2+3)',                     null,             true,  totalIncome1],
                      ['5. Milk Purchase Price',               'milkPurchaseAmt',false],
                      ['6. Trade Expense',                     'tradeExpense',   false],
                      ['7. Total (5+6)',                       null,             true,  totalExpense1],
                      ['8. Trade Profit (4-7)',                null,             true,  tradeProfit],
                      ['9. Other Income (incl. CF Commission)','otherIncome',    false],
                      ['10. Total Income (8+9)',               null,             true,  totalIncome2],
                      ['11. Salary & Allowances',              'salary',         false],
                      ['12. Other Expenses',                   'otherExpenses',  false],
                      ['13. Total Expenses (11+12)',           null,             true,  totalExpenses2],
                      ['14. Net Profit (10-13)',               null,             true,  netProfit],
                      ['15. Profit Percentage (%)',            'profitPercentage',false],
                      ['16. Avg price paid to farmers/litre', 'avgPricePaidPerLitre',false],
                      ['17. Avg price received/kg from Union','avgPriceFromUnionPerKg',false],
                    ].map(([label, fld, isComputed, computed]) => {
                      const rawVal = isComputed ? computed : n(form[fld]);
                      return (
                        <tr key={label} style={{ background: isComputed ? '#f9f9f9' : undefined }}>
                          <td style={{ ...LC, width: '55%' }}>{label}</td>
                          <td style={{ ...VC, width: '25%' }}>
                            {isComputed
                              ? <span style={{ fontSize: 8 }}>{rs(rawVal)}</span>
                              : <I f={fld} align="right" />}
                          </td>
                          <td style={{ ...VC, width: '20%', fontSize: 8 }}>
                            {isComputed ? ps(rawVal) : (form[fld] ? ps(form[fld]) : '')}
                          </td>
                        </tr>
                      );
                    })}

                    {/* 6.2 CATTLE FEEDS ────────────────────────────────── */}
                    <tr><td colSpan={2} style={SH}>6.2 CATTLE FEEDS</td></tr>
                    <Row label="Balanced cattle feed sales"   fld="balancedFeedSales" />
                    <Row label="Milma cattle feed (bags)"     fld="milmaFeedBags" />
                    <Row label="Others (bags)"                fld="otherFeedBags" />
                    <Row label="Date of receipt"              fld="feedReceiptDate" />

                    <tr><td colSpan={2} style={SSH}>6.2.2 FODDER GRASS FARMING</td></tr>
                    <Row label="New grass cultivation"        fld="newGrassCultivation" />
                    <Row label="Area per farmer"              fld="areaPerFarmer" />

                    <tr><td colSpan={2} style={SSH}>6.2.3 BALED STRAW</td></tr>
                    <Row label="Sales (tons)"                 fld="baledStrawSales" />
                    <Row label="No. of farmers purchased"     fld="baledStrawFarmers" />

                    <tr><td colSpan={2} style={SSH}>6.2.4 STRAW PELLETS</td></tr>
                    <Row label="Sales (metric tons)"          fld="strawPelletsSales" />
                    <Row label="Farmers count"                fld="strawPelletsFarmers" />

                    <tr><td colSpan={2} style={SSH}>6.2.5 MINERAL MIXTURE</td></tr>
                    <Row label="Quantity distributed (kg)"   fld="mineralMixtureQty" />

                    {/* 7. QUALITY ──────────────────────────────────────── */}
                    <tr><td colSpan={2} style={SH}>7. QUALITY IMPROVEMENT</td></tr>
                    <Row label="Milk container type (Steel/Others)" fld="milkContainerType" />
                    <Row label="AD kit usage"                       fld="adKitUsage" />
                    <Row label="Cleaning chemicals usage"           fld="cleaningChemicals" />
                    <Row label="Electronic weighing scale (Yes/No)" fld="electronicScale" />
                    <Row label="AMCU implemented (Yes/No)"          fld="amcuImplemented" />
                    <Row label="BMC capacity"                       fld="bmcCapacity" />
                    <Row label="BMC average storage"                fld="bmcAvgStorage" />

                  </tbody>
                </table>
              </td>

              {/* ════════════ RIGHT COLUMN ════════════ */}
              <td style={{ verticalAlign: 'top', padding: 0 }}>
                <table className="mis-table">
                  <tbody>

                    {/* 3. ADMIN ─────────────────────────────────────────── */}
                    <tr><td colSpan={2} style={SH}>3. SOCIETY ADMINISTRATIVE MATTERS</td></tr>
                    <Row label="President (Male / Female)"        fld="presidentGender" />
                    <Row label="Total board members"              fld="totalBoardMembers" />
                    <Row label="Milk pouring board members"       fld="milkPouringBoardMembers" />
                    <Row label="Date of last General Body Meeting" fld="lastGBMDate" />
                    <Row label="Next election date"               fld="nextElectionDate" />

                    {/* 4. INSTITUTION BUILDING ─────────────────────────── */}
                    <tr><td colSpan={2} style={SH}>4. INSTITUTION BUILDING EFFORTS</td></tr>
                    <Row label="Program implemented (Yes/No)"     fld="programImplemented" />
                    <Row label="Implementation date"              fld="implementationDate" />
                    <Row label="Board members attended"           fld="boardMembersAttended" />
                    <Row label="Employees trained"                fld="employeesTrained" />

                    {/* 5. CO-OP DEVELOPMENT ────────────────────────────── */}
                    <tr><td colSpan={2} style={SH}>5. CO-OPERATIVE DEVELOPMENT PROGRAM</td></tr>
                    <tr>
                      <td colSpan={2} style={{ padding: 0 }}>
                        <table className="mis-table" style={{ width: '100%' }}>
                          <tbody>
                            <tr>
                              <td style={{ ...TH, width: '8%' }}>Sl</td>
                              <td style={{ ...SSH, width: '52%' }}>Name of Program</td>
                              <td style={{ ...TH, width: '20%' }}>Male</td>
                              <td style={{ ...TH, width: '20%' }}>Female</td>
                            </tr>
                            {[
                              ['1','Farmer Training',        'farmerTrainingM','farmerTrainingF'],
                              ['2','Study Visit',            'studyVisitM',    'studyVisitF'],
                              ['3','Board Member Training',  'boardTrainingM', 'boardTrainingF'],
                              ['4','Secretary Training',     'secretaryTrainingM','secretaryTrainingF'],
                              ['5','Means of Production',   'productionMeansM','productionMeansF'],
                              ['6','PEN Programs',          'penM',           'penF'],
                            ].map(([sl, prog, mf, ff]) => (
                              <tr key={sl}>
                                <td style={{ fontSize: 8, textAlign: 'center' }}>{sl}</td>
                                <td style={{ fontSize: 8, padding: '1px 3px' }}>{prog}</td>
                                <td style={{ textAlign: 'center' }}><I f={mf} /></td>
                                <td style={{ textAlign: 'center' }}><I f={ff} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    {/* 6. MEANS OF PRODUCTION ─────────────────────────── */}
                    <tr><td colSpan={2} style={SH}>6. MEANS OF PRODUCTION</td></tr>
                    <Row label="Artificial insemination (New)"     fld="aiNew" />
                    <Row label="Artificial insemination (Repeat)"  fld="aiRepeat" />
                    <Row label="Amount collected from farmers"      fld="aiAmount" />
                    <Row label="Two-wheeler availability (Yes/No)"  fld="twoWheeler" />
                    <Row label="Pregnancy test (+ve)"               fld="pregnancyPos" />
                    <Row label="Pregnancy test (-ve)"               fld="pregnancyNeg" />
                    <Row label="Infertility camps"                  fld="infertiilityCamps" />
                    <Row label="Mastitis control users"             fld="mastitisUsers" />
                    <Row label="Cattle shed subsidy"                fld="cattleShedSubsidy" />

                    {/* 8. WCCP ─────────────────────────────────────────── */}
                    <tr><td colSpan={2} style={SH}>8. WOMEN'S CATTLE BREEDING PROGRAM (WCCP)</td></tr>
                    <Row label="Subjects taken"                    fld="wccpSubjects" />
                    <Row label="Number of classes"                 fld="wccpClasses" />
                    <Row label="Houses visited"                    fld="wccpHousesVisited" />
                    <Row label="Visit to Anand (No. of farmers)"   fld="wccpAnand" />

                    {/* 9. TRAINING ─────────────────────────────────────── */}
                    <tr><td colSpan={2} style={SH}>9. TRAINING PROGRAM (Thrissur Training Center)</td></tr>
                    <tr>
                      <td colSpan={2} style={{ padding: 0 }}>
                        <table className="mis-table" style={{ width: '100%' }}>
                          <tbody>
                            <tr>
                              <td style={{ ...SSH, width: '52%' }}>Program Name</td>
                              <td style={{ ...TH, width: '24%' }}>Participants</td>
                              <td style={{ ...TH, width: '24%' }}>Target</td>
                            </tr>
                            {[
                              ['t1Name','t1Parts','t1Target'],
                              ['t2Name','t2Parts','t2Target'],
                              ['t3Name','t3Parts','t3Target'],
                            ].map(([n1, n2, n3]) => (
                              <tr key={n1}>
                                <td><I f={n1} align="left" /></td>
                                <td style={{ textAlign: 'center' }}><I f={n2} /></td>
                                <td style={{ textAlign: 'center' }}><I f={n3} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    {/* 10. SOCIAL SECURITY ─────────────────────────────── */}
                    <tr><td colSpan={2} style={SH}>10. SOCIAL SECURITY SCHEME</td></tr>
                    <Row label="Insured members"                        fld="socialInsured" />
                    <Row label="Financial assistance beneficiaries"     fld="socialBeneficiaries" />
                    <Row label="Funded amount"                          fld="socialFunded" />

                    {/* 11. FARMER SECURITY ─────────────────────────────── */}
                    <tr><td colSpan={2} style={SH}>11. FARMER SECURITY SCHEME</td></tr>
                    <Row label="Total insured persons"                  fld="farmerInsured" />
                    <Row label="Beneficiaries"                          fld="farmerBeneficiaries" />
                    <Row label="Funded amount"                          fld="farmerFunded" />

                    {/* 12. AUDIT ───────────────────────────────────────── */}
                    <tr><td colSpan={2} style={SH}>12. SOCIETY AUDIT INFORMATION</td></tr>
                    <Row label="Year of audit"                          fld="auditYear" />
                    <Row label="Classification (A / B / C / D)"        fld="auditClass" />

                    {/* Signature row */}
                    <tr>
                      <td colSpan={2} style={{ padding: '20px 6px 4px', fontSize: 8, fontFamily: '"Times New Roman", serif' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr>
                              <td style={{ border: 'none', textAlign: 'center', width: '50%' }}>
                                <div style={{ borderTop: '1px solid #000', marginTop: 28, paddingTop: 2, fontSize: 8 }}>Secretary</div>
                              </td>
                              <td style={{ border: 'none', textAlign: 'center', width: '50%' }}>
                                <div style={{ borderTop: '1px solid #000', marginTop: 28, paddingTop: 2, fontSize: 8 }}>President</div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>

                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Box>
  );
}
