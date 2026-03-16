import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function DashboardScreen() {
  const [stats, setStats] = useState({ totalCalls: 0, appointments: 0, missedCalls: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('call_analytics')
      .select('*')
      .eq('date', today)
      .single();

    if (data) {
      setStats({
        totalCalls: data.total_calls,
        appointments: data.appointments_booked,
        missedCalls: data.missed_calls,
      });
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.greeting}>Today's Overview</Text>
      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{stats.totalCalls}</Text>
          <Text style={styles.cardLabel}>Total Calls</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{stats.appointments}</Text>
          <Text style={styles.cardLabel}>Appointments</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardValue}>{stats.missedCalls}</Text>
          <Text style={styles.cardLabel}>Missed</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  greeting: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  grid: { flexDirection: 'row', gap: 12 },
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center' },
  cardValue: { fontSize: 28, fontWeight: 'bold' },
  cardLabel: { fontSize: 12, color: '#666', marginTop: 4 },
});
