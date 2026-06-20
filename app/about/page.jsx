import PageHeader from "@/components/PageHeader";
import CTA from "@/components/CTA";
import { site } from "@/lib/site";

export const metadata = {
  title: "אודות",
  description:
    "סער באם — מתכנן פיננסי מוסמך (CFP) ומתכנן פרישה עם מעל 20 שנות ניסיון בהשקעות בשוק ההון, נדל\"ן בארץ ובחו\"ל ותכנון פנסיוני.",
};

export default function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="אודות" title="נעים להכיר" />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="prose-he">
              <p>
                שמי {site.owner}, אני כלכלן, מתכנן פיננסי מוסמך (CFP) ומתכנן
                פרישה, ומתעסק בהשקעות כבר למעלה מ-20 שנה. לאורך השנים צברתי ניסיון
                והתמחות במגוון תחומי השקעה — שוק ההון, נדל"ן בארץ, נדל"ן בחו"ל
                ותכנון פנסיוני.
              </p>
              <p>
                לאורך הדרך הבנתי דבר אחד: עושר אמיתי לא נבנה מתעודות או מהשכלה
                אקדמית, אלא מהבנה של איך לגרום לכסף לעבוד עבורך. הרבה אנשים אמידים
                באמת לא בהכרח הצטיינו בלימודים — מה שהבדיל אותם היה הידע איך לנהל
                ולמנף את ההון שלהם.
              </p>
              <p>
                את הידע הזה החלטתי להפוך לנגיש. אני מלווה יחידים ומשפחות בדרך
                להשגת המטרות הכלכליות שלהם — בשפה ברורה, בלי ז'רגון מסובך, ומתוך
                ראייה של התמונה המלאה.
              </p>
              <h2>הגישה שלי</h2>
              <p>
                אני מאמין שכל אחד יכול וצריך להבין את הכסף שלו. בתהליך העבודה
                המשותף אני שם דגש על העברת ידע וכלים שילוו אתכם הרבה אחרי שהתכנון
                יסתיים — כדי שתוכלו לקבל החלטות מתוך ביטחון, לבד.
              </p>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-bold text-ink">השכלה וניסיון</h3>
              <ul className="mt-4 space-y-3 text-ink-soft">
                <li>🎓 B.A בכלכלה ו-M.B.A במנהל עסקים</li>
                <li>🏅 מתכנן פיננסי מוסמך (CFP)</li>
                <li>🏅 מתכנן פרישה</li>
                <li>📈 מעל 20 שנות ניסיון בהשקעות</li>
              </ul>
            </div>
            <div className="card">
              <h3 className="text-lg font-bold text-ink">תחומי התמחות</h3>
              <ul className="mt-4 space-y-3 text-ink-soft">
                <li>• שוק ההון</li>
                <li>• נדל"ן בארץ</li>
                <li>• נדל"ן בחו"ל</li>
                <li>• תכנון פנסיוני</li>
                <li>• תכנון פרישה</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <CTA />
    </>
  );
}
