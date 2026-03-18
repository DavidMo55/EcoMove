import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, FontSizes } from '../constants/theme';

interface ServiceCardProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  selected?: boolean;
  onPress: () => void;
}

export function ServiceCard({ icon, title, subtitle, selected = false, onPress }: ServiceCardProps) {
  return (
    <Pressable
      style={[styles.card, selected && styles.selected]}
      onPress={onPress}
    >
      <MaterialIcons name={icon} size={32} color={Colors.primary} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    borderRadius: Radius.lg,
    padding: 14,
  },
  selected: {
    borderColor: Colors.primaryAlpha55,
    backgroundColor: 'rgba(0,255,136,0.08)',
  },
  title: {
    marginTop: 8,
    fontWeight: '800',
    color: Colors.text,
    fontSize: FontSizes.md,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
});
