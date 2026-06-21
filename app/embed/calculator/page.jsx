import PensionCalculator from "@/components/PensionCalculator";

export const metadata = {
  title: "מחשבון קצבה ופרישה",
  description: "מחשבון קצבה ופרישה — צבירה צפויה וקצבה חודשית, ליחיד או לזוג.",
  robots: { index: false, follow: false },
  alternates: { canonical: undefined },
};

export default function EmbeddedCalculatorPage() {
  return (
    <div className="container-page py-8">
      <h1 className="mb-2 text-center text-2xl font-extrabold text-ink sm:text-3xl">
        מחשבון קצבה ופרישה
      </h1>
      <p className="mb-8 text-center text-ink-soft">
        אומדן לצבירה הצפויה ולקצבה החודשית בגיל פרישה — ליחיד או לזוג.
      </p>

      <div className="mx-auto max-w-4xl">
        <PensionCalculator />

        <p className="mt-8 rounded-xl bg-slate-50 p-4 text-center text-sm text-ink-soft">
          החישוב להמחשה כללית בלבד, מבוסס על ההנחות שהוזנו, ואינו מהווה ייעוץ
          פנסיוני, ייעוץ מס או תחליף לבדיקה אישית. תוצאות בפועל עשויות להשתנות.
        </p>
      </div>
    </div>
  );
}
