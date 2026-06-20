import Link from "next/link";
import { site } from "@/lib/site";

export default function CTA({
  title = "מוכנים לעשות סדר בכסף שלכם?",
  text = "שיחת התאמה ללא עלות וללא התחייבות — נבין יחד איפה אתם נמצאים ומה הצעדים הבאים.",
}) {
  return (
    <section className="section">
      <div className="container-page">
        <div className="overflow-hidden rounded-3xl bg-brand-700 px-8 py-14 text-center text-white sm:px-14">
          <h2 className="mx-auto max-w-2xl text-3xl font-extrabold sm:text-4xl">
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-brand-50/90">{text}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/contact/"
              className="btn bg-white text-brand-700 hover:bg-brand-50"
            >
              קביעת שיחת התאמה
            </Link>
            <a
              href={site.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp"
            >
              שליחת הודעה בוואטסאפ
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
