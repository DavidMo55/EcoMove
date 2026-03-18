import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, FontSizes } from '../src/constants/theme';
import { EcoButton } from '../src/components/EcoButton';
import { RideCard, Divider } from '../src/components/RideCard';
import { SheetHeader } from '../src/components/SheetHeader';
import { Toast } from '../src/components/Toast';
import { EcoMap, EcoMarker, EcoMapRef } from '../src/components/MapWrapper';
import { FleetUnit, showToast } from '../src/stores/appState';
import { admin as adminApi } from '../src/services/api';
import { setToken } from '../src/services/api';

const INITIAL_REGION = {
  latitude: 19.4326,
  longitude: -99.1332,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

export default function AdminScreen() {
  const router = useRouter();
  const mapRef = useRef<EcoMapRef>(null);
  const [fleet, setFleet] = useState<FleetUnit[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalDrivers: 0, totalRides: 0, activeVehicles: 0, inShop: 0 });

  // Load fleet from API on mount
  const loadFleet = useCallback(async () => {
    try {
      const data = await adminApi.fleet();
      // Map API vehicle fields to FleetUnit shape
      const mapped: FleetUnit[] = (data.vehicles || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        car: v.car,
        plate: v.plate,
        rating: 4.8,
        bat: v.battery,
        status: v.status as 'ok' | 'low' | 'bad',
        lat: v.lat,
        lng: v.lng,
        locked: v.locked,
      }));
      setFleet(mapped);
    } catch (err: any) {
      showToast(err.message || 'Error cargando flota');
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await adminApi.stats();
      setStats(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadFleet();
    loadStats();
  }, []);

  const activeCount = stats.activeVehicles || fleet.filter(d => d.status === 'ok' && !d.locked).length;
  const shopCount = stats.inShop || fleet.filter(d => d.status === 'bad').length;

  // Web: sync fleet markers to Leaflet
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    fleet.forEach(d => {
      mapRef.current?.setMarker?.(d.id, d.lat, d.lng, 'car');
    });
  }, [fleet]);

  const toggleLock = useCallback(async (id: string) => {
    try {
      await adminApi.lockVehicle(id);
      await loadFleet();
      showToast('Estado actualizado');
    } catch (err: any) { showToast(err.message); }
  }, [loadFleet]);

  const sendToShop = useCallback(async (id: string) => {
    try {
      await adminApi.shopVehicle(id);
      await loadFleet();
      showToast('Enviado a taller');
    } catch (err: any) { showToast(err.message); }
  }, [loadFleet]);

  const recharge = useCallback(async (id: string) => {
    try {
      await adminApi.rechargeVehicle(id);
      await loadFleet();
      showToast('Recargando...');
    } catch (err: any) { showToast(err.message); }
  }, [loadFleet]);

  const centerOn = useCallback((d: FleetUnit) => {
    mapRef.current?.animateToRegion({ latitude: d.lat, longitude: d.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 500);
    showToast(`Centrado: ${d.id}`);
  }, []);

  const getStatusInfo = (d: FleetUnit) => {
    if (d.status === 'bad') return { label: 'Taller', color: Colors.danger };
    if (d.bat < 20) return { label: 'Recargar', color: Colors.warn };
    if (d.locked) return { label: 'Bloqueado', color: Colors.warn };
    return { label: 'Activo', color: Colors.primary };
  };

  const doLogout = useCallback(() => {
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}>
            <MaterialIcons name="bolt" size={18} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Admin</Text>
            <Text style={styles.headerSub}>Control de flota</Text>
          </View>
        </View>
        <Pressable onPress={handleLogout} hitSlop={10}>
          <MaterialIcons name="logout" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <EcoMap ref={mapRef} initialRegion={INITIAL_REGION}>
          {fleet.map(d => (
            <EcoMarker
              key={d.id}
              coordinate={{ latitude: d.lat, longitude: d.lng }}
              title={`${d.id} · ${d.name}`}
              description={`${d.car} · Bat ${d.bat}%`}
            >
              <MaterialIcons
                name="electric-car"
                size={26}
                color={d.status === 'bad' ? Colors.danger : d.bat < 20 ? Colors.warn : Colors.primary}
              />
            </EcoMarker>
          ))}
        </EcoMap>
      </View>

      {/* Fleet panel */}
      <ScrollView
        style={styles.panel}
        contentContainerStyle={styles.panelContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.drag} />

        <SheetHeader
          title="Control de flota"
          subtitle="Mapa + lista + acciones (simulación)"
          actionIcon="refresh"
          onAction={() => { loadFleet(); loadStats(); showToast('Flota actualizada'); }}
        />

        {/* Stats */}
        <View style={styles.grid2}>
          <RideCard>
            <Text style={styles.strong}>Unidades activas</Text>
            <Text style={styles.bigNumber}>{activeCount}</Text>
            <Text style={styles.mini}>Disponibles / conectadas</Text>
          </RideCard>
          <RideCard>
            <Text style={styles.strong}>En taller</Text>
            <Text style={[styles.bigNumber, { color: Colors.danger }]}>{shopCount}</Text>
            <Text style={styles.mini}>Fuera de servicio</Text>
          </RideCard>
        </View>

        <View style={styles.btnRow}>
          <EcoButton title="Aviso" icon="campaign" variant="ghost" onPress={() => showToast('Aviso enviado a toda la flota (demo)')} style={{ flex: 1 }} />
          <EcoButton title="Reportes" icon="insights" variant="ghost" onPress={() => showToast('Reportes: demo')} style={{ flex: 1 }} />
        </View>

        <Divider />
        <Text style={styles.strong}>Flota</Text>

        {fleet.map(d => {
          const info = getStatusInfo(d);
          return (
            <View key={d.id} style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.strong}>{d.id} · {d.name}</Text>
                <Text style={styles.mini}>{d.car} · {d.plate}</Text>
                <View style={styles.tagRow}>
                  <View style={[styles.tag, { borderColor: info.color === Colors.primary ? 'rgba(0,255,136,0.4)' : info.color === Colors.warn ? 'rgba(255,204,0,0.4)' : 'rgba(255,68,68,0.4)' }]}>
                    <Text style={[styles.tagText, { color: info.color }]}>{info.label}</Text>
                  </View>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>Bat {d.bat}%</Text>
                  </View>
                </View>
                <View style={styles.btnRow}>
                  <EcoButton title={d.locked ? 'Desbloquear' : 'Bloquear'} icon="lock" variant="ghost" onPress={() => toggleLock(d.id)} style={{ flex: 1 }} />
                  <EcoButton title="Taller" icon="build" variant="ghost" onPress={() => sendToShop(d.id)} style={{ flex: 1 }} />
                </View>
                <View style={styles.btnRow}>
                  <EcoButton title="Recargar" icon="battery-charging-full" variant="ghost" onPress={() => recharge(d.id)} style={{ flex: 1 }} />
                  <EcoButton title="Ver" icon="my-location" variant="ghost" onPress={() => centerOn(d)} style={{ flex: 1 }} />
                </View>
              </View>
              <View style={styles.batColumn}>
                <Text style={[styles.batNumber, { color: info.color }]}>{d.bat}%</Text>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${Math.min(100, d.bat)}%`, backgroundColor: info.color }]} />
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dark },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: 'rgba(18,18,18,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 32, height: 32, borderRadius: 14, backgroundColor: Colors.primaryAlpha14, borderWidth: 1, borderColor: Colors.primaryAlpha35, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontWeight: '900', fontSize: FontSizes.lg, color: Colors.text },
  headerSub: { color: Colors.textSecondary, fontSize: FontSizes.xs },
  mapContainer: { height: '35%' },
  panel: { flex: 1, backgroundColor: 'rgba(14,14,14,0.97)', borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, marginTop: -20, borderTopWidth: 1, borderTopColor: Colors.whiteAlpha10 },
  panelContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 40 },
  drag: { width: 54, height: 5, borderRadius: Radius.pill, backgroundColor: Colors.whiteAlpha12, alignSelf: 'center', marginBottom: 10 },
  grid2: { flexDirection: 'row', gap: 12 },
  strong: { fontWeight: '900', color: Colors.text, fontSize: FontSizes.md },
  mini: { color: Colors.textSecondary, fontSize: FontSizes.xs, marginTop: 2 },
  bigNumber: { fontSize: 28, fontWeight: '900', color: Colors.primary, marginTop: 4 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  listItem: { backgroundColor: Colors.whiteAlpha05, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', borderRadius: Radius.md, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 10 },
  tagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.whiteAlpha05 },
  tagText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  batColumn: { alignItems: 'flex-end', minWidth: 60 },
  batNumber: { fontWeight: '900', fontSize: FontSizes.md },
  bar: { height: 4, width: 60, backgroundColor: Colors.whiteAlpha12, borderRadius: Radius.pill, overflow: 'hidden', marginTop: 6 },
  barFill: { height: '100%', borderRadius: Radius.pill },
});
