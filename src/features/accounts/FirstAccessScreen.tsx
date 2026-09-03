import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card, Screen, Text } from '@/components';
import type { Account } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

import { AccountForm } from './AccountForm';
import { ThemeSelection } from './ThemeSelection';

type FirstAccessScreenProps = {
  onFinish: () => void;
};

export function FirstAccessScreen({ onFinish }: FirstAccessScreenProps) {
  const { tokens } = useTheme();
  const [createdAccount, setCreatedAccount] = useState<Account | null>(null);

  if (createdAccount) {
    return <ThemeSelection onFinish={onFinish} />;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View>
          <Text variant="heading">Vamos começar</Text>
          <Text tone="muted" style={{ marginTop: tokens.spacing.sm }}>
            Crie sua primeira conta para acompanhar seu dinheiro localmente.
          </Text>
        </View>
        <Card elevated>
          <Text variant="title">Sua primeira conta</Text>
          <Text tone="muted" style={{ marginTop: tokens.spacing.xs }}>
            O saldo inicial é registrado como um lançamento e compõe seu saldo atual.
          </Text>
          <View style={{ marginTop: tokens.spacing.lg }}>
            <AccountForm onAccountCreated={setCreatedAccount} submitLabel="Criar primeira conta" />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { flexGrow: 1, gap: 24, paddingVertical: 24 } });
