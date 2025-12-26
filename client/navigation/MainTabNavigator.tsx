import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import ChatsStackNavigator from "@/navigation/ChatsStackNavigator";
import AddContactScreen from "@/screens/AddContactScreen";
import SettingsStackNavigator from "@/navigation/SettingsStackNavigator";
import { Colors, Spacing } from "@/constants/theme";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useLanguage } from "@/constants/language";

function getTabBarVisibility(route: any): "none" | "flex" {
  const routeName = getFocusedRouteNameFromRoute(route) ?? "ChatsList";
  const hideTabBarScreens = ["ChatThread", "ContactInfo", "GroupThread", "GroupInfo", "CreateGroup", "NewChat"];
  if (hideTabBarScreens.includes(routeName)) {
    return "none";
  }
  return "flex";
}

export type MainTabParamList = {
  ChatsTab: undefined;
  AddContactTab: undefined;
  SettingsTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const screenOptions = useScreenOptions();
  const { language } = useLanguage();

  return (
    <Tab.Navigator
      initialRouteName="ChatsTab"
      screenOptions={{
        tabBarActiveTintColor: Colors.dark.primary,
        tabBarInactiveTintColor: Colors.dark.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: Colors.dark.backgroundRoot,
          }),
          borderTopWidth: 1,
          borderTopColor: Colors.dark.border,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="ChatsTab"
        component={ChatsStackNavigator}
        options={({ route }) => ({
          title: language === "tr" ? "Sohbetler" : "Chats",
          tabBarIcon: ({ color, size }) => (
            <Feather name="message-circle" size={size} color={color} />
          ),
          tabBarStyle: {
            display: getTabBarVisibility(route),
            position: "absolute" as const,
            backgroundColor: Platform.select({
              ios: "transparent",
              android: Colors.dark.backgroundRoot,
            }),
            borderTopWidth: 1,
            borderTopColor: Colors.dark.border,
            elevation: 0,
          },
        })}
      />
      <Tab.Screen
        name="AddContactTab"
        component={AddContactScreen}
        options={{
          title: language === "tr" ? "Ekle" : "Add",
          headerTitle: language === "tr" ? "Kişi Ekle" : "Add Contact",
          headerShown: true,
          headerStyle: {
            backgroundColor: Colors.dark.backgroundRoot,
          },
          headerTintColor: Colors.dark.text,
          headerTitleStyle: {
            fontWeight: "600" as const,
          },
          tabBarIcon: ({ color, size }) => (
            <View
              style={[
                styles.addButton,
                { backgroundColor: Colors.dark.primary },
              ]}
            >
              <Feather name="user-plus" size={size - 4} color={Colors.dark.buttonText} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStackNavigator}
        options={{
          title: language === "tr" ? "Ayarlar" : "Settings",
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
