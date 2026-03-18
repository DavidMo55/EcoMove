import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TextInputProps,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../constants/theme';

interface EcoInputProps extends TextInputProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  rightIcon?: keyof typeof MaterialIcons.glyphMap;
  onRightIconPress?: () => void;
}

export function EcoInput({
  icon,
  rightIcon,
  onRightIconPress,
  style,
  ...props
}: EcoInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        focused && styles.focused,
        style,
      ]}
    >
      <MaterialIcons
        name={icon}
        size={22}
        color={focused ? Colors.primary : Colors.textSecondary}
        style={styles.icon}
      />
      <TextInput
        placeholderTextColor={Colors.textSecondary}
        style={styles.input}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {rightIcon && (
        <Pressable onPress={onRightIconPress} hitSlop={8}>
          <MaterialIcons
            name={rightIcon}
            size={20}
            color={Colors.textSecondary}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.whiteAlpha05,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha10,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: 10,
  },
  focused: {
    borderColor: Colors.primaryAlpha55,
    backgroundColor: Colors.primaryAlpha06,
  },
  icon: {
    width: 22,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    padding: 0,
    fontFamily: 'System',
  },
});
