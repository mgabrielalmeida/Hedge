import { useRouter } from 'expo-router';

import { ExpenseScreen } from '@/features/transactions/ExpenseScreen';

export default function NewExpenseRoute() {
  const router = useRouter();
  const close = () => router.canGoBack() ? router.back() : router.replace('/' as never);
  return <ExpenseScreen onDone={close} />;
}
