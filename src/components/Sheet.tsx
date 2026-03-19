import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ViewStyle,
  Animated,
  PanResponder,
  Dimensions,
  Pressable,
  LayoutChangeEvent,
} from 'react-native';
import { Colors, Radius, Spacing } from '../constants/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface SheetProps {
  children: React.ReactNode;
  style?: ViewStyle;
  scrollable?: boolean;
  /** If true, sheet can be minimized by dragging */
  collapsible?: boolean;
  /** Height when minimized (default 90) */
  minHeight?: number;
  /** If true, starts minimized */
  startMinimized?: boolean;
  onToggle?: (expanded: boolean) => void;
}

export function Sheet({
  children,
  style,
  scrollable = true,
  collapsible = false,
  minHeight = 90,
  startMinimized = false,
  onToggle,
}: SheetProps) {
  const [expanded, setExpanded] = useState(!startMinimized);
  const [contentHeight, setContentHeight] = useState(SCREEN_HEIGHT * 0.65);
  const animatedHeight = useRef(new Animated.Value(startMinimized ? minHeight : SCREEN_HEIGHT * 0.65)).current;
  const lastHeight = useRef(startMinimized ? minHeight : SCREEN_HEIGHT * 0.65);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return collapsible && Math.abs(gestureState.dy) > 8;
      },
      onPanResponderMove: (_, gestureState) => {
        const newHeight = Math.max(minHeight, Math.min(contentHeight, lastHeight.current - gestureState.dy));
        animatedHeight.setValue(newHeight);
      },
      onPanResponderRelease: (_, gestureState) => {
        const midpoint = (contentHeight + minHeight) / 2;
        const currentVal = lastHeight.current - gestureState.dy;
        const goExpand = gestureState.dy < -30 || (gestureState.dy >= -30 && gestureState.dy <= 30 && currentVal > midpoint);
        const targetHeight = goExpand ? contentHeight : minHeight;

        Animated.spring(animatedHeight, {
          toValue: targetHeight,
          useNativeDriver: false,
          tension: 80,
          friction: 12,
        }).start();

        lastHeight.current = targetHeight;
        const newExpanded = targetHeight === contentHeight;
        setExpanded(newExpanded);
        onToggle?.(newExpanded);
      },
    })
  ).current;

  const onContentLayout = (e: LayoutChangeEvent) => {
    const h = Math.min(e.nativeEvent.layout.height + 60, SCREEN_HEIGHT * 0.75);
    setContentHeight(h);
    if (expanded) {
      animatedHeight.setValue(h);
      lastHeight.current = h;
    }
  };

  const toggleSheet = () => {
    const target = expanded ? minHeight : contentHeight;
    Animated.spring(animatedHeight, {
      toValue: target,
      useNativeDriver: false,
      tension: 80,
      friction: 12,
    }).start();
    lastHeight.current = target;
    setExpanded(!expanded);
    onToggle?.(!expanded);
  };

  if (!collapsible) {
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

  return (
    <Animated.View style={[styles.container, style, { maxHeight: animatedHeight }]}>
      <Pressable onPress={toggleSheet} {...panResponder.panHandlers}>
        <View style={styles.drag} />
      </Pressable>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={expanded}
        contentContainerStyle={styles.scrollContent}
      >
        <View onLayout={onContentLayout}>
          {children}
        </View>
      </ScrollView>
    </Animated.View>
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
    paddingTop: 0,
    paddingBottom: Spacing.lg,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -16 },
    shadowOpacity: 0.65,
    shadowRadius: 20,
    elevation: 15,
    overflow: 'hidden',
  },
  drag: {
    width: 54,
    height: 5,
    borderRadius: Radius.pill,
    backgroundColor: Colors.whiteAlpha12,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  scrollContent: {
    paddingBottom: 20,
  },
});
