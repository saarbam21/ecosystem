"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
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

const ILSminus = (x) => (Math.abs(x) < 0.5 ? ILS.format(0) : ILS.format(-Math.abs(x)));

function num(v) {
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

// Thousands separators while typing; keeps a leading minus when `signed`.
function formatThousands(str, signed) {
  const s = String(str ?? "");
  const neg = signed && /^\s*-/.test(s);
  const cleaned = s.replace(/[^\d.]/g, "");
  if (cleaned === "") return neg ? "-" : "";
  const [intPart, ...rest] = cleaned.split(".");
  const dec = rest.length ? "." + rest.join("") : "";
  return (neg ? "-" : "") + intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + dec;
}

const CAPITAL_CATEGORIES = [
  { k: "dividend", t: "דיבידנד" },
  { k: "interest", t: "ריבית" },
  { k: "capitalgain", t: "רווח/הפסד הון" },
  { k: "other", t: "אחר (קבוע)" },
];

const OTHER_KINDS = [
  { k: "ordinary", t: "יגיעה אישית (מדרגות)" },
  { k: "fixed", t: "הון בשיעור קבוע" },
  { k: "passive", t: "שאינה מיגיעה אישית (שולי)" },
];

// ----- documents & taxpayers -----

let lineId = 0;
// Withholding is reported per income line on the 867.
const newLine867 = () => ({ id: ++lineId, category: "dividend", income: "", rate: "", withheld: "" });

let docId = 0;
const newDoc = (type = "106") => {
  const base = { id: ++docId, type };
  if (type === "106") return { ...base, employer: "", income: "", pension: "", withheld: "" };
  if (type === "867") return { ...base, description: "", lines: [newLine867()] };
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
  docs: [newDoc("106")],
});

const COUPLE_LABELS = ["בן/בת זוג א׳", "בן/בת זוג ב׳"];
const personName = (person, index, mode) =>
  person.name?.trim() || (mode === "couple" ? COUPLE_LABELS[index] : "הנישום");

// ----- persistence -----

const STORAGE_KEY = "ecosystem_income_tax_form_v1";
const FORM_VERSION = 1;

const defaultShared = () => ({
  pointValue: String(DEFAULT_INCOME_TAX_CONFIG.pointValueAnnual),
  surtaxRate: String(DEFAULT_INCOME_TAX_CONFIG.surtaxRate * 100),
  surtaxThreshold: String(DEFAULT_INCOME_TAX_CONFIG.surtaxThreshold),
});

// After loading saved data, advance the id counters past any restored ids so
// newly-added items never collide with loaded ones.
function reseedIds(persons) {
  let mp = personId;
  let md = docId;
  let ml = lineId;
  (persons || []).forEach((p) => {
    mp = Math.max(mp, p.id || 0);
    (p.docs || []).forEach((d) => {
      md = Math.max(md, d.id || 0);
      (d.lines || []).forEach((l) => (ml = Math.max(ml, l.id || 0)));
    });
  });
  personId = mp;
  docId = md;
  lineId = ml;
}

// ----- calculation -----

function capitalRateFor(cfg, category, rate) {
  const r = num(rate);
  if (r > 0) return r > 1 ? r / 100 : r;
  return cfg.capitalRates[category] ?? cfg.capitalRates.other;
}

// Split a person's documents into exertion, passive and four capital buckets.
// 867 withholding is at form level and is spread across the form's lines in
// proportion to each line's (positive) computed tax.
function splitPersonDocs(cfg, person) {
  let exertionIncome = 0;
  let pensionDeduction = 0;
  let exertionWithheld = 0;
  const exertionSources = [];
  let passiveIncome = 0;
  let passiveWithheld = 0;
  const passiveSources = [];
  const cap = {
    dividend: { sources: [], withheld: 0 },
    interest: { sources: [], withheld: 0 },
    capitalgain: { sources: [], withheld: 0 },
    otherfixed: { sources: [], withheld: 0 },
  };

  for (const d of person.docs) {
    if (d.type === "106") {
      const salary = num(d.income);
      pensionDeduction += num(d.pension);
      exertionIncome += salary;
      exertionWithheld += num(d.withheld);
      exertionSources.push({ label: d.employer?.trim() || "טופס 106", income: salary });
    } else if (d.type === "867") {
      const label = d.description?.trim() || "טופס 867";
      for (const ln of d.lines || []) {
        const income = num(ln.income);
        const catKey =
          ln.category === "dividend" || ln.category === "interest"
            ? ln.category
            : ln.category === "capitalgain"
            ? "capitalgain"
            : "otherfixed";
        const rate =
          ln.category === "capitalgain"
            ? cfg.capitalRates.capitalgain
            : capitalRateFor(cfg, ln.category === "other" ? "other" : ln.category, ln.rate);
        cap[catKey].sources.push({ label, income, rate });
        cap[catKey].withheld += num(ln.withheld);
      }
    } else {
      const income = num(d.income);
      const w = num(d.withheld);
      const label = d.label?.trim() || "מסמך אחר";
      if (d.kind === "fixed") {
        cap.otherfixed.sources.push({ label, income, rate: capitalRateFor(cfg, "other", d.rate) });
        cap.otherfixed.withheld += w;
      } else if (d.kind === "passive") {
        passiveIncome += income;
        passiveWithheld += w;
        passiveSources.push({ label, income });
      } else {
        exertionIncome += income;
        exertionWithheld += w;
        exertionSources.push({ label, income });
      }
    }
  }
  return {
    // Taxable personal-exertion income = salary − pension-fund deduction.
    exertionIncome: exertionIncome - pensionDeduction,
    exertionGross: exertionIncome,
    pensionDeduction,
    exertionWithheld,
    exertionSources,
    passiveIncome,
    passiveWithheld,
    passiveSources,
    cap,
  };
}

function computeAll(cfg, persons, shared, lossCarryforward) {
  const parts = persons.map((p) => ({ person: p, ...splitPersonDocs(cfg, p) }));

  const taxpayers = parts.map((pt) => {
    const bracketTax = annualIncomeTax(cfg, pt.exertionIncome);
    const credit = num(pt.person.points) * shared.pointValue;
    const creditUsed = Math.min(credit, bracketTax);
    const afterCredit = Math.max(0, bracketTax - credit);
    // מס יסף on personal-exertion income folded into the salary tax.
    const exertionSurtax = shared.surtaxRate * Math.max(0, pt.exertionIncome - shared.surtaxThreshold);
    const tax = afterCredit + exertionSurtax;
    const withheld = pt.exertionWithheld;
    return {
      exertionIncome: pt.exertionIncome,
      exertionGross: pt.exertionGross,
      pensionDeduction: pt.pensionDeduction,
      exertionSources: pt.exertionSources,
      bracketTax,
      creditUsed,
      afterCredit,
      exertionSurtax,
      tax,
      withheld,
      balance: withheld - tax,
    };
  });

  const primaryIdx = taxpayers.reduce(
    (b, t, i, a) => (t.exertionIncome > a[b].exertionIncome ? i : b),
    0
  );
  const primaryExertion = taxpayers[primaryIdx].exertionIncome;

  const mergeCat = (key) => {
    const sources = parts.flatMap((pt) => pt.cap[key].sources);
    const income = sources.reduce((s, l) => s + l.income, 0);
    const baseTax = sources.reduce((s, l) => s + l.income * l.rate, 0);
    const withheld = parts.reduce((s, pt) => s + pt.cap[key].withheld, 0);
    const rate = sources.find((s) => s.rate)?.rate ?? cfg.capitalRates[key] ?? 0.25;
    return { income, baseTax, withheld, sources, rate };
  };
  const dividend = mergeCat("dividend");
  const interest = mergeCat("interest");
  const otherfixed = mergeCat("otherfixed");

  // Capital gains: net gains/losses + household carry-forward.
  const cgSources = parts.flatMap((pt) => pt.cap.capitalgain.sources);
  const cgGross = cgSources.reduce((s, l) => s + l.income, 0);
  const cgWithheld = parts.reduce((s, pt) => s + pt.cap.capitalgain.withheld, 0);
  const carryforward = num(lossCarryforward);
  const gainsRate = cfg.capitalRates.capitalgain;
  const afterCF = cgGross - carryforward;
  const cgTaxable = Math.max(0, afterCF);
  const capitalgain = {
    income: cgTaxable,
    gross: cgGross,
    baseTax: cgTaxable * gainsRate,
    withheld: cgWithheld,
    sources: cgSources,
    carryforward,
    taxable: cgTaxable,
    lossNext: Math.max(0, -afterCF),
    rate: gainsRate,
  };

  const passiveSources = parts.flatMap((pt) => pt.passiveSources);
  const passiveIncome = passiveSources.reduce((s, l) => s + l.income, 0);
  const passiveWithheld = parts.reduce((s, pt) => s + pt.passiveWithheld, 0);
  const passiveRate = marginalRate(cfg, primaryExertion);
  const passive = {
    income: passiveIncome,
    baseTax: passiveIncome * passiveRate,
    withheld: passiveWithheld,
    sources: passiveSources,
    rate: passiveRate,
  };

  // מס יסף on non-exertion income: the extra it creates when stacked above the
  // higher earner's income, spread across the capital categories by income.
  const cats = [dividend, interest, capitalgain, otherfixed, passive];
  const capitalTaxable =
    dividend.income + interest.income + capitalgain.taxable + otherfixed.income + passive.income;
  const th = shared.surtaxThreshold;
  const capSurtaxTotal =
    shared.surtaxRate *
    (Math.max(0, primaryExertion + capitalTaxable - th) - Math.max(0, primaryExertion - th));
  cats.forEach((c) => {
    const share = capitalTaxable > 0 ? c.income / capitalTaxable : 0;
    c.surtax = capSurtaxTotal * share;
    c.tax = c.baseTax + c.surtax;
  });

  const pool = { dividend, interest, capitalgain, otherfixed, passive, passiveRate, primaryIdx };
  const jointTax = cats.reduce((s, c) => s + c.tax, 0);
  const jointWithheld = cats.reduce((s, c) => s + c.withheld, 0);
  const jointBalance = jointWithheld - jointTax;
  const liability = taxpayers.reduce((s, t) => s + t.tax, 0) + jointTax;
  const withheldTotal = taxpayers.reduce((s, t) => s + t.withheld, 0) + jointWithheld;
  const totalTaxable = taxpayers.reduce((s, t) => s + t.exertionIncome, 0) + capitalTaxable;
  const household = {
    liability,
    withheld: withheldTotal,
    balance: withheldTotal - liability,
    totalTaxable,
    effRate: totalTaxable > 0 ? liability / totalTaxable : 0,
  };
  return { taxpayers, pool, jointTax, jointWithheld, jointBalance, primaryIdx, household, lossNext: capitalgain.lossNext };
}

// ----- summary-table cells & builder -----

const dashCell = { v: "—", cls: "text-ink-soft" };
const moneyCell = (x) => ({ v: ILS.format(x) });
const minusCell = (x) => ({ v: ILSminus(x) });
// A balance cell where a positive value is tax owed (amber) and negative is a refund (green).
const payCell = (x) => ({
  v: ILS.format(x),
  cls:
    x > 0.5 ? "font-semibold text-amber-700" : x < -0.5 ? "font-semibold text-brand-700" : "text-ink",
});

function buildTable(res, mode, names) {
  const couple = mode === "couple";
  const [t0, t1] = res.taxpayers;
  const p = res.pool;
  const groups = [];

  const jointCol = (cellObj) => (couple ? [dashCell, dashCell, cellObj] : [cellObj]);
  const detail = (label, taxCells, muted = true) => ({
    label: `  ${label}`,
    cells: [...taxCells, dashCell, dashCell],
    muted,
  });

  // Salary — each line item on ONE row, with the spouses side by side.
  {
    const T = res.taxpayers;
    const pair = (label, getCell, muted = true) => {
      const taxCells = couple ? [getCell(0), getCell(1), dashCell] : [getCell(0)];
      return { label: `  ${label}`, cells: [...taxCells, dashCell, dashCell], muted };
    };
    const rows = [];
    const maxSrc = Math.max(0, ...T.map((t) => t.exertionSources.length));
    for (let s = 0; s < maxSrc; s++) {
      const labels = [...new Set(T.map((t) => t.exertionSources[s]?.label).filter(Boolean))];
      rows.push(
        pair(labels.join(" / ") || "טופס 106", (k) => {
          const src = T[k]?.exertionSources[s];
          return src ? moneyCell(src.income) : dashCell;
        })
      );
    }
    if (T.some((t) => t.pensionDeduction > 0.5))
      rows.push(
        pair("ניכוי הפקדה לקופות גמל", (k) =>
          T[k] && T[k].pensionDeduction > 0.5 ? minusCell(T[k].pensionDeduction) : dashCell
        )
      );
    if (maxSrc > 1 || T.some((t) => t.pensionDeduction > 0.5))
      rows.push(pair("הכנסה חייבת (סה״כ)", (k) => (T[k] ? moneyCell(T[k].exertionIncome) : dashCell)));
    rows.push(pair("מס לפי מדרגות (לפני זיכוי)", (k) => (T[k] ? moneyCell(T[k].bracketTax) : dashCell)));
    rows.push(pair("זיכוי נקודות זיכוי", (k) => (T[k] ? minusCell(T[k].creditUsed) : dashCell)));
    if (T.some((t) => t.exertionSurtax > 0.5))
      rows.push(
        pair("תוספת מס יסף", (k) =>
          T[k] && T[k].exertionSurtax > 0.5 ? moneyCell(T[k].exertionSurtax) : dashCell
        )
      );
    rows.push(pair("מס שנוכה במקור", (k) => (T[k] ? moneyCell(T[k].withheld) : dashCell)));

    const withheld = T.reduce((s, t) => s + t.withheld, 0);
    const tax = T.reduce((s, t) => s + t.tax, 0);
    const taxCells = couple ? [moneyCell(t0.tax), moneyCell(t1.tax), dashCell] : [moneyCell(tax)];
    groups.push({
      key: "salary",
      title: "הכנסה מיגיעה אישית",
      headerCells: [...taxCells, moneyCell(withheld), payCell(tax - withheld)],
      rows,
    });
  }

  const flat = (cat, title, key) => {
    // Show the group whenever it has any amount — including a negative (loss).
    if (Math.abs(cat.income) <= 0.5 && Math.abs(cat.tax) <= 0.5) return;
    const rows = cat.sources
      .filter((s) => Math.abs(s.income) > 0.5)
      .map((s) => detail(`${s.label} (${(s.rate * 100).toFixed(0)}%)`, jointCol(moneyCell(s.income))));
    rows.push(detail("מס לפי שיעור", jointCol(moneyCell(cat.baseTax))));
    if (cat.surtax > 0.5) rows.push(detail("תוספת מס יסף", jointCol(moneyCell(cat.surtax))));
    const taxCells = couple ? [dashCell, dashCell, moneyCell(cat.tax)] : [moneyCell(cat.tax)];
    groups.push({
      key,
      title,
      headerCells: [...taxCells, moneyCell(cat.withheld), payCell(cat.tax - cat.withheld)],
      rows,
    });
  };
  flat(p.dividend, "דיבידנד", "dividend");
  flat(p.interest, "ריבית", "interest");

  const cg = p.capitalgain;
  if (Math.abs(cg.gross) > 0.5 || cg.carryforward > 0.5 || cg.tax > 0.5) {
    const rows = cg.sources
      .filter((s) => Math.abs(s.income) > 0.5)
      .map((s) => detail(`${s.label} — ${s.income >= 0 ? "רווח" : "הפסד"}`, jointCol(moneyCell(s.income))));
    if (cg.carryforward > 0.5)
      rows.push(detail("הפסדים מועברים (משק בית)", jointCol(minusCell(cg.carryforward))));
    rows.push(detail("רווח הון חייב (אחרי קיזוז)", jointCol(moneyCell(cg.taxable))));
    rows.push(detail(`מס רווח הון (${(cg.rate * 100).toFixed(0)}%)`, jointCol(moneyCell(cg.baseTax))));
    if (cg.surtax > 0.5) rows.push(detail("תוספת מס יסף", jointCol(moneyCell(cg.surtax))));
    if (cg.lossNext > 0.5)
      rows.push(detail("הפסד הון מועבר לשנה הבאה", jointCol(moneyCell(cg.lossNext))));
    const taxCells = couple ? [dashCell, dashCell, moneyCell(cg.tax)] : [moneyCell(cg.tax)];
    groups.push({
      key: "capitalgain",
      title: "רווח הון",
      headerCells: [...taxCells, moneyCell(cg.withheld), payCell(cg.tax - cg.withheld)],
      rows,
    });
  }

  flat(p.otherfixed, "הכנסה אחרת (שיעור קבוע)", "otherfixed");

  const pas = p.passive;
  if (Math.abs(pas.income) > 0.5) {
    const rows = pas.sources
      .filter((s) => Math.abs(s.income) > 0.5)
      .map((s) => detail(s.label, jointCol(moneyCell(s.income))));
    rows.push(detail(`מס לפי שיעור בן/בת הזוג (${(pas.rate * 100).toFixed(0)}%)`, jointCol(moneyCell(pas.baseTax))));
    if (pas.surtax > 0.5) rows.push(detail("תוספת מס יסף", jointCol(moneyCell(pas.surtax))));
    const taxCells = couple ? [dashCell, dashCell, moneyCell(pas.tax)] : [moneyCell(pas.tax)];
    groups.push({
      key: "passive",
      title: "הכנסה שאינה מיגיעה אישית",
      headerCells: [...taxCells, moneyCell(pas.withheld), payCell(pas.tax - pas.withheld)],
      rows,
    });
  }

  const columns = couple
    ? ["סוג הכנסה", names[0], names[1], "חישוב משותף", "נוכה במקור", "לתשלום (+)/החזר (−)"]
    : ["סוג הכנסה", "מס מחושב", "נוכה במקור", "לתשלום (+)/החזר (−)"];
  const totalPay = res.household.liability - res.household.withheld;
  const totalsCells = couple
    ? [
        moneyCell(t0.tax),
        moneyCell(t1.tax),
        moneyCell(res.jointTax),
        moneyCell(res.household.withheld),
        payCell(totalPay),
      ]
    : [moneyCell(res.household.liability), moneyCell(res.household.withheld), payCell(totalPay)];

  return { columns, groups, totalsCells, lossNext: res.lossNext };
}

// ----- compact inputs -----

// Labelled wrapper: label (and optional 106 field code) above the input.
function Field({ label, code, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-soft">
        {label}
        {code && <span className="mr-1 text-slate-400">(קוד {code})</span>}
      </label>
      {children}
    </div>
  );
}

function MiniText({ value, onChange, placeholder, className = "" }) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none transition focus:border-brand-500 ${className}`}
    />
  );
}

function MiniNum({ value, onChange, placeholder, thousands, signed, className = "" }) {
  return (
    <input
      type="text"
      inputMode={signed ? "text" : "numeric"}
      dir="ltr"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(thousands ? formatThousands(e.target.value, signed) : e.target.value)}
      className={`rounded-lg border border-slate-200 px-2.5 py-1.5 text-right text-sm outline-none transition focus:border-brand-500 ${className}`}
    />
  );
}

function MiniSelect({ value, onChange, options, className = "" }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      dir="rtl"
      className={`rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-brand-500 ${className}`}
    >
      {options.map((o) => (
        <option key={o.k} value={o.k}>
          {o.t}
        </option>
      ))}
    </select>
  );
}

function NumField({ label, value, onChange, placeholder, suffix, thousands, asText, hint }) {
  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium text-ink">{label}</label>}
      <div className="relative">
        <input
          type={thousands || asText ? "text" : "number"}
          inputMode={thousands || asText ? "numeric" : "decimal"}
          dir="ltr"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(thousands ? formatThousands(e.target.value) : e.target.value)}
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

function SectionTitle({ children }) {
  return <h3 className="mb-4 text-lg font-bold text-ink">{children}</h3>;
}

// ----- the calculator -----

export default function IncomeTaxCalculator() {
  const cfg = useIncomeTaxConfig();

  const [mode, setMode] = useState("single");
  const [persons, setPersons] = useState([newPerson("male")]);
  const [lossCarryforward, setLossCarryforward] = useState("");
  const [shared, setShared] = useState(defaultShared);
  const [title, setTitle] = useState("");

  const [showDetail, setShowDetail] = useState(true);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const isCouple = mode === "couple";

  // Apply a saved/imported snapshot to the form state.
  const applyState = (d) => {
    if (!d || typeof d !== "object" || !Array.isArray(d.persons) || d.persons.length === 0)
      return false;
    reseedIds(d.persons);
    setPersons(d.persons);
    setMode(d.mode === "couple" && d.persons.length === 2 ? "couple" : "single");
    setTitle(typeof d.title === "string" ? d.title : "");
    setLossCarryforward(d.lossCarryforward != null ? String(d.lossCarryforward) : "");
    setShared({ ...defaultShared(), ...(d.shared && typeof d.shared === "object" ? d.shared : {}) });
    return true;
  };

  // Restore the auto-saved form once, after mount (avoids hydration mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) applyState(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  // Auto-save on every change (after the initial restore).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: FORM_VERSION, title, mode, persons, shared, lossCarryforward })
      );
      setSavedAt(Date.now());
    } catch {}
  }, [hydrated, title, mode, persons, shared, lossCarryforward]);

  const exportFile = () => {
    const data = { version: FORM_VERSION, title, mode, persons, shared, lossCarryforward };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = (title.trim() || "מחשבון-מס").replace(/[^\p{L}\p{N}_-]+/gu, "_");
    a.href = url;
    a.download = `${base}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (!applyState(JSON.parse(reader.result))) window.alert("הקובץ אינו טופס תקין.");
      } catch {
        window.alert("לא ניתן לקרוא את הקובץ.");
      }
    };
    reader.readAsText(file);
  };

  const resetForm = () => {
    if (!window.confirm("לאפס את הטופס? כל הנתונים שהוזנו יימחקו.")) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setTitle("");
    setMode("single");
    setPersons([newPerson("male")]);
    setLossCarryforward("");
    setShared(defaultShared());
  };

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
          ? { ...p, gender: g, points: String(g === "male" ? cfg.pointsMale : cfg.pointsFemale) }
          : p
      )
    );
  const patchDocs = (pid, fn) =>
    setPersons((ps) => ps.map((p) => (p.id === pid ? { ...p, docs: fn(p.docs) } : p)));
  const setDoc = (pid, did, patch) =>
    patchDocs(pid, (ds) => ds.map((d) => (d.id === did ? { ...d, ...patch } : d)));
  const addDoc = (pid, type) => patchDocs(pid, (ds) => [...ds, newDoc(type)]);
  const removeDoc = (pid, did) => patchDocs(pid, (ds) => ds.filter((d) => d.id !== did));

  const calc = useMemo(() => {
    const sharedNums = {
      pointValue: num(shared.pointValue),
      surtaxRate: num(shared.surtaxRate) / 100,
      surtaxThreshold: num(shared.surtaxThreshold),
    };
    const people = isCouple && persons.length === 2 ? persons : [persons[0]];
    return computeAll(cfg, people, sharedNums, lossCarryforward);
  }, [cfg, persons, shared, isCouple, lossCarryforward]);

  const household = calc.household;
  const isRefund = household.balance >= 0;
  const names = persons.map((p, i) => personName(p, i, mode));
  const table = buildTable(calc, mode, names);

  const chips = isCouple
    ? [
        { name: names[0], balance: calc.taxpayers[0].balance },
        { name: names[1], balance: calc.taxpayers[1].balance },
        { name: "חישוב משותף", balance: calc.jointBalance },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Save / load toolbar */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-[12rem] flex-1">
            <MiniText
              value={title}
              placeholder="שם הלקוח / כותרת הטופס (לא חובה)"
              onChange={setTitle}
              className="w-full font-semibold"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportFile}
              className="rounded-full border border-brand-300 bg-white px-4 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
            >
              שמירה לקובץ
            </button>
            <label className="cursor-pointer rounded-full border border-brand-300 bg-white px-4 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">
              טעינה מקובץ
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  importFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-ink-soft transition hover:border-red-300 hover:text-red-600"
            >
              איפוס
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          הטופס נשמר אוטומטית בדפדפן זה — ניתן לחזור ולעדכן בהמשך.
          {savedAt && (
            <span>
              {" "}
              נשמר לאחרונה{" "}
              {new Date(savedAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}.
            </span>
          )}{" "}
          לשמירה לטווח ארוך או למעבר בין מכשירים — שמרו לקובץ.
        </p>
      </div>

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
                mode === o.k ? "bg-brand-700 text-white" : "text-ink-soft hover:text-brand-700"
              }`}
            >
              {o.t}
            </button>
          ))}
        </div>
      </div>

      {/* One card per taxpayer */}
      {persons.map((p, i) => (
        <PersonCard
          key={p.id}
          person={p}
          title={personName(p, i, mode)}
          showName={isCouple}
          onName={(v) => setPerson(p.id, { name: v })}
          onGender={(g) => setGender(p.id, g)}
          onPoints={(v) => setPerson(p.id, { points: v })}
          onDocChange={(did, patch) => setDoc(p.id, did, patch)}
          onAddDoc={(type) => addDoc(p.id, type)}
          onRemoveDoc={(did) => removeDoc(p.id, did)}
        />
      ))}

      {/* Household-level (joint) data */}
      <div className="card">
        <SectionTitle>{isCouple ? "נתונים משותפים (משק בית)" : "נתונים נוספים"}</SectionTitle>
        <div className="sm:max-w-[24rem]">
          <NumField
            label="הפסדי הון מועברים משנים קודמות"
            value={lossCarryforward}
            placeholder="0"
            suffix="₪"
            thousands
            onChange={setLossCarryforward}
            hint="מקוזזים כנגד רווחי הון של משק הבית; יתרה תועבר לשנה הבאה."
          />
        </div>
      </div>

      {/* Result */}
      <div className="card">
        <SectionTitle>{isCouple ? "תוצאה — סיכום משק בית" : "תוצאה — התחשבנות שנתית"}</SectionTitle>

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
          <p className={`mt-1 text-4xl font-extrabold ${isRefund ? "text-brand-700" : "text-amber-700"}`}>
            {ILS.format(Math.abs(household.balance))}
          </p>
          <p className="mt-2 text-xs text-ink-soft">
            סה״כ חבות מס {ILS.format(household.liability)} · נוכה במקור {ILS.format(household.withheld)} ·
            שיעור מס אפקטיבי {(household.effRate * 100).toFixed(1)}%
          </p>
        </div>

        {isCouple && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {chips.map((c, i) => {
              const ref = c.balance >= 0;
              return (
                <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                  <p className="text-sm font-semibold text-ink">{c.name}</p>
                  <p className="text-xs text-ink-soft">{ref ? "החזר מס" : "יתרת מס לתשלום"}</p>
                  <p className={`mt-1 text-2xl font-extrabold ${ref ? "text-brand-700" : "text-amber-700"}`}>
                    {ILS.format(Math.abs(c.balance))}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 rounded-xl border border-slate-100">
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-ink"
          >
            <span>פירוט חישוב המס (לפי סוגי הכנסה)</span>
            <span className="text-ink-soft">{showDetail ? "−" : "+"}</span>
          </button>
          {showDetail && <SummaryTable data={table} />}
        </div>

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

// ----- summary table (collapsible groups by income type, columnar) -----

function SummaryTable({ data }) {
  const { columns, groups, totalsCells, lossNext } = data;
  const [open, setOpen] = useState(() => new Set());
  const toggle = (k) =>
    setOpen((o) => {
      const n = new Set(o);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  const cell = (c, i, strong) => (
    <td
      key={i}
      dir="rtl"
      className={`whitespace-nowrap px-3 py-2 text-center ${
        c.cls || (strong ? "font-bold text-ink" : "font-medium text-ink")
      }`}
    >
      {c.v}
    </td>
  );

  return (
    <div className="overflow-x-auto border-t border-slate-100">
      <table dir="rtl" className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((c, i) => (
              <th
                key={i}
                className={`px-3 py-2 font-semibold text-ink ${i === 0 ? "text-right" : "text-center"}`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {groups.map((g) => (
            <Fragment key={g.key}>
              <tr className="cursor-pointer bg-white hover:bg-slate-50" onClick={() => toggle(g.key)}>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-ink">
                  <span className="ml-1 inline-block w-3 text-ink-soft">{open.has(g.key) ? "−" : "+"}</span>
                  {g.title}
                </td>
                {g.headerCells.map((c, i) => cell(c, i, true))}
              </tr>
              {open.has(g.key) &&
                g.rows.map((r, i) => (
                  <tr key={i} className="bg-slate-50">
                    <td
                      className={`whitespace-nowrap px-3 py-1.5 text-right ${
                        r.muted ? "text-ink-soft" : "text-ink"
                      }`}
                    >
                      {r.label}
                    </td>
                    {r.cells.map((c, j) => cell(c, j, false))}
                  </tr>
                ))}
            </Fragment>
          ))}
          <tr className="border-t-2 border-slate-200 bg-slate-50">
            <td className="px-3 py-2.5 text-right font-bold text-ink">סה״כ</td>
            {totalsCells.map((c, i) => cell(c, i, true))}
          </tr>
        </tbody>
      </table>
      {lossNext > 0.5 && (
        <p className="px-3 py-3 text-xs text-ink-soft">
          הפסד הון מועבר לשנה הבאה:{" "}
          <span className="font-semibold text-ink">{ILS.format(lossNext)}</span>
        </p>
      )}
    </div>
  );
}

// ----- one taxpayer -----

// Hidden helper: build up a person's credit points from common entitlements.
function CreditPointsCalc({ gender, onApply }) {
  const [v, setV] = useState({
    resident: true,
    woman: gender === "female",
    c05: "",
    c617: "",
    c18: "",
    single: false,
    immigrant: false,
    soldier: false,
    degree: false,
  });
  const set = (patch) => setV((s) => ({ ...s, ...patch }));

  const items = [
    { key: "resident", label: "תושב/ת ישראל", pts: 2.25, type: "check" },
    { key: "woman", label: "אישה", pts: 0.5, type: "check" },
    { key: "c05", label: "ילדים בגיל לידה–5", pts: 2.5, type: "count" },
    { key: "c18", label: "ילדים בגיל 18", pts: 0.5, type: "count" },
    { key: "c617", label: "ילדים בגיל 6–17", pts: 1, type: "count" },
    { key: "single", label: "הורה במשפחה חד-הורית", pts: 1, type: "check" },
    { key: "immigrant", label: "עולה חדש (שנה ראשונה)", pts: 1, type: "check" },
    { key: "soldier", label: "חייל/ת משוחרר/ת (שנה)", pts: 1, type: "check" },
    { key: "degree", label: "תואר אקדמי (שנה לאחר סיום)", pts: 1, type: "check" },
  ];

  const total = items.reduce((s, it) => {
    if (it.type === "check") return s + (v[it.key] ? it.pts : 0);
    return s + num(v[it.key]) * it.pts;
  }, 0);

  return (
    <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
      <p className="mb-3 text-sm font-semibold text-ink">מחשבון נקודות זיכוי</p>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {items.map((it) => (
          <label key={it.key} className="flex items-center justify-between gap-2 text-sm text-ink">
            <span className="flex items-center gap-2">
              {it.type === "check" ? (
                <input
                  type="checkbox"
                  checked={v[it.key]}
                  onChange={(e) => set({ [it.key]: e.target.checked })}
                  className="h-4 w-4 accent-brand-600"
                />
              ) : (
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={v[it.key]}
                  placeholder="0"
                  onChange={(e) => set({ [it.key]: e.target.value.replace(/[^\d]/g, "") })}
                  className="w-12 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm outline-none focus:border-brand-500"
                />
              )}
              {it.label}
            </span>
            <span className="text-xs text-ink-soft">{it.pts} נק׳</span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 pt-3">
        <span className="text-sm text-ink">
          סה״כ: <span className="font-extrabold text-brand-700">{total.toFixed(2)}</span> נק׳
        </span>
        <button
          type="button"
          onClick={() => onApply(Number(total.toFixed(2)))}
          className="rounded-full bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-800"
        >
          החל על נקודות הזיכוי
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        אומדן על בסיס הזכאויות הנפוצות — נקודות עולה/חייל/תואר משתנות לפי ותק. מומלץ לאמת מול תלוש/פקיד שומה.
      </p>
    </div>
  );
}

function PersonCard({ person, title, showName, onName, onGender, onPoints, onDocChange, onAddDoc, onRemoveDoc }) {
  const [showCalc, setShowCalc] = useState(false);
  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {showName ? (
          <MiniText
            value={person.name}
            placeholder={title}
            onChange={onName}
            className="min-w-[10rem] flex-1 font-semibold"
          />
        ) : (
          <SectionTitle>{title}</SectionTitle>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
            {[
              { k: "male", t: "גבר" },
              { k: "female", t: "אישה" },
            ].map((o) => (
              <button
                key={o.k}
                type="button"
                onClick={() => onGender(o.k)}
                className={`rounded-full px-4 py-1 text-sm font-semibold transition ${
                  person.gender === o.k ? "bg-brand-700 text-white" : "text-ink-soft hover:text-brand-700"
                }`}
              >
                {o.t}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-sm text-ink-soft">
            נק׳ זיכוי
            <MiniNum value={person.points} onChange={onPoints} className="w-16" />
          </label>
          <button
            type="button"
            onClick={() => setShowCalc((v) => !v)}
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            {showCalc ? "סגור מחשבון" : "מחשבון נק׳ זיכוי"}
          </button>
        </div>
      </div>

      {showCalc && (
        <CreditPointsCalc
          gender={person.gender}
          onApply={(pts) => {
            onPoints(String(pts));
            setShowCalc(false);
          }}
        />
      )}

      <div className="space-y-3">
        {person.docs.map((d, idx) => (
          <DocCard
            key={d.id}
            cfg={null}
            doc={d}
            index={idx}
            onChange={(patch) => onDocChange(d.id, patch)}
            onRemove={person.docs.length > 1 ? () => onRemoveDoc(d.id) : null}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
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
  );
}

// ----- a single document card (compact) -----

const GAINS_RATE = DEFAULT_INCOME_TAX_CONFIG.capitalRates.capitalgain;

function DocCard({ doc, index, onChange, onRemove }) {
  const title =
    doc.type === "106" ? "טופס 106" : doc.type === "867" ? "טופס 867" : "מסמך אחר";

  const setLine = (lid, patch) =>
    onChange({ lines: doc.lines.map((l) => (l.id === lid ? { ...l, ...patch } : l)) });
  const addLine = () => onChange({ lines: [...doc.lines, newLine867()] });
  const removeLine = (lid) => onChange({ lines: doc.lines.filter((l) => l.id !== lid) });

  const lineTax = (ln) => {
    const rate =
      ln.category === "capitalgain"
        ? GAINS_RATE
        : capitalRateFor(DEFAULT_INCOME_TAX_CONFIG, ln.category === "other" ? "other" : ln.category, ln.rate);
    return num(ln.income) * rate;
  };
  const formComputed = doc.type === "867" ? doc.lines.reduce((s, ln) => s + lineTax(ln), 0) : 0;
  const formWithheld =
    doc.type === "867" ? doc.lines.reduce((s, ln) => s + num(ln.withheld), 0) : 0;

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-800">
          {title}
        </span>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs font-medium text-red-600 hover:underline">
            הסרה
          </button>
        )}
      </div>

      {doc.type === "106" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="שם המעסיק">
            <MiniText
              value={doc.employer}
              placeholder="שם המעסיק"
              onChange={(v) => onChange({ employer: v })}
              className="w-full"
            />
          </Field>
          <Field label="משכורת" code="158/172">
            <MiniNum
              value={doc.income}
              placeholder="0 ₪"
              thousands
              onChange={(v) => onChange({ income: v })}
              className="w-full"
            />
          </Field>
          <Field label="ניכוי הפקדה לקופות גמל" code="248/249">
            <MiniNum
              value={doc.pension}
              placeholder="0 ₪"
              thousands
              onChange={(v) => onChange({ pension: v })}
              className="w-full"
            />
          </Field>
          <Field label="מס שנוכה במקור" code="042/043">
            <MiniNum
              value={doc.withheld}
              placeholder="0 ₪"
              thousands
              onChange={(v) => onChange({ withheld: v })}
              className="w-full"
            />
          </Field>
        </div>
      )}

      {doc.type === "867" && (
        <>
          <MiniText
            value={doc.description}
            placeholder="תיאור הטופס (בנק / בית השקעות)"
            onChange={(v) => onChange({ description: v })}
            className="mb-2 w-full sm:max-w-[70%]"
          />
          <div className="space-y-1.5">
            {doc.lines.map((ln) => {
              const isGain = ln.category === "capitalgain";
              return (
                <div key={ln.id} className="flex flex-wrap items-center gap-2">
                  <MiniSelect
                    value={ln.category}
                    onChange={(v) => setLine(ln.id, { category: v })}
                    options={CAPITAL_CATEGORIES}
                    className="w-32"
                  />
                  <MiniNum
                    value={ln.income}
                    placeholder="סכום ₪"
                    thousands
                    signed={isGain}
                    onChange={(v) => setLine(ln.id, { income: v })}
                    className="w-28"
                  />
                  {isGain ? (
                    <span className="w-12 text-center text-sm text-ink-soft">
                      {(GAINS_RATE * 100).toFixed(0)}%
                    </span>
                  ) : (
                    <MiniNum
                      value={ln.rate}
                      placeholder="25%"
                      onChange={(v) => setLine(ln.id, { rate: v })}
                      className="w-12"
                    />
                  )}
                  <MiniNum
                    value={ln.withheld}
                    placeholder="נוכה ₪"
                    thousands
                    onChange={(v) => setLine(ln.id, { withheld: v })}
                    className="w-28"
                  />
                  <span className="min-w-[5.5rem] flex-1 text-left text-sm text-ink-soft">
                    מס: <span className="font-semibold text-ink">{ILS.format(lineTax(ln))}</span>
                  </span>
                  {doc.lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(ln.id)}
                      className="text-sm font-bold text-red-500 hover:text-red-700"
                      aria-label="הסרת שורה"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addLine}
            className="mt-2 text-xs font-semibold text-brand-700 hover:underline"
          >
            + הוספת סוג הכנסה
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-5 border-t border-slate-200 pt-2 text-sm">
            <span className="text-ink-soft">
              סה״כ מס מחושב:{" "}
              <span className="font-bold text-brand-700">{ILS.format(formComputed)}</span>
            </span>
            <span className="text-ink-soft">
              סה״כ נוכה במקור:{" "}
              <span className="font-bold text-ink">{ILS.format(formWithheld)}</span>
            </span>
          </div>
        </>
      )}

      {doc.type === "other" && (
        <div className="flex flex-wrap items-center gap-2">
          <MiniText
            value={doc.label}
            placeholder="תיאור (עסק / שכר דירה)"
            onChange={(v) => onChange({ label: v })}
            className="min-w-[8rem] flex-1"
          />
          <MiniSelect
            value={doc.kind}
            onChange={(v) => onChange({ kind: v })}
            options={OTHER_KINDS}
            className="w-52"
          />
          <MiniNum
            value={doc.income}
            placeholder="סכום ₪ (שלילי=הפסד)"
            thousands
            signed
            onChange={(v) => onChange({ income: v })}
            className="w-40"
          />
          <MiniNum
            value={doc.withheld}
            placeholder="מס שנוכה ₪"
            thousands
            onChange={(v) => onChange({ withheld: v })}
            className="w-32"
          />
          {doc.kind === "fixed" && (
            <MiniNum
              value={doc.rate}
              placeholder="25%"
              onChange={(v) => onChange({ rate: v })}
              className="w-14"
            />
          )}
        </div>
      )}
    </div>
  );
}
