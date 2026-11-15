/** Mapa da viagem no iOS (Apple Maps) e Android (Google Maps — em produção precisa de chave em app.json). */
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors } from '../theme';
import { T } from './ui';
import type { RouteMapProps } from './RouteMap';

export type { RouteMapProps };

export function RouteMap({ itinerary, me, follow, height }: RouteMapProps) {
  const ref = useRef<MapView>(null);
  useEffect(() => {
    const pts = itinerary.legs.flatMap((l) => l.path.map((p) => ({ latitude: p.lat, longitude: p.lon })));
    const id = setTimeout(() => ref.current?.fitToCoordinates(pts, { edgePadding: { top: 40, bottom: 40, left: 40, right: 40 }, animated: false }), 50);
    return () => clearTimeout(id);
  }, [itinerary]);
  const first = itinerary.legs[0].from;
  const last = itinerary.legs[itinerary.legs.length - 1].to;
  return (
    <View style={{ height: height as any }}>
      <MapView ref={ref} style={{ flex: 1 }} showsUserLocation={!!me || !!follow} followsUserLocation={!!follow} showsBuildings pitchEnabled toolbarEnabled={false}
        initialRegion={{ latitude: first.lat, longitude: first.lon, latitudeDelta: 0.05, longitudeDelta: 0.05 }}>
        {itinerary.legs.map((l, i) => (
          <Polyline key={i} coordinates={l.path.map((p) => ({ latitude: p.lat, longitude: p.lon }))}
            strokeColor={l.mode === 'WALK' ? '#1A73E8' : l.color} strokeWidth={l.mode === 'WALK' ? 5 : 8}
            lineDashPattern={l.mode === 'WALK' ? [2, 8] : undefined} />
        ))}
        {itinerary.legs.filter((l) => l.mode !== 'WALK').map((l, i) => (
          <Marker key={'s' + i} coordinate={{ latitude: l.from.lat, longitude: l.from.lon }} title={`${l.route} → ${l.headsign ?? ''}`} description={l.from.name}>
            <View style={{ backgroundColor: l.color, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10, borderWidth: 2, borderColor: '#fff' }}>
              <T bold style={{ color: l.textColor, fontSize: 12 }}>{l.route}</T>
            </View>
          </Marker>
        ))}
        <Marker coordinate={{ latitude: first.lat, longitude: first.lon }} title="Partida" pinColor="#111827" />
        <Marker coordinate={{ latitude: last.lat, longitude: last.lon }} title="Destino" pinColor={colors.brand} />
      </MapView>
    </View>
  );
}
