import PageHeader from "@/components/PageHeader";
import MiluimCalculator from "@/components/MiluimCalculator";
import CTA from "@/components/CTA";

export const metadata = {
  title: "מחשבון תגמולי ומענקי מילואים",
  description:
    "מחשבון תגמולי מילואים — חישוב התגמול המיוחד לפי דרג (רמת פעילות) ומספר ימי המילואים, כולל מענק לחימה, מענק הוצאות אישיות ומענק משפחה.",
};

export default function MiluimCalculatorPage() {
  return (
    <>
      <PageHeader
        eyebrow="מחשבונים"
        title="מחשבון תגמולי ומענקי מילואים"
        subtitle="אומדן לסך התגמול המיוחד והמענקים — לפי דרג (רמת פעילות היחידה) ומספר ימי המילואים בשנה."
      />

      <section className="section">
        <div className="container-page mx-auto max-w-4xl">
          <MiluimCalculator />

          <p className="mt-8 rounded-xl bg-slate-50 p-4 text-center text-sm text-ink-soft">
            החישוב להמחשה כללית בלבד, מבוסס על התעריפים שהוזנו, על מדיניות
            התגמולים של צה״ל ועל שיעורי התגמול של המוסד לביטוח לאומי, ואינו מהווה
            תחליף לנתונים הרשמיים. תגמול המילואים (החזר השכר) חייב במס ומחושב לפי
            השכר בכפוף למינימום ולמקסימום; התגמול המיוחד והמענקים פטורים ממס.
            סכומים בפועל עשויים להשתנות.
          </p>
        </div>
      </section>

      <CTA
        title="רוצים לתכנן נכון את התקופה?"
        text="המחשבון נותן כיוון — בתכנון אישי נבנה תמונה מלאה של ההכנסות, ההטבות והזכויות שלכם."
      />
    </>
  );
}
