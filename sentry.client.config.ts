import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 1.0,

  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
    Sentry.feedbackIntegration({
      colorScheme: "system",
      enableScreenshot: true,
      autoInject: false, // We'll use custom trigger button
      showBranding: false,

      // Match cassette futurism design aesthetic
      themeDark: {
        background: "#1a1a1a",
        backgroundHover: "#252525",
        accentBackground: "#0047FF", // Electric Blue
        accentForeground: "#ffffff",
        submitBackground: "#FF006E", // Hot Pink
        submitBackgroundHover: "#cc005a",
        border: "1px solid #0047FF",
      },
      themeLight: {
        background: "#ffffff",
        backgroundHover: "#f5f5f5",
        accentBackground: "#0047FF", // Electric Blue
        accentForeground: "#ffffff",
        submitBackground: "#FF006E", // Hot Pink
        submitBackgroundHover: "#cc005a",
        border: "1px solid #0047FF",
      },
    }),
  ],

  environment: process.env.NODE_ENV,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",
})
