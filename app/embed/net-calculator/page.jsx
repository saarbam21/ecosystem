import NetPensionCalculator from "@/components/NetPensionCalculator";

export const metadata = {
  title: "מחשבון קצבה נטו",
  description:
    "מחשבון קצבה נטו — חישוב הקצבה החודשית אחרי מס, לפי צבירה צפויה ומקדם המרה.",
  robots: { index: false, follow: false },
  alternates: { canonical: undefined },
};

export default function EmbeddedNetCalculatorPage() {
  return (
    <div className="container-page py-8">
      <h1 className="mb-2 text-center text-2xl font-extrabold text-ink sm:text-3xl">
        מחשבון קצבה נטו
      </h1>
      <p className="mb-8 text-center text-ink-soft">
        חישוב הקצבה החודשית נטו, אחרי מס הכנסה — לפי צבירה צפויה ומקדם המרה.
      </p>

      <div className="mx-auto max-w-4xl">
        <NetPensionCalculator />

        <p className="mt-8 rounded-xl bg-slate-50 p-4 text-center text-sm text-ink-soft">
          חישוב המס להמחשה בלבד, מבוסס על הנחות מס כלליות הניתנות לעריכה, ואינו
          מהווה ייעוץ מס או פנסיוני. לחישוב מדויק יש להתחשב בנתונים אישיים מלאים.
        </p>
      </div>
    </div>
  );
}
