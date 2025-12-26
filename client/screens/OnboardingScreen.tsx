import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { setOnboardingComplete } from "@/lib/storage";

const { width } = Dimensions.get("window");

interface SlideData {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  color: string;
}

const slides: SlideData[] = [
  {
    icon: "shield",
    title: "End-to-End Encrypted",
    description:
      "Your messages are secured with military-grade encryption. Only you and your recipient can read them.",
    color: Colors.dark.primary,
  },
  {
    icon: "user-x",
    title: "No Account Required",
    description:
      "No phone number, no email, no personal data. Your identity is based on cryptographic keys stored only on your device.",
    color: Colors.dark.secondary,
  },
  {
    icon: "users",
    title: "Group Chats",
    description:
      "Create encrypted group conversations with your contacts. All messages stay private and secure.",
    color: Colors.dark.success,
  },
  {
    icon: "server",
    title: "Self-Hostable",
    description:
      "Run your own relay server for maximum privacy. No logs, no tracking, complete control.",
    color: Colors.dark.warning,
  },
];

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const progress = useSharedValue(0);

  const handleNext = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (currentIndex < slides.length - 1) {
      progress.value = withSpring(currentIndex + 1);
      setCurrentIndex(currentIndex + 1);
    } else {
      await setOnboardingComplete();
      onComplete();
    }
  };

  const handleSkip = async () => {
    await setOnboardingComplete();
    onComplete();
  };

  const dotAnimatedStyle = (index: number) =>
    useAnimatedStyle(() => {
      const scale = interpolate(
        progress.value,
        [index - 1, index, index + 1],
        [1, 1.3, 1],
        Extrapolation.CLAMP
      );
      const opacity = interpolate(
        progress.value,
        [index - 1, index, index + 1],
        [0.4, 1, 0.4],
        Extrapolation.CLAMP
      );
      return {
        transform: [{ scale }],
        opacity,
      };
    });

  const slide = slides[currentIndex];

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <View style={styles.header}>
        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <ThemedText style={styles.skipText}>Skip</ThemedText>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View
          style={[styles.iconContainer, { backgroundColor: slide.color + "20" }]}
        >
          <Feather name={slide.icon} size={64} color={slide.color} />
        </View>

        <ThemedText style={styles.title}>{slide.title}</ThemedText>
        <ThemedText style={styles.description}>{slide.description}</ThemedText>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                { backgroundColor: slides[index].color },
                dotAnimatedStyle(index),
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.nextButton,
            { backgroundColor: slide.color },
            pressed && styles.nextButtonPressed,
          ]}
        >
          <ThemedText style={styles.nextButtonText}>
            {currentIndex === slides.length - 1 ? "Get Started" : "Next"}
          </ThemedText>
          <Feather
            name={currentIndex === slides.length - 1 ? "check" : "arrow-right"}
            size={20}
            color={Colors.dark.buttonText}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.lg,
  },
  skipButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  skipText: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["3xl"],
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.dark.text,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  description: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  nextButtonPressed: {
    opacity: 0.8,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.dark.buttonText,
  },
});
