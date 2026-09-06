import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

import { AccountForm } from './AccountForm';
import { ThemeSelection } from './ThemeSelection';
import { CategoriesScreen } from '@/features/categories/CategoriesScreen';

type FirstAccessScreenProps = {
  onFinish: () => void;
};

export function FirstAccessScreen({ onFinish }: FirstAccessScreenProps) {
  const { tokens } = useTheme();
  const router = useRouter();
  const [stage, setStage] = useState<'account' | 'theme' | 'categories'>('account');

  if (stage === 'categories') {
    return <CategoriesScreen onCreate={() => router.push('/categories/new' as never)} onEdit={(id) => router.push(`/categories/${id}` as never)} onFinish={onFinish} />;
  }
  if (stage === 'theme') {
    return <ThemeSelection actionLabel="Continuar para categorias" onFinish={() => setStage('categories')} />;
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
            <AccountForm onSaved={() => setStage('theme')} submitLabel="Criar primeira conta" />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { flexGrow: 1, gap: 24, paddingVertical: 24 } });
