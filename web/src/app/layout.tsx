import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '../lib/context';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { Footer } from '../components/Footer';

export const metadata: Metadata = {
  title: 'Wajah — Feedback Loop for Delhi Pollution Control',
  description: 'Wajah detects pollution spikes at hotspots, finds likely causes, recommends actions, tracks work orders, and measures sensor effects.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-paper text-ink font-sans">
        <AppProvider>
          <Header />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
            {children}
          </main>
          <Footer />
          <BottomNav />
        </AppProvider>
      </body>
    </html>
  );
}
