import { useRouter } from 'expo-router';

import { CustomThemeEditorScreen } from '@/features/appearance/CustomThemeEditorScreen';

export default function ThemeEditorRoute() {
  const router = useRouter();
  return <CustomThemeEditorScreen onBack={() => router.back()} />;
}
