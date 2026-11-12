import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { maskInt, maskMoney } from '@/lib/format';

export const colors = {
  bg: '#f4f5f7',
  card: '#ffffff',
  text: '#1c2230',
  muted: '#6b7385',
  border: '#dde1e8',
  primary: '#1f6feb',
  danger: '#d64545',
  warning: '#e09b1a',
  success: '#2e9e5b',
};

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  if (!scroll) return <View style={[styles.screen, styles.screenPad]}>{children}</View>;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenPad}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

type Variant = 'primary' | 'outline' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const isOutline = variant === 'outline';
  const bg = isOutline ? 'transparent' : variant === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        isOutline && { borderWidth: 1, borderColor: colors.primary },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.primary : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, isOutline && { color: colors.primary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  containerStyle,
  ...props
}: TextInputProps & { label: string; containerStyle?: ViewStyle }) {
  return (
    <View style={[{ marginBottom: 12 }, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} />
    </View>
  );
}

/**
 * Campo numérico com máscara brasileira enquanto digita:
 * kind="int" -> 45.000 ; kind="money" -> 1.234,56 (com "R$" no rótulo).
 */
export function NumberField({
  kind,
  onChangeText,
  ...props
}: Omit<TextInputProps, 'keyboardType'> & {
  label: string;
  kind: 'int' | 'money';
  containerStyle?: ViewStyle;
  onChangeText: (text: string) => void;
}) {
  return (
    <Field
      {...props}
      keyboardType="number-pad"
      onChangeText={(t) => onChangeText(kind === 'money' ? maskMoney(t) : maskInt(t))}
    />
  );
}

/** Botões lado a lado para escolher uma opção (ex.: Preventiva | Corretiva). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', backgroundColor: '#e7eaf0', borderRadius: 10, padding: 3, marginBottom: 12 },
        style,
      ]}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 8,
              alignItems: 'center',
              backgroundColor: on ? colors.card : 'transparent',
              elevation: on ? 1 : 0,
            }}
          >
            <Text style={{ fontWeight: on ? '700' : '500', color: on ? colors.primary : colors.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Campo que parece um input mas abre um seletor ao tocar. */
export function SelectField({
  label,
  value,
  placeholder,
  onPress,
  disabled,
}: {
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12, opacity: disabled ? 0.5 : 1 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onPress} disabled={disabled} style={styles.input}>
        <Text style={{ color: value ? colors.text : colors.muted, fontSize: 16 }}>
          {value || placeholder}
        </Text>
      </Pressable>
    </View>
  );
}

export function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenPad: { padding: 16, paddingBottom: 48 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  muted: { color: colors.muted, fontSize: 14 },
  label: { fontSize: 13, color: colors.muted, marginBottom: 4, fontWeight: '600' },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    minHeight: 44,
    justifyContent: 'center',
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
});
