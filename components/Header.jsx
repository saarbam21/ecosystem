"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { nav } from "@/lib/site";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" aria-label="Ecosystem - דף הבית" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav aria-label="ניווט ראשי" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-base font-medium text-ink-soft transition hover:bg-brand-50 hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link href="/contact/" className="btn-primary px-5 py-2.5 text-sm">
            קביעת שיחת התאמה
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink md:hidden"
          aria-label="תפריט"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 bg-white md:hidden">
          <nav aria-label="ניווט נייד" className="container-page flex flex-col py-3">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-ink-soft hover:bg-brand-50 hover:text-brand-700"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/contact/"
              onClick={() => setOpen(false)}
              className="btn-primary mt-2"
            >
              קביעת שיחת התאמה
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
