import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  FlatList,
  TextInput,
  StyleSheet,
  Pressable,
  Platform,
  KeyboardAvoidingView,
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
  getSettings,
  calculateExpiresAt,
  cleanupExpiredMessagesForChat,
  type Message,
} from "@/lib/storage";
import { encryptMessage, decryptMessage, type Contact, type UserIdentity } from "@/lib/crypto";
import { sendMessage as socketSendMessage, onMessage } from "@/lib/socket";
import type { ChatsStackParamList } from "@/navigation/ChatsStackNavigator";
import { useIdentity } from "@/hooks/useIdentity";

type NavigationProp = NativeStackNavigationProp<ChatsStackParamList, "ChatThread">;
type ScreenRouteProp = RouteProp<ChatsStackParamList, "ChatThread">;

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  currentTime: number;
  identity: UserIdentity | null;
  contact: Contact | null;
}

function formatRemainingTime(expiresAt: number, now: number): string {
  const remaining = expiresAt - now;
  if (remaining <= 0) return "";
  const seconds = Math.floor(remaining / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function MessageBubble({ message, isMine, currentTime, identity, contact }: MessageBubbleProps) {
  const [displayContent, setDisplayContent] = useState(message.content);
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    const decrypt = async () => {
      if (isMine) {
        setDisplayContent(message.content);
        setVerified(true);
        return;
      }

      if (!identity?.privateKey) {
        setDisplayContent(message.content);
        return;
      }

      const encryptedPayload = message.encrypted || message.content;
      const isEncrypted = encryptedPayload.includes("-----BEGIN PGP MESSAGE-----");
      
      if (isEncrypted) {
        const senderPublicKey = contact?.publicKey;
        const result = await decryptMessage(encryptedPayload, identity.privateKey, senderPublicKey);
        setDisplayContent(result.content);
        setVerified(result.verified);
      } else {
        setDisplayContent(message.content);
        setVerified(null);
      }
    };
    decrypt();
  }, [message.content, message.encrypted, identity, contact, isMine]);

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
        {displayContent}
      </ThemedText>
      <View style={styles.messageFooter}>
        {message.expiresAt ? (
          <View style={styles.timerContainer}>
            <Feather
              name="clock"
              size={10}
              color={isMine ? Colors.dark.buttonText : Colors.dark.warning}
              style={styles.lockIcon}
            />
            <ThemedText
              style={[
                styles.timerText,
                { color: isMine ? Colors.dark.buttonText : Colors.dark.warning },
              ]}
            >
              {formatRemainingTime(message.expiresAt, currentTime)}
            </ThemedText>
          </View>
        ) : (
          <Feather
            name={verified === false ? "alert-triangle" : "lock"}
            size={10}
            color={
              verified === false
                ? Colors.dark.warning
                : isMine
                  ? Colors.dark.buttonText
                  : Colors.dark.secondary
            }
            style={styles.lockIcon}
          />
        )}
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
  const [messageTimer, setMessageTimer] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const tickerInterval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(tickerInterval);
  }, []);

  const loadData = useCallback(async () => {
    await cleanupExpiredMessagesForChat(contactId);
    const [chatDataRaw, contactData, settings] = await Promise.all([
      getChat(contactId),
      getContact(contactId),
      getSettings(),
    ]);
    const clonedMessages = chatDataRaw?.messages.map(m => ({ ...m })) || [];
    setMessages(clonedMessages);
    setContact(contactData);
    setMessageTimer(settings.defaultMessageTimer);
    if (chatDataRaw) {
      await markChatAsRead(contactId);
    }
  }, [contactId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      await cleanupExpiredMessagesForChat(contactId);
      const chatData = await getChat(contactId);
      if (chatData) {
        const clonedMessages = chatData.messages.map(m => ({ ...m }));
        setMessages(clonedMessages);
      }
    }, 5000);
    return () => clearInterval(interval);
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

  useEffect(() => {
    const unsubscribe = onMessage(async (msg) => {
      if (msg.from === contactId && identity) {
        const receivedMessage: Message = {
          id: msg.id || generateMessageId(),
          content: msg.encrypted,
          encrypted: msg.encrypted,
          senderId: msg.from,
          recipientId: identity.id,
          timestamp: msg.timestamp,
          status: "received",
        };
        await saveMessage(contactId, receivedMessage);
        loadData();
      }
    });
    return unsubscribe;
  }, [contactId, identity, loadData]);

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || !identity || !contact) return;

    const messageId = generateMessageId();
    const plaintext = inputText.trim();
    let encryptedContent = plaintext;
    
    try {
      if (contact.publicKey && identity.privateKey) {
        encryptedContent = await encryptMessage(plaintext, contact.publicKey, identity.privateKey);
      } else if (contact.publicKey) {
        encryptedContent = await encryptMessage(plaintext, contact.publicKey);
      }
    } catch (error) {
      console.error("Encryption failed:", error);
    }

    const message: Message = {
      id: messageId,
      content: plaintext,
      encrypted: encryptedContent,
      senderId: identity.id,
      recipientId: contactId,
      timestamp: Date.now(),
      status: "sending",
      expiresAt: calculateExpiresAt(messageTimer),
    };

    await saveMessage(contactId, message);
    setMessages((prev) => [...prev, message]);
    setInputText("");

    socketSendMessage(contactId, encryptedContent, messageId);

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [inputText, identity, contact, contactId, messageTimer]);

  const bottomPadding = Math.max(insets.bottom, Spacing.md);

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={headerHeight}
      >
        <FlatList
          ref={flatListRef}
          style={styles.flatList}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isMine={item.senderId === identity?.id}
              currentTime={currentTime}
              identity={identity}
              contact={contact}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingTop: headerHeight + Spacing.lg,
              paddingBottom: Spacing.md,
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

        <View style={[styles.inputContainer, { paddingBottom: bottomPadding }]}>
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
            onPress={handleSendMessage}
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
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  keyboardView: {
    flex: 1,
  },
  flatList: {
    flex: 1,
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
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 6,
  },
  timerText: {
    fontSize: 10,
    fontWeight: "600",
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
