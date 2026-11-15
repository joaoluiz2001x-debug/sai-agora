/**
 * Ecrã de abertura (1.ª vez). Movimento (design-motion-principles · Jakub, momento raro → pode ter expressão):
 * a estrada desenha-se e o autocarro entra uma única vez (≈700 ms, ease-out, sem loop). "Reduzir movimento" → estático.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { colors } from '../theme';
import { Icon, PressableScale, T, useReduceMotion } from '../components/ui';

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const native = Platform.OS !== 'web';

export function Intro({ onStart }: { onStart: () => void }) {
  const reduce = useReduceMotion();
  const road = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const bus = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const text = useRef(new Animated.Value(reduce ? 1 : 0)).current;

  useEffect(() => {
    if (reduce) { road.setValue(1); bus.setValue(1); text.setValue(1); return; }
    Animated.sequence([
      Animated.timing(road, { toValue: 1, duration: 450, easing: ease, useNativeDriver: native }),
      Animated.parallel([
        Animated.timing(bus, { toValue: 1, duration: 600, easing: ease, useNativeDriver: native }),
        Animated.timing(text, { toValue: 1, duration: 500, delay: 150, easing: ease, useNativeDriver: native }),
      ]),
    ]).start();
  }, [reduce, road, bus, text]);

  const rows: [Parameters<typeof Icon>[0]['name'], string][] = [
    ['flag', 'Diga para onde vai'],
    ['bell', 'Avisamos quando for hora de sair'],
    ['warn', 'Saiba logo de greves e desvios'],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.brand, paddingHorizontal: 28, paddingTop: 96, paddingBottom: 40, justifyContent: 'space-between' }}>
      <View style={{ gap: 28 }}>
        {/* Logótipo: estrada + autocarro */}
        <View accessible accessibilityLabel="Sai Agora" style={{ height: 96, justifyContent: 'flex-end' }}>
          <Animated.View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)', transform: [{ scaleX: road }], transformOrigin: 'left' as any }} />
          <Animated.View style={{ position: 'absolute', bottom: 12, left: 0, width: 80, height: 80, borderRadius: 22, backgroundColor: '#FFFFFF',
            alignItems: 'center', justifyContent: 'center', opacity: bus,
            transform: [{ translateX: bus.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] }}>
            <Icon name="bus" size={46} color={colors.brand} sw={2.2} />
          </Animated.View>
        </View>

        <Animated.View style={{ gap: 12, opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
          <T bold accessibilityRole="header" style={{ color: '#FFFFFF', fontSize: 44, lineHeight: 50 }}>Sai Agora</T>
          <T style={{ color: '#FFFFFF', fontSize: 22, lineHeight: 30 }}>Saia de casa no minuto certo e apanhe o autocarro sem esperar na paragem.</T>
        </Animated.View>

        <Animated.View style={{ gap: 16, marginTop: 8, opacity: text }}>
          {rows.map(([icon, label]) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={icon} size={24} color="#FFFFFF" />
              </View>
              <T style={{ color: '#FFFFFF', fontSize: 19, flex: 1 }}>{label}</T>
            </View>
          ))}
        </Animated.View>
      </View>

      <View style={{ gap: 14 }}>
        <PressableScale accessibilityRole="button" onPress={onStart}
          style={{ minHeight: 60, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
          <T bold style={{ color: colors.brand, fontSize: 20 }}>Começar</T>
        </PressableScale>
        <T style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, textAlign: 'center' }}>
          Autocarros da Carris Metropolitana · App independente
        </T>
      </View>
    </View>
  );
}
