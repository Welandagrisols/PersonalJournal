import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useVault } from '@/context/VaultContext';

const PIN_LENGTH = 4;
const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function LockScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { hasPin, setupPin, authenticate, resetPin } = useVault();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // 'setup' → first entry, 'confirm' → repeat PIN, 'enter' → unlock
  const [phase, setPhase] = useState<'setup' | 'confirm' | 'enter'>(
    hasPin ? 'enter' : 'setup',
  );
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, [shakeAnim]);

  const handleKey = useCallback(
    async (key: string) => {
      if (key === '') return;

      if (key === 'del') {
        if (phase === 'confirm') setConfirmPin(p => p.slice(0, -1));
        else setPin(p => p.slice(0, -1));
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (phase === 'confirm') {
        const next = confirmPin + key;
        setConfirmPin(next);
        if (next.length === PIN_LENGTH) {
          if (next === pin) {
            await setupPin(pin);
          } else {
            setError("PINs don't match. Try again.");
            shake();
            setTimeout(() => {
              setError('');
              setPin('');
              setConfirmPin('');
              setPhase('setup');
            }, 900);
          }
        }
        return;
      }

      const next = pin + key;
      setPin(next);

      if (next.length === PIN_LENGTH) {
        if (phase === 'setup') {
          // Move to confirm step
          setTimeout(() => {
            setPhase('confirm');
            setConfirmPin('');
          }, 120);
        } else {
          // Try to unlock
          const ok = await authenticate(next);
          if (!ok) {
            setError('Incorrect PIN');
            shake();
            setTimeout(() => {
              setError('');
              setPin('');
            }, 900);
          }
        }
      }
    },
    [phase, pin, confirmPin, setupPin, authenticate, shake],
  );

  const handleReset = () => {
    Alert.alert(
      'Reset PIN',
      'This will delete your PIN and ALL vault photos. Your journal entries will remain. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetPin();
            setPhase('setup');
            setPin('');
            setConfirmPin('');
            setError('');
          },
        },
      ],
    );
  };

  const activeInput = phase === 'confirm' ? confirmPin : pin;

  const subtitle =
    phase === 'setup'
      ? 'Create a 4-digit PIN to protect your vault'
      : phase === 'confirm'
      ? 'Confirm your PIN'
      : 'Enter your PIN to unlock';

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: topPad + 16,
          paddingBottom: bottomPad + 16,
        },
      ]}
    >
      {/* Logo */}
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="lock-closed" size={36} color={colors.primary} />
        </View>
        <Text style={[styles.appName, { color: colors.foreground }]}>Pages</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      </View>

      {/* PIN dots */}
      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = i < activeInput.length;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: filled
                    ? error
                      ? colors.destructive
                      : colors.primary
                    : 'transparent',
                  borderColor: error
                    ? colors.destructive
                    : filled
                    ? colors.primary
                    : colors.border,
                },
              ]}
            />
          );
        })}
      </Animated.View>

      {/* Error */}
      <View style={styles.errorWrap}>
        {error ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        ) : null}
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {KEYPAD.map((key, i) => {
          const isEmpty = key === '';
          const isDel = key === 'del';
          return (
            <Pressable
              key={i}
              onPress={() => handleKey(key)}
              disabled={isEmpty}
              style={({ pressed }) => [
                styles.keyBtn,
                !isEmpty && !isDel && {
                  backgroundColor: pressed ? colors.muted : colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
                isDel && styles.keyDel,
                isEmpty && styles.keyEmpty,
              ]}
            >
              {isDel ? (
                <Ionicons name="backspace-outline" size={24} color={colors.foreground} />
              ) : !isEmpty ? (
                <Text style={[styles.keyText, { color: colors.foreground }]}>{key}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Reset PIN */}
      {hasPin && (
        <Pressable onPress={handleReset} style={styles.resetBtn}>
          <Text style={[styles.resetText, { color: colors.mutedForeground }]}>
            Forgot PIN? Reset vault
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  top: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 20,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  appName: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 20,
    marginVertical: 8,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  errorWrap: {
    height: 24,
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    gap: 12,
    justifyContent: 'center',
  },
  keyBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyDel: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: {
    width: 80,
    height: 80,
  },
  keyText: {
    fontSize: 26,
    fontFamily: 'Inter_400Regular',
  },
  resetBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  resetText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textDecorationLine: 'underline',
  },
});
