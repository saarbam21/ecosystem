"use client";

import { useState } from "react";

const ILS = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

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

// Legal retirement age (גיל פרישה) per Israeli law / Bituach Leumi.
// Men: 67. Women: rises gradually 62 -> 65 by year of birth.
const WOMEN_BY_BIRTH_YEAR = {
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

function legalRetirementAge(gender, currentAge) {
  if (gender === "male") return 67;
  const birthYear = new Date().getFullYear() - Math.round(num(currentAge));
  if (birthYear <= 1959) return 62;
  if (birthYear >= 1970) return 65;
  return WOMEN_BY_BIRTH_YEAR[birthYear] ?? 65;
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
  monthly: "",
  feeBalance: "0.5",
  feeDeposit: "1",
});

const newPerson = (label) => ({
  label,
  gender: "male",
  currentAge: 40,
  workStopAge: 67,
  retireAge: 67,
  retireLinked: true,
  annualReturn: 4,
  factor: 200,
  portfolios: [newPortfolio()],
});

function projectPerson(p) {
  const currentAge = num(p.currentAge);
  const retireAge = num(p.retireAge);
  // Contributions stop at work-stop age; afterwards the balance only grows.
  const workStop = Math.max(currentAge, Math.min(num(p.workStopAge), retireAge));
  const t1 = Math.max(0, workStop - currentAge); // years contributing
  const t2 = Math.max(0, retireAge - workStop); // years growth-only
  const n = Math.max(0, retireAge - currentAge);
  let total = 0;
  for (const f of p.portfolios) {
    const balance = num(f.balance);
    const netMonthly = num(f.monthly) * (1 - num(f.feeDeposit) / 100);
    const net = (num(p.annualReturn) - num(f.feeBalance)) / 100;
    const i = Math.pow(1 + net, 1 / 12) - 1;
    const months1 = t1 * 12;
    const fvBalanceAtStop = balance * Math.pow(1 + net, t1);
    const fvContribAtStop =
      Math.abs(i) < 1e-9
        ? netMonthly * months1
        : netMonthly * ((Math.pow(1 + i, months1) - 1) / i);
    const fvAtRetire = (fvBalanceAtStop + fvContribAtStop) * Math.pow(1 + net, t2);
    total += fvAtRetire;
  }
  const factor = num(p.factor) || 1;
  const pension = total / factor;
  return { n, total, pension };
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

function NumField({ label, value, onChange, placeholder, suffix, thousands, center }) {
  const handle = (e) =>
    onChange(thousands ? formatThousands(e.target.value) : e.target.value);
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      <div className="relative">
        <input
          type={thousands ? "text" : "number"}
          inputMode={thousands ? "numeric" : "decimal"}
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
    </div>
  );
}

function PersonPanel({ person, onChange, showLabel }) {
  const set = (patch) => onChange({ ...person, ...patch });
  const setPortfolio = (id, patch) =>
    set({
      portfolios: person.portfolios.map((f) =>
        f.id === id ? { ...f, ...patch } : f
      ),
    });
  const addPortfolio = () =>
    set({ portfolios: [...person.portfolios, newPortfolio()] });
  const removePortfolio = (id) =>
    set({ portfolios: person.portfolios.filter((f) => f.id !== id) });

  const res = projectPerson(person);
  const legal = legalRetirementAge(person.gender, person.currentAge);

  // Constraints: work-stop >= current age; retirement >= 60.
  const setGender = (gender) => {
    const w = Math.max(num(person.currentAge), legalRetirementAge(gender, person.currentAge));
    set({ gender, workStopAge: w, retireAge: Math.max(60, w), retireLinked: true });
  };
  const setCurrentAge = (v) => {
    const w = Math.max(v, legalRetirementAge(person.gender, v));
    set({ currentAge: v, workStopAge: w, retireAge: Math.max(60, w), retireLinked: true });
  };
  // Retirement mirrors work-stop by default; dragging retirement decouples it.
  const setWorkStopAge = (v) => {
    const w = Math.max(num(person.currentAge), v);
    if (person.retireLinked) set({ workStopAge: w, retireAge: Math.max(60, w) });
    else set({ workStopAge: w });
  };
  const setRetireAge = (v) =>
    set({ retireLinked: false, retireAge: Math.max(60, v) });

  return (
    <div className="card">
      {showLabel && (
        <h3 className="mb-4 text-lg font-bold text-ink">
          {person.gender === "male" ? "בן זוג" : "בת זוג"}
        </h3>
      )}

      {/* Gender */}
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
              onClick={() => setGender(o.k)}
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
      </div>

      <div className="space-y-5">
        <Slider
          label="גיל נוכחי"
          value={person.currentAge}
          min={18}
          max={80}
          onChange={setCurrentAge}
        />
        <div>
          <Slider
            label="גיל הפסקת עבודה"
            value={person.workStopAge}
            min={18}
            max={80}
            display={formatAge(person.workStopAge)}
            onChange={setWorkStopAge}
          />
          <p className="mt-1 text-xs text-ink-soft">
            מגיל זה ואילך לא מבוצעות הפקדות נוספות.
          </p>
        </div>
        <div>
          <Slider
            label="גיל פרישה (תחילת משיכת קצבה)"
            value={person.retireAge}
            min={18}
            max={80}
            display={formatAge(person.retireAge)}
            onChange={setRetireAge}
          />
          <p className="mt-1 text-xs text-ink-soft">
            גיל פרישה לפי חוק ({person.gender === "male" ? "גבר" : "אישה"}):{" "}
            <button
              type="button"
              onClick={() => set({ retireLinked: false, retireAge: legal })}
              className="font-semibold text-brand-700 hover:underline"
            >
              {formatAge(legal)}
            </button>
          </p>
        </div>
        <Slider
          label="תשואה שנתית צפויה"
          value={person.annualReturn}
          min={0}
          max={12}
          step={0.5}
          suffix="%"
          onChange={(v) => set({ annualReturn: v })}
        />
      </div>

      {/* Portfolios */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-bold text-ink">התיקים שלי</h4>
          <button
            type="button"
            onClick={addPortfolio}
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            + הוספת תיק
          </button>
        </div>

        <div className="space-y-4">
          {person.portfolios.map((f, idx) => (
            <div key={f.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <input
                  type="text"
                  value={f.name}
                  placeholder={`תיק ${idx + 1} (לדוגמה: קרן פנסיה)`}
                  onChange={(e) => setPortfolio(f.id, { name: e.target.value })}
                  className="w-full max-w-[60%] rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                />
                {person.portfolios.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePortfolio(f.id)}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    הסרה
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumField
                  label="צבירה נוכחית"
                  value={f.balance}
                  placeholder="0"
                  suffix="₪"
                  thousands
                  onChange={(v) => setPortfolio(f.id, { balance: v })}
                />
                <NumField
                  label="הפקדה חודשית"
                  value={f.monthly}
                  placeholder="0"
                  suffix="₪"
                  thousands
                  onChange={(v) => setPortfolio(f.id, { monthly: v })}
                />
                <NumField
                  label="דמי ניהול מצבירה (שנתי)"
                  value={f.feeBalance}
                  placeholder="0"
                  suffix="%"
                  onChange={(v) => setPortfolio(f.id, { feeBalance: v })}
                />
                <NumField
                  label="דמי ניהול מהפקדה"
                  value={f.feeDeposit}
                  placeholder="0"
                  suffix="%"
                  onChange={(v) => setPortfolio(f.id, { feeDeposit: v })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Result: accumulation */}
      <div className="mt-6 rounded-xl bg-brand-50 p-4 text-center">
        <p className="text-sm text-ink-soft">
          צבירה צפויה בגיל פרישה (בעוד {res.n} שנים)
        </p>
        <p className="mt-1 text-2xl font-extrabold text-brand-700">
          {ILS.format(res.total)}
        </p>
      </div>

      {/* Pension conversion */}
      <div className="mt-5 flex justify-center">
        <div className="w-44 text-center">
          <NumField
            label="מקדם המרה לקצבה"
            value={person.factor}
            placeholder="200"
            center
            onChange={(v) => set({ factor: v })}
          />
        </div>
      </div>

      {/* Result: pension */}
      <div className="mt-5 rounded-xl border-2 border-brand-200 bg-white p-4 text-center">
        <p className="text-sm text-ink-soft">קצבה חודשית צפויה (ברוטו, לפני מס)</p>
        <p className="mt-1 text-3xl font-extrabold text-brand-700">
          {ILS.format(res.pension)}
        </p>
      </div>
    </div>
  );
}

export default function PensionCalculator() {
  const [mode, setMode] = useState("single");
  const [persons, setPersons] = useState([newPerson("בן/בת זוג 1")]);

  const setMode2 = (m) => {
    setMode(m);
    if (m === "couple" && persons.length === 1) {
      const p2 = newPerson();
      p2.gender = "female";
      p2.retireAge = legalRetirementAge("female", p2.currentAge);
      setPersons([persons[0], p2]);
    } else if (m === "single") {
      setPersons([persons[0]]);
    }
  };

  const updatePerson = (idx, next) =>
    setPersons(persons.map((p, i) => (i === idx ? next : p)));

  const results = persons.map(projectPerson);
  const totalAccum = results.reduce((s, r) => s + r.total, 0);
  const totalPension = results.reduce((s, r) => s + r.pension, 0);

  return (
    <div>
      {/* Mode toggle */}
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
          {[
            { k: "single", t: "יחיד" },
            { k: "couple", t: "זוג" },
          ].map((o) => (
            <button
              key={o.k}
              type="button"
              onClick={() => setMode2(o.k)}
              className={`rounded-full px-6 py-2 text-sm font-semibold transition ${
                mode === o.k
                  ? "bg-brand-700 text-white"
                  : "text-ink-soft hover:text-brand-700"
              }`}
            >
              {o.t}
            </button>
          ))}
        </div>
      </div>

      <div className={mode === "couple" ? "grid gap-6 lg:grid-cols-2" : ""}>
        {persons.map((p, idx) => (
          <PersonPanel
            key={idx}
            person={p}
            showLabel={mode === "couple"}
            onChange={(next) => updatePerson(idx, next)}
          />
        ))}
      </div>

      {/* Couple summary */}
      {mode === "couple" && (
        <div className="mt-6 overflow-hidden rounded-2xl bg-brand-700 p-6 text-center text-white">
          <h3 className="text-lg font-bold">סיכום משותף</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-brand-50/90">צבירה משותפת בפרישה</p>
              <p className="text-2xl font-extrabold">{ILS.format(totalAccum)}</p>
            </div>
            <div>
              <p className="text-sm text-brand-50/90">קצבה חודשית משותפת (ברוטו, לפני מס)</p>
              <p className="text-2xl font-extrabold">
                {ILS.format(totalPension)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
