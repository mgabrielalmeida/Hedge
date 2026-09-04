import { useRouter } from 'expo-router';

import { TransactionsHomeScreen } from '@/features/transactions/TransactionsHomeScreen';

export default function HistoryRoute() {
  const router = useRouter();

  return (
    <TransactionsHomeScreen
      onAppearance={() => router.push('/appearance' as never)}
      onEditTransaction={(id) => router.push(`/transactions/${id}` as never)}
      onManageCategories={() => router.push('/categories' as never)}
      onNewExpense={() => router.push('/expenses/new' as never)}
      onNewIncome={() => router.push('/incomes/new' as never)}
      onNoAccounts={() => router.replace('/onboarding')}
    />
  );
}
