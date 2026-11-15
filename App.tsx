import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useFonts, AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { colors } from './src/theme';
import { Intro } from './src/screens/Intro';
import { Home } from './src/screens/Home';
import { PlanTrip } from './src/screens/PlanTrip';
import { RouteDetail } from './src/screens/RouteDetail';
import { Alerts, affects } from './src/screens/Alerts';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { Simple } from './src/screens/Simple';
import { TabBar, Tab } from './src/components/TabBar';
import { Alert, fetchAlerts, fetchStops, isSample } from './src/data/carris';
import { Itinerary, lineName, planTrip } from './src/data/transit';
import type { Place } from './src/data/places';
import { DEFAULT_SETTINGS, Plan, Settings, Trip, hhmm, pickPlan } from './src/lib/plan';

const KEY = 'saiagora:v3';
type Saved = { trips: Trip[]; notify: Record<string, boolean>; settings: Settings; seenIntro: boolean };
type Open = { it: Itinerary; from: Place; to: Place; tripId?: string } | null;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

async function load(): Promise<Saved> {
  try { const v = await AsyncStorage.getItem(KEY); if (v) return { settings: DEFAULT_SETTINGS, ...JSON.parse(v) }; } catch {}
  return { trips: [], notify: {}, settings: DEFAULT_SETTINGS, seenIntro: false };
}

export default function App() {
  const [fontsLoaded] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
  const [ready, setReady] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [notify, setNotify] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [seenIntro, setSeenIntro] = useState(false);
  const [tab, setTab] = useState<Tab>('inicio');
  const [simple, setSimple] = useState(false);
  const [open, setOpen] = useState<Open>(null);
  const [itsByTrip, setItsByTrip] = useState<Record<string, Itinerary[]>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [now, setNow] = useState(Date.now() / 1000);
  const scheduled = useRef<Record<string, string>>({});

  useEffect(() => {
    load().then((d) => {
      setTrips(d.trips ?? []); setNotify(d.notify ?? {}); setSettings({ ...DEFAULT_SETTINGS, ...d.settings }); setSeenIntro(!!d.seenIntro);
      setSimple(!!d.settings?.simpleDefault && (d.trips ?? []).length > 0); setReady(true);
    });
    fetchStops();
  }, []);
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(KEY, JSON.stringify({ trips, notify, settings, seenIntro } as Saved)).catch(() => {});
  }, [trips, notify, settings, seenIntro, ready]);

  useEffect(() => { const id = setInterval(() => setNow(Date.now() / 1000), 1000); return () => clearInterval(id); }, []);

  // Caminhos das viagens guardadas: recalcula a cada 2 min (o Transitous pede uso leve; há cache de 60 s).
  const refresh = useCallback(async () => {
    const out: Record<string, Itinerary[]> = {}, errs: Record<string, boolean> = {};
    for (const t of trips) {
      try { out[t.id] = await planTrip(t.from, t.to, { from: t.from.label, to: t.to.label }); }
      catch { errs[t.id] = true; }
    }
    setItsByTrip(out); setErrors(errs);
  }, [trips]);
  useEffect(() => { refresh(); const id = setInterval(refresh, 120000); return () => clearInterval(id); }, [refresh]);

  const refreshAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try { await fetchStops(); setAlerts(await fetchAlerts()); } finally { setLoadingAlerts(false); }
  }, []);
  useEffect(() => { refreshAlerts(); const id = setInterval(refreshAlerts, 5 * 60 * 1000); return () => clearInterval(id); }, [refreshAlerts]);

  const plans: Record<string, Plan | null | undefined> = {};
  for (const t of trips) plans[t.id] = itsByTrip[t.id] ? pickPlan(itsByTrip[t.id], now) : undefined;

  // Notificações locais à hora de sair (menos a antecedência escolhida); reagenda quando o caminho muda.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      for (const t of trips) {
        const p = plans[t.id];
        const at = p ? p.leaveAt - settings.bufferMin * 60 : 0;
        const key = p ? `${p.it.id}@${Math.round(at / 30)}` : '';
        if (!notify[t.id] || !p || at - Date.now() / 1000 < 20) {
          if (scheduled.current[t.id]) { await Notifications.cancelScheduledNotificationAsync(scheduled.current[t.id]); delete scheduled.current[t.id]; delete scheduled.current[t.id + ':k']; }
          continue;
        }
        if (scheduled.current[t.id + ':k'] === key) continue;
        if (scheduled.current[t.id]) await Notifications.cancelScheduledNotificationAsync(scheduled.current[t.id]);
        const first = p.it.legs.find((l) => l.mode !== 'WALK');
        scheduled.current[t.id] = await Notifications.scheduleNotificationAsync({
          content: {
            title: `Saia agora — ${t.label}`,
            body: first ? `Apanhe o ${lineName(first)} às ${hhmm(first.start)} em ${first.from.name}. Chega às ${hhmm(p.it.end)}.` : `Chega às ${hhmm(p.it.end)}.`,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at * 1000) },
        });
        scheduled.current[t.id + ':k'] = key;
      }
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itsByTrip, notify, trips, settings]);

  const setNotifyFor = async (id: string, v: boolean) => {
    if (v && Platform.OS !== 'web') {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
    }
    setNotify((n) => ({ ...n, [id]: v }));
  };

  if (!fontsLoaded || !ready) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand }}><ActivityIndicator color="#FFFFFF" /></View>;
  }

  if (!seenIntro) return (<><StatusBar style="light" /><Intro onStart={() => { setSeenIntro(true); setTab(trips.length ? 'inicio' : 'viagem'); }} /></>);

  if (simple && trips.length) {
    const t = [...trips].sort((a, b) => (plans[a.id]?.leaveAt ?? Infinity) - (plans[b.id]?.leaveAt ?? Infinity))[0];
    return (<><StatusBar style="light" /><Simple trip={t} plan={plans[t.id]} onExit={() => setSimple(false)} /></>);
  }

  if (open) {
    const saved = !!open.tripId || trips.some((t) => t.from.label === open.from.label && t.to.label === open.to.label);
    return (
      <>
        <StatusBar style="dark" />
        <RouteDetail itinerary={open.it} from={open.from.label} to={open.to.label} onBack={() => setOpen(null)} saved={saved}
          onSave={() => {
            const id = String(Date.now());
            setTrips((x) => [...x, { id, label: open.to.label, from: open.from, to: open.to }]);
            setNotifyFor(id, true);
            setOpen(null); setTab('inicio');
          }} />
      </>
    );
  }

  const myAlerts = (alerts ?? []).filter((a) => trips.some((t) => affects(a, plans[t.id]?.it)));
  const its: Record<string, Itinerary | undefined> = Object.fromEntries(trips.map((t) => [t.id, plans[t.id]?.it]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1 }}>
        {tab === 'inicio' && (
          <Home trips={trips} plans={plans} errors={errors} notify={notify} alerts={alerts ?? []}
            onNotify={setNotifyFor} onDelete={(id) => setTrips((x) => x.filter((t) => t.id !== id))}
            onPlan={() => setTab('viagem')} onSimple={() => setSimple(true)} onAlerts={() => setTab('avisos')}
            onOpen={(t) => { const p = plans[t.id]; if (p) setOpen({ it: p.it, from: t.from, to: t.to, tripId: t.id }); }} />
        )}
        {tab === 'viagem' && <PlanTrip onOpen={(it, from, to) => setOpen({ it, from, to })} />}
        {tab === 'avisos' && <Alerts alerts={alerts} trips={trips} its={its} refreshing={loadingAlerts} onRefresh={refreshAlerts} sample={isSample()} />}
        {tab === 'ajustes' && <SettingsScreen settings={settings} onChange={setSettings} onIntro={() => setSeenIntro(false)} />}
      </View>
      <TabBar tab={tab} onChange={setTab} badge={myAlerts.length} />
    </View>
  );
}
