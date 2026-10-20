import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { UpdatedAgo } from '../components/UpdatedAgo';
import { MATCHES_URL, USE_MOCK_MATCHES } from '../config'; // MATCHES_URL: 404 NOT FOUND
import matchesMock from '../../data/matches.json';


type MatchStatus = 'scheduled' | 'live' | 'postponed' | 'finished';

interface Team {
  id: string;
  name: string;
  city: string;
}

interface Match {
  id: string;
  startsAt: string | null;
  status: MatchStatus;
  minute?: number;
  home: Team;
  away: Team;
  score: { home: number; away: number } | null;
}

type Filter = 'all' | 'live' | 'upcoming' | 'finished';

export function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const reqIdRef = useRef(0);

  const loadMatches = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    try {
      let data: { matches?: Match[] } | null = null;

      if (USE_MOCK_MATCHES) {
        // имитируем сетевую задержку, чтобы увидеть лоадер
        await new Promise((r) => setTimeout(r, 300));
        data = matchesMock as { matches?: Match[] };
      } else {
        const res = await fetch(MATCHES_URL, { headers: { Accept: 'application/json' } });
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}\n${previewBody(text)}`);
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Невалидный JSON.\nURL: ${MATCHES_URL}\n${previewBody(text)}`);
        }
      }

      if (!data || !Array.isArray(data.matches)) {
        throw new Error('В ответе нет массива "matches"');
      }

      if (reqId !== reqIdRef.current) return;
      setMatches(data.matches as Match[]);
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadMatches();
    } finally {
      setRefreshing(false);
    }
  }, [loadMatches]);

  const visible = useMemo(() => {
    const byFilter = matches.filter((m) => {
      if (filter === 'all') return true;
      if (filter === 'upcoming')
        return m.status === 'scheduled' || m.status === 'postponed';
      if (filter === 'live') return m.status === 'live';
      return m.status === 'finished';
    });
    return [...byFilter].sort(compareMatches);
  }, [matches, filter]);

  const liveCount = useMemo(
    () => matches.filter((m) => m.status === 'live').length,
    [matches]
  );

  if (loading && matches.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.muted}>Загрузка матчей…</Text>
      </View>
    );
  }

  if (error && matches.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Не удалось загрузить матчи</Text>
        <Text style={styles.errorText} selectable>
          {error}
        </Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={refresh}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>Повторить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.chipsRow}>
          <Chip
            label="Все"
            active={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <Chip
            label="Идущие"
            active={filter === 'live'}
            onPress={() => setFilter('live')}
            count={liveCount}
          />
          <Chip
            label="Предстоящие"
            active={filter === 'upcoming'}
            onPress={() => setFilter('upcoming')}
          />
          <Chip
            label="Завершённые"
            active={filter === 'finished'}
            onPress={() => setFilter('finished')}
          />
        </View>

        <View style={styles.headerBottomRow}>
          {lastUpdated ? (
            <UpdatedAgo since={lastUpdated} />
          ) : (
            <View />
          )}
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={refresh}
            accessibilityRole="button"
          >
            <Text style={styles.refreshBtnText}>Обновить</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <Text style={styles.errorInline} numberOfLines={4}>
            Не удалось обновить: {error}
          </Text>
        ) : null}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MatchCard match={item} />}
        contentContainerStyle={
          visible.length === 0 ? styles.listEmpty : styles.list
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.muted}>Матчей нет</Text>
          </View>
        }
      />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  count,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
        {count ? <Text style={styles.chipCount}> • {count}</Text> : null}
      </Text>
    </TouchableOpacity>
  );
}

function MatchCard({ match }: { match: Match }) {
  const s = statusInfo(match);
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.teams} numberOfLines={2}>
          {match.home.name} — {match.away.name}
        </Text>
        <View
          style={[
            styles.badge,
            s.tone === 'live' && styles.badgeLive,
            s.tone === 'done' && styles.badgeDone,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              s.tone === 'live' && styles.badgeTextLive,
              s.tone === 'done' && styles.badgeTextDone,
            ]}
          >
            {s.text}
          </Text>
        </View>
      </View>

      <View style={styles.scoreRow}>
        <Text style={styles.score}>
          {match.score ? `${match.score.home} : ${match.score.away}` : '—'}
        </Text>
        <Text style={styles.cities} numberOfLines={1}>
          {match.home.city} · {match.away.city}
        </Text>
      </View>

      <Text style={styles.cardDate}>{formatDate(match.startsAt)}</Text>
    </View>
  );
}

/* ---------- helpers ---------- */

function statusInfo(match: Match): {
  text: string;
  tone: 'live' | 'done' | 'planned' | 'other';
} {
  switch (match.status) {
    case 'live':
      return {
        text: match.minute != null ? `Идёт · ${match.minute}'` : 'Идёт',
        tone: 'live',
      };
    case 'finished':
      return { text: 'Завершён', tone: 'done' };
    case 'scheduled':
      return { text: 'Запланирован', tone: 'planned' };
    case 'postponed':
      return { text: 'Отложен', tone: 'other' };
    default:
      return { text: String(match.status), tone: 'other' };
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Дата не назначена';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return `Некорректная дата: ${iso}`;
  // toLocaleString без timeZone → часовой пояс устройства
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toTime(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function rank(s: MatchStatus): number {
  switch (s) {
    case 'live':
      return 0;
    case 'scheduled':
      return 1;
    case 'postponed':
      return 2;
    case 'finished':
      return 3;
    default:
      return 4;
  }
}

function compareDates(ta: number, tb: number, desc: boolean): number {
  if (ta === tb) return 0;
  const asc = ta < tb ? -1 : 1;
  return desc ? -asc : asc;
}

function compareMatches(a: Match, b: Match): number {
  const r = rank(a.status) - rank(b.status);
  if (r !== 0) return r;
  const ta = toTime(a.startsAt);
  const tb = toTime(b.startsAt);
  // завершённые — свежие сверху, остальные — по возрастанию
  return compareDates(ta, tb, a.status === 'finished');
}

function previewBody(text: string): string {
  const cleaned = text.replace(/\r/g, '').slice(0, 200);
  return cleaned.length > 0 ? JSON.stringify(cleaned) : '<пустое тело>';
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  muted: { color: '#666', fontSize: 15, textAlign: 'center' },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#eee',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chipActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  chipText: { color: '#444', fontSize: 14 },
  chipCount: { opacity: 0.7 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  headerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  refreshBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  refreshBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  errorInline: { color: '#b00020', fontSize: 13 },
  list: { padding: 16, gap: 12 },
  listEmpty: { flexGrow: 1 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  teams: { flex: 1, fontWeight: '600', fontSize: 16, color: '#111' },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  score: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    fontVariant: ['tabular-nums'],
  },
  cities: { flex: 1, textAlign: 'right', color: '#888', fontSize: 12 },
  cardDate: { color: '#666', fontSize: 13 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
  },
  badgeLive: { backgroundColor: '#fee2e2' },
  badgeDone: { backgroundColor: '#e5e7eb' },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#4338ca' },
  badgeTextLive: { color: '#b91c1c' },
  badgeTextDone: { color: '#374151' },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    textAlign: 'center',
  },
  errorText: { color: '#b00020', fontSize: 13, textAlign: 'center' },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});