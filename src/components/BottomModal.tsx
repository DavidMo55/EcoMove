import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal as RNModal } from 'react-native';
import { Colors, Radius, Spacing, FontSizes } from '../constants/theme';

interface BottomModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function BottomModal({ visible, onClose, title, subtitle, children }: BottomModalProps) {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.drag} />
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.blackAlpha62,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: 'rgba(14,14,14,0.98)',
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -18 },
    shadowOpacity: 0.55,
    shadowRadius: 30,
    elevation: 20,
  },
  drag: {
    width: 54,
    height: 5,
    borderRadius: Radius.pill,
    backgroundColor: Colors.whiteAlpha12,
    alignSelf: 'center',
    marginBottom: 10,
  },
  title: {
    fontWeight: '900',
    fontSize: FontSizes.lg,
    color: Colors.text,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: 4,
  },
});
