import { useRouter } from 'expo-router';

import { TransactionsHomeScreen } from '@/features/transactions/TransactionsHomeScreen';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <TransactionsHomeScreen
      onNewExpense={() => router.push('/expenses/new' as never)}
      onNoAccounts={() => router.replace('/onboarding')}
    />
  );
}
