import { useLocalSearchParams, useRouter } from 'expo-router';

import { AccountEditorScreen } from '@/features/accounts/AccountEditorScreen';

export default function EditAccountRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const close = () => router.canGoBack() ? router.back() : router.replace('/' as never);

  return <AccountEditorScreen accountId={Number(id)} onDone={close} />;
}
