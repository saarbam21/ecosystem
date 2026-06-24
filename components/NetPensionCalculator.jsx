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

// Severance "use up" multiplier and the statutory divisor used in the
// exempt-capital formula (תיקון 190 / קיבוע זכויות).
const SEVERANCE_FACTOR = 1.35;
const CAPITAL_DIVISOR = 180; // 180 months = 15 years

// ===================================================================
// ערכים הקבועים בחוק — ערוך כאן ידנית אם החקיקה משתנה.
// ===================================================================
// תקרת קצבה מזכה ושיעור הפטור לפי שנת הזכאות (שנת הגעה לגיל פרישה).
const EXEMPT_BY_YEAR = {
  2012: { ceiling: 8190, rate: 43.5 },
  2013: { ceiling: 8310, rate: 43.5 },
  2014: { ceiling: 8470, rate: 43.5 },
  2015: { ceiling: 8460, rate: 43.5 },
  2016: { ceiling: 8380, rate: 49 },
  2017: { ceiling: 8360, rate: 49 },
  2018: { ceiling: 8380, rate: 49 },
  2019: { ceiling: 8480, rate: 49 },
  2020: { ceiling: 8510, rate: 52 },
  2021: { ceiling: 8460, rate: 52 },
  2022: { ceiling: 8660, rate: 52 },
  2023: { ceiling: 9120, rate: 52 },
  2024: { ceiling: 9430, rate: 52 },
  2025: { ceiling: 9430, rate: 57 },
  2026: { ceiling: 9430, rate: 58 },
};
const EXEMPT_YEAR_MIN = 2012;
const EXEMPT_YEAR_MAX = 2026;

const CURRENT_CEILING = 9430; // תקרת קצבה מזכה (נכון לשנת 2026) — אינה צמודת מדד.

// שיעור/תקרה לפי שנת הזכאות. התקרה אינה מוצמדת — נשארת התקרה הנוכחית.
// השיעור: לפני 2012 — 35%; 2027 — 62.5%; 2028 ואילך — 67% (צפוי).
function exemptForYear(year) {
  const y = Math.round(year);
  if (y < EXEMPT_YEAR_MIN) return { ceiling: 8190, rate: 35, rateEstimate: false };
  if (y <= EXEMPT_YEAR_MAX) return { ...EXEMPT_BY_YEAR[y], rateEstimate: false };
  const rate = y === 2027 ? 62.5 : 67;
  return { ceiling: CURRENT_CEILING, rate, rateEstimate: true };
}

// ניצול הפיצויים הפטורים מוגבל ל-35% × תקרת הפטור × 180.
const SEVERANCE_OFFSET_CAP_RATE = 0.35;
// מעבר ל-32 שנות עבודה נלקח לקיזוז רק החלק היחסי של 32 מתוך סך השנים.
const SEVERANCE_YEARS_CAP = 32;

// הוראת מעבר: פיצויים פטורים שנמשכו לפני שנה זו, וחלפו מאז לפחות
// מספר השנים שלהלן ועד שנת הזכאות — אינם פוגעים בפטור.
const TRANSITION_BEFORE_YEAR = 2012;
const TRANSITION_YEARS = 15;
// ===================================================================

// Israeli CPI (מדד המחירים לצרכן), base 2006 = 100, monthly. Source: dekel.co.il.
// Used for actual historical indexation of severance grants by withdrawal month.
const CPI_MONTHLY = {
  "2012-01": 115.9715, "2012-02": 115.9715, "2012-03": 116.4176, "2012-04": 117.4212,
  "2012-05": 117.4212, "2012-06": 117.0867, "2012-07": 117.1982, "2012-08": 118.4248,
  "2012-09": 118.4248, "2012-10": 118.2018, "2012-11": 117.6442, "2012-12": 117.8672,
  "2013-01": 117.6616, "2013-02": 117.6616, "2013-03": 117.8962, "2013-04": 118.3655,
  "2013-05": 118.4828, "2013-06": 119.4213, "2013-07": 119.7732, "2013-08": 120.0078,
  "2013-09": 120.0078, "2013-10": 120.3597, "2013-11": 119.8905, "2013-12": 120.0078,
  "2014-01": 119.3039, "2014-02": 119.0693, "2014-03": 119.4213, "2014-04": 119.5386,
  "2014-05": 119.6559, "2014-06": 120.0078, "2014-07": 120.1251, "2014-08": 120.0078,
  "2014-09": 119.6559, "2014-10": 120.0078, "2014-11": 119.7732, "2014-12": 119.7732,
  "2015-01": 118.6986, "2015-02": 117.861, "2015-03": 118.22, "2015-04": 118.9379,
  "2015-05": 119.1772, "2015-06": 119.5362, "2015-07": 119.7755, "2015-08": 119.5362,
  "2015-09": 119.0576, "2015-10": 119.1772, "2015-11": 118.6986, "2015-12": 118.579,
  "2016-01": 117.9807, "2016-02": 117.6217, "2016-03": 117.3824, "2016-04": 117.861,
  "2016-05": 118.22, "2016-06": 118.579, "2016-07": 119.0576, "2016-08": 118.6986,
  "2016-09": 118.579, "2016-10": 118.8183, "2016-11": 118.3397, "2016-12": 118.3397,
  "2017-01": 118.103, "2017-02": 118.103, "2017-03": 118.458, "2017-04": 118.6947,
  "2017-05": 119.168, "2017-06": 118.3397, "2017-07": 118.2213, "2017-08": 118.5763,
  "2017-09": 118.6947, "2017-10": 119.0497, "2017-11": 118.6947, "2017-12": 118.813,
  "2018-01": 118.2213, "2018-02": 118.3397, "2018-03": 118.6947, "2018-04": 119.168,
  "2018-05": 119.7597, "2018-06": 119.8781, "2018-07": 119.8781, "2018-08": 119.9964,
  "2018-09": 120.1148, "2018-10": 120.4698, "2018-11": 120.1148, "2018-12": 119.7597,
  "2019-01": 119.6426, "2019-02": 119.7621, "2019-03": 120.3597, "2019-04": 120.7183,
  "2019-05": 121.5549, "2019-06": 120.8378, "2019-07": 120.4792, "2019-08": 120.7183,
  "2019-09": 120.4792, "2019-10": 120.9573, "2019-11": 120.4792, "2019-12": 120.4792,
  "2020-01": 120.0011, "2020-02": 119.8816, "2020-03": 120.3597, "2020-04": 120.0011,
  "2020-05": 119.6426, "2020-06": 119.5231, "2020-07": 119.7621, "2020-08": 119.7621,
  "2020-09": 119.6426, "2020-10": 120.0011, "2020-11": 119.7621, "2020-12": 119.6426,
  "2021-01": 119.522, "2021-02": 119.8816, "2021-03": 120.6009, "2021-04": 120.9606,
  "2021-05": 121.4401, "2021-06": 121.56, "2021-07": 122.0395, "2021-08": 122.3991,
  "2021-09": 122.6389, "2021-10": 122.7588, "2021-11": 122.6389, "2021-12": 122.9985,
  "2022-01": 123.2383, "2022-02": 124.0775, "2022-03": 124.7968, "2022-04": 125.7558,
  "2022-05": 126.4751, "2022-06": 126.9546, "2022-07": 128.3932, "2022-08": 128.0336,
  "2022-09": 128.2733, "2022-10": 128.9926, "2022-11": 129.1125, "2022-12": 129.4722,
  "2023-01": 129.8746, "2023-02": 130.5094, "2023-03": 131.0172, "2023-04": 132.0328,
  "2023-05": 132.2867, "2023-06": 132.2867, "2023-07": 132.6676, "2023-08": 133.302,
  "2023-09": 133.1754, "2023-10": 133.8102, "2023-11": 133.4293, "2023-12": 133.3024,
  "2024-01": 133.3024, "2024-02": 133.8102, "2024-03": 134.5719, "2024-04": 135.7145,
  "2024-05": 135.9684, "2024-06": 136.0954, "2024-07": 136.8571, "2024-08": 138.1266,
  "2024-09": 137.8727, "2024-10": 138.5075, "2024-11": 137.9997, "2024-12": 137.6188,
  "2025-01": 138.3945, "2025-02": 138.3945, "2025-03": 139.076, "2025-04": 140.576,
  "2025-05": 140.167, "2025-06": 140.5761, "2025-07": 141.121, "2025-08": 142.076,
  "2025-09": 141.2579, "2025-10": 141.9396, "2025-11": 141.257, "2025-12": 141.257,
  "2026-01": 140.8488, "2026-02": 141.1215, "2026-03": 141.6669, "2026-04": 143.303,
  "2026-05": 142.894,
};
const CPI_MONTH_KEYS = Object.keys(CPI_MONTHLY);
const CPI_FIRST_MONTH = CPI_MONTH_KEYS[0];
const CPI_LATEST_KEY = CPI_MONTH_KEYS[CPI_MONTH_KEYS.length - 1];
const CPI_LATEST = CPI_MONTHLY[CPI_LATEST_KEY];

// Index level for a "YYYY-MM" month, clamped to the known range. Severance is
// indexed up to the latest known index only — no forward projection.
function cpiAtMonth(monthKey) {
  if (CPI_MONTHLY[monthKey] != null) return CPI_MONTHLY[monthKey];
  if (!monthKey || monthKey < CPI_FIRST_MONTH) return CPI_MONTHLY[CPI_FIRST_MONTH];
  if (monthKey > CPI_LATEST_KEY) return CPI_LATEST;
  let v = CPI_MONTHLY[CPI_FIRST_MONTH];
  for (const k of CPI_MONTH_KEYS) {
    if (k <= monthKey) v = CPI_MONTHLY[k];
    else break;
  }
  return v;
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

// גיל פרישה חוקי — גברים 67; נשים עולה בהדרגה לפי שנת לידה.
const WOMEN_RETIREMENT_BY_BIRTH_YEAR = {
  1960: 62 + 4 / 12,
  1961: 62 + 8 / 12,
  1962: 63,
  1963: 63 + 3 / 12,
  1964: 63 + 6 / 12,
  1965: 63 + 9 / 12,
  1966: 64,
  1967: 64 + 3 / 12,
  1968: 64 + 6 / 12,
  1969: 64 + 9 / 12,
};

function legalRetirementAge(gender, birthYear) {
  if (gender === "male") return 67;
  if (birthYear <= 1959) return 62;
  if (birthYear >= 1970) return 65;
  return WOMEN_RETIREMENT_BY_BIRTH_YEAR[birthYear] ?? 65;
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
  indexFuture: 2, // הנחת מדד שנתי צפוי קדימה (%)
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
function MonthPicker({ value, onChange }) {
  const [yy, mm] = (value || CURRENT_MONTH_KEY).split("-");
  const cls =
    "rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
  return (
    <div className="flex gap-2">
      <select
        value={mm}
        onChange={(e) => onChange(`${yy}-${e.target.value}`)}
        className={`${cls} w-24`}
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

  // Editable tax assumptions.
  const [tax, setTax] = useState({
    pointValue: String(DEFAULTS.pointValue),
    points: String(DEFAULTS.pointsMale),
    indexFuture: String(DEFAULTS.indexFuture),
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
    const birthYear = parseInt(String(birthDate).slice(0, 4), 10) || CURRENT_YEAR - 50;
    const currentAge = Math.max(0, (monthIndex(CURRENT_MONTH_KEY) - monthIndex(birthDate)) / 12);
    const legalAge = legalRetirementAge(gender, birthYear);

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
    } = exemptForYear(eligibilityYear);

    // Forward-index factor: from the latest known CPI month to the eligibility
    // month, using the future-index assumption.
    const idxToday = CPI_LATEST;
    const monthsAhead = monthIndex(eligMonthKey) - monthIndex(CPI_LATEST_KEY);
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

    // Exempt severance "used up": amount × 1.35 × (32/years if over 32),
    // indexed by actual CPI from the withdrawal month to today, then by the
    // future-index assumption up to the eligibility month.
    const applyOffset = kibuaDone && severanceWithdrawn;
    const severanceLines = severances.map((s) => {
      const amount = num(s.amount);
      const raw = s.month || CURRENT_MONTH_KEY;
      const [yStr, mStr] = raw.split("-");
      const wy = parseInt(yStr, 10) || CURRENT_YEAR;
      const monthKey = `${wy}-${(mStr || "01").padStart(2, "0")}`;
      const idxAtWithdraw = cpiAtMonth(monthKey);
      const actualFactor = idxAtWithdraw > 0 ? idxToday / idxAtWithdraw : 1;
      const indexFactor = actualFactor * forwardFactor;
      const yearsWorked = num(s.yearsWorked);
      const propFactor =
        yearsWorked > SEVERANCE_YEARS_CAP ? SEVERANCE_YEARS_CAP / yearsWorked : 1;
      const preIndex = amount * SEVERANCE_FACTOR * propFactor;
      const exemptByTransition =
        wy < TRANSITION_BEFORE_YEAR && eligibilityYear - wy >= TRANSITION_YEARS;
      const used = exemptByTransition ? 0 : preIndex * indexFactor;
      return {
        id: s.id,
        amount,
        monthKey,
        idxAtWithdraw,
        actualFactor,
        indexFactor,
        yearsWorked,
        propFactor,
        preIndex,
        used,
        exemptByTransition,
      };
    });
    const severanceUsedRaw = severanceLines.reduce((s, l) => s + l.used, 0);

    // Exempt-capital formula and the 35% cap on the severance offset.
    const exemptCapital = exemptCeiling * (exemptRate / 100) * CAPITAL_DIVISOR;
    const offsetCap = SEVERANCE_OFFSET_CAP_RATE * exemptCeiling * CAPITAL_DIVISOR;
    const severanceUsedTotal = Math.min(severanceUsedRaw, offsetCap);
    const offsetIsCapped = severanceUsedRaw > offsetCap + 0.5;
    const offset = applyOffset ? severanceUsedTotal : 0;
    const remainingCapital = Math.max(0, exemptCapital - offset);
    const monthlyExemption = remainingCapital / CAPITAL_DIVISOR;

    // The entitling-pension exemption requires rights-fixing and is only
    // possible from the legal retirement age; drawing earlier → no exemption.
    const ageEligible = num(retireAge) >= legalAge;
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
            <MonthPicker value={birthDate} onChange={setBirthDate} />
            <p className="mt-1 text-xs text-ink-soft">
              גיל נוכחי: {formatAge(result.currentAge)} · גיל פרישה עפ״י חוק:{" "}
              {formatAge(result.legalAge)}.
            </p>
            <p className="mt-1 text-xs font-semibold text-brand-700">
              חודש הזכאות: {result.eligMonthLabel}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              המאוחר מבין חודש ההגעה לגיל הפרישה עפ״י חוק לבין חודש תחילת הקצבה.
              {!result.ageEligible &&
                " משיכה לפני גיל הפרישה — ללא פטור על הקצבה המזכה."}
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
                              סכום מוצמד:{" "}
                              <bdi dir="ltr" className="font-medium text-ink">
                                {fmtNum(sl.amount)} × {SEVERANCE_FACTOR}
                                {sl.propFactor < 1
                                  ? ` × ${sl.propFactor.toFixed(3)}`
                                  : ""}{" "}
                                = {fmtNum(sl.preIndex)}
                              </bdi>
                              {sl.propFactor < 1
                                ? ` (32/${sl.yearsWorked} שנות עבודה)`
                                : ""}
                            </div>
                            <div>
                              הצמדה: מדד בסיס (חודש המשיכה){" "}
                              <bdi dir="ltr">{sl.idxAtWithdraw.toFixed(2)}</bdi> →
                              מדד נוכחי{" "}
                              <bdi dir="ltr">{result.idxToday.toFixed(2)}</bdi>
                              {result.yearsAhead > 0
                                ? ` → מדד צפוי ${result.futureRate}% עד ${result.eligMonthLabel}`
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
