// Design tokens (ui-ux-pro-max: flat, high contrast, Atkinson Hyperlegible).
export const colors = {
  // Conceito "Painel de partidas": azul-noite dos painéis das estações + amarelo elétrico de Lisboa.
  brand: '#14306B',
  brandDark: '#0B1A3C',
  onBrand: '#FFFFFF',
  board: '#0B1A3C',
  boardTile: '#162B57',
  boardLine: '#24407A',
  boardInk: '#E8EEFA',
  boardMuted: '#9FB0D4',
  amber: '#FFC72C',
  onAmber: '#0B1A3C',
  ink: '#111827',
  inkSoft: '#374151',
  muted: '#4B5563',
  ground: '#F2EFE6',
  card: '#FFFFFF',
  cardOn: '#E9EDF7',
  inkOn: '#111827',
  line: '#E0DBCD',
  lineStrong: '#B8C1CC',
  track: '#E5E9EF',
  dotted: '#9CA3AF',
  emergency: '#C81E1E',
  emergencySoft: '#FDF2F2',
  emergencyLine: '#F5B4B4',
  emergencyInk: '#8A1414',
  fast: '#18794E',
  waitMid: '#A85A06',
  waitHigh: '#9A3412',
  me: '#2563EB',
  map: '#F3F5F8',
  water: '#CFE3EE',
  land: '#F2F0EB',
  landCity: '#FBFAF7',
  landLine: '#C9C2B2',
  landLabel: '#6B6458',
  park: '#DCEBD6',
};

export const font = {
  regular: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_800ExtraBold',
};

export const radius = { sm: 6, md: 12, lg: 16, xl: 20 };

// Motion tokens (design-motion-principles: Jakub primary, Emil secondary).
export const motion = {
  press: 120,
  sheet: 420,
  morph: 360,
  tile: 180,
  tooltip: 120,
  pressScale: 0.97,
};

export function waitColor(minutes: number) {
  if (minutes <= 75) return colors.fast;
  if (minutes <= 180) return colors.waitMid;
  return colors.waitHigh;
}

export function fmt(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, '0')}`;
}
