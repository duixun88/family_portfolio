import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Family Portfolio',
  description: '가족 자산 통합 관리',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
