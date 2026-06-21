"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
import WhatsAppFloat from "./WhatsAppFloat";

export default function SiteChrome({ children }) {
  const pathname = usePathname();
  // Standalone/embeddable pages render without the site header, footer and nav.
  const bare = pathname?.startsWith("/embed");

  if (bare) {
    return (
      <main id="main" className="flex-1">
        {children}
      </main>
    );
  }

  return (
    <>
      <a href="#main" className="skip-link">
        דלג לתוכן הראשי
      </a>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
