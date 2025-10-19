import type React from "react"
import type { Metadata } from "next"
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"
import { RealtimeProvider } from "@/components/realtime-provider"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
})

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Badlobs",
  description: "Make bad ad campaign concepts with friends",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} font-sans antialiased`}>
        <RealtimeProvider>{children}</RealtimeProvider>
      </body>
    </html>
  )
}
