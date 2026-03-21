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

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState('user');

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      const role = selected === 'driver' ? 'DRIVER' : 'USER';
      const data = await auth.register({ email: email.trim().toLowerCase(), password, name: name.trim(), phone: phone.trim() || undefined, role });
      setToken(data.token);
      Alert.alert('Registro exitoso', `Bienvenido, ${data.user.name}`, [
        { text: 'OK', onPress: () => {
          const r = data.user.role === 'DRIVER' ? 'driver' : 'user';
          router.replace(`/${r}` as any);
        }},
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo registrar');
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
          {/* Header con back */}
          <View style={styles.header}>
            <Pressable
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={12}
            >
              <MaterialIcons
                name="arrow-back"
                size={22}
                color={Colors.text}
              />
            </Pressable>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Crear cuenta</Text>
              <Text style={styles.headerSub}>
                Únete a la movilidad eléctrica
              </Text>
            </View>
          </View>

          {/* Logo mini */}
          <View style={styles.logoMini}>
            <View style={styles.logoContainer}>
              <MaterialIcons name="bolt" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.brandName}>
              EcoDrive <Text style={styles.brandAccent}>App</Text>
            </Text>
          </View>

          {/* Step dots */}
          <View style={styles.stepDots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Información personal</Text>
            <Text style={styles.cardSub}>
              Paso 1 de 3 — datos básicos
            </Text>

            <View style={styles.form}>
              <EcoInput
                icon="person"
                placeholder="Nombre completo"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
              />

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
                icon="phone"
                placeholder="Teléfono (opcional)"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
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

              <EcoInput
                icon="lock-outline"
                placeholder="Confirmar contraseña"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />

              {/* Tipo de cuenta chips */}
              <Text style={styles.chipLabel}>Tipo de cuenta</Text>
              <AccountTypeChips selected={selected} onSelect={setSelected} />

              <EcoButton
                title="Crear cuenta"
                icon="person-add"
                onPress={handleRegister}
                loading={loading}
              />
            </View>

            <View style={styles.divider} />

            {/* Social */}
            <Text style={styles.socialLabel}>O regístrate con</Text>
            <View style={styles.socialRow}>
              <Pressable
                style={styles.socialBtn}
                onPress={() => Alert.alert('Demo', 'Google signup (simulado)')}
              >
                <MaterialIcons name="public" size={22} color={Colors.text} />
                <Text style={styles.socialText}>Google</Text>
              </Pressable>
              <Pressable
                style={styles.socialBtn}
                onPress={() => Alert.alert('Demo', 'Apple signup (simulado)')}
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

          {/* Login link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>¿Ya tienes cuenta? </Text>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.loginLink}>Inicia sesión</Text>
            </Pressable>
          </View>

          {/* Terms */}
          <Text style={styles.terms}>
            Al registrarte, aceptas nuestros{' '}
            <Text style={styles.termsLink}>Términos de servicio</Text> y{' '}
            <Text style={styles.termsLink}>Política de privacidad</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AccountTypeChips({ selected, onSelect }: { selected: string; onSelect: (v: string) => void }) {
  const options = [
    { key: 'user', icon: 'person' as const, label: 'Usuario' },
    { key: 'driver', icon: 'drive-eta' as const, label: 'Chofer' },
  ];

  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <Pressable
          key={opt.key}
          style={[
            styles.chip,
            selected === opt.key && styles.chipSelected,
          ]}
          onPress={() => onSelect(opt.key)}
        >
          <MaterialIcons
            name={opt.icon}
            size={18}
            color={selected === opt.key ? Colors.primary : Colors.textSecondary}
          />
          <Text
            style={[
              styles.chipText,
              selected === opt.key && styles.chipTextSelected,
            ]}
          >
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
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
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '900',
    color: Colors.text,
  },
  headerSub: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Logo
  logoMini: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.primaryAlpha14,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha35,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 6,
  },
  brandName: {
    fontSize: FontSizes.xl,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 0.3,
  },
  brandAccent: {
    color: Colors.primary,
  },

  // Steps
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
    backgroundColor: Colors.whiteAlpha12,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 7,
    elevation: 4,
  },

  // Card
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
  form: {
    gap: Spacing.md,
  },

  // Chips
  chipLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
  },
  chipSelected: {
    backgroundColor: Colors.primaryAlpha10,
    borderColor: Colors.primaryAlpha55,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: Colors.primary,
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

  // Login
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  loginText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
  },
  loginLink: {
    color: Colors.primary,
    fontSize: FontSizes.md,
    fontWeight: '800',
  },

  // Terms
  terms: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.primary,
  },
});
