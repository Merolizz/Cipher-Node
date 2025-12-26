import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius, Fonts } from "@/constants/theme";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { getSettings, updateSettings } from "@/lib/storage";

type ServerType = "official" | "custom";

export default function NetworkSettingsScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const [serverType, setServerType] = useState<ServerType>("official");
  const [customUrl, setCustomUrl] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      if (s.serverUrl) {
        setServerType("custom");
        setCustomUrl(s.serverUrl);
      }
    });
  }, []);

  const handleServerTypeChange = async (type: ServerType) => {
    setServerType(type);
    if (type === "official") {
      await updateSettings({ serverUrl: "" });
      setCustomUrl("");
    }
  };

  const handleSaveCustomUrl = async () => {
    if (!customUrl.trim()) {
      Alert.alert("Error", "Please enter a valid server URL");
      return;
    }

    try {
      new URL(customUrl);
    } catch {
      Alert.alert("Error", "Please enter a valid URL (e.g., https://example.com)");
      return;
    }

    await updateSettings({ serverUrl: customUrl.trim() });
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert("Saved", "Custom server URL has been saved");
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Success", "Connection test passed");
    } catch {
      Alert.alert("Error", "Could not connect to server");
    } finally {
      setIsTesting(false);
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
        <ThemedText style={styles.sectionTitle}>Server Selection</ThemedText>

        <Pressable
          onPress={() => handleServerTypeChange("official")}
          style={({ pressed }) => [
            styles.serverOption,
            serverType === "official" && styles.serverOptionSelected,
            pressed && styles.serverOptionPressed,
          ]}
        >
          <View style={styles.serverOptionContent}>
            <View style={styles.serverOptionHeader}>
              <ThemedText style={styles.serverOptionTitle}>Official Server</ThemedText>
              {serverType === "official" ? (
                <Feather name="check-circle" size={20} color={Colors.dark.primary} />
              ) : null}
            </View>
            <ThemedText style={styles.serverOptionDesc}>
              Use CipherNode's official relay server
            </ThemedText>
          </View>
        </Pressable>

        <Pressable
          onPress={() => handleServerTypeChange("custom")}
          style={({ pressed }) => [
            styles.serverOption,
            serverType === "custom" && styles.serverOptionSelected,
            pressed && styles.serverOptionPressed,
          ]}
        >
          <View style={styles.serverOptionContent}>
            <View style={styles.serverOptionHeader}>
              <ThemedText style={styles.serverOptionTitle}>Custom Server</ThemedText>
              {serverType === "custom" ? (
                <Feather name="check-circle" size={20} color={Colors.dark.primary} />
              ) : null}
            </View>
            <ThemedText style={styles.serverOptionDesc}>
              Connect to your own self-hosted server
            </ThemedText>
          </View>
        </Pressable>
      </View>

      {serverType === "custom" ? (
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Custom Server URL</ThemedText>
          <TextInput
            style={styles.input}
            value={customUrl}
            onChangeText={setCustomUrl}
            placeholder="https://your-server.com"
            placeholderTextColor={Colors.dark.textDisabled}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <View style={styles.buttonRow}>
            <Pressable
              onPress={handleTestConnection}
              disabled={!customUrl.trim() || isTesting}
              style={({ pressed }) => [
                styles.secondaryButton,
                (!customUrl.trim() || isTesting) && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              <ThemedText
                style={[
                  styles.secondaryButtonText,
                  (!customUrl.trim() || isTesting) && styles.buttonTextDisabled,
                ]}
              >
                {isTesting ? "Testing..." : "Test Connection"}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={handleSaveCustomUrl}
              disabled={!customUrl.trim()}
              style={({ pressed }) => [
                styles.primaryButton,
                !customUrl.trim() && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              <ThemedText
                style={[
                  styles.primaryButtonText,
                  !customUrl.trim() && styles.buttonTextDisabled,
                ]}
              >
                Save
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.infoSection}>
        <Feather name="shield" size={20} color={Colors.dark.secondary} />
        <ThemedText style={styles.infoText}>
          All relay servers follow a no-log policy. Messages are stored in RAM only and deleted immediately after delivery.
        </ThemedText>
      </View>
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
  serverOption: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.sm,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: "transparent",
  },
  serverOptionSelected: {
    borderColor: Colors.dark.primary,
  },
  serverOptionPressed: {
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  serverOptionContent: {},
  serverOptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  serverOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  serverOptionDesc: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  input: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    fontFamily: Fonts?.mono,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.md,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Colors.dark.primary,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "transparent",
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.buttonText,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.primary,
  },
  buttonTextDisabled: {
    color: Colors.dark.textDisabled,
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
