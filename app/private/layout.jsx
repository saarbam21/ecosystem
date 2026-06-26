import Link from "next/link";

export const metadata = {
  title: "אזור ניהול",
  robots: { index: false, follow: false },
  alternates: { canonical: undefined },
};

// The private admin area renders without the public site chrome (see
// components/SiteChrome.jsx) and is gated at the edge by Cloudflare Access.
export default function PrivateLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="container-page mx-auto flex max-w-5xl items-center justify-between py-4">
          <Link href="/private" className="font-extrabold text-brand-700">
            אזור ניהול · Ecosystem
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-ink-soft">
            <Link href="/private" className="hover:text-brand-700">
              בית
            </Link>
            <Link href="/private/parameters" className="hover:text-brand-700">
              פרמטרים
            </Link>
            <a href="/" className="hover:text-brand-700">
              לאתר הציבורי
            </a>
          </nav>
        </div>
      </header>
      <main className="container-page mx-auto max-w-5xl py-8">{children}</main>
    </div>
  );
}
