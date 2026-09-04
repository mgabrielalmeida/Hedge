import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components';
import type { Account } from '@/domain';

import { AccountForm } from './AccountForm';

type NewAccountScreenProps = {
  onAccountCreated: (account: Account) => void;
  onCancel: () => void;
};

export function NewAccountScreen({ onAccountCreated, onCancel }: NewAccountScreenProps) {

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
          <AccountForm onAccountCreated={onAccountCreated} />
          <Button label="Cancelar" onPress={onCancel} style={styles.cancel} variant="ghost" />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({ cancel: { marginTop: 8 }, content: { gap: 24, paddingVertical: 24 } });
