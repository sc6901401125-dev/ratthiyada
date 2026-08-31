import type { Metadata } from 'next';
import './globals.css';

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'https://sipday-water-tracker.sc6901401125.chatgpt.site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'SipDay — จิบน้ำให้ครบทุกวัน',
  description: 'เว็บแอปคำนวณเป้าหมาย บันทึก และติดตามการดื่มน้ำรายวัน',
  openGraph: {
    title: 'SipDay — จิบน้ำให้ครบทุกวัน',
    description: 'คำนวณเป้าหมาย บันทึกทุกแก้ว และดูความคืบหน้าการดื่มน้ำได้ในที่เดียว',
    images: [
      {
        url: '/og.png',
        width: 1536,
        height: 1024,
        alt: 'SipDay จิบน้ำให้ครบทุกวัน',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SipDay — จิบน้ำให้ครบทุกวัน',
    description: 'คำนวณเป้าหมาย บันทึกทุกแก้ว และดูความคืบหน้าการดื่มน้ำได้ในที่เดียว',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
