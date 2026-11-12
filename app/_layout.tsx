import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ObdProvider } from '@/obd/ObdContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <ObdProvider>
        <StatusBar style="dark" />
        <RootStack />
      </ObdProvider>
    </AuthProvider>
  );
}

function RootStack() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="index" options={{ title: 'Meus veículos' }} />
        <Stack.Screen name="vehicle/new" options={{ title: 'Novo veículo' }} />
        <Stack.Screen name="vehicle/[id]/index" options={{ title: 'Veículo' }} />
        <Stack.Screen name="vehicle/[id]/maintenance" options={{ title: 'Manutenção' }} />
        <Stack.Screen name="vehicle/[id]/obd" options={{ title: 'Diagnóstico OBD' }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Screen name="updates" options={{ title: 'Atualizações' }} />
    </Stack>
  );
}
