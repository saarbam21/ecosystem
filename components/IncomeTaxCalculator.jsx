"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_INCOME_TAX_CONFIG,
  useIncomeTaxConfig,
  annualIncomeTax,
  marginalRate,
} from "@/lib/incomeTaxConfig";

const ILS = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

// A deduction line: formatted negative so the minus hugs the digits and the ₪
// stays to the left (matching the headline figures).
const ILSminus = (x) => (Math.abs(x) < 0.5 ? ILS.format(0) : ILS.format(-Math.abs(x)));

function num(v) {
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

// Format a numeric string with thousands separators while typing.
function formatThousands(str) {
  const cleaned = String(str ?? "").replace(/[^\d.]/g, "");
  if (cleaned === "") return "";
  const [intPart, ...rest] = cleaned.split(".");
  const dec = rest.length ? "." + rest.join("") : "";
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + dec;
}

// The three capital-income categories reported on a 867.
const CAPITAL_CATEGORIES = [
  { k: "dividend", t: "דיבידנד" },
  { k: "interest", t: "ריבית" },
  { k: "capitalgain", t: "רווח הון (ני״ע)" },
  { k: "other", t: "אחר" },
];
const categoryLabel = (k) =>
  CAPITAL_CATEGORIES.find((c) => c.k === k)?.t ?? "הון";

// ----- documents -----

let docId = 0;
const newDoc = (type = "106") => {
  const base = { id: ++docId, type };
  if (type === "106") return { ...base, employer: "", income: "", withheld: "" };
  if (type === "867")
    return { ...base, category: "dividend", income: "", withheld: "", rate: "" };
  // "other": free-form income line, ordinary or capital.
  return { ...base, label: "", kind: "ordinary", income: "", withheld: "", rate: "" };
};

// ----- shared field components (matching NetPensionCalculator) -----

function NumField({ label, value, onChange, placeholder, suffix, thousands, asText, hint }) {
  const handle = (e) =>
    onChange(thousands ? formatThousands(e.target.value) : e.target.value);
  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      )}
      <div className="relative">
        <input
          type={thousands || asText ? "text" : "number"}
          inputMode={thousands || asText ? "numeric" : "decimal"}
          dir="ltr"
          value={value}
          placeholder={placeholder}
          onChange={handle}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        {suffix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

function Row({ label, value, strong, muted }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className={strong ? "font-bold text-ink" : muted ? "text-ink-soft" : "text-ink"}>
        {label}
      </dt>
      <dd
        dir="rtl"
        className={strong ? "font-extrabold text-brand-700" : "font-semibold text-ink"}
      >
        {value}
      </dd>
    </div>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-lg font-bold text-ink">{children}</h3>
      {action}
    </div>
  );
}

function Select({ label, value, onChange, options, dir = "rtl" }) {
  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={dir}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      >
        {options.map((o) => (
          <option key={o.k} value={o.k}>
            {o.t}
          </option>
        ))}
      </select>
    </div>
  );
}

// ----- the calculator (single screen) -----

export default function IncomeTaxCalculator() {
  const cfg = useIncomeTaxConfig();

  const [gender, setGender] = useState("male");
  const [docs, setDocs] = useState([newDoc("106")]);

  const [tax, setTax] = useState({
    points: String(DEFAULT_INCOME_TAX_CONFIG.pointsMale),
    pointValue: String(DEFAULT_INCOME_TAX_CONFIG.pointValueAnnual),
    surtaxRate: String(DEFAULT_INCOME_TAX_CONFIG.surtaxRate * 100),
    surtaxThreshold: String(DEFAULT_INCOME_TAX_CONFIG.surtaxThreshold),
  });

  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const setGender2 = (g) => {
    setGender(g);
    setTax((t) => ({
      ...t,
      points: String(g === "male" ? cfg.pointsMale : cfg.pointsFemale),
    }));
  };

  const setDoc = (id, patch) =>
    setDocs((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const addDoc = (type) => setDocs((ds) => [...ds, newDoc(type)]);
  const removeDoc = (id) => setDocs((ds) => ds.filter((d) => d.id !== id));

  // ----- calculation -----
  const result = useMemo(() => {
    const capitalRateFor = (category, rate) => {
      const r = num(rate);
      if (r > 0) return r > 1 ? r / 100 : r; // accept "25" or "0.25"
      return cfg.capitalRates[category] ?? cfg.capitalRates.other;
    };

    let ordinaryIncome = 0;
    let capitalIncome = 0;
    let capitalTax = 0;
    let withheldOrdinary = 0;
    let withheldCapital = 0;
    const capitalLines = [];

    for (const d of docs) {
      const income = num(d.income);
      const withheld = num(d.withheld);
      if (d.type === "106") {
        ordinaryIncome += income;
        withheldOrdinary += withheld;
      } else if (d.type === "867") {
        const rate = capitalRateFor(d.category, d.rate);
        capitalIncome += income;
        capitalTax += income * rate;
        withheldCapital += withheld;
        capitalLines.push({ id: d.id, category: d.category, income, rate, withheld });
      } else {
        // "other"
        if (d.kind === "capital") {
          const rate = capitalRateFor("other", d.rate);
          capitalIncome += income;
          capitalTax += income * rate;
          withheldCapital += withheld;
          capitalLines.push({ id: d.id, category: "other", income, rate, withheld });
        } else {
          ordinaryIncome += income;
          withheldOrdinary += withheld;
        }
      }
    }

    const ordinaryBracketTax = annualIncomeTax(cfg, ordinaryIncome);
    const credit = num(tax.points) * num(tax.pointValue);
    const creditUsed = Math.min(credit, ordinaryBracketTax);
    const ordinaryAfterCredit = Math.max(0, ordinaryBracketTax - credit);

    const totalTaxable = ordinaryIncome + capitalIncome;
    const surtaxRate = num(tax.surtaxRate) / 100;
    const surtaxThreshold = num(tax.surtaxThreshold);
    const surtax = surtaxRate * Math.max(0, totalTaxable - surtaxThreshold);

    const liability = ordinaryAfterCredit + capitalTax + surtax;
    const withheldTotal = withheldOrdinary + withheldCapital;
    const balance = withheldTotal - liability; // + = refund, − = owed

    const effRate = totalTaxable > 0 ? liability / totalTaxable : 0;

    return {
      ordinaryIncome,
      capitalIncome,
      totalTaxable,
      capitalLines,
      ordinaryBracketTax,
      credit,
      creditUsed,
      ordinaryAfterCredit,
      capitalTax,
      surtax,
      surtaxThreshold,
      liability,
      withheldOrdinary,
      withheldCapital,
      withheldTotal,
      balance,
      effRate,
      marginal: marginalRate(cfg, ordinaryIncome),
    };
  }, [cfg, docs, tax]);

  const isRefund = result.balance >= 0;

  return (
    <div className="space-y-6">
      {/* Personal details */}
      <div className="card">
        <SectionTitle>פרטי הנישום</SectionTitle>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <span className="mb-1 block font-medium text-ink">מין</span>
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
              {[
                { k: "male", t: "גבר" },
                { k: "female", t: "אישה" },
              ].map((o) => (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => setGender2(o.k)}
                  className={`rounded-full px-5 py-1.5 text-sm font-semibold transition ${
                    gender === o.k
                      ? "bg-brand-700 text-white"
                      : "text-ink-soft hover:text-brand-700"
                  }`}
                >
                  {o.t}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              קובע את נקודות הזיכוי הבסיסיות (גבר 2.25 · אישה 2.75).
            </p>
          </div>

          <NumField
            label="נקודות זיכוי"
            value={tax.points}
            asText
            onChange={(v) => setTax((t) => ({ ...t, points: v }))}
            hint="הוסיפו נקודות עבור ילדים, תואר, יישוב מזכה, חייל משוחרר ועוד."
          />
        </div>

        <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-ink-soft">
          שווי נקודות הזיכוי לשנה:{" "}
          <span className="font-bold text-brand-700">
            {ILS.format(num(tax.points) * num(tax.pointValue))}
          </span>{" "}
          ({num(tax.points)} × {ILS.format(num(tax.pointValue))} לנקודה)
        </p>
      </div>

      {/* Documents */}
      <div className="card">
        <SectionTitle>מסמכים והכנסות</SectionTitle>
        <p className="-mt-2 mb-4 text-sm text-ink-soft">
          הזינו את הנתונים מכל טופס. טופס{" "}
          <span className="font-semibold text-ink">106</span> — משכורת מיגיעה
          אישית והמס שנוכה; טופס{" "}
          <span className="font-semibold text-ink">867</span> — הכנסות מהון
          (ריבית, דיבידנד, רווחי הון) והמס שנוכה במקור. "מסמך אחר" — לכל הכנסה
          נוספת.
        </p>

        <div className="space-y-4">
          {docs.map((d, idx) => (
            <DocCard
              key={d.id}
              doc={d}
              index={idx}
              onChange={(patch) => setDoc(d.id, patch)}
              onRemove={docs.length > 1 ? () => removeDoc(d.id) : null}
              defaultRate={
                d.type === "867"
                  ? cfg.capitalRates[d.category]
                  : cfg.capitalRates.other
              }
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addDoc("106")}
            className="rounded-full border border-brand-300 bg-white px-4 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            + טופס 106
          </button>
          <button
            type="button"
            onClick={() => addDoc("867")}
            className="rounded-full border border-brand-300 bg-white px-4 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            + טופס 867
          </button>
          <button
            type="button"
            onClick={() => addDoc("other")}
            className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-ink-soft transition hover:border-brand-300 hover:text-brand-700"
          >
            + מסמך אחר
          </button>
        </div>
      </div>

      {/* Result */}
      <div className="card">
        <SectionTitle>תוצאה — התחשבנות שנתית</SectionTitle>

        <div
          className={`rounded-2xl border-2 p-5 text-center ${
            isRefund
              ? "border-brand-200 bg-white"
              : "border-amber-300 bg-amber-50"
          }`}
        >
          <p className="text-sm text-ink-soft">
            {isRefund ? "החזר מס צפוי" : "יתרת מס לתשלום"}
          </p>
          <p
            className={`mt-1 text-4xl font-extrabold ${
              isRefund ? "text-brand-700" : "text-amber-700"
            }`}
          >
            {ILS.format(Math.abs(result.balance))}
          </p>
          <p className="mt-2 text-xs text-ink-soft">
            סה״כ חבות מס {ILS.format(result.liability)} · נוכה במקור{" "}
            {ILS.format(result.withheldTotal)} · שיעור מס אפקטיבי{" "}
            {(result.effRate * 100).toFixed(1)}%
          </p>
        </div>

        {/* Breakdown */}
        <div className="mt-5 rounded-xl border border-slate-100">
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-ink"
          >
            <span>פירוט חישוב המס</span>
            <span className="text-ink-soft">{showDetail ? "−" : "+"}</span>
          </button>
          {showDetail && (
            <dl className="divide-y divide-slate-100 border-t border-slate-100 text-sm">
              <Row
                label="הכנסה חייבת מיגיעה אישית (106)"
                value={ILS.format(result.ordinaryIncome)}
              />
              <Row
                label="מס לפי מדרגות (לפני זיכויים)"
                value={ILS.format(result.ordinaryBracketTax)}
              />
              <Row label="זיכוי נקודות זיכוי" value={ILSminus(result.creditUsed)} />
              <Row
                label="מס על יגיעה אישית (אחרי זיכוי)"
                value={ILS.format(result.ordinaryAfterCredit)}
              />
              {result.capitalIncome > 0 && (
                <Row
                  label="הכנסה מהון (867)"
                  value={ILS.format(result.capitalIncome)}
                />
              )}
              {result.capitalLines.map((l) => (
                <Row
                  key={l.id}
                  muted
                  label={`  ${categoryLabel(l.category)} — ${(l.rate * 100).toFixed(
                    0
                  )}% על ${ILS.format(l.income)}`}
                  value={ILS.format(l.income * l.rate)}
                />
              ))}
              {result.capitalTax > 0 && (
                <Row label="סה״כ מס על הון" value={ILS.format(result.capitalTax)} />
              )}
              {result.surtax > 0 && (
                <Row
                  label={`מס יסף (${num(tax.surtaxRate)}% מעל ${ILS.format(
                    result.surtaxThreshold
                  )})`}
                  value={ILS.format(result.surtax)}
                />
              )}
              <Row label="סה״כ חבות מס" value={ILS.format(result.liability)} strong />
              <Row
                label="מס שנוכה במקור (106 + 867)"
                value={ILSminus(result.withheldTotal)}
              />
              <Row
                label={isRefund ? "החזר מס צפוי" : "יתרת מס לתשלום"}
                value={ILS.format(Math.abs(result.balance))}
                strong
              />
            </dl>
          )}
        </div>

        {/* Editable assumptions */}
        <div className="mt-3 rounded-xl border border-slate-100">
          <button
            type="button"
            onClick={() => setShowAssumptions((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-ink"
          >
            <span>הנחות מס (ניתן לעריכה) · שנת מס {cfg.year}</span>
            <span className="text-ink-soft">{showAssumptions ? "−" : "+"}</span>
          </button>
          {showAssumptions && (
            <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
              <NumField
                label="שווי נקודת זיכוי (שנתי)"
                value={tax.pointValue}
                suffix="₪"
                asText
                onChange={(v) => setTax((t) => ({ ...t, pointValue: v }))}
              />
              <NumField
                label="שיעור מס יסף"
                value={tax.surtaxRate}
                suffix="%"
                asText
                onChange={(v) => setTax((t) => ({ ...t, surtaxRate: v }))}
              />
              <NumField
                label="תקרת מס יסף (שנתי)"
                value={tax.surtaxThreshold}
                suffix="₪"
                thousands
                onChange={(v) => setTax((t) => ({ ...t, surtaxThreshold: v }))}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----- a single document card, rendered per type -----

function DocCard({ doc, index, onChange, onRemove, defaultRate }) {
  const title =
    doc.type === "106"
      ? "טופס 106 — משכורת"
      : doc.type === "867"
      ? "טופס 867 — הכנסות מהון"
      : "מסמך אחר";

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-800">
          {title}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-sm font-medium text-red-600 hover:underline"
          >
            הסרה
          </button>
        )}
      </div>

      {doc.type === "106" && (
        <>
          <input
            type="text"
            value={doc.employer}
            placeholder={`שם המעסיק (מסמך ${index + 1})`}
            onChange={(e) => onChange({ employer: e.target.value })}
            className="mb-3 w-full max-w-[60%] rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField
              label="הכנסה חייבת (סעיף 158/172)"
              value={doc.income}
              placeholder="0"
              suffix="₪"
              thousands
              onChange={(v) => onChange({ income: v })}
            />
            <NumField
              label="מס הכנסה שנוכה (סעיף 042)"
              value={doc.withheld}
              placeholder="0"
              suffix="₪"
              thousands
              onChange={(v) => onChange({ withheld: v })}
            />
          </div>
        </>
      )}

      {doc.type === "867" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="סוג ההכנסה"
            value={doc.category}
            onChange={(v) => onChange({ category: v })}
            options={CAPITAL_CATEGORIES}
          />
          <NumField
            label="שיעור מס"
            value={doc.rate}
            placeholder={String((defaultRate ?? 0.25) * 100)}
            suffix="%"
            asText
            hint="ברירת מחדל לפי סוג ההכנסה. ריבית על פיקדון שקלי לרוב 15%."
            onChange={(v) => onChange({ rate: v })}
          />
          <NumField
            label="סכום ההכנסה"
            value={doc.income}
            placeholder="0"
            suffix="₪"
            thousands
            onChange={(v) => onChange({ income: v })}
          />
          <NumField
            label="מס שנוכה במקור"
            value={doc.withheld}
            placeholder="0"
            suffix="₪"
            thousands
            onChange={(v) => onChange({ withheld: v })}
          />
        </div>
      )}

      {doc.type === "other" && (
        <>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">
                תיאור
              </label>
              <input
                type="text"
                value={doc.label}
                placeholder="לדוגמה: הכנסה מעסק / שכר דירה"
                onChange={(e) => onChange({ label: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
            <Select
              label="סיווג ההכנסה"
              value={doc.kind}
              onChange={(v) => onChange({ kind: v })}
              options={[
                { k: "ordinary", t: "יגיעה אישית (מדרגות מס)" },
                { k: "capital", t: "הון (שיעור מס קבוע)" },
              ]}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField
              label="סכום ההכנסה"
              value={doc.income}
              placeholder="0"
              suffix="₪"
              thousands
              onChange={(v) => onChange({ income: v })}
            />
            <NumField
              label="מס שנוכה במקור"
              value={doc.withheld}
              placeholder="0"
              suffix="₪"
              thousands
              onChange={(v) => onChange({ withheld: v })}
            />
            {doc.kind === "capital" && (
              <NumField
                label="שיעור מס"
                value={doc.rate}
                placeholder="25"
                suffix="%"
                asText
                onChange={(v) => onChange({ rate: v })}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
