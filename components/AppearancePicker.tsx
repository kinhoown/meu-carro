import { Pressable, Text, View } from 'react-native';
import { CarArt } from './CarArt';
import { colors } from './ui';
import { BODY_TYPES, CAR_COLORS, type BodyType } from '@/lib/vehicleLook';

/** Escolha do tipo de carroceria e da cor, com prévia do desenho. */
export function AppearancePicker({
  body,
  color,
  onChange,
}: {
  body: BodyType;
  color: string;
  onChange: (v: { body: BodyType; color: string }) => void;
}) {
  return (
    <View>
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <CarArt body={body} color={color} width={260} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {BODY_TYPES.map((b) => {
          const on = b.value === body;
          return (
            <Pressable
              key={b.value}
              onPress={() => onChange({ body: b.value, color })}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: on ? colors.primary : colors.border,
                backgroundColor: on ? colors.primary : colors.card,
              }}
            >
              <Text style={{ color: on ? '#fff' : colors.text, fontWeight: '600' }}>{b.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {CAR_COLORS.map((c) => {
          const on = c.value === color;
          return (
            <Pressable
              key={c.value}
              accessibilityLabel={c.label}
              onPress={() => onChange({ body, color: c.value })}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: c.hex,
                borderWidth: on ? 3 : 1,
                borderColor: on ? colors.primary : colors.border,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
