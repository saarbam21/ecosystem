"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { nav } from "@/lib/site";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" aria-label="Ecosystem - דף הבית" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav aria-label="ניווט ראשי" className="hidden items-center gap-1 md:flex">
          {nav.map((item) =>
            item.children ? (
              <div
                key={item.href}
                className="relative"
                onMouseEnter={() => setOpenMenu(item.href)}
                onMouseLeave={() => setOpenMenu(null)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setOpenMenu(null);
                }}
              >
                <Link
                  href={item.href}
                  onClick={() => setOpenMenu(null)}
                  onFocus={() => setOpenMenu(item.href)}
                  aria-expanded={openMenu === item.href}
                  className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-base font-medium text-ink-soft transition hover:bg-brand-50 hover:text-brand-700"
                >
                  {item.label}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition ${
                      openMenu === item.href ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </Link>
                {openMenu === item.href && (
                  <div className="absolute right-0 top-full z-50 pt-2">
                    <div className="min-w-[12rem] rounded-xl border border-slate-100 bg-white p-1 shadow-card">
                      {item.children.map((c) => (
                        <Link
                          key={c.href}
                          href={c.href}
                          onClick={() => setOpenMenu(null)}
                          className="block rounded-lg px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-brand-50 hover:text-brand-700"
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-base font-medium text-ink-soft transition hover:bg-brand-50 hover:text-brand-700"
              >
                {item.label}
              </Link>
            )
          )}
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
            {nav.map((item) =>
              item.children ? (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-3 text-base font-medium text-ink-soft hover:bg-brand-50 hover:text-brand-700"
                  >
                    {item.label}
                  </Link>
                  <div className="mr-3 flex flex-col border-r border-slate-100 pr-3">
                    {item.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        onClick={() => setOpen(false)}
                        className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-brand-50 hover:text-brand-700"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-ink-soft hover:bg-brand-50 hover:text-brand-700"
                >
                  {item.label}
                </Link>
              )
            )}
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
