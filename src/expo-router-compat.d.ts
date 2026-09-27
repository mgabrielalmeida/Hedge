// TypeScript 6 does not associate these SDK 57 public entry points with the
// declaration files bundled by expo-router. Keep the bridge typed and local;
// no runtime module is replaced.
declare module 'expo-router' {
  export * from 'expo-router/build/index';
}

declare module 'expo-router/tabs' {
  export * from 'expo-router/build/layouts/Tabs';
  export { default } from 'expo-router/build/layouts/Tabs';
}

declare module 'expo-router/js-stack' {
  export * from 'expo-router/build/layouts/JSStack';
  export { default } from 'expo-router/build/layouts/JSStack';
}
