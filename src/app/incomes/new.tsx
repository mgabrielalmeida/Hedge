import { useRouter } from 'expo-router';

import { ExpenseScreen } from '@/features/transactions/ExpenseScreen';

export default function NewIncomeRoute() {
  const router = useRouter();
  const close = () => router.canGoBack() ? router.back() : router.replace('/' as never);
  return <ExpenseScreen kind="income" onDone={close} />;
}
