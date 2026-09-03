import { useLocalSearchParams, useRouter } from 'expo-router';

import { CategoryEditorScreen } from '@/features/categories/CategoryEditorScreen';

export default function EditCategoryRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CategoryEditorScreen categoryId={Number(id)} onDone={() => router.back()} />;
}
