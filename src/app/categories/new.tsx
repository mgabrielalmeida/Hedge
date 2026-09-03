import { useRouter } from 'expo-router';

import { CategoryEditorScreen } from '@/features/categories/CategoryEditorScreen';

export default function NewCategoryRoute() {
  const router = useRouter();
  const close = () => router.canGoBack() ? router.back() : router.replace('/');
  return <CategoryEditorScreen onDone={close} />;
}
