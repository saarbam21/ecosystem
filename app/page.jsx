import Link from "next/link";
import CTA from "@/components/CTA";
import { site } from "@/lib/site";
import { getAllPosts, formatDate } from "@/lib/posts";

const services = [
  {
    title: "תכנון פיננסי מותאם אישית",
    desc: "חיבור בין הנכסים וההון שלכם לבין המטרות האישיות — תמונת מצב ברורה והצעדים להשגתן.",
    icon: "M3 12h18M3 6h18M3 18h12",
  },
  {
    title: "מיפוי אופקים כלכליים",
    desc: "בחינה כוללת של המצב הנוכחי: נכסים, פנסיה, ביטוחים ותזרים — לאן זה מוביל ומה אפשר לשפר.",
    icon: "M12 3v18M3 12h18",
  },
  {
    title: "חינוך פיננסי לטווח ארוך",
    desc: "ידע וכלים שילוו אתכם לכל החיים — איך עובד שוק ההון, ריבית-דריבית, וניהול סיכונים.",
    icon: "M4 19V5l8 4 8-4v14l-8 4-8-4z",
  },
  {
    title: "יצירת הכנסה פסיבית",
    desc: "בניית מקורות הכנסה שעובדים בשבילכם, כדי להגיע לחופש כלכלי אמיתי.",
    icon: "M12 1v22M5 8h9a3 3 0 010 6H7",
  },
];

const steps = [
  { n: "01", title: "שיחת אפיון צרכים", desc: "נכיר, נבין מה חשוב לכם ומה המטרות." },
  { n: "02", title: "איסוף נתונים", desc: "ריכוז התמונה הפיננסית המלאה שלכם." },
  { n: "03", title: "בניית התוכנית", desc: "מספר פגישות ליבון וחידוד של האסטרטגיה." },
  { n: "04", title: "תוכנית ליישום", desc: "תוכנית מפורטת עם המלצות קונקרטיות לביצוע." },
];

export default function HomePage() {
  const posts = getAllPosts().slice(0, 2);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white">
        <div className="container-page grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="eyebrow">תכנון פיננסי ליחידים ומשפחות</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
              הכסף שלכם יכול לעבוד הרבה יותר חכם
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-soft">
              עושר לא נבנה מתעודות והשכלה — אלא מהבנה איך להשתמש בהון בצורה נכונה.
              ביחד נבנה תוכנית פיננסית שמחברת בין הנכסים שלכם למטרות האישיות שלכם.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/contact/" className="btn-primary">
                קביעת שיחת התאמה
              </Link>
              <Link href="/services/" className="btn-outline">
                לשירותים שלי
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-ink-soft">
              <span className="flex items-center gap-2">✓ מעל 20 שנות ניסיון בהשקעות</span>
              <span className="flex items-center gap-2">✓ ליווי אישי וצמוד</span>
              <span className="flex items-center gap-2">✓ שיחת התאמה ללא עלות וללא התחייבות</span>
            </div>
          </div>

          <div className="relative">
            <div className="card mx-auto max-w-md">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl font-extrabold text-brand-700">
                  ס
                </div>
                <div>
                  <p className="text-lg font-bold text-ink">{site.owner}</p>
                  <p className="text-sm text-ink-soft">מתכנן פיננסי מוסמך (CFP) ומתכנן פרישה</p>
                </div>
              </div>
              <p className="mt-6 text-ink-soft">
                “המטרה שלי היא שתבינו את המספרים שלכם, תקבלו החלטות מתוך ביטחון,
                ותראו את התמונה המלאה — לא רק את הרגע הנוכחי.”
              </p>
              <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-slate-100 pt-6 text-center">
                <div>
                  <dt className="text-2xl font-extrabold text-brand-700">20+</dt>
                  <dd className="text-xs text-ink-soft">שנות ניסיון</dd>
                </div>
                <div>
                  <dt className="text-lg font-extrabold leading-tight text-brand-700">
                    מתכנן פיננסי מוסמך
                  </dt>
                  <dd className="mt-1 text-xs leading-tight text-ink-soft" dir="ltr" lang="en">
                    Certified Financial Planner (CFP)
                  </dd>
                </div>
                <div>
                  <dt className="text-lg font-extrabold leading-tight text-brand-700">
                    מתכנן
                    <br />
                    פרישה
                  </dt>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="section">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">מה אני עושה</span>
            <h2 className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">
              ליווי פיננסי שמחבר את כל התמונה
            </h2>
            <p className="mt-4 text-lg text-ink-soft">
              תכנון פיננסי מקיף שמחבר בין הנכסים, ההון והמטרות שלכם — בשפה ברורה
              ובלי ז'רגון.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => (
              <div key={s.title} className="card">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={s.icon} />
                  </svg>
                </div>
                <h3 className="mt-5 text-lg font-bold text-ink">{s.title}</h3>
                <p className="mt-2 text-ink-soft">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="bg-brand-50 section">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="eyebrow">למה זה חשוב</span>
            <h2 className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">
              עושר הוא לא עניין של תעודות
            </h2>
            <p className="mt-5 text-lg text-ink-soft">
              הרבה אנשים אמידים באמת לא הצטיינו בלימודים ולא בהכרח בעלי תארים
              אקדמיים. מה שמבדיל אותם זו ההבנה איך לגרום לכסף לעבוד עבורם — ידע
              שכמעט ולא מלמדים במערכת החינוך.
            </p>
            <p className="mt-4 text-lg text-ink-soft">
              בדיוק שם אני נכנס: לתת לכם את הידע, הכלים והתוכנית כדי לקבל החלטות
              פיננסיות נכונות לאורך זמן.
            </p>
            <Link href="/about/" className="btn-outline mt-8">
              קצת עליי
            </Link>
          </div>
          <ul className="space-y-4">
            {[
              "תמונת מצב מלאה של המצב הפיננסי שלכם",
              "אסטרטגיה מותאמת להקצאת ההון",
              "מעבר על נכסים פנסיוניים וביטוחים",
              "תכנון העברת הון בין-דורית",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-card">
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-600 text-sm text-white">
                  ✓
                </span>
                <span className="text-ink">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Process */}
      <section className="section">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">איך זה עובד</span>
            <h2 className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">
              תהליך פשוט וברור
            </h2>
            <p className="mt-4 text-lg text-ink-soft">
              התהליך אינו מורכב ואינו דורש ידע מוקדם — תוך כדי הדרך תקבלו את הידע
              והכלים.
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="card">
                <span className="text-3xl font-extrabold text-brand-200">{s.n}</span>
                <h3 className="mt-3 text-lg font-bold text-ink">{s.title}</h3>
                <p className="mt-2 text-ink-soft">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Blog preview */}
      {posts.length > 0 && (
        <section className="bg-slate-50 section">
          <div className="container-page">
            <div className="flex items-end justify-between">
              <div>
                <span className="eyebrow">מהבלוג</span>
                <h2 className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">
                  מאמרים אחרונים
                </h2>
              </div>
              <Link href="/blog/" className="hidden font-semibold text-brand-700 hover:underline sm:block">
                לכל המאמרים ←
              </Link>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}/`}
                  className="card group transition hover:-translate-y-1"
                >
                  <p className="text-sm text-ink-soft">{formatDate(post.date)}</p>
                  <h3 className="mt-2 text-xl font-bold text-ink group-hover:text-brand-700">
                    {post.title}
                  </h3>
                  <p className="mt-3 text-ink-soft">{post.excerpt}</p>
                  <span className="mt-4 inline-block font-semibold text-brand-700">
                    קריאת המאמר ←
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <CTA />
    </>
  );
}
