import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  TextInput,
  StyleSheet,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing, BorderRadius, Fonts } from "@/constants/theme";
import { useIdentity } from "@/hooks/useIdentity";
import { getSettings, updateSettings } from "@/lib/storage";
import type { SettingsStackParamList } from "@/navigation/SettingsStackNavigator";

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, "Settings">;

interface SettingsRowProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

function SettingsRow({ icon, title, subtitle, onPress, rightElement }: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        pressed && onPress && styles.settingsRowPressed,
      ]}
    >
      <View style={styles.settingsRowIcon}>
        <Feather name={icon as any} size={20} color={Colors.dark.primary} />
      </View>
      <View style={styles.settingsRowContent}>
        <ThemedText style={styles.settingsRowTitle}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText style={styles.settingsRowSubtitle}>{subtitle}</ThemedText>
        ) : null}
      </View>
      {rightElement ? (
        rightElement
      ) : onPress ? (
        <Feather name="chevron-right" size={20} color={Colors.dark.textSecondary} />
      ) : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { identity, setDisplayName } = useIdentity();

  const [displayNameInput, setDisplayNameInput] = useState("");
  const [defaultTimer, setDefaultTimer] = useState(0);

  useEffect(() => {
    if (identity?.displayName) {
      setDisplayNameInput(identity.displayName);
    }
    getSettings().then((s) => setDefaultTimer(s.defaultMessageTimer));
  }, [identity]);

  const handleDisplayNameChange = async () => {
    if (displayNameInput !== identity?.displayName) {
      await setDisplayName(displayNameInput);
      await updateSettings({ displayName: displayNameInput });
    }
  };

  const timerLabels: Record<number, string> = {
    0: "Off",
    30: "30 seconds",
    60: "1 minute",
    300: "5 minutes",
    3600: "1 hour",
    86400: "1 day",
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
      >
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Identity</ThemedText>
          <View style={styles.sectionContent}>
            <View style={styles.idDisplayRow}>
              <ThemedText style={styles.idLabel}>Your ID</ThemedText>
              <ThemedText style={styles.idValue}>{identity?.id || "..."}</ThemedText>
            </View>
            <View style={styles.inputRow}>
              <ThemedText style={styles.inputLabel}>Display Name</ThemedText>
              <TextInput
                style={styles.input}
                value={displayNameInput}
                onChangeText={setDisplayNameInput}
                onBlur={handleDisplayNameChange}
                placeholder="Optional name"
                placeholderTextColor={Colors.dark.textDisabled}
                maxLength={30}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Privacy</ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="clock"
              title="Default Message Timer"
              subtitle={timerLabels[defaultTimer] || "Off"}
              onPress={() => {}}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Network</ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="server"
              title="Server Settings"
              subtitle="Configure relay server"
              onPress={() => navigation.navigate("NetworkSettings")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Security</ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="key"
              title="Key Management"
              subtitle="Export or regenerate keys"
              onPress={() => navigation.navigate("SecuritySettings")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>About</ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="info"
              title="About CipherNode"
              subtitle="Version, licenses, source"
              onPress={() => navigation.navigate("About")}
            />
          </View>
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
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  sectionContent: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  settingsRowPressed: {
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  settingsRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  settingsRowContent: {
    flex: 1,
  },
  settingsRowTitle: {
    fontSize: 16,
    color: Colors.dark.text,
  },
  settingsRowSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  idDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  idLabel: {
    fontSize: 16,
    color: Colors.dark.text,
  },
  idValue: {
    fontSize: 16,
    fontFamily: Fonts?.mono,
    fontWeight: "600",
    color: Colors.dark.primary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
  },
  inputLabel: {
    fontSize: 16,
    color: Colors.dark.text,
    marginRight: Spacing.lg,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.dark.text,
    textAlign: "right",
    padding: 0,
  },
});
