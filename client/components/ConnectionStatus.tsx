import React from "react";
import { View, StyleSheet } from "react-native";
import { Colors, Spacing } from "@/constants/theme";

type ConnectionState = "p2p" | "relay" | "offline";

interface ConnectionStatusProps {
  state?: ConnectionState;
}

export default function ConnectionStatus({ state = "relay" }: ConnectionStatusProps) {
  const getColor = () => {
    switch (state) {
      case "p2p":
        return Colors.dark.success;
      case "relay":
        return Colors.dark.warning;
      case "offline":
        return Colors.dark.error;
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: getColor() }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
