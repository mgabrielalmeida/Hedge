import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text as NativeText,
  View,
  type ColorValue,
} from 'react-native';

import { IconGlyph, useReducedMotion } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

type TabIconProps = {
  color: ColorValue;
  focused: boolean;
  value: string;
};

const TAB_TRANSITION_DURATION = 240;

export default function MainTabsLayout() {
  const reduceMotion = useReducedMotion();
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
            <TabIcon color={color} focused={focused} value="lucide:house" />
          ),
          title: 'Início',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarAccessibilityLabel: 'Histórico',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} value="lucide:receipt-text" />
          ),
          title: 'Histórico',
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          tabBarAccessibilityLabel: 'Categorias',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} value="lucide:folder" />
          ),
          title: 'Categorias',
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          tabBarAccessibilityLabel: 'Contas',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} value="lucide:landmark" />
          ),
          title: 'Contas',
        }}
      />
      <Tabs.Screen
        name="appearance"
        options={{
          tabBarAccessibilityLabel: 'Aparência',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} value="lucide:settings" />
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

function TabIcon({ color, focused, value }: TabIconProps) {
  return (
    <View
      importantForAccessibility="no"
      style={{ opacity: focused ? 1 : 0.76 }}
    >
      <IconGlyph color={String(color)} size={20} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  activeIndicator: {
    bottom: 0,
    position: 'absolute',
    top: 0,
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
