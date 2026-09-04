import { useLocalSearchParams, useRouter } from 'expo-router';

import { TransactionEditorScreen } from '@/features/transactions/TransactionEditorScreen';

export default function EditTransactionRoute() {
  const router = useRouter(); const { id } = useLocalSearchParams<{ id: string }>();
  const close = () => router.canGoBack() ? router.back() : router.replace('/' as never);
  return <TransactionEditorScreen onDone={close} transactionId={Number(id)} />;
}
