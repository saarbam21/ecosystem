import PageHeader from "@/components/PageHeader";
import PensionCalculator from "@/components/PensionCalculator";
import CTA from "@/components/CTA";

export const metadata = {
  title: "מחשבונים",
  description:
    "מחשבון קצבה ופרישה — חשבו את הצבירה הצפויה והקצבה החודשית ליחיד או לזוג, כולל דמי ניהול, תשואה ומקדם המרה.",
};

export default function CalculatorsPage() {
  return (
    <>
      <PageHeader
        eyebrow="מחשבונים"
        title="מחשבון קצבה ופרישה"
        subtitle="אומדן לצבירה הצפויה ולקצבה החודשית בגיל פרישה — ליחיד או לזוג."
      />

      <section className="section">
        <div className="container-page mx-auto max-w-4xl">
          <PensionCalculator />

          <p className="mt-8 rounded-xl bg-slate-50 p-4 text-center text-sm text-ink-soft">
            החישוב להמחשה כללית בלבד, מבוסס על ההנחות שהוזנו, ואינו מהווה ייעוץ
            פנסיוני, ייעוץ מס או תחליף לבדיקה אישית. תוצאות בפועל עשויות להשתנות.
          </p>
        </div>
      </section>

      <CTA
        title="רוצים לבדוק את התמונה המלאה?"
        text="המחשבון נותן כיוון — בתכנון אישי נצלול לעומק ונתאים תוכנית בדיוק עבורכם."
      />
    </>
  );
}
