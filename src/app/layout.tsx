import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";
import Nav from "@/components/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NOAH — Your AI Assistant",
  description:
    "NOAH is an AI virtual assistant: chat in English, Urdu or Roman Urdu, connect your Google account, and let NOAH help with email, calendar, tasks and memory — always with your approval.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSessionUser();
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-50 text-zinc-900`}>
        <Nav user={user ? { email: user.email, name: user.name } : null} />
        <main className="mx-auto w-full max-w-4xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
