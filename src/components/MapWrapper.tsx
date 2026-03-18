import React, { forwardRef, useImperativeHandle, useRef, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Colors } from '../constants/theme';

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export interface MapRegion extends MapCoordinate {
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapRef {
  animateToRegion: (region: MapRegion, duration?: number) => void;
  fitToCoordinates: (coords: MapCoordinate[], options?: any) => void;
}

interface MapWrapperProps {
  initialRegion: MapRegion;
  style?: any;
  children?: React.ReactNode;
}

// ─────────────────────────────────────────────
// WEB: Full Leaflet map via iframe postMessage
// ─────────────────────────────────────────────
const LEAFLET_HTML = (lat: number, lng: number, zoom: number) => `
<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body,#map{width:100%;height:100%;background:#0a0a0a}
  .leaflet-layer{filter:invert(100%) hue-rotate(180deg) brightness(96%) contrast(92%)}
  .leaflet-control-attribution{display:none!important}
  .leaflet-control-zoom{display:none!important}
  .user-dot{width:14px;height:14px;background:#00ff88;border:3px solid #fff;border-radius:50%;box-shadow:0 0 15px #00ff88}
  .dest-icon{font-size:28px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.65);font-family:'Material Icons Round',sans-serif}
  .car-icon{font-size:26px;color:#00ff88;text-shadow:0 2px 8px rgba(0,0,0,.55);font-family:'Material Icons Round',sans-serif}
</style>
<link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet">
</head><body>
<div id="map"></div>
<script>
var map = L.map('map',{zoomControl:false}).setView([${lat},${lng}],${zoom});
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);

var markers = {};
var polylines = {};

function makeIcon(type) {
  if (type === 'user') return L.divIcon({className:'',html:'<div class="user-dot"></div>',iconSize:[20,20],iconAnchor:[10,10]});
  if (type === 'dest') return L.divIcon({className:'',html:'<span class="dest-icon">place</span>',iconSize:[28,28],iconAnchor:[14,28]});
  if (type === 'car')  return L.divIcon({className:'',html:'<span class="car-icon">electric_car</span>',iconSize:[26,26],iconAnchor:[13,13]});
  return L.divIcon({className:'',html:'<div class="user-dot"></div>',iconSize:[20,20],iconAnchor:[10,10]});
}

window.addEventListener('message', function(e) {
  var d;
  try { d = JSON.parse(e.data); } catch(_) { return; }
  if (!d || !d.type) return;

  if (d.type === 'setMarker') {
    if (markers[d.id]) map.removeLayer(markers[d.id]);
    markers[d.id] = L.marker([d.lat,d.lng],{icon:makeIcon(d.icon)}).addTo(map);
  }
  if (d.type === 'removeMarker') {
    if (markers[d.id]) { map.removeLayer(markers[d.id]); delete markers[d.id]; }
  }
  if (d.type === 'setPolyline') {
    if (polylines[d.id]) map.removeLayer(polylines[d.id]);
    polylines[d.id] = L.polyline(d.coords,{weight:5,opacity:0.9,color:d.color||'#00ff88'}).addTo(map);
  }
  if (d.type === 'removePolyline') {
    if (polylines[d.id]) { map.removeLayer(polylines[d.id]); delete polylines[d.id]; }
  }
  if (d.type === 'flyTo') {
    map.flyTo([d.lat,d.lng],d.zoom||15,{duration:d.duration||0.8});
  }
  if (d.type === 'fitBounds') {
    map.fitBounds(d.bounds,{padding:[d.pad||40,d.pad||40],animate:true});
  }
});
<\/script>
</body></html>`;

// Extend MapRef for web to include marker/polyline management
export interface WebMapRef extends MapRef {
  setMarker: (id: string, lat: number, lng: number, icon: 'user' | 'dest' | 'car') => void;
  removeMarker: (id: string) => void;
  setPolyline: (id: string, coords: MapCoordinate[], color?: string) => void;
  removePolyline: (id: string) => void;
}

const WebMapFull = forwardRef<WebMapRef, MapWrapperProps>(({ initialRegion, style }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const postMsg = useCallback((msg: any) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), '*');
  }, []);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region, duration) => {
      const zoom = Math.round(14 - Math.log2(region.latitudeDelta / 0.002));
      postMsg({ type: 'flyTo', lat: region.latitude, lng: region.longitude, zoom: Math.min(18, Math.max(10, zoom)), duration: (duration || 500) / 1000 });
    },
    fitToCoordinates: (coords, options) => {
      if (coords.length < 2) return;
      const bounds = coords.map(c => [c.latitude, c.longitude]);
      postMsg({ type: 'fitBounds', bounds, pad: options?.edgePadding?.top || 40 });
    },
    setMarker: (id, lat, lng, icon) => {
      postMsg({ type: 'setMarker', id, lat, lng, icon });
    },
    removeMarker: (id) => {
      postMsg({ type: 'removeMarker', id });
    },
    setPolyline: (id, coords, color) => {
      postMsg({ type: 'setPolyline', id, coords: coords.map(c => [c.latitude, c.longitude]), color });
    },
    removePolyline: (id) => {
      postMsg({ type: 'removePolyline', id });
    },
  }), [postMsg]);

  const zoom = Math.round(14 - Math.log2(initialRegion.latitudeDelta / 0.002));
  const srcDoc = LEAFLET_HTML(initialRegion.latitude, initialRegion.longitude, Math.min(18, Math.max(10, zoom)));

  return (
    <View style={[webStyles.container, style]}>
      {/* @ts-ignore */}
      <iframe
        ref={(el: any) => { iframeRef.current = el; }}
        srcDoc={srcDoc}
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </View>
  );
});

const webStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
  },
});

// ─────────────────────────────────────────────
// NATIVE: react-native-maps
// ─────────────────────────────────────────────
const NativeMap = forwardRef<MapRef, MapWrapperProps>(({ initialRegion, style, children }, ref) => {
  const RNMaps = require('react-native-maps');
  const MapView = RNMaps.default;
  const mapRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region, duration) => {
      mapRef.current?.animateToRegion(region, duration ?? 500);
    },
    fitToCoordinates: (coords, options) => {
      mapRef.current?.fitToCoordinates(coords, options);
    },
  }));

  return (
    <MapView
      ref={mapRef}
      style={[StyleSheet.absoluteFillObject, style]}
      initialRegion={initialRegion}
      provider={RNMaps.PROVIDER_DEFAULT}
      userInterfaceStyle="dark"
    >
      {children}
    </MapView>
  );
});

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

// Combined ref type for consumers
export type EcoMapRef = MapRef & Partial<Pick<WebMapRef, 'setMarker' | 'removeMarker' | 'setPolyline' | 'removePolyline'>>;

// On web we export WebMapFull (with marker/polyline methods)
// On native we export NativeMap (children-based markers)
// Cast to any to unify the ref types across platforms
export const EcoMap = (Platform.OS === 'web' ? WebMapFull : NativeMap) as React.ForwardRefExoticComponent<MapWrapperProps & React.RefAttributes<EcoMapRef>>;

// Platform-safe Marker
interface MarkerProps {
  coordinate: MapCoordinate;
  anchor?: { x: number; y: number };
  title?: string;
  description?: string;
  children?: React.ReactNode;
}

const WebMarker = (_: MarkerProps) => null; // web uses imperative API
const NativeMarker = (props: MarkerProps) => {
  const { Marker } = require('react-native-maps');
  return <Marker {...props} />;
};
export const EcoMarker = Platform.OS === 'web' ? WebMarker : NativeMarker;

// Platform-safe Polyline
interface PolylineProps {
  coordinates: MapCoordinate[];
  strokeWidth?: number;
  strokeColor?: string;
}

const WebPolyline = (_: PolylineProps) => null; // web uses imperative API
const NativePolyline = (props: PolylineProps) => {
  const { Polyline } = require('react-native-maps');
  return <Polyline {...props} />;
};
export const EcoPolyline = Platform.OS === 'web' ? WebPolyline : NativePolyline;

