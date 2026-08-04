import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AuthEventBridge } from '@/components/AuthEventBridge';
import { ChunkLoadRecovery } from '@/components/ChunkLoadRecovery';
import { ToastProvider } from '@/contexts/ToastContext';

export const metadata: Metadata = {
  title: 'Easy TOEIC',
  description: 'Ứng dụng học TOEIC thông minh',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <ToastProvider>
          <AuthEventBridge />
          <ChunkLoadRecovery />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
