import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { addContact, getContacts } from "@/lib/storage";
import { useIdentity } from "@/hooks/useIdentity";

export default function QRScannerScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { identity } = useIdentity();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const parsed = JSON.parse(data);
      if (!parsed.id || !parsed.publicKey) {
        throw new Error("Invalid QR code");
      }

      if (parsed.id === identity?.id) {
        Alert.alert("Error", "You cannot add yourself as a contact");
        setScanned(false);
        return;
      }

      const contacts = await getContacts();
      if (contacts.some((c) => c.id === parsed.id)) {
        Alert.alert("Already Added", "This contact is already in your list");
        navigation.goBack();
        return;
      }

      await addContact({
        id: parsed.id,
        publicKey: parsed.publicKey,
        fingerprint: parsed.id.replace("-", "").padEnd(40, "0"),
        displayName: "",
        addedAt: Date.now(),
      });

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert("Success", "Contact added successfully", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert("Invalid QR Code", "This QR code is not a valid CipherNode contact", [
        { text: "OK", onPress: () => setScanned(false) },
      ]);
    }
  };

  if (!permission) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading camera...</ThemedText>
      </ThemedView>
    );
  }

  if (!permission.granted) {
    if (permission.status === "denied" && !permission.canAskAgain) {
      return (
        <ThemedView style={[styles.container, styles.permissionContainer]}>
          <Feather name="camera-off" size={64} color={Colors.dark.textSecondary} />
          <ThemedText style={styles.permissionTitle}>Camera Access Required</ThemedText>
          <ThemedText style={styles.permissionText}>
            Please enable camera access in Settings to scan QR codes
          </ThemedText>
          {Platform.OS !== "web" ? (
            <Pressable
              onPress={async () => {
                try {
                  await Linking.openSettings();
                } catch (error) {
                  console.error("Could not open settings");
                }
              }}
              style={({ pressed }) => [
                styles.settingsButton,
                pressed && styles.settingsButtonPressed,
              ]}
            >
              <ThemedText style={styles.settingsButtonText}>Open Settings</ThemedText>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
          >
            <ThemedText style={styles.closeButtonText}>Go Back</ThemedText>
          </Pressable>
        </ThemedView>
      );
    }

    return (
      <ThemedView style={[styles.container, styles.permissionContainer]}>
        <Feather name="camera" size={64} color={Colors.dark.primary} />
        <ThemedText style={styles.permissionTitle}>Camera Permission</ThemedText>
        <ThemedText style={styles.permissionText}>
          We need camera access to scan QR codes
        </ThemedText>
        <Pressable
          onPress={requestPermission}
          style={({ pressed }) => [
            styles.permissionButton,
            pressed && styles.permissionButtonPressed,
          ]}
        >
          <ThemedText style={styles.permissionButtonText}>Enable Camera</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed,
          ]}
        >
          <ThemedText style={styles.closeButtonText}>Cancel</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (Platform.OS === "web") {
    return (
      <ThemedView style={[styles.container, styles.permissionContainer]}>
        <Feather name="smartphone" size={64} color={Colors.dark.primary} />
        <ThemedText style={styles.permissionTitle}>Use Expo Go</ThemedText>
        <ThemedText style={styles.permissionText}>
          QR scanning is best on mobile. Open this app in Expo Go to scan QR codes.
        </ThemedText>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed,
          ]}
        >
          <ThemedText style={styles.closeButtonText}>Go Back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <Feather name="x" size={24} color={Colors.dark.text} />
          </Pressable>
          <ThemedText style={styles.title}>Scan QR Code</ThemedText>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.scanArea}>
          <View style={styles.corner} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
        </View>

        <ThemedText style={styles.hint}>
          Point your camera at a contact's QR code
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  permissionContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: Colors.dark.text,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  permissionText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  permissionButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  permissionButtonPressed: {
    opacity: 0.8,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.buttonText,
  },
  settingsButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  settingsButtonPressed: {
    opacity: 0.8,
  },
  settingsButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.buttonText,
  },
  closeButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  closeButtonPressed: {
    opacity: 0.6,
  },
  closeButtonText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: Spacing["5xl"],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.text,
  },
  placeholder: {
    width: 44,
  },
  scanArea: {
    width: 250,
    height: 250,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: Colors.dark.primary,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    top: 0,
    left: 0,
  },
  cornerTopRight: {
    top: 0,
    left: undefined,
    right: 0,
    borderLeftWidth: 0,
    borderRightWidth: 4,
  },
  cornerBottomLeft: {
    top: undefined,
    bottom: 0,
    borderTopWidth: 0,
    borderBottomWidth: 4,
  },
  cornerBottomRight: {
    top: undefined,
    left: undefined,
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  hint: {
    fontSize: 16,
    color: Colors.dark.text,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
});
