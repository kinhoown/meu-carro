import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colorHex, shade, type BodyType } from '@/lib/vehicleLook';

/**
 * Desenho lateral do carro com degradês (efeito 3D), por tipo de carroceria e cor.
 * Coordenadas em viewBox 320x140; rodas em x=80 e x=240.
 */
interface Shape {
  body: string;
  glass: string;
  extraGlass?: { x: number; y: number; w: number; h: number }[];
  pillars: number[];
  pillarTop: number;
  pillarBottom: number;
  head: number;
  tail: number;
  bed?: boolean;
}

const ARCHES = 'L268 106 A28 28 0 0 0 212 106 L108 106 A28 28 0 0 0 52 106 Z';

const SHAPES: Record<BodyType, Shape> = {
  hatch: {
    body: `M28 106 L28 90 Q30 79 46 76 L104 68 Q126 46 152 40 L222 40 Q244 42 262 62 L282 70 Q292 76 292 94 L292 106 ${ARCHES}`,
    glass: 'M112 68 Q130 50 155 46 L220 46 Q238 48 254 66 Z',
    pillars: [186],
    pillarTop: 44,
    pillarBottom: 102,
    head: 80,
    tail: 76,
  },
  sedan: {
    body: `M22 106 L22 91 Q24 80 40 77 L100 70 Q122 48 148 42 L204 42 Q224 44 244 64 L284 68 Q298 71 298 90 L298 106 ${ARCHES}`,
    glass: 'M108 69 Q126 50 150 46 L202 46 Q218 48 234 65 Z',
    pillars: [174],
    pillarTop: 44,
    pillarBottom: 102,
    head: 82,
    tail: 74,
  },
  suv: {
    body: `M24 106 L24 84 Q26 71 42 68 L96 63 Q114 37 138 31 L242 31 Q262 33 280 54 L290 60 Q298 66 298 86 L298 106 ${ARCHES}`,
    glass: 'M104 63 Q120 40 142 36 L240 36 Q256 38 272 58 Z',
    pillars: [170, 222],
    pillarTop: 34,
    pillarBottom: 100,
    head: 74,
    tail: 66,
  },
  pickup: {
    body: `M22 106 L22 86 Q24 74 40 71 L94 66 Q112 42 136 36 L192 36 Q200 38 202 64 L298 64 L298 106 ${ARCHES}`,
    glass: 'M102 66 Q118 44 140 40 L190 40 Q195 42 196 64 Z',
    pillars: [156],
    pillarTop: 38,
    pillarBottom: 100,
    head: 76,
    tail: 70,
    bed: true,
  },
  van: {
    body: `M24 106 L24 84 Q26 66 48 60 Q68 34 98 26 L282 26 Q296 28 296 44 L296 106 ${ARCHES}`,
    glass: 'M58 60 Q74 38 100 32 L134 32 L134 58 Z',
    extraGlass: [
      { x: 144, y: 32, w: 62, h: 26 },
      { x: 214, y: 32, w: 70, h: 26 },
    ],
    pillars: [140],
    pillarTop: 30,
    pillarBottom: 100,
    head: 72,
    tail: 66,
  },
};

export function CarArt({
  body,
  color,
  width = 240,
}: {
  body: BodyType | null | undefined;
  color: string | null | undefined;
  width?: number;
}) {
  const s = SHAPES[body ?? 'hatch'] ?? SHAPES.hatch;
  const base = colorHex(color);
  const line = shade(base, -0.35);

  return (
    <Svg width={width} height={(width * 140) / 320} viewBox="0 0 320 140">
      <Defs>
        <LinearGradient id="paint" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={shade(base, 0.35)} />
          <Stop offset="0.45" stopColor={base} />
          <Stop offset="1" stopColor={shade(base, -0.4)} />
        </LinearGradient>
        <LinearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#5d7fa8" />
          <Stop offset="1" stopColor="#1b2636" />
        </LinearGradient>
        <RadialGradient id="rim" cx="0.4" cy="0.35" r="0.7">
          <Stop offset="0" stopColor="#f5f7fa" />
          <Stop offset="1" stopColor="#7d8794" />
        </RadialGradient>
        <RadialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <Stop offset="1" stopColor="#000" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Ellipse cx={160} cy={129} rx={150} ry={9} fill="url(#shadow)" />

      <Path d={s.body} fill="url(#paint)" stroke={line} strokeWidth={1.2} />
      <Path d={s.glass} fill="url(#glass)" />
      {s.extraGlass?.map((g) => <Rect key={g.x} x={g.x} y={g.y} width={g.w} height={g.h} rx={4} fill="url(#glass)" />)}

      {/* colunas e linhas das portas */}
      {s.pillars.map((x) => (
        <G key={x}>
          <Rect x={x - 3} y={s.pillarTop} width={6} height={34} fill={shade(base, -0.15)} />
          <Path d={`M${x} ${s.pillarTop + 30} L${x} ${s.pillarBottom}`} stroke={line} strokeWidth={1} opacity={0.6} />
        </G>
      ))}
      {s.bed && <Path d="M206 70 L294 70" stroke={line} strokeWidth={1.5} opacity={0.7} />}

      {/* brilho na lateral */}
      <Path d={`M48 ${s.head + 6} L290 ${s.tail + 8}`} stroke="#fff" strokeWidth={2} opacity={0.25} />

      {/* faróis */}
      <Rect x={24} y={s.head} width={18} height={7} rx={3} fill="#ffe08a" stroke={line} strokeWidth={0.6} />
      <Rect x={287} y={s.tail} width={10} height={10} rx={2} fill="#e53935" />

      {[80, 240].map((cx) => (
        <G key={cx}>
          <Circle cx={cx} cy={106} r={22} fill="#1b1d22" />
          <Circle cx={cx} cy={106} r={14} fill="url(#rim)" />
          <Circle cx={cx} cy={106} r={14} fill="none" stroke="#4b525c" strokeWidth={1.2} />
          <Circle cx={cx} cy={106} r={4.5} fill="#3a3f47" />
        </G>
      ))}
    </Svg>
  );
}
