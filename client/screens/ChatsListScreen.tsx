import React, { useCallback, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import {
  getActiveChats,
  getActiveGroups,
  getContacts,
  archiveChat,
  archiveGroup,
  deleteChat,
  deleteGroup,
  type Chat,
  type Group,
} from "@/lib/storage";
import type { Contact } from "@/lib/crypto";
import type { ChatsStackParamList } from "@/navigation/ChatsStackNavigator";
import ConnectionStatus from "@/components/ConnectionStatus";

type NavigationProp = NativeStackNavigationProp<ChatsStackParamList, "ChatsList">;

type ListItem =
  | (Chat & { type: "chat"; displayName: string })
  | (Group & { type: "group" });

interface ChatItemProps {
  item: ListItem;
  onPress: () => void;
  onLongPress: () => void;
}

function ChatItem({ item, onPress, onLongPress }: ChatItemProps) {
  const lastMessage =
    item.type === "chat"
      ? item.messages[item.messages.length - 1]
      : item.messages[item.messages.length - 1];
  const displayName = item.type === "chat" ? item.displayName : item.name;

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
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.chatItem, pressed && styles.chatItemPressed]}
    >
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Feather
            name={item.type === "chat" ? "lock" : "users"}
            size={20}
            color={Colors.dark.secondary}
          />
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
          <ThemedText style={styles.messagePreview} numberOfLines={1}>
            {item.type === "group" && lastMessage
              ? `${lastMessage.senderId.split("-")[0]}: ${lastMessage.content}`
              : lastMessage?.content || "No messages yet"}
          </ThemedText>
          {item.unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <ThemedText style={styles.unreadCount}>{item.unreadCount}</ThemedText>
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
        Add a contact or create a group to start messaging securely
      </ThemedText>
      <View style={styles.emptyButtons}>
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
        <Pressable
          style={({ pressed }) => [
            styles.emptyButtonSecondary,
            pressed && styles.emptyButtonPressed,
          ]}
          onPress={() => navigation.navigate("CreateGroup")}
        >
          <Feather name="users" size={18} color={Colors.dark.primary} />
          <ThemedText style={styles.emptyButtonTextSecondary}>Create Group</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

export default function ChatsListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const [items, setItems] = useState<ListItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [chatsData, groupsData, contactsData] = await Promise.all([
      getActiveChats(),
      getActiveGroups(),
      getContacts(),
    ]);
    setContacts(contactsData);

    const chatItems: ListItem[] = chatsData.map((chat) => ({
      ...chat,
      type: "chat" as const,
      displayName:
        contactsData.find((c) => c.id === chat.contactId)?.displayName ||
        chat.contactId,
    }));

    const groupItems: ListItem[] = groupsData.map((group) => ({
      ...group,
      type: "group" as const,
    }));

    const allItems = [...chatItems, ...groupItems].sort(
      (a, b) => b.lastMessageAt - a.lastMessageAt
    );

    setItems(allItems);
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

  const handleLongPress = (item: ListItem) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const options = [
      {
        text: "Archive",
        onPress: async () => {
          if (item.type === "chat") {
            await archiveChat(item.contactId);
          } else {
            await archiveGroup(item.id);
          }
          loadData();
        },
      },
      {
        text: "Delete",
        style: "destructive" as const,
        onPress: () => {
          Alert.alert(
            "Delete",
            `Are you sure you want to delete this ${item.type === "chat" ? "conversation" : "group"}?`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  if (item.type === "chat") {
                    await deleteChat(item.contactId);
                  } else {
                    await deleteGroup(item.id);
                  }
                  loadData();
                },
              },
            ]
          );
        },
      },
      { text: "Cancel", style: "cancel" as const },
    ];

    Alert.alert(
      item.type === "chat" ? item.displayName : item.name,
      "Choose an action",
      options
    );
  };

  const handleItemPress = (item: ListItem) => {
    if (item.type === "chat") {
      navigation.navigate("ChatThread", { contactId: item.contactId });
    } else {
      navigation.navigate("GroupThread", { groupId: item.id });
    }
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => <ConnectionStatus />,
      headerRight: () => (
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => navigation.navigate("ArchivedChats")}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.headerButtonPressed,
            ]}
          >
            <Feather name="archive" size={20} color={Colors.dark.text} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("CreateGroup")}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.headerButtonPressed,
            ]}
          >
            <Feather name="users" size={20} color={Colors.dark.text} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation]);

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) =>
          item.type === "chat" ? `chat-${item.contactId}` : `group-${item.id}`
        }
        renderItem={({ item }) => (
          <ChatItem
            item={item}
            onPress={() => handleItemPress(item)}
            onLongPress={() => handleLongPress(item)}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
          items.length === 0 && styles.emptyListContent,
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
  headerRight: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButtonPressed: {
    backgroundColor: Colors.dark.backgroundSecondary,
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
  emptyButtons: {
    gap: Spacing.md,
    width: "100%",
    maxWidth: 280,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    gap: Spacing.sm,
  },
  emptyButtonSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.dark.primary,
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
  emptyButtonTextSecondary: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.primary,
  },
});
