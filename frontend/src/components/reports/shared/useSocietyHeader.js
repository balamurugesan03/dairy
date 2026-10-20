import { useEffect, useState } from 'react';
import { societyInfoAPI } from '../../../services/api';
import { useCompany } from '../../../context/CompanyContext';

/**
 * Report header details from the Society Info menu (Settings → Society Info):
 * society name, society code and address (Door No, City, State - PIN).
 *
 * The society code is taken ONLY from Society Info — never the code typed at
 * login. Name and address fall back to the company record until Society Info
 * has been filled in.
 */
const useSocietyHeader = () => {
  const { selectedCompany } = useCompany();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let alive = true;
    societyInfoAPI.get()
      .then(res => { if (alive) setInfo(res?.data?.info || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [selectedCompany?._id]);

  const address = info
    ? [info.doorNo, info.city, [info.state, info.pinCode].filter(Boolean).join(' - ')]
        .map(s => (s || '').trim()).filter(Boolean).join(', ')
    : '';

  return {
    societyName: info?.societyName?.trim()
      || selectedCompany?.societyName || selectedCompany?.companyName || 'Dairy Co-operative Society',
    societyCode: info?.societyCode?.trim() || '',
    societyPlace: address || selectedCompany?.address || selectedCompany?.district || ''
  };
};

export default useSocietyHeader;
