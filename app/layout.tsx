import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "IELTS Speaking Assistant",
  description: "Practise the full IELTS Speaking test with a realistic examiner",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
