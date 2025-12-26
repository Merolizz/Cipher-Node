import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Contact } from "./crypto";

const CONTACTS_KEY = "@ciphernode/contacts";
const CHATS_KEY = "@ciphernode/chats";
const SETTINGS_KEY = "@ciphernode/settings";

export interface Message {
  id: string;
  content: string;
  encrypted: string;
  senderId: string;
  recipientId: string;
  timestamp: number;
  status: "sending" | "sent" | "delivered" | "read";
  expiresAt?: number;
}

export interface Chat {
  contactId: string;
  messages: Message[];
  lastMessageAt: number;
  unreadCount: number;
}

export interface AppSettings {
  serverUrl: string;
  defaultMessageTimer: number;
  displayName: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  serverUrl: "",
  defaultMessageTimer: 0,
  displayName: "",
};

export async function getContacts(): Promise<Contact[]> {
  try {
    const stored = await AsyncStorage.getItem(CONTACTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function addContact(contact: Contact): Promise<void> {
  const contacts = await getContacts();
  const exists = contacts.find((c) => c.id === contact.id);
  if (!exists) {
    contacts.push(contact);
    await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  }
}

export async function removeContact(contactId: string): Promise<void> {
  const contacts = await getContacts();
  const filtered = contacts.filter((c) => c.id !== contactId);
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(filtered));
}

export async function getContact(contactId: string): Promise<Contact | null> {
  const contacts = await getContacts();
  return contacts.find((c) => c.id === contactId) || null;
}

export async function getChats(): Promise<Chat[]> {
  try {
    const stored = await AsyncStorage.getItem(CHATS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function getChat(contactId: string): Promise<Chat | null> {
  const chats = await getChats();
  return chats.find((c) => c.contactId === contactId) || null;
}

export async function saveMessage(
  contactId: string,
  message: Message
): Promise<void> {
  const chats = await getChats();
  let chat = chats.find((c) => c.contactId === contactId);
  
  if (!chat) {
    chat = {
      contactId,
      messages: [],
      lastMessageAt: message.timestamp,
      unreadCount: 0,
    };
    chats.push(chat);
  }
  
  chat.messages.push(message);
  chat.lastMessageAt = message.timestamp;
  
  await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
}

export async function markChatAsRead(contactId: string): Promise<void> {
  const chats = await getChats();
  const chat = chats.find((c) => c.contactId === contactId);
  if (chat) {
    chat.unreadCount = 0;
    await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  }
}

export async function deleteChat(contactId: string): Promise<void> {
  const chats = await getChats();
  const filtered = chats.filter((c) => c.contactId !== contactId);
  await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(filtered));
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(
  updates: Partial<AppSettings>
): Promise<void> {
  const current = await getSettings();
  await AsyncStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ ...current, ...updates })
  );
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([
    CONTACTS_KEY,
    CHATS_KEY,
    SETTINGS_KEY,
    "@ciphernode/identity",
  ]);
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
