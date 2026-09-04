import { Tabs } from 'expo-router';
import {
  StyleSheet,
  Text as NativeText,
  type ColorValue,
} from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type TabIconProps = {
  color: ColorValue;
  focused: boolean;
  symbol: string;
};

export default function MainTabsLayout() {
  const { tokens } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveBackgroundColor: tokens.primaryContainer,
        tabBarActiveTintColor: tokens.onPrimaryContainer,
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: tokens.textMuted,
        tabBarItemStyle: {
          borderRadius: tokens.radius.md,
          marginHorizontal: 2,
          marginVertical: tokens.spacing.xs,
        },
        tabBarLabelStyle: styles.label,
        tabBarStyle: {
          backgroundColor: tokens.surface,
          borderTopColor: tokens.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingHorizontal: tokens.spacing.xs,
          paddingTop: tokens.spacing.xs,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarAccessibilityLabel: 'Tela inicial',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} symbol="⌂" />
          ),
          title: 'Início',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarAccessibilityLabel: 'Histórico',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} symbol="≡" />
          ),
          title: 'Histórico',
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          tabBarAccessibilityLabel: 'Categorias',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} symbol="◈" />
          ),
          title: 'Categorias',
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          tabBarAccessibilityLabel: 'Contas',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} symbol="▣" />
          ),
          title: 'Contas',
        }}
      />
      <Tabs.Screen
        name="appearance"
        options={{
          tabBarAccessibilityLabel: 'Aparência',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} symbol="◐" />
          ),
          title: 'Aparência',
        }}
      />
    </Tabs>
  );
}

function TabIcon({ color, focused, symbol }: TabIconProps) {
  return (
    <NativeText
      importantForAccessibility="no"
      style={[styles.icon, { color, opacity: focused ? 1 : 0.76 }]}
    >
      {symbol}
    </NativeText>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 20,
    lineHeight: 22,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});
