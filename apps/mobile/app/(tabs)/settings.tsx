import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.item}
        onPress={() => Alert.alert('Coming soon', 'Business settings will be available in a future update.')}
      >
        <Text style={styles.itemText}>Business Settings</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.item}
        onPress={() => Alert.alert('Coming soon', 'Notification settings will be available in a future update.')}
      >
        <Text style={styles.itemText}>Notifications</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.item, styles.danger]} onPress={handleSignOut}>
        <Text style={[styles.itemText, styles.dangerText]}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  item: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8 },
  itemText: { fontSize: 16 },
  danger: { marginTop: 16 },
  dangerText: { color: '#dc3545' },
});
