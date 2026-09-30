import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Sayyarah - Admin Console",
  description: "Operations Management Console for Sayyarah Car Rental & Sharing Platform",
  icons: {
    icon: "/sayyarah-icon.png",
    apple: "/sayyarah-icon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <link rel="icon" href="/sayyarah-icon.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
