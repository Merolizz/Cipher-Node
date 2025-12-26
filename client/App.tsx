import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import OnboardingScreen from "@/screens/OnboardingScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { hasCompletedOnboarding, getLanguage } from "@/lib/storage";
import { LanguageContext, type Language } from "@/constants/language";
import { Colors } from "@/constants/theme";

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [language, setLanguageState] = useState<Language>("tr");

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    const completed = await hasCompletedOnboarding();
    const savedLanguage = await getLanguage();
    setLanguageState(savedLanguage);
    setShowOnboarding(!completed);
    setIsLoading(false);
  };

  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage }}>
                {showOnboarding ? (
                  <OnboardingScreen onComplete={handleOnboardingComplete} />
                ) : (
                  <NavigationContainer>
                    <RootStackNavigator />
                  </NavigationContainer>
                )}
                <StatusBar style="light" />
              </LanguageContext.Provider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundRoot,
  },
});
