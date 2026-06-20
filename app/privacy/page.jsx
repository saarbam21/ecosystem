import PageHeader from "@/components/PageHeader";
import { site } from "@/lib/site";

export const metadata = {
  title: "מדיניות פרטיות",
  description: "מדיניות הפרטיות של אתר Ecosystem.",
};

export default function PrivacyPage() {
  return (
    <>
      <PageHeader eyebrow="מידע משפטי" title="מדיניות פרטיות" />
      <section className="section">
        <div className="prose-he container-page mx-auto max-w-3xl">
          <p>
            אתר {site.name} ({site.url}) מכבד את פרטיות המשתמשים בו. מסמך זה מסביר
            איזה מידע נאסף וכיצד נעשה בו שימוש.
          </p>

          <h2>איסוף מידע</h2>
          <p>
            המידע היחיד שנאסף הוא הפרטים שאתם בוחרים למסור באופן יזום דרך טופס
            יצירת הקשר — שם, טלפון, אימייל ותוכן הפנייה. מידע זה משמש אך ורק לצורך
            יצירת קשר חוזר ומענה לפנייתכם.
          </p>

          <h2>שימוש במידע</h2>
          <p>
            לא נעשה שימוש במידע שלכם לכל מטרה אחרת, והוא לא יימכר או יועבר לצדדים
            שלישיים, למעט ספק שירות הטפסים המשמש לשליחת ההודעה אליי.
          </p>

          <h2>עוגיות (Cookies)</h2>
          <p>
            האתר עשוי לעשות שימוש בעוגיות טכניות בסיסיות לצורך תפעול תקין. ניתן
            לחסום עוגיות דרך הגדרות הדפדפן.
          </p>

          <h2>יצירת קשר</h2>
          <p>
            בכל שאלה בנושא פרטיות ניתן לפנות אליי במייל{" "}
            <a href={`mailto:${site.email}`}>{site.email}</a> או בטלפון{" "}
            <span dir="ltr">{site.phone}</span>.
          </p>

          <p className="text-sm">
            האמור באתר אינו מהווה ייעוץ השקעות, ייעוץ פנסיוני, ייעוץ מס או המלצה
            לפעולה, ואינו מחליף ייעוץ אישי המתחשב בנתוניו של כל אדם.
          </p>
        </div>
      </section>
    </>
  );
}
