import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../src/constants/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.dark} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.dark },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="register" />
        <Stack.Screen name="user" options={{ animation: 'fade' }} />
        <Stack.Screen name="driver" options={{ animation: 'fade' }} />
        <Stack.Screen name="admin" options={{ animation: 'fade' }} />
      </Stack>
    </>
  );
}
