import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { JournalProvider } from '@/context/JournalContext';
import { VaultProvider, useVault } from '@/context/VaultContext';
import LockScreen from '@/components/LockScreen';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function VaultGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, pinLoaded } = useVault();

  // Show a plain spinner while we read the PIN from SecureStore.
  // This prevents the lock screen flashing into "setup" mode for users
  // who already have a PIN set.
  if (!pinLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LockScreen />;
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <VaultGate>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="entry/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="entry/new"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen name="vault/photo" options={{ headerShown: false }} />
      </Stack>
    </VaultGate>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <VaultProvider>
                <JournalProvider>
                  <RootLayoutNav />
                </JournalProvider>
              </VaultProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
