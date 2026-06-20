import Link from "next/link";
import Logo from "./Logo";
import { site, nav } from "@/lib/site";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-100 bg-slate-50">
      <div className="container-page py-14">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-ink-soft">{site.tagline}</p>
            <p className="mt-2 text-sm text-ink-soft">
              {site.owner} — מתכנן פיננסי מוסמך (CFP) ומתכנן פרישה
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink">
              ניווט
            </h3>
            <nav aria-label="ניווט בתחתית">
            <ul className="space-y-2">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-ink-soft transition hover:text-brand-700"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/privacy/"
                  className="text-ink-soft transition hover:text-brand-700"
                >
                  מדיניות פרטיות
                </Link>
              </li>
              <li>
                <Link
                  href="/accessibility/"
                  className="text-ink-soft transition hover:text-brand-700"
                >
                  הצהרת נגישות
                </Link>
              </li>
            </ul>
            </nav>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink">
              יצירת קשר
            </h3>
            <ul className="space-y-3">
              <li>
                <a
                  href={`tel:${site.phoneIntl}`}
                  className="flex items-center gap-2 text-ink-soft transition hover:text-brand-700"
                >
                  📞 <span dir="ltr">{site.phone}</span>
                </a>
              </li>
              <li>
                <a
                  href={site.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-ink-soft transition hover:text-brand-700"
                >
                  💬 וואטסאפ
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${site.email}`}
                  className="flex items-center gap-2 text-ink-soft transition hover:text-brand-700"
                >
                  ✉️ {site.email}
                </a>
              </li>
              <li>
                <a
                  href={site.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-ink-soft transition hover:text-brand-700"
                >
                  📘 פייסבוק
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-200 pt-6 text-sm text-ink-soft">
          <p>
            © {year} {site.name}. כל הזכויות שמורות. האמור באתר אינו מהווה ייעוץ
            השקעות, ייעוץ פנסיוני או המלצה לפעולה.
          </p>
        </div>
      </div>
    </footer>
  );
}
