import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import type { IconName } from '@/lib/icons';
import { CategoryIcon, colors, styles } from './ui';

export interface Option {
  value: string;
  label: string;
  icon?: IconName;
}

/** Lista em tela cheia com busca, usada para marca/modelo/ano FIPE e tipo de manutenção. */
export function SelectModal({
  visible,
  title,
  options,
  loading,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Option[];
  loading?: boolean;
  onSelect: (o: Option) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = strip(query);
    return q ? options.filter((o) => strip(o.label).includes(q)) : options;
  }, [options, query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={[styles.title, { flex: 1, marginBottom: 0 }]}>{title}</Text>
          <Pressable onPress={close} hitSlop={12}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Fechar</Text>
          </Pressable>
        </View>
        <TextInput
          style={[styles.input, { marginBottom: 12 }]}
          placeholder="Buscar..."
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setQuery('');
                  onSelect(item);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: item.icon ? 10 : 14,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  backgroundColor: pressed ? colors.border : 'transparent',
                })}
              >
                {item.icon && <CategoryIcon name={item.icon} size={34} />}
                <Text style={{ fontSize: 16, color: colors.text, flex: 1 }}>{item.label}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.muted}>Nada encontrado.</Text>}
          />
        )}
      </View>
    </Modal>
  );
}

function strip(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
