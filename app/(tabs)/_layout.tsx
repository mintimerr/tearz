import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { GAME_THEME } from '@/constants/game-theme';
import { useTranslation } from '@/contexts/locale-context';

function TabBarBackground() {
  return (
    <View style={styles.tabBarBgRoot} pointerEvents="none">
      <BlurView tint="light" intensity={Platform.OS === 'ios' ? 88 : 56} style={StyleSheet.absoluteFill} />
      <View style={styles.tabBarBgTint} />
    </View>
  );
}

function TabGlyph({
  focused,
  color,
  outline,
  solid,
}: {
  focused: boolean;
  color: string;
  outline: keyof typeof Ionicons.glyphMap;
  solid: keyof typeof Ionicons.glyphMap;
}) {
  const active = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(active, {
      toValue: focused ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [active, focused]);

  return (
    <Animated.View style={styles.tabGlyphWrap}>
      <Ionicons name={focused ? solid : outline} size={24} color={focused ? '#111111' : color} />
    </Animated.View>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      initialRouteName="teacher"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: GAME_THEME.color.void },
        /** Навигация — через игровой хаб, таббар скрыт. */
        tabBarStyle: { display: 'none', height: 0 },
        tabBarBackground: TabBarBackground,
        tabBarActiveTintColor: '#111111',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: -0.04,
          marginTop: 1,
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
      }}>
      <Tabs.Screen
        name="teacher"
        options={{
          title: t('tabs.teacher'),
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph focused={focused} color={color} outline="school-outline" solid="school" />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.companion'),
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph focused={focused} color={color} outline="chatbubbles-outline" solid="chatbubbles" />
          ),
        }}
      />
      <Tabs.Screen
        name="vocabulary"
        options={{
          title: t('tabs.vocabulary'),
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph focused={focused} color={color} outline="book-outline" solid="book" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph focused={focused} color={color} outline="person-circle-outline" solid="person-circle" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarBgRoot: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  tabBarBgTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
  },
  tabGlyphWrap: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
