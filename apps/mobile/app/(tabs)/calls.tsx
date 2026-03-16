import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Call } from '@voiceagent/shared';

export default function CallsScreen() {
  const [calls, setCalls] = useState<Call[]>([]);

  useEffect(() => {
    loadCalls();

    const subscription = supabase
      .channel('calls')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls' }, (payload) => {
        setCalls((prev) => [payload.new as Call, ...prev]);
      })
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, []);

  async function loadCalls() {
    const { data } = await supabase
      .from('calls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setCalls(data);
  }

  return (
    <FlatList
      style={styles.container}
      data={calls}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<Text style={styles.empty}>No calls yet</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.name}>{item.caller_name || item.caller_phone || 'Unknown'}</Text>
            <Text style={[styles.badge, item.status === 'completed' ? styles.badgeGreen : styles.badgeGray]}>
              {item.status}
            </Text>
          </View>
          {item.summary && <Text style={styles.summary} numberOfLines={2}>{item.summary}</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600' },
  summary: { fontSize: 14, color: '#666', marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, fontSize: 12, overflow: 'hidden' },
  badgeGreen: { backgroundColor: '#d4edda', color: '#155724' },
  badgeGray: { backgroundColor: '#e2e3e5', color: '#383d41' },
  empty: { textAlign: 'center', color: '#666', marginTop: 32 },
});
