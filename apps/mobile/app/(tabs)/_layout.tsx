import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#000' }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard', headerTitle: 'VoiceAgent' }} />
      <Tabs.Screen name="calls" options={{ title: 'Calls' }} />
      <Tabs.Screen name="appointments" options={{ title: 'Appointments' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
