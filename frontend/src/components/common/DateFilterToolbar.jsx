import { useState } from 'react';
import { Group, Button, SegmentedControl, Select, NumberInput, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';

const DateFilterToolbar = ({ onFilterChange }) => {
  const [filterMode, setFilterMode] = useState('custom');
  const [preset, setPreset] = useState('thisMonth');
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month());
  const [fromDate, setFromDate] = useState(dayjs().startOf('month').toDate());
  const [toDate, setToDate] = useState(dayjs().endOf('month').toDate());

  const handleApply = () => {
    let filterData = { filterMode };

    switch (filterMode) {
      case 'preset':
        filterData.filterType = preset;
        break;
      case 'month':
        filterData.filterType = 'custom';
        filterData.customStart = dayjs(new Date(selectedYear, selectedMonth, 1)).format('YYYY-MM-DD');
        filterData.customEnd = dayjs(new Date(selectedYear, selectedMonth + 1, 0)).format('YYYY-MM-DD');
        break;
      case 'year':
        filterData.filterType = 'custom';
        filterData.customStart = dayjs(new Date(selectedYear, 0, 1)).format('YYYY-MM-DD');
        filterData.customEnd = dayjs(new Date(selectedYear, 11, 31)).format('YYYY-MM-DD');
        break;
      case 'custom':
        filterData.filterType = 'custom';
        filterData.customStart = dayjs(fromDate).format('YYYY-MM-DD');
        filterData.customEnd = dayjs(toDate).format('YYYY-MM-DD');
        filterData.startDate = dayjs(fromDate).format('YYYY-MM-DD');
        filterData.endDate = dayjs(toDate).format('YYYY-MM-DD');
        break;
      default:
        filterData.filterType = preset;
    }

    onFilterChange(filterData);
  };

  const monthOptions = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ].map((month, idx) => ({ value: idx.toString(), label: month }));

  return (
    <div className="date-filter-toolbar" style={{ marginBottom: '1rem' }}>
      <Group gap="md" align="flex-end" wrap="wrap">
        <SegmentedControl
          value={filterMode}
          onChange={setFilterMode}
          data={[
            { label: 'From-To', value: 'custom' },
            { label: 'Preset', value: 'preset' },
            { label: 'Month', value: 'month' },
            { label: 'Year', value: 'year' }
          ]}
        />

        {filterMode === 'custom' && (
          <Group gap="sm" align="flex-end">
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px', fontWeight: 500 }}>From Date</label>
              <DatePickerInput
                value={fromDate}
                onChange={setFromDate}
                placeholder="From date"
                style={{ width: 150 }}
                valueFormat="DD/MM/YYYY"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px', fontWeight: 500 }}>To Date</label>
              <DatePickerInput
                value={toDate}
                onChange={setToDate}
                placeholder="To date"
                style={{ width: 150 }}
                valueFormat="DD/MM/YYYY"
              />
            </div>
          </Group>
        )}

        {filterMode === 'preset' && (
          <Select
            value={preset}
            onChange={setPreset}
            data={[
              { value: 'thisMonth', label: 'This Month' },
              { value: 'lastMonth', label: 'Last Month' },
              { value: 'thisQuarter', label: 'This Quarter' },
              { value: 'thisYear', label: 'This Year' },
              { value: 'financialYear', label: 'Financial Year' }
            ]}
            style={{ width: 200 }}
          />
        )}

        {filterMode === 'month' && (
          <>
            <Select
              value={selectedMonth.toString()}
              onChange={(val) => setSelectedMonth(Number(val))}
              data={monthOptions}
              style={{ width: 150 }}
            />
            <NumberInput
              value={selectedYear}
              onChange={setSelectedYear}
              min={2000}
              max={2099}
              style={{ width: 100 }}
            />
          </>
        )}

        {filterMode === 'year' && (
          <NumberInput
            value={selectedYear}
            onChange={setSelectedYear}
            min={2000}
            max={2099}
            style={{ width: 100 }}
          />
        )}

        <Button onClick={handleApply}>
          Apply Filter
        </Button>
      </Group>
    </div>
  );
};

export default DateFilterToolbar;
