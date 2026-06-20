export default function PageHeader({ eyebrow, title, subtitle }) {
  return (
    <section className="bg-gradient-to-b from-brand-50 to-white">
      <div className="container-page py-16 text-center sm:py-20">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="mt-3 text-4xl font-extrabold text-ink sm:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-soft">{subtitle}</p>
        )}
      </div>
    </section>
  );
}
