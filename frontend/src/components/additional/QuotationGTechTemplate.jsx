import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { quotationAPI } from '../../services/api';
import dayjs from 'dayjs';

// ── Inline editable field ────────────────────────────────────
function E({ value, onChange, style = {}, block = false }) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={e => onChange && onChange(e.currentTarget.innerText)}
      style={{
        display: block ? 'block' : 'inline',
        outline: 'none',
        borderBottom: '1px dashed #1a3c6e',
        minWidth: 30,
        cursor: 'text',
        ...style,
      }}
    >
      {value}
    </span>
  );
}

// ── Number → words (Indian) ─────────────────────────────────
const _ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
  'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const _tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
function toWords(n) {
  n = Math.round(n || 0);
  if (!n) return 'Zero';
  const c = (x) => {
    if (x < 20) return _ones[x];
    if (x < 100) return _tens[Math.floor(x/10)] + (x%10 ? ' '+_ones[x%10] : '');
    if (x < 1000) return _ones[Math.floor(x/100)]+' Hundred'+(x%100?' '+c(x%100):'');
    if (x < 100000) return c(Math.floor(x/1000))+' Thousand'+(x%1000?' '+c(x%1000):'');
    if (x < 10000000) return c(Math.floor(x/100000))+' Lakh'+(x%100000?' '+c(x%100000):'');
    return c(Math.floor(x/10000000))+' Crore'+(x%10000000?' '+c(x%10000000):'');
  };
  return c(n);
}

function fmt(n) {
  return (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Default table rows ───────────────────────────────────────
function makeRow(sno, desc = '', make = '', amount = '') {
  return { id: Date.now() + sno, sno, desc, make, amount };
}

// ── Styles ───────────────────────────────────────────────────
const BLUE   = '#1a3c6e';
const LBLUE  = '#e8f0fb';

const css = {
  wrapper: {
    fontFamily: "'Calibri', 'Arial', sans-serif",
    background: '#e8e8e8',
    minHeight: '100vh',
  },
  toolbar: {
    background: BLUE,
    padding: '10px 24px',
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  tbBtn: (primary) => ({
    padding: '7px 16px',
    borderRadius: 5,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
    background: primary ? '#f0a500' : 'rgba(255,255,255,0.13)',
    color: primary ? '#1a1a1a' : '#fff',
  }),
  page: {
    width: 794,
    minHeight: 1123,
    margin: '24px auto',
    background: '#fff',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    padding: '48px 52px 52px',
    boxSizing: 'border-box',
    pageBreakAfter: 'always',
    position: 'relative',
  },

  // Header
  headerWrap: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: `3px solid ${BLUE}`,
    paddingBottom: 14,
    marginBottom: 22,
  },
  logoBox: {
    width: 70,
    height: 70,
    border: `2px solid ${BLUE}`,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    color: BLUE,
    fontWeight: 700,
    flexShrink: 0,
    marginRight: 14,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 700,
    color: BLUE,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  companyMeta: {
    fontSize: 12,
    color: '#444',
    lineHeight: 1.6,
  },
  docTitle: {
    textAlign: 'right',
  },
  docTitleText: {
    fontSize: 22,
    fontWeight: 700,
    color: BLUE,
    textTransform: 'uppercase',
    letterSpacing: 2,
    background: LBLUE,
    padding: '6px 18px',
    borderRadius: 4,
    display: 'inline-block',
  },
  docNo: { fontSize: 12, color: '#666', marginTop: 4, textAlign: 'right' },

  // To + Ref two-col row
  addrRefRow: {
    display: 'flex',
    gap: 24,
    marginBottom: 20,
  },
  toBox: {
    flex: 1,
    border: `1px solid ${BLUE}`,
    borderRadius: 4,
    padding: '10px 14px',
    fontSize: 13,
    lineHeight: 2,
  },
  toLabel: {
    fontWeight: 700,
    color: BLUE,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  refBox: {
    width: 240,
    border: `1px solid ${BLUE}`,
    borderRadius: 4,
    padding: '10px 14px',
    fontSize: 13,
    lineHeight: 2,
    flexShrink: 0,
  },
  refRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    borderBottom: '1px solid #eee',
    paddingBottom: 3,
    marginBottom: 3,
  },
  refLabel: { color: '#666', marginRight: 6, whiteSpace: 'nowrap' },

  // Subject
  subjectRow: {
    fontSize: 13,
    marginBottom: 16,
    fontWeight: 600,
    color: '#222',
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 1.9,
    color: '#333',
    marginBottom: 10,
    textAlign: 'justify',
  },

  // Table
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    marginTop: 14,
    marginBottom: 10,
  },
  th: {
    background: BLUE,
    color: '#fff',
    padding: '9px 10px',
    border: `1px solid ${BLUE}`,
    fontWeight: 600,
    textAlign: 'left',
    fontSize: 12,
  },
  thC: {
    background: BLUE,
    color: '#fff',
    padding: '9px 10px',
    border: `1px solid ${BLUE}`,
    fontWeight: 600,
    textAlign: 'center',
    fontSize: 12,
  },
  thR: {
    background: BLUE,
    color: '#fff',
    padding: '9px 10px',
    border: `1px solid ${BLUE}`,
    fontWeight: 600,
    textAlign: 'right',
    fontSize: 12,
  },
  td: {
    padding: '8px 10px',
    border: '1px solid #ccc',
    verticalAlign: 'top',
    fontSize: 13,
  },
  tdC: {
    padding: '8px 10px',
    border: '1px solid #ccc',
    textAlign: 'center',
    verticalAlign: 'top',
    fontSize: 13,
  },
  tdR: {
    padding: '8px 10px',
    border: '1px solid #ccc',
    textAlign: 'right',
    verticalAlign: 'top',
    fontSize: 13,
  },

  // Total
  totalRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 32,
    padding: '10px 12px',
    background: LBLUE,
    border: `1px solid ${BLUE}`,
    borderRadius: 4,
    fontSize: 15,
    fontWeight: 700,
    color: BLUE,
    marginTop: 2,
    marginBottom: 20,
  },

  // Stamp
  stampArea: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  stampBox: {
    width: 110,
    height: 110,
    border: `2px dashed ${BLUE}`,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    color: BLUE,
    fontWeight: 600,
    textAlign: 'center',
  },

  // Page 2 — Terms
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: BLUE,
    borderBottom: `2px solid ${BLUE}`,
    paddingBottom: 6,
    marginBottom: 18,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  termsOl: {
    paddingLeft: 20,
    fontSize: 13,
    lineHeight: 2.2,
    color: '#333',
  },
  closing: {
    marginTop: 40,
    fontSize: 13,
    color: '#333',
    lineHeight: 2,
  },
  sigRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 36,
  },
  sigBox: {
    textAlign: 'center',
  },
  sigLine: {
    width: 160,
    borderTop: `1.5px solid #333`,
    marginBottom: 6,
  },
  sigLabel: { fontSize: 12, color: '#555', fontWeight: 600 },
  sealCircle: {
    width: 90,
    height: 90,
    border: `2px dashed ${BLUE}`,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    color: BLUE,
    fontWeight: 600,
    textAlign: 'center',
    margin: '0 auto 6px',
  },
};

// ═══════════════════════════════════════════════════════════════
export default function QuotationGTechTemplate() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Page 1 editable fields ──────────────────────────────────
  const [compAddr, setCompAddr]   = useState('No. 12, Industrial Estate, Ambattur, Chennai - 600 058');
  const [compPhone, setCompPhone] = useState('+91 44 2625 1234 / +91 98400 12345');
  const [compEmail, setCompEmail] = useState('info@gtechautomation.com');

  const [toName, setToName]     = useState('The Society / Institution Name');
  const [toAddr1, setToAddr1]   = useState('Address Line 1, City');
  const [toAddr2, setToAddr2]   = useState('District, State - PIN Code');

  const [dateField, setDateField] = useState(dayjs().format('DD / MM / YYYY'));
  const [yourRef, setYourRef]     = useState('—');
  const [ourRef, setOurRef]       = useState('');

  const [subject, setSubject] = useState('Supply of Food Analyzer System');
  const [bodyText, setBodyText] = useState(
    'We are pleased to introduce our Food Analyzer system designed to ensure quality and safety in food analysis. Our equipment provides reliable results and is used by many industries worldwide. We are confident that our system will meet your requirements efficiently and cost-effectively.'
  );
  const [bodyText2, setBodyText2] = useState(
    'We take this opportunity to submit our competitive quotation for your kind consideration and approval. Our team is committed to delivering quality products with timely after-sales service and support.'
  );

  // ── Table rows ──────────────────────────────────────────────
  const initRows = (items) => {
    const base = (items || []).slice(0, 5).map((item, i) => ({
      id: i + 1,
      sno: i + 1,
      desc: item.itemName || '',
      make: '',
      amount: item.totalAmount ? fmt(item.totalAmount) : '',
    }));
    // Pad to at least 5 rows
    while (base.length < 5) {
      base.push(makeRow(base.length + 1));
    }
    return base;
  };

  const [rows, setRows] = useState(() => [
    makeRow(1, 'Analyzer and accessories', '', ''),
    makeRow(2), makeRow(3), makeRow(4), makeRow(5),
  ]);
  const [totalAmt, setTotalAmt] = useState('');

  // ── Page 2 terms ────────────────────────────────────────────
  const [terms, setTerms] = useState([
    'Prices are quoted as per the attached quotation.',
    'Taxes and duties excluded unless specifically mentioned.',
    'Payment: 50% advance with order, balance before delivery.',
    'Delivery: Within 7–10 working days from order confirmation.',
    'Warranty: One year warranty against manufacturing defects.',
    'Installation and commissioning charges extra, if applicable.',
    'Any dispute shall be subject to Chennai jurisdiction only.',
  ]);

  useEffect(() => { fetchQuotation(); }, [id]);

  const fetchQuotation = async () => {
    setLoading(true);
    try {
      const res = await quotationAPI.getById(id);
      const q = res?.data || res;
      setQuotation(q);
      if (q?.quotationNumber) setOurRef(q.quotationNumber);
      if (q?.quotationDate) setDateField(dayjs(q.quotationDate).format('DD / MM / YYYY'));
      if (q?.items?.length) {
        setRows(initRows(q.items));
        if (q.grandTotal) setTotalAmt(fmt(q.grandTotal));
      }
      if (q?.partyName) setToName(q.partyName);
      if (q?.partyAddress) setToAddr1(q.partyAddress);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
      navigate('/quotations');
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (idx, field, val) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  const addRow = () => {
    setRows(prev => [...prev, makeRow(prev.length + 1)]);
  };

  const removeRow = (idx) => {
    setRows(prev => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, sno: i + 1 })));
  };

  const updateTerm = (idx, val) => {
    setTerms(prev => prev.map((t, i) => i === idx ? val : t));
  };
  const addTerm = () => setTerms(prev => [...prev, 'New term — click to edit.']);
  const removeTerm = (idx) => setTerms(prev => prev.filter((_, i) => i !== idx));

  if (loading) return <Center h={400}><Loader /></Center>;

  // ── Shared page header ──────────────────────────────────────
  const PageHeader = ({ right }) => (
    <div style={css.headerWrap}>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div style={css.logoBox}>LOGO</div>
        <div>
          <div style={css.companyName}>G-TECH Automation Group</div>
          <div style={css.companyMeta}>
            <E value={compAddr} onChange={setCompAddr} style={{ minWidth: 300 }} /><br />
            Ph: <E value={compPhone} onChange={setCompPhone} style={{ minWidth: 200 }} />&nbsp;|&nbsp;
            <E value={compEmail} onChange={setCompEmail} style={{ minWidth: 180 }} />
          </div>
        </div>
      </div>
      <div style={css.docTitle}>
        <div style={css.docTitleText}>{right || 'QUOTATION'}</div>
        {quotation?.quotationNumber && (
          <div style={css.docNo}>Ref: {quotation.quotationNumber}</div>
        )}
      </div>
    </div>
  );

  return (
    <div style={css.wrapper}>

      {/* ── Toolbar ───────────────────────────────────────── */}
      <div style={css.toolbar} className="no-print">
        <button style={css.tbBtn(false)} onClick={() => navigate(`/quotations/print/${id}`)}>
          ← Invoice
        </button>
        <button style={css.tbBtn(false)} onClick={() => navigate(`/quotations/proposal-letter/${id}`)}>
          📄 Proposal Letter
        </button>
        <button style={css.tbBtn(false)} onClick={() => navigate(`/quotations/edit/${id}`)}>
          ✏ Edit Quotation
        </button>
        <button style={css.tbBtn(false)} onClick={() => navigate('/quotations')}>
          ☰ All Quotations
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ color: '#f0a500', fontSize: 13, fontWeight: 600 }}>
          ✎ Click any blue-underlined field to edit inline
        </span>
        <button style={css.tbBtn(false)} onClick={addRow}>
          ＋ Add Row
        </button>
        <button style={css.tbBtn(true)} onClick={() => window.print()}>
          🖨 Print / PDF
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════
           PAGE 1
         ══════════════════════════════════════════════════════ */}
      <div style={css.page}>
        <PageHeader />

        {/* To + Ref */}
        <div style={css.addrRefRow}>
          {/* To block */}
          <div style={css.toBox}>
            <div style={css.toLabel}>To</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>THE SECRETARY,</div>
            <div>
              <E value={toName} onChange={setToName} style={{ fontWeight: 600, minWidth: 220 }} />,
            </div>
            <div><E value={toAddr1} onChange={setToAddr1} style={{ minWidth: 260 }} /></div>
            <div><E value={toAddr2} onChange={setToAddr2} style={{ minWidth: 220 }} /></div>
          </div>

          {/* Ref block */}
          <div style={css.refBox}>
            <div style={{ ...css.toLabel, marginBottom: 8 }}>Reference</div>
            <div style={css.refRow}>
              <span style={css.refLabel}>Date:</span>
              <E value={dateField} onChange={setDateField} style={{ minWidth: 100, textAlign: 'right' }} />
            </div>
            <div style={css.refRow}>
              <span style={css.refLabel}>Your Ref No:</span>
              <E value={yourRef} onChange={setYourRef} style={{ minWidth: 80, textAlign: 'right' }} />
            </div>
            <div style={css.refRow}>
              <span style={css.refLabel}>Our Ref No:</span>
              <E value={ourRef} onChange={setOurRef} style={{ minWidth: 80, textAlign: 'right' }} />
            </div>
          </div>
        </div>

        {/* Subject */}
        <div style={css.subjectRow}>
          Sub:&nbsp;
          <E value={subject} onChange={setSubject} style={{ minWidth: 300 }} />
        </div>

        {/* Body */}
        <div style={css.bodyText}>Dear Sir,</div>
        <div style={css.bodyText}>
          <E value={bodyText} onChange={setBodyText} block
            style={{ display: 'block', borderBottom: 'none', borderLeft: `3px solid ${BLUE}`, paddingLeft: 10 }}
          />
        </div>
        <div style={css.bodyText}>
          <E value={bodyText2} onChange={setBodyText2} block
            style={{ display: 'block', borderBottom: 'none' }}
          />
        </div>
        <div style={{ ...css.bodyText, marginBottom: 0 }}>
          We hereby submit our quotation for your kind consideration:
        </div>

        {/* ── Items Table ───────────────────────────────── */}
        <table style={css.table}>
          <thead>
            <tr>
              <th style={{ ...css.thC, width: 44 }}>S.No</th>
              <th style={css.th}>Description</th>
              <th style={{ ...css.th, width: 130 }}>Make / Brand</th>
              <th style={{ ...css.thR, width: 120 }}>Amount (₹)</th>
              <th style={{ ...css.thC, width: 36 }} className="no-print"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f7faff' }}>
                <td style={css.tdC}>{row.sno}</td>
                <td style={css.td}>
                  <E
                    value={row.desc}
                    onChange={v => updateRow(idx, 'desc', v)}
                    style={{ minWidth: 200, display: 'block', borderBottom: row.desc ? 'none' : '1px dashed #1a3c6e' }}
                  />
                </td>
                <td style={css.td}>
                  <E
                    value={row.make}
                    onChange={v => updateRow(idx, 'make', v)}
                    style={{ minWidth: 90, display: 'block', borderBottom: row.make ? 'none' : '1px dashed #1a3c6e' }}
                  />
                </td>
                <td style={css.tdR}>
                  <E
                    value={row.amount}
                    onChange={v => updateRow(idx, 'amount', v)}
                    style={{ minWidth: 80, display: 'block', textAlign: 'right', borderBottom: row.amount ? 'none' : '1px dashed #1a3c6e' }}
                  />
                </td>
                <td style={{ ...css.tdC, color: '#e53e3e', cursor: 'pointer', fontWeight: 700 }}
                  className="no-print"
                  onClick={() => removeRow(idx)}
                  title="Remove row"
                >×</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total */}
        <div style={css.totalRow}>
          <span>TOTAL :</span>
          <span>
            ₹&nbsp;<E value={totalAmt || ''} onChange={setTotalAmt} style={{ minWidth: 100, textAlign: 'right', borderBottom: '1px dashed #1a3c6e' }} />
          </span>
        </div>

        {/* Stamp */}
        <div style={css.stampArea}>
          <div style={{ textAlign: 'center' }}>
            <div style={css.stampBox}>Company<br />Stamp / Seal</div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
           PAGE 2 — Terms & Conditions
         ══════════════════════════════════════════════════════ */}
      <div style={css.page}>
        <PageHeader right="TERMS & CONDITIONS" />

        <div style={css.sectionTitle}>Terms and Conditions</div>

        <ol style={css.termsOl}>
          {terms.map((term, idx) => (
            <li key={idx} style={{ marginBottom: 4, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <E
                value={term}
                onChange={v => updateTerm(idx, v)}
                block
                style={{ flex: 1, display: 'inline-block', borderBottom: 'none', minWidth: 400 }}
              />
              <span
                className="no-print"
                onClick={() => removeTerm(idx)}
                style={{ color: '#e53e3e', cursor: 'pointer', fontWeight: 700, fontSize: 16, lineHeight: 1 }}
                title="Remove"
              >×</span>
            </li>
          ))}
        </ol>

        <div className="no-print" style={{ marginTop: 10, marginBottom: 16 }}>
          <button
            onClick={addTerm}
            style={{ ...css.tbBtn(false), background: LBLUE, color: BLUE, fontSize: 12, padding: '4px 12px' }}
          >
            + Add Term
          </button>
        </div>

        {/* Closing */}
        <div style={css.closing}>
          <div>Thanking you,</div>
          <div style={{ marginTop: 8 }}>Yours faithfully,</div>
          <div style={{ marginTop: 4, fontWeight: 700 }}>For G-TECH AUTOMATION GROUP</div>
        </div>

        {/* Signature + Seal */}
        <div style={css.sigRow}>
          <div style={css.sigBox}>
            <div style={{ height: 60 }} />
            <div style={css.sigLine} />
            <div style={css.sigLabel}>Authorized Signature</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>G-TECH Automation Group</div>
          </div>
          <div style={css.sigBox}>
            <div style={css.sealCircle}>Company<br />Seal</div>
            <div style={{ fontSize: 11, color: '#888' }}>Official Stamp</div>
          </div>
        </div>

        {/* Page footer */}
        <div style={{ marginTop: 40, borderTop: `2px solid ${BLUE}`, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666' }}>
          <span>G-TECH Automation Group</span>
          <span><E value={compEmail} onChange={setCompEmail} style={{ minWidth: 160 }} /></span>
          <span><E value={compPhone} onChange={setCompPhone} style={{ minWidth: 180 }} /></span>
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff; }
          @page { size: A4 portrait; margin: 0; }
        }
        [contenteditable]:hover { background: rgba(26,60,110,0.04); border-radius: 2px; }
        [contenteditable]:focus { background: rgba(26,60,110,0.07); }
      `}</style>
    </div>
  );
}
