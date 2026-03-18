import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, FontSizes } from '../constants/theme';

interface SheetHeaderProps {
  title: string;
  subtitle: string;
  actionIcon?: keyof typeof MaterialIcons.glyphMap;
  onAction?: () => void;
}

export function SheetHeader({ title, subtitle, actionIcon, onAction }: SheetHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {actionIcon && onAction && (
        <Pressable style={styles.btn} onPress={onAction}>
          <MaterialIcons name={actionIcon} size={20} color={Colors.text} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontWeight: '900',
    fontSize: FontSizes.lg,
    color: Colors.text,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
  btn: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    backgroundColor: Colors.whiteAlpha06,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
