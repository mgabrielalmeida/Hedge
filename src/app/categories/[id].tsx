import { useLocalSearchParams, useRouter } from 'expo-router';

import { CategoryEditorScreen } from '@/features/categories/CategoryEditorScreen';

export default function EditCategoryRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const close = () => router.canGoBack() ? router.back() : router.replace('/' as never);
  return <CategoryEditorScreen categoryId={Number(id)} onDone={close} />;
}
