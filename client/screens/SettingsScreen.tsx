import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  TextInput,
  StyleSheet,
  Pressable,
  Switch,
  Platform,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing, BorderRadius, Fonts } from "@/constants/theme";
import { useIdentity } from "@/hooks/useIdentity";
import { getSettings, updateSettings, getPrivacySettings, updatePrivacySettings, type PrivacySettings } from "@/lib/storage";
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
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    screenProtection: false,
    biometricLock: false,
    autoMetadataScrubbing: true,
    steganographyMode: false,
    ghostMode: false,
    p2pOnlyMode: false,
    lowPowerMode: false,
  });
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    if (identity?.displayName) {
      setDisplayNameInput(identity.displayName);
    }
    getSettings().then((s) => setDefaultTimer(s.defaultMessageTimer));
    getPrivacySettings().then(setPrivacySettings);
    LocalAuthentication.hasHardwareAsync().then(setBiometricAvailable);
  }, [identity]);

  const handleDisplayNameChange = async () => {
    if (displayNameInput !== identity?.displayName) {
      await setDisplayName(displayNameInput);
      await updateSettings({ displayName: displayNameInput });
    }
  };

  const handleToggle = useCallback(async (key: keyof PrivacySettings, value: boolean) => {
    if (key === "biometricLock" && value) {
      if (Platform.OS === "web") {
        Alert.alert("Biometrik Kilit", "Bu ozellik sadece mobil cihazlarda kullanilabilir.");
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Biyometrik kilidi etkinlestirmek icin dogrulayin",
        fallbackLabel: "Sifre kullan",
      });
      if (!result.success) {
        return;
      }
    }
    setPrivacySettings((prev) => ({ ...prev, [key]: value }));
    await updatePrivacySettings({ [key]: value });
  }, []);

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
          <ThemedText style={styles.sectionTitle}>Gizlilik</ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="clock"
              title="Varsayilan Mesaj Zamanlayicisi"
              subtitle={timerLabels[defaultTimer] || "Kapali"}
              onPress={() => {}}
            />
            <SettingsRow
              icon="eye-off"
              title="Ekran Korumasi"
              subtitle="Ekran goruntusu ve kaydi engeller"
              rightElement={
                <Switch
                  value={privacySettings.screenProtection}
                  onValueChange={(v) => handleToggle("screenProtection", v)}
                  trackColor={{ false: Colors.dark.border, true: Colors.dark.primary }}
                  thumbColor={privacySettings.screenProtection ? Colors.dark.text : Colors.dark.textSecondary}
                />
              }
            />
            <SettingsRow
              icon="lock"
              title="Biyometrik Kilit"
              subtitle={biometricAvailable ? "Parmak izi ile giris" : "Cihaz desteklemiyor"}
              rightElement={
                <Switch
                  value={privacySettings.biometricLock}
                  onValueChange={(v) => handleToggle("biometricLock", v)}
                  trackColor={{ false: Colors.dark.border, true: Colors.dark.primary }}
                  thumbColor={privacySettings.biometricLock ? Colors.dark.text : Colors.dark.textSecondary}
                  disabled={!biometricAvailable && Platform.OS !== "web"}
                />
              }
            />
            <SettingsRow
              icon="image"
              title="Otomatik Metadata Temizligi"
              subtitle="Medya gonderirken EXIF verilerini temizler"
              rightElement={
                <Switch
                  value={privacySettings.autoMetadataScrubbing}
                  onValueChange={(v) => handleToggle("autoMetadataScrubbing", v)}
                  trackColor={{ false: Colors.dark.border, true: Colors.dark.primary }}
                  thumbColor={privacySettings.autoMetadataScrubbing ? Colors.dark.text : Colors.dark.textSecondary}
                />
              }
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Guvenlik ve Gizlilik</ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="layers"
              title="Steganografi Modu"
              subtitle="Mesajlari gorsellere gizleyerek gonderir"
              rightElement={
                <Switch
                  value={privacySettings.steganographyMode}
                  onValueChange={(v) => handleToggle("steganographyMode", v)}
                  trackColor={{ false: Colors.dark.border, true: Colors.dark.secondary }}
                  thumbColor={privacySettings.steganographyMode ? Colors.dark.text : Colors.dark.textSecondary}
                />
              }
            />
            <SettingsRow
              icon="user-x"
              title="Hayalet Modu"
              subtitle="Yaziyor ve okundu bilgisini gizler"
              rightElement={
                <Switch
                  value={privacySettings.ghostMode}
                  onValueChange={(v) => handleToggle("ghostMode", v)}
                  trackColor={{ false: Colors.dark.border, true: Colors.dark.secondary }}
                  thumbColor={privacySettings.ghostMode ? Colors.dark.text : Colors.dark.textSecondary}
                />
              }
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Performans</ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="wifi"
              title="Sadece P2P Modu"
              subtitle="Relay sunucularini devre disi birakir"
              rightElement={
                <Switch
                  value={privacySettings.p2pOnlyMode}
                  onValueChange={(v) => handleToggle("p2pOnlyMode", v)}
                  trackColor={{ false: Colors.dark.border, true: Colors.dark.warning }}
                  thumbColor={privacySettings.p2pOnlyMode ? Colors.dark.text : Colors.dark.textSecondary}
                />
              }
            />
            <SettingsRow
              icon="battery"
              title="Dusuk Guc Modu"
              subtitle="Animasyonlari ve UI efektlerini kapatir"
              rightElement={
                <Switch
                  value={privacySettings.lowPowerMode}
                  onValueChange={(v) => handleToggle("lowPowerMode", v)}
                  trackColor={{ false: Colors.dark.border, true: Colors.dark.warning }}
                  thumbColor={privacySettings.lowPowerMode ? Colors.dark.text : Colors.dark.textSecondary}
                />
              }
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Ag</ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="server"
              title="Sunucu Ayarlari"
              subtitle="Relay sunucusunu yapilandir"
              onPress={() => navigation.navigate("NetworkSettings")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Guvenlik</ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="key"
              title="Anahtar Yonetimi"
              subtitle="Anahtarlari disa aktar veya yeniden olustur"
              onPress={() => navigation.navigate("SecuritySettings")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Hakkinda</ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="info"
              title="CipherNode Hakkinda"
              subtitle="Surum, lisanslar, kaynak kodu"
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
