import { useRouter } from 'expo-router';

import { AccountsHomeScreen } from '@/features/accounts/AccountsHomeScreen';

export default function AccountsRoute() {
  const router = useRouter();

  return (
    <AccountsHomeScreen
      onCreateAccount={() => router.push('/accounts/new')}
      onNoAccounts={() => router.replace('/onboarding')}
    />
  );
}
