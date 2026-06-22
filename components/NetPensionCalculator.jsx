"use client";

import { useMemo, useState } from "react";

const ILS = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

// A deduction line: formatted as a negative so the minus hugs the digits and
// the ₪ sign stays to the left (matching the headline net figure).
const ILSminus = (x) => (Math.abs(x) < 0.5 ? ILS.format(0) : ILS.format(-Math.abs(x)));

const CURRENT_YEAR = new Date().getFullYear();

// Severance "use up" multiplier and the statutory divisor used in the
// exempt-capital formula (תיקון 190 / קיבוע זכויות).
const SEVERANCE_FACTOR = 1.35;
const CAPITAL_DIVISOR = 180; // 180 months = 15 years

// ===================================================================
// ערכים הקבועים בחוק — ערוך כאן ידנית אם החקיקה משתנה.
// ===================================================================
// תקרת קצבה מזכה (חודשי):
const EXEMPT_CEILING = 9430;

// שיעור הפטור על הקצבה המזכה לפי שנת הפרישה (%):
function exemptRateForYear(year) {
  if (year <= 2026) return 57.5;
  if (year === 2027) return 62.5;
  return 67; // 2028 ואילך
}

// הוראת מעבר: פיצויים פטורים שנמשכו לפני שנה זו, וחלפו מאז לפחות
// מספר השנים שלהלן ועד הפרישה — אינם פוגעים בפטור.
const TRANSITION_BEFORE_YEAR = 2012;
const TRANSITION_YEARS = 15;
// ===================================================================

// Israeli CPI (מדד המחירים לצרכן), base 2006 = 100. Source: dekel.co.il.
// Used for actual historical indexation of severance. Each value is the
// December index of the year; the last year is the latest published month.
const CPI = {
  2007: 102.5,
  2008: 102.5,
  2009: 106.4,
  2010: 113.5,
  2011: 115.97,
  2012: 117.87,
  2013: 120.01,
  2014: 119.77,
  2015: 118.58,
  2016: 118.34,
  2017: 118.81,
  2018: 119.76,
  2019: 120.48,
  2020: 119.64,
  2021: 122.99,
  2022: 129.47,
  2023: 133.3,
  2024: 137.62,
  2025: 141.257,
  2026: 142.894, // latest published month (May 2026)
};
const CPI_FIRST = 2007;
const CPI_LAST = 2026;

// Actual CPI level for a year, clamped to the table range. Severance is indexed
// from the withdrawal year up to today (the latest known index) only — no
// forward projection to retirement (future inflation would also raise the
// exempt ceiling, so it is intentionally left out).
function cpiAt(year) {
  const y = Math.round(year);
  if (y <= CPI_FIRST) return CPI[CPI_FIRST];
  if (y >= CPI_LAST) return CPI[CPI_LAST];
  return CPI[y];
}

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

function formatAge(age) {
  const y = Math.floor(age);
  const m = Math.round((age - y) * 12);
  if (m === 0) return `${y}`;
  return `${y} ו-${m} ח׳`;
}

// --- Israeli pension tax assumptions (defaults; editable in the UI) ---
// Monthly income-tax brackets (2025). Each: up to `ceil` taxed at `rate`.
const TAX_BRACKETS = [
  { ceil: 7010, rate: 0.1 },
  { ceil: 10060, rate: 0.14 },
  { ceil: 16150, rate: 0.2 },
  { ceil: 22440, rate: 0.31 },
  { ceil: 46690, rate: 0.35 },
  { ceil: 60130, rate: 0.47 },
  { ceil: Infinity, rate: 0.5 },
];

const DEFAULTS = {
  pointValue: 242, // שווי נקודת זיכוי (חודשי)
  pointsMale: 2.25,
  pointsFemale: 2.75,
};

// Monthly income tax before credits, given monthly taxable income.
function incomeTaxMonthly(taxable) {
  let tax = 0;
  let prev = 0;
  for (const b of TAX_BRACKETS) {
    if (taxable <= prev) break;
    const slice = Math.min(taxable, b.ceil) - prev;
    tax += slice * b.rate;
    prev = b.ceil;
  }
  return tax;
}

let pid = 0;
const newPortfolio = () => ({
  id: ++pid,
  name: "",
  balance: "",
  factor: "200",
  recognized: "", // קצבה מוכרת (חלק מהצבירה שפטור ממס)
});

let sid = 0;
const newSeverance = () => ({
  id: ++sid,
  amount: "",
  year: String(CURRENT_YEAR),
});

// ----- shared field components -----

function NumField({ label, value, onChange, placeholder, suffix, thousands, asText, center, hint }) {
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
          className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${
            center ? "text-center" : "text-right"
          }`}
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

function Slider({ label, value, min, max, step = 1, suffix = "", display, onChange }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="font-medium text-ink">{label}</label>
        <span className="font-bold text-brand-700">
          {display ?? `${value}${suffix}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-brand-600"
        aria-label={label}
      />
    </div>
  );
}

function Row({ label, value, strong, muted }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className={strong ? "font-bold text-ink" : muted ? "text-ink-soft" : "text-ink-soft"}>
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

function Check({ checked, onChange, children, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600"
      />
      <span>
        <span className="font-medium text-ink">{children}</span>
        {hint && <span className="mt-0.5 block text-xs text-ink-soft">{hint}</span>}
      </span>
    </label>
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

// ----- the calculator (single screen) -----

export default function NetPensionCalculator() {
  const [gender, setGender] = useState("male");
  const [currentAge, setCurrentAge] = useState(50);
  const [retireAge, setRetireAge] = useState(67);
  const [portfolios, setPortfolios] = useState([newPortfolio()]);

  // Rights-fixing checklist (קיבוע זכויות).
  const [kibuaDone, setKibuaDone] = useState(true);
  const [severanceWithdrawn, setSeveranceWithdrawn] = useState(false);
  const [severances, setSeverances] = useState([newSeverance()]);

  // Editable tax assumptions.
  const [tax, setTax] = useState({
    pointValue: String(DEFAULTS.pointValue),
    points: String(DEFAULTS.pointsMale),
  });
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showExemptDetail, setShowExemptDetail] = useState(false);
  const [showNetDetail, setShowNetDetail] = useState(false);

  const setGender2 = (g) => {
    setGender(g);
    setRetireAge(g === "male" ? 67 : 65);
    setTax((t) => ({
      ...t,
      points: String(g === "male" ? DEFAULTS.pointsMale : DEFAULTS.pointsFemale),
    }));
  };

  const setPortfolio = (id, patch) =>
    setPortfolios((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const addPortfolio = () => setPortfolios((ps) => [...ps, newPortfolio()]);
  const removePortfolio = (id) =>
    setPortfolios((ps) => ps.filter((p) => p.id !== id));

  const setSeverance = (id, patch) =>
    setSeverances((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const addSeverance = () => setSeverances((ss) => [...ss, newSeverance()]);
  const removeSeverance = (id) =>
    setSeverances((ss) => ss.filter((s) => s.id !== id));

  // ----- calculation -----
  const result = useMemo(() => {
    const yearsToRetire = Math.max(0, num(retireAge) - num(currentAge));
    const retireYear = CURRENT_YEAR + yearsToRetire;

    // Exemption rate per the statutory schedule for the retirement year.
    const exemptRateAtRetire = exemptRateForYear(retireYear);

    // Portfolios → gross pension + recognized (tax-free) pension.
    const lines = portfolios.map((p) => {
      const balance = num(p.balance);
      const factor = num(p.factor) || 1;
      const recognized = Math.min(num(p.recognized), balance);
      return {
        id: p.id,
        balance,
        factor,
        gross: balance / factor,
        recognizedPension: recognized / factor,
      };
    });
    const grossPension = lines.reduce((s, l) => s + l.gross, 0);
    const recognizedPension = lines.reduce((s, l) => s + l.recognizedPension, 0);

    // Exempt severance "used up", indexed from the withdrawal year up to today.
    // Each withdrawal: amount × index(withdrawal→today) × 1.35.
    // Transitional relief: withdrawn before 2012 and ≥15 years to retirement → no impact.
    const applyOffset = kibuaDone && severanceWithdrawn;
    const idxToday = cpiAt(CPI_LAST);
    const severanceLines = severances.map((s) => {
      const amount = num(s.amount);
      const wy = num(s.year) || CURRENT_YEAR;
      const idxAtWithdraw = cpiAt(wy);
      const indexFactor = idxAtWithdraw > 0 ? idxToday / idxAtWithdraw : 1;
      const indexed = amount * indexFactor;
      const exemptByTransition =
        wy < TRANSITION_BEFORE_YEAR && retireYear - wy >= TRANSITION_YEARS;
      const used = exemptByTransition ? 0 : indexed * SEVERANCE_FACTOR;
      return { id: s.id, amount, wy, indexed, used, exemptByTransition };
    });
    const offset = applyOffset
      ? severanceLines.reduce((s, l) => s + l.used, 0)
      : 0;

    // Exempt-capital formula: ceiling × rate × 180 − used, then ÷ 180.
    const exemptCapital = EXEMPT_CEILING * (exemptRateAtRetire / 100) * CAPITAL_DIVISOR;
    const remainingCapital = Math.max(0, exemptCapital - offset);
    const monthlyExemption = remainingCapital / CAPITAL_DIVISOR;

    // The entitling-pension exemption requires rights-fixing (קיבוע זכויות),
    // which is only relevant from the eligibility age (60). Drawing a pension
    // before 60 → no exemption at all.
    const ageEligible = num(retireAge) >= 60;
    const exemptionApplies = kibuaDone && ageEligible;

    // The recognized pension is fully exempt and stands aside from the
    // entitling-pension exemption, which applies to the remaining pension.
    const entitlingPension = Math.max(0, grossPension - recognizedPension);
    const creditValue = num(tax.points) * num(tax.pointValue);

    const netFor = (exemptCap) => {
      const exemptApplied = Math.min(entitlingPension, exemptCap);
      const taxable = Math.max(0, entitlingPension - exemptApplied);
      const taxBeforeCredits = incomeTaxMonthly(taxable);
      const taxDue = Math.max(0, taxBeforeCredits - creditValue);
      const net = grossPension - taxDue;
      const effRate = grossPension > 0 ? taxDue / grossPension : 0;
      return { exemptApplied, taxable, taxBeforeCredits, taxDue, net, effRate };
    };

    const withExemption = netFor(monthlyExemption); // from age 60 (exemption applies)
    const noExemption = netFor(0); // before 60 / no rights-fixing
    const actual = exemptionApplies ? withExemption : noExemption;

    return {
      lines,
      severanceLines,
      retireYear,
      ageEligible,
      exemptionApplies,
      exemptRateAtRetire,
      grossPension,
      recognizedPension,
      entitlingPension,
      exemptCapital,
      offset,
      remainingCapital,
      monthlyExemption,
      creditValue,
      // actual scenario (drives the breakdown and the headline when eligible)
      exemptApplied: actual.exemptApplied,
      taxable: actual.taxable,
      taxBeforeCredits: actual.taxBeforeCredits,
      taxDue: actual.taxDue,
      net: actual.net,
      effRate: actual.effRate,
      // comparison amounts for early (before-60) retirement
      netWith: withExemption.net,
      netWithout: noExemption.net,
    };
  }, [
    portfolios,
    severances,
    tax,
    kibuaDone,
    severanceWithdrawn,
    currentAge,
    retireAge,
  ]);

  return (
    <div className="space-y-6">
      {/* Personal details */}
      <div className="card">
        <SectionTitle>פרטים אישיים</SectionTitle>

        <div className="mb-5">
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
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Slider
            label="גיל נוכחי"
            value={currentAge}
            min={18}
            max={80}
            onChange={(v) => {
              setCurrentAge(v);
              if (v > retireAge) setRetireAge(v);
            }}
          />
          <div>
            <Slider
              label="גיל תחילת משיכת קצבה"
              value={retireAge}
              min={currentAge}
              max={80}
              display={formatAge(retireAge)}
              onChange={setRetireAge}
            />
            <p className="mt-1 text-xs text-ink-soft">
              שנת פרישה משוערת: {result.retireYear}.
              {!result.ageEligible &&
                " משיכת קצבה לפני גיל 60 — ללא פטור על הקצבה המזכה."}
            </p>
          </div>
        </div>
      </div>

      {/* Portfolios */}
      <div className="card">
        <SectionTitle
          action={
            <button
              type="button"
              onClick={addPortfolio}
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              + הוספת תיק
            </button>
          }
        >
          צבירה צפויה ומקדם
        </SectionTitle>
        <p className="-mt-2 mb-4 text-sm text-ink-soft">
          לכל תיק (קרן פנסיה, ביטוח מנהלים, קופת גמל) הזינו את הצבירה הצפויה בגיל
          הפרישה ואת מקדם ההמרה לקצבה. הקצבה החודשית מכל תיק = צבירה ÷ מקדם.
        </p>

        <div className="space-y-4">
          {portfolios.map((p, idx) => {
            const line = result.lines[idx];
            return (
              <div
                key={p.id}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <input
                    type="text"
                    value={p.name}
                    placeholder={`תיק ${idx + 1} (לדוגמה: קרן פנסיה)`}
                    onChange={(e) => setPortfolio(p.id, { name: e.target.value })}
                    className="w-full max-w-[60%] rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                  />
                  {portfolios.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePortfolio(p.id)}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      הסרה
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumField
                    label="צבירה צפויה בפרישה"
                    value={p.balance}
                    placeholder="0"
                    suffix="₪"
                    thousands
                    onChange={(v) => setPortfolio(p.id, { balance: v })}
                  />
                  <NumField
                    label="מקדם המרה לקצבה"
                    value={p.factor}
                    placeholder="200"
                    onChange={(v) => setPortfolio(p.id, { factor: v })}
                  />
                  <NumField
                    label="מתוך הצבירה — קצבה מוכרת"
                    value={p.recognized}
                    placeholder="0"
                    suffix="₪"
                    thousands
                    hint="חלק הצבירה שמקורו בקצבה מוכרת — הקצבה ממנו פטורה ממס."
                    onChange={(v) => setPortfolio(p.id, { recognized: v })}
                  />
                </div>
                <div className="mt-3 text-left text-sm text-ink-soft">
                  קצבה מהתיק:{" "}
                  <span className="font-bold text-brand-700">
                    {ILS.format(line ? line.gross : 0)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl bg-brand-50 p-4 text-center">
          <p className="text-sm text-ink-soft">
            סה״כ קצבה חודשית ברוטו (לפני מס)
          </p>
          <p className="mt-1 text-2xl font-extrabold text-brand-700">
            {ILS.format(result.grossPension)}
          </p>
        </div>
      </div>

      {/* Net result */}
      <div className="card">
        <SectionTitle>קצבה נטו</SectionTitle>

        {/* Checklist */}
        <div className="mb-5 space-y-3">
          <Check
            checked={kibuaDone}
            onChange={setKibuaDone}
            hint="אם לא בוצע קיבוע זכויות — אין כלל פטור על הקצבה המזכה."
          >
            בוצע קיבוע זכויות
          </Check>

          <Check
            checked={severanceWithdrawn}
            onChange={setSeveranceWithdrawn}
            hint="פיצויים פטורים שנמשכו ב-32 שנות העבודה שקדמו לגיל הפרישה."
          >
            נמשכו פיצויים פטורים
          </Check>

          {severanceWithdrawn && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-semibold text-ink">פיצויים פטורים שנמשכו</h4>
                <button
                  type="button"
                  onClick={addSeverance}
                  className="text-sm font-semibold text-brand-700 hover:underline"
                >
                  + הוספת משיכה
                </button>
              </div>
              <div className="space-y-3">
                {severances.map((s, idx) => {
                  const sl = result.severanceLines.find((l) => l.id === s.id);
                  return (
                    <div
                      key={s.id}
                      className="grid items-end gap-3 sm:grid-cols-[1fr,6rem,1fr,auto]"
                    >
                      <NumField
                        label={idx === 0 ? "סכום שנמשך" : undefined}
                        value={s.amount}
                        placeholder="0"
                        suffix="₪"
                        thousands
                        onChange={(v) => setSeverance(s.id, { amount: v })}
                      />
                      <NumField
                        label={idx === 0 ? "שנת משיכה" : undefined}
                        value={s.year}
                        placeholder={String(CURRENT_YEAR)}
                        asText
                        onChange={(v) => setSeverance(s.id, { year: v })}
                      />
                      <div>
                        {idx === 0 && (
                          <label className="mb-1 block text-sm font-medium text-ink">
                            סכום הפגיעה בפטור
                          </label>
                        )}
                        <div
                          dir="rtl"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-ink"
                        >
                          {sl && sl.exemptByTransition ? (
                            <span className="text-xs font-medium text-emerald-700">
                              פטור (הוראת מעבר)
                            </span>
                          ) : (
                            ILS.format(sl ? sl.used : 0)
                          )}
                        </div>
                      </div>
                      {severances.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeSeverance(s.id)}
                          className="px-2 py-2 text-sm font-medium text-red-600 hover:underline"
                        >
                          הסרה
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-ink-soft">
                סכום הפגיעה בפטור = הסכום שנמשך × {SEVERANCE_FACTOR}, ממודד ממועד
                המשיכה ועד היום לפי מדד המחירים לצרכן.
              </p>
              {!kibuaDone && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  לא סומן "בוצע קיבוע זכויות" — לכן אין כלל פטור על הקצבה המזכה.
                </p>
              )}
            </div>
          )}
        </div>

        {result.ageEligible ? (
          <div className="rounded-2xl border-2 border-brand-200 bg-white p-5 text-center">
            <p className="text-sm text-ink-soft">קצבה חודשית נטו (אחרי מס)</p>
            <p className="mt-1 text-4xl font-extrabold text-brand-700">
              {ILS.format(result.net)}
            </p>
            <p className="mt-2 text-xs text-ink-soft">
              מתוך ברוטו {ILS.format(result.grossPension)} · שיעור מס אפקטיבי{" "}
              {(result.effRate * 100).toFixed(1)}%
            </p>
          </div>
        ) : (
          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border-2 border-brand-300 bg-white p-5 text-center">
                <p className="text-sm font-semibold text-ink">
                  פרישה לפני גיל 60
                </p>
                <p className="text-xs text-ink-soft">ללא פטור על הקצבה המזכה</p>
                <p className="mt-2 text-3xl font-extrabold text-brand-700">
                  {ILS.format(result.netWithout)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
                <p className="text-sm font-semibold text-ink">מגיל 60 ואילך</p>
                <p className="text-xs text-ink-soft">עם פטור על הקצבה המזכה</p>
                <p className="mt-2 text-3xl font-extrabold text-ink">
                  {ILS.format(result.netWith)}
                </p>
              </div>
            </div>
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-center text-xs font-medium text-amber-800">
              משיכת קצבה לפני גיל 60 — אין פטור על הקצבה המזכה. ההפרש לעומת פרישה
              מגיל 60: {ILS.format(result.netWith - result.netWithout)} לחודש.
            </p>
          </div>
        )}

        {/* Breakdown (hidden by default) */}
        <div className="mt-5 rounded-xl border border-slate-100">
          <button
            type="button"
            onClick={() => setShowNetDetail((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-ink"
          >
            <span>פירוט חישוב הנטו</span>
            <span className="text-ink-soft">{showNetDetail ? "−" : "+"}</span>
          </button>
          {showNetDetail && (
            <dl className="divide-y divide-slate-100 border-t border-slate-100 text-sm">
              <Row label="קצבה ברוטו" value={ILS.format(result.grossPension)} />
              {result.recognizedPension > 0 && (
                <Row
                  label="קצבה מוכרת (פטורה ממס)"
                  value={ILSminus(result.recognizedPension)}
                />
              )}
              <Row
                label="פטור על קצבה מזכה"
                value={ILSminus(result.exemptApplied)}
              />
              <Row label="הכנסה חייבת במס" value={ILS.format(result.taxable)} />
              <Row
                label="מס לפי מדרגות"
                value={ILS.format(result.taxBeforeCredits)}
              />
              <Row
                label="זיכוי נקודות זיכוי"
                value={ILSminus(result.creditValue)}
              />
              <Row label="מס לתשלום" value={ILS.format(result.taxDue)} strong />
              <Row label="קצבה נטו" value={ILS.format(result.net)} strong />
            </dl>
          )}
        </div>

        {/* Exemption derivation */}
        <div className="mt-3 rounded-xl border border-slate-100">
          <button
            type="button"
            onClick={() => setShowExemptDetail((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-ink"
          >
            <span>פירוט חישוב הפטור על הקצבה המזכה</span>
            <span className="text-ink-soft">{showExemptDetail ? "−" : "+"}</span>
          </button>
          {showExemptDetail &&
            (!result.ageEligible ? (
              <p className="border-t border-slate-100 px-4 py-3 text-sm text-amber-700">
                משיכת קצבה לפני גיל 60 — אין פטור על הקצבה המזכה (קיבוע זכויות חל
                מגיל הזכאות, 60).
              </p>
            ) : !kibuaDone ? (
              <p className="border-t border-slate-100 px-4 py-3 text-sm text-amber-700">
                לא בוצע קיבוע זכויות — אין כלל פטור על הקצבה המזכה.
              </p>
            ) : (
              <dl className="divide-y divide-slate-100 border-t border-slate-100 text-sm">
                <Row
                  label={`שיעור הפטור בפרישה (${result.retireYear})`}
                  value={result.exemptRateAtRetire.toFixed(1) + "%"}
                />
                <Row
                  label="הון פטור (תקרה × שיעור × 180)"
                  value={ILS.format(result.exemptCapital)}
                />
                <Row
                  label="קיזוז פיצויים פטורים (×1.35, ממודד)"
                  value={ILSminus(result.offset)}
                />
                <Row
                  label="יתרת הון פטור"
                  value={ILS.format(result.remainingCapital)}
                />
                <Row
                  label="פטור חודשי (יתרה ÷ 180)"
                  value={ILS.format(result.monthlyExemption)}
                  strong
                />
              </dl>
            ))}
        </div>

        {/* Editable assumptions */}
        <div className="mt-3 rounded-xl border border-slate-100">
          <button
            type="button"
            onClick={() => setShowAssumptions((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-ink"
          >
            <span>הנחות מס (ניתן לעריכה)</span>
            <span className="text-ink-soft">{showAssumptions ? "−" : "+"}</span>
          </button>
          {showAssumptions && (
            <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
              <NumField
                label="נקודות זיכוי"
                value={tax.points}
                onChange={(v) => setTax((t) => ({ ...t, points: v }))}
              />
              <NumField
                label="שווי נקודת זיכוי (חודשי)"
                value={tax.pointValue}
                suffix="₪"
                onChange={(v) => setTax((t) => ({ ...t, pointValue: v }))}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
