import { useRouter } from 'expo-router';

import { DashboardScreen } from '@/features/transactions/DashboardScreen';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <DashboardScreen
      onAccounts={() => router.push('/accounts' as never)}
      onCategories={() => router.push('/categories' as never)}
      onHistory={() => router.push('/history' as never)}
      onNewExpense={() => router.push('/expenses/new' as never)}
      onNewIncome={() => router.push('/incomes/new' as never)}
      onNoAccounts={() => router.replace('/onboarding')}
    />
  );
}
