import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ChatsListScreen from "@/screens/ChatsListScreen";
import ChatThreadScreen from "@/screens/ChatThreadScreen";
import ContactInfoScreen from "@/screens/ContactInfoScreen";
import CreateGroupScreen from "@/screens/CreateGroupScreen";
import ArchivedChatsScreen from "@/screens/ArchivedChatsScreen";
import GroupThreadScreen from "@/screens/GroupThreadScreen";
import GroupInfoScreen from "@/screens/GroupInfoScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ChatsStackParamList = {
  ChatsList: undefined;
  ChatThread: { contactId: string };
  ContactInfo: { contactId: string };
  CreateGroup: undefined;
  ArchivedChats: undefined;
  GroupThread: { groupId: string };
  GroupInfo: { groupId: string };
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
      <Stack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{
          headerTitle: "Create Group",
        }}
      />
      <Stack.Screen
        name="ArchivedChats"
        component={ArchivedChatsScreen}
        options={{
          headerTitle: "Archived",
        }}
      />
      <Stack.Screen
        name="GroupThread"
        component={GroupThreadScreen}
        options={{
          headerTitle: "Group Chat",
        }}
      />
      <Stack.Screen
        name="GroupInfo"
        component={GroupInfoScreen}
        options={{
          headerTitle: "Group Info",
        }}
      />
    </Stack.Navigator>
  );
}
