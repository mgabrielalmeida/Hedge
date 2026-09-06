import { useRouter } from 'expo-router';

import { DashboardScreen } from '@/features/transactions/DashboardScreen';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <DashboardScreen
      onCategoryPress={(categoryId, selectedMonth) => router.push({
        pathname: '/category-spending',
        params: { categoryId, month: selectedMonth },
      } as never)}
      onNewExpense={() => router.push('/expenses/new' as never)}
      onNewIncome={() => router.push('/incomes/new' as never)}
      onNewTransfer={() => router.push('/transfers/new' as never)}
      onNoAccounts={() => router.replace('/onboarding')}
    />
  );
}
