/** "Para onde vai?" — origem e destino com sugestões; mostra viagens com transbordos (a pé, autocarro, metro…). */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { colors, font } from '../theme';
import { EnterUp, Icon, PressableScale, T, s } from '../components/ui';
import { Stop, distanceM, fetchStops } from '../data/carris';
import { PLACE_SUGGESTIONS, Place, Suggestion, currentPlace, looksLikeStreet, resolvePlace, searchPlacesLocal, searchPlacesOnline } from '../data/places';
import { Itinerary, leaveTime, planTrip } from '../data/transit';
import { LegSummary } from '../components/TransitUI';
import { countdown, hhmm } from '../lib/plan';

function Field({ id, label, icon, value, onChange, placeholder, onGps, picked, onPick, stops }: {
  id: string; label: string; icon: 'pin' | 'flag'; value: string; onChange: (v: string) => void; placeholder: string; onGps?: () => void;
  picked: Place | null; onPick: (p: Place) => void; stops: Stop[];
}) {
  const showSug = value.trim().length >= 2 && (!picked || picked.label !== value);
  const [online, setOnline] = useState<Suggestion[]>([]);
  useEffect(() => {
    setOnline([]);
    if (!showSug) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => { searchPlacesOnline(value, ctrl.signal).then(setOnline).catch(() => {}); }, 350); // espera que pare de escrever
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value, showSug]);
  const local = showSug ? searchPlacesLocal(value, stops, 6) : [];
  const fresh = online.filter((o) => !local.some((l) => l.label === o.label));
  // Se parece uma rua, as ruas aparecem primeiro.
  // Ordem: zonas/freguesias › ruas e locais do mapa (ex.: "Centro Vasco da Gama") › paragens.
  const zonas = local.filter((x) => x.source === 'zona');
  const paragens = local.filter((x) => x.source === 'paragem');
  const sug: Suggestion[] = (looksLikeStreet(value) ? [...fresh, ...zonas, ...paragens] : [...zonas, ...fresh, ...paragens]).slice(0, 8);
  return (
    <View style={{ gap: 6 }}>
      <T bold nativeID={id} style={{ fontSize: 16 }}>{label}</T>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 54, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 12, paddingHorizontal: 12, backgroundColor: colors.card }}>
          <Icon name={icon} size={20} color={colors.brand} />
          <TextInput accessibilityLabelledBy={id} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted}
            style={{ flex: 1, fontSize: 18, fontFamily: font.regular, color: colors.ink, minHeight: 50, outlineWidth: 0 } as any} />
        </View>
        {onGps && (
          <Pressable onPress={onGps} accessibilityRole="button" accessibilityLabel="Usar a minha localização atual"
            style={{ width: 54, minHeight: 54, borderRadius: 12, backgroundColor: colors.cardOn, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="target" size={24} color={colors.brand} />
          </Pressable>
        )}
      </View>
      {picked && picked.label === value && (
        <T style={{ fontSize: 14, color: colors.fast }}>✓ Local encontrado</T>
      )}
      {sug.length > 0 && (
        <View accessibilityRole="list" style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.card }}>
          {sug.map((p, i) => (
            <Pressable key={p.label + i} onPress={() => onPick(p)} accessibilityRole="button" accessibilityLabel={`Escolher ${p.label}`}
              style={({ pressed }) => ({ minHeight: 56, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: pressed ? colors.cardOn : colors.card, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line })}>
              <Icon name={p.source === 'paragem' ? 'bus' : p.source === 'mapa' ? 'pin' : icon} size={18} color={colors.muted} />
              <View style={{ flex: 1 }}>
                <T style={{ fontSize: 17 }} numberOfLines={1}>{p.label}</T>
                {!!p.sub && <T style={{ fontSize: 14, color: colors.muted }} numberOfLines={1}>{p.sub}</T>}
              </View>
            </Pressable>
          ))}
          {online.length > 0 && <T style={{ fontSize: 12, color: colors.muted, padding: 8, textAlign: 'right' }}>Ruas e locais: © OpenStreetMap</T>}
        </View>
      )}
      {value.trim().length >= 3 && !picked && sug.length === 0 && (
        <T style={{ fontSize: 14, color: colors.muted }}>
          {Platform.OS === 'web'
            ? 'Sem sugestões de ruas aqui. Neste preview as ruas estão bloqueadas — abra a versão publicada ou a app no telemóvel.'
            : 'Sem sugestões. Pode carregar em "Ver autocarros" na mesma — procuramos a morada no mapa.'}
        </T>
      )}
    </View>
  );
}


export function PlanTrip({ onOpen }: { onOpen: (it: Itinerary, from: Place, to: Place) => void }) {
  const [fromQ, setFromQ] = useState('');
  const [toQ, setToQ] = useState('');
  const [from, setFrom] = useState<Place | null>(null);
  const [dest, setDest] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [its, setIts] = useState<Itinerary[] | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [now, setNow] = useState(Date.now() / 1000);
  useEffect(() => { fetchStops().then(setStops); }, []);
  useEffect(() => { const id = setInterval(() => setNow(Date.now() / 1000), 15000); return () => clearInterval(id); }, []);
  useEffect(() => { setIts(null); }, [toQ, fromQ]);

  const gps = async () => {
    const p = await currentPlace();
    if (p) { setFrom(p); setFromQ(p.label); } else setErr('Não foi possível obter a localização. Escreva a rua ou zona de partida.');
  };

  const search = async () => {
    setErr(''); setIts(null); setBusy(true);
    try {
      const a = from && fromQ === from.label ? from : await resolvePlace(fromQ);
      const b = dest && toQ === dest.label ? dest : await resolvePlace(toQ);
      if (!a) { setErr('Não encontrámos o local de partida. Escolha uma das sugestões.'); return; }
      if (!b) { setErr('Não encontrámos o destino. Escolha uma das sugestões.'); return; }
      setFrom(a); setDest(b);
      if (distanceM(a, b) < 400) { setErr('O destino fica muito perto — é melhor ir a pé.'); return; }
      const r = await planTrip(a, b, { from: a.label, to: b.label });
      // Pequena correção: ordenar pela hora de chegada.
      setIts(r.sort((x, y) => x.end - y.end));
    } catch {
      setErr(Platform.OS === 'web' && /claude|claudeusercontent/.test(String(globalThis.location?.host)) ?
        'No preview do Claude não há internet. Abra o site publicado ou a app para ver viagens.' :
        'Não foi possível calcular a viagem agora. Verifique a ligação e tente outra vez.');
    } finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ground }} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled">
      <T bold accessibilityRole="header" style={{ fontSize: 28 }}>Para onde vai?</T>

      <View style={[s.card, { gap: 14 }]}>
        <Field id="from" label="Sai de" icon="pin" value={fromQ} onChange={(v) => { setFromQ(v); if (from && v !== from.label) setFrom(null); }}
          placeholder="Rua, número ou zona" onGps={gps} picked={from} onPick={(p) => { setFrom(p); setFromQ(p.label); }} stops={stops} />
        <Field id="to" label="Vai para" icon="flag" value={toQ} onChange={(v) => { setToQ(v); if (dest && v !== dest.label) setDest(null); }}
          placeholder="Rua, número, zona ou local" picked={dest} onPick={(p) => { setDest(p); setToQ(p.label); }} stops={stops} />
        <PressableScale accessibilityRole="button" onPress={search} disabled={busy} style={[s.primaryBtn, { minHeight: 56 }]}>
          {busy ? <ActivityIndicator color={colors.onBrand} /> : <T bold style={{ color: colors.onBrand, fontSize: 18 }}>Ver caminhos</T>}
        </PressableScale>
        {!!err && <T style={{ color: colors.emergencyInk, fontSize: 16 }}>{err}</T>}
      </View>

      {its && !its.length && (
        <View style={[s.card, { gap: 6 }]}>
          <T bold>Sem viagens encontradas</T>
          <T style={{ color: colors.inkSoft }}>Não há transportes para este percurso nas próximas horas. Experimente outra hora ou um local perto.</T>
        </View>
      )}

      {its?.map((it, i) => {
        const leave = leaveTime(it) - now;
        return (
          <EnterUp key={it.id}>
            <Pressable onPress={() => from && dest && onOpen(it, from, dest)} accessibilityRole="button"
              accessibilityLabel={`Opção ${i + 1}: sai às ${hhmm(leaveTime(it))}, chega às ${hhmm(it.end)}, ${Math.round(it.duration / 60)} minutos, ${it.transfers} transbordos. Ver no mapa.`}
              style={({ pressed }) => [s.card, { gap: 12, backgroundColor: pressed ? colors.cardOn : colors.card, borderWidth: i === 0 ? 2 : 1, borderColor: i === 0 ? colors.brand : colors.line }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ gap: 2 }}>
                  {i === 0 && <T bold style={{ fontSize: 13, color: colors.brand }}>CHEGA MAIS CEDO</T>}
                  <T bold style={{ fontSize: 22 }}>{hhmm(leaveTime(it))} – {hhmm(it.end)}</T>
                  <T style={{ fontSize: 15, color: colors.muted }}>{Math.round(it.duration / 60)} min · {it.transfers ? `${it.transfers} transbordo${it.transfers > 1 ? 's' : ''}` : 'direto'}</T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T style={{ fontSize: 13, color: colors.muted }}>Sair</T>
                  <T bold style={{ fontSize: 20, color: leave <= 60 ? colors.emergency : colors.ink }}>{leave <= 30 ? 'Agora' : `em ${countdown(leave)}`}</T>
                </View>
              </View>
              <LegSummary it={it} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <T bold style={{ color: colors.brand }}>Ver caminho no mapa</T><Icon name="chevron" size={18} color={colors.brand} />
              </View>
            </Pressable>
          </EnterUp>
        );
      })}
    </ScrollView>
  );
}
