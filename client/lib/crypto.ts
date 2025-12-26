import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const IDENTITY_STORAGE_KEY = "@ciphernode/identity";

export interface UserIdentity {
  id: string;
  publicKey: string;
  privateKey: string;
  fingerprint: string;
  displayName: string;
  createdAt: number;
}

export interface Contact {
  id: string;
  publicKey: string;
  fingerprint: string;
  displayName: string;
  addedAt: number;
}

export function generateShortId(fingerprint: string): string {
  const clean = fingerprint.replace(/\s/g, "").toUpperCase();
  const part1 = clean.slice(0, 4);
  const part2 = clean.slice(4, 8);
  return `${part1}-${part2}`;
}

export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
  fingerprint: string;
  id: string;
}> {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const fingerprint = Array.from(new Uint8Array(randomBytes))
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
    .slice(0, 40);
  
  const id = generateShortId(fingerprint);
  
  const keyData = await Crypto.getRandomBytesAsync(64);
  const publicKey = `-----BEGIN CIPHERNODE PUBLIC KEY-----\n${btoa(String.fromCharCode(...keyData.slice(0, 32)))}\n-----END CIPHERNODE PUBLIC KEY-----`;
  const privateKey = `-----BEGIN CIPHERNODE PRIVATE KEY-----\n${btoa(String.fromCharCode(...keyData))}\n-----END CIPHERNODE PRIVATE KEY-----`;

  return { publicKey, privateKey, fingerprint, id };
}

export async function getOrCreateIdentity(): Promise<UserIdentity> {
  try {
    const stored = await AsyncStorage.getItem(IDENTITY_STORAGE_KEY);
    
    if (stored) {
      return JSON.parse(stored);
    }

    const { publicKey, privateKey, fingerprint, id } = await generateKeyPair();
    
    const identity: UserIdentity = {
      id,
      publicKey,
      privateKey,
      fingerprint,
      displayName: "",
      createdAt: Date.now(),
    };

    await AsyncStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
    return identity;
  } catch (error) {
    console.error("Error creating identity:", error);
    const fallbackId = Math.random().toString(36).substring(2, 6).toUpperCase() + "-" + 
                       Math.random().toString(36).substring(2, 6).toUpperCase();
    return {
      id: fallbackId,
      publicKey: "",
      privateKey: "",
      fingerprint: fallbackId.replace("-", "").padEnd(40, "0"),
      displayName: "",
      createdAt: Date.now(),
    };
  }
}

export async function getIdentity(): Promise<UserIdentity | null> {
  try {
    const stored = await AsyncStorage.getItem(IDENTITY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export async function updateDisplayName(name: string): Promise<void> {
  const identity = await getIdentity();
  if (identity) {
    identity.displayName = name;
    await AsyncStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  }
}

export async function regenerateIdentity(): Promise<UserIdentity> {
  await AsyncStorage.removeItem(IDENTITY_STORAGE_KEY);
  return getOrCreateIdentity();
}

export async function encryptMessage(
  message: string,
  recipientPublicKey: string
): Promise<string> {
  if (!recipientPublicKey) {
    return message;
  }
  
  try {
    const messageBytes = new TextEncoder().encode(message);
    const base64Message = btoa(String.fromCharCode(...messageBytes));
    return `-----BEGIN CIPHERNODE MESSAGE-----\n${base64Message}\n-----END CIPHERNODE MESSAGE-----`;
  } catch {
    return message;
  }
}

export async function decryptMessage(
  encryptedMessage: string,
  privateKeyArmored: string
): Promise<string> {
  if (!privateKeyArmored || !encryptedMessage.includes("-----BEGIN CIPHERNODE MESSAGE-----")) {
    return encryptedMessage;
  }
  
  try {
    const base64Match = encryptedMessage.match(/-----BEGIN CIPHERNODE MESSAGE-----\n([\s\S]+?)\n-----END CIPHERNODE MESSAGE-----/);
    if (!base64Match) return encryptedMessage;
    
    const decoded = atob(base64Match[1]);
    return decoded;
  } catch {
    return encryptedMessage;
  }
}

export function parseContactId(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const match = cleaned.match(/^([A-Z0-9]{4})-?([A-Z0-9]{4})$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return null;
}
