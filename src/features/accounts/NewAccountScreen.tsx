import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import {
  Button,
  Card,
  scheduleAfterSecondaryTransition,
  ScreenHeader,
  ScreenState,
  ScrollableScreen,
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
    return <ScreenState message="Preparando o formulário da conta…" status="loading" title="Carregando formulário" />;
  }

  return (
    <ScrollableScreen>
        <ScreenHeader onBack={onCancel} title="Nova conta" />
        <Card elevated>
          <AccountForm onSaved={onAccountCreated} />
          <Button label="Cancelar" onPress={onCancel} style={styles.cancel} variant="ghost" />
        </Card>
    </ScrollableScreen>
  );
}

const styles = StyleSheet.create({
  cancel: { marginTop: 8 },
});
