import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

let lastKnownPreference: boolean | null = null;
let preferenceRequest: Promise<boolean> | null = null;

export function useReducedMotion(): boolean | null {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(lastKnownPreference);

  useEffect(() => {
    let active = true;
    let currentPreference: Promise<boolean>;
    if (lastKnownPreference === null) {
      preferenceRequest ??= AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
        lastKnownPreference = enabled;
        return enabled;
      });
      currentPreference = preferenceRequest;
    } else {
      currentPreference = Promise.resolve(lastKnownPreference);
    }
    void currentPreference.then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      lastKnownPreference = enabled;
      setReduceMotion(enabled);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
