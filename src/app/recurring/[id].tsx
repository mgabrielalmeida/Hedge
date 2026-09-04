import { useLocalSearchParams, useRouter } from 'expo-router';

import { RecurringRuleEditorScreen } from '@/features/transactions/RecurringRuleEditorScreen';

export default function EditRecurringRuleRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const close = () => router.canGoBack() ? router.back() : router.replace('/history' as never);
  return <RecurringRuleEditorScreen onDone={close} recurringRuleId={Number(id)} />;
}
