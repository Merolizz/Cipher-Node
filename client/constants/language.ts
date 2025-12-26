import React, { createContext, useContext } from "react";

export type Language = "tr" | "en";

export const SUPPORTED_LANGUAGES = {
  tr: "Türkçe",
  en: "English",
} as const;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}

export const translations = {
  tr: {
    // Identity
    identity: "Kimlik",
    yourId: "Kimliğiniz",
    displayName: "Gösterim Adı",
    optionalName: "İsteğe bağlı ad",
    
    // Privacy Settings
    privacy: "Gizlilik",
    defaultMessageTimer: "Varsayılan Mesaj Zamanlayıcısı",
    screenProtection: "Ekran Koruması",
    screenProtectionDesc: "Ekran görüntüsü ve kaydı engelle",
    biometricLock: "Biometrik Kilit",
    biometricLockDesc: "Uygulamayı açmak için parmak izi gerekli",
    biometricNotSupported: "Biometrik Kilit - Bu özellik sadece mobil cihazlarda kullanılabilir",
    
    // Security Settings
    security: "Güvenlik",
    autoMetadataScrubbing: "Otomatik Meta Veri Temizleme",
    autoMetadataDesc: "Resimlerdeki EXIF verilerini otomatik olarak kaldır",
    steganographyMode: "Steganografi Modu",
    steganographyDesc: "Mesajları resimlerin içinde gizle",
    
    // Performance Settings
    performance: "Performans",
    ghostMode: "Hayalet Modu",
    ghostModeDesc: "Yazma göstergesini ve okundu bilgisini gizle",
    p2pOnlyMode: "P2P Mod",
    p2pOnlyDesc: "Yalnızca doğrudan bağlantıları kullan",
    lowPowerMode: "Düşük Güç Modu",
    lowPowerDesc: "Animasyonları ve efektleri azalt",
    
    // Network Settings
    network: "Ağ",
    serverUrl: "Sunucu URL'si",
    serverUrlDesc: "Özel relay sunucusu",
    
    // Language
    language: "Dil",
    changeLanguage: "Dili Değiştir",
    
    // Timer Options
    timerOff: "Kapalı",
    timer30s: "30 saniye",
    timer1m: "1 dakika",
    timer5m: "5 dakika",
    timer1h: "1 saat",
    timer1d: "1 gün",
    
    // Actions
    save: "Kaydet",
    cancel: "İptal",
    delete: "Sil",
    confirm: "Onayla",
  },
  en: {
    // Identity
    identity: "Identity",
    yourId: "Your ID",
    displayName: "Display Name",
    optionalName: "Optional name",
    
    // Privacy Settings
    privacy: "Privacy",
    defaultMessageTimer: "Default Message Timer",
    screenProtection: "Screen Protection",
    screenProtectionDesc: "Prevent screenshots and screen recording",
    biometricLock: "Biometric Lock",
    biometricLockDesc: "Require fingerprint to open app",
    biometricNotSupported: "Biometric Lock - This feature is only available on mobile devices",
    
    // Security Settings
    security: "Security",
    autoMetadataScrubbing: "Auto Metadata Scrubbing",
    autoMetadataDesc: "Remove EXIF data from images automatically",
    steganographyMode: "Steganography Mode",
    steganographyDesc: "Hide messages inside images",
    
    // Performance Settings
    performance: "Performance",
    ghostMode: "Ghost Mode",
    ghostModeDesc: "Hide typing indicator and read receipts",
    p2pOnlyMode: "P2P Only",
    p2pOnlyDesc: "Use direct connections only",
    lowPowerMode: "Low Power Mode",
    lowPowerDesc: "Reduce animations and effects",
    
    // Network Settings
    network: "Network",
    serverUrl: "Server URL",
    serverUrlDesc: "Custom relay server",
    
    // Language
    language: "Language",
    changeLanguage: "Change Language",
    
    // Timer Options
    timerOff: "Off",
    timer30s: "30 seconds",
    timer1m: "1 minute",
    timer5m: "5 minutes",
    timer1h: "1 hour",
    timer1d: "1 day",
    
    // Actions
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    confirm: "Confirm",
  },
} as const;

let currentLanguage: Language = "tr";

export function setLanguage(lang: Language) {
  currentLanguage = lang;
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function t(key: keyof typeof translations.tr): string {
  return translations[currentLanguage][key as keyof typeof translations[typeof currentLanguage]] || key;
}
