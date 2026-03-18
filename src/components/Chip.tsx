import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, FontSizes } from '../constants/theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
}

export function Chip({ label, selected = false, icon, onPress }: ChipProps) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      {icon && (
        <MaterialIcons
          name={icon}
          size={18}
          color={selected ? Colors.primary : Colors.text}
        />
      )}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

interface ChipRowProps {
  children: React.ReactNode;
}

export function ChipRow({ children }: ChipRowProps) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    color: Colors.text,
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: Colors.primary,
  },
});
