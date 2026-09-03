import { useRouter } from 'expo-router';

import { CategoryEditorScreen } from '@/features/categories/CategoryEditorScreen';

export default function NewCategoryRoute() {
  const router = useRouter();
  return <CategoryEditorScreen onDone={() => router.back()} />;
}
