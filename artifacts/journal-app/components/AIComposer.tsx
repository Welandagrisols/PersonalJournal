import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useComposeWithGemini,
  type GeminiComposeRequestOperation,
  type GeminiComposeResponse,
} from '@workspace/api-client-react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';

type ComposerOperation = GeminiComposeRequestOperation;

interface AIComposerProps {
  visible: boolean;
  initialText: string;
  initialTitle: string;
  onClose: () => void;
  onApply: (result: {
    body: string;
    title?: string;
    tags?: string[];
  }) => void;
}

const OPERATIONS: Array<{
  key: ComposerOperation;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'polish', label: 'Polish', icon: 'sparkles-outline' },
  { key: 'story', label: 'Continue', icon: 'book-outline' },
  { key: 'metadata', label: 'Title + tags', icon: 'pricetag-outline' },
  { key: 'reflect', label: 'Reflect', icon: 'help-circle-outline' },
];

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'The writing companion is unavailable right now.';
  if (error.message.includes('401')) return 'Please sign in again to use the writing companion.';
  if (error.message.includes('503')) return 'The writing companion is not configured yet.';
  return 'The writing companion could not complete that request.';
}

export default function AIComposer({
  visible,
  initialText,
  initialTitle,
  onClose,
  onApply,
}: AIComposerProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const compose = useComposeWithGemini();
  const [operation, setOperation] = useState<ComposerOperation>('polish');
  const [text, setText] = useState(initialText);
  const [instruction, setInstruction] = useState('');
  const [result, setResult] = useState<GeminiComposeResponse | null>(null);

  useEffect(() => {
    if (visible) {
      setText(initialText);
      setResult(null);
      setInstruction('');
      setOperation('polish');
    }
  }, [visible, initialText]);

  const operationDescription = useMemo(() => {
    switch (operation) {
      case 'story':
        return 'Build from your voice and leave room for you to take over.';
      case 'metadata':
        return 'Find a clear title and a few useful tags.';
      case 'reflect':
        return 'Turn the entry into gentle questions worth sitting with.';
      default:
        return 'Keep your voice, but make the writing clearer and smoother.';
    }
  }, [operation]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || compose.isPending) return;

    try {
      const response = await compose.mutateAsync({
        data: {
          operation,
          text: trimmed,
          title: initialTitle.trim() || undefined,
          instruction: instruction.trim() || undefined,
        },
      });
      setResult(response);
    } catch {
      // The mutation error is rendered below without exposing request contents.
    }
  };

  const applyResult = () => {
    if (!result) return;
    if (operation === 'metadata') {
      onApply({
        body: initialText,
        title: result.title,
        tags: result.tags,
      });
    } else if (operation === 'reflect') {
      const questions = result.questions?.length
        ? `\n\nReflection prompts\n${result.questions.map(question => `• ${question}`).join('\n')}`
        : `\n\n${result.result}`;
      onApply({ body: `${initialText.trim()}${questions}`.trim() });
    } else {
      onApply({ body: result.result, title: result.title });
    }
    onClose();
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <View style={styles.scrim}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                paddingTop: topPad + 8,
                paddingBottom: bottomPad + 8,
              },
            ]}
          >
            <View style={styles.header}>
              <View>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>PAGES / PRIVATE</Text>
                <Text style={[styles.title, { color: colors.foreground }]}>Writing companion</Text>
              </View>
              <Pressable
                accessibilityLabel="Close writing companion"
                onPress={onClose}
                style={styles.iconButton}
              >
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            <KeyboardAwareScrollViewCompat
              contentContainerStyle={styles.content}
              bottomOffset={20}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                {operationDescription}
              </Text>

              <View style={styles.operationRow}>
                {OPERATIONS.map(item => {
                  const active = item.key === operation;
                  return (
                    <Pressable
                      key={item.key}
                      accessibilityRole="button"
                      onPress={() => {
                        setOperation(item.key);
                        setResult(null);
                      }}
                      style={[
                        styles.operationButton,
                        {
                          backgroundColor: active ? colors.primary : colors.card,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={16}
                        color={active ? colors.primaryForeground : colors.primary}
                      />
                      <Text
                        style={[
                          styles.operationText,
                          { color: active ? colors.primaryForeground : colors.foreground },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  multiline
                  value={text}
                  onChangeText={setText}
                  placeholder="Your writing..."
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.input, { color: colors.foreground }]}
                  textAlignVertical="top"
                  maxLength={12000}
                />
                <Text style={[styles.counter, { color: colors.mutedForeground }]}>
                  {text.length.toLocaleString()} / 12,000
                </Text>
              </View>

              <TextInput
                value={instruction}
                onChangeText={setInstruction}
                placeholder="Optional direction, such as “keep it understated”"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.instructionInput,
                  { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
                ]}
                maxLength={1000}
              />

              {compose.error ? (
                <Text style={[styles.error, { color: colors.destructive }]}>
                  {getErrorMessage(compose.error)}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={submit}
                disabled={!text.trim() || compose.isPending}
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor:
                      !text.trim() ? colors.muted : pressed ? colors.accent : colors.primary,
                  },
                ]}
              >
                {compose.isPending ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color={colors.primaryForeground} />
                    <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>
                      {result ? 'Try again' : 'Create suggestion'}
                    </Text>
                  </>
                )}
              </Pressable>

              {result ? (
                <View style={[styles.resultCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <View style={styles.resultHeading}>
                    <Text style={[styles.resultLabel, { color: colors.primary }]}>SUGGESTION</Text>
                    <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
                  </View>
                  {result.title ? (
                    <Text style={[styles.resultTitle, { color: colors.foreground }]}>{result.title}</Text>
                  ) : null}
                  <Text style={[styles.resultText, { color: colors.secondaryForeground }]}>
                    {result.result}
                  </Text>
                  {result.tags?.length ? (
                    <Text style={[styles.tags, { color: colors.mutedForeground }]}>
                      {result.tags.map(tag => `#${tag}`).join('  ')}
                    </Text>
                  ) : null}
                  {result.questions?.length ? (
                    <View style={styles.questions}>
                      {result.questions.map(question => (
                        <Text key={question} style={[styles.question, { color: colors.secondaryForeground }]}>
                          {question}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={applyResult}
                    style={[styles.applyButton, { borderColor: colors.primary }]}
                  >
                    <Text style={[styles.applyButtonText, { color: colors.primary }]}>Use this in my entry</Text>
                  </Pressable>
                </View>
              ) : null}
            </KeyboardAwareScrollViewCompat>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(30, 15, 8, 0.38)' },
  sheet: { maxHeight: '94%', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  eyebrow: { fontSize: 10, letterSpacing: 1.2, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  title: { fontSize: 24, letterSpacing: -0.6, fontFamily: 'Inter_700Bold' },
  iconButton: { padding: 4 },
  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
  helper: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  operationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  operationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  operationText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  inputCard: { minHeight: 150, borderRadius: 16, borderWidth: 1, padding: 14 },
  input: { minHeight: 115, fontSize: 16, lineHeight: 24, fontFamily: 'Inter_400Regular' },
  counter: { textAlign: 'right', fontSize: 11, fontFamily: 'Inter_400Regular' },
  instructionInput: {
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  error: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium' },
  primaryButton: {
    minHeight: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  resultCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  resultHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultLabel: { fontSize: 10, letterSpacing: 1.2, fontFamily: 'Inter_700Bold' },
  resultTitle: { fontSize: 19, lineHeight: 25, fontFamily: 'Inter_700Bold' },
  resultText: { fontSize: 16, lineHeight: 25, fontFamily: 'Inter_400Regular' },
  tags: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  questions: { gap: 7 },
  question: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium' },
  applyButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 10,
    marginTop: 2,
  },
  applyButtonText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});