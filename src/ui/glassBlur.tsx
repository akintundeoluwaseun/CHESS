import React from 'react';
import { StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

/** Real backdrop blur (iOS / web). */
export function GlassBlur({ intensity, dark }: { intensity: number; dark: boolean }) {
  return <BlurView intensity={intensity} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />;
}
