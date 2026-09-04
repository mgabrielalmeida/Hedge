import { useRouter } from 'expo-router';

import { TransferScreen } from '@/features/transactions/TransferScreen';

export default function NewTransferRoute() {
  const router = useRouter();
  const close = () => router.canGoBack() ? router.back() : router.replace('/' as never);
  return <TransferScreen onDone={close} />;
}
