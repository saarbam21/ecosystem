import { Heebo } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import { site } from "@/lib/site";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description:
    "תכנון פיננסי וייעוץ ליחידים ומשפחות. סער באם, מתכנן פיננסי מוסמך (CFP) ומתכנן פרישה עם מעל 20 שנות ניסיון בהשקעות, מלווה אתכם להשגת היעדים הכלכליים.",
  keywords: [
    "תכנון פיננסי",
    "ייעוץ פיננסי",
    "השקעות",
    "פנסיה",
    "הכנסה פסיבית",
    "סער בם",
  ],
  openGraph: {
    title: `${site.name} | ${site.tagline}`,
    description: "תכנון פיננסי וייעוץ ליחידים ומשפחות.",
    url: site.url,
    siteName: site.name,
    locale: "he_IL",
    type: "website",
  },
  alternates: {
    canonical: site.url,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <a href="#main" className="skip-link">
          דלג לתוכן הראשי
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <WhatsAppFloat />
      </body>
    </html>
  );
}
