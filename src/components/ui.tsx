import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Linking, Platform, Pressable, PressableProps,
  StyleProp, StyleSheet, Text, TextProps, View, ViewStyle,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, font, motion, radius } from '../theme';

// ---------- Motion helpers (design-motion-principles) ----------
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub?.remove?.();
  }, []);
  return reduce;
}

// Ease-out custom (equiv. cubic-bezier(0.22,1,0.36,1)) — nunca o "ease" por defeito.
const easeOut = Easing.bezier(0.22, 1, 0.36, 1);

/** Botão com feedback de toque: escala 0,97 em 120 ms. Sem animação com "reduzir movimento". */
export function PressableScale({
  style, outerStyle, children, ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; outerStyle?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    reduce ? scale.setValue(1) : Animated.timing(scale, { toValue: v, duration: motion.press, easing: easeOut, useNativeDriver: Platform.OS !== 'web' }).start();
  return (
    <Pressable {...rest} style={outerStyle} onPressIn={(e) => { to(motion.pressScale); rest.onPressIn?.(e); }} onPressOut={(e) => { to(1); rest.onPressOut?.(e); }}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Entrada de painel: opacidade + 16 px, 420 ms. Só para coisas que aparecem raramente. */
export function EnterUp({ children, style, deps = [] }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; deps?: unknown[] }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: motion.sheet, easing: easeOut, useNativeDriver: Platform.OS !== 'web' }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, ...deps]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// ---------- Text ----------
export function T({ style, bold, ...p }: TextProps & { bold?: boolean }) {
  return <Text {...p} style={[{ fontFamily: bold ? font.bold : font.regular, color: colors.ink, fontSize: 17 }, style]} />;
}

// ---------- Icons (inline stroke SVG, nunca emoji) ----------
type IconName = 'home' | 'route' | 'warn' | 'gear' | 'flag' | 'swap' | 'bus' | 'walk' | 'bell' | 'trash' | 'eye' | 'chevron' | 'pin' | 'phone' | 'list' | 'map' | 'plus' | 'back' | 'nav' | 'target' | 'clock' | 'check' | 'search';
export function Icon({ name, size = 22, color = colors.ink, sw = 2 }: { name: IconName; size?: number; color?: string; sw?: number }) {
  const p = { stroke: color, strokeWidth: sw, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {name === 'pin' && (<><Path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" {...p} /><Circle cx="12" cy="10" r="2.5" {...p} /></>)}
      {name === 'phone' && <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" {...p} />}
      {name === 'list' && <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...p} />}
      {name === 'map' && (<><Path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" {...p} /><Path d="M9 4v14M15 6v14" {...p} /></>)}
      {name === 'plus' && (<><Circle cx="12" cy="12" r="9" {...p} /><Path d="M12 8v8M8 12h8" {...p} /></>)}
      {name === 'back' && <Path d="M15 18l-6-6 6-6" {...p} />}
      {name === 'home' && (<><Path d="M3 11l9-7 9 7" {...p} /><Path d="M5 10v10h14V10" {...p} /><Path d="M10 20v-6h4v6" {...p} /></>)}
      {name === 'route' && (<><Circle cx="6" cy="18" r="2.5" {...p} /><Circle cx="18" cy="6" r="2.5" {...p} /><Path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" {...p} /></>)}
      {name === 'warn' && (<><Path d="M12 3 2 20h20L12 3z" {...p} /><Path d="M12 10v4M12 17h.01" {...p} /></>)}
      {name === 'gear' && (<><Circle cx="12" cy="12" r="3" {...p} /><Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" {...p} /></>)}
      {name === 'flag' && (<><Path d="M5 21V4" {...p} /><Path d="M5 4h11l-2 4 2 4H5" {...p} /></>)}
      {name === 'swap' && <Path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" {...p} />}
      {name === 'bus' && (<><Path d="M6 17h12V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v11z" {...p} /><Path d="M6 11h12M8 20v-3M16 20v-3" {...p} /><Circle cx="9" cy="14" r=".6" {...p} /><Circle cx="15" cy="14" r=".6" {...p} /></>)}
      {name === 'walk' && (<><Circle cx="13" cy="4.5" r="1.5" {...p} /><Path d="M10 21l2-6 3 3v3M9 12l3-4 3 3 3 1M12 8l-1 5" {...p} /></>)}
      {name === 'bell' && (<><Path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z" {...p} /><Path d="M10 21h4" {...p} /></>)}
      {name === 'trash' && <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" {...p} />}
      {name === 'eye' && (<><Path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" {...p} /><Circle cx="12" cy="12" r="3" {...p} /></>)}
      {name === 'chevron' && <Path d="M9 18l6-6-6-6" {...p} />}
      {name === 'nav' && <Path d="M3 11l18-8-8 18-2-8-8-2z" {...p} />}
      {name === 'target' && (<><Circle cx="12" cy="12" r="4" {...p} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3" {...p} /></>)}
      {name === 'clock' && (<><Circle cx="12" cy="13" r="8" {...p} /><Path d="M12 9v4l2.5 2.5M9 2h6" {...p} /></>)}
      {name === 'check' && <Path d="M20 6 9 17l-5-5" {...p} />}
      {name === 'search' && (<><Circle cx="11" cy="11" r="7" {...p} /><Path d="M20 20l-3.5-3.5" {...p} /></>)}
    </Svg>
  );
}

// ---------- Calls ----------
export const call112 = () => Linking.openURL('tel:112');
export const callSns24 = () => Linking.openURL('tel:808242424');
export const openDirections = (lat: number, lng: number) =>
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`);

export function EmergencyBar({ compact }: { compact?: boolean }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel="Emergência grave: ligar 112" onPress={call112}
      style={[s.emergency, compact && { alignSelf: 'flex-start', paddingHorizontal: 14, minHeight: 44, borderRadius: 22 }]}>
      {!compact && <Icon name="phone" size={20} color="#fff" sw={2.2} />}
      <T bold style={{ color: '#fff', fontSize: compact ? 14 : 16 }}>{compact ? 'Emergência grave? 112' : 'Emergência grave? Liga 112'}</T>
    </PressableScale>
  );
}

export const s = StyleSheet.create({
  emergency: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.emergency, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden', marginTop: 12 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16 },
  tabbar: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, paddingBottom: 24 },
  tabItem: { width: 88, minHeight: 48, alignItems: 'center', gap: 4 },
  primaryBtn: { minHeight: 52, borderRadius: 14, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ghostBtn: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
