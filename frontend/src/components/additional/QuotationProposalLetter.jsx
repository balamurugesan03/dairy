import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { quotationAPI } from '../../services/api';
import dayjs from 'dayjs';

// ── Editable span helper ─────────────────────────────────────
const E = ({ value, onChange, style = {}, tag = 'span', className = '' }) => {
  const Tag = tag;
  return (
    <Tag
      contentEditable
      suppressContentEditableWarning
      onBlur={e => onChange && onChange(e.currentTarget.innerText)}
      style={{ outline: 'none', borderBottom: '1px dashed #c9a84c', minWidth: 40, display: 'inline-block', ...style }}
      className={className}
    >
      {value}
    </Tag>
  );
};

// ── Number to words ──────────────────────────────────────────
const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const tensW = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
function toWords(num) {
  num = Math.round(num);
  if (num === 0) return 'Zero';
  const cvt = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tensW[Math.floor(n/10)] + (n%10?' '+ones[n%10]:'');
    if (n < 1000) return ones[Math.floor(n/100)]+' Hundred'+(n%100?' '+cvt(n%100):'');
    if (n < 100000) return cvt(Math.floor(n/1000))+' Thousand'+(n%1000?' '+cvt(n%1000):'');
    if (n < 10000000) return cvt(Math.floor(n/100000))+' Lakh'+(n%100000?' '+cvt(n%100000):'');
    return cvt(Math.floor(n/10000000))+' Crore'+(n%10000000?' '+cvt(n%10000000):'');
  };
  return cvt(num);
}

const fmt = (n) => (Number(n)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});

// ── Styles ───────────────────────────────────────────────────
const S = {
  wrapper: {
    background: '#f0f0f0',
    minHeight: '100vh',
    padding: '0',
    fontFamily: "'Times New Roman', Times, serif",
  },
  toolbar: {
    background: '#1a1a2e',
    padding: '10px 24px',
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  tbBtn: (primary) => ({
    padding: '7px 18px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
    background: primary ? '#c9a84c' : 'rgba(255,255,255,0.12)',
    color: primary ? '#1a1a2e' : '#fff',
  }),
  page: {
    width: 794,
    minHeight: 1123,
    margin: '24px auto',
    background: '#fff',
    boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
    position: 'relative',
    padding: '56px 60px 60px',
    boxSizing: 'border-box',
    pageBreakAfter: 'always',
  },
  genfocusTitle: {
    textAlign: 'center',
    fontSize: 48,
    fontWeight: 700,
    letterSpacing: 10,
    color: '#c9a84c',
    fontFamily: "'Georgia', serif",
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  genfocusTagline: {
    textAlign: 'center',
    fontSize: 12,
    color: '#888',
    letterSpacing: 3,
    marginBottom: 28,
    textTransform: 'uppercase',
  },
  headerDivider: {
    borderTop: '2px solid #c9a84c',
    marginBottom: 24,
  },
  refRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 20,
    fontSize: 13,
  },
  addressBlock: {
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 1.8,
  },
  subjectLine: {
    marginBottom: 16,
    fontSize: 14,
    fontWeight: 700,
    textDecoration: 'underline',
  },
  bodyText: {
    fontSize: 13.5,
    lineHeight: 1.9,
    color: '#222',
    textAlign: 'justify',
    marginBottom: 14,
  },
  sigSection: {
    marginTop: 36,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sigBox: {
    textAlign: 'center',
  },
  signPlaceholder: {
    width: 140,
    height: 70,
    border: '1px dashed #999',
    borderRadius: 4,
    margin: '0 auto 6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    color: '#bbb',
  },
  sealPlaceholder: {
    width: 80,
    height: 80,
    border: '2px dashed #c9a84c',
    borderRadius: '50%',
    margin: '0 auto 6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    color: '#c9a84c',
  },
  footerRight: {
    textAlign: 'right',
    fontSize: 12,
    lineHeight: 1.7,
    color: '#444',
    borderTop: '1px solid #c9a84c',
    paddingTop: 12,
    marginTop: 32,
  },
  footerCompany: {
    fontSize: 16,
    fontWeight: 700,
    color: '#c9a84c',
    letterSpacing: 2,
  },
  // Page 2
  tableStyle: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12.5,
    marginBottom: 20,
  },
  th: {
    background: '#1a1a2e',
    color: '#c9a84c',
    padding: '8px 10px',
    textAlign: 'left',
    fontWeight: 600,
    border: '1px solid #1a1a2e',
  },
  thR: {
    background: '#1a1a2e',
    color: '#c9a84c',
    padding: '8px 10px',
    textAlign: 'right',
    fontWeight: 600,
    border: '1px solid #1a1a2e',
  },
  td: {
    padding: '7px 10px',
    border: '1px solid #ddd',
    color: '#222',
    verticalAlign: 'top',
  },
  tdR: {
    padding: '7px 10px',
    border: '1px solid #ddd',
    color: '#222',
    textAlign: 'right',
    verticalAlign: 'top',
  },
  totalsBlock: {
    marginLeft: 'auto',
    width: 280,
    marginBottom: 20,
  },
  totRow: (bold, gold) => ({
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    fontWeight: bold ? 700 : 400,
    fontSize: bold ? 14 : 13,
    color: gold ? '#c9a84c' : '#222',
    borderBottom: bold ? '2px solid #c9a84c' : '1px solid #eee',
  }),
  amtWords: {
    background: '#fffbf0',
    border: '1px solid #c9a84c',
    borderRadius: 4,
    padding: '8px 14px',
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 20,
    color: '#444',
  },
  termsBox: {
    background: '#fafafa',
    border: '1px solid #eee',
    borderRadius: 4,
    padding: '12px 16px',
    fontSize: 12,
    lineHeight: 1.8,
    color: '#555',
    marginBottom: 24,
  },
};

// ═══════════════════════════════════════════════════════════════
export default function QuotationProposalLetter() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);

  // Editable fields — Page 1
  const [refNo, setRefNo]   = useState('REF/2026/');
  const [date, setDate]     = useState(dayjs().format('DD-MM-YYYY'));
  const [societyName, setSocietyName] = useState('Your Society Name');
  const [societyAddr, setSocietyAddr] = useState('Village, District, State - PIN');
  const [subjectItem, setSubjectItem] = useState('Electronic Systems / IT Equipment');
  const [bodyPara1, setBodyPara1] = useState(
    'We GENFOCUS, Genfocus Infotech (P) Ltd, are an electronic house operating in the electronics industry for the past 10+ years with rich experience in executing local and overseas projects. We specialize in providing advanced IT infrastructure, electronic systems, and technology solutions tailored to meet modern organizational requirements.'
  );
  const [bodyPara2, setBodyPara2] = useState(
    'With reference to your requirement, we are pleased to submit our best competitive quotation for the supply and installation of the items detailed overleaf. We assure you of the highest quality products, timely delivery, and excellent after-sales support.'
  );
  const [bodyPara3, setBodyPara3] = useState(
    'We request you to kindly go through our proposal and consider us for the same. We remain committed to offering the best value and service.'
  );

  // Editable fields — Footer
  const [footerAddr, setFooterAddr]     = useState('123, Tech Park, 2nd Floor, Anna Nagar');
  const [footerCity, setFooterCity]     = useState('Chennai - 600 040, Tamil Nadu');
  const [footerEmail, setFooterEmail]   = useState('info@genfocus.in');
  const [footerWeb, setFooterWeb]       = useState('www.genfocus.in');
  const [footerPhone, setFooterPhone]   = useState('+91 98765 43210 / +91 98765 43211');

  // Editable — Page 2
  const [terms, setTerms] = useState(
    `1. This quotation is valid for 30 days from the date of issue.\n2. Prices are exclusive of installation charges unless specified.\n3. Payment: 50% advance, balance before delivery.\n4. Delivery: 7–10 working days after order confirmation.\n5. Warranty as per manufacturer's terms.\n6. All disputes subject to Chennai jurisdiction only.`
  );

  useEffect(() => { fetchQuotation(); }, [id]);

  const fetchQuotation = async () => {
    setLoading(true);
    try {
      const res = await quotationAPI.getById(id);
      setQuotation(res?.data || res);
    } catch (err) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
      navigate('/quotations');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  if (loading) return <Center h={400}><Loader /></Center>;
  if (!quotation) return null;

  const q = quotation;
  const amtWords = toWords(Math.floor(q.grandTotal || 0)) + ' Rupees Only';

  // ── Page Header (reusable) ──────────────────────────────────
  const PageHeader = () => (
    <>
      <div style={S.genfocusTitle}>GENFOCUS</div>
      <div style={S.genfocusTagline}>Genfocus Infotech (P) Ltd</div>
      <div style={S.headerDivider} />
    </>
  );

  return (
    <div style={S.wrapper}>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div style={S.toolbar} className="no-print">
        <button style={S.tbBtn(false)} onClick={() => navigate(`/quotations/print/${id}`)}>
          ← Invoice
        </button>
        <button style={S.tbBtn(false)} onClick={() => navigate(`/quotations/edit/${id}`)}>
          ✏ Edit Quotation
        </button>
        <button style={S.tbBtn(false)} onClick={() => navigate('/quotations')}>
          ☰ All Quotations
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ color: '#c9a84c', fontSize: 13, fontWeight: 600 }}>
          ✎ Click any underlined field to edit
        </span>
        <button style={S.tbBtn(true)} onClick={handlePrint}>
          🖨 Print / Download PDF
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════
           PAGE 1 — Covering / Proposal Letter
         ══════════════════════════════════════════════════════ */}
      <div style={S.page}>
        <PageHeader />

        {/* Ref + Date */}
        <div style={S.refRow}>
          <div>
            <strong>Ref / Tender No:</strong>&nbsp;
            <E value={refNo} onChange={setRefNo} style={{ minWidth: 180 }} />
          </div>
          <div>
            <strong>Date:</strong>&nbsp;
            <E value={date} onChange={setDate} style={{ minWidth: 120 }} />
          </div>
        </div>

        {/* Address Block */}
        <div style={S.addressBlock}>
          <div style={{ fontWeight: 700 }}>The Secretary,</div>
          <div>
            <E value={societyName} onChange={setSocietyName} style={{ minWidth: 260, fontWeight: 600 }} />
          </div>
          <div>
            <E value={societyAddr} onChange={setSocietyAddr} style={{ minWidth: 320 }} />
          </div>
        </div>

        {/* Subject */}
        <div style={S.subjectLine}>
          Sub: Quotation for Supply of&nbsp;
          <E value={subjectItem} onChange={setSubjectItem} style={{ minWidth: 200, fontWeight: 700 }} />
          &nbsp;— Reg.
        </div>

        {/* Salutation */}
        <div style={S.bodyText}>Dear Sir / Madam,</div>

        {/* Body Paragraphs */}
        <div style={S.bodyText}>
          <E
            value={bodyPara1}
            onChange={setBodyPara1}
            tag="div"
            style={{ display: 'block', borderBottom: 'none', borderLeft: '2px solid #c9a84c', paddingLeft: 12 }}
          />
        </div>
        <div style={S.bodyText}>
          <E
            value={bodyPara2}
            onChange={setBodyPara2}
            tag="div"
            style={{ display: 'block', borderBottom: 'none' }}
          />
        </div>
        <div style={S.bodyText}>
          <E
            value={bodyPara3}
            onChange={setBodyPara3}
            tag="div"
            style={{ display: 'block', borderBottom: 'none' }}
          />
        </div>

        <div style={{ ...S.bodyText, marginTop: 20 }}>
          Thanking you and assuring our best services at all times.
        </div>

        {/* Signature section */}
        <div style={S.sigSection}>
          <div style={S.sigBox}>
            <div style={S.signPlaceholder}>Signature</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Authorized Signatory</div>
            <div style={{ fontSize: 12, color: '#888' }}>GENFOCUS</div>
          </div>
          <div style={S.sigBox}>
            <div style={S.sealPlaceholder}>Company Seal</div>
          </div>
        </div>

        {/* Footer */}
        <div style={S.footerRight}>
          <div style={S.footerCompany}>GENFOCUS</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Genfocus Infotech (P) Ltd</div>
          <div><E value={footerAddr} onChange={setFooterAddr} style={{ minWidth: 200 }} /></div>
          <div><E value={footerCity} onChange={setFooterCity} style={{ minWidth: 200 }} /></div>
          <div>Email: <E value={footerEmail} onChange={setFooterEmail} style={{ minWidth: 160 }} /></div>
          <div>Web: <E value={footerWeb} onChange={setFooterWeb} style={{ minWidth: 160 }} /></div>
          <div>Ph: <E value={footerPhone} onChange={setFooterPhone} style={{ minWidth: 200 }} /></div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
           PAGE 2 — Quotation Items & Totals
         ══════════════════════════════════════════════════════ */}
      <div style={S.page}>
        <PageHeader />

        {/* Quotation meta */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontSize: 13 }}>
          <div>
            <strong>Quotation No:</strong> {q.quotationNumber}<br />
            <strong>Date:</strong> {dayjs(q.quotationDate).format('DD MMM YYYY')}<br />
            <strong>Valid Until:</strong> {dayjs(q.validUntil).format('DD MMM YYYY')}
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong>Bill To:</strong><br />
            <span style={{ fontWeight: 700 }}>{q.partyName || '—'}</span><br />
            {q.partyPhone && <span>{q.partyPhone}<br /></span>}
            {q.partyAddress && <span style={{ fontSize: 12, color: '#666' }}>{q.partyAddress}</span>}
          </div>
        </div>

        {/* Items Table */}
        <table style={S.tableStyle}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: 36 }}>#</th>
              <th style={S.th}>Item Description</th>
              <th style={{ ...S.th, width: 60 }}>HSN</th>
              <th style={{ ...S.thR, width: 54 }}>Qty</th>
              <th style={{ ...S.thR, width: 54 }}>Unit</th>
              <th style={{ ...S.thR, width: 80 }}>Rate (₹)</th>
              <th style={{ ...S.thR, width: 64 }}>Disc%</th>
              <th style={{ ...S.thR, width: 80 }}>Taxable (₹)</th>
              <th style={{ ...S.thR, width: 60 }}>GST%</th>
              <th style={{ ...S.thR, width: 90 }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {(q.items || []).map((item, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf0' }}>
                <td style={{ ...S.td, textAlign: 'center' }}>{idx + 1}</td>
                <td style={S.td}>
                  <div style={{ fontWeight: 600 }}>{item.itemName}</div>
                  {item.itemCode && <div style={{ fontSize: 11, color: '#888' }}>Code: {item.itemCode}</div>}
                </td>
                <td style={S.td}>{item.hsnCode || '—'}</td>
                <td style={S.tdR}>{item.quantity}</td>
                <td style={S.tdR}>{item.unit || '—'}</td>
                <td style={S.tdR}>{fmt(item.rate)}</td>
                <td style={S.tdR}>{item.discountPercent || 0}%</td>
                <td style={S.tdR}>{fmt(item.taxableAmount)}</td>
                <td style={S.tdR}>{item.gstPercent || 0}%</td>
                <td style={{ ...S.tdR, fontWeight: 600 }}>{fmt(item.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={S.totalsBlock}>
          {[
            ['Gross Amount', q.grossAmount],
            ['Item Discount', q.itemDiscount],
            ['Taxable Amount', q.taxableAmount],
            ['CGST', q.totalCgst],
            ['SGST', q.totalSgst],
            ...(q.totalIgst ? [['IGST', q.totalIgst]] : []),
            ['Total GST', q.totalGst],
            ['Round Off', q.roundOff],
          ].map(([label, val]) => (
            <div key={label} style={S.totRow(false, false)}>
              <span>{label}</span>
              <span>₹ {fmt(val)}</span>
            </div>
          ))}
          <div style={S.totRow(true, true)}>
            <span>GRAND TOTAL</span>
            <span>₹ {fmt(q.grandTotal)}</span>
          </div>
        </div>

        {/* Amount in words */}
        <div style={S.amtWords}>
          <strong>Amount in Words:</strong> {amtWords}
        </div>

        {/* Terms */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#1a1a2e' }}>
            Terms &amp; Conditions:
          </div>
          <div style={S.termsBox}>
            <E
              value={terms}
              onChange={setTerms}
              tag="div"
              style={{ display: 'block', whiteSpace: 'pre-line', borderBottom: 'none' }}
            />
          </div>
        </div>

        {/* Signature */}
        <div style={{ ...S.sigSection, marginTop: 24 }}>
          <div style={{ fontSize: 13, color: '#666' }}>
            <div>Prepared by: ___________________</div>
          </div>
          <div style={S.sigBox}>
            <div style={S.signPlaceholder}>Signature</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Authorized Signatory</div>
            <div style={{ fontSize: 12, color: '#888' }}>GENFOCUS · Genfocus Infotech (P) Ltd</div>
          </div>
        </div>

        {/* Footer */}
        <div style={S.footerRight}>
          <div style={S.footerCompany}>GENFOCUS</div>
          <div style={{ fontSize: 12 }}>
            {footerAddr} | {footerCity} | {footerPhone}
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>
    </div>
  );
}
