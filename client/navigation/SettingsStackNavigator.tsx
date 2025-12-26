import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SettingsScreen from "@/screens/SettingsScreen";
import NetworkSettingsScreen from "@/screens/NetworkSettingsScreen";
import SecuritySettingsScreen from "@/screens/SecuritySettingsScreen";
import AboutScreen from "@/screens/AboutScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type SettingsStackParamList = {
  Settings: undefined;
  NetworkSettings: undefined;
  SecuritySettings: undefined;
  About: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export default function SettingsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerTitle: "Settings",
        }}
      />
      <Stack.Screen
        name="NetworkSettings"
        component={NetworkSettingsScreen}
        options={{
          headerTitle: "Network",
        }}
      />
      <Stack.Screen
        name="SecuritySettings"
        component={SecuritySettingsScreen}
        options={{
          headerTitle: "Security",
        }}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{
          headerTitle: "About",
        }}
      />
    </Stack.Navigator>
  );
}
