import PageHeader from "@/components/PageHeader";
import NetPensionCalculator from "@/components/NetPensionCalculator";
import CTA from "@/components/CTA";

export const metadata = {
  title: "מחשבון קצבה נטו",
  description:
    "מחשבון קצבה נטו — חישוב הקצבה החודשית אחרי מס, לפי צבירה צפויה ומקדם המרה.",
};

export default function NetCalculatorPage() {
  return (
    <>
      <PageHeader
        eyebrow="מחשבונים"
        title="מחשבון קצבה נטו"
        subtitle="חישוב הקצבה החודשית נטו, אחרי מס הכנסה — לפי צבירה צפויה ומקדם המרה."
      />

      <section className="section">
        <div className="container-page mx-auto max-w-4xl">
          <NetPensionCalculator />

          <p className="mt-8 rounded-xl bg-slate-50 p-4 text-center text-sm text-ink-soft">
            חישוב המס להמחשה בלבד, מבוסס על הנחות מס כלליות הניתנות לעריכה, ואינו
            מהווה ייעוץ מס או פנסיוני. לחישוב מדויק יש להתחשב בנתונים אישיים מלאים.
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
