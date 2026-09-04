import { useRouter } from 'expo-router';

import { CategoriesScreen } from '@/features/categories/CategoriesScreen';

export default function CategoriesRoute() {
  const router = useRouter();

  return (
    <CategoriesScreen
      onCreate={() => router.push('/categories/new' as never)}
      onEdit={(id) => router.push(`/categories/${id}` as never)}
      showDescription={false}
    />
  );
}
