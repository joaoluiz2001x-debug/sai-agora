import React from 'react';
import { Linking, Pressable, ScrollView, Switch, View } from 'react-native';
import { colors } from '../theme';
import { T, s } from '../components/ui';
import type { Settings } from '../lib/plan';

function Choice<V>({ title, help, value, options, onChange }: { title: string; help: string; value: V; options: [V, string][]; onChange: (v: V) => void }) {
  return (
    <View style={[s.card, { gap: 10 }]}>
      <T bold style={{ fontSize: 18 }}>{title}</T>
      <T style={{ color: colors.inkSoft }}>{help}</T>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: colors.track, borderRadius: 14, padding: 4, gap: 4 }}>
        {options.map(([v, l]) => {
          const on = v === value;
          return (
            <Pressable key={l} onPress={() => onChange(v)} accessibilityRole="radio" accessibilityState={{ checked: on }}
              style={{ flex: 1, minHeight: 48, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.card : 'transparent', borderWidth: on ? 1 : 0, borderColor: colors.line }}>
              <T bold={on} style={{ color: on ? colors.brand : colors.inkSoft }}>{l}</T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SettingsScreen({ settings, onChange, onIntro }: { settings: Settings; onChange: (s: Settings) => void; onIntro: () => void }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.ground }} contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40, gap: 14 }}>
      <T bold accessibilityRole="header" style={{ fontSize: 28 }}>Ajustes</T>
      <Choice title="Avisar-me com antecedência" help="O aviso de sair toca uns minutos antes da hora certa." value={settings.bufferMin}
        options={[[0, 'Na hora'], [2, '2 min antes'], [5, '5 min antes']]} onChange={(bufferMin) => onChange({ ...settings, bufferMin })} />
      <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <T bold style={{ fontSize: 18 }} nativeID="simple">Abrir sempre no ecrã simples</T>
          <T style={{ color: colors.inkSoft }}>Uma só mensagem, em letras gigantes. Ideal para quem quer o mínimo.</T>
        </View>
        <Switch accessibilityLabelledBy="simple" value={settings.simpleDefault} onValueChange={(simpleDefault) => onChange({ ...settings, simpleDefault })}
          trackColor={{ true: colors.brand, false: colors.lineStrong }} thumbColor="#FFFFFF" />
      </View>
      <View style={[s.card, { gap: 8 }]}>
        <T bold style={{ fontSize: 18 }}>Sobre</T>
        <T style={{ color: colors.inkSoft, lineHeight: 23 }}>
          Caminhos: Transitous (serviço comunitário, dados abertos de Metro, Carris, Carris Metropolitana, CP e outros). Tempo real e avisos: Carris Metropolitana (CC BY 4.0). Mapas: OpenFreeMap © OpenStreetMap. App independente, não oficial e de código aberto.
        </T>
        <Pressable onPress={() => Linking.openURL('https://github.com/joaoluiz2001x-debug/sai-agora')} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
          <T bold style={{ color: colors.brand }}>Código-fonte no GitHub (MIT)</T>
        </Pressable>
        <Pressable onPress={() => Linking.openURL('https://transitous.org/sources')} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
          <T bold style={{ color: colors.brand }}>Fontes de dados do Transitous</T>
        </Pressable>
        <Pressable onPress={onIntro} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
          <T bold style={{ color: colors.brand }}>Ver o ecrã de boas-vindas</T>
        </Pressable>
      </View>
    </ScrollView>
  );
}
