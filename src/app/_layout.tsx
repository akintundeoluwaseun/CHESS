import React, { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import Animated, { FadeOut } from 'react-native-reanimated';
import { EngineHost } from '@/engine/EngineHost';
import { useSettings } from '@/data/settings';
import { useProgress } from '@/data/progressStore';
import { useGames } from '@/data/gamesStore';
import { useActiveGame } from '@/data/activeGame';
import { usePalette } from '@/ui/theme';
import { Celebrations } from '@/ui/widgets';
import { Txt } from '@/ui/kit';
import { initAudio, preloadSounds, setMusic } from '@/audio/sound';
import { LESSON_COUNT_REF } from '@/progression/catalog';
import { LESSONS } from '@/content/lessons';
import { PieceSvg } from '@/render2d/PieceSvg';

SplashScreen.preventAutoHideAsync().catch(() => {});
LESSON_COUNT_REF.value = LESSONS.length;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Sora_600SemiBold, Sora_700Bold });
  const h1 = useSettings((s) => s.hydrated);
  const h2 = useProgress((s) => s.hydrated);
  const h3 = useGames((s) => s.hydrated);
  const h4 = useActiveGame((s) => s.hydrated);
  const hydrated = h1 && h2 && h3 && h4;
  const music = useSettings((s) => s.music);
  const p = usePalette();
  const ready = fontsLoaded && hydrated;
  const [intro, setIntro] = useState(true);

  useEffect(() => { SystemUI.setBackgroundColorAsync(p.bg).catch(() => {}); }, [p.bg]);
  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    initAudio().then(preloadSounds);
    const t = setTimeout(() => setIntro(false), 900);
    return () => clearTimeout(t);
  }, [ready]);

  // Background music follows the setting and pauses when the app is backgrounded.
  useEffect(() => {
    if (!ready) return;
    setMusic(music);
    const sub = AppState.addEventListener('change', (st) => {
      setMusic(st === 'active' && useSettings.getState().music);
      if (st === 'active') useProgress.getState().refreshMissions();
    });
    return () => sub.remove();
  }, [ready, music]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: p.bg }}>
      <SafeAreaProvider>
        <StatusBar style={p.mode === 'dark' ? 'light' : 'dark'} />
        <EngineHost />
        {ready && (
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg }, animation: 'fade_from_bottom' }}>
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="game" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
          </Stack>
        )}
        {ready && <Celebrations />}
        {ready && intro && (
          <Animated.View exiting={FadeOut.duration(450)} pointerEvents="none"
            style={{ position: 'absolute', inset: 0, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', gap: 14 } as any}>
            <PieceSvg type="n" color="w" setId="regal" size={84} />
            <Txt variant="hero" style={{ letterSpacing: 6 }}>ONYX</Txt>
            <Txt variant="label" muted style={{ letterSpacing: 4 }}>Chess</Txt>
          </Animated.View>
        )}
        {!ready && <View style={{ flex: 1, backgroundColor: p.bg }} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
