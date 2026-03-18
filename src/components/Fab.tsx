import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius } from '../constants/theme';

interface FabProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  color?: string;
  style?: ViewStyle;
}

export function Fab({ icon, onPress, color = Colors.text, style }: FabProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.fab,
        pressed && { transform: [{ scale: 0.96 }] },
        style,
      ]}
      onPress={onPress}
    >
      <MaterialIcons name={icon} size={22} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(18,18,18,0.92)',
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 15,
    elevation: 10,
  },
});
