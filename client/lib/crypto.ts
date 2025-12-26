import "react-native-get-random-values";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as openpgp from "openpgp";

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
    userIDs: [{ name: "CipherNode User" }],
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
  } catch (error) {
    console.error("Encryption error:", error);
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
    
    const message = await openpgp.readMessage({
      armoredMessage: encryptedMessage,
    });

    const { data: decrypted } = await openpgp.decrypt({
      message,
      decryptionKeys: privateKey,
    });

    return decrypted as string;
  } catch (error) {
    console.error("Decryption error:", error);
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

export async function signMessage(message: string, privateKeyArmored: string): Promise<string> {
  try {
    const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
    
    const signed = await openpgp.sign({
      message: await openpgp.createCleartextMessage({ text: message }),
      signingKeys: privateKey,
    });

    return signed;
  } catch (error) {
    console.error("Signing error:", error);
    return message;
  }
}

export async function verifySignature(
  signedMessage: string,
  publicKeyArmored: string
): Promise<{ verified: boolean; content: string }> {
  try {
    const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
    
    const verified = await openpgp.verify({
      message: await openpgp.readCleartextMessage({ cleartextMessage: signedMessage }),
      verificationKeys: publicKey,
    });

    const { verified: verificationResult, data } = verified.signatures[0] 
      ? { verified: await verified.signatures[0].verified, data: verified.data }
      : { verified: false, data: signedMessage };

    return { verified: verificationResult, content: data as string };
  } catch (error) {
    console.error("Verification error:", error);
    return { verified: false, content: signedMessage };
  }
}

export async function exportPublicKey(identity: UserIdentity): Promise<string> {
  return identity.publicKey;
}

export async function importContactFromPublicKey(
  publicKeyArmored: string,
  displayName: string
): Promise<Contact | null> {
  try {
    const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored });
    const fingerprint = publicKey.getFingerprint().toUpperCase();
    const id = generateShortId(fingerprint);

    return {
      id,
      publicKey: publicKeyArmored,
      fingerprint,
      displayName,
      addedAt: Date.now(),
    };
  } catch (error) {
    console.error("Import contact error:", error);
    return null;
  }
}
