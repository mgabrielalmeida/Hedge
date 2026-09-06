import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { parseCivilDate } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { Text } from './Text';

type DatePickerFieldProps = {
  allowClear?: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
};

export function DatePickerField({ allowClear = false, label, onChange, value }: DatePickerFieldProps) {
  const { tokens } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = toDate(value);

  function handleChange(event: DateTimePickerEvent, nextDate?: Date) {
    if (Platform.OS === 'android') setIsOpen(false);
    if (event.type === 'set' && nextDate) onChange(toCivilDate(nextDate));
  }

  return (
    <View style={styles.container}>
      <Text variant="caption" style={{ color: tokens.textMuted, marginBottom: tokens.spacing.sm }}>
        {label}
      </Text>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: tokens.surfaceElevated,
            borderColor: tokens.border,
            borderRadius: tokens.radius.md,
            opacity: pressed ? 0.76 : 1,
          },
        ]}
      >
        <Text>{value || 'Selecionar data'}</Text>
        <Text tone="muted">⌄</Text>
      </Pressable>

      {Platform.OS === 'android' && isOpen ? (
        <DateTimePicker mode="date" onChange={handleChange} value={selectedDate} />
      ) : null}
      {Platform.OS === 'ios' ? (
        <Modal animationType="slide" onRequestClose={() => setIsOpen(false)} transparent visible={isOpen}>
          <View style={[styles.overlay, { backgroundColor: tokens.overlay }]}>
            <View style={[styles.sheet, { backgroundColor: tokens.surface, borderRadius: tokens.radius.xl }]}>
              <Text variant="title">{label}</Text>
              <DateTimePicker display="spinner" mode="date" onChange={handleChange} value={selectedDate} />
              <Button label="Concluído" onPress={() => setIsOpen(false)} />
            </View>
          </View>
        </Modal>
      ) : null}
      {allowClear && value ? <Button label="Remover data" onPress={() => onChange('')} variant="ghost" /> : null}
    </View>
  );
}

function toDate(value: string): Date {
  const parsed = parseCivilDate(value);
  if (!parsed.ok) return new Date();
  const [year, month, day] = parsed.value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toCivilDate(value: Date): string {
  const year = String(value.getFullYear()).padStart(4, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { gap: 16, padding: 24 },
  trigger: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 16 },
});
