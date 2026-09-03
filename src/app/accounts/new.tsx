import { useRouter } from 'expo-router';

import { NewAccountScreen } from '@/features/accounts/NewAccountScreen';

export default function NewAccountRoute() {
  const router = useRouter();

  return <NewAccountScreen onAccountCreated={() => router.back()} />;
}
