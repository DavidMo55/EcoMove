import React from 'react';
import { View, StyleSheet, ScrollView, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '../constants/theme';

interface SheetProps {
  children: React.ReactNode;
  style?: ViewStyle;
  scrollable?: boolean;
}

export function Sheet({ children, style, scrollable = true }: SheetProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.drag} />
      {scrollable ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(14,14,14,0.97)',
    borderTopWidth: 1,
    borderTopColor: Colors.whiteAlpha10,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -16 },
    shadowOpacity: 0.65,
    shadowRadius: 20,
    elevation: 15,
  },
  drag: {
    width: 54,
    height: 5,
    borderRadius: Radius.pill,
    backgroundColor: Colors.whiteAlpha12,
    alignSelf: 'center',
    marginBottom: 10,
  },
  scrollContent: {
    paddingBottom: 20,
  },
});
