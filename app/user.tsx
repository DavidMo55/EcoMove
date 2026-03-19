import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  ScrollView,
  Animated as RNAnimated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, FontSizes } from '../src/constants/theme';
import { Sheet } from '../src/components/Sheet';
import { SheetHeader } from '../src/components/SheetHeader';
import { EcoButton } from '../src/components/EcoButton';
import { EcoInput } from '../src/components/EcoInput';
import { ServiceCard } from '../src/components/ServiceCard';
import { Chip, ChipRow } from '../src/components/Chip';
import { Fab } from '../src/components/Fab';
import { RideCard, KVRow, Badge, Divider, ProgressBar } from '../src/components/RideCard';
import { BottomModal } from '../src/components/BottomModal';
import { Toast } from '../src/components/Toast';
import { EcoMap, EcoMarker, EcoPolyline, EcoMapRef } from '../src/components/MapWrapper';
import {
  ServiceType,
  TierType,
  SERVICE_INFO,
  computePrice,
  formatMXN,
  showToast,
} from '../src/stores/appState';
import { rides as ridesApi, setToken } from '../src/services/api';

const DEFAULT_COORDS = { latitude: 19.0414, longitude: -98.2063 };

type ScreenState = 'menu' | 'map';
type SheetView = 'services' | 'ride' | 'trip';
type TripStatus = 'idle' | 'searching' | 'assigned' | 'pickup' | 'ontrip' | 'completed';

export default function UserScreen() {
  const router = useRouter();
  const mapRef = useRef<EcoMapRef>(null);

  // --- Screen state: menu or map ---
  const [screen, setScreen] = useState<ScreenState>('menu');

  // --- GPS ---
  const [userCoords, setUserCoords] = useState(DEFAULT_COORDS);
  const [gpsStatus, setGpsStatus] = useState<'waiting' | 'ok' | 'denied'>('waiting');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!cancelled) {
          setGpsStatus('denied');
          showToast('Sin permisos de GPS. Usando ubicación por defecto.');
        }
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!cancelled) {
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setUserCoords(coords);
          setGpsStatus('ok');
          setOrigin('Mi ubicación');
        }
      } catch {
        if (!cancelled) {
          setGpsStatus('denied');
          showToast('No se pudo obtener ubicación.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // --- State ---
  const [sheetView, setSheetView] = useState<SheetView>('ride');
  const [service, setService] = useState<ServiceType>('ride');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [tier, setTier] = useState<TierType>('economy');
  const [pet, setPet] = useState(false);
  const [promo, setPromo] = useState(false);
  const [payment, setPayment] = useState('Tarjeta **** 4242');
  const [origin, setOrigin] = useState('Mi ubicación');
  const [destination, setDestination] = useState('');
  const [destLabel, setDestLabel] = useState('');
  const [routeKm, setRouteKm] = useState<number | null>(null);
  const [routeMin, setRouteMin] = useState<number | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [price, setPrice] = useState<number | null>(null);
  const [destCoord, setDestCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // --- Trip ---
  const [tripStatus, setTripStatusState] = useState<TripStatus>('idle');
  const tripStatusRef = useRef<TripStatus>('idle');
  const setTripStatus = useCallback((s: TripStatus) => { tripStatusRef.current = s; setTripStatusState(s); }, []);
  const [driverName, setDriverName] = useState('');
  const [driverCar, setDriverCar] = useState('');
  const [driverEta, setDriverEta] = useState('');
  const [tripProgress, setTripProgress] = useState(0);
  const [driverCoord, setDriverCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const ridePollerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const rideAnimRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);

  // --- Modals ---
  const [quickMenuVisible, setQuickMenuVisible] = useState(false);
  const [ratingVisible, setRatingVisible] = useState(false);
  const [stars, setStars] = useState(0);
  const [selectedTip, setSelectedTip] = useState(0);

  // --- Search ---
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [searchResults, setSearchResults] = useState<Array<{ label: string; lat: number; lng: number }>>([]);

  const tierTitles: Record<TierType, string> = { economy: 'Eco', comfort: 'Comfort', xl: 'XL' };

  // Cleanup
  useEffect(() => {
    return () => {
      if (ridePollerRef.current) clearInterval(ridePollerRef.current);
      if (rideAnimRef.current) clearInterval(rideAnimRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // Recalculate price
  useEffect(() => {
    if (routeKm && routeMin) setPrice(computePrice(routeKm, routeMin, tier, pet, promo));
  }, [tier, pet, promo, routeKm, routeMin]);

  // --- Web marker sync ---
  useEffect(() => {
    if (Platform.OS !== 'web' || screen !== 'map') return;
    mapRef.current?.setMarker?.('user', userCoords.latitude, userCoords.longitude, 'user');
  }, [userCoords, screen]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (destCoord) mapRef.current?.setMarker?.('dest', destCoord.latitude, destCoord.longitude, 'dest');
    else mapRef.current?.removeMarker?.('dest');
  }, [destCoord]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (driverCoord) mapRef.current?.setMarker?.('driver', driverCoord.latitude, driverCoord.longitude, 'car');
    else mapRef.current?.removeMarker?.('driver');
  }, [driverCoord]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (routeCoords.length > 1) mapRef.current?.setPolyline?.('route', routeCoords, Colors.primary);
    else mapRef.current?.removePolyline?.('route');
  }, [routeCoords]);

  // --- When map mounts, center on user ---
  useEffect(() => {
    if (screen === 'map') {
      setTimeout(() => {
        const region = { ...userCoords, latitudeDelta: 0.008, longitudeDelta: 0.008 };
        mapRef.current?.animateToRegion(region, 800);
        if (Platform.OS === 'web') {
          mapRef.current?.setMarker?.('user', userCoords.latitude, userCoords.longitude, 'user');
        }
      }, 500);
    }
  }, [screen]);

  // --- Logout ---
  const doLogout = useCallback(() => {
    if (ridePollerRef.current) { clearInterval(ridePollerRef.current); ridePollerRef.current = undefined; }
    if (rideAnimRef.current) { clearInterval(rideAnimRef.current); rideAnimRef.current = undefined; }
    setToken(null);
    router.replace('/');
  }, [router]);

  const handleLogout = useCallback(() => {
    if (Platform.OS === 'web') {
      if (confirm('¿Deseas cerrar sesión?')) doLogout();
    } else {
      Alert.alert('Cerrar sesión', '¿Deseas salir?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: doLogout },
      ]);
    }
  }, [doLogout]);

  // --- Select service from menu -> go to map ---
  const selectAndGo = useCallback((svc: ServiceType) => {
    setService(svc);
    setSheetView('ride');
    setScreen('map');
    if (svc !== 'ride') showToast('Servicio en simulación, pero con flujo completo');
  }, []);

  // --- Back to menu ---
  const goBackToMenu = useCallback(() => {
    setScreen('menu');
    setSheetView('ride');
    setDestination(''); setDestLabel(''); setDestCoord(null);
    setRouteCoords([]); setRouteKm(null); setRouteMin(null); setPrice(null);
    setSearchResults([]);
  }, []);

  // --- Search destination ---
  const searchDestination = useCallback((text: string) => {
    setDestination(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (text.length < 3) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          format: 'json', q: text, limit: '6', addressdetails: '1', 'accept-language': 'es',
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { Accept: 'application/json' },
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setSearchResults(data.map((item: any) => ({
            label: item.display_name, lat: parseFloat(item.lat), lng: parseFloat(item.lon),
          })));
        }
      } catch { /* silent */ }
    }, 350);
  }, []);

  // --- Choose dest + OSRM route ---
  const chooseDest = useCallback(async (place: { label: string; lat: number; lng: number }) => {
    const short = place.label.split(',').slice(0, 3).join(', ');
    setDestination(short); setDestLabel(short); setSearchResults([]);
    setDestCoord({ latitude: place.lat, longitude: place.lng });
    setRouteLoading(true);

    const fromLng = userCoords.longitude, fromLat = userCoords.latitude;
    const toLng = place.lng, toLat = place.lat;
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&alternatives=false&steps=false`;

    try {
      const res = await fetch(osrmUrl);
      const data = await res.json();
      if (data?.code === 'Ok' && data.routes?.length) {
        const route = data.routes[0];
        const km = route.distance / 1000;
        const minutes = route.duration / 60;
        const coords = route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
          latitude: lat, longitude: lng,
        }));
        setRouteKm(km); setRouteMin(minutes); setRouteCoords(coords);
        setPrice(computePrice(km, minutes, tier, pet, promo));
        mapRef.current?.fitToCoordinates(
          [{ latitude: fromLat, longitude: fromLng }, { latitude: toLat, longitude: toLng }],
          { edgePadding: { top: 80, right: 40, bottom: 320, left: 40 }, animated: true }
        );
        showToast(`Ruta: ${km.toFixed(1)} km · ${Math.round(minutes)} min`);
      } else throw new Error('No route');
    } catch {
      const dLat = (toLat - fromLat) * Math.PI / 180;
      const dLng2 = (toLng - fromLng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(fromLat * Math.PI / 180) * Math.cos(toLat * Math.PI / 180) * Math.sin(dLng2 / 2) ** 2;
      const km = 2 * 6371 * Math.asin(Math.sqrt(a)) * 1.3;
      const minutes = km * 2.5 + 5;
      setRouteKm(km); setRouteMin(minutes);
      setRouteCoords([{ latitude: fromLat, longitude: fromLng }, { latitude: toLat, longitude: toLng }]);
      setPrice(computePrice(km, minutes, tier, pet, promo));
      showToast('Ruta estimada (OSRM no disponible)');
    }
    setRouteLoading(false);
  }, [userCoords, tier, pet, promo]);

  // --- Animate vehicle along route ---
  const animateVehicle = useCallback((coords: { latitude: number; longitude: number }[]) => {
    if (coords.length < 2) return;
    let idx = 0;
    const totalMs = Math.max(8000, Math.min(25000, (routeMin || 10) * 800));
    const stepMs = Math.max(30, Math.floor(totalMs / coords.length));

    if (rideAnimRef.current) clearInterval(rideAnimRef.current);

    setDriverCoord(coords[0]);

    rideAnimRef.current = setInterval(() => {
      idx++;
      if (idx >= coords.length) {
        clearInterval(rideAnimRef.current!);
        rideAnimRef.current = undefined;
        return;
      }
      setDriverCoord(coords[idx]);
      setTripProgress(prev => Math.min(95, prev + (80 / coords.length)));

      // Follow driver on map every 10 steps
      if (idx % 10 === 0) {
        mapRef.current?.animateToRegion({
          ...coords[idx], latitudeDelta: 0.006, longitudeDelta: 0.006,
        }, 300);
      }
    }, stepMs);
  }, [routeMin]);

  // --- Request driver ---
  const requestDriver = useCallback(async () => {
    if (!destCoord) { showToast('Elige un destino'); return; }

    setSheetView('trip');
    setTripStatus('searching');
    setTripProgress(10);
    showToast('Buscando conductor...');

    let rideId: string;

    try {
      const data = await ridesApi.request({
        fromLat: userCoords.latitude, fromLng: userCoords.longitude, fromLabel: origin,
        toLat: destCoord.latitude, toLng: destCoord.longitude, toLabel: destLabel,
        service, tier, pet, promo: promo ? 'ECO10' : undefined,
        payment, distanceKm: routeKm ?? undefined, durationMin: routeMin ?? undefined, price: price ?? undefined,
      });

      rideId = data.ride.id;
      setActiveRideId(rideId);

      if (!data.driver && data.driversNearby === 0) {
        showToast('No hay conductores disponibles cerca de ti');
        setSheetView('ride');
        setTripStatus('idle');
        return;
      }

      if (data.driver) {
        const d = data.driver;
        setDriverName(`Buscando... · ${d.name} cerca`);
        setDriverCar(`${d.carModel} · ${d.plate}`);
        setDriverCoord({ latitude: d.lat, longitude: d.lng });
      }

      showToast(`Viaje solicitado — ${data.driversNearby || 1} conductores cerca`);
    } catch (err: any) {
      showToast(err.message || 'Error al solicitar viaje');
      setSheetView('ride');
      setTripStatus('idle');
      return;
    }

    // Poll for driver acceptance
    let pollCount = 0;
    if (ridePollerRef.current) clearInterval(ridePollerRef.current);

    ridePollerRef.current = setInterval(async () => {
      pollCount++;
      setTripProgress(prev => Math.min(35, 10 + pollCount * 2));

      try {
        const active = await ridesApi.active();
        if (!active.ride) return;
        const r = active.ride;
        const d = r.driver;

        if (d) {
          setDriverName(`${d.user?.name || 'Conductor'} · ${d.rating?.toFixed(1) || '5.0'} ★`);
          setDriverCar(`${d.carModel} · ${d.plate} · Bat ${d.battery}%`);
          if (tripStatusRef.current !== 'ontrip') {
            setDriverCoord({ latitude: d.lat, longitude: d.lng });
          }
        }

        if (r.status === 'ASSIGNED' && tripStatusRef.current === 'searching') {
          setTripStatus('assigned');
          setTripProgress(35);
          setDriverEta(`ETA ${Math.max(2, Math.round((0.5) / 0.45))} min`);
          showToast(`${d?.user?.name || 'Conductor'} aceptó tu viaje`);

          // Animate driver to user (pickup simulation)
          if (d) {
            const driverStart = { latitude: d.lat, longitude: d.lng };
            const pickupCoords = generateStraightPath(driverStart, userCoords, 60);
            animateVehicle(pickupCoords);
          }
        }

        if (r.status === 'PICKUP' && tripStatusRef.current !== 'pickup' && tripStatusRef.current !== 'ontrip') {
          setTripStatus('pickup');
          setDriverEta('Aquí');
          setTripProgress(50);
          setDriverCoord(userCoords);
          showToast('Tu conductor ya llegó');
        }

        if (r.status === 'ONTRIP' && tripStatusRef.current !== 'ontrip' && tripStatusRef.current !== 'completed') {
          setTripStatus('ontrip');
          setTripProgress(55);
          showToast('Viaje en curso');
          // Animate vehicle along route
          if (routeCoords.length > 1) {
            animateVehicle(routeCoords);
          }
        }

        if (r.status === 'COMPLETED' && tripStatusRef.current !== 'completed') {
          clearInterval(ridePollerRef.current!);
          ridePollerRef.current = undefined;
          if (rideAnimRef.current) { clearInterval(rideAnimRef.current); rideAnimRef.current = undefined; }
          setTripStatus('completed');
          setTripProgress(100);
          setDriverCoord(destCoord);
          showToast('¡Llegaste!');
          setTimeout(() => setRatingVisible(true), 800);
        }

        if (r.status === 'CANCELLED') {
          clearInterval(ridePollerRef.current!);
          ridePollerRef.current = undefined;
          if (rideAnimRef.current) { clearInterval(rideAnimRef.current); rideAnimRef.current = undefined; }
          setTripStatus('idle');
          setSheetView('ride');
          showToast('El viaje fue cancelado');
        }

        if (pollCount > 30 && tripStatusRef.current === 'searching') {
          clearInterval(ridePollerRef.current!);
          ridePollerRef.current = undefined;
          showToast('No se encontró conductor. Intenta de nuevo.');
          setSheetView('ride');
          setTripStatus('idle');
          try { await ridesApi.cancel(rideId); } catch { /* ok */ }
        }
      } catch { /* keep polling */ }
    }, 3000);
  }, [destCoord, userCoords, origin, destLabel, service, tier, pet, promo, payment, routeKm, routeMin, price, routeCoords, animateVehicle]);

  // --- Cancel trip ---
  const cancelTrip = useCallback(async () => {
    if (ridePollerRef.current) { clearInterval(ridePollerRef.current); ridePollerRef.current = undefined; }
    if (rideAnimRef.current) { clearInterval(rideAnimRef.current); rideAnimRef.current = undefined; }
    if (activeRideId) { try { await ridesApi.cancel(activeRideId); } catch { /* silent */ } }
    setTripStatus('idle'); setTripProgress(0); setDriverCoord(null); setActiveRideId(null);
    setSheetView('ride');
    showToast('Viaje cancelado');
  }, [activeRideId]);

  // --- Reset ---
  const resetAll = useCallback(() => {
    if (ridePollerRef.current) { clearInterval(ridePollerRef.current); ridePollerRef.current = undefined; }
    if (rideAnimRef.current) { clearInterval(rideAnimRef.current); rideAnimRef.current = undefined; }
    setService('ride'); setWhen('now'); setTier('economy');
    setPet(false); setPromo(false); setPayment('Tarjeta **** 4242');
    setDestination(''); setDestLabel(''); setRouteKm(null); setRouteMin(null);
    setRouteCoords([]); setPrice(null); setDestCoord(null);
    setTripStatus('idle'); setTripProgress(0); setDriverCoord(null);
    setStars(0); setSelectedTip(0); setActiveRideId(null);
    setScreen('menu');
  }, []);

  const cyclePayment = useCallback(() => {
    const opts = ['Tarjeta **** 4242', 'Efectivo', 'Wallet EcoMove'];
    const idx = (opts.indexOf(payment) + 1) % opts.length;
    setPayment(opts[idx]); showToast(`Pago: ${opts[idx]}`);
  }, [payment]);

  const centerOnUser = useCallback(() => {
    const region = { ...userCoords, latitudeDelta: 0.008, longitudeDelta: 0.008 };
    mapRef.current?.animateToRegion(region, 600);
    if (Platform.OS === 'web') mapRef.current?.setMarker?.('user', userCoords.latitude, userCoords.longitude, 'user');
  }, [userCoords]);

  const useMyLocation = useCallback(async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserCoords(coords); setOrigin('Mi ubicación'); setGpsStatus('ok');
      centerOnUser();
      showToast('Ubicación actualizada');
    } catch { showToast('No se pudo obtener ubicación'); }
  }, [centerOnUser]);

  const tripTitleMap: Record<TripStatus, string> = {
    idle: 'Viaje', searching: 'Buscando conductor...', assigned: 'Conductor asignado',
    pickup: 'Conductor llegó', ontrip: 'En viaje', completed: 'Viaje finalizado',
  };
  const tripSubMap: Record<TripStatus, string> = {
    idle: '', searching: 'Asignación inteligente', assigned: 'Va en camino a tu ubicación',
    pickup: 'Puedes iniciar el viaje', ontrip: 'Rumbo al destino', completed: 'Gracias por usar EcoMove',
  };
  const tripStateMap: Record<TripStatus, string> = {
    idle: '—', searching: 'Matching', assigned: 'En camino (pickup)',
    pickup: 'Pickup completado', ontrip: 'En progreso', completed: 'Completado',
  };

  // ==========================================
  //  RENDER: MENU SCREEN
  // ==========================================
  if (screen === 'menu') {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <MaterialIcons name="bolt" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.brandText}>
              EcoMove <Text style={{ color: Colors.primary }}>App</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.pill, gpsStatus === 'denied' && { borderColor: 'rgba(255,204,0,0.55)' }]}>
              <View style={[styles.pillDot, gpsStatus === 'denied' && { backgroundColor: Colors.warn }]} />
              <Text style={[styles.pillText, gpsStatus === 'denied' && { color: Colors.warn }]}>
                {gpsStatus === 'waiting' ? 'GPS: esperando...' : gpsStatus === 'ok' ? 'GPS: listo' : 'GPS: denegado'}
              </Text>
            </View>
            <Pressable onPress={handleLogout} hitSlop={10} style={styles.logoutBtn}>
              <MaterialIcons name="logout" size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={styles.menuContent} showsVerticalScrollIndicator={false}>
          {/* Greeting */}
          <View style={styles.greetingSection}>
            <Text style={styles.greetingTitle}>¿Qué necesitas hoy?</Text>
            <Text style={styles.greetingSub}>Selecciona un servicio para comenzar</Text>
          </View>

          {/* Services grid */}
          <View style={styles.menuGrid}>
            <MenuServiceCard icon="electric-car" title="Viaje" subtitle="Ruta + conductor + pago real" color={Colors.primary} onPress={() => selectAndGo('ride')} />
            <MenuServiceCard icon="restaurant" title="Comida" subtitle="Pide comida a domicilio" color="#FF6B35" onPress={() => selectAndGo('food')} />
            <MenuServiceCard icon="shopping-cart" title="Despensa" subtitle="Supermercado a tu puerta" color="#4ECDC4" onPress={() => selectAndGo('market')} />
            <MenuServiceCard icon="local-shipping" title="Paquetes" subtitle="Envía y recibe paquetes" color="#FFD93D" onPress={() => selectAndGo('pack')} />
          </View>

          {/* Quick actions */}
          <Text style={styles.sectionTitle}>Acciones rápidas</Text>
          <View style={styles.quickActions}>
            <QuickAction icon="history" label="Historial" onPress={() => showToast('Historial de viajes')} />
            <QuickAction icon="sell" label="Cupones" onPress={() => showToast('Cupones disponibles')} />
            <QuickAction icon="support-agent" label="Soporte" onPress={() => showToast('Soporte al cliente')} />
            <QuickAction icon="person" label="Mi cuenta" onPress={() => showToast('Mi cuenta')} />
          </View>

          {/* Promo card */}
          <View style={styles.promoCard}>
            <MaterialIcons name="eco" size={32} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.promoTitle}>Movilidad 100% eléctrica</Text>
              <Text style={styles.promoSub}>Cada viaje es cero emisiones. Elige EcoMove.</Text>
            </View>
          </View>
        </ScrollView>

        <Toast />
      </View>
    );
  }

  // ==========================================
  //  RENDER: MAP SCREEN
  // ==========================================
  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.brand}>
          <Pressable onPress={sheetView === 'trip' ? undefined : goBackToMenu} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {sheetView !== 'trip' && <MaterialIcons name="arrow-back" size={22} color={Colors.text} />}
            <View style={styles.logo}>
              <MaterialIcons name="bolt" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.brandText}>
              EcoMove <Text style={{ color: Colors.primary }}>{SERVICE_INFO[service].reqTitle}</Text>
            </Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={styles.pill}>
            <View style={styles.pillDot} />
            <Text style={styles.pillText}>{gpsStatus === 'ok' ? 'GPS: listo' : 'GPS'}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Map */}
      <EcoMap ref={mapRef} initialRegion={{ ...userCoords, latitudeDelta: 0.015, longitudeDelta: 0.015 }}>
        <EcoMarker coordinate={userCoords} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.userMarker} />
        </EcoMarker>
        {destCoord && (
          <EcoMarker coordinate={destCoord}>
            <MaterialIcons name="place" size={30} color={Colors.text} />
          </EcoMarker>
        )}
        {driverCoord && (
          <EcoMarker coordinate={driverCoord} anchor={{ x: 0.5, y: 0.5 }}>
            <MaterialIcons name="electric-car" size={28} color={Colors.primary} />
          </EcoMarker>
        )}
        {routeCoords.length > 1 && (
          <EcoPolyline coordinates={routeCoords} strokeWidth={5} strokeColor={Colors.primary} />
        )}
      </EcoMap>

      {/* FABs */}
      <View style={styles.fabColumn}>
        <Fab icon="my-location" onPress={centerOnUser} />
        <Fab icon="tune" onPress={() => setQuickMenuVisible(true)} />
        <Fab icon="sos" color={Colors.danger} onPress={() => showToast('Emergencia: notificando contacto + 911')} />
      </View>

      {/* ===== SHEET: Ride Request ===== */}
      {sheetView === 'ride' && (
        <Sheet collapsible startMinimized={false} minHeight={100}>
          <SheetHeader title={SERVICE_INFO[service].reqTitle} subtitle={SERVICE_INFO[service].reqSub} actionIcon="close" onAction={goBackToMenu} />

          <ChipRow>
            <Chip label="Ahora" icon="bolt" selected={when === 'now'} onPress={() => setWhen('now')} />
            <Chip label="Programar" icon="schedule" selected={when === 'later'} onPress={() => { setWhen('later'); showToast('Programar: demo (simulado)'); }} />
          </ChipRow>

          <View style={{ marginTop: 10 }}>
            <EcoInput icon="my-location" placeholder="Origen (usa mi ubicación)" value={origin} onChangeText={setOrigin} rightIcon="gps-fixed" onRightIconPress={useMyLocation} />
          </View>
          <View style={{ marginTop: 10 }}>
            <EcoInput icon="place" placeholder="¿A dónde vas?" value={destination} onChangeText={searchDestination} />
          </View>

          {searchResults.length > 0 && (
            <View style={styles.dropdown}>
              {searchResults.map((r, i) => (
                <Pressable key={i} style={styles.ddItem} onPress={() => chooseDest(r)}>
                  <Text style={styles.ddTitle} numberOfLines={1}>{r.label.split(',').slice(0, 3).join(', ')}</Text>
                  <Text style={styles.ddSub} numberOfLines={2}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <ChipRow>
            <Chip label="Eco" selected={tier === 'economy'} onPress={() => setTier('economy')} />
            <Chip label="Comfort" selected={tier === 'comfort'} onPress={() => setTier('comfort')} />
            <Chip label="XL" selected={tier === 'xl'} onPress={() => setTier('xl')} />
            <Chip label="Mascota" icon="pets" selected={pet} onPress={() => { setPet(!pet); showToast(!pet ? 'Mascota agregada (+$15)' : 'Mascota removida'); }} />
          </ChipRow>

          <Divider />

          <RideCard>
            <View style={styles.topRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.strong}>{tierTitles[tier]} · Estimación</Text>
                <Text style={styles.mini}>
                  {routeLoading ? 'Calculando ruta...' : !destCoord ? 'Ingresa un destino' : 'Ruta calculada · listo'}
                </Text>
              </View>
              <Badge text={price ? formatMXN(price) : '—'} />
            </View>
            <KVRow label="Distancia" value={routeKm ? `${routeKm.toFixed(1)} km` : '—'} />
            <KVRow label="Tiempo" value={routeMin ? `${Math.round(routeMin)} min` : '—'} />
            <KVRow label="Pago" value={payment} />
          </RideCard>

          <EcoButton title="Solicitar" icon="search" onPress={requestDriver} disabled={!destCoord || routeLoading} loading={routeLoading} />
        </Sheet>
      )}

      {/* ===== SHEET: Trip ===== */}
      {sheetView === 'trip' && (
        <Sheet collapsible startMinimized={false} minHeight={80}>
          <SheetHeader title={tripTitleMap[tripStatus]} subtitle={tripSubMap[tripStatus]} actionIcon={tripStatus === 'completed' ? 'done' : 'close'} onAction={tripStatus === 'completed' ? resetAll : cancelTrip} />

          <RideCard>
            <View style={styles.topRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.strong}>{driverName || '—'}</Text>
                <Text style={styles.mini}>{driverCar || '—'}</Text>
              </View>
              <Badge text={driverEta || 'ETA —'} variant={tripStatus === 'completed' ? 'ok' : undefined} />
            </View>
            <ProgressBar progress={tripProgress} />
            <Divider />
            <KVRow label="Destino" value={destLabel || '—'} />
            <KVRow label="Precio" value={price ? formatMXN(price) : '—'} />
            <KVRow label="Estado" value={tripStateMap[tripStatus]} />

            {tripStatus !== 'searching' && tripStatus !== 'completed' && (
              <View style={styles.btnRow}>
                <EcoButton title="Chat" icon="chat" variant="ghost" onPress={() => showToast('Chat con conductor')} style={{ flex: 1 }} />
                <EcoButton title="Llamar" icon="call" variant="ghost" onPress={() => showToast('Llamando conductor')} style={{ flex: 1 }} />
              </View>
            )}
          </RideCard>

          <View style={styles.btnRow}>
            {tripStatus === 'completed' ? (
              <EcoButton title="Nuevo viaje" icon="restart-alt" onPress={resetAll} style={{ flex: 1 }} />
            ) : (
              <EcoButton title="Cancelar viaje" icon="cancel" variant="danger" onPress={cancelTrip} style={{ flex: 1 }} />
            )}
          </View>
        </Sheet>
      )}

      {/* Modals */}
      <BottomModal visible={quickMenuVisible} onClose={() => setQuickMenuVisible(false)} title="Opciones rápidas" subtitle="Acciones de tu cuenta">
        <View style={styles.btnRow}>
          <EcoButton title="Historial" icon="history" variant="ghost" onPress={() => showToast('Historial')} style={{ flex: 1 }} />
          <EcoButton title="Soporte" icon="support-agent" variant="ghost" onPress={() => showToast('Soporte')} style={{ flex: 1 }} />
        </View>
        <EcoButton title="Cerrar sesión" icon="logout" variant="danger" onPress={() => { setQuickMenuVisible(false); handleLogout(); }} />
        <View style={{ height: 8 }} />
        <EcoButton title="Listo" icon="done" onPress={() => setQuickMenuVisible(false)} />
      </BottomModal>

      <BottomModal visible={ratingVisible} onClose={() => { setRatingVisible(false); resetAll(); }} title="Califica tu viaje" subtitle={`${destLabel} · ${price ? formatMXN(price) : ''}`}>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map(n => (
            <Pressable key={n} style={[styles.star, n <= stars && styles.starActive]} onPress={() => setStars(n)}>
              <MaterialIcons name="star" size={22} color={Colors.warn} />
            </Pressable>
          ))}
        </View>
        <Text style={[styles.mini, { marginTop: 12 }]}>Propina para tu conductor</Text>
        <ChipRow>
          {[0, 10, 20, 50].map(amount => (
            <Chip key={amount} label={amount === 0 ? '$0' : `+ ${formatMXN(amount)}`} selected={selectedTip === amount} onPress={() => setSelectedTip(amount)} />
          ))}
        </ChipRow>
        <EcoButton title={`Enviar${stars > 0 ? ` · ${stars}★` : ''}${selectedTip > 0 ? ` · Propina ${formatMXN(selectedTip)}` : ''}`} icon="done" onPress={async () => {
          if (activeRideId) { try { await ridesApi.rate(activeRideId, { stars: stars || 5, tip: selectedTip }); } catch { /* */ } }
          showToast(`Gracias. ${stars > 0 ? `${stars}★` : ''}${selectedTip > 0 ? ` · Propina ${formatMXN(selectedTip)}` : ''}`);
          setRatingVisible(false); resetAll();
        }} />
      </BottomModal>

      <Toast />
    </View>
  );
}

// ─── Helper: generate straight path between two points ───
function generateStraightPath(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  steps: number
): { latitude: number; longitude: number }[] {
  const coords: { latitude: number; longitude: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    coords.push({
      latitude: from.latitude + (to.latitude - from.latitude) * t,
      longitude: from.longitude + (to.longitude - from.longitude) * t,
    });
  }
  return coords;
}

// ─── Menu Service Card ───
function MenuServiceCard({ icon, title, subtitle, color, onPress }: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.menuCard, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]} onPress={onPress}>
      <View style={[styles.menuCardIcon, { backgroundColor: color + '18', borderColor: color + '55' }]}>
        <MaterialIcons name={icon} size={32} color={color} />
      </View>
      <Text style={styles.menuCardTitle}>{title}</Text>
      <Text style={styles.menuCardSub}>{subtitle}</Text>
      <View style={[styles.menuCardArrow, { backgroundColor: color + '18' }]}>
        <MaterialIcons name="arrow-forward" size={16} color={color} />
      </View>
    </Pressable>
  );
}

// ─── Quick Action Button ───
function QuickAction({ icon, label, onPress }: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickActionIcon}>
        <MaterialIcons name={icon} size={22} color={Colors.primary} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  header: { backgroundColor: 'rgba(18,18,18,0.92)', borderBottomWidth: 1, borderBottomColor: Colors.borderLight, zIndex: 100 },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 },
  logo: { width: 32, height: 32, borderRadius: 14, backgroundColor: Colors.primaryAlpha14, borderWidth: 1, borderColor: Colors.primaryAlpha35, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontWeight: '900', fontSize: FontSizes.lg, color: Colors.text, letterSpacing: 0.2, marginLeft: 10, flex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.primaryAlpha55, backgroundColor: Colors.primaryAlpha06 },
  pillDot: { width: 8, height: 8, borderRadius: Radius.pill, backgroundColor: Colors.primary },
  pillText: { color: Colors.primary, fontSize: 11 },
  logoutBtn: { width: 34, height: 34, borderRadius: Radius.sm, backgroundColor: Colors.whiteAlpha06, borderWidth: 1, borderColor: Colors.whiteAlpha10, alignItems: 'center', justifyContent: 'center' },
  fabColumn: { position: 'absolute', top: 120, right: 14, gap: 10, zIndex: 50 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  strong: { fontWeight: '900', color: Colors.text, fontSize: FontSizes.md },
  mini: { color: Colors.textSecondary, fontSize: FontSizes.xs, marginTop: 2 },
  dropdown: { backgroundColor: 'rgba(12,12,12,0.98)', borderWidth: 1, borderColor: Colors.whiteAlpha10, borderRadius: Radius.md, maxHeight: 220, overflow: 'hidden', marginTop: 4 },
  ddItem: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.whiteAlpha06 },
  ddTitle: { fontWeight: '800', color: Colors.text, fontSize: FontSizes.sm },
  ddSub: { color: Colors.textSecondary, fontSize: FontSizes.xs, marginTop: 2 },
  userMarker: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.primary, borderWidth: 3, borderColor: '#ffffff', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 6 },
  starsRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  star: { width: 42, height: 42, borderRadius: 14, backgroundColor: Colors.whiteAlpha06, borderWidth: 1, borderColor: Colors.whiteAlpha10, alignItems: 'center', justifyContent: 'center' },
  starActive: { backgroundColor: 'rgba(0,255,136,0.12)', borderColor: Colors.primaryAlpha55 },

  // ── Menu screen ──
  menuContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  greetingSection: { marginBottom: 24 },
  greetingTitle: { fontSize: 28, fontWeight: '900', color: Colors.text },
  greetingSub: { fontSize: FontSizes.md, color: Colors.textSecondary, marginTop: 4 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  menuCard: {
    width: '47%' as any,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    padding: 16,
    gap: 8,
  },
  menuCardIcon: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 4,
  },
  menuCardTitle: { fontSize: FontSizes.lg, fontWeight: '900', color: Colors.text },
  menuCardSub: { fontSize: FontSizes.xs, color: Colors.textSecondary, lineHeight: 16 },
  menuCardArrow: {
    width: 28, height: 28, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-end', marginTop: 4,
  },

  sectionTitle: { fontSize: FontSizes.lg, fontWeight: '900', color: Colors.text, marginBottom: 14 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  quickAction: { alignItems: 'center', gap: 6, flex: 1 },
  quickActionIcon: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: Colors.primaryAlpha14, borderWidth: 1, borderColor: Colors.primaryAlpha35,
    alignItems: 'center', justifyContent: 'center',
  },
  quickActionLabel: { fontSize: FontSizes.xs, color: Colors.textSecondary, fontWeight: '600' },

  promoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.primaryAlpha06,
    borderWidth: 1, borderColor: Colors.primaryAlpha35,
    borderRadius: Radius.xl, padding: 16,
  },
  promoTitle: { fontSize: FontSizes.md, fontWeight: '900', color: Colors.primary },
  promoSub: { fontSize: FontSizes.xs, color: Colors.textSecondary, marginTop: 2 },
});
