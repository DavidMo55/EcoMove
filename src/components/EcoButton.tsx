import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../constants/theme';

type Variant = 'primary' | 'ghost' | 'danger';

interface EcoButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof MaterialIcons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function EcoButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
}: EcoButtonProps) {
  const variantStyles = variantMap[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variantStyles.container,
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        (disabled || loading) && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#000' : Colors.text}
        />
      ) : (
        <>
          {icon && (
            <MaterialIcons
              name={icon}
              size={20}
              color={variantStyles.textColor}
            />
          )}
          <Text style={[styles.text, { color: variantStyles.textColor }]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const variantMap = {
  primary: {
    container: {
      backgroundColor: Colors.primary,
    } as ViewStyle,
    textColor: '#000000',
  },
  ghost: {
    container: {
      backgroundColor: Colors.whiteAlpha07,
      borderWidth: 1,
      borderColor: Colors.whiteAlpha10,
    } as ViewStyle,
    textColor: Colors.text,
  },
  danger: {
    container: {
      backgroundColor: Colors.danger,
    } as ViewStyle,
    textColor: '#ffffff',
  },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
  },
  text: {
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
