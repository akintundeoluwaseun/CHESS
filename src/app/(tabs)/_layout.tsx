import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, usePalette } from '@/ui/theme';
import { Glass } from '@/ui/glass';
import { Txt } from '@/ui/kit';
import { haptic } from '@/audio/sound';

const TABS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }> = {
  index: { label: 'Home', icon: 'home-outline', active: 'home' },
  play: { label: 'Play', icon: 'game-controller-outline', active: 'game-controller' },
  learn: { label: 'Learn', icon: 'school-outline', active: 'school' },
  profile: { label: 'Profile', icon: 'person-outline', active: 'person' },
};

/** Floating tab bar with a sliding highlight. */
function TabBar({ state, navigation }: any) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const count = state.routes.length;
  const tabW = w / Math.max(1, count);
  const x = useSharedValue(0);
  useEffect(() => { if (tabW) x.value = withSpring(state.index * tabW, { damping: 18, stiffness: 190 }); }, [state.index, tabW]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 10) + 2 }}>
      <Glass radius={20} intensity={50} style={{ height: 66, padding: 6, flexDirection: 'row', backgroundColor: p.mode === 'dark' ? 'rgba(18,26,35,0.72)' : 'rgba(255,255,255,0.7)' }}>
       <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flex: 1, flexDirection: 'row' }}>
        {tabW > 0 && (
          <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width: tabW, height: 54, borderRadius: 14, backgroundColor: p.accentSoft,
            borderWidth: 1, borderColor: p.mode === 'dark' ? 'rgba(60,203,156,0.35)' : 'rgba(14,159,117,0.3)' }, pill]} />
        )}
        {state.routes.map((route: any, i: number) => {
          const t = TABS[route.name];
          if (!t) return null;
          const focused = state.index === i;
          return (
            <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={t.label}
              onPress={() => { haptic('light'); if (!focused) navigation.navigate(route.name); }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Ionicons name={focused ? t.active : t.icon} size={21} color={focused ? p.accent : p.textMuted} />
              <Txt variant="caption" color={focused ? p.text : p.textMuted} style={{ fontSize: 10.5, fontFamily: focused ? fonts.semibold : fonts.medium }}>{t.label}</Txt>
            </Pressable>
          );
        })}
       </View>
      </Glass>
    </View>
  );
}

export default function TabsLayout() {
  const p = usePalette();
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: p.bg }, animation: 'fade' } as any}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="play" />
      <Tabs.Screen name="learn" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
