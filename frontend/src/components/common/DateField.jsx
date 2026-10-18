import { forwardRef } from 'react';
import { DateInput } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';

/**
 * Drop-in replacement for <input type="date"> / <TextInput type="date">.
 * A native date input shows whatever format the browser's locale uses
 * (mm/dd/yyyy on an en-US browser), so every page uses this instead and
 * gets the app-wide DD/MM/YYYY format (theme defaults on DateInput).
 *
 * Same contract as the native input: `value` is a "YYYY-MM-DD" string and
 * `onChange` receives an event-like object whose target.value is
 * "YYYY-MM-DD" ('' when cleared) — so existing
 * `onChange={(e) => setX(e.target.value)}` handlers and Mantine
 * form.getInputProps() keep working unchanged.
 */
const DateField = forwardRef(({
  value, onChange, name, min, max, clearable = false,
  leftSection = <IconCalendar size={14} />, placeholder = 'DD/MM/YYYY', ...rest
}, ref) => {
  const handleChange = (val) => {
    // A real <input> element as target: Mantine form's getInputProps only
    // reads event values from an actual HTMLInputElement currentTarget.
    const target = document.createElement('input');
    target.value = val || '';
    if (name) target.name = name;
    onChange?.({ target, currentTarget: target, nativeEvent: null });
  };

  return (
    <DateInput
      ref={ref}
      name={name}
      value={value || null}
      onChange={handleChange}
      minDate={min || undefined}
      maxDate={max || undefined}
      clearable={clearable}
      leftSection={leftSection}
      placeholder={placeholder}
      {...rest}
    />
  );
});

DateField.displayName = 'DateField';

export default DateField;
