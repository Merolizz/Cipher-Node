import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius, Fonts } from "@/constants/theme";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { createGroup, getContacts } from "@/lib/storage";
import { useIdentity } from "@/hooks/useIdentity";
import type { Contact } from "@/lib/crypto";

export default function CreateGroupScreen() {
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { identity } = useIdentity();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    getContacts().then(setContacts);
  }, []);

  const toggleContact = (contactId: string) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleCreateGroup = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a group name");
      return;
    }

    if (!identity) {
      Alert.alert("Error", "Identity not loaded");
      return;
    }

    setIsCreating(true);
    try {
      await createGroup(
        name.trim(),
        description.trim(),
        identity.id,
        identity.publicKey,
        identity.displayName || identity.id
      );

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert("Success", "Group created successfully", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to create group");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Group Info</ThemedText>

        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Group name"
            placeholderTextColor={Colors.dark.textDisabled}
            maxLength={50}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Description (optional)"
            placeholderTextColor={Colors.dark.textDisabled}
            multiline
            numberOfLines={3}
            maxLength={200}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>
          Add Members ({selectedContacts.length} selected)
        </ThemedText>

        {contacts.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="users" size={32} color={Colors.dark.textDisabled} />
            <ThemedText style={styles.emptyText}>
              No contacts yet. Add contacts first to create a group.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.contactList}>
            {contacts.map((contact) => (
              <Pressable
                key={contact.id}
                onPress={() => toggleContact(contact.id)}
                style={({ pressed }) => [
                  styles.contactRow,
                  selectedContacts.includes(contact.id) && styles.contactRowSelected,
                  pressed && styles.contactRowPressed,
                ]}
              >
                <View style={styles.contactAvatar}>
                  <Feather name="user" size={20} color={Colors.dark.secondary} />
                </View>
                <View style={styles.contactInfo}>
                  <ThemedText style={styles.contactName}>
                    {contact.displayName || contact.id}
                  </ThemedText>
                  <ThemedText style={styles.contactId}>{contact.id}</ThemedText>
                </View>
                {selectedContacts.includes(contact.id) ? (
                  <Feather name="check-circle" size={24} color={Colors.dark.primary} />
                ) : (
                  <Feather name="circle" size={24} color={Colors.dark.textDisabled} />
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Pressable
        onPress={handleCreateGroup}
        disabled={!name.trim() || isCreating}
        style={({ pressed }) => [
          styles.createButton,
          (!name.trim() || isCreating) && styles.createButtonDisabled,
          pressed && styles.createButtonPressed,
        ]}
      >
        <Feather name="users" size={20} color={Colors.dark.buttonText} />
        <ThemedText style={styles.createButtonText}>
          {isCreating ? "Creating..." : "Create Group"}
        </ThemedText>
      </Pressable>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    marginLeft: Spacing.sm,
  },
  inputGroup: {
    gap: Spacing.md,
  },
  input: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  contactList: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  contactRowSelected: {
    backgroundColor: Colors.dark.primary + "10",
  },
  contactRowPressed: {
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.dark.text,
  },
  contactId: {
    fontSize: 12,
    fontFamily: Fonts?.mono,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.sm,
    padding: Spacing["3xl"],
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonPressed: {
    opacity: 0.8,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.buttonText,
  },
});
