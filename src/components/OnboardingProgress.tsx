import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type OnboardingProgressProps = {
  currentStep: number;
  totalSteps: number;
};

export function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  const { tokens } = useTheme();
  const completedSteps = Math.min(Math.max(currentStep, 0), totalSteps);

  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ max: totalSteps, min: 0, now: completedSteps }}>
      <Text tone="muted" variant="caption">Etapa {completedSteps} de {totalSteps}</Text>
      <View style={[styles.track, { gap: tokens.spacing.xs, marginTop: tokens.spacing.sm }]}>
        {Array.from({ length: totalSteps }, (_, index) => (
          <View
            key={index}
            style={{
              backgroundColor: index < completedSteps ? tokens.primary : tokens.surfaceSubtle,
              borderRadius: tokens.radius.pill,
              flex: 1,
              height: 6,
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ track: { flexDirection: 'row', width: '100%' } });
