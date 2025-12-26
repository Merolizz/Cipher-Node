import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getChats, getContacts, type Chat } from "@/lib/storage";
import type { Contact } from "@/lib/crypto";
import type { ChatsStackParamList } from "@/navigation/ChatsStackNavigator";
import ConnectionStatus from "@/components/ConnectionStatus";

type NavigationProp = NativeStackNavigationProp<ChatsStackParamList, "ChatsList">;

interface ChatItemProps {
  chat: Chat;
  contact: Contact | null;
  onPress: () => void;
}

function ChatItem({ chat, contact, onPress }: ChatItemProps) {
  const lastMessage = chat.messages[chat.messages.length - 1];
  const displayName = contact?.displayName || contact?.id || "Unknown";

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chatItem,
        pressed && styles.chatItemPressed,
      ]}
    >
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Feather name="lock" size={20} color={Colors.dark.secondary} />
        </View>
      </View>
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <ThemedText style={styles.contactName} numberOfLines={1}>
            {displayName}
          </ThemedText>
          <ThemedText style={styles.timestamp}>
            {lastMessage ? formatTime(lastMessage.timestamp) : ""}
          </ThemedText>
        </View>
        <View style={styles.chatPreview}>
          <ThemedText
            style={styles.messagePreview}
            numberOfLines={1}
          >
            {lastMessage?.content || "No messages yet"}
          </ThemedText>
          {chat.unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <ThemedText style={styles.unreadCount}>
                {chat.unreadCount}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function EmptyState() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Feather name="message-circle" size={64} color={Colors.dark.textSecondary} />
      </View>
      <ThemedText style={styles.emptyTitle}>No chats yet</ThemedText>
      <ThemedText style={styles.emptySubtitle}>
        Add a contact to start messaging securely
      </ThemedText>
      <Pressable
        style={({ pressed }) => [
          styles.emptyButton,
          pressed && styles.emptyButtonPressed,
        ]}
        onPress={() => {
          navigation.getParent()?.navigate("AddContactTab" as never);
        }}
      >
        <Feather name="user-plus" size={18} color={Colors.dark.buttonText} />
        <ThemedText style={styles.emptyButtonText}>Add Contact</ThemedText>
      </Pressable>
    </View>
  );
}

export default function ChatsListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [chatsData, contactsData] = await Promise.all([
      getChats(),
      getContacts(),
    ]);
    setChats(chatsData.sort((a, b) => b.lastMessageAt - a.lastMessageAt));
    setContacts(contactsData);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const getContactForChat = (contactId: string) => {
    return contacts.find((c) => c.id === contactId) || null;
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => <ConnectionStatus />,
    });
  }, [navigation]);

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={chats}
        keyExtractor={(item) => item.contactId}
        renderItem={({ item }) => (
          <ChatItem
            chat={item}
            contact={getContactForChat(item.contactId)}
            onPress={() =>
              navigation.navigate("ChatThread", { contactId: item.contactId })
            }
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
          chats.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={EmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.dark.primary}
          />
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  listContent: {
    flexGrow: 1,
  },
  emptyListContent: {
    justifyContent: "center",
  },
  chatItem: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.dark.backgroundDefault,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  chatItemPressed: {
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  avatarContainer: {
    marginRight: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  chatContent: {
    flex: 1,
    justifyContent: "center",
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginLeft: Spacing.sm,
  },
  chatPreview: {
    flexDirection: "row",
    alignItems: "center",
  },
  messagePreview: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.sm,
  },
  unreadCount: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.buttonText,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  emptyIcon: {
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    gap: Spacing.sm,
  },
  emptyButtonPressed: {
    opacity: 0.8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.buttonText,
  },
});
