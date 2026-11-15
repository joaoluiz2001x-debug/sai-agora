import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';
import { T } from './ui';
import { Itinerary, Leg, MODE_LABEL, Mode, lineName } from '../data/transit';

/** Ícone do modo de transporte (traço SVG, nunca emoji). */
export function ModeIcon({ mode, size = 18, color = colors.inkSoft }: { mode: Mode; size?: number; color?: string }) {
  const p = { stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {mode === 'WALK' && (<><Circle cx="13" cy="4.5" r="1.5" {...p} /><Path d="M10 21l2-6 3 3v3M9 12l3-4 3 3 3 1M12 8l-1 5" {...p} /></>)}
      {(mode === 'BUS' || mode === 'OTHER') && (<><Path d="M6 17h12V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v11z" {...p} /><Path d="M6 11h12M8 20v-3M16 20v-3" {...p} /></>)}
      {mode === 'SUBWAY' && (<><Path d="M4 20h16M7 4h10a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2z" {...p} /><Path d="M5 11h14M9 18l-2 2M15 18l2 2" {...p} /></>)}
      {mode === 'TRAM' && (<><Path d="M7 7h10v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7zM9 3h6M12 3v4M9 21l1-3M15 21l-1-3" {...p} /></>)}
      {(mode === 'RAIL' || mode === 'FUNICULAR') && (<><Path d="M7 4h10a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2zM5 10h14M8 21l2-3M16 21l-2-3" {...p} /></>)}
      {mode === 'FERRY' && (<><Path d="M3 17c2 2 4 2 6 0 2 2 4 2 6 0 2 2 4 2 6 0M5 14l1-5h12l1 5M9 9V5h6v4" {...p} /></>)}
    </Svg>
  );
}

/** Texto curto do distintivo: "Vermelha", "2736", "Comboio"… */
function badgeText(leg: Leg) {
  if (leg.mode === 'SUBWAY') return lineName(leg).replace('Linha ', '');
  if (leg.route && leg.route.length <= 6) return leg.route;
  return MODE_LABEL[leg.mode];
}

export function LineBadge({ leg, large }: { leg: Leg; large?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: leg.color, paddingHorizontal: large ? 10 : 7, paddingVertical: large ? 5 : 3, borderRadius: 8 }}>
      <ModeIcon mode={leg.mode} size={large ? 18 : 15} color={leg.textColor} />
      <T bold style={{ color: leg.textColor, fontSize: large ? 17 : 15 }}>{badgeText(leg)}</T>
    </View>
  );
}

/** Resumo da viagem numa linha: a pé 4 › [2736] › a pé 2 › [Vermelha] */
export function LegSummary({ it }: { it: Itinerary }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      {it.legs.map((l, i) => (
        <React.Fragment key={i}>
          {i > 0 && <T style={{ color: colors.muted }}>›</T>}
          {l.mode === 'WALK' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <ModeIcon mode="WALK" size={16} />
              <T style={{ fontSize: 14, color: colors.inkSoft }}>{Math.max(1, Math.round((l.end - l.start) / 60))}</T>
            </View>
          ) : <LineBadge leg={l} />}
        </React.Fragment>
      ))}
    </View>
  );
}
