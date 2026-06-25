import PageHeader from "@/components/PageHeader";
import CTA from "@/components/CTA";

export const metadata = {
  title: "שאלות נפוצות",
  description:
    "תשובות לשאלות הנפוצות על תכנון פיננסי: למי זה מתאים, מה כולל התהליך, מה העלות ועוד.",
};

const faqs = [
  {
    q: "למי מתאים תכנון פיננסי?",
    a: "לכל אחד, בכל גיל, ולכל מי שרוצה לשפר את מצבו הכלכלי. אין צורך בידע מוקדם או בסכום התחלתי מסוים.",
  },
  {
    q: "האם מדובר בתהליך מורכב?",
    a: "לא. תהליך התכנון הפיננסי אינו מורכב ואינו דורש ידע מוקדם. במהלך התהליך תקבלו את הידע והכלים שתצטרכו.",
  },
  {
    q: "מה כולל התהליך?",
    a: "התהליך כולל שיחת אפיון צרכים, שלב של איסוף נתונים, ושלב של בניית התוכנית. בסיומו תקבלו תוכנית מפורטת עם הצעות ליישום.",
  },
  {
    q: "האם התהליך כולל גם ייעוץ פנסיוני?",
    a: "איני בעל רישיון פנסיוני, ולכן איני יכול לתת ייעוץ פנסיוני פורמלי. עם זאת, חלק מהתכנון כן כולל מעבר על הנכסים הפנסיוניים שלכם כחלק מהתמונה הכוללת.",
  },
  {
    q: "מה העלות?",
    a: "העלות תלויה במורכבות ובהיקף התכנון הנדרש. תכנון יכול לנוע בין 2,500 ₪ לתכנון פשוט ועד 10,000 ₪ לתכנון מקיף.",
  },
];

export default function FAQPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <PageHeader
        eyebrow="שאלות נפוצות"
        title="כל מה שרציתם לדעת"
        subtitle="ריכזתי כאן את השאלות שאני נשאל הכי הרבה. לא מצאתם תשובה? דברו איתי."
      />

      <section className="section">
        <div className="container-page mx-auto max-w-3xl space-y-4">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-card"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-bold text-ink">
                {f.q}
                <span className="ml-2 text-brand-600 transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-4 text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <CTA />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
