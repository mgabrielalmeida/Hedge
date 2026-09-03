import { useRouter } from 'expo-router';

import { AccountsHomeScreen } from '@/features/accounts/AccountsHomeScreen';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <AccountsHomeScreen
      onCreateAccount={() => router.push('/accounts/new')}
      onManageCategories={() => router.push('/categories' as never)}
      onNoAccounts={() => router.replace('/onboarding')}
    />
  );
}
