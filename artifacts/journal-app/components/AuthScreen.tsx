import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isConfigured, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const submit = async () => {
    setError('');
    setMessage('');
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signUp' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signUp') {
        const result = await signUp(normalizedEmail, password);
        if (result.needsEmailConfirmation) {
          setMessage('Account created. Check your email to confirm, then sign in.');
          setMode('signIn');
          setPassword('');
          setConfirmPassword('');
        }
      } else {
        await signIn(normalizedEmail, password);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Authentication failed.';
      setError(
        raw.includes('Invalid login credentials')
          ? 'Email or password is incorrect.'
          : raw.includes('User already registered')
          ? 'An account with this email already exists. Try signing in.'
          : raw,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConfigured) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="cloud-offline-outline" size={44} color={colors.primary} />
        <Text style={[styles.title, { color: colors.foreground }]}>Cloud setup needed</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Supabase is not configured for this build yet.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 30,
          paddingBottom: bottomPad + 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="book-outline" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.appName, { color: colors.foreground }]}>Pages</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Your private journal, wherever you are.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            {mode === 'signUp' ? 'Create your account' : 'Welcome back'}
          </Text>
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            {mode === 'signUp'
              ? 'Use an email and password to keep your journal backed up and private.'
              : 'Sign in to access your journal and vault.'}
          </Text>

          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            autoComplete="email"
          />
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          />
          {mode === 'signUp' && (
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
            />
          )}

          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
          {message ? <Text style={[styles.message, { color: colors.accent }]}>{message}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.submit,
              { backgroundColor: pressed ? colors.accent : colors.primary },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {mode === 'signUp' ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              setMode(current => (current === 'signUp' ? 'signIn' : 'signUp'));
              setError('');
              setMessage('');
            }}
            style={styles.switchButton}
          >
            <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
              {mode === 'signUp' ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
                {mode === 'signUp' ? 'Sign in' : 'Create one'}
              </Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  header: { alignItems: 'center', paddingHorizontal: 28, marginBottom: 30, gap: 8 },
  iconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  appName: { fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  card: { marginHorizontal: 20, padding: 20, borderRadius: 20, borderWidth: 1 },
  heading: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  helper: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginBottom: 20 },
  input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, fontFamily: 'Inter_400Regular', marginBottom: 12 },
  error: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium', marginBottom: 10 },
  message: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium', marginBottom: 10 },
  submit: { height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  submitText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  switchButton: { alignItems: 'center', paddingTop: 20, paddingBottom: 4 },
  switchText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  body: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});