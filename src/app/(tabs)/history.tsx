import { useRouter } from 'expo-router';

import { TransactionsHomeScreen } from '@/features/transactions/TransactionsHomeScreen';

export default function HistoryRoute() {
  const router = useRouter();

  return (
    <TransactionsHomeScreen
      onEditRecurringRule={(id) => router.push(`/recurring/${id}` as never)}
      onEditTransaction={(id) => router.push(`/transactions/${id}` as never)}
      onNoAccounts={() => router.replace('/onboarding')}
    />
  );
}
