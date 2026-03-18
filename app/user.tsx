import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
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

const DEFAULT_COORDS = { latitude: 19.4326, longitude: -99.1332 };

type SheetView = 'services' | 'ride' | 'trip';
type TripStatus = 'idle' | 'searching' | 'assigned' | 'pickup' | 'ontrip' | 'completed';

export default function UserScreen() {
  const router = useRouter();
  const mapRef = useRef<EcoMapRef>(null);

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
          // Place fleet around user's real location

          // Delay to let iframe load on web
          setTimeout(() => {
            const region = { ...coords, latitudeDelta: 0.008, longitudeDelta: 0.008 };
            mapRef.current?.animateToRegion(region, 800);
            if (Platform.OS === 'web') {
              mapRef.current?.setMarker?.('user', coords.latitude, coords.longitude, 'user');
            }
          }, 600);
          showToast('Ubicación detectada');
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
  const [sheetView, setSheetView] = useState<SheetView>('services');
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
  const pickupIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const rideIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // --- Modals ---
  const [quickMenuVisible, setQuickMenuVisible] = useState(false);
  const [ratingVisible, setRatingVisible] = useState(false);
  const [stars, setStars] = useState(0);
  const [selectedTip, setSelectedTip] = useState(0);

  // --- Search ---
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [searchResults, setSearchResults] = useState<Array<{ label: string; lat: number; lng: number }>>([]);

  const tierTitles: Record<TierType, string> = { economy: 'Eco', comfort: 'Comfort', xl: 'XL' };

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (ridePollerRef.current) clearInterval(ridePollerRef.current);
      if (pickupIntervalRef.current) clearInterval(pickupIntervalRef.current);
      if (rideIntervalRef.current) clearInterval(rideIntervalRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // Recalculate price when tier/pet/promo changes
  useEffect(() => {
    if (routeKm && routeMin) setPrice(computePrice(routeKm, routeMin, tier, pet, promo));
  }, [tier, pet, promo, routeKm, routeMin]);

  // --- Web: sync markers/polylines to Leaflet iframe ---
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    mapRef.current?.setMarker?.('user', userCoords.latitude, userCoords.longitude, 'user');
  }, [userCoords]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (destCoord) {
      mapRef.current?.setMarker?.('dest', destCoord.latitude, destCoord.longitude, 'dest');
    } else {
      mapRef.current?.removeMarker?.('dest');
    }
  }, [destCoord]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (driverCoord) {
      mapRef.current?.setMarker?.('driver', driverCoord.latitude, driverCoord.longitude, 'car');
    } else {
      mapRef.current?.removeMarker?.('driver');
    }
  }, [driverCoord]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (routeCoords.length > 1) {
      mapRef.current?.setPolyline?.('route', routeCoords, Colors.primary);
    } else {
      mapRef.current?.removePolyline?.('route');
    }
  }, [routeCoords]);

  // --- Logout ---
  const doLogout = useCallback(() => {
    // Clean up any running trip
    if (pickupIntervalRef.current) { clearInterval(pickupIntervalRef.current); pickupIntervalRef.current = undefined; }
    if (rideIntervalRef.current) { clearInterval(rideIntervalRef.current); rideIntervalRef.current = undefined; }
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

  // --- Search destination (Nominatim) ---
  const searchDestination = useCallback((text: string) => {
    setDestination(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (text.length < 3) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          format: 'json',
          q: text,
          limit: '6',
          addressdetails: '1',
          'accept-language': 'es',
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { Accept: 'application/json' },
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          setSearchResults(data.map((item: any) => ({
            label: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          })));
        }
      } catch { /* silent */ }
    }, 350);
  }, []);

  // --- Choose destination + compute real OSRM route ---
  const chooseDest = useCallback(async (place: { label: string; lat: number; lng: number }) => {
    const short = place.label.split(',').slice(0, 3).join(', ');
    setDestination(short);
    setDestLabel(short);
    setSearchResults([]);
    setDestCoord({ latitude: place.lat, longitude: place.lng });
    setRouteLoading(true);

    // Real OSRM route
    const fromLng = userCoords.longitude;
    const fromLat = userCoords.latitude;
    const toLng = place.lng;
    const toLat = place.lat;
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&alternatives=false&steps=false`;

    try {
      const res = await fetch(osrmUrl);
      const data = await res.json();

      if (data?.code === 'Ok' && data.routes?.length) {
        const route = data.routes[0];
        const km = route.distance / 1000;
        const minutes = route.duration / 60;
        const coords = route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
          latitude: lat,
          longitude: lng,
        }));

        setRouteKm(km);
        setRouteMin(minutes);
        setRouteCoords(coords);
        setPrice(computePrice(km, minutes, tier, pet, promo));

        mapRef.current?.fitToCoordinates(
          [{ latitude: fromLat, longitude: fromLng }, { latitude: toLat, longitude: toLng }],
          { edgePadding: { top: 80, right: 40, bottom: 320, left: 40 }, animated: true }
        );

        showToast(`Ruta: ${km.toFixed(1)} km · ${Math.round(minutes)} min`);

        if (km > 50) showToast('Ojo: excede 50 km (demo limita por carga)');
      } else {
        throw new Error('No route');
      }
    } catch {
      // Fallback: estimated
      // Straight-line estimate
      const dLat = (toLat - fromLat) * Math.PI / 180;
      const dLng = (toLng - fromLng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(fromLat*Math.PI/180)*Math.cos(toLat*Math.PI/180)*Math.sin(dLng/2)**2;
      const km = 2 * 6371 * Math.asin(Math.sqrt(a)) * 1.3;
      const minutes = km * 2.5 + 5;
      setRouteKm(km);
      setRouteMin(minutes);
      setRouteCoords([
        { latitude: fromLat, longitude: fromLng },
        { latitude: toLat, longitude: toLng },
      ]);
      setPrice(computePrice(km, minutes, tier, pet, promo));
      showToast('Ruta estimada (OSRM no disponible)');
    }

    setRouteLoading(false);
  }, [userCoords, tier, pet, promo]);

  // --- Request driver ---
  const [activeRideId, setActiveRideId] = useState<string | null>(null);

  const ridePollerRef = useRef<ReturnType<typeof setInterval>>(undefined);

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

      // Show nearest driver info while waiting
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

    // Poll for driver acceptance every 3 seconds
    let pollCount = 0;
    if (ridePollerRef.current) clearInterval(ridePollerRef.current);

    ridePollerRef.current = setInterval(async () => {
      pollCount++;
      setTripProgress(10 + Math.min(pollCount * 3, 25));

      try {
        const active = await ridesApi.active();
        if (active.ride) {
          const r = active.ride;
          const d = r.driver;

          // Update driver info if available
          if (d) {
            setDriverName(`${d.user?.name || 'Conductor'} · ${d.rating?.toFixed(1) || '5.0'} ★`);
            setDriverCar(`${d.carModel} · ${d.plate} · Bat ${d.battery}%`);
            setDriverCoord({ latitude: d.lat, longitude: d.lng });
          }

          // React to status changes from the driver
          if (r.status === 'ASSIGNED' && tripStatusRef.current === 'searching') {
            setTripStatus('assigned');
            setTripProgress(35);
            setDriverEta(`ETA ${Math.max(2, Math.round((0.5) / 0.45))} min`);
            showToast(`${d?.user?.name || 'Conductor'} aceptó tu viaje`);
          }
          if (r.status === 'PICKUP' && tripStatusRef.current !== 'pickup' && tripStatusRef.current !== 'ontrip' && tripStatusRef.current !== 'completed') {
            setTripStatus('pickup');
            setDriverEta('Aquí');
            setTripProgress(60);
            showToast('Tu conductor ya llegó');
          }
          if (r.status === 'ONTRIP' && tripStatusRef.current !== 'ontrip' && tripStatusRef.current !== 'completed') {
            setTripStatus('ontrip');
            setTripProgress(80);
            showToast('Viaje en curso');
          }
          if (r.status === 'COMPLETED' && tripStatusRef.current !== 'completed') {
            clearInterval(ridePollerRef.current!);
            ridePollerRef.current = undefined;
            setTripStatus('completed');
            setTripProgress(100);
            showToast('¡Llegaste!');
            setTimeout(() => setRatingVisible(true), 800);
          }
          if (r.status === 'CANCELLED') {
            clearInterval(ridePollerRef.current!);
            ridePollerRef.current = undefined;
            setTripStatus('idle');
            setSheetView('ride');
            showToast('El viaje fue cancelado');
          }
        }

        // Timeout after 90 seconds without assignment
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
  }, [destCoord, userCoords, origin, destLabel, service, tier, pet, promo, payment, routeKm, routeMin, price]);

  // --- Cancel trip ---
  const cancelTrip = useCallback(async () => {
    if (ridePollerRef.current) { clearInterval(ridePollerRef.current); ridePollerRef.current = undefined; }
    if (pickupIntervalRef.current) { clearInterval(pickupIntervalRef.current); pickupIntervalRef.current = undefined; }
    if (rideIntervalRef.current) { clearInterval(rideIntervalRef.current); rideIntervalRef.current = undefined; }
    if (activeRideId) {
      try { await ridesApi.cancel(activeRideId); } catch { /* silent */ }
    }
    setTripStatus('idle');
    setTripProgress(0);
    setDriverCoord(null);
    setActiveRideId(null);
    setSheetView('ride');
    showToast('Viaje cancelado');
  }, [activeRideId]);

  // --- Reset ---
  const resetAll = useCallback(() => {
    if (ridePollerRef.current) { clearInterval(ridePollerRef.current); ridePollerRef.current = undefined; }
    if (pickupIntervalRef.current) { clearInterval(pickupIntervalRef.current); pickupIntervalRef.current = undefined; }
    if (rideIntervalRef.current) { clearInterval(rideIntervalRef.current); rideIntervalRef.current = undefined; }
    setService('ride'); setWhen('now'); setTier('economy');
    setPet(false); setPromo(false); setPayment('Tarjeta **** 4242');
    setDestination(''); setDestLabel(''); setRouteKm(null); setRouteMin(null);
    setRouteCoords([]); setPrice(null); setDestCoord(null);
    setTripStatus('idle'); setTripProgress(0); setDriverCoord(null);
    setStars(0); setSelectedTip(0);
    setSheetView('services');
    mapRef.current?.animateToRegion({ ...userCoords, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 500);
  }, [userCoords]);

  // --- Payment cycle ---
  const cyclePayment = useCallback(() => {
    const opts = ['Tarjeta **** 4242', 'Efectivo', 'Wallet EcoMove'];
    const idx = (opts.indexOf(payment) + 1) % opts.length;
    setPayment(opts[idx]);
    showToast(`Pago: ${opts[idx]}`);
  }, [payment]);

  // --- Use my location ---
  const centerOnUser = useCallback((coords: { latitude: number; longitude: number }) => {
    const region = { ...coords, latitudeDelta: 0.008, longitudeDelta: 0.008 };
    mapRef.current?.animateToRegion(region, 600);
    // Web: also sync marker immediately
    if (Platform.OS === 'web') {
      mapRef.current?.setMarker?.('user', coords.latitude, coords.longitude, 'user');
    }
  }, []);

  const useMyLocation = useCallback(async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserCoords(coords);
      setOrigin('Mi ubicación');
      setGpsStatus('ok');
      centerOnUser(coords);
      showToast('Ubicación actualizada');
    } catch {
      showToast('No se pudo obtener ubicación');
    }
  }, [centerOnUser]);

  // --- Trip status text helpers ---
  const tripTitleMap: Record<TripStatus, string> = {
    idle: 'Viaje',
    searching: 'Buscando conductor...',
    assigned: 'Conductor asignado',
    pickup: 'Conductor llegó',
    ontrip: 'En viaje',
    completed: 'Viaje finalizado',
  };
  const tripSubMap: Record<TripStatus, string> = {
    idle: '',
    searching: 'Asignación inteligente',
    assigned: 'Va en camino a tu ubicación',
    pickup: 'Puedes iniciar el viaje',
    ontrip: 'Rumbo al destino',
    completed: 'Gracias por usar EcoMove',
  };
  const tripStateMap: Record<TripStatus, string> = {
    idle: '—',
    searching: 'Matching',
    assigned: 'En camino (pickup)',
    pickup: 'Pickup completado',
    ontrip: 'En progreso',
    completed: 'Completado',
  };

  return (
    <View style={styles.container}>
      {/* Header */}
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
        <Fab icon="my-location" onPress={() => centerOnUser(userCoords)} />
        <Fab icon="tune" onPress={() => setQuickMenuVisible(true)} />
        <Fab icon="sos" color={Colors.danger} onPress={() => showToast('Emergencia: notificando contacto + 911 (demo)')} />
      </View>

      {/* ===== SHEET: Services ===== */}
      {sheetView === 'services' && (
        <Sheet>
          <SheetHeader title="¿Qué necesitas hoy?" subtitle="Servicios de movilidad eléctrica" actionIcon="restart-alt" onAction={resetAll} />
          <View style={styles.grid2}>
            <ServiceCard icon="electric-car" title="Viaje" subtitle="Ruta + conductor + pago" selected={service === 'ride'} onPress={() => setService('ride')} />
            <ServiceCard icon="restaurant" title="Comida" subtitle="Pedidos (simulación)" selected={service === 'food'} onPress={() => setService('food')} />
            <ServiceCard icon="shopping-cart" title="Despensa" subtitle="Entrega (simulación)" selected={service === 'market'} onPress={() => setService('market')} />
            <ServiceCard icon="local-shipping" title="Paquetes" subtitle="Envío (simulación)" selected={service === 'pack'} onPress={() => setService('pack')} />
          </View>
          <View style={styles.btnRow}>
            <EcoButton title="Continuar" icon="arrow-forward" onPress={() => { setSheetView('ride'); if (service !== 'ride') showToast('Servicio en simulación, pero con flujo completo'); }} style={{ flex: 1 }} />
            <EcoButton title="Cupones" icon="sell" variant="ghost" onPress={() => showToast('Cupones: demo (simulado)')} style={{ flex: 1 }} />
          </View>
        </Sheet>
      )}

      {/* ===== SHEET: Ride Request ===== */}
      {sheetView === 'ride' && (
        <Sheet>
          <SheetHeader title={SERVICE_INFO[service].reqTitle} subtitle={SERVICE_INFO[service].reqSub} actionIcon="close" onAction={() => setSheetView('services')} />

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

          <View style={styles.btnRow}>
            <EcoButton title="Agregar parada" icon="add-road" variant="ghost" onPress={() => showToast('Parada agregada (demo)')} style={{ flex: 1 }} />
            <EcoButton title="Cambiar origen" icon="edit-location-alt" variant="ghost" onPress={useMyLocation} style={{ flex: 1 }} />
          </View>

          <Divider />

          {/* Fare Card */}
          <RideCard>
            <View style={styles.topRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.strong}>{tierTitles[tier]} · Estimación</Text>
                <Text style={styles.mini}>
                  {routeLoading ? 'Calculando ruta...' : !destCoord ? 'Ingresa un destino para calcular' : `Ruta calculada · listo para solicitar`}
                </Text>
              </View>
              <Badge text={price ? formatMXN(price) : '—'} />
            </View>
            <KVRow label="Distancia" value={routeKm ? `${routeKm.toFixed(1)} km` : '—'} />
            <KVRow label="Tiempo (ETA)" value={routeMin ? `${Math.round(routeMin)} min` : '—'} />
            <KVRow label="Rango eléctrico" value="≤ 50 km" />
            <KVRow label="Pago" value={payment} />
            {promo && <KVRow label="Promo" value="ECO10 (-10%)" />}
            <View style={styles.btnRow}>
              <EcoButton title="Método" icon="credit-card" variant="ghost" onPress={cyclePayment} style={{ flex: 1 }} />
              <EcoButton title={promo ? 'Quitar promo' : 'Promo'} icon="sell" variant="ghost" onPress={() => { setPromo(!promo); showToast(!promo ? 'Cupón ECO10 aplicado (-10%)' : 'Cupón removido'); }} style={{ flex: 1 }} />
            </View>
          </RideCard>

          <EcoButton title="Solicitar" icon="search" onPress={requestDriver} disabled={!destCoord || routeLoading} loading={routeLoading} />

          <View style={styles.btnRow}>
            <EcoButton title="Compartir" icon="share" variant="ghost" onPress={() => showToast('Link de viaje copiado (demo)')} style={{ flex: 1 }} />
            <EcoButton title="Términos" icon="policy" variant="ghost" onPress={() => showToast('Términos y condiciones (demo)')} style={{ flex: 1 }} />
          </View>
        </Sheet>
      )}

      {/* ===== SHEET: Trip ===== */}
      {sheetView === 'trip' && (
        <Sheet>
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

            <View style={styles.btnRow}>
              <EcoButton title="Chat" icon="chat" variant="ghost" onPress={() => showToast('Chat con conductor (demo)')} style={{ flex: 1 }} />
              <EcoButton title="Llamar" icon="call" variant="ghost" onPress={() => showToast('Llamando conductor (demo)')} style={{ flex: 1 }} />
            </View>

            <View style={styles.btnRow}>
              <EcoButton title="Cambiar destino" icon="swap-horiz" variant="ghost" onPress={() => showToast('Cambiar destino (demo)')} style={{ flex: 1 }} disabled={tripStatus === 'searching' || tripStatus === 'completed'} />
              <EcoButton title="Dividir pago" icon="groups" variant="ghost" onPress={() => showToast('Invitación enviada (demo)')} style={{ flex: 1 }} />
            </View>
          </RideCard>

          <View style={styles.btnRow}>
            {tripStatus === 'completed' ? (
              <EcoButton title="Nuevo viaje" icon="restart-alt" onPress={resetAll} style={{ flex: 1 }} />
            ) : (
              <EcoButton title="Cancelar viaje" icon="cancel" variant="danger" onPress={cancelTrip} style={{ flex: 1 }} />
            )}
          </View>

          {tripStatus !== 'completed' && (
            <View style={styles.btnRow}>
              <EcoButton title="Compartir en vivo" icon="share-location" variant="ghost" onPress={() => showToast('Link de tracking compartido (demo)')} style={{ flex: 1 }} />
              <EcoButton title="Reportar" icon="report" variant="ghost" onPress={() => showToast('Reporte enviado a soporte (demo)')} style={{ flex: 1, backgroundColor: Colors.warn, borderColor: Colors.warn }} />
            </View>
          )}
        </Sheet>
      )}

      {/* ===== Modal: Quick menu ===== */}
      <BottomModal visible={quickMenuVisible} onClose={() => setQuickMenuVisible(false)} title="Opciones rápidas" subtitle="Acciones de tu cuenta">
        <View style={styles.btnRow}>
          <EcoButton title="Historial" icon="history" variant="ghost" onPress={() => showToast('Historial de viajes (demo)')} style={{ flex: 1 }} />
          <EcoButton title="Soporte" icon="support-agent" variant="ghost" onPress={() => showToast('Soporte al cliente (demo)')} style={{ flex: 1 }} />
        </View>
        <View style={styles.btnRow}>
          <EcoButton title="Preferencias" icon="settings" variant="ghost" onPress={() => showToast('Preferencias (demo)')} style={{ flex: 1 }} />
          <EcoButton title="Cuenta" icon="person" variant="ghost" onPress={() => showToast('Mi cuenta (demo)')} style={{ flex: 1 }} />
        </View>
        <EcoButton title="Cerrar sesión" icon="logout" variant="danger" onPress={() => { setQuickMenuVisible(false); handleLogout(); }} />
        <View style={{ height: 8 }} />
        <EcoButton title="Listo" icon="done" onPress={() => setQuickMenuVisible(false)} />
      </BottomModal>

      {/* ===== Modal: Rating ===== */}
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
            <Chip key={amount} label={amount === 0 ? '$0' : `+ ${formatMXN(amount)}`} selected={selectedTip === amount} onPress={() => { setSelectedTip(amount); }} />
          ))}
        </ChipRow>

        <View style={styles.btnRow}>
          <EcoButton title="Comentario" icon="edit" variant="ghost" onPress={() => showToast('Comentario enviado (demo)')} style={{ flex: 1 }} />
          <EcoButton title="Objeto perdido" icon="inventory-2" variant="ghost" onPress={() => showToast('Reporte de objeto perdido (demo)')} style={{ flex: 1 }} />
        </View>

        <EcoButton title={`Enviar${stars > 0 ? ` · ${stars}★` : ''}${selectedTip > 0 ? ` · Propina ${formatMXN(selectedTip)}` : ''}`} icon="done" onPress={async () => {
          if (activeRideId) {
            try {
              await ridesApi.rate(activeRideId, { stars: stars || 5, tip: selectedTip });
            } catch { /* silent */ }
          }
          showToast(`Gracias. ${stars > 0 ? `${stars}★` : 'Sin calificación'}${selectedTip > 0 ? ` · Propina ${formatMXN(selectedTip)}` : ''}`);
          setRatingVisible(false);
          resetAll();
        }} />
      </BottomModal>

      <Toast />
    </View>
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
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
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
});
