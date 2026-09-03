import { ScrollView, StyleSheet, View } from 'react-native';

import { Card, Screen, Text } from '@/components';
import type { Account } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

import { AccountForm } from './AccountForm';

type NewAccountScreenProps = {
  onAccountCreated: (account: Account) => void;
};

export function NewAccountScreen({ onAccountCreated }: NewAccountScreenProps) {
  const { tokens } = useTheme();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text variant="heading">Nova conta</Text>
          <Text tone="muted" style={{ marginTop: tokens.spacing.sm }}>
            Adicione uma conta para organizar os próximos lançamentos.
          </Text>
        </View>
        <Card elevated>
          <AccountForm onAccountCreated={onAccountCreated} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { gap: 24, paddingVertical: 24 } });
