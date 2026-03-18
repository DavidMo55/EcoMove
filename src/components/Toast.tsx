import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../constants/theme';
import { setToastCallback } from '../stores/appState';

export function Toast() {
  const [message, setMessage] = useState('');
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-60)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((msg: string) => {
    setMessage(msg);
    if (timerRef.current) clearTimeout(timerRef.current);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -60, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 3000);
  }, [opacity, translateY]);

  useEffect(() => {
    setToastCallback(show);
    return () => setToastCallback(() => {});
  }, [show]);

  return (
    <Animated.View
      style={[styles.container, { opacity, transform: [{ translateY }] }]}
      pointerEvents="none"
    >
      <MaterialIcons name="info" size={20} color={Colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: 'rgba(25,25,25,0.95)',
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    borderRadius: 14,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 30,
    elevation: 20,
  },
  text: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 19,
  },
});
