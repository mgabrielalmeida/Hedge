import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { Card, OnboardingProgress, ScreenHeader, ScrollableScreen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

import { AccountForm } from './AccountForm';
import { CategoriesScreen } from '@/features/categories/CategoriesScreen';

type FirstAccessScreenProps = {
  onFinish: () => void;
};

export function FirstAccessScreen({ onFinish }: FirstAccessScreenProps) {
  const { tokens } = useTheme();
  const router = useRouter();
  const [stage, setStage] = useState<'account' | 'categories'>('account');

  if (stage === 'categories') {
    return <CategoriesScreen onboardingProgress={{ currentStep: 2, totalSteps: 2 }} onCreate={() => router.push('/categories/new' as never)} onEdit={(id) => router.push(`/categories/${id}` as never)} onFinish={onFinish} />;
  }

  return (
    <ScrollableScreen>
        <ScreenHeader description="Crie sua primeira conta para acompanhar seu dinheiro localmente." title="Vamos começar" />
        <OnboardingProgress currentStep={1} totalSteps={2} />
        <Card elevated>
          <Text variant="title">Sua primeira conta</Text>
          <Text tone="muted" style={{ marginTop: tokens.spacing.xs }}>
            O saldo inicial é registrado como um lançamento e compõe seu saldo atual.
          </Text>
          <Text tone="muted" variant="caption" style={{ marginTop: tokens.spacing.sm }}>
            Você poderá personalizar a aparência depois, quando quiser.
          </Text>
          <View style={{ marginTop: tokens.spacing.lg }}>
            <AccountForm onSaved={() => setStage('categories')} submitLabel="Criar primeira conta" />
          </View>
        </Card>
    </ScrollableScreen>
  );
}
