import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section">
      <div className="container-page flex flex-col items-center py-24 text-center">
        <p className="text-6xl font-extrabold text-brand-200">404</p>
        <h1 className="mt-4 text-3xl font-extrabold text-ink">הדף לא נמצא</h1>
        <p className="mt-3 max-w-md text-ink-soft">
          ייתכן שהקישור שגוי או שהדף הוסר. אפשר לחזור לדף הבית ולהמשיך משם.
        </p>
        <Link href="/" className="btn-primary mt-8">
          חזרה לדף הבית
        </Link>
      </div>
    </section>
  );
}
