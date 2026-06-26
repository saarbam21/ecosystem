import Link from "next/link";

export const metadata = {
  title: "אזור ניהול",
};

export default function PrivateHome() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">אזור ניהול</h1>
        <p className="mt-2 text-ink-soft">
          כלים פנימיים ליועצים. האזור חסום למנוע חיפוש ומוגן בכניסה מאובטחת.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Link
          href="/private/parameters"
          className="card block transition hover:border-brand-300 hover:shadow-md"
        >
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-xl text-brand-700">
            ⚙️
          </div>
          <h2 className="text-lg font-bold text-ink">פרמטרים שנתיים</h2>
          <p className="mt-1 text-sm text-ink-soft">
            עריכת הערכים הקבועים בחוק של מחשבון הקצבה נטו — תקרות, שיעורי פטור,
            מדרגות מס ומדד. תצוגה מקדימה ופרסום.
          </p>
        </Link>
      </div>
    </div>
  );
}
