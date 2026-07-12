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

// Format a numeric string with thousands separators while typing. When `signed`
// a leading minus is preserved (used for capital losses).
function formatThousands(str, signed) {
  const s = String(str ?? "");
  const neg = signed && /^\s*-/.test(s);
  const cleaned = s.replace(/[^\d.]/g, "");
  if (cleaned === "") return neg ? "-" : "";
  const [intPart, ...rest] = cleaned.split(".");
  const dec = rest.length ? "." + rest.join("") : "";
  return (neg ? "-" : "") + intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + dec;
}

// 867 capital-income categories.
const CAPITAL_CATEGORIES = [
  { k: "dividend", t: "דיבידנד" },
  { k: "interest", t: "ריבית" },
  { k: "capitalgain", t: "רווח/הפסד הון (ני״ע)" },
  { k: "other", t: "אחר (שיעור קבוע)" },
];
const categoryLabel = (k) =>
  CAPITAL_CATEGORIES.find((c) => c.k === k)?.t ?? "הון";

// "other" document classification.
const OTHER_KINDS = [
  { k: "ordinary", t: "יגיעה אישית (מדרגות מס)" },
  { k: "fixed", t: "הון בשיעור קבוע" },
  { k: "passive", t: "שאינה מיגיעה אישית (שיעור שולי)" },
];

// ----- documents & taxpayers -----

let lineId = 0;
const newLine867 = () => ({
  id: ++lineId,
  category: "dividend",
  income: "",
  withheld: "",
  rate: "",
});

let docId = 0;
const newDoc = (type = "106") => {
  const base = { id: ++docId, type };
  if (type === "106") return { ...base, employer: "", income: "", withheld: "" };
  if (type === "867") return { ...base, description: "", lines: [newLine867()] };
  // "other": free-form income line.
  return { ...base, label: "", kind: "ordinary", income: "", withheld: "", rate: "" };
};

let personId = 0;
const newPerson = (gender = "male") => ({
  id: ++personId,
  name: "",
  gender,
  points: String(
    gender === "male"
      ? DEFAULT_INCOME_TAX_CONFIG.pointsMale
      : DEFAULT_INCOME_TAX_CONFIG.pointsFemale
  ),
  lossCarryforward: "",
  docs: [newDoc("106")],
});

const COUPLE_LABELS = ["בן/בת זוג א׳", "בן/בת זוג ב׳"];
const personName = (person, index, mode) =>
  person.name?.trim() ||
  (mode === "couple" ? COUPLE_LABELS[index] : "הנישום");

// ----- calculation helpers -----

function capitalRateFor(cfg, category, rate) {
  const r = num(rate);
  if (r > 0) return r > 1 ? r / 100 : r; // accept "25" or "0.25"
  return cfg.capitalRates[category] ?? cfg.capitalRates.other;
}

// Split a person's documents into exertion, passive (non-exertion marginal) and
// four capital sub-categories, each carrying its source lines.
function splitPersonDocs(cfg, person) {
  let exertionIncome = 0;
  let exertionWithheld = 0;
  const exertionSources = [];
  let passiveIncome = 0;
  let passiveWithheld = 0;
  const passiveSources = [];
  const cap = {
    dividend: { sources: [] },
    interest: { sources: [] },
    capitalgain: { sources: [] },
    otherfixed: { sources: [] },
  };
  const pushCap = (key, label, income, rate, withheld) =>
    cap[key].sources.push({ label, income, rate, withheld });

  for (const d of person.docs) {
    if (d.type === "106") {
      const income = num(d.income);
      const withheld = num(d.withheld);
      exertionIncome += income;
      exertionWithheld += withheld;
      exertionSources.push({ label: d.employer?.trim() || "טופס 106", income, withheld });
    } else if (d.type === "867") {
      const label = d.description?.trim() || "טופס 867";
      for (const ln of d.lines || []) {
        const income = num(ln.income);
        const withheld = num(ln.withheld);
        if (ln.category === "capitalgain") {
          pushCap("capitalgain", label, income, cfg.capitalRates.capitalgain, withheld);
        } else if (ln.category === "dividend" || ln.category === "interest") {
          pushCap(ln.category, label, income, capitalRateFor(cfg, ln.category, ln.rate), withheld);
        } else {
          pushCap("otherfixed", label, income, capitalRateFor(cfg, "other", ln.rate), withheld);
        }
      }
    } else {
      const income = num(d.income);
      const withheld = num(d.withheld);
      const label = d.label?.trim() || "מסמך אחר";
      if (d.kind === "fixed") {
        pushCap("otherfixed", label, income, capitalRateFor(cfg, "other", d.rate), withheld);
      } else if (d.kind === "passive") {
        passiveIncome += income;
        passiveWithheld += withheld;
        passiveSources.push({ label, income, withheld });
      } else {
        exertionIncome += income;
        exertionWithheld += withheld;
        exertionSources.push({ label, income, withheld });
      }
    }
  }
  return {
    exertionIncome,
    exertionWithheld,
    exertionSources,
    passiveIncome,
    passiveWithheld,
    passiveSources,
    cap,
  };
}

// Unified computation for one or two taxpayers.
//  - Each taxpayer's personal-exertion income → own brackets, credit, surtax.
//  - Non-exertion income is pooled: fixed-rate capital keeps its statutory rate;
//    capital gains are netted (losses + prior-year carry-forward offset gains, a
//    remaining loss carries to next year); other non-exertion income is taxed at
//    the marginal rate of the taxpayer with the higher exertion income.
function computeAll(cfg, persons, shared) {
  const parts = persons.map((p) => ({ person: p, ...splitPersonDocs(cfg, p) }));

  const taxpayers = parts.map((pt) => {
    const bracketTax = annualIncomeTax(cfg, pt.exertionIncome);
    const credit = num(pt.person.points) * shared.pointValue;
    const creditUsed = Math.min(credit, bracketTax);
    const afterCredit = Math.max(0, bracketTax - credit);
    const surtax = shared.surtaxRate * Math.max(0, pt.exertionIncome - shared.surtaxThreshold);
    const withheld = pt.exertionWithheld;
    const liability = afterCredit + surtax;
    return {
      exertionIncome: pt.exertionIncome,
      bracketTax,
      creditUsed,
      afterCredit,
      surtax,
      withheld,
      liability,
      balance: withheld - liability,
      sources: pt.exertionSources,
    };
  });

  const primaryIdx = taxpayers.reduce(
    (best, t, i, arr) => (t.exertionIncome > arr[best].exertionIncome ? i : best),
    0
  );
  const primaryExertion = taxpayers[primaryIdx].exertionIncome;

  const mergeCat = (sel) => {
    const sources = parts.flatMap((pt) => sel(pt).sources);
    const income = sources.reduce((s, l) => s + l.income, 0);
    const tax = sources.reduce((s, l) => s + l.income * l.rate, 0);
    const withheld = sources.reduce((s, l) => s + l.withheld, 0);
    return { income, tax, withheld, sources };
  };
  const dividend = mergeCat((pt) => pt.cap.dividend);
  const interest = mergeCat((pt) => pt.cap.interest);
  const otherfixed = mergeCat((pt) => pt.cap.otherfixed);

  // Capital gains: net gains and losses, then prior-year carry-forward.
  const cgSources = parts.flatMap((pt) => pt.cap.capitalgain.sources);
  const cgGross = cgSources.reduce((s, l) => s + l.income, 0);
  const cgWithheld = cgSources.reduce((s, l) => s + l.withheld, 0);
  const carryforward = parts.reduce((s, pt) => s + num(pt.person.lossCarryforward), 0);
  const gainsRate = cfg.capitalRates.capitalgain;
  const afterCF = cgGross - carryforward;
  const cgTaxable = Math.max(0, afterCF);
  const cgLossNext = Math.max(0, -afterCF);
  const capitalgain = {
    gross: cgGross,
    withheld: cgWithheld,
    sources: cgSources,
    carryforward,
    taxable: cgTaxable,
    tax: cgTaxable * gainsRate,
    lossNext: cgLossNext,
    rate: gainsRate,
  };

  // Non-exertion marginal income.
  const passiveSources = parts.flatMap((pt) => pt.passiveSources);
  const passiveIncome = passiveSources.reduce((s, l) => s + l.income, 0);
  const passiveWithheld = passiveSources.reduce((s, l) => s + l.withheld, 0);
  const passiveRate = marginalRate(cfg, primaryExertion);
  const passive = {
    income: passiveIncome,
    withheld: passiveWithheld,
    sources: passiveSources,
    rate: passiveRate,
    tax: passiveIncome * passiveRate,
  };

  const pool = { dividend, interest, otherfixed, capitalgain, passive, passiveRate };
  const poolIncome =
    dividend.income + interest.income + otherfixed.income + cgTaxable + passiveIncome;
  const th = shared.surtaxThreshold;
  const poolSurtax =
    shared.surtaxRate *
    (Math.max(0, primaryExertion + poolIncome - th) - Math.max(0, primaryExertion - th));

  const capTax =
    dividend.tax + interest.tax + otherfixed.tax + capitalgain.tax + passive.tax;
  const poolTax = capTax + poolSurtax;
  const jointWithheld =
    dividend.withheld +
    interest.withheld +
    otherfixed.withheld +
    capitalgain.withheld +
    passive.withheld;
  const jointBalance = jointWithheld - poolTax;

  const liability = taxpayers.reduce((s, t) => s + t.liability, 0) + poolTax;
  const withheldTotal = taxpayers.reduce((s, t) => s + t.withheld, 0) + jointWithheld;
  const balance = withheldTotal - liability;
  const totalTaxable = taxpayers.reduce((s, t) => s + t.exertionIncome, 0) + poolIncome;
  const household = {
    liability,
    withheld: withheldTotal,
    balance,
    totalTaxable,
    effRate: totalTaxable > 0 ? liability / totalTaxable : 0,
  };

  return { taxpayers, pool, poolSurtax, poolTax, jointWithheld, jointBalance, primaryIdx, household };
}

// Build the collapsible, per-income-type breakdown groups.
function buildGroups(res, mode, names) {
  const couple = mode === "couple";
  const groups = [];

  // 1) Personal-exertion income.
  const salaryIncome = res.taxpayers.reduce((s, t) => s + t.exertionIncome, 0);
  const salaryTax = res.taxpayers.reduce((s, t) => s + t.afterCredit, 0);
  const salaryRows = [];
  res.taxpayers.forEach((t, i) => {
    if (couple) salaryRows.push({ label: names[i], value: "", strong: true });
    t.sources.forEach((src) =>
      salaryRows.push({ label: `  ${src.label}`, value: ILS.format(src.income), muted: true })
    );
    salaryRows.push({ label: "  מס לפי מדרגות", value: ILS.format(t.bracketTax), muted: true });
    salaryRows.push({ label: "  זיכוי נקודות זיכוי", value: ILSminus(t.creditUsed), muted: true });
    salaryRows.push({ label: "  מס על יגיעה אישית", value: ILS.format(t.afterCredit) });
  });
  groups.push({ key: "salary", title: "הכנסה מיגיעה אישית", income: salaryIncome, tax: salaryTax, rows: salaryRows });

  // 2) Flat-rate capital categories.
  const flat = (cat, title, key) => {
    if (cat.income <= 0.5) return;
    const rows = cat.sources
      .filter((s) => Math.abs(s.income) > 0.5)
      .map((s) => ({
        label: `  ${s.label}`,
        value: `${ILS.format(s.income)} × ${(s.rate * 100).toFixed(0)}% = ${ILS.format(
          s.income * s.rate
        )}`,
        muted: true,
      }));
    groups.push({ key, title, income: cat.income, tax: cat.tax, rows });
  };
  flat(res.pool.dividend, "דיבידנד", "dividend");
  flat(res.pool.interest, "ריבית", "interest");

  // 3) Capital gains (with loss offset + carry-forward).
  const cg = res.pool.capitalgain;
  if (Math.abs(cg.gross) > 0.5 || cg.carryforward > 0.5) {
    const rows = cg.sources
      .filter((s) => Math.abs(s.income) > 0.5)
      .map((s) => ({
        label: `  ${s.label} — ${s.income >= 0 ? "רווח" : "הפסד"}`,
        value: ILS.format(s.income),
        muted: true,
      }));
    if (cg.carryforward > 0.5)
      rows.push({
        label: "  הפסדים מועברים משנים קודמות",
        value: ILSminus(cg.carryforward),
        muted: true,
      });
    rows.push({ label: "  רווח הון חייב (אחרי קיזוז)", value: ILS.format(cg.taxable) });
    rows.push({ label: `  מס רווח הון (${(cg.rate * 100).toFixed(0)}%)`, value: ILS.format(cg.tax) });
    if (cg.lossNext > 0.5)
      rows.push({
        label: "  הפסד הון מועבר לשנה הבאה",
        value: ILS.format(cg.lossNext),
        muted: true,
      });
    groups.push({ key: "capitalgain", title: "רווח הון", income: cg.taxable, tax: cg.tax, rows });
  }

  flat(res.pool.otherfixed, "הכנסה אחרת (שיעור קבוע)", "otherfixed");

  // 4) Non-exertion marginal income.
  const pas = res.pool.passive;
  if (pas.income > 0.5) {
    const rows = pas.sources
      .filter((s) => Math.abs(s.income) > 0.5)
      .map((s) => ({ label: `  ${s.label}`, value: ILS.format(s.income), muted: true }));
    rows.push({
      label: `  שיעור מס${couple ? ` (${names[res.primaryIdx]})` : ""} ${(pas.rate * 100).toFixed(0)}%`,
      value: ILS.format(pas.tax),
    });
    groups.push({
      key: "passive",
      title: "הכנסה שאינה מיגיעה אישית (שיעור שולי)",
      income: pas.income,
      tax: pas.tax,
      rows,
    });
  }

  // 5) Surtax.
  const totalSurtax = res.taxpayers.reduce((s, t) => s + t.surtax, 0) + res.poolSurtax;
  if (totalSurtax > 0.5) {
    const rows = [];
    res.taxpayers.forEach((t, i) => {
      if (t.surtax > 0.5)
        rows.push({
          label: `  ${couple ? names[i] : "על יגיעה אישית"}`,
          value: ILS.format(t.surtax),
          muted: true,
        });
    });
    if (res.poolSurtax > 0.5)
      rows.push({ label: "  על הכנסה שאינה מיגיעה אישית", value: ILS.format(res.poolSurtax), muted: true });
    groups.push({ key: "surtax", title: "מס יסף", income: null, tax: totalSurtax, rows });
  }

  return groups;
}

// ----- shared field components -----

function NumField({ label, value, onChange, placeholder, suffix, thousands, asText, signed, hint }) {
  const handle = (e) =>
    onChange(thousands ? formatThousands(e.target.value, signed) : e.target.value);
  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      )}
      <div className="relative">
        <input
          type={thousands || asText ? "text" : "number"}
          inputMode={thousands || asText ? (signed ? "text" : "numeric") : "decimal"}
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

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className={strong ? "font-bold text-ink" : "text-ink"}>{label}</dt>
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

// ----- the calculator -----

export default function IncomeTaxCalculator() {
  const cfg = useIncomeTaxConfig();

  const [mode, setMode] = useState("single");
  const [persons, setPersons] = useState([newPerson("male")]);

  const [shared, setShared] = useState({
    pointValue: String(DEFAULT_INCOME_TAX_CONFIG.pointValueAnnual),
    surtaxRate: String(DEFAULT_INCOME_TAX_CONFIG.surtaxRate * 100),
    surtaxThreshold: String(DEFAULT_INCOME_TAX_CONFIG.surtaxThreshold),
  });

  const [showDetail, setShowDetail] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);

  const isCouple = mode === "couple";

  const switchMode = (m) => {
    setMode(m);
    setPersons((ps) => {
      if (m === "couple" && ps.length === 1) return [ps[0], newPerson("female")];
      if (m === "single") return [ps[0]];
      return ps;
    });
  };

  const setPerson = (pid, patch) =>
    setPersons((ps) => ps.map((p) => (p.id === pid ? { ...p, ...patch } : p)));
  const setGender = (pid, g) =>
    setPersons((ps) =>
      ps.map((p) =>
        p.id === pid
          ? {
              ...p,
              gender: g,
              points: String(g === "male" ? cfg.pointsMale : cfg.pointsFemale),
            }
          : p
      )
    );
  const patchDocs = (pid, fn) =>
    setPersons((ps) => ps.map((p) => (p.id === pid ? { ...p, docs: fn(p.docs) } : p)));
  const setDoc = (pid, did, patch) =>
    patchDocs(pid, (ds) => ds.map((d) => (d.id === did ? { ...d, ...patch } : d)));
  const addDoc = (pid, type) => patchDocs(pid, (ds) => [...ds, newDoc(type)]);
  const removeDoc = (pid, did) => patchDocs(pid, (ds) => ds.filter((d) => d.id !== did));

  // ----- calculation -----
  const calc = useMemo(() => {
    const sharedNums = {
      pointValue: num(shared.pointValue),
      surtaxRate: num(shared.surtaxRate) / 100,
      surtaxThreshold: num(shared.surtaxThreshold),
    };
    const people = isCouple && persons.length === 2 ? persons : [persons[0]];
    return computeAll(cfg, people, sharedNums);
  }, [cfg, persons, shared, isCouple]);

  const household = calc.household;
  const isRefund = household.balance >= 0;
  const names = persons.map((p, i) => personName(p, i, mode));
  const groups = buildGroups(calc, mode, names);
  const totals = {
    liability: household.liability,
    withheld: household.withheld,
    balance: household.balance,
    lossNext: calc.pool.capitalgain.lossNext,
  };

  const chips = isCouple
    ? [
        { name: names[0], balance: calc.taxpayers[0].balance },
        { name: names[1], balance: calc.taxpayers[1].balance },
        { name: "חישוב משותף", balance: calc.jointBalance },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Mode */}
      <div className="card">
        <span className="mb-1 block font-medium text-ink">אופן החישוב</span>
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
          {[
            { k: "single", t: "יחיד" },
            { k: "couple", t: "בני זוג" },
          ].map((o) => (
            <button
              key={o.k}
              type="button"
              onClick={() => switchMode(o.k)}
              className={`rounded-full px-6 py-1.5 text-sm font-semibold transition ${
                mode === o.k
                  ? "bg-brand-700 text-white"
                  : "text-ink-soft hover:text-brand-700"
              }`}
            >
              {o.t}
            </button>
          ))}
        </div>
        {isCouple && (
          <p className="mt-2 text-xs text-ink-soft">
            הכנסה מיגיעה אישית של כל בן זוג ממוסה בנפרד. הכנסות הון בשיעור קבוע
            ממוסות בשיעור הקבוע; הכנסה אחרת שאינה מיגיעה אישית ממוסה בחישוב המשותף
            לפי שיעור המס של בן הזוג בעל ההכנסה הגבוהה.
          </p>
        )}
      </div>

      {/* One card per taxpayer */}
      {persons.map((p, i) => (
        <PersonCard
          key={p.id}
          person={p}
          title={personName(p, i, mode)}
          showName={isCouple}
          pointValueNum={num(shared.pointValue)}
          onName={(v) => setPerson(p.id, { name: v })}
          onGender={(g) => setGender(p.id, g)}
          onPoints={(v) => setPerson(p.id, { points: v })}
          onLoss={(v) => setPerson(p.id, { lossCarryforward: v })}
          onDocChange={(did, patch) => setDoc(p.id, did, patch)}
          onAddDoc={(type) => addDoc(p.id, type)}
          onRemoveDoc={(did) => removeDoc(p.id, did)}
        />
      ))}

      {/* Result */}
      <div className="card">
        <SectionTitle>
          {isCouple ? "תוצאה — סיכום משק בית" : "תוצאה — התחשבנות שנתית"}
        </SectionTitle>

        <div
          className={`rounded-2xl border-2 p-5 text-center ${
            isRefund ? "border-brand-200 bg-white" : "border-amber-300 bg-amber-50"
          }`}
        >
          <p className="text-sm text-ink-soft">
            {isCouple
              ? isRefund
                ? "החזר מס צפוי — משק בית"
                : "יתרת מס לתשלום — משק בית"
              : isRefund
              ? "החזר מס צפוי"
              : "יתרת מס לתשלום"}
          </p>
          <p
            className={`mt-1 text-4xl font-extrabold ${
              isRefund ? "text-brand-700" : "text-amber-700"
            }`}
          >
            {ILS.format(Math.abs(household.balance))}
          </p>
          <p className="mt-2 text-xs text-ink-soft">
            סה״כ חבות מס {ILS.format(household.liability)} · נוכה במקור{" "}
            {ILS.format(household.withheld)} · שיעור מס אפקטיבי{" "}
            {(household.effRate * 100).toFixed(1)}%
          </p>
        </div>

        {isCouple && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {chips.map((c, i) => {
              const ref = c.balance >= 0;
              return (
                <div
                  key={i}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center"
                >
                  <p className="text-sm font-semibold text-ink">{c.name}</p>
                  <p className="text-xs text-ink-soft">
                    {ref ? "החזר מס" : "יתרת מס לתשלום"}
                  </p>
                  <p
                    className={`mt-1 text-2xl font-extrabold ${
                      ref ? "text-brand-700" : "text-amber-700"
                    }`}
                  >
                    {ILS.format(Math.abs(c.balance))}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Breakdown */}
        <div className="mt-5 rounded-xl border border-slate-100">
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-ink"
          >
            <span>פירוט חישוב המס (לפי סוגי הכנסה)</span>
            <span className="text-ink-soft">{showDetail ? "−" : "+"}</span>
          </button>
          {showDetail && <BreakdownGroups groups={groups} totals={totals} />}
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
                value={shared.pointValue}
                suffix="₪"
                asText
                onChange={(v) => setShared((s) => ({ ...s, pointValue: v }))}
              />
              <NumField
                label="שיעור מס יסף"
                value={shared.surtaxRate}
                suffix="%"
                asText
                onChange={(v) => setShared((s) => ({ ...s, surtaxRate: v }))}
              />
              <NumField
                label="תקרת מס יסף (לכל נישום, שנתי)"
                value={shared.surtaxThreshold}
                suffix="₪"
                thousands
                onChange={(v) => setShared((s) => ({ ...s, surtaxThreshold: v }))}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----- collapsible breakdown grouped by income type -----

function BreakdownGroups({ groups, totals }) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = (k) =>
    setOpen((o) => {
      const n = new Set(o);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  return (
    <div className="border-t border-slate-100">
      {groups.map((g) => (
        <div key={g.key} className="border-b border-slate-100">
          <button
            type="button"
            onClick={() => toggle(g.key)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right"
          >
            <span className="flex items-center gap-2 font-semibold text-ink">
              <span className="w-3 text-ink-soft">{open.has(g.key) ? "−" : "+"}</span>
              {g.title}
            </span>
            <span dir="rtl" className="flex items-center gap-4 text-sm">
              {g.income != null && (
                <span className="text-ink-soft">{ILS.format(g.income)}</span>
              )}
              <span className="min-w-[5rem] font-bold text-brand-700">
                {ILS.format(g.tax)}
              </span>
            </span>
          </button>
          {open.has(g.key) && (
            <dl className="bg-slate-50 px-2 pb-2">
              {g.rows.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm"
                >
                  <dt
                    className={
                      r.strong ? "font-bold text-ink" : r.muted ? "text-ink-soft" : "text-ink"
                    }
                  >
                    {r.label}
                  </dt>
                  <dd dir="rtl" className="whitespace-nowrap font-medium text-ink">
                    {r.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}

      <dl className="divide-y divide-slate-100 border-t-2 border-slate-200 text-sm">
        <Row label="סה״כ חבות מס" value={ILS.format(totals.liability)} strong />
        <Row label="מס שנוכה במקור" value={ILSminus(totals.withheld)} />
        <Row
          label={totals.balance >= 0 ? "החזר מס צפוי" : "יתרת מס לתשלום"}
          value={ILS.format(Math.abs(totals.balance))}
          strong
        />
        {totals.lossNext > 0.5 && (
          <Row
            label="הפסד הון מועבר לשנה הבאה"
            value={ILS.format(totals.lossNext)}
          />
        )}
      </dl>
    </div>
  );
}

// ----- one taxpayer: personal details + their documents -----

function PersonCard({
  person,
  title,
  showName,
  pointValueNum,
  onName,
  onGender,
  onPoints,
  onLoss,
  onDocChange,
  onAddDoc,
  onRemoveDoc,
}) {
  return (
    <div className="card">
      <SectionTitle>{title}</SectionTitle>

      {showName && (
        <input
          type="text"
          value={person.name}
          placeholder={`שם ${title}`}
          onChange={(e) => onName(e.target.value)}
          className="mb-4 w-full max-w-[60%] rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        />
      )}

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
                onClick={() => onGender(o.k)}
                className={`rounded-full px-5 py-1.5 text-sm font-semibold transition ${
                  person.gender === o.k
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
          value={person.points}
          asText
          onChange={onPoints}
          hint="הוסיפו נקודות עבור ילדים, תואר, יישוב מזכה, חייל משוחרר ועוד."
        />
      </div>

      <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-ink-soft">
        שווי נקודות הזיכוי לשנה:{" "}
        <span className="font-bold text-brand-700">
          {ILS.format(num(person.points) * pointValueNum)}
        </span>{" "}
        ({num(person.points)} × {ILS.format(pointValueNum)} לנקודה)
      </p>

      <div className="mt-4 sm:max-w-[50%]">
        <NumField
          label="הפסדי הון מועברים משנים קודמות"
          value={person.lossCarryforward}
          placeholder="0"
          suffix="₪"
          thousands
          onChange={onLoss}
          hint="יקוזזו כנגד רווחי הון השנה; יתרה תועבר לשנה הבאה."
        />
      </div>

      {/* Documents */}
      <div className="mt-6">
        <h4 className="mb-1 font-bold text-ink">מסמכים והכנסות</h4>
        <p className="mb-4 text-sm text-ink-soft">
          טופס <span className="font-semibold text-ink">106</span> — משכורת והמס
          שנוכה; טופס <span className="font-semibold text-ink">867</span> — הכנסות
          מהון (ניתן להזין כמה שורות בטופס אחד); "מסמך אחר" — לכל הכנסה נוספת.
        </p>

        <div className="space-y-4">
          {person.docs.map((d, idx) => (
            <DocCard
              key={d.id}
              doc={d}
              index={idx}
              onChange={(patch) => onDocChange(d.id, patch)}
              onRemove={person.docs.length > 1 ? () => onRemoveDoc(d.id) : null}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAddDoc("106")}
            className="rounded-full border border-brand-300 bg-white px-4 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            + טופס 106
          </button>
          <button
            type="button"
            onClick={() => onAddDoc("867")}
            className="rounded-full border border-brand-300 bg-white px-4 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            + טופס 867
          </button>
          <button
            type="button"
            onClick={() => onAddDoc("other")}
            className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-ink-soft transition hover:border-brand-300 hover:text-brand-700"
          >
            + מסמך אחר
          </button>
        </div>
      </div>
    </div>
  );
}

// ----- a single document card -----

function DocCard({ doc, index, onChange, onRemove }) {
  const title =
    doc.type === "106"
      ? "טופס 106 — משכורת"
      : doc.type === "867"
      ? "טופס 867 — הכנסות מהון"
      : "מסמך אחר";

  // 867 line handlers.
  const setLine = (lid, patch) =>
    onChange({ lines: doc.lines.map((l) => (l.id === lid ? { ...l, ...patch } : l)) });
  const addLine = () => onChange({ lines: [...doc.lines, newLine867()] });
  const removeLine = (lid) => onChange({ lines: doc.lines.filter((l) => l.id !== lid) });

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
        <>
          <input
            type="text"
            value={doc.description}
            placeholder={`תיאור הטופס (לדוגמה: בנק / בית השקעות)`}
            onChange={(e) => onChange({ description: e.target.value })}
            className="mb-3 w-full max-w-[70%] rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
          />
          <div className="space-y-3">
            {doc.lines.map((ln) => {
              const isGain = ln.category === "capitalgain";
              return (
                <div key={ln.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <Select
                        value={ln.category}
                        onChange={(v) => setLine(ln.id, { category: v })}
                        options={CAPITAL_CATEGORIES}
                      />
                    </div>
                    {doc.lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(ln.id)}
                        className="shrink-0 text-sm font-medium text-red-600 hover:underline"
                      >
                        הסרת שורה
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <NumField
                      label="סכום ההכנסה"
                      value={ln.income}
                      placeholder="0"
                      suffix="₪"
                      thousands
                      signed={isGain}
                      hint={isGain ? "סכום שלילי = הפסד הון" : undefined}
                      onChange={(v) => setLine(ln.id, { income: v })}
                    />
                    {!isGain && (
                      <NumField
                        label="שיעור מס"
                        value={ln.rate}
                        placeholder="25"
                        suffix="%"
                        asText
                        onChange={(v) => setLine(ln.id, { rate: v })}
                      />
                    )}
                    <NumField
                      label="מס שנוכה במקור"
                      value={ln.withheld}
                      placeholder="0"
                      suffix="₪"
                      thousands
                      onChange={(v) => setLine(ln.id, { withheld: v })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addLine}
            className="mt-3 text-sm font-semibold text-brand-700 hover:underline"
          >
            + הוספת שורה
          </button>
        </>
      )}

      {doc.type === "other" && (
        <>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">תיאור</label>
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
              options={OTHER_KINDS}
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
            {doc.kind === "fixed" && (
              <NumField
                label="שיעור מס"
                value={doc.rate}
                placeholder="25"
                suffix="%"
                asText
                onChange={(v) => onChange({ rate: v })}
              />
            )}
            {doc.kind === "passive" && (
              <p className="flex items-end rounded-lg bg-brand-50 px-3 py-2 text-xs text-ink-soft">
                בחישוב זוגי: ממוסה בחישוב המשותף לפי שיעור המס של בן הזוג בעל
                ההכנסה הגבוהה.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
