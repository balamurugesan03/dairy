import { useEffect, useRef, useState } from 'react';
import { Box, Button, Group, Loader, Center, Text } from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';
import { cropStatementAPI } from '../../services/api';

export default function CropStatementPrint({ statementId }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef();

  useEffect(() => {
    cropStatementAPI.getById(statementId).then(res => {
      if (res?.success) setData(res.data);
      setLoading(false);
    });
  }, [statementId]);

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Crop Damage Statement - ${data?.statementNo || ''}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; }
          .print-wrapper { width: 100%; }
          .stmt-title { text-align: center; font-size: 18px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 4px; }
          .stmt-subtitle { text-align: center; font-size: 11px; margin-bottom: 18px; color: #333; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          .info-table td { padding: 5px 8px; vertical-align: top; font-size: 11px; }
          .info-label { font-weight: 700; width: 38%; white-space: nowrap; }
          .info-value { border-bottom: 1px solid #000; min-width: 120px; padding-bottom: 1px; }
          .crop-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          .crop-table th, .crop-table td { border: 1.5px solid #000; padding: 5px 4px; text-align: center; font-size: 10px; vertical-align: middle; }
          .crop-table th { font-weight: 700; background: #f0f0f0; }
          .crop-table .col-letter { font-size: 9px; color: #555; display: block; }
          .crop-table td.data-cell { text-align: center; }
          .section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1.5px solid #000; padding-bottom: 3px; margin-bottom: 8px; }
          .declaration-block { margin-bottom: 16px; }
          .declaration-text { border-bottom: 1px solid #000; min-height: 22px; padding: 3px 0; font-size: 11px; margin-bottom: 4px; }
          .signature-row { display: flex; justify-content: space-between; margin-top: 30px; }
          .signature-box { text-align: center; width: 45%; border-top: 1.5px solid #000; padding-top: 5px; font-size: 11px; font-weight: 700; }
          .divider { border-top: 1.5px solid #000; margin: 14px 0; }
          .no-print { display: none; }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  if (loading) return <Center h={200}><Loader /></Center>;
  if (!data)   return <Center h={200}><Text c="red">Statement not found</Text></Center>;

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

  // Ensure at least 5 rows for blank lines
  const rows = [...(data.cropRows || [])];
  while (rows.length < 5) rows.push({});

  return (
    <Box>
      <Group justify="flex-end" mb="md">
        <Button leftSection={<IconPrinter size={14} />} onClick={handlePrint} variant="filled">
          Print / Download
        </Button>
      </Group>

      {/* ── The printable document ── */}
      <div ref={printRef}>
        <div className="print-wrapper" style={{ padding: '12px 16px', background: '#fff', fontFamily: 'Arial, sans-serif', color: '#000' }}>

          {/* TITLE */}
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 6, textTransform: 'uppercase', marginBottom: 2 }}>
              STATEMENT
            </div>
            <div style={{ fontSize: 11, color: '#444', marginBottom: 2 }}>
              Crop Damage Assessment Statement
            </div>
            <div style={{ fontSize: 11 }}>
              Statement No: <strong>{data.statementNo}</strong>
              &nbsp;&nbsp;|&nbsp;&nbsp;
              Date: <strong>{fmtDate(data.statementDate)}</strong>
            </div>
          </div>

          <div style={{ borderTop: '2.5px solid #000', borderBottom: '1px solid #000', margin: '10px 0' }} />

          {/* ── Two-column info grid ── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <tbody>
              <tr>
                {/* LEFT */}
                <td style={{ width: '50%', verticalAlign: 'top', paddingRight: 12 }}>
                  {[
                    ['Name of the Farmer', data.farmerName],
                    ['Survey Number of Land Owned by the Farmer', data.surveyNumber]
                  ].map(([label, value]) => (
                    <table key={label} style={{ width: '100%', marginBottom: 8 }}>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: 700, fontSize: 11, paddingBottom: 2, whiteSpace: 'nowrap', paddingRight: 6, width: 1 }}>
                            {label}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ borderBottom: '1px solid #000', fontSize: 11, paddingBottom: 2, minWidth: 150 }}>
                            {value || '\u00a0'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ))}
                </td>

                {/* RIGHT */}
                <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: 12, borderLeft: '1px dashed #aaa' }}>
                  {[
                    ['Name of the Bank', data.bankName],
                    ['Loan Account Number', data.loanAccountNumber],
                    ['Farmer Aadhaar Number', data.aadhaarNumber],
                    ['Farmer Mobile Number', data.mobileNumber]
                  ].map(([label, value]) => (
                    <table key={label} style={{ width: '100%', marginBottom: 6 }}>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: 700, fontSize: 11, width: '52%', verticalAlign: 'bottom', paddingRight: 6 }}>
                            {label} :
                          </td>
                          <td style={{ borderBottom: '1px solid #000', fontSize: 11, paddingBottom: 2 }}>
                            {value || '\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ))}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ borderTop: '1.5px solid #000', marginBottom: 12 }} />

          {/* ── Crop Table ── */}
          <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Crop Damage Details
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead>
              <tr style={{ background: '#e8e8e8' }}>
                {[
                  { letter: '(A)', label: 'Sl. No' },
                  { letter: '(B)', label: 'Crop Cultivated' },
                  { letter: '(C)', label: 'Area Owned (Acres)' },
                  { letter: '(D)', label: 'Area Leased (Acres)' },
                  { letter: '(C+D)', label: 'Total Cultivated Area' },
                  { letter: '(F)', label: 'Area Affected (Acres)' },
                  { letter: '(G)', label: 'Percentage of Loss (%)' },
                  { letter: '(H)', label: 'Description of Damage' },
                  { letter: '(I)', label: 'Type of Damage' }
                ].map(({ letter, label }) => (
                  <th key={letter} style={{
                    border: '1.5px solid #000', padding: '5px 4px', textAlign: 'center',
                    fontSize: 10, fontWeight: 700, lineHeight: 1.3
                  }}>
                    <span style={{ display: 'block', fontSize: 9, color: '#555', fontWeight: 400 }}>{letter}</span>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={pTd}>{row.slNo ?? idx + 1}</td>
                  <td style={{ ...pTd, textAlign: 'left', paddingLeft: 6 }}>{row.cropCultivated || ''}</td>
                  <td style={pTd}>{row.areaOwned || ''}</td>
                  <td style={pTd}>{row.areaLeased || ''}</td>
                  <td style={{ ...pTd, background: '#f5f5f5' }}>
                    {(+(row.areaOwned || 0) + +(row.areaLeased || 0)) || ''}
                  </td>
                  <td style={pTd}>{row.areaAffected || ''}</td>
                  <td style={pTd}>{row.percentageLoss != null && row.percentageLoss !== '' ? `${row.percentageLoss}%` : ''}</td>
                  <td style={{ ...pTd, textAlign: 'left', paddingLeft: 6 }}>{row.descriptionOfDamage || ''}</td>
                  <td style={{ ...pTd, textAlign: 'left', paddingLeft: 6 }}>{row.typeOfDamage || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: '1.5px solid #000', marginBottom: 12 }} />

          {/* ── Footer Declarations ── */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>Description of Damages Occurred :</div>
            <div style={{
              borderBottom: '1px solid #000', minHeight: 28, padding: '3px 0',
              fontSize: 11, marginBottom: 10
            }}>
              {data.descriptionOfDamagesOccurred || '\u00a0'}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>Farmer's Declaration :</div>
            <div style={{ borderBottom: '1px solid #000', minHeight: 24, padding: '3px 0', fontSize: 11, marginBottom: 4 }}>
              {data.farmerDeclaration || 'I hereby declare that the above information is true and correct to the best of my knowledge.'}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>Officer's Declaration :</div>
            <div style={{ borderBottom: '1px solid #000', minHeight: 24, padding: '3px 0', fontSize: 11, marginBottom: 4 }}>
              {data.officerDeclaration || 'I hereby certify that I have personally verified the above details and they are correct.'}
            </div>
          </div>

          <div style={{ borderTop: '1.5px solid #000', marginBottom: 20 }} />

          {/* ── Signature Row ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <div style={{ textAlign: 'center', width: '40%' }}>
              <div style={{ borderBottom: '1.5px solid #000', marginBottom: 5, height: 40 }} />
              <div style={{ fontWeight: 700, fontSize: 11 }}>Farmer's Signature</div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>(with date)</div>
            </div>
            <div style={{ textAlign: 'center', width: '40%' }}>
              <div style={{ borderBottom: '1.5px solid #000', marginBottom: 5, height: 40 }} />
              <div style={{ fontWeight: 700, fontSize: 11 }}>Authorised Officer's Signature</div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>(with seal & date)</div>
            </div>
          </div>

        </div>
      </div>
    </Box>
  );
}

const pTd = {
  border: '1.5px solid #000',
  padding: '5px 4px',
  textAlign: 'center',
  fontSize: 10,
  verticalAlign: 'middle'
};
