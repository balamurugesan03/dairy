import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './BusinessProposal.css';

/* ── Default proposal data — all fields editable ─────────── */
const DEFAULT_DATA = {
  refNumber: 'DTS/THR/01/2025-2026',
  date: '23/07/2025',

  /* Recipient */
  toTitle: 'THE PRESIDENT/SECRETARY',
  toOrganization: 'PANTHALLUR KSHEEROLPADHAKA SAHAKARANA SANGHAM',
  toRegNo: 'LTD NO. R 234 (D) APCOS',
  toAddress: 'PANTHALLUR.PO, NELLAYI',
  toCity: 'THRISSUR – 680305',
  toPhone: '9400943622',

  /* Company intro */
  companyIntro:
    'Dairy Tech Solutions Pvt. Ltd. is a leading dairy automation company with over 11 years of dedicated experience in delivering cutting-edge milk collection and quality testing solutions across Kerala. With 829+ successful installations to our credit, we have established ourselves as the most trusted name in dairy automation in the state. As the exclusive authorized dealer for ESSAE and PROMPT Milk Analyzers, we bring world-class technology to every dairy co-operative. Our core specialization lies in designing, supplying, and commissioning Automatic Milk Collection Stations (AMCS) that ensure accurate fat and SNF measurement, transparent farmer payments, and seamless data integration.',

  /* Proposal intro */
  proposalIntro:
    'We are pleased to submit our comprehensive proposal for the implementation of a Milk Analyzer at your esteemed Dairy Co-operative Society. The proposed solution is designed to automate and streamline the milk procurement process, ensuring accuracy, transparency, and efficiency at every step. We assure you of our commitment to delivering quality products, prompt installation, and continued after-sales support.',

  /* Signature */
  sigName: 'SAYANA',
  sigDesignation: 'Customer Support Manager',
  companyName: 'DAIRY TECH SOLUTIONS PVT. LTD',

  /* Product */
  productName: 'Milk Analyzer – Essae MA-815',
  productIntro:
    'The Essae MA-815 Milk Analyzer is a state-of-the-art ultrasonic milk testing instrument designed for fast, accurate, and reliable measurement of milk quality parameters including Fat, SNF, Added Water, and CLR. Engineered for rugged field conditions, it is ideal for dairy co-operatives of all sizes and ensures fair payments to milk producers based on accurate quality assessment.',

  /* Specs */
  specs: [
    { label: 'Brand',            value: 'Essae' },
    { label: 'Model',            value: 'MA-815, MA-815(SS)' },
    { label: 'Technology',       value: 'Ultrasonic Sensor' },
    { label: 'Measuring Time',   value: '38 sec @ 30°C' },
    { label: 'Milk Temperature', value: '0 ~ 40°C' },
    { label: 'Milk Sample Volume', value: '25 ml' },
    { label: 'Display',          value: '2 × 20 Character LCD' },
  ],

  /* Measuring parameters */
  params: [
    { parameter: 'Fat',        range: '0.5% to 15%',  accuracy: '+/– 0.1%' },
    { parameter: 'SNF',        range: '3% to 15%',    accuracy: '+/– 0.2%' },
    { parameter: 'Added Water',range: '0% to 100%',   accuracy: '+/– 3%' },
    { parameter: 'CLR',        range: '20 to 40',     accuracy: '+/– 1%' },
  ],

  /* Total solution */
  solution: [
    { item: 'Milk Analyzer', brand: 'Essae', nos: '1' },
  ],

  /* Contact */
  contactPerson: 'SAYANA',
  contactEmail: 'dairytechsolutions@gmail.com',
  contactNumbers: '9207011151, 9961011151',

  /* Office addresses */
  offices: [
    {
      city: 'TRIVANDRUM',
      name: 'DAIRY TECH SOLUTIONS PRIVATE LIMITED',
      address: 'TC 14/1469, Near Pettah Bridge, Pettah,\nThiruvananthapuram – 695 024',
      phone: '9207011151',
      email: 'dairytechsolutions@gmail.com',
    },
  ],
};

/* ═══════════════════════════════════════════════════════════
   Edit Modal — generic form to change any data object
   ═══════════════════════════════════════════════════════════ */
const EditModal = ({ title, fields, values, onChange, onClose, onSave }) => (
  <div className="bp-modal-overlay">
    <div className="bp-modal">
      <div className="bp-modal-title">{title}</div>
      {fields.map(f => (
        <div className="bp-form-group" key={f.key}>
          <label className="bp-form-label">{f.label}</label>
          {f.multiline ? (
            <textarea
              className="bp-form-textarea"
              rows={f.rows || 3}
              value={values[f.key] ?? ''}
              onChange={e => onChange(f.key, e.target.value)}
            />
          ) : (
            <input
              className="bp-form-input"
              type="text"
              value={values[f.key] ?? ''}
              onChange={e => onChange(f.key, e.target.value)}
            />
          )}
        </div>
      ))}
      <div className="bp-modal-actions">
        <button className="bp-btn bp-btn-outline" onClick={onClose}>Cancel</button>
        <button className="bp-btn bp-btn-primary" onClick={onSave}>Save Changes</button>
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════
   Office Address Edit Modal
   ═══════════════════════════════════════════════════════════ */
const OfficeEditModal = ({ offices, onClose, onSave }) => {
  const [local, setLocal] = useState(offices.map(o => ({ ...o })));

  const update = (idx, key, val) => {
    setLocal(prev => prev.map((o, i) => i === idx ? { ...o, [key]: val } : o));
  };

  const addOffice = () => setLocal(prev => [...prev, { city: '', name: '', address: '', phone: '', email: '' }]);
  const removeOffice = idx => setLocal(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="bp-modal-overlay">
      <div className="bp-modal">
        <div className="bp-modal-title">Edit Office Addresses</div>
        {local.map((o, idx) => (
          <div key={idx} style={{ background: '#f5f9ff', border: '1px solid #90caf9', borderRadius: 6, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, color: '#0d47a1', fontSize: 13 }}>Office {idx + 1}</span>
              {local.length > 1 && (
                <button className="bp-btn bp-btn-warning" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => removeOffice(idx)}>
                  Remove
                </button>
              )}
            </div>
            {['city', 'name', 'address', 'phone', 'email'].map(key => (
              <div className="bp-form-group" key={key}>
                <label className="bp-form-label">{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                {key === 'address' ? (
                  <textarea
                    className="bp-form-textarea"
                    rows={2}
                    value={o[key] ?? ''}
                    onChange={e => update(idx, key, e.target.value)}
                  />
                ) : (
                  <input
                    className="bp-form-input"
                    type="text"
                    value={o[key] ?? ''}
                    onChange={e => update(idx, key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
        <button className="bp-btn bp-btn-outline" style={{ width: '100%', marginBottom: 10 }} onClick={addOffice}>
          + Add Another Office
        </button>
        <div className="bp-modal-actions">
          <button className="bp-btn bp-btn-outline" onClick={onClose}>Cancel</button>
          <button className="bp-btn bp-btn-primary" onClick={() => onSave(local)}>Save Changes</button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   Table Row Edit Modal (specs / params / solution)
   ═══════════════════════════════════════════════════════════ */
const TableEditModal = ({ title, rows, columns, onClose, onSave }) => {
  const [local, setLocal] = useState(rows.map(r => ({ ...r })));

  const update = (idx, key, val) => {
    setLocal(prev => prev.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  };

  const addRow = () => {
    const empty = {};
    columns.forEach(c => { empty[c.key] = ''; });
    setLocal(prev => [...prev, empty]);
  };

  const removeRow = idx => setLocal(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="bp-modal-overlay">
      <div className="bp-modal">
        <div className="bp-modal-title">{title}</div>
        {local.map((row, idx) => (
          <div key={idx} style={{ background: '#f5f9ff', border: '1px solid #90caf9', borderRadius: 6, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: '#0d47a1', fontSize: 12 }}>Row {idx + 1}</span>
              {local.length > 1 && (
                <button className="bp-btn bp-btn-warning" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => removeRow(idx)}>
                  ✕
                </button>
              )}
            </div>
            <div className="bp-form-row">
              {columns.map(col => (
                <div className="bp-form-group" key={col.key}>
                  <label className="bp-form-label">{col.label}</label>
                  <input
                    className="bp-form-input"
                    type="text"
                    value={row[col.key] ?? ''}
                    onChange={e => update(idx, col.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <button className="bp-btn bp-btn-outline" style={{ width: '100%', marginBottom: 10 }} onClick={addRow}>
          + Add Row
        </button>
        <div className="bp-modal-actions">
          <button className="bp-btn bp-btn-outline" onClick={onClose}>Cancel</button>
          <button className="bp-btn bp-btn-primary" onClick={() => onSave(local)}>Save Changes</button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
const BusinessProposal = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(DEFAULT_DATA);
  const [modal, setModal] = useState(null); // 'header' | 'recipient' | 'intro' | 'sig' | 'product' | 'specs' | 'params' | 'solution' | 'contact' | 'offices'
  const [draft, setDraft] = useState({});

  const openModal = (key) => {
    setDraft({ ...data });
    setModal(key);
  };

  const closeModal = () => setModal(null);

  const saveDraft = () => {
    setData({ ...draft });
    closeModal();
  };

  const updateDraft = (key, val) => setDraft(prev => ({ ...prev, [key]: val }));

  const handlePrint = () => window.print();

  /* ── Inline edit pencil button ────────────────────────── */
  const EditBtn = ({ onClick, label = 'Edit' }) => (
    <button className="bp-btn bp-btn-outline no-print"
      style={{ padding: '3px 12px', fontSize: 11, marginLeft: 10 }}
      onClick={onClick}>
      ✏ {label}
    </button>
  );

  return (
    <div className="bp-wrapper">

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="bp-toolbar no-print">
        <button className="bp-btn bp-btn-outline" onClick={() => navigate(-1)}>← Back</button>
        <div className="bp-toolbar-actions">
          <button className="bp-btn bp-btn-success" onClick={handlePrint}>🖨 Print / Download PDF</button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          PROPOSAL PAGE
          ═══════════════════════════════════════════════════════ */}
      <div className="bp-page">

        {/* ── Brand Bar ───────────────────────────────────────── */}
        <div className="bp-brand-bar">
          <div className="bp-brand-left">
            <div className="bp-brand-name">{data.companyName}</div>
            <div className="bp-brand-tagline">Dairy Automation Specialists · Kerala's Most Trusted</div>
          </div>
          <div className="bp-brand-right">
            <div className="bp-doc-title">PROPOSAL</div>
            <div className="bp-doc-subtitle">Business Proposal / Quotation</div>
          </div>
        </div>

        {/* ── Reference Bar ───────────────────────────────────── */}
        <div className="bp-ref-bar">
          <div className="bp-ref-item">
            <span className="bp-ref-label">Ref. No.:</span>
            <span className="bp-ref-value">{data.refNumber}</span>
          </div>
          <div className="bp-ref-item">
            <span className="bp-ref-label">Date:</span>
            <span className="bp-ref-value">{data.date}</span>
            <EditBtn onClick={() => openModal('header')} label="Edit Ref / Date" />
          </div>
        </div>

        {/* ── LETTER BODY ─────────────────────────────────────── */}
        <div className="bp-body">

          {/* To Block */}
          <div className="bp-to-block">
            <div className="bp-to-label">
              To
              <EditBtn onClick={() => openModal('recipient')} />
            </div>
            <div className="bp-to-address">
              <strong>{data.toTitle}</strong>
              {data.toOrganization}
              {data.toRegNo && <><br />{data.toRegNo}</>}
              <br />{data.toAddress}
              <br />{data.toCity}
              <br />Ph: {data.toPhone}
            </div>
          </div>

          {/* Salutation */}
          <div className="bp-salutation">Respected Sir,</div>

          {/* Subject */}
          <div className="bp-subject-line">
            Sub: Proposal for Implementation of Milk Analyzer at Dairy Co-Operative Society
          </div>

          {/* Company intro */}
          <p className="bp-para">
            {data.companyIntro}
          </p>

          {/* Proposal intro */}
          <p className="bp-para">
            {data.proposalIntro}
          </p>
          <EditBtn onClick={() => openModal('intro')} label="Edit Introduction" />

          <hr className="bp-divider" />

          {/* Signature */}
          <div className="bp-sig-block">
            <div className="bp-sig-thanks">Thanking You,</div>
            <div className="bp-sig-for">For – {data.companyName}</div>
            <div className="bp-sig-line-draw" />
            <div className="bp-sig-name">{data.sigName}</div>
            <div className="bp-sig-desig">{data.sigDesignation}</div>
          </div>
          <EditBtn onClick={() => openModal('sig')} label="Edit Signature" />

          {/* ═══ PRODUCT SECTION ══════════════════════════════ */}
          <hr className="bp-divider" />

          <div className="bp-section-header">
            {data.productName}
            <EditBtn onClick={() => openModal('product')} label="Edit Product" />
          </div>

          <p className="bp-para">{data.productIntro}</p>

          {/* Salient Features */}
          <div className="bp-section-sub">Salient Features</div>
          <ul className="bp-features-list">
            <li>Easy availability of spares</li>
            <li>Replaceable parts</li>
            <li>Easy operation, cleaning &amp; calibration</li>
            <li>Rugged yet lightweight framework</li>
            <li>Elegant and compact design</li>
            <li>Dependable structure</li>
            <li>Cost effective operation due to low power consumption</li>
            <li>RS232 interface and POS Printer Support</li>
          </ul>

          {/* Specifications */}
          <div className="bp-section-sub">
            Technical Specifications
            <EditBtn onClick={() => openModal('specs')} />
          </div>
          <table className="bp-table">
            <thead>
              <tr>
                <th style={{ width: '42%' }}>Parameter</th>
                <th style={{ width: '5%' }} className="center"></th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {data.specs.map((s, i) => (
                <tr key={i}>
                  <td className="bp-td-label">{s.label}</td>
                  <td className="bp-td-colon center">:</td>
                  <td>{s.value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Measuring Parameters */}
          <div className="bp-section-sub">
            Measuring Parameters
            <EditBtn onClick={() => openModal('params')} />
          </div>
          <table className="bp-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Measuring Range</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {data.params.map((p, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700 }}>{p.parameter}</td>
                  <td>{p.range}</td>
                  <td>{p.accuracy}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total Solution */}
          <div className="bp-section-sub">
            Total Solution Package
            <EditBtn onClick={() => openModal('solution')} />
          </div>
          <table className="bp-table solution">
            <thead>
              <tr>
                <th>Item / Description</th>
                <th>Brand</th>
                <th>Nos.</th>
              </tr>
            </thead>
            <tbody>
              {data.solution.map((s, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, textAlign: 'left' }}>{s.item}</td>
                  <td>{s.brand}</td>
                  <td>{s.nos}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ─── Contact Section ────────────────────────────── */}
          <div className="bp-contact-section">
            <div className="bp-contact-title">
              Contact Us
              <EditBtn onClick={() => openModal('contact')} />
            </div>
            <div className="bp-contact-grid">
              <div className="bp-contact-row">
                <span className="bp-contact-label">Contact Person</span>
                <span className="bp-contact-value">{data.contactPerson}</span>
              </div>
              <div className="bp-contact-row">
                <span className="bp-contact-label">Email</span>
                <span className="bp-contact-value">
                  <a href={`mailto:${data.contactEmail}`}>{data.contactEmail}</a>
                </span>
              </div>
              <div className="bp-contact-row">
                <span className="bp-contact-label">Phone Numbers</span>
                <span className="bp-contact-value">{data.contactNumbers}</span>
              </div>

              {/* Office Addresses */}
              <div className="bp-office-address">
                <div className="bp-contact-label" style={{ marginBottom: 8 }}>
                  Our Office(s)
                  <EditBtn onClick={() => openModal('offices')} label="Edit Offices" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  {data.offices.map((o, i) => (
                    <div key={i} className="bp-office-lines">
                      <strong>{o.city}:</strong>
                      {o.name}
                      {o.address.split('\n').map((line, j) => (
                        <span key={j}><br />{line}</span>
                      ))}
                      {o.phone && <><br />Ph: {o.phone}</>}
                      {o.email && <><br />Email: {o.email}</>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <div className="bp-footer">
          <span>This is a computer-generated proposal document.</span>
          <span>{data.companyName} · {data.contactEmail}</span>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          EDIT MODALS
          ════════════════════════════════════════════════════════ */}

      {/* Header / Ref / Date */}
      {modal === 'header' && (
        <EditModal
          title="Edit Reference & Date"
          fields={[
            { key: 'refNumber', label: 'Reference Number' },
            { key: 'date',      label: 'Date (DD/MM/YYYY)' },
            { key: 'companyName', label: 'Your Company Name' },
          ]}
          values={draft}
          onChange={updateDraft}
          onClose={closeModal}
          onSave={saveDraft}
        />
      )}

      {/* Recipient */}
      {modal === 'recipient' && (
        <EditModal
          title="Edit Recipient Address"
          fields={[
            { key: 'toTitle',        label: 'Designation / Title' },
            { key: 'toOrganization', label: 'Organization Name' },
            { key: 'toRegNo',        label: 'Registration No. (optional)' },
            { key: 'toAddress',      label: 'Address Line' },
            { key: 'toCity',         label: 'City / District – Pincode' },
            { key: 'toPhone',        label: 'Phone' },
          ]}
          values={draft}
          onChange={updateDraft}
          onClose={closeModal}
          onSave={saveDraft}
        />
      )}

      {/* Intro paragraphs */}
      {modal === 'intro' && (
        <EditModal
          title="Edit Introduction Paragraphs"
          fields={[
            { key: 'companyIntro',  label: 'Company Introduction', multiline: true, rows: 5 },
            { key: 'proposalIntro', label: 'Proposal Introduction', multiline: true, rows: 4 },
          ]}
          values={draft}
          onChange={updateDraft}
          onClose={closeModal}
          onSave={saveDraft}
        />
      )}

      {/* Signature */}
      {modal === 'sig' && (
        <EditModal
          title="Edit Signature Block"
          fields={[
            { key: 'sigName',        label: 'Name' },
            { key: 'sigDesignation', label: 'Designation' },
            { key: 'companyName',    label: 'Company Name (For –)' },
          ]}
          values={draft}
          onChange={updateDraft}
          onClose={closeModal}
          onSave={saveDraft}
        />
      )}

      {/* Product */}
      {modal === 'product' && (
        <EditModal
          title="Edit Product Details"
          fields={[
            { key: 'productName',  label: 'Product Title' },
            { key: 'productIntro', label: 'Product Description', multiline: true, rows: 4 },
          ]}
          values={draft}
          onChange={updateDraft}
          onClose={closeModal}
          onSave={saveDraft}
        />
      )}

      {/* Specs table */}
      {modal === 'specs' && (
        <TableEditModal
          title="Edit Technical Specifications"
          rows={draft.specs || data.specs}
          columns={[
            { key: 'label', label: 'Parameter' },
            { key: 'value', label: 'Value' },
          ]}
          onClose={closeModal}
          onSave={rows => { setData(prev => ({ ...prev, specs: rows })); closeModal(); }}
        />
      )}

      {/* Measuring params table */}
      {modal === 'params' && (
        <TableEditModal
          title="Edit Measuring Parameters"
          rows={draft.params || data.params}
          columns={[
            { key: 'parameter', label: 'Parameter' },
            { key: 'range',     label: 'Measuring Range' },
            { key: 'accuracy',  label: 'Accuracy' },
          ]}
          onClose={closeModal}
          onSave={rows => { setData(prev => ({ ...prev, params: rows })); closeModal(); }}
        />
      )}

      {/* Solution table */}
      {modal === 'solution' && (
        <TableEditModal
          title="Edit Total Solution Package"
          rows={draft.solution || data.solution}
          columns={[
            { key: 'item',  label: 'Item / Description' },
            { key: 'brand', label: 'Brand' },
            { key: 'nos',   label: 'Nos.' },
          ]}
          onClose={closeModal}
          onSave={rows => { setData(prev => ({ ...prev, solution: rows })); closeModal(); }}
        />
      )}

      {/* Contact */}
      {modal === 'contact' && (
        <EditModal
          title="Edit Contact Details"
          fields={[
            { key: 'contactPerson',  label: 'Contact Person Name' },
            { key: 'contactEmail',   label: 'Email Address' },
            { key: 'contactNumbers', label: 'Phone Numbers' },
          ]}
          values={draft}
          onChange={updateDraft}
          onClose={closeModal}
          onSave={saveDraft}
        />
      )}

      {/* Offices */}
      {modal === 'offices' && (
        <OfficeEditModal
          offices={data.offices}
          onClose={closeModal}
          onSave={offices => { setData(prev => ({ ...prev, offices })); closeModal(); }}
        />
      )}

    </div>
  );
};

export default BusinessProposal;
