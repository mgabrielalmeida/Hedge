import { useRouter } from 'expo-router';

import { DashboardScreen } from '@/features/transactions/DashboardScreen';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <DashboardScreen
      onNewExpense={() => router.push('/expenses/new' as never)}
      onNewIncome={() => router.push('/incomes/new' as never)}
      onNoAccounts={() => router.replace('/onboarding')}
    />
  );
}
