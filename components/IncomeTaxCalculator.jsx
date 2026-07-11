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

// The capital-income categories reported on a 867.
const CAPITAL_CATEGORIES = [
  { k: "dividend", t: "דיבידנד" },
  { k: "interest", t: "ריבית" },
  { k: "capitalgain", t: "רווח הון (ני״ע)" },
  { k: "other", t: "אחר" },
];
const categoryLabel = (k) =>
  CAPITAL_CATEGORIES.find((c) => c.k === k)?.t ?? "הון";

// ----- documents & taxpayers -----

let docId = 0;
const newDoc = (type = "106") => {
  const base = { id: ++docId, type };
  if (type === "106") return { ...base, employer: "", income: "", withheld: "" };
  if (type === "867")
    return { ...base, category: "dividend", income: "", withheld: "", rate: "" };
  // "other": free-form income line, ordinary (personal exertion) or capital.
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
  person.name?.trim() ||
  (mode === "couple" ? COUPLE_LABELS[index] : "הנישום");

// ----- calculation helpers -----

function capitalRateFor(cfg, category, rate) {
  const r = num(rate);
  if (r > 0) return r > 1 ? r / 100 : r; // accept "25" or "0.25"
  return cfg.capitalRates[category] ?? cfg.capitalRates.other;
}

// Split a person's documents into personal-exertion (יגיעה אישית) and
// non-exertion (הון) buckets.
function splitPersonDocs(cfg, person) {
  let exertionIncome = 0;
  let exertionWithheld = 0;
  let nonExertionIncome = 0;
  let nonExertionWithheld = 0;
  const nonExertionLines = [];

  for (const d of person.docs) {
    const income = num(d.income);
    const withheld = num(d.withheld);
    if (d.type === "106") {
      exertionIncome += income;
      exertionWithheld += withheld;
    } else if (d.type === "867") {
      nonExertionIncome += income;
      nonExertionWithheld += withheld;
      nonExertionLines.push({
        id: d.id,
        category: d.category,
        income,
        rate: capitalRateFor(cfg, d.category, d.rate),
        withheld,
      });
    } else if (d.kind === "capital") {
      nonExertionIncome += income;
      nonExertionWithheld += withheld;
      nonExertionLines.push({
        id: d.id,
        category: "other",
        income,
        rate: capitalRateFor(cfg, "other", d.rate),
        withheld,
      });
    } else {
      exertionIncome += income;
      exertionWithheld += withheld;
    }
  }
  return {
    exertionIncome,
    exertionWithheld,
    nonExertionIncome,
    nonExertionWithheld,
    nonExertionLines,
  };
}

// A single taxpayer (individual mode): taxed on own brackets, credit points and
// surtax threshold. Capital income keeps its own flat rate.
function computePerson(cfg, person, shared) {
  const s = splitPersonDocs(cfg, person);
  const capitalTax = s.nonExertionLines.reduce((t, l) => t + l.income * l.rate, 0);

  const ordinaryBracketTax = annualIncomeTax(cfg, s.exertionIncome);
  const credit = num(person.points) * shared.pointValue;
  const creditUsed = Math.min(credit, ordinaryBracketTax);
  const ordinaryAfterCredit = Math.max(0, ordinaryBracketTax - credit);

  const totalTaxable = s.exertionIncome + s.nonExertionIncome;
  const surtax = shared.surtaxRate * Math.max(0, totalTaxable - shared.surtaxThreshold);

  const liability = ordinaryAfterCredit + capitalTax + surtax;
  const withheldTotal = s.exertionWithheld + s.nonExertionWithheld;
  const balance = withheldTotal - liability;
  const effRate = totalTaxable > 0 ? liability / totalTaxable : 0;

  return {
    ordinaryIncome: s.exertionIncome,
    capitalIncome: s.nonExertionIncome,
    capitalLines: s.nonExertionLines,
    totalTaxable,
    ordinaryBracketTax,
    credit,
    creditUsed,
    ordinaryAfterCredit,
    capitalTax,
    surtax,
    surtaxThreshold: shared.surtaxThreshold,
    liability,
    withheldTotal,
    balance,
    effRate,
  };
}

// A couple: each spouse's personal-exertion income is taxed separately (חישוב
// נפרד). All non-exertion income is pooled into a joint calculation and taxed at
// the marginal rate of the spouse with the higher (personal-exertion) income —
// the attribution rule of s' 66 to the Income Tax Ordinance.
function computeCouple(cfg, persons, shared) {
  const parts = persons.map((p) => ({ person: p, ...splitPersonDocs(cfg, p) }));

  const spouses = parts.map((pt) => {
    const ordinaryBracketTax = annualIncomeTax(cfg, pt.exertionIncome);
    const credit = num(pt.person.points) * shared.pointValue;
    const creditUsed = Math.min(credit, ordinaryBracketTax);
    const ordinaryAfterCredit = Math.max(0, ordinaryBracketTax - credit);
    const surtax = shared.surtaxRate * Math.max(0, pt.exertionIncome - shared.surtaxThreshold);
    return {
      exertionIncome: pt.exertionIncome,
      ordinaryBracketTax,
      credit,
      creditUsed,
      ordinaryAfterCredit,
      surtax,
      liability: ordinaryAfterCredit + surtax,
      withheld: pt.exertionWithheld,
      get balance() {
        return this.withheld - this.liability;
      },
    };
  });

  const higherIdx = spouses[0].exertionIncome >= spouses[1].exertionIncome ? 0 : 1;
  const ordHigh = spouses[higherIdx].exertionIncome;

  const jointIncome = parts.reduce((s, pt) => s + pt.nonExertionIncome, 0);
  const jointWithheld = parts.reduce((s, pt) => s + pt.nonExertionWithheld, 0);
  const jointLines = parts.flatMap((pt, i) =>
    pt.nonExertionLines.map((l) => ({ ...l, spouse: i }))
  );
  const jointRate = marginalRate(cfg, ordHigh);
  const jointIncomeTax = jointIncome * jointRate;

  // Surtax on the joint income = the extra it creates when stacked on the higher
  // spouse's income above the (per-taxpayer) threshold.
  const th = shared.surtaxThreshold;
  const jointSurtax =
    shared.surtaxRate *
    (Math.max(0, ordHigh + jointIncome - th) - Math.max(0, ordHigh - th));

  const jointTax = jointIncomeTax + jointSurtax;
  const joint = {
    higherIdx,
    income: jointIncome,
    rate: jointRate,
    incomeTax: jointIncomeTax,
    surtax: jointSurtax,
    tax: jointTax,
    withheld: jointWithheld,
    balance: jointWithheld - jointTax,
    lines: jointLines,
  };

  const liability = spouses[0].liability + spouses[1].liability + jointTax;
  const withheldTotal = spouses[0].withheld + spouses[1].withheld + jointWithheld;
  const balance = spouses[0].balance + spouses[1].balance + joint.balance;
  const totalTaxable =
    spouses[0].exertionIncome + spouses[1].exertionIncome + jointIncome;
  const household = {
    liability,
    withheldTotal,
    balance,
    totalTaxable,
    effRate: totalTaxable > 0 ? liability / totalTaxable : 0,
  };

  return { spouses, joint, household };
}

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

  // Switch between individual and couple, keeping the first taxpayer's data.
  const switchMode = (m) => {
    setMode(m);
    setPersons((ps) => {
      if (m === "couple" && ps.length === 1) return [ps[0], newPerson("female")];
      if (m === "single") return [ps[0]];
      return ps;
    });
  };

  // ----- per-person handlers -----
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
    if (mode === "couple" && persons.length === 2) {
      return { mode: "couple", ...computeCouple(cfg, persons, sharedNums) };
    }
    const single = computePerson(cfg, persons[0], sharedNums);
    return {
      mode: "single",
      single,
      household: {
        liability: single.liability,
        withheldTotal: single.withheldTotal,
        balance: single.balance,
        totalTaxable: single.totalTaxable,
        effRate: single.effRate,
      },
    };
  }, [cfg, persons, shared, mode]);

  const household = calc.household;
  const isRefund = household.balance >= 0;

  // Per-column balances shown as chips in couple mode.
  const chips = isCouple
    ? [
        ...persons.map((p, i) => ({
          name: personName(p, i, mode),
          balance: calc.spouses[i].balance,
        })),
        { name: "חישוב משותף", balance: calc.joint.balance },
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
            הכנסה מיגיעה אישית של כל בן זוג ממוסה בנפרד (מדרגות המס ונקודות הזיכוי
            שלו). הכנסה שאינה מיגיעה אישית (הון) מיוחסת לחישוב המשותף וממוסה לפי
            שיעור המס של בן הזוג בעל ההכנסה הגבוהה.
          </p>
        )}
      </div>

      {/* One card per taxpayer */}
      {persons.map((p, i) => (
        <PersonCard
          key={p.id}
          cfg={cfg}
          person={p}
          title={personName(p, i, mode)}
          showName={isCouple}
          capitalJoint={isCouple}
          pointValueNum={num(shared.pointValue)}
          onName={(v) => setPerson(p.id, { name: v })}
          onGender={(g) => setGender(p.id, g)}
          onPoints={(v) => setPerson(p.id, { points: v })}
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
            {ILS.format(household.withheldTotal)} · שיעור מס אפקטיבי{" "}
            {(household.effRate * 100).toFixed(1)}%
          </p>
        </div>

        {/* Per-column summary chips */}
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
            <span>פירוט חישוב המס</span>
            <span className="text-ink-soft">{showDetail ? "−" : "+"}</span>
          </button>
          {showDetail &&
            (isCouple ? (
              <CoupleBreakdown
                spouses={calc.spouses}
                joint={calc.joint}
                household={household}
                names={persons.map((p, i) => personName(p, i, mode))}
                surtaxRatePct={num(shared.surtaxRate)}
              />
            ) : (
              <PersonBreakdown r={calc.single} surtaxRatePct={num(shared.surtaxRate)} />
            ))}
        </div>

        {/* Editable assumptions (statutory, shared) */}
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

// ----- one taxpayer: personal details + their documents -----

function PersonCard({
  cfg,
  person,
  title,
  showName,
  capitalJoint,
  pointValueNum,
  onName,
  onGender,
  onPoints,
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

      {/* Documents */}
      <div className="mt-6">
        <h4 className="mb-1 font-bold text-ink">מסמכים והכנסות</h4>
        <p className="mb-4 text-sm text-ink-soft">
          טופס <span className="font-semibold text-ink">106</span> — משכורת והמס
          שנוכה; טופס <span className="font-semibold text-ink">867</span> — הכנסות
          מהון (ריבית, דיבידנד, רווחי הון) והמס שנוכה במקור; "מסמך אחר" — לכל הכנסה
          נוספת.
        </p>

        <div className="space-y-4">
          {person.docs.map((d, idx) => (
            <DocCard
              key={d.id}
              doc={d}
              index={idx}
              capitalJoint={capitalJoint}
              onChange={(patch) => onDocChange(d.id, patch)}
              onRemove={person.docs.length > 1 ? () => onRemoveDoc(d.id) : null}
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

// ----- breakdown: individual (single dl) -----

function PersonBreakdown({ r, surtaxRatePct }) {
  const refund = r.balance >= 0;
  return (
    <dl className="divide-y divide-slate-100 border-t border-slate-100 text-sm">
      <Row
        label="הכנסה חייבת מיגיעה אישית (106)"
        value={ILS.format(r.ordinaryIncome)}
      />
      <Row
        label="מס לפי מדרגות (לפני זיכויים)"
        value={ILS.format(r.ordinaryBracketTax)}
      />
      <Row label="זיכוי נקודות זיכוי" value={ILSminus(r.creditUsed)} />
      <Row
        label="מס על יגיעה אישית (אחרי זיכוי)"
        value={ILS.format(r.ordinaryAfterCredit)}
      />
      {r.capitalIncome > 0 && (
        <Row label="הכנסה מהון (867)" value={ILS.format(r.capitalIncome)} />
      )}
      {r.capitalLines.map((l) => (
        <Row
          key={l.id}
          muted
          label={`  ${categoryLabel(l.category)} — ${(l.rate * 100).toFixed(
            0
          )}% על ${ILS.format(l.income)}`}
          value={ILS.format(l.income * l.rate)}
        />
      ))}
      {r.capitalTax > 0 && (
        <Row label="סה״כ מס על הון" value={ILS.format(r.capitalTax)} />
      )}
      {r.surtax > 0 && (
        <Row
          label={`מס יסף (${surtaxRatePct}% מעל ${ILS.format(r.surtaxThreshold)})`}
          value={ILS.format(r.surtax)}
        />
      )}
      <Row label="סה״כ חבות מס" value={ILS.format(r.liability)} strong />
      <Row
        label="מס שנוכה במקור (106 + 867)"
        value={ILSminus(r.withheldTotal)}
      />
      <Row
        label={refund ? "החזר מס צפוי" : "יתרת מס לתשלום"}
        value={ILS.format(Math.abs(r.balance))}
        strong
      />
    </dl>
  );
}

// ----- breakdown: couple (columnar table) -----

const dash = { v: "—", cls: "text-ink-soft" };
const money = (x) => ({ v: ILS.format(x) });
const minus = (x) => ({ v: ILSminus(x) });
const balCell = (x) => ({
  v: ILS.format(Math.abs(x)),
  cls: `font-extrabold ${x >= 0 ? "text-brand-700" : "text-amber-700"}`,
});

function TR({ label, cells, strong, muted }) {
  return (
    <tr className={strong ? "bg-slate-50" : ""}>
      <td
        className={`whitespace-nowrap px-3 py-2 text-right ${
          strong ? "font-bold text-ink" : muted ? "text-ink-soft" : "text-ink"
        }`}
      >
        {label}
      </td>
      {cells.map((c, i) => {
        // A cell's own color class (dash / balance / deduction) fully controls
        // it; otherwise fall back to the row's strong/normal default so the two
        // never conflict.
        const cls =
          c.cls || (strong ? "font-extrabold text-brand-700" : "font-semibold text-ink");
        return (
          <td
            key={i}
            dir="rtl"
            className={`whitespace-nowrap px-3 py-2 text-center ${cls}`}
          >
            {c.v}
          </td>
        );
      })}
    </tr>
  );
}

function CoupleBreakdown({ spouses, joint, household, names, surtaxRatePct }) {
  const [s0, s1] = spouses;
  const hasSurtax = s0.surtax + s1.surtax + joint.surtax > 0.5;
  const higherName = names[joint.higherIdx];

  return (
    <div className="border-t border-slate-100">
      <div className="overflow-x-auto">
        <table dir="rtl" className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 text-right font-semibold text-ink">סעיף</th>
              <th className="px-3 py-2 text-center font-semibold text-ink">
                {names[0]}
              </th>
              <th className="px-3 py-2 text-center font-semibold text-ink">
                {names[1]}
              </th>
              <th className="px-3 py-2 text-center font-semibold text-ink">
                חישוב משותף
              </th>
              <th className="px-3 py-2 text-center font-semibold text-ink">סה״כ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <TR
              label="הכנסה מיגיעה אישית"
              cells={[
                money(s0.exertionIncome),
                money(s1.exertionIncome),
                dash,
                money(s0.exertionIncome + s1.exertionIncome),
              ]}
            />
            <TR
              label="מס לפי מדרגות (לפני זיכוי)"
              muted
              cells={[
                money(s0.ordinaryBracketTax),
                money(s1.ordinaryBracketTax),
                dash,
                dash,
              ]}
            />
            <TR
              label="זיכוי נקודות זיכוי"
              muted
              cells={[minus(s0.creditUsed), minus(s1.creditUsed), dash, dash]}
            />
            <TR
              label="מס על יגיעה אישית (אחרי זיכוי)"
              cells={[
                money(s0.ordinaryAfterCredit),
                money(s1.ordinaryAfterCredit),
                dash,
                money(s0.ordinaryAfterCredit + s1.ordinaryAfterCredit),
              ]}
            />
            <TR
              label="הכנסה שאינה מיגיעה אישית (הון)"
              cells={[dash, dash, money(joint.income), money(joint.income)]}
            />
            <TR
              label={`מס על הכנסה שאינה מיגיעה אישית (${(joint.rate * 100).toFixed(
                0
              )}%)`}
              cells={[dash, dash, money(joint.incomeTax), money(joint.incomeTax)]}
            />
            {hasSurtax && (
              <TR
                label={`מס יסף (${surtaxRatePct}%)`}
                cells={[
                  s0.surtax > 0.5 ? money(s0.surtax) : dash,
                  s1.surtax > 0.5 ? money(s1.surtax) : dash,
                  joint.surtax > 0.5 ? money(joint.surtax) : dash,
                  money(s0.surtax + s1.surtax + joint.surtax),
                ]}
              />
            )}
            <TR
              label="סה״כ חבות מס"
              strong
              cells={[
                money(s0.liability),
                money(s1.liability),
                money(joint.tax),
                money(household.liability),
              ]}
            />
            <TR
              label="מס שנוכה במקור"
              cells={[
                minus(s0.withheld),
                minus(s1.withheld),
                minus(joint.withheld),
                minus(household.withheldTotal),
              ]}
            />
            <TR
              label="החזר (+) / לתשלום (−)"
              strong
              cells={[
                balCell(s0.balance),
                balCell(s1.balance),
                balCell(joint.balance),
                balCell(household.balance),
              ]}
            />
          </tbody>
        </table>
      </div>
      <p className="px-3 py-3 text-xs text-ink-soft">
        ההכנסה שאינה מיגיעה אישית משויכת לחישוב המשותף וממוסה לפי שיעור המס השולי של{" "}
        {higherName} ({(joint.rate * 100).toFixed(0)}%). הערה: הכנסות הון עם שיעור
        מס מיוחד (דיבידנד/ריבית/רווח הון בשוק ההון) ממוסות בפועל בשיעור הקבוע בחוק —
        נשמח להתאים את החישוב לפי הצורך.
      </p>
    </div>
  );
}

// ----- a single document card, rendered per type -----

function DocCard({ doc, index, capitalJoint, onChange, onRemove, defaultRate }) {
  const title =
    doc.type === "106"
      ? "טופס 106 — משכורת"
      : doc.type === "867"
      ? "טופס 867 — הכנסות מהון"
      : "מסמך אחר";

  // In couple mode capital income is taxed jointly at the higher spouse's rate,
  // so the per-line rate field is hidden and replaced with a note.
  const jointCapitalNote = (
    <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-ink-soft">
      בחישוב זוגי: ממוסה בחישוב המשותף לפי שיעור המס של בן הזוג בעל ההכנסה הגבוהה.
    </p>
  );

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
          {capitalJoint ? (
            <div className="flex items-end">{jointCapitalNote}</div>
          ) : (
            <NumField
              label="שיעור מס"
              value={doc.rate}
              placeholder={String((defaultRate ?? 0.25) * 100)}
              suffix="%"
              asText
              hint="ברירת מחדל לפי סוג ההכנסה. ריבית על פיקדון שקלי לרוב 15%."
              onChange={(v) => onChange({ rate: v })}
            />
          )}
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
            {doc.kind === "capital" &&
              (capitalJoint ? (
                jointCapitalNote
              ) : (
                <NumField
                  label="שיעור מס"
                  value={doc.rate}
                  placeholder="25"
                  suffix="%"
                  asText
                  onChange={(v) => onChange({ rate: v })}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
}
