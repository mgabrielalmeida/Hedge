import { useLocalSearchParams, useRouter } from 'expo-router';

import { ExpenseScreen } from '@/features/transactions/ExpenseScreen';

export default function EditTransactionRoute() {
  const router = useRouter(); const { id } = useLocalSearchParams<{ id: string }>();
  const close = () => router.canGoBack() ? router.back() : router.replace('/');
  return <ExpenseScreen onDone={close} transactionId={Number(id)} />;
}
