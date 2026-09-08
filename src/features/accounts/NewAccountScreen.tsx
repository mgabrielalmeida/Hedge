import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  scheduleAfterSecondaryTransition,
  Screen,
  Text,
  useReducedMotion,
} from '@/components';
import type { Account } from '@/domain';

import { AccountForm } from './AccountForm';

type NewAccountScreenProps = {
  onAccountCreated: (account: Account) => void;
  onCancel: () => void;
};

export function NewAccountScreen({ onAccountCreated, onCancel }: NewAccountScreenProps) {
  const reduceMotion = useReducedMotion();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => (
    scheduleAfterSecondaryTransition(() => setIsReady(true), reduceMotion === false)
  ), [reduceMotion]);

  if (!isReady) {
    return <Screen style={styles.centered}><Text tone="muted">Carregando formulário…</Text></Screen>;
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text variant="heading">Nova conta</Text>
        </View>
        <Card elevated>
          <AccountForm onSaved={onAccountCreated} />
          <Button label="Cancelar" onPress={onCancel} style={styles.cancel} variant="ghost" />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cancel: { marginTop: 8 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { gap: 24, paddingVertical: 24 },
});
