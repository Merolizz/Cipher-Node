import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  FlatList,
  TextInput,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeaderButton } from "@react-navigation/elements";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing, BorderRadius, Fonts } from "@/constants/theme";
import {
  getChat,
  getContact,
  saveMessage,
  markChatAsRead,
  generateMessageId,
  type Message,
} from "@/lib/storage";
import type { Contact } from "@/lib/crypto";
import type { ChatsStackParamList } from "@/navigation/ChatsStackNavigator";
import { useIdentity } from "@/hooks/useIdentity";

type NavigationProp = NativeStackNavigationProp<ChatsStackParamList, "ChatThread">;
type ScreenRouteProp = RouteProp<ChatsStackParamList, "ChatThread">;

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
}

function MessageBubble({ message, isMine }: MessageBubbleProps) {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <View
      style={[
        styles.messageBubble,
        isMine ? styles.messageBubbleMine : styles.messageBubbleTheirs,
      ]}
    >
      <ThemedText
        style={[
          styles.messageText,
          isMine ? styles.messageTextMine : styles.messageTextTheirs,
        ]}
      >
        {message.content}
      </ThemedText>
      <View style={styles.messageFooter}>
        <Feather
          name="lock"
          size={10}
          color={isMine ? Colors.dark.buttonText : Colors.dark.secondary}
          style={styles.lockIcon}
        />
        <ThemedText
          style={[
            styles.messageTime,
            isMine ? styles.messageTimeMine : styles.messageTimeTheirs,
          ]}
        >
          {formatTime(message.timestamp)}
        </ThemedText>
      </View>
    </View>
  );
}

export default function ChatThreadScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();
  const { contactId } = route.params;
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { identity } = useIdentity();

  const [messages, setMessages] = useState<Message[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);
  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const loadData = useCallback(async () => {
    const [chatData, contactData] = await Promise.all([
      getChat(contactId),
      getContact(contactId),
    ]);
    setMessages(chatData?.messages || []);
    setContact(contactData);
    if (chatData) {
      await markChatAsRead(contactId);
    }
  }, [contactId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  React.useLayoutEffect(() => {
    const displayName = contact?.displayName || contact?.id || "Chat";
    navigation.setOptions({
      headerTitle: displayName,
      headerRight: () => (
        <HeaderButton
          onPress={() => navigation.navigate("ContactInfo", { contactId })}
        >
          <Feather name="info" size={22} color={Colors.dark.primary} />
        </HeaderButton>
      ),
    });
  }, [navigation, contact, contactId]);

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !identity) return;

    const message: Message = {
      id: generateMessageId(),
      content: inputText.trim(),
      encrypted: "",
      senderId: identity.id,
      recipientId: contactId,
      timestamp: Date.now(),
      status: "sent",
    };

    await saveMessage(contactId, message);
    setMessages((prev) => [...prev, message]);
    setInputText("");

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [inputText, identity, contactId]);

  return (
    <ThemedView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isMine={item.senderId === identity?.id}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: 80 + insets.bottom,
          },
        ]}
        inverted={false}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <Feather name="lock" size={32} color={Colors.dark.secondary} />
            <ThemedText style={styles.emptyText}>
              Messages are end-to-end encrypted
            </ThemedText>
          </View>
        }
      />

      <View
        style={[
          styles.inputContainer,
          { paddingBottom: insets.bottom + Spacing.sm },
        ]}
      >
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor={Colors.dark.textDisabled}
          multiline
          maxLength={2000}
        />
        <Pressable
          onPress={sendMessage}
          disabled={!inputText.trim()}
          style={({ pressed }) => [
            styles.sendButton,
            !inputText.trim() && styles.sendButtonDisabled,
            pressed && styles.sendButtonPressed,
          ]}
        >
          <Feather
            name="send"
            size={20}
            color={inputText.trim() ? Colors.dark.buttonText : Colors.dark.textDisabled}
          />
        </Pressable>
      </View>
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
    paddingHorizontal: Spacing.lg,
  },
  messageBubble: {
    maxWidth: "75%",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginVertical: Spacing.xs,
  },
  messageBubbleMine: {
    backgroundColor: Colors.dark.messageSent,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  messageBubbleTheirs: {
    backgroundColor: Colors.dark.messageReceived,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
  },
  messageTextMine: {
    color: Colors.dark.buttonText,
  },
  messageTextTheirs: {
    color: Colors.dark.text,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: Spacing.xs,
  },
  lockIcon: {
    marginRight: 4,
  },
  messageTime: {
    fontSize: 10,
  },
  messageTimeMine: {
    color: Colors.dark.buttonText,
    opacity: 0.7,
  },
  messageTimeTheirs: {
    color: Colors.dark.textSecondary,
  },
  emptyMessages: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  inputContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.dark.backgroundDefault,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    color: Colors.dark.text,
    fontFamily: Fonts?.sans,
    marginRight: Spacing.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  sendButtonPressed: {
    opacity: 0.8,
  },
});
