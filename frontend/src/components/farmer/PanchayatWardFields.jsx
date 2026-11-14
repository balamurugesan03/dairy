/**
 * Farmer address → Panchayat, Ward, Ward Number (Add / Edit Farmer).
 *
 * Panchayat: all Kerala Grama Panchayats (grouped by district) plus the names already
 * used in Farmer Management; any other name can be typed. Ward: the wards already
 * recorded for that Panchayat's farmers, then Ward 1…24; also free text. Ward Number
 * fills in from the chosen ward and can be changed.
 */
import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Grid, TextInput, Text } from '@mantine/core';
import { farmerFormAPI } from '../../services/api';
import {
  findKeralaPanchayat, panchayatAliases, panchayatOptions, wardOptions, wardNumberFor,
} from '../../utils/keralaPanchayat';

let recordedCache = null;   // Panchayats in Farmer Management, once per page load

export default function PanchayatWardFields({ form, onKeyDown, span = 6 }) {
  const [recorded, setRecorded] = useState(recordedCache || []);
  const [wards, setWards] = useState([]);
  const panchayat = form.values.address?.panchayat || '';
  const ward = form.values.address?.ward || '';

  useEffect(() => {
    if (recordedCache) return;
    farmerFormAPI.getPanchayats()
      .then((r) => { recordedCache = r?.data || []; setRecorded(recordedCache); })
      .catch(() => {});
  }, []);

  // Wards of the selected Panchayat
  useEffect(() => {
    const p = panchayat.trim();
    if (!p) { setWards([]); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      farmerFormAPI.getWards(p, panchayatAliases(p))
        .then((r) => { if (alive) setWards(r?.data || []); })
        .catch(() => { if (alive) setWards([]); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [panchayat]);

  const pOptions = useMemo(() => panchayatOptions(recorded), [recorded]);
  const wOptions = useMemo(() => wardOptions(wards), [wards]);
  const known = findKeralaPanchayat(panchayat);

  const onPanchayat = (v) => {
    form.setFieldValue('address.panchayat', v);
  };
  const onWard = (v) => {
    form.setFieldValue('address.ward', v);
    const n = wardNumberFor(v, wards);
    if (n) form.setFieldValue('address.wardNumber', n);
  };

  return (
    <>
      <Grid.Col span={span}>
        <Autocomplete
          label="Panchayat"
          placeholder="Select or type the Grama Panchayat"
          data={pOptions}
          limit={60}
          maxDropdownHeight={280}
          value={panchayat}
          onChange={onPanchayat}
          error={form.errors['address.panchayat']}
          description={panchayat.trim()
            ? (known ? `${known.district} district · ${known.ml}` : 'Not in the Kerala Panchayat list — saved as typed')
            : null}
          onKeyDown={onKeyDown}
        />
      </Grid.Col>
      <Grid.Col span={span}>
        <Autocomplete
          label="Ward"
          placeholder={panchayat.trim() ? 'Select or type the ward' : 'Select Panchayat first'}
          data={wOptions}
          limit={60}
          maxDropdownHeight={280}
          value={ward}
          onChange={onWard}
          error={form.errors['address.ward']}
          onKeyDown={onKeyDown}
        />
      </Grid.Col>
      <Grid.Col span={span}>
        <TextInput
          label="Ward Number"
          placeholder="Auto from ward"
          {...form.getInputProps('address.wardNumber')}
          onKeyDown={onKeyDown}
        />
        {wards.length > 0 && !ward && (
          <Text size="xs" c="dimmed" mt={2}>{wards.length} ward(s) recorded for this Panchayat</Text>
        )}
      </Grid.Col>
    </>
  );
}
