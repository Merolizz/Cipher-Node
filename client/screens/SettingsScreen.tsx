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
  Modal,
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
import { getSettings, updateSettings, getPrivacySettings, updatePrivacySettings, getTorSettings, updateTorSettings, setLanguage as saveLanguage, type PrivacySettings, type TorSettings } from "@/lib/storage";
import { reconnectWithTor } from "@/lib/socket";
import { SUPPORTED_LANGUAGES, type Language, useLanguage } from "@/constants/language";
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
  const { language: currentLanguage, setLanguage: setContextLanguage } = useLanguage();

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
  const [torSettings, setTorSettings] = useState<TorSettings>({
    enabled: false,
    proxyHost: "127.0.0.1",
    proxyPort: 9050,
    connectionStatus: "disconnected",
  });
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [showTorModal, setShowTorModal] = useState(false);
  const [torProxyInput, setTorProxyInput] = useState("127.0.0.1:9050");

  useEffect(() => {
    if (identity?.displayName) {
      setDisplayNameInput(identity.displayName);
    }
    getSettings().then((s) => {
      setDefaultTimer(s.defaultMessageTimer);
    });
    getPrivacySettings().then(setPrivacySettings);
    getTorSettings().then((t) => {
      setTorSettings(t);
      setTorProxyInput(`${t.proxyHost}:${t.proxyPort}`);
    });
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
        Alert.alert(
          currentLanguage === "tr" ? "Biyometrik Kilit" : "Biometric Lock",
          currentLanguage === "tr" ? "Bu ozellik sadece mobil cihazlarda kullanilabilir." : "This feature is only available on mobile devices."
        );
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: currentLanguage === "tr" ? "Biyometrik kilidi etkinlestirmek icin dogrulayin" : "Authenticate to enable biometric lock",
        fallbackLabel: currentLanguage === "tr" ? "Sifre kullan" : "Use password",
      });
      if (!result.success) {
        return;
      }
    }
    setPrivacySettings((prev) => ({ ...prev, [key]: value }));
    await updatePrivacySettings({ [key]: value });
  }, [currentLanguage]);

  const timerLabels: Record<number, string> = {
    0: currentLanguage === "tr" ? "Kapali" : "Off",
    30: currentLanguage === "tr" ? "30 saniye" : "30 seconds",
    60: currentLanguage === "tr" ? "1 dakika" : "1 minute",
    300: currentLanguage === "tr" ? "5 dakika" : "5 minutes",
    3600: currentLanguage === "tr" ? "1 saat" : "1 hour",
    86400: currentLanguage === "tr" ? "1 gun" : "1 day",
  };

  const timerOptions = [0, 30, 60, 300, 3600, 86400];

  const handleTimerChange = async (timer: number) => {
    setDefaultTimer(timer);
    await updateSettings({ defaultMessageTimer: timer });
    setShowTimerModal(false);
  };

  const handleLanguageChange = async (lang: Language) => {
    setContextLanguage(lang);
    await saveLanguage(lang);
    setShowLanguageModal(false);
  };

  const handleTorToggle = async (enabled: boolean) => {
    if (enabled) {
      setTorSettings((prev) => ({ ...prev, enabled: true, connectionStatus: "connecting" }));
      await updateTorSettings({ enabled: true, connectionStatus: "connecting" });
      try {
        await reconnectWithTor();
        setTorSettings((prev) => ({ ...prev, connectionStatus: "connected" }));
        await updateTorSettings({ connectionStatus: "connected" });
      } catch {
        setTorSettings((prev) => ({ ...prev, connectionStatus: "error" }));
        await updateTorSettings({ connectionStatus: "error" });
      }
    } else {
      setTorSettings((prev) => ({ ...prev, enabled: false, connectionStatus: "disconnected" }));
      await updateTorSettings({ enabled: false, connectionStatus: "disconnected" });
      try {
        await reconnectWithTor();
      } catch {
      }
    }
  };

  const handleTorProxySave = async () => {
    const parts = torProxyInput.split(":");
    if (parts.length === 2) {
      const host = parts[0];
      const port = parseInt(parts[1], 10);
      if (!isNaN(port)) {
        setTorSettings((prev) => ({ ...prev, proxyHost: host, proxyPort: port }));
        await updateTorSettings({ proxyHost: host, proxyPort: port });
        setShowTorModal(false);
        return;
      }
    }
    Alert.alert(
      currentLanguage === "tr" ? "Gecersiz Format" : "Invalid Format",
      currentLanguage === "tr" ? "Lutfen host:port formatinda girin (ornek: 127.0.0.1:9050)" : "Please enter in host:port format (example: 127.0.0.1:9050)"
    );
  };

  const getTorStatusText = () => {
    switch (torSettings.connectionStatus) {
      case "connected":
        return currentLanguage === "tr" ? "Bagli" : "Connected";
      case "connecting":
        return currentLanguage === "tr" ? "Baglaniyor..." : "Connecting...";
      case "error":
        return currentLanguage === "tr" ? "Hata" : "Error";
      default:
        return currentLanguage === "tr" ? "Bagli Degil" : "Disconnected";
    }
  };

  const getTorStatusColor = () => {
    switch (torSettings.connectionStatus) {
      case "connected":
        return Colors.dark.success;
      case "connecting":
        return Colors.dark.warning;
      case "error":
        return Colors.dark.error;
      default:
        return Colors.dark.textSecondary;
    }
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
          <ThemedText style={styles.sectionTitle}>
            {currentLanguage === "tr" ? "Kimlik" : "Identity"}
          </ThemedText>
          <View style={styles.sectionContent}>
            <View style={styles.idDisplayRow}>
              <ThemedText style={styles.idLabel}>
                {currentLanguage === "tr" ? "Kimliginiz" : "Your ID"}
              </ThemedText>
              <ThemedText style={styles.idValue}>{identity?.id || "..."}</ThemedText>
            </View>
            <View style={styles.inputRow}>
              <ThemedText style={styles.inputLabel}>
                {currentLanguage === "tr" ? "Gosterim Adi" : "Display Name"}
              </ThemedText>
              <TextInput
                style={styles.input}
                value={displayNameInput}
                onChangeText={setDisplayNameInput}
                onBlur={handleDisplayNameChange}
                placeholder={currentLanguage === "tr" ? "Opsiyonel ad" : "Optional name"}
                placeholderTextColor={Colors.dark.textDisabled}
                maxLength={30}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            {currentLanguage === "tr" ? "Gizlilik" : "Privacy"}
          </ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="clock"
              title={currentLanguage === "tr" ? "Varsayilan Mesaj Zamanlayicisi" : "Default Message Timer"}
              subtitle={timerLabels[defaultTimer] || (currentLanguage === "tr" ? "Kapali" : "Off")}
              onPress={() => setShowTimerModal(true)}
            />
            <SettingsRow
              icon="eye-off"
              title={currentLanguage === "tr" ? "Ekran Korumasi" : "Screen Protection"}
              subtitle={currentLanguage === "tr" ? "Ekran goruntusu ve kaydi engelle" : "Prevent screenshots and screen recording"}
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
              title={currentLanguage === "tr" ? "Biyometrik Kilit" : "Biometric Lock"}
              subtitle={biometricAvailable ? (currentLanguage === "tr" ? "Parmak izi ile giris" : "Require fingerprint to open app") : (currentLanguage === "tr" ? "Cihaz desteklemiyor" : "Device not supported")}
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
              title={currentLanguage === "tr" ? "Otomatik Metadata Temizligi" : "Auto Metadata Scrubbing"}
              subtitle={currentLanguage === "tr" ? "Medya gonderirken EXIF verilerini temizler" : "Remove EXIF data from images automatically"}
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
          <ThemedText style={styles.sectionTitle}>
            {currentLanguage === "tr" ? "Guvenlik" : "Security"}
          </ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="layers"
              title={currentLanguage === "tr" ? "Steganografi Modu" : "Steganography Mode"}
              subtitle={currentLanguage === "tr" ? "Mesajlari gorsellere gizleyerek gonderir" : "Hide messages inside images"}
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
              title={currentLanguage === "tr" ? "Hayalet Modu" : "Ghost Mode"}
              subtitle={currentLanguage === "tr" ? "Yaziyor ve okundu bilgisini gizler" : "Hide typing indicator and read receipts"}
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
          <ThemedText style={styles.sectionTitle}>
            {currentLanguage === "tr" ? "Performans" : "Performance"}
          </ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="wifi"
              title={currentLanguage === "tr" ? "Sadece P2P Modu" : "P2P Only Mode"}
              subtitle={currentLanguage === "tr" ? "Relay sunucularini devre disi birakir" : "Use direct connections only"}
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
              title={currentLanguage === "tr" ? "Dusuk Guc Modu" : "Low Power Mode"}
              subtitle={currentLanguage === "tr" ? "Animasyonlari ve UI efektlerini kapatir" : "Reduce animations and effects"}
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
          <ThemedText style={styles.sectionTitle}>
            {currentLanguage === "tr" ? "Dil" : "Language"}
          </ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="globe"
              title={currentLanguage === "tr" ? "Dili Degistir" : "Change Language"}
              subtitle={SUPPORTED_LANGUAGES[currentLanguage]}
              onPress={() => setShowLanguageModal(true)}
            />
          </View>
        </View>

        <Modal visible={showLanguageModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedText style={styles.modalTitle}>
                {currentLanguage === "tr" ? "Dil Secin" : "Select Language"}
              </ThemedText>
              {(Object.keys(SUPPORTED_LANGUAGES) as Language[]).map((lang) => (
                <Pressable
                  key={lang}
                  onPress={() => handleLanguageChange(lang)}
                  style={[
                    styles.languageOption,
                    currentLanguage === lang && styles.languageOptionSelected,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.languageOptionText,
                      currentLanguage === lang && styles.languageOptionTextSelected,
                    ]}
                  >
                    {SUPPORTED_LANGUAGES[lang]}
                  </ThemedText>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setShowLanguageModal(false)}
                style={styles.modalCloseButton}
              >
                <ThemedText style={styles.modalCloseButtonText}>
                  {currentLanguage === "tr" ? "Kapat" : "Close"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={showTimerModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedText style={styles.modalTitle}>
                {currentLanguage === "tr" ? "Mesaj Zamanlayicisini Ayarla" : "Set Message Timer"}
              </ThemedText>
              {timerOptions.map((timer) => (
                <Pressable
                  key={timer}
                  onPress={() => handleTimerChange(timer)}
                  style={[
                    styles.languageOption,
                    defaultTimer === timer && styles.languageOptionSelected,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.languageOptionText,
                      defaultTimer === timer && styles.languageOptionTextSelected,
                    ]}
                  >
                    {timerLabels[timer]}
                  </ThemedText>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setShowTimerModal(false)}
                style={styles.modalCloseButton}
              >
                <ThemedText style={styles.modalCloseButtonText}>
                  {currentLanguage === "tr" ? "Kapat" : "Close"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={showTorModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedText style={styles.modalTitle}>
                {currentLanguage === "tr" ? "Tor Proxy Ayarlari" : "Tor Proxy Settings"}
              </ThemedText>
              <ThemedText style={styles.settingsRowSubtitle}>
                {currentLanguage === "tr" ? "Host:Port formatinda girin" : "Enter in Host:Port format"}
              </ThemedText>
              <TextInput
                style={styles.torModalInput}
                value={torProxyInput}
                onChangeText={setTorProxyInput}
                placeholder="127.0.0.1:9050"
                placeholderTextColor={Colors.dark.textDisabled}
                keyboardType="default"
                autoCapitalize="none"
              />
              <View style={styles.torModalButtons}>
                <Pressable
                  onPress={() => setShowTorModal(false)}
                  style={[styles.torModalButton, styles.torModalButtonSecondary]}
                >
                  <ThemedText style={styles.torModalButtonText}>
                    {currentLanguage === "tr" ? "Iptal" : "Cancel"}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleTorProxySave}
                  style={[styles.torModalButton, styles.torModalButtonPrimary]}
                >
                  <ThemedText style={styles.torModalButtonText}>
                    {currentLanguage === "tr" ? "Kaydet" : "Save"}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            {currentLanguage === "tr" ? "Tor Baglantisi" : "Tor Connection"}
          </ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="shield"
              title={currentLanguage === "tr" ? "Tor Uzerinden Baglan" : "Connect via Tor"}
              subtitle={getTorStatusText()}
              rightElement={
                <View style={styles.torStatusRow}>
                  <View style={[styles.torStatusDot, { backgroundColor: getTorStatusColor() }]} />
                  <Switch
                    value={torSettings.enabled}
                    onValueChange={handleTorToggle}
                    trackColor={{ false: Colors.dark.border, true: Colors.dark.secondary }}
                    thumbColor={torSettings.enabled ? Colors.dark.text : Colors.dark.textSecondary}
                  />
                </View>
              }
            />
            <SettingsRow
              icon="settings"
              title={currentLanguage === "tr" ? "Proxy Ayarlari" : "Proxy Settings"}
              subtitle={`${torSettings.proxyHost}:${torSettings.proxyPort}`}
              onPress={() => setShowTorModal(true)}
            />
            <View style={styles.torInfoRow}>
              <Feather name="info" size={14} color={Colors.dark.textSecondary} />
              <ThemedText style={styles.torInfoText}>
                {currentLanguage === "tr"
                  ? "Tor kullanmak icin cihazinizda Orbot uygulamasinin calisir durumda olmasi gerekir."
                  : "Orbot app must be running on your device to use Tor."}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            {currentLanguage === "tr" ? "Ag" : "Network"}
          </ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="server"
              title={currentLanguage === "tr" ? "Sunucu Ayarlari" : "Server Settings"}
              subtitle={currentLanguage === "tr" ? "Relay sunucusunu yapilandir" : "Configure relay server"}
              onPress={() => navigation.navigate("NetworkSettings")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            {currentLanguage === "tr" ? "Guvenlik ve Anahtar Yonetimi" : "Security & Key Management"}
          </ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="key"
              title={currentLanguage === "tr" ? "Anahtar Yonetimi" : "Key Management"}
              subtitle={currentLanguage === "tr" ? "Anahtarlari disa aktar veya yeniden olustur" : "Export or regenerate keys"}
              onPress={() => navigation.navigate("SecuritySettings")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            {currentLanguage === "tr" ? "Hakkinda" : "About"}
          </ThemedText>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon="info"
              title={currentLanguage === "tr" ? "CipherNode Hakkinda" : "About CipherNode"}
              subtitle={currentLanguage === "tr" ? "Surum, lisanslar, kaynak kodu" : "Version, licenses, source code"}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: "80%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.lg,
    color: Colors.dark.text,
  },
  languageOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  languageOptionSelected: {
    backgroundColor: Colors.dark.primary,
  },
  languageOptionText: {
    fontSize: 16,
    color: Colors.dark.text,
  },
  languageOptionTextSelected: {
    color: Colors.dark.backgroundRoot,
    fontWeight: "600",
  },
  modalCloseButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dark.secondary,
    marginTop: Spacing.lg,
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    textAlign: "center",
  },
  torStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  torStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  torInfoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.lg,
    gap: Spacing.sm,
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  torInfoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.dark.textSecondary,
    lineHeight: 16,
  },
  torModalInput: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.dark.text,
    marginBottom: Spacing.lg,
    fontFamily: Fonts?.mono,
  },
  torModalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  torModalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  torModalButtonPrimary: {
    backgroundColor: Colors.dark.secondary,
  },
  torModalButtonSecondary: {
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  torModalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
  },
});
