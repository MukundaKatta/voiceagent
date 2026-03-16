import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Appointment } from '@voiceagent/shared';

export default function AppointmentsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    loadAppointments();
  }, []);

  async function loadAppointments() {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(50);
    if (data) setAppointments(data);
  }

  return (
    <FlatList
      style={styles.container}
      data={appointments}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<Text style={styles.empty}>No upcoming appointments</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.name}>{item.customer_name}</Text>
          <Text style={styles.detail}>{item.service} {item.provider ? `with ${item.provider}` : ''}</Text>
          <Text style={styles.time}>{new Date(item.start_time).toLocaleString()}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '600' },
  detail: { fontSize: 14, color: '#666', marginTop: 2 },
  time: { fontSize: 14, color: '#333', marginTop: 4 },
  empty: { textAlign: 'center', color: '#666', marginTop: 32 },
});
