import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ChatsListScreen from "@/screens/ChatsListScreen";
import ChatThreadScreen from "@/screens/ChatThreadScreen";
import ContactInfoScreen from "@/screens/ContactInfoScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ChatsStackParamList = {
  ChatsList: undefined;
  ChatThread: { contactId: string };
  ContactInfo: { contactId: string };
};

const Stack = createNativeStackNavigator<ChatsStackParamList>();

export default function ChatsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="ChatsList"
        component={ChatsListScreen}
        options={{
          headerTitle: "CipherNode",
        }}
      />
      <Stack.Screen
        name="ChatThread"
        component={ChatThreadScreen}
        options={{
          headerTitle: "Chat",
        }}
      />
      <Stack.Screen
        name="ContactInfo"
        component={ContactInfoScreen}
        options={{
          headerTitle: "Contact Info",
        }}
      />
    </Stack.Navigator>
  );
}
