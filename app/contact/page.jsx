import PageHeader from "@/components/PageHeader";
import ContactForm from "@/components/ContactForm";
import { site } from "@/lib/site";

export const metadata = {
  title: "צור קשר",
  description:
    "מעוניינים בתכנון פיננסי או בשיחת ייעוץ? השאירו פרטים ואחזור אליכם, או צרו קשר בטלפון ובוואטסאפ.",
};

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="צור קשר"
        title="בואו נדבר"
        subtitle="שיחת התאמה ללא עלות וללא התחייבות. השאירו פרטים ואחזור אליכם, או פנו אליי ישירות."
      />

      <section className="section">
        <div className="container-page grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <ContactForm />
          </div>

          <div className="lg:col-span-2">
            <div className="card">
              <h2 className="text-xl font-bold text-ink">פרטים ישירים</h2>
              <ul className="mt-5 space-y-4">
                <li>
                  <a
                    href={`tel:${site.phoneIntl}`}
                    className="flex items-center gap-3 text-ink transition hover:text-brand-700"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100">📞</span>
                    <span dir="ltr" className="font-medium">{site.phone}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={site.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-ink transition hover:text-brand-700"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100">💬</span>
                    <span className="font-medium">וואטסאפ</span>
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${site.email}`}
                    className="flex items-center gap-3 text-ink transition hover:text-brand-700"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100">✉️</span>
                    <span className="font-medium">{site.email}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={site.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-ink transition hover:text-brand-700"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100">📘</span>
                    <span className="font-medium">פייסבוק</span>
                  </a>
                </li>
              </ul>

              <a href={site.whatsapp} target="_blank" rel="noopener noreferrer" className="btn-whatsapp mt-7 w-full">
                שליחת הודעה בוואטסאפ
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
