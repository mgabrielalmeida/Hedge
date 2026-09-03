import { useRouter } from 'expo-router';

import { NewAccountScreen } from '@/features/accounts/NewAccountScreen';

export default function NewAccountRoute() {
  const router = useRouter();
  const close = () => router.canGoBack() ? router.back() : router.replace('/');

  return <NewAccountScreen onAccountCreated={close} onCancel={close} />;
}
