import { Select } from '@mantine/core';

const SearchableSelect = ({
  options = [],
  placeholder = 'Select...',
  value,
  onChange,
  onSearch,
  loading = false,
  allowClear = true,
  showSearch = true,
  disabled = false
}) => {
  // Convert options to Mantine format if needed
  const mantineOptions = options.map(opt => ({
    value: opt.value?.toString() || '',
    label: opt.label || opt.value?.toString() || ''
  }));

  return (
    <Select
      placeholder={placeholder}
      value={value?.toString() || null}
      onChange={(val) => onChange(val)}
      data={mantineOptions}
      searchable={showSearch}
      clearable={allowClear}
      disabled={disabled || loading}
      onSearchChange={onSearch}
      nothingFoundMessage="No options found"
      styles={{
        input: {
          '&:disabled': {
            opacity: 0.6,
            cursor: 'not-allowed'
          }
        }
      }}
    />
  );
};

export default SearchableSelect;
