import React from 'react';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';

const DateRangePickerComponent = ({
  value,
  onChange,
  format = 'YYYY-MM-DD',
  placeholder = ['Start Date', 'End Date'],
  ...rest
}) => {
  // Convert dayjs objects to Date objects for Mantine
  const dateValue = value ? [
    value[0] ? (dayjs.isDayjs(value[0]) ? value[0].toDate() : new Date(value[0])) : null,
    value[1] ? (dayjs.isDayjs(value[1]) ? value[1].toDate() : new Date(value[1])) : null
  ] : null;

  const handleChange = (dates) => {
    if (!dates || !dates[0] || !dates[1]) {
      onChange?.(null);
      return;
    }
    // Convert back to dayjs for consistency
    onChange?.([dayjs(dates[0]), dayjs(dates[1])]);
  };

  return (
    <DatePickerInput
      type="range"
      placeholder={placeholder.join(' ~ ')}
      value={dateValue}
      onChange={handleChange}
      clearable
      valueFormat={format}
      {...rest}
    />
  );
};

export default DateRangePickerComponent;
