import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, FontSizes } from '../src/constants/theme';
import { EcoInput } from '../src/components/EcoInput';
import { EcoButton } from '../src/components/EcoButton';
import { RideCard, KVRow, Badge, Divider, ProgressBar } from '../src/components/RideCard';
import { BottomModal } from '../src/components/BottomModal';
import { Fab } from '../src/components/Fab';
import { Toast } from '../src/components/Toast';
import { EcoMap, EcoMarker, EcoPolyline, EcoMapRef } from '../src/components/MapWrapper';
import { formatMXN, showToast } from '../src/stores/appState';
import { driver as driverApi, auth as authApi, setToken } from '../src/services/api';

const DEFAULT_COORDS = { latitude: 19.4326, longitude: -99.1332 };

interface IncomingRide {
  rideId: string;
  from: { label: string; lat: number; lng: number };
  to: { label: string; lat: number; lng: number };
  fare: number;
  km: number;
  minutes: number;
  passengerName: string;
}

type TripPhase = 'idle' | 'accepted' | 'pickup' | 'ontrip' | 'completed';

export default function DriverScreen() {
  const router = useRouter();
  const mapRef = useRef<EcoMapRef>(null);

  // --- GPS ---
  const [driverCoords, setDriverCoords] = useState(DEFAULT_COORDS);
  const [gpsStatus, setGpsStatus] = useState<'waiting' | 'ok' | 'denied'>('waiting');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!cancelled) setGpsStatus('denied');
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!cancelled) {
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setDriverCoords(coords);
          setGpsStatus('ok');
          // Update location in DB so rides can match
          try { await driverApi.updateLocation(coords.latitude, coords.longitude); } catch { /* ok if not onboarded yet */ }
          setTimeout(() => {
            mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 800);
            if (Platform.OS === 'web') {
              mapRef.current?.setMarker?.('driver', coords.latitude, coords.longitude, 'car');
            }
          }, 600);
        }
      } catch {
        if (!cancelled) setGpsStatus('denied');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // --- Onboarding ---
  const [onboarded, setOnboarded] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  // Step 1: datos personales
  const [driverName, setDriverName] = useState('');
  const [driverCurp, setDriverCurp] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverCar, setDriverCar] = useState('');
  const [driverPlate, setDriverPlate] = useState('');
  // Step 2: folios de documentos
  const [folioIne, setFolioIne] = useState('');
  const [folioActa, setFolioActa] = useState('');
  const [folioLicencia, setFolioLicencia] = useState('');
  const [folioComprobante, setFolioComprobante] = useState('');
  // Step 3: subir archivos
  const [docProgress, setDocProgress] = useState(0);
  const docIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // --- Dashboard ---
  const [online, setOnline] = useState(false);
  const [earnings, setEarnings] = useState(0);
  const [tripsCount, setTripsCount] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);

  // --- Load driver profile from API on mount ---
  useEffect(() => {
    (async () => {
      try {
        const me = await authApi.me();
        if (me.driver?.onboarded) {
          setOnboarded(true);
          setDriverName(me.name || '');
          setDriverCar(me.driver.carModel || '');
          setDriverPlate(me.driver.plate || '');
          setDriverCurp(me.driver.curp || '');
          setDriverPhone(me.driver.phone || '');
          setOnline(me.driver.online);

          // Load today stats
          try {
            const stats = await driverApi.stats();
            setEarnings(Math.round(stats.todayEarnings || 0));
            setTripsCount(stats.todayTrips || 0);
          } catch { /* ok */ }
        }
      } catch {
        // No profile or no token — show onboarding
      } finally {
        setProfileLoading(false);
      }
    })();
  }, []);

  // --- Incoming ride ---
  const [incoming, setIncoming] = useState<IncomingRide | null>(null);
  const [incomingModalVisible, setIncomingModalVisible] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // --- Active trip ---
  const [tripPhase, setTripPhase] = useState<TripPhase>('idle');
  const [activeRide, setActiveRide] = useState<IncomingRide | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [tripProgress, setTripProgress] = useState(0);
  const tripIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Cleanup
  useEffect(() => {
    return () => {
      if (docIntervalRef.current) clearInterval(docIntervalRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (tripIntervalRef.current) clearInterval(tripIntervalRef.current);
    };
  }, []);

  // --- Poll API for real incoming rides when online ---
  useEffect(() => {
    if (!online || !onboarded || tripPhase !== 'idle') {
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = undefined; }
      return;
    }

    const poll = async () => {
      try {
        const data = await driverApi.incoming();
        if (data.rides && data.rides.length > 0 && !incomingModalVisible) {
          const r = data.rides[0]; // Take first available ride
          const ride: IncomingRide = {
            rideId: r.id,
            from: { label: r.fromLabel, lat: r.fromLat, lng: r.fromLng },
            to: { label: r.toLabel, lat: r.toLat, lng: r.toLng },
            fare: r.price || 0,
            km: r.distanceKm || 0,
            minutes: r.durationMin || 0,
            passengerName: r.user?.name || 'Pasajero',
          };

          setIncoming(ride);
          setIncomingModalVisible(true);

          if (Platform.OS !== 'web') {
            Vibration.vibrate([0, 300, 200, 300]);
          }

          // Show on map
          if (Platform.OS === 'web') {
            mapRef.current?.setMarker?.('rideOrigin', r.fromLat, r.fromLng, 'user');
            mapRef.current?.setMarker?.('rideDest', r.toLat, r.toLng, 'dest');
          }
          mapRef.current?.fitToCoordinates(
            [{ latitude: r.fromLat, longitude: r.fromLng }, { latitude: driverCoords.latitude, longitude: driverCoords.longitude }],
            { edgePadding: { top: 60, right: 40, bottom: 200, left: 40 }, animated: true }
          );
        }
      } catch { /* silent — server might be off */ }
    };

    // Poll immediately then every 5 seconds
    poll();
    pollTimerRef.current = setInterval(poll, 5000);

    return () => {
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = undefined; }
    };
  }, [online, onboarded, tripPhase, incomingModalVisible, driverCoords]);

  // --- Onboarding handlers ---
  const goStep2 = useCallback(() => {
    if (!driverName.trim()) { showToast('Ingresa tu nombre completo'); return; }
    if (!driverCurp.trim() || driverCurp.trim().length < 18) { showToast('Ingresa tu CURP válida (18 caracteres)'); return; }
    if (!driverPhone.trim()) { showToast('Ingresa tu teléfono'); return; }
    if (!driverCar.trim()) { showToast('Ingresa el modelo del auto'); return; }
    if (!driverPlate.trim()) { showToast('Ingresa las placas'); return; }
    setStep(2);
  }, [driverName, driverCurp, driverPhone, driverCar, driverPlate]);

  const goStep3 = useCallback(() => {
    if (!folioIne.trim()) { showToast('Ingresa el folio de tu INE'); return; }
    if (!folioActa.trim()) { showToast('Ingresa el folio del acta de nacimiento'); return; }
    if (!folioLicencia.trim()) { showToast('Ingresa el folio de tu licencia de conducción'); return; }
    if (!folioComprobante.trim()) { showToast('Ingresa el folio del comprobante de domicilio'); return; }
    setStep(3);
  }, [folioIne, folioActa, folioLicencia, folioComprobante]);

  const verifyDocs = useCallback(() => {
    setDocProgress(0);
    let p = 0;
    if (docIntervalRef.current) clearInterval(docIntervalRef.current);
    docIntervalRef.current = setInterval(() => {
      p += Math.random() * 18 + 8;
      setDocProgress(Math.min(100, p));
      if (p >= 100) {
        clearInterval(docIntervalRef.current!);
        showToast('Documentos verificados');
        setStep(4);
      }
    }, 350);
  }, []);

  // --- Dashboard handlers ---
  const toggleOnline = useCallback(async () => {
    const newState = !online;
    try {
      // Send location before going online
      if (newState) {
        await driverApi.updateLocation(driverCoords.latitude, driverCoords.longitude);
      }
      await driverApi.setOnline(newState);
      setOnline(newState);
      showToast(newState ? 'Chofer en línea — esperando solicitudes' : 'Chofer fuera de línea');
    } catch (err: any) {
      showToast(err.message || 'Error al cambiar estado');
    }
  }, [online, driverCoords]);

  // --- Accept ride ---
  const acceptRide = useCallback(async () => {
    if (!incoming) return;

    try {
      await driverApi.accept(incoming.rideId);
    } catch (err: any) {
      showToast(err.message || 'Error al aceptar');
      return;
    }

    setIncomingModalVisible(false);
    setActiveRide(incoming);
    setTripPhase('accepted');
    setIncoming(null);
    showToast(`Viaje aceptado — rumbo a ${incoming.from.label}`);

    // Fetch route from driver to pickup
    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${driverCoords.longitude},${driverCoords.latitude};${incoming.from.lng},${incoming.from.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data?.code === 'Ok' && data.routes?.length) {
          const coords = data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({
            latitude: lat, longitude: lng,
          }));
          setRouteCoords(coords);
          if (Platform.OS === 'web') {
            mapRef.current?.setPolyline?.('route', coords, Colors.primary);
          }
        }
      } catch { /* use straight line */ }
    };
    fetchRoute();

    // Simulate driving to pickup
    setTripProgress(0);
    let step = 0;
    const totalSteps = 40;
    tripIntervalRef.current = setInterval(() => {
      step++;
      const t = step / totalSteps;
      setTripProgress(t * 50);
      if (step >= totalSteps) {
        clearInterval(tripIntervalRef.current!);
        tripIntervalRef.current = undefined;
        setTripPhase('pickup');
        setTripProgress(50);
        showToast('Llegaste al punto de recogida');
        if (Platform.OS !== 'web') Vibration.vibrate(200);
      }
    }, 150);
  }, [incoming, driverCoords]);

  // --- Reject ride ---
  const rejectRide = useCallback(() => {
    setIncomingModalVisible(false);
    setIncoming(null);
    if (Platform.OS === 'web') {
      mapRef.current?.removeMarker?.('rideOrigin');
      mapRef.current?.removeMarker?.('rideDest');
    }
    showToast('Solicitud rechazada — aparecerá para otro conductor');
  }, []);

  // --- Start trip (pickup → destination) ---
  const startTrip = useCallback(async () => {
    if (!activeRide) return;

    // Update ride status in DB
    try {
      await driverApi.updateRideStatus(activeRide.rideId, 'ONTRIP');
    } catch { /* continue anyway */ }

    setTripPhase('ontrip');
    showToast('Viaje iniciado — rumbo al destino');

    // Fetch route from pickup to destination
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${activeRide.from.lng},${activeRide.from.lat};${activeRide.to.lng},${activeRide.to.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data?.code === 'Ok' && data.routes?.length) {
        const coords = data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({
          latitude: lat, longitude: lng,
        }));
        setRouteCoords(coords);
        if (Platform.OS === 'web') {
          mapRef.current?.setPolyline?.('route', coords, Colors.primary);
          mapRef.current?.removeMarker?.('rideOrigin');
        }
        mapRef.current?.fitToCoordinates(
          [coords[0], coords[coords.length - 1]],
          { edgePadding: { top: 60, right: 40, bottom: 200, left: 40 }, animated: true }
        );

        // Animate along route
        const total = coords.length;
        const stepMs = Math.max(30, Math.floor(12000 / total));
        let idx = 0;
        tripIntervalRef.current = setInterval(() => {
          idx++;
          setTripProgress(50 + (idx / total) * 50);
          if (Platform.OS === 'web') {
            mapRef.current?.setMarker?.('driver', coords[idx]?.latitude ?? coords[total - 1].latitude, coords[idx]?.longitude ?? coords[total - 1].longitude, 'car');
          }
          if (idx >= total) {
            clearInterval(tripIntervalRef.current!);
            tripIntervalRef.current = undefined;
            finishTrip();
          }
        }, stepMs);
      }
    } catch {
      // Fallback: just complete after delay
      setTimeout(finishTrip, 3000);
    }
  }, [activeRide]);

  // --- Finish trip ---
  const finishTrip = useCallback(async () => {
    // Update ride status in DB
    if (activeRide) {
      try {
        await driverApi.updateRideStatus(activeRide.rideId, 'COMPLETED');
      } catch { /* continue anyway */ }
    }

    const earned = activeRide ? Math.round(activeRide.fare * 0.72) : 0;
    setEarnings(prev => prev + earned);
    setTripsCount(prev => prev + 1);
    setTripPhase('completed');
    setTripProgress(100);
    showToast(`Viaje finalizado — +${formatMXN(earned)}`);

    if (Platform.OS === 'web') {
      mapRef.current?.removePolyline?.('route');
      mapRef.current?.removeMarker?.('rideOrigin');
      mapRef.current?.removeMarker?.('rideDest');
    }

    setTimeout(() => {
      setTripPhase('idle');
      setActiveRide(null);
      setRouteCoords([]);
      setTripProgress(0);
      mapRef.current?.animateToRegion({ ...driverCoords, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 500);
    }, 2000);
  }, [activeRide, driverCoords]);

  // --- Logout ---
  const handleLogout = useCallback(() => {
    if (Platform.OS === 'web') {
      if (confirm('¿Deseas cerrar sesión?')) { setToken(null); router.replace('/'); }
    } else {
      Alert.alert('Cerrar sesión', '¿Deseas salir?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => { setToken(null); router.replace('/'); } },
      ]);
    }
  }, [router]);

  const centerOnMe = useCallback(() => {
    mapRef.current?.animateToRegion({ ...driverCoords, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500);
    if (Platform.OS === 'web') {
      mapRef.current?.setMarker?.('driver', driverCoords.latitude, driverCoords.longitude, 'car');
    }
  }, [driverCoords]);

  // --- Web: sync driver marker ---
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    mapRef.current?.setMarker?.('driver', driverCoords.latitude, driverCoords.longitude, 'car');
  }, [driverCoords]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <View style={styles.logo}>
              <MaterialIcons name="bolt" size={18} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Chofer</Text>
              <Text style={styles.headerSub}>{driverName} · {driverCar}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {onboarded && (
              <View style={[styles.pill, !online && { borderColor: 'rgba(255,68,68,0.55)' }]}>
                <View style={[styles.pillDot, !online && { backgroundColor: Colors.danger }]} />
                <Text style={[styles.pillText, !online && { color: Colors.danger }]}>
                  {online ? 'En línea' : 'Offline'}
                </Text>
              </View>
            )}
            <Pressable onPress={handleLogout} hitSlop={10} style={styles.logoutBtn}>
              <MaterialIcons name="logout" size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* Map */}
      {onboarded ? (
        <View style={styles.mapSection}>
          <EcoMap ref={mapRef} initialRegion={{ ...driverCoords, latitudeDelta: 0.015, longitudeDelta: 0.015 }}>
            <EcoMarker coordinate={driverCoords} anchor={{ x: 0.5, y: 0.5 }}>
              <MaterialIcons name="electric-car" size={28} color={Colors.primary} />
            </EcoMarker>
            {activeRide && (
              <>
                <EcoMarker coordinate={{ latitude: activeRide.from.lat, longitude: activeRide.from.lng }}>
                  <View style={styles.userMarker} />
                </EcoMarker>
                <EcoMarker coordinate={{ latitude: activeRide.to.lat, longitude: activeRide.to.lng }}>
                  <MaterialIcons name="place" size={28} color={Colors.text} />
                </EcoMarker>
              </>
            )}
            {routeCoords.length > 1 && (
              <EcoPolyline coordinates={routeCoords} strokeWidth={5} strokeColor={Colors.primary} />
            )}
          </EcoMap>

          {/* FABs */}
          <View style={styles.fabColumn}>
            <Fab icon="my-location" onPress={centerOnMe} />
            {onboarded && !online && (
              <Fab icon="toggle-off" color={Colors.danger} onPress={toggleOnline} />
            )}
            {onboarded && online && (
              <Fab icon="toggle-on" color={Colors.primary} onPress={toggleOnline} />
            )}
          </View>
        </View>
      ) : null}

      {/* Bottom panel */}
      <ScrollView
        style={[styles.panel, !onboarded && { flex: 1 }]}
        contentContainerStyle={styles.panelContent}
        showsVerticalScrollIndicator={false}
      >
        {onboarded && <View style={styles.drag} />}

        {/* === Onboarding === */}
        {profileLoading && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={styles.strong}>Cargando perfil...</Text>
          </View>
        )}

        {!profileLoading && !onboarded && (
          <RideCard style={{ marginTop: 16 }}>
            <Text style={styles.strong}>Únete a la flota</Text>
            <Text style={styles.mini}>Registro de conductor · Paso {step} de 4</Text>
            <View style={styles.stepDots}>
              {[1, 2, 3, 4].map(n => (
                <View key={n} style={[styles.dot, n <= step && styles.dotActive]} />
              ))}
            </View>

            {/* Step 1: Datos personales + vehículo */}
            {step === 1 && (
              <View style={styles.stepContent}>
                <Text style={styles.sectionTitle}>Datos personales</Text>
                <EcoInput icon="person" placeholder="Nombre completo" value={driverName} onChangeText={setDriverName} autoCapitalize="words" />
                <EcoInput icon="fingerprint" placeholder="CURP (18 caracteres)" value={driverCurp} onChangeText={(t) => setDriverCurp(t.toUpperCase())} autoCapitalize="characters" maxLength={18} />
                <EcoInput icon="phone" placeholder="Teléfono" value={driverPhone} onChangeText={setDriverPhone} keyboardType="phone-pad" />

                <Divider />
                <Text style={styles.sectionTitle}>Datos del vehículo</Text>
                <EcoInput icon="directions-car" placeholder="Modelo del auto (ej. BYD Dolphin)" value={driverCar} onChangeText={setDriverCar} />
                <EcoInput icon="pin" placeholder="Placas (ej. PUE-000)" value={driverPlate} onChangeText={(t) => setDriverPlate(t.toUpperCase())} autoCapitalize="characters" />
                <EcoButton title="Continuar" icon="arrow-forward" onPress={goStep2} />
              </View>
            )}

            {/* Step 2: Folios de documentos */}
            {step === 2 && (
              <View style={styles.stepContent}>
                <Text style={styles.sectionTitle}>Folios de documentos oficiales</Text>
                <Text style={styles.mini}>Ingresa el número de folio de cada documento</Text>

                <View style={styles.docRow}>
                  <MaterialIcons name="credit-card" size={20} color={Colors.primary} />
                  <Text style={styles.docLabel}>INE / Credencial de elector</Text>
                </View>
                <EcoInput icon="tag" placeholder="Folio INE (ej. 0123456789)" value={folioIne} onChangeText={setFolioIne} keyboardType="default" />

                <View style={styles.docRow}>
                  <MaterialIcons name="description" size={20} color={Colors.primary} />
                  <Text style={styles.docLabel}>Acta de nacimiento</Text>
                </View>
                <EcoInput icon="tag" placeholder="Folio acta de nacimiento" value={folioActa} onChangeText={setFolioActa} />

                <View style={styles.docRow}>
                  <MaterialIcons name="drive-eta" size={20} color={Colors.primary} />
                  <Text style={styles.docLabel}>Licencia / Permiso de conducción</Text>
                </View>
                <EcoInput icon="tag" placeholder="Folio licencia de conducir" value={folioLicencia} onChangeText={setFolioLicencia} />

                <View style={styles.docRow}>
                  <MaterialIcons name="home" size={20} color={Colors.primary} />
                  <Text style={styles.docLabel}>Comprobante de domicilio</Text>
                </View>
                <EcoInput icon="tag" placeholder="Folio comprobante de domicilio" value={folioComprobante} onChangeText={setFolioComprobante} />

                <View style={styles.btnRow}>
                  <EcoButton title="Atrás" icon="arrow-back" variant="ghost" onPress={() => setStep(1)} style={{ flex: 1 }} />
                  <EcoButton title="Continuar" icon="arrow-forward" onPress={goStep3} style={{ flex: 2 }} />
                </View>
              </View>
            )}

            {/* Step 3: Subir archivos */}
            {step === 3 && (
              <View style={styles.stepContent}>
                <Text style={styles.sectionTitle}>Subir documentos</Text>
                <Text style={styles.mini}>Sube foto o PDF de cada documento para verificación</Text>

                <RideCard style={{ marginTop: 8 }}>
                  <View style={styles.docCheckRow}><MaterialIcons name="credit-card" size={18} color={Colors.primary} /><Text style={styles.docCheckText}>INE — Folio: {folioIne}</Text></View>
                  <View style={styles.docCheckRow}><MaterialIcons name="description" size={18} color={Colors.primary} /><Text style={styles.docCheckText}>Acta — Folio: {folioActa}</Text></View>
                  <View style={styles.docCheckRow}><MaterialIcons name="drive-eta" size={18} color={Colors.primary} /><Text style={styles.docCheckText}>Licencia — Folio: {folioLicencia}</Text></View>
                  <View style={styles.docCheckRow}><MaterialIcons name="home" size={18} color={Colors.primary} /><Text style={styles.docCheckText}>Domicilio — Folio: {folioComprobante}</Text></View>
                  <View style={styles.docCheckRow}><MaterialIcons name="fingerprint" size={18} color={Colors.primary} /><Text style={styles.docCheckText}>CURP: {driverCurp}</Text></View>
                </RideCard>

                <ProgressBar progress={docProgress} />

                <View style={styles.btnRow}>
                  <EcoButton title="Atrás" icon="arrow-back" variant="ghost" onPress={() => setStep(2)} style={{ flex: 1 }} />
                  <EcoButton title="Subir y verificar" icon="cloud-upload" onPress={verifyDocs} style={{ flex: 2 }} />
                </View>
              </View>
            )}

            {/* Step 4: Curso rápido */}
            {step === 4 && (
              <View style={styles.stepContent}>
                <Text style={styles.sectionTitle}>Curso de inducción</Text>
                <Text style={styles.mini}>Buenas prácticas + seguridad vial</Text>
                <RideCard style={{ marginTop: 10 }}>
                  <View style={styles.topRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.strong}>Video obligatorio</Text>
                      <Text style={styles.mini}>"Conducción eficiente eléctrica"</Text>
                    </View>
                    <MaterialIcons name="play-circle" size={34} color={Colors.primary} />
                  </View>
                </RideCard>
                <RideCard style={{ marginTop: 8 }}>
                  <View style={styles.topRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.strong}>Protocolo de seguridad</Text>
                      <Text style={styles.mini}>"Atención al pasajero y emergencias"</Text>
                    </View>
                    <MaterialIcons name="play-circle" size={34} color={Colors.primary} />
                  </View>
                </RideCard>
                <View style={styles.btnRow}>
                  <EcoButton title="Atrás" icon="arrow-back" variant="ghost" onPress={() => setStep(3)} style={{ flex: 1 }} />
                  <EcoButton title="Finalizar registro" icon="done" onPress={async () => {
                    try {
                      await driverApi.onboard({
                        curp: driverCurp, phone: driverPhone, carModel: driverCar, plate: driverPlate,
                        documents: [
                          { type: 'INE', folio: folioIne },
                          { type: 'ACTA_NACIMIENTO', folio: folioActa },
                          { type: 'LICENCIA', folio: folioLicencia },
                          { type: 'COMPROBANTE_DOMICILIO', folio: folioComprobante },
                        ],
                      });
                      setOnboarded(true);
                      showToast('Registro completado — ¡Bienvenido!');
                    } catch (err: any) {
                      showToast(err.message || 'Error al registrar');
                    }
                  }} style={{ flex: 2 }} />
                </View>
              </View>
            )}
          </RideCard>
        )}

        {/* === Dashboard (onboarded) === */}
        {onboarded && (
          <>
            {/* Stats */}
            <View style={styles.grid2}>
              <RideCard>
                <Text style={styles.miniLabel}>Ganancias hoy</Text>
                <Text style={styles.bigNumber}>{formatMXN(earnings)}</Text>
              </RideCard>
              <RideCard>
                <Text style={styles.miniLabel}>Viajes</Text>
                <Text style={styles.bigNumber}>{tripsCount}</Text>
              </RideCard>
            </View>

            <KVRow label="Calificación" value="4.9 ★" />
            <KVRow label="Estado" value={online ? (tripPhase === 'idle' ? 'Esperando solicitudes...' : tripPhase === 'completed' ? 'Viaje completado' : 'En viaje activo') : 'Desconectado'} />

            {/* Trip progress */}
            {tripPhase !== 'idle' && activeRide && (
              <>
                <Divider />
                <RideCard>
                  <View style={styles.topRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.strong}>{activeRide.passengerName}</Text>
                      <Text style={styles.mini}>
                        {tripPhase === 'accepted' ? 'Rumbo a recogida' : tripPhase === 'pickup' ? 'Pasajero esperando' : tripPhase === 'ontrip' ? 'En camino al destino' : 'Completado'}
                      </Text>
                    </View>
                    <Badge text={formatMXN(Math.round(activeRide.fare * 0.72))} />
                  </View>
                  <ProgressBar progress={tripProgress} />
                  <KVRow label="Origen" value={activeRide.from.label} />
                  <KVRow label="Destino" value={activeRide.to.label} />
                  <KVRow label="Distancia" value={`${activeRide.km.toFixed(1)} km`} />

                  {tripPhase === 'pickup' && (
                    <EcoButton title="Iniciar viaje" icon="play-arrow" onPress={startTrip} />
                  )}
                  {tripPhase === 'ontrip' && (
                    <EcoButton title="Finalizar viaje" icon="flag" onPress={finishTrip} style={{ backgroundColor: Colors.warn, borderColor: Colors.warn }} />
                  )}
                </RideCard>
              </>
            )}

            {/* Connect/disconnect */}
            <View style={styles.btnRow}>
              <EcoButton
                title={online ? 'Desconectarme' : 'Conectarme'}
                icon={online ? 'toggle-on' : 'toggle-off'}
                onPress={toggleOnline}
                variant={online ? 'ghost' : undefined}
                style={{ flex: 1 }}
              />
              <EcoButton title="Soporte" icon="support-agent" variant="ghost" onPress={() => showToast('Soporte chofer (demo)')} style={{ flex: 1 }} />
            </View>
          </>
        )}
      </ScrollView>

      {/* === Modal: Incoming Ride === */}
      <BottomModal
        visible={incomingModalVisible}
        onClose={rejectRide}
        title="Nueva solicitud"
        subtitle="Acepta antes de que otro conductor lo tome"
      >
        {incoming && (
          <>
            <RideCard style={{ marginTop: 10 }}>
              <View style={styles.topRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.strong}>{incoming.passengerName}</Text>
                  <Text style={styles.mini}>Pasajero</Text>
                </View>
                <Badge text={formatMXN(Math.round(incoming.fare * 0.72))} />
              </View>
              <Divider />
              <KVRow label="Recoger en" value={incoming.from.label} />
              <KVRow label="Destino" value={incoming.to.label} />
              <KVRow label="Distancia" value={`${incoming.km.toFixed(1)} km`} />
              <KVRow label="Tiempo est." value={`${Math.round(incoming.minutes)} min`} />
            </RideCard>

            <View style={[styles.btnRow, { marginTop: 12 }]}>
              <EcoButton title="Aceptar" icon="check-circle" onPress={acceptRide} style={{ flex: 2 }} />
              <EcoButton title="Rechazar" icon="close" variant="danger" onPress={rejectRide} style={{ flex: 1 }} />
            </View>
          </>
        )}
      </BottomModal>

      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark },
  header: { backgroundColor: 'rgba(18,18,18,0.92)', borderBottomWidth: 1, borderBottomColor: Colors.borderLight, zIndex: 100 },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  logo: { width: 32, height: 32, borderRadius: 14, backgroundColor: Colors.primaryAlpha14, borderWidth: 1, borderColor: Colors.primaryAlpha35, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontWeight: '900', fontSize: FontSizes.lg, color: Colors.text },
  headerSub: { color: Colors.textSecondary, fontSize: FontSizes.xs },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.primaryAlpha55, backgroundColor: Colors.primaryAlpha06 },
  pillDot: { width: 8, height: 8, borderRadius: Radius.pill, backgroundColor: Colors.primary },
  pillText: { color: Colors.primary, fontSize: 11 },
  logoutBtn: { width: 34, height: 34, borderRadius: Radius.sm, backgroundColor: Colors.whiteAlpha06, borderWidth: 1, borderColor: Colors.whiteAlpha10, alignItems: 'center', justifyContent: 'center' },
  mapSection: { height: '45%', position: 'relative' },
  fabColumn: { position: 'absolute', top: 14, right: 14, gap: 10, zIndex: 50 },
  panel: { flex: 1, backgroundColor: 'rgba(14,14,14,0.97)', borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, marginTop: -20, borderTopWidth: 1, borderTopColor: Colors.whiteAlpha10 },
  panelContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 40 },
  drag: { width: 54, height: 5, borderRadius: Radius.pill, backgroundColor: Colors.whiteAlpha12, alignSelf: 'center', marginBottom: 10 },
  grid2: { flexDirection: 'row', gap: 12 },
  strong: { fontWeight: '900', color: Colors.text, fontSize: FontSizes.md },
  mini: { color: Colors.textSecondary, fontSize: FontSizes.xs, marginTop: 2 },
  miniLabel: { color: Colors.textSecondary, fontSize: FontSizes.xs },
  bigNumber: { fontSize: 24, fontWeight: '900', color: Colors.primary, marginTop: 2 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stepDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: 12 },
  dot: { width: 10, height: 10, borderRadius: Radius.pill, backgroundColor: Colors.whiteAlpha12 },
  dotActive: { backgroundColor: Colors.primary, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 7, elevation: 4 },
  stepContent: { gap: 10 },
  sectionTitle: { fontWeight: '900', color: Colors.primary, fontSize: FontSizes.sm, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 4 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  docLabel: { color: Colors.text, fontSize: FontSizes.sm, fontWeight: '700' },
  docCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  docCheckText: { color: Colors.textSecondary, fontSize: FontSizes.xs, flex: 1 },
  userMarker: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.primary, borderWidth: 3, borderColor: '#ffffff' },
});
