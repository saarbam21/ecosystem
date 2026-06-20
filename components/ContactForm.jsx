"use client";

import { useState } from "react";
import { site } from "@/lib/site";

export default function ContactForm() {
  const [status, setStatus] = useState("idle"); // idle | sending | success | error

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");

    const formData = new FormData(e.target);
    formData.append("access_key", site.web3formsKey);
    formData.append("subject", "פנייה חדשה מאתר Ecosystem");
    formData.append("from_name", "אתר Ecosystem");

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        e.target.reset();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="card text-center" role="status" aria-live="polite">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl text-brand-700">
          ✓
        </div>
        <h3 className="mt-4 text-xl font-bold text-ink">ההודעה נשלחה!</h3>
        <p className="mt-2 text-ink-soft">
          תודה על הפנייה. אחזור אליכם בהקדם. אפשר גם להשיג אותי בוואטסאפ או בטלפון.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="btn-outline mt-6"
        >
          שליחת הודעה נוספת
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      <div>
        <label htmlFor="name" className="mb-1.5 block font-medium text-ink">
          שם מלא
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="ישראל ישראלי"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="mb-1.5 block font-medium text-ink">
            טלפון
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="050-0000000"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block font-medium text-ink">
            אימייל
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="name@example.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block font-medium text-ink">
          במה אוכל לעזור?
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="ספרו לי בקצרה מה מעניין אתכם..."
        />
      </div>

      {/* Honeypot anti-spam field */}
      <input
        type="checkbox"
        name="botcheck"
        className="hidden"
        style={{ display: "none" }}
        tabIndex={-1}
        autoComplete="off"
      />

      <button
        type="submit"
        disabled={status === "sending"}
        aria-busy={status === "sending"}
        className="btn-primary w-full disabled:opacity-60"
      >
        {status === "sending" ? "שולח..." : "שליחה"}
      </button>

      {status === "error" && (
        <p role="alert" className="text-center text-sm text-red-700">
          אירעה שגיאה בשליחה. נסו שוב, או צרו קשר ישירות בטלפון/וואטסאפ.
        </p>
      )}
    </form>
  );
}
