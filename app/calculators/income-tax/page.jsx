import PageHeader from "@/components/PageHeader";
import IncomeTaxCalculator from "@/components/IncomeTaxCalculator";
import CTA from "@/components/CTA";

export const metadata = {
  title: "מחשבון מס הכנסה ליחיד",
  description:
    "מחשבון מס הכנסה ליחיד — חישוב חבות המס והחזר המס לפי טופסי 106 ו-867, מין הנישום ונקודות זיכוי.",
};

export default function IncomeTaxCalculatorPage() {
  return (
    <>
      <PageHeader
        eyebrow="מחשבונים"
        title="מחשבון מס הכנסה"
        subtitle="חישוב חבות המס השנתית והחזר המס — ליחיד או לבני זוג, לפי טופסי 106 ו-867, מין הנישום ונקודות הזיכוי."
      />

      <section className="section">
        <div className="container-page mx-auto max-w-4xl">
          <IncomeTaxCalculator />

          <p className="mt-8 rounded-xl bg-slate-50 p-4 text-center text-sm text-ink-soft">
            החישוב להמחשה בלבד, מבוסס על הנתונים שהוזנו ועל מדרגות המס לשנת 2025,
            ואינו מהווה ייעוץ מס או תחליף להגשת דוח מסודר. לחישוב מדויק יש
            להתחשב במלוא הנתונים האישיים.
          </p>
        </div>
      </section>

      <CTA
        title="רוצים לבדוק אם מגיע לכם החזר מס?"
        text="המחשבון נותן כיוון — בבדיקה אישית נעבור על המסמכים ונמצה את מלוא הזכויות שלכם."
      />
    </>
  );
}
