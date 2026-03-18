import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, FontSizes } from '../src/constants/theme';
import { EcoInput } from '../src/components/EcoInput';
import { EcoButton } from '../src/components/EcoButton';
import { auth, setToken } from '../src/services/api';

type Role = 'user' | 'driver' | 'admin';

const ROLES: { key: Role; icon: keyof typeof MaterialIcons.glyphMap; label: string; sub: string }[] = [
  { key: 'user', icon: 'person', label: 'Usuario', sub: 'Solicitar viajes' },
  { key: 'driver', icon: 'drive-eta', label: 'Chofer', sub: 'Conducir y ganar' },
  { key: 'admin', icon: 'admin-panel-settings', label: 'Admin', sub: 'Control de flota' },
];

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<Role>('user');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu correo y contraseña');
      return;
    }
    setLoading(true);
    try {
      const data = await auth.login(email.trim().toLowerCase(), password);
      setToken(data.token);
      // Route based on user's actual role from DB
      const r = data.user.role === 'DRIVER' ? 'driver' : data.user.role === 'ADMIN' ? 'admin' : 'user';
      router.replace(`/${r}` as any);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <MaterialIcons name="bolt" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.brandName}>
              EcoMove <Text style={styles.brandAccent}>App</Text>
            </Text>
            <View style={styles.pill}>
              <View style={styles.pillDot} />
              <Text style={styles.pillText}>Movilidad eléctrica</Text>
            </View>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Iniciar sesión</Text>
            <Text style={styles.cardSub}>
              Selecciona tu rol e ingresa tus credenciales
            </Text>

            {/* Role selector */}
            <View style={styles.roleRow}>
              {ROLES.map(r => (
                <Pressable
                  key={r.key}
                  style={[styles.roleCard, role === r.key && styles.roleCardSelected]}
                  onPress={() => setRole(r.key)}
                >
                  <MaterialIcons
                    name={r.icon}
                    size={26}
                    color={role === r.key ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={[styles.roleLabel, role === r.key && styles.roleLabelSelected]}>
                    {r.label}
                  </Text>
                  <Text style={styles.roleSub}>{r.sub}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.form}>
              <EcoInput
                icon="email"
                placeholder="Correo electrónico"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <EcoInput
                icon="lock"
                placeholder="Contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                rightIcon={showPassword ? 'visibility-off' : 'visibility'}
                onRightIconPress={() => setShowPassword(!showPassword)}
              />

              <Pressable
                onPress={() =>
                  Alert.alert('Demo', 'Recuperar contraseña (simulado)')
                }
              >
                <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
              </Pressable>

              <EcoButton
                title={`Ingresar como ${ROLES.find(r => r.key === role)!.label}`}
                icon="arrow-forward"
                onPress={handleLogin}
                loading={loading}
              />
            </View>

            <View style={styles.divider} />

            {/* Social login */}
            <Text style={styles.socialLabel}>O continúa con</Text>
            <View style={styles.socialRow}>
              <Pressable
                style={styles.socialBtn}
                onPress={() => Alert.alert('Demo', 'Google login (simulado)')}
              >
                <MaterialIcons name="public" size={22} color={Colors.text} />
                <Text style={styles.socialText}>Google</Text>
              </Pressable>
              <Pressable
                style={styles.socialBtn}
                onPress={() => Alert.alert('Demo', 'Apple login (simulado)')}
              >
                <MaterialIcons
                  name="phone-iphone"
                  size={22}
                  color={Colors.text}
                />
                <Text style={styles.socialText}>Apple</Text>
              </Pressable>
            </View>
          </View>

          {/* Register link */}
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>¿No tienes cuenta? </Text>
            <Pressable onPress={() => router.push('/register')}>
              <Text style={styles.registerLink}>Regístrate</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.dark,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryAlpha14,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 8,
  },
  brandName: {
    fontSize: FontSizes.xxl,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 0.4,
  },
  brandAccent: {
    color: Colors.primary,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha55,
    backgroundColor: Colors.primaryAlpha06,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 7,
    elevation: 4,
  },
  pillText: {
    color: Colors.primary,
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 30,
    elevation: 12,
  },
  cardTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '900',
    color: Colors.text,
  },
  cardSub: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },

  // Role selector
  roleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: Radius.lg,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    gap: 4,
  },
  roleCardSelected: {
    borderColor: Colors.primaryAlpha55,
    backgroundColor: 'rgba(0,255,136,0.08)',
  },
  roleLabel: {
    fontWeight: '800',
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  roleLabelSelected: {
    color: Colors.primary,
  },
  roleSub: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  form: {
    gap: Spacing.md,
  },
  forgotText: {
    color: Colors.primary,
    fontSize: FontSizes.sm,
    textAlign: 'right',
    marginTop: -4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.whiteAlpha10,
    marginVertical: Spacing.lg,
  },
  socialLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  socialRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: Radius.md,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
  },
  socialText: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: FontSizes.sm,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  registerText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
  },
  registerLink: {
    color: Colors.primary,
    fontSize: FontSizes.md,
    fontWeight: '800',
  },
});
