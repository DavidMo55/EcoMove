import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, FontSizes } from '../constants/theme';

interface RideCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function RideCard({ children, style }: RideCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

interface KVRowProps {
  label: string;
  value: string;
}

export function KVRow({ label, value }: KVRowProps) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

interface BadgeProps {
  text: string;
  variant?: 'ok' | 'warn' | 'danger';
}

export function Badge({ text, variant = 'ok' }: BadgeProps) {
  const colorMap = {
    ok: { bg: Colors.primaryAlpha10, border: Colors.primaryAlpha55, text: Colors.primary },
    warn: { bg: 'rgba(255,204,0,0.10)', border: 'rgba(255,204,0,0.55)', text: Colors.warn },
    danger: { bg: 'rgba(255,68,68,0.10)', border: 'rgba(255,68,68,0.55)', text: Colors.danger },
  };
  const c = colorMap[variant];

  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{text}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

interface ProgressBarProps {
  progress: number; // 0-100
}

export function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <View style={styles.progressBg}>
      <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, progress))}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    borderRadius: Radius.lg,
    padding: 14,
  },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  kvLabel: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  kvValue: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: FontSizes.sm,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.whiteAlpha10,
    marginVertical: 14,
  },
  progressBg: {
    height: 6,
    backgroundColor: Colors.whiteAlpha10,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
  },
});
