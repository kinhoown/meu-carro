import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { applyTheme, DARK, LIGHT } from '@/components/ui';

export type ThemeMode = 'sistema' | 'claro' | 'escuro';
export type Scheme = 'light' | 'dark';

const KEY = 'meucarro.theme';

interface ThemeState {
  mode: ThemeMode;
  scheme: Scheme;
  ready: boolean;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeState>({
  mode: 'sistema',
  scheme: 'light',
  ready: false,
  setMode: () => {},
});

/**
 * Guarda a escolha de tema no celular e aplica as cores antes de renderizar as telas.
 * Quando o tema muda, o app remonta as telas (key no Stack) para todas lerem as cores novas.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('sistema');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'claro' || v === 'escuro' || v === 'sistema') setModeState(v);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const scheme: Scheme = mode === 'sistema' ? (system === 'dark' ? 'dark' : 'light') : mode === 'escuro' ? 'dark' : 'light';

  // Aplica já durante a renderização: os filhos desta passada leem as cores novas.
  useMemo(() => applyTheme(scheme === 'dark' ? DARK : LIGHT), [scheme]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(scheme === 'dark' ? DARK.bg : LIGHT.bg).catch(() => {});
  }, [scheme]);

  const value = useMemo(
    () => ({
      mode,
      scheme,
      ready,
      setMode: (m: ThemeMode) => {
        setModeState(m);
        AsyncStorage.setItem(KEY, m).catch(() => {});
      },
    }),
    [mode, scheme, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
