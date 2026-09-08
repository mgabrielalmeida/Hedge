import { useRouter } from 'expo-router';

import { ThemeSelection } from '@/features/accounts/ThemeSelection';

export default function AppearanceRoute() {
  const router = useRouter();

  return (
    <ThemeSelection
      actionLabel="Voltar ao início"
      onEditCustom={() => router.push('/theme-editor' as never)}
      onFinish={() => router.replace('/' as never)}
      showDescription={false}
      title="Aparência"
    />
  );
}
