import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing, BorderRadius, Fonts } from "@/constants/theme";
import { useIdentity } from "@/hooks/useIdentity";
import { clearAllData } from "@/lib/storage";

export default function SecuritySettingsScreen() {
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { identity, regenerate } = useIdentity();

  const [showFingerprint, setShowFingerprint] = useState(false);

  const handleExportPublicKey = async () => {
    if (identity?.publicKey) {
      await Clipboard.setStringAsync(identity.publicKey);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Copied", "Your public key has been copied to clipboard");
    }
  };

  const handleRegenerateKeys = () => {
    Alert.alert(
      "Regenerate Keys",
      "This will create a new identity and delete all your contacts and messages. This action cannot be undone.\n\nAre you sure you want to continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Regenerate",
          style: "destructive",
          onPress: async () => {
            await clearAllData();
            await regenerate();
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert("Success", "New identity has been generated");
          },
        },
      ]
    );
  };

  const formatFingerprint = (fp: string) => {
    return fp.replace(/(.{4})/g, "$1 ").trim();
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Encryption Status</ThemedText>
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.statusIcon}>
                <Feather name="shield" size={24} color={Colors.dark.success} />
              </View>
              <View>
                <ThemedText style={styles.statusTitle}>End-to-End Encrypted</ThemedText>
                <ThemedText style={styles.statusSubtitle}>
                  AES-256 + RSA (OpenPGP)
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Your Public Key</ThemedText>
          <View style={styles.keyCard}>
            <View style={styles.keyHeader}>
              <ThemedText style={styles.keyLabel}>Fingerprint</ThemedText>
              <Pressable
                onPress={() => setShowFingerprint(!showFingerprint)}
                style={({ pressed }) => [
                  styles.expandButton,
                  pressed && styles.expandButtonPressed,
                ]}
              >
                <ThemedText style={styles.expandButtonText}>
                  {showFingerprint ? "Hide" : "Show"}
                </ThemedText>
              </Pressable>
            </View>
            {showFingerprint ? (
              <ThemedText style={styles.fingerprint}>
                {formatFingerprint(identity?.fingerprint || "")}
              </ThemedText>
            ) : null}

            <Pressable
              onPress={handleExportPublicKey}
              style={({ pressed }) => [
                styles.exportButton,
                pressed && styles.exportButtonPressed,
              ]}
            >
              <Feather name="copy" size={18} color={Colors.dark.primary} />
              <ThemedText style={styles.exportButtonText}>
                Copy Public Key
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Danger Zone</ThemedText>
          <View style={styles.dangerCard}>
            <ThemedText style={styles.dangerTitle}>Regenerate Identity</ThemedText>
            <ThemedText style={styles.dangerText}>
              This will create a new cryptographic identity. All your contacts and messages will be permanently deleted.
            </ThemedText>
            <Pressable
              onPress={handleRegenerateKeys}
              style={({ pressed }) => [
                styles.dangerButton,
                pressed && styles.dangerButtonPressed,
              ]}
            >
              <Feather name="refresh-cw" size={18} color={Colors.dark.error} />
              <ThemedText style={styles.dangerButtonText}>
                Regenerate Keys
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Feather name="info" size={18} color={Colors.dark.secondary} />
          <ThemedText style={styles.infoText}>
            Your private key never leaves your device. Only you can decrypt messages sent to you.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
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
  statusCard: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.sm,
    padding: Spacing.lg,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.success + "20",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.success,
  },
  statusSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  keyCard: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.sm,
    padding: Spacing.lg,
  },
  keyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  keyLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  expandButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  expandButtonPressed: {
    opacity: 0.6,
  },
  expandButtonText: {
    fontSize: 14,
    color: Colors.dark.primary,
  },
  fingerprint: {
    fontSize: 12,
    fontFamily: Fonts?.mono,
    color: Colors.dark.text,
    backgroundColor: Colors.dark.backgroundSecondary,
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.md,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    gap: Spacing.sm,
  },
  exportButtonPressed: {
    opacity: 0.6,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.primary,
  },
  dangerCard: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.sm,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.error + "40",
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.sm,
  },
  dangerText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.lg,
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.dark.error,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  dangerButtonPressed: {
    backgroundColor: Colors.dark.error + "20",
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.error,
  },
  infoSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
});
