// app/(tabs)/_layout.tsx
// Bottom tab bar for Home + Settings.

import { Tabs } from 'expo-router';
import { ColorValue, Text } from 'react-native';

import { fonts, useTheme } from '../../src/theme';

function TabIcon({
  glyph,
  focused,
  color,
}: {
  glyph: string;
  focused: boolean;
  color: ColorValue;
}) {
  return (
    <Text
      style={{
        fontSize: focused ? 22 : 20,
        color,
        opacity: focused ? 1 : 0.85,
      }}
    >
      {glyph}
    </Text>
  );
}

export default function TabsLayout() {
  const { palette } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.divider,
          borderTopWidth: 0.5,
          height: 62,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.sansMedium,
          fontSize: 11,
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon glyph="🏠" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon glyph="⚙️" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}