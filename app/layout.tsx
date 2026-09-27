import type { ReactNode } from "react";

export const metadata = {
  title: "IELTS Speaking Assistant",
  description: "Practise IELTS Speaking with Whisper transcription",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0b1220", color: "#e5e7eb", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
