import PageHeader from "@/components/PageHeader";
import CTA from "@/components/CTA";

export const metadata = {
  title: "השירותים שלי",
  description:
    "שיחת ייעוץ, בדיקת בריאות פיננסית, תכנון פיננסי בסיסי ותכנון פיננסי מקיף — בחרו את הליווי שמתאים לכם.",
};

const services = [
  {
    name: "שיחת ייעוץ",
    price: "",
    desc: "שיחת ייעוץ בודדת בכל נושא — השקעות, התפתחות כלכלית או כל שאלה שמעסיקה אתכם.",
    features: [
      "שיחה ממוקדת בנושא לבחירתכם",
      "כיווני פעולה ראשוניים",
      "ללא התחייבות להמשך",
    ],
  },
  {
    name: "בדיקת בריאות פיננסית",
    price: "",
    desc: "מבט-על על המצב הפיננסי שלכם, עם איתור נקודות לשיפור והמלצות מעשיות.",
    features: [
      "סקירת נכסים והתחייבויות",
      "איתור נקודות תורפה והזדמנויות",
      "המלצות לשיפור",
    ],
  },
  {
    name: "תכנון פיננסי בסיסי",
    price: "החל מ-2,500 ₪",
    highlighted: true,
    desc: "תהליך תכנון מלא שמחבר בין ההון שלכם למטרות שלכם.",
    features: [
      "אפיון מצב והגדרת מטרות",
      "אסטרטגיית הקצאת הון מותאמת",
      "מעבר על נכסים פנסיוניים",
      "ניתוח כיסויים ביטוחיים",
    ],
  },
  {
    name: "תכנון פיננסי מקיף",
    price: "עד 5,000 ₪",
    desc: "כל מה שכלול בתכנון הבסיסי, בהיקף רחב ומעמיק יותר למצבים מורכבים.",
    features: [
      "כל מרכיבי התכנון הבסיסי",
      "תכנון העברת הון בין-דורית",
      "היקף וניתוח מורחבים",
      "התאמה למצבים מורכבים",
      "ליווי מעמיק יותר בבניית התוכנית",
    ],
  },
];

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        eyebrow="השירותים שלי"
        title="ליווי פיננסי לפי הצורך שלכם"
        subtitle="מהשיחה הראשונה ועד תוכנית מפורטת ליישום — בוחרים את רמת הליווי שמתאימה לכם."
      />

      <section className="section">
        <div className="container-page grid gap-6 md:grid-cols-2">
          {services.map((s) => (
            <div
              key={s.name}
              className={`card flex flex-col ${
                s.highlighted ? "ring-2 ring-brand-500" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-2xl font-bold text-ink">{s.name}</h2>
                {s.highlighted && (
                  <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700">
                    הפופולרי
                  </span>
                )}
              </div>
              {s.price && (
                <p className="mt-2 text-lg font-semibold text-brand-700">
                  {s.price}
                </p>
              )}
              <p className="mt-3 text-ink-soft">{s.desc}</p>
              <ul className="mt-5 space-y-2.5">
                {s.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-ink">
                    <span className="mt-1 text-brand-600">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="container-page mt-8 text-center text-ink-soft">
          העלות תלויה במורכבות ובהיקף התכנון הנדרש, ונעה בין 2,500 ₪ לתכנון פשוט
          ועד 5,000 ₪ לתכנון מקיף.
        </p>
      </section>

      <CTA
        title="לא בטוחים מה מתאים לכם?"
        text="נתחיל בשיחה קצרה ונבין יחד איזה ליווי הכי נכון עבורכם."
      />
    </>
  );
}
