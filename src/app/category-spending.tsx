import { useLocalSearchParams, useRouter } from 'expo-router';

import { CategorySpendingScreen } from '@/features/transactions/CategorySpendingScreen';

export default function CategorySpendingRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ categoryId?: string | string[]; month?: string | string[] }>();
  const categoryIdValue = firstValue(params.categoryId);
  const monthValue = firstValue(params.month);
  const parsedCategoryId = Number(categoryIdValue);
  const categoryId = Number.isSafeInteger(parsedCategoryId) && parsedCategoryId > 0
    ? parsedCategoryId
    : undefined;
  const selectedMonth = monthValue && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthValue)
    ? monthValue
    : undefined;

  return (
    <CategorySpendingScreen
      categoryId={categoryId}
      onBack={() => router.back()}
      onEditExpense={(id) => router.push(`/transactions/${id}` as never)}
      selectedMonth={selectedMonth}
    />
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
