import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text as NativeText,
  View,
  type ColorValue,
} from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type TabIconProps = {
  color: ColorValue;
  focused: boolean;
  symbol: string;
};

const TAB_TRANSITION_DURATION = 240;

export default function MainTabsLayout() {
  const reduceMotion = useReduceMotion();
  const motionEnabled = reduceMotion === false;

  return (
    <Tabs
      tabBar={(props) => <SlidingTabBar {...props} motionEnabled={motionEnabled} />}
      screenOptions={{
        animation: motionEnabled ? 'shift' : 'none',
        headerShown: false,
        tabBarHideOnKeyboard: true,
        transitionSpec: motionEnabled
          ? {
            animation: 'timing',
            config: {
              duration: TAB_TRANSITION_DURATION,
              easing: Easing.out(Easing.cubic),
            },
          }
          : undefined,
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

function SlidingTabBar({ descriptors, insets, motionEnabled, navigation, state }: BottomTabBarProps & {
  motionEnabled: boolean;
}) {
  const { tokens } = useTheme();
  const [indicatorIndex] = useState(() => new Animated.Value(state.index));
  const [tabListWidth, setTabListWidth] = useState(0);
  const bottomInset = Math.max(insets.bottom, tokens.spacing.sm);
  const tabWidth = tabListWidth / state.routes.length;
  const indicatorWidth = Math.max(tabWidth - 4, 0);
  const inputRange = state.routes.map((_, index) => index);
  const outputRange = state.routes.map((_, index) => index * tabWidth + 2);

  useEffect(() => {
    if (!motionEnabled) {
      indicatorIndex.setValue(state.index);
      return;
    }

    const animation = Animated.timing(indicatorIndex, {
      duration: TAB_TRANSITION_DURATION,
      easing: Easing.out(Easing.cubic),
      toValue: state.index,
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [indicatorIndex, motionEnabled, state.index]);

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: tokens.surface,
          borderTopColor: tokens.border,
          height: 60 + bottomInset,
          paddingBottom: bottomInset,
          paddingHorizontal: tokens.spacing.xs,
          paddingTop: tokens.spacing.xs,
        },
      ]}
    >
      <View
        accessibilityRole="tablist"
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          setTabListWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
        }}
        style={styles.tabList}
      >
        {tabListWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeIndicator,
              {
                backgroundColor: tokens.primaryContainer,
                borderRadius: tokens.radius.md,
                width: indicatorWidth,
                transform: [{
                  translateX: indicatorIndex.interpolate({ inputRange, outputRange }),
                }],
              },
            ]}
          />
        ) : null}
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key].options;
          const color = focused ? tokens.onPrimaryContainer : tokens.textMuted;
          const label = typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title ?? route.name;

          function onPress() {
            const event = navigation.emit({
              canPreventDefault: true,
              target: route.key,
              type: 'tabPress',
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          }

          return (
            <Pressable
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              key={route.key}
              onLongPress={() => navigation.emit({ target: route.key, type: 'tabLongPress' })}
              onPress={onPress}
              style={({ pressed }) => [styles.tabButton, { opacity: pressed ? 0.74 : 1 }]}
              testID={options.tabBarButtonTestID}
            >
              {options.tabBarIcon?.({ color, focused, size: 20 })}
              <NativeText
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                numberOfLines={1}
                style={[styles.label, { color }]}
              >
                {label}
              </NativeText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function useReduceMotion(): boolean | null {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
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
  activeIndicator: {
    bottom: 0,
    position: 'absolute',
    top: 0,
  },
  icon: {
    fontSize: 20,
    lineHeight: 22,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 8,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    gap: 1,
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  tabList: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
});
