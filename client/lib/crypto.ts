import * as openpgp from "openpgp/lightweight";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: "rsa",
    rsaBits: 2048,
    userIDs: [{ name: "CipherNode User", email: "user@ciphernode.local" }],
    format: "armored",
  });

  const publicKeyObj = await openpgp.readKey({ armoredKey: publicKey });
  const fingerprint = publicKeyObj.getFingerprint().toUpperCase();
  const id = generateShortId(fingerprint);

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
    const publicKey = await openpgp.readKey({ armoredKey: recipientPublicKey });
    
    const encrypted = await openpgp.encrypt({
      message: await openpgp.createMessage({ text: message }),
      encryptionKeys: publicKey,
    });

    return encrypted as string;
  } catch {
    return message;
  }
}

export async function decryptMessage(
  encryptedMessage: string,
  privateKeyArmored: string
): Promise<string> {
  if (!privateKeyArmored || !encryptedMessage.includes("-----BEGIN PGP MESSAGE-----")) {
    return encryptedMessage;
  }
  
  try {
    const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
    const message = await openpgp.readMessage({ armoredMessage: encryptedMessage });
    
    const { data: decrypted } = await openpgp.decrypt({
      message,
      decryptionKeys: privateKey,
    });

    return decrypted as string;
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
