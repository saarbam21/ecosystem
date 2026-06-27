"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_TAX_CONFIG,
  useTaxConfig,
  exemptForYear,
  incomeTaxMonthly,
  cpiAtMonth,
  legalRetirementAge,
} from "@/lib/taxConfig";

const ILS = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

// A deduction line: formatted as a negative so the minus hugs the digits and
// the ₪ sign stays to the left (matching the headline net figure).
const ILSminus = (x) => (Math.abs(x) < 0.5 ? ILS.format(0) : ILS.format(-Math.abs(x)));

// Plain LTR number with a trailing ₪ (no RLM marks) for inline formulas.
const fmtNum = (x) => Math.round(x).toLocaleString("en-US") + " ₪";

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const CURRENT_MONTH_KEY = `${CURRENT_YEAR}-${String(NOW.getMonth() + 1).padStart(2, "0")}`;

const HEB_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
// Default birth = 50 years before the current month.
const DEFAULT_BIRTH = `${CURRENT_YEAR - 50}-${String(NOW.getMonth() + 1).padStart(2, "0")}`;

// "YYYY-MM" month-key helpers.
const monthIndex = (key) => {
  const [y, m] = String(key).split("-").map(Number);
  return y * 12 + (m - 1);
};
const keyFromIndex = (idx) =>
  `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
const addMonthsKey = (key, n) => keyFromIndex(monthIndex(key) + n);
const hebMonthLabel = (key) => {
  const [y, m] = String(key).split("-").map(Number);
  return `${HEB_MONTHS[m - 1]} ${y}`;
};

// Statutory parameters (ceilings, exempt rates, CPI table, brackets, ...) live
// in lib/taxParams.json and are consumed via the config from useTaxConfig().

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
  month: CURRENT_MONTH_KEY, // YYYY-MM
  yearsWorked: "", // שנות עבודה במקום העבודה (ריק = כל הסכום פוגע בפטור)
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

// Hebrew month + year selects, stored as a "YYYY-MM" string.
function MonthPicker({ value, onChange, monthClass = "w-24" }) {
  const [yy, mm] = (value || CURRENT_MONTH_KEY).split("-");
  const cls =
    "rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
  return (
    <div className="flex gap-2">
      <select
        value={mm}
        onChange={(e) => onChange(`${yy}-${e.target.value}`)}
        className={`${cls} ${monthClass}`}
        aria-label="חודש"
      >
        {HEB_MONTHS.map((name, i) => (
          <option key={i} value={String(i + 1).padStart(2, "0")}>
            {name}
          </option>
        ))}
      </select>
      <input
        type="text"
        inputMode="numeric"
        dir="ltr"
        value={yy}
        placeholder="שנה"
        onChange={(e) =>
          onChange(`${e.target.value.replace(/[^\d]/g, "")}-${mm}`)
        }
        className={`${cls} w-16 text-center`}
        aria-label="שנה"
      />
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

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className={strong ? "font-bold text-ink" : "text-ink-soft"}>{label}</dt>
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
  const [birthDate, setBirthDate] = useState(DEFAULT_BIRTH); // YYYY-MM
  const [retireAge, setRetireAge] = useState(67);
  const [portfolios, setPortfolios] = useState([newPortfolio()]);

  // Rights-fixing checklist (קיבוע זכויות).
  const [kibuaDone, setKibuaDone] = useState(true);
  const [severanceWithdrawn, setSeveranceWithdrawn] = useState(false);
  const [severances, setSeverances] = useState([newSeverance()]);

  // Statutory parameters (with any admin preview override applied).
  const cfg = useTaxConfig();

  // Editable tax assumptions.
  const [tax, setTax] = useState({
    pointValue: String(DEFAULT_TAX_CONFIG.defaults.pointValue),
    points: String(DEFAULT_TAX_CONFIG.defaults.pointsMale),
    indexFuture: String(DEFAULT_TAX_CONFIG.defaults.indexFuture),
  });
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showExemptDetail, setShowExemptDetail] = useState(false);
  const [showNetDetail, setShowNetDetail] = useState(false);
  const [showSeveranceCalc, setShowSeveranceCalc] = useState(false);

  const setGender2 = (g) => {
    setGender(g);
    setRetireAge(g === "male" ? 67 : 65);
    setTax((t) => ({
      ...t,
      points: String(g === "male" ? cfg.defaults.pointsMale : cfg.defaults.pointsFemale),
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
    const birthYear = parseInt(String(birthDate).slice(0, 4), 10) || CURRENT_YEAR - 50;
    const currentAge = Math.max(0, (monthIndex(CURRENT_MONTH_KEY) - monthIndex(birthDate)) / 12);
    const legalAge = legalRetirementAge(cfg, gender, birthYear);

    // Latest known CPI month/level (no forward projection beyond it).
    const cpiKeys = Object.keys(cfg.cpiMonthly);
    const cpiLatestKey = cpiKeys[cpiKeys.length - 1];
    const cpiLatest = cfg.cpiMonthly[cpiLatestKey];

    // Precise months of reaching legal age and of starting the pension.
    const legalRetMonthKey = addMonthsKey(birthDate, Math.round(legalAge * 12));
    const pensionStartMonthKey = addMonthsKey(birthDate, Math.round(num(retireAge) * 12));
    // מועד הזכאות = המאוחר מבין חודש גיל הפרישה החוקי לבין חודש תחילת הקצבה.
    const eligMonthKey =
      monthIndex(legalRetMonthKey) >= monthIndex(pensionStartMonthKey)
        ? legalRetMonthKey
        : pensionStartMonthKey;
    const eligibilityYear = parseInt(eligMonthKey.slice(0, 4), 10);
    const eligMonthLabel = hebMonthLabel(eligMonthKey);
    const futureRate = num(tax.indexFuture);

    // Ceiling (current, not indexed) + exempt rate by the eligibility year.
    const {
      ceiling: exemptCeiling,
      rate: exemptRate,
      rateEstimate,
    } = exemptForYear(cfg, eligibilityYear);

    // By law the severance indexation target is always JANUARY of the
    // eligibility year. If that January is in the future we index by actual CPI
    // up to today, then project forward by the future-index assumption; if it is
    // in the past we stop at that January's actual CPI.
    const indexMonthKey = `${eligibilityYear}-01`;
    const indexMonthLabel = hebMonthLabel(indexMonthKey);
    const monthsAhead = monthIndex(indexMonthKey) - monthIndex(cpiLatestKey);
    const eligInPast = monthsAhead < 0;
    const idxToday = eligInPast ? cpiAtMonth(cfg, indexMonthKey) : cpiLatest;
    const yearsAhead = Math.max(0, monthsAhead / 12);
    const forwardFactor = Math.pow(1 + futureRate / 100, yearsAhead);

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

    // Exempt severance "used up": amount × 1.35 × indexation, with the 32-year
    // cap applied ACROSS all employers — only the most recent 32 work-years
    // count. Years are allocated to grants newest-first; older years beyond 32
    // get a reduced (or zero) share.
    const applyOffset = kibuaDone && severanceWithdrawn;
    const sevBase = severances.map((s) => {
      const raw = s.month || CURRENT_MONTH_KEY;
      const [yStr, mStr] = raw.split("-");
      const wy = parseInt(yStr, 10) || CURRENT_YEAR;
      return {
        s,
        amount: num(s.amount),
        monthKey: `${wy}-${(mStr || "01").padStart(2, "0")}`,
        wy,
        yearsWorked: num(s.yearsWorked),
      };
    });
    const totalYears = sevBase.reduce((t, b) => t + b.yearsWorked, 0);
    const yearsCounted = {};
    if (totalYears > cfg.severanceYearsCap) {
      let remaining = cfg.severanceYearsCap;
      [...sevBase]
        .sort((a, b) => monthIndex(b.monthKey) - monthIndex(a.monthKey))
        .forEach((b) => {
          const allowed = Math.max(0, Math.min(b.yearsWorked, remaining));
          yearsCounted[b.s.id] = allowed;
          remaining -= allowed;
        });
    }
    const severanceLines = sevBase.map(({ s, amount, monthKey, wy, yearsWorked }) => {
      const idxAtWithdraw = cpiAtMonth(cfg, monthKey);
      const actualFactor = idxAtWithdraw > 0 ? idxToday / idxAtWithdraw : 1;
      const indexFactor = actualFactor * forwardFactor;
      const counted =
        totalYears > cfg.severanceYearsCap && yearsWorked > 0
          ? yearsCounted[s.id]
          : yearsWorked;
      const propFactor = yearsWorked > 0 ? counted / yearsWorked : 1;
      const preIndex = amount * cfg.severanceFactor * propFactor;
      const exemptByTransition =
        wy < cfg.transitionBeforeYear && eligibilityYear - wy >= cfg.transitionYears;
      const used = exemptByTransition ? 0 : preIndex * indexFactor;
      return {
        id: s.id,
        amount,
        monthKey,
        idxAtWithdraw,
        actualFactor,
        indexFactor,
        yearsWorked,
        yearsCounted: counted,
        propFactor,
        preIndex,
        used,
        exemptByTransition,
      };
    });
    const severanceUsedRaw = severanceLines.reduce((s, l) => s + l.used, 0);

    // Exempt-capital formula and the 35% cap on the severance offset.
    const exemptCapital = exemptCeiling * (exemptRate / 100) * cfg.capitalDivisor;
    const offsetCap = cfg.severanceOffsetCapRate * exemptCeiling * cfg.capitalDivisor;
    const severanceUsedTotal = Math.min(severanceUsedRaw, offsetCap);
    const offsetIsCapped = severanceUsedRaw > offsetCap + 0.5;
    const offset = applyOffset ? severanceUsedTotal : 0;
    const remainingCapital = Math.max(0, exemptCapital - offset);
    const monthlyExemption = remainingCapital / cfg.capitalDivisor;

    // The entitling-pension exemption requires rights-fixing and is only
    // possible from the legal retirement age; drawing earlier → no exemption.
    const ageEligible = num(retireAge) >= legalAge;
    const entitlingPension = Math.max(0, grossPension - recognizedPension);
    const creditValue = num(tax.points) * num(tax.pointValue);

    const netFor = (exemptCap) => {
      const exemptApplied = Math.min(entitlingPension, exemptCap);
      const taxable = Math.max(0, entitlingPension - exemptApplied);
      const taxBeforeCredits = incomeTaxMonthly(cfg, taxable);
      const taxDue = Math.max(0, taxBeforeCredits - creditValue);
      const net = grossPension - taxDue;
      const effRate = grossPension > 0 ? taxDue / grossPension : 0;
      return { exemptApplied, taxable, taxBeforeCredits, taxDue, net, effRate };
    };

    const withExemption = netFor(kibuaDone ? monthlyExemption : 0);
    const noExemption = netFor(0);
    const actual = ageEligible ? withExemption : noExemption;

    return {
      lines,
      severanceLines,
      severanceUsedRaw,
      severanceUsedTotal,
      offsetCap,
      offsetIsCapped,
      birthYear,
      currentAge,
      eligibilityYear,
      eligMonthLabel,
      legalAge,
      ageEligible,
      futureRate,
      forwardFactor,
      yearsAhead,
      eligInPast,
      indexMonthLabel,
      exemptCeiling,
      rateEstimate,
      exemptRate,
      exemptCapital,
      offset,
      remainingCapital,
      monthlyExemption,
      idxToday,
      grossPension,
      recognizedPension,
      entitlingPension,
      creditValue,
      net: actual.net,
      effRate: actual.effRate,
      detail: withExemption,
      netWith: withExemption.net,
      netWithout: noExemption.net,
    };
  }, [
    cfg,
    portfolios,
    severances,
    tax,
    kibuaDone,
    severanceWithdrawn,
    gender,
    birthDate,
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
          <div>
            <label className="mb-1 block font-medium text-ink">
              חודש ושנת לידה
            </label>
            <MonthPicker
              value={birthDate}
              onChange={setBirthDate}
              monthClass="w-48"
            />
            <p className="mt-1 text-xs text-ink-soft">
              גיל נוכחי: {formatAge(result.currentAge)} · גיל פרישה עפ״י חוק:{" "}
              {formatAge(result.legalAge)}.
            </p>
          </div>
          <div>
            <Slider
              label="גיל תחילת משיכת קצבה"
              value={retireAge}
              min={60}
              max={100}
              display={formatAge(retireAge)}
              onChange={setRetireAge}
            />
            {!result.ageEligible && (
              <p className="mt-1 text-xs text-ink-soft">
                משיכה לפני גיל הפרישה — ללא פטור על הקצבה המזכה.
              </p>
            )}
          </div>
        </div>

        <div className="mt-8">
          <p className="text-sm font-semibold text-brand-700">
            חודש הזכאות: {result.eligMonthLabel}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            המאוחר מבין חודש ההגעה לגיל הפרישה עפ״י חוק לבין חודש תחילת הקצבה.
          </p>
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

          <Check checked={severanceWithdrawn} onChange={setSeveranceWithdrawn}>
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
              <div className="space-y-4">
                {severances.map((s, idx) => {
                  const sl = result.severanceLines.find((l) => l.id === s.id);
                  return (
                    <div key={s.id}>
                      <div className="grid items-end gap-3 sm:grid-cols-[1fr,12rem,6rem,1fr,auto]">
                        <NumField
                          label={idx === 0 ? "סכום שנמשך" : undefined}
                          value={s.amount}
                          placeholder="0"
                          suffix="₪"
                          thousands
                          onChange={(v) => setSeverance(s.id, { amount: v })}
                        />
                        <div>
                          {idx === 0 && (
                            <label className="mb-1 block text-sm font-medium text-ink">
                              חודש משיכה
                            </label>
                          )}
                          <MonthPicker
                            value={s.month}
                            onChange={(v) => setSeverance(s.id, { month: v })}
                          />
                        </div>
                        <NumField
                          label={idx === 0 ? "שנות עבודה אצל המעסיק" : undefined}
                          value={s.yearsWorked}
                          placeholder="—"
                          asText
                          onChange={(v) => setSeverance(s.id, { yearsWorked: v })}
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

                      {/* How this withdrawal's impact was derived (toggle) */}
                      {showSeveranceCalc &&
                        sl &&
                        sl.amount > 0 &&
                        !sl.exemptByTransition && (
                          <div
                            dir="rtl"
                            className="mt-2 space-y-1 rounded-lg bg-white px-3 py-2 text-right text-xs text-ink-soft"
                          >
                            <div>
                              סכום לפני הצמדה:{" "}
                              <bdi dir="ltr" className="font-medium text-ink">
                                {fmtNum(sl.amount)} × {cfg.severanceFactor}
                                {sl.propFactor < 1
                                  ? ` × ${sl.propFactor.toFixed(3)}`
                                  : ""}{" "}
                                = {fmtNum(sl.preIndex)}
                              </bdi>
                              {sl.propFactor < 1
                                ? ` (${Math.round(sl.yearsCounted)} מתוך ${sl.yearsWorked} שנים נחשבות — תקרת 32 שנה)`
                                : ""}
                            </div>
                            <div>
                              הצמדה: מדד בסיס (חודש המשיכה){" "}
                              <bdi dir="ltr">{sl.idxAtWithdraw.toFixed(2)}</bdi> →
                              {result.eligInPast
                                ? ` מדד מועד הזכאות (${result.indexMonthLabel}) `
                                : " מדד נוכחי "}
                              <bdi dir="ltr">{result.idxToday.toFixed(2)}</bdi>
                              {result.yearsAhead > 0
                                ? ` → מדד צפוי ${result.futureRate}% עד ${result.indexMonthLabel}`
                                : ""}{" "}
                              · מקדם הצמדה כולל{" "}
                              <bdi dir="ltr">{sl.indexFactor.toFixed(4)}</bdi>
                            </div>
                            <div>
                              פגיעה בפטור:{" "}
                              <bdi dir="ltr" className="font-bold text-brand-700">
                                {fmtNum(sl.used)}
                              </bdi>
                            </div>
                          </div>
                        )}
                      {showSeveranceCalc && sl && sl.exemptByTransition && (
                        <p dir="rtl" className="mt-1.5 text-right text-xs text-emerald-700">
                          פטור מלא — הוראת מעבר (משיכה לפני 2012, חלפו מעל 15 שנה
                          עד הזכאות).
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setShowSeveranceCalc((v) => !v)}
                className="mt-2 text-xs font-medium text-brand-700 hover:underline"
              >
                {showSeveranceCalc ? "הסתר את חישוב הפגיעה" : "הצג את חישוב הפגיעה"}
              </button>
              {severances.length > 1 && (
                <div className="mt-3 grid items-center gap-3 border-t border-slate-200 pt-3 sm:grid-cols-[1fr,12rem,6rem,1fr,auto]">
                  <span className="text-sm font-semibold text-ink sm:col-span-3">
                    סה״כ הפגיעה בפטור
                  </span>
                  <div
                    dir="rtl"
                    className="px-3 py-2 text-right font-extrabold text-brand-700"
                  >
                    {ILS.format(result.severanceUsedTotal)}
                  </div>
                  <span
                    aria-hidden="true"
                    className="hidden px-2 py-2 text-sm invisible sm:inline-block"
                  >
                    הסרה
                  </span>
                </div>
              )}
              {result.offsetIsCapped && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  הקיזוז הוגבל לתקרה (35% × תקרת פטור × 180 ={" "}
                  {ILS.format(result.offsetCap)}).
                </p>
              )}
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
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
                <p className="text-sm font-semibold text-ink">
                  עד גיל {formatAge(result.legalAge)}
                </p>
                <p className="text-xs text-ink-soft">ללא פטור על הקצבה המזכה</p>
                <p className="mt-2 text-3xl font-extrabold text-ink">
                  {ILS.format(result.netWithout)}
                </p>
              </div>
              <div className="rounded-2xl border-2 border-brand-300 bg-white p-5 text-center">
                <p className="text-sm font-semibold text-ink">
                  מגיל {formatAge(result.legalAge)}
                </p>
                <p className="text-xs text-ink-soft">עם פטור על הקצבה המזכה</p>
                <p className="mt-2 text-3xl font-extrabold text-brand-700">
                  {ILS.format(result.netWith)}
                </p>
              </div>
            </div>
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-center text-xs font-medium text-amber-800">
              משיכת קצבה לפני גיל הפרישה עפ״י חוק ({formatAge(result.legalAge)}) —
              אין פטור על הקצבה המזכה. ההפרש לעומת פרישה בגיל עפ״י חוק:{" "}
              {ILS.format(result.netWith - result.netWithout)} לחודש.
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
            <span>פירוט חישוב הנטו (מגיל פרישה עפ״י חוק)</span>
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
                value={ILSminus(result.detail.exemptApplied)}
              />
              <Row
                label="הכנסה חייבת במס"
                value={ILS.format(result.detail.taxable)}
              />
              <Row
                label="מס לפי מדרגות"
                value={ILS.format(result.detail.taxBeforeCredits)}
              />
              <Row
                label="זיכוי נקודות זיכוי"
                value={ILSminus(result.creditValue)}
              />
              <Row
                label="מס לתשלום"
                value={ILS.format(result.detail.taxDue)}
                strong
              />
              <Row
                label="קצבה נטו"
                value={ILS.format(result.detail.net)}
                strong
              />
            </dl>
          )}
        </div>

        {/* Exact exemption calculation, including the CPI figures used */}
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
            (!kibuaDone ? (
              <p className="border-t border-slate-100 px-4 py-3 text-sm text-amber-700">
                לא בוצע קיבוע זכויות — אין כלל פטור על הקצבה המזכה.
              </p>
            ) : (
              <dl className="divide-y divide-slate-100 border-t border-slate-100 text-sm">
                <Row
                  label="תקרת קצבה מזכה (נכון לשנת 2026)"
                  value={ILS.format(result.exemptCeiling)}
                />
                <Row
                  label={
                    result.rateEstimate
                      ? `שיעור הפטור (צפוי בשנת ${result.eligibilityYear})`
                      : `שיעור הפטור (שנת ${result.eligibilityYear})`
                  }
                  value={result.exemptRate + "%"}
                />
                <Row
                  label={`הון פטור (${Math.round(result.exemptCeiling).toLocaleString("he-IL")} × ${result.exemptRate}% × 180)`}
                  value={ILS.format(result.exemptCapital)}
                />
                {severanceWithdrawn && (
                  <Row
                    label="קיזוז פיצויים פטורים"
                    value={ILSminus(result.offset)}
                  />
                )}
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
                asText
                onChange={(v) => setTax((t) => ({ ...t, points: v }))}
              />
              <NumField
                label="שווי נקודת זיכוי (חודשי)"
                value={tax.pointValue}
                suffix="₪"
                asText
                onChange={(v) => setTax((t) => ({ ...t, pointValue: v }))}
              />
              <NumField
                label="הנחת מדד שנתי צפוי (קדימה)"
                value={tax.indexFuture}
                suffix="%"
                asText
                hint="להצמדת הפגיעה והתקרה מהיום ועד מועד הזכאות."
                onChange={(v) => setTax((t) => ({ ...t, indexFuture: v }))}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
