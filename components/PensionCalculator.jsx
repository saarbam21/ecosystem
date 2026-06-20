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
  fee: "0.5",
});

const newPerson = (label) => ({
  label,
  gender: "male",
  currentAge: 40,
  retireAge: 67,
  annualReturn: 4,
  factor: 200,
  recognizedMode: "percent",
  recognizedValue: "",
  portfolios: [newPortfolio()],
});

function projectPerson(p) {
  const n = Math.max(0, num(p.retireAge) - num(p.currentAge));
  const months = n * 12;
  let total = 0;
  for (const f of p.portfolios) {
    const balance = num(f.balance);
    const monthly = num(f.monthly);
    const net = (num(p.annualReturn) - num(f.fee)) / 100;
    const i = Math.pow(1 + net, 1 / 12) - 1;
    const fvBalance = balance * Math.pow(1 + net, n);
    const fvContrib =
      Math.abs(i) < 1e-9
        ? monthly * months
        : monthly * ((Math.pow(1 + i, months) - 1) / i);
    total += fvBalance + fvContrib;
  }
  const factor = num(p.factor) || 1;
  const pension = total / factor;
  const recognizedAmount =
    p.recognizedMode === "percent"
      ? total * (num(p.recognizedValue) / 100)
      : Math.min(num(p.recognizedValue), total);
  const recognizedPension = recognizedAmount / factor;
  return { n, total, pension, recognizedPension };
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

function NumField({ label, value, onChange, placeholder, suffix }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          dir="ltr"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
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

  const setGender = (gender) =>
    set({ gender, retireAge: legalRetirementAge(gender, person.currentAge) });
  const setCurrentAge = (v) =>
    set({ currentAge: v, retireAge: legalRetirementAge(person.gender, v) });

  return (
    <div className="card">
      {showLabel && (
        <h3 className="mb-4 text-lg font-bold text-ink">{person.label}</h3>
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
          max={74}
          onChange={setCurrentAge}
        />
        <div>
          <Slider
            label="גיל פרישה"
            value={person.retireAge}
            min={60}
            max={75}
            display={formatAge(person.retireAge)}
            onChange={(v) => set({ retireAge: v })}
          />
          <p className="mt-1 text-xs text-ink-soft">
            גיל פרישה לפי חוק ({person.gender === "male" ? "גבר" : "אישה"}):{" "}
            <button
              type="button"
              onClick={() => set({ retireAge: legal })}
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
          step={0.1}
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
              <div className="grid gap-3 sm:grid-cols-3">
                <NumField
                  label="צבירה נוכחית"
                  value={f.balance}
                  placeholder="0"
                  suffix="₪"
                  onChange={(v) => setPortfolio(f.id, { balance: v })}
                />
                <NumField
                  label="הפקדה חודשית"
                  value={f.monthly}
                  placeholder="0"
                  suffix="₪"
                  onChange={(v) => setPortfolio(f.id, { monthly: v })}
                />
                <NumField
                  label="דמי ניהול (שנתי)"
                  value={f.fee}
                  placeholder="0"
                  suffix="%"
                  onChange={(v) => setPortfolio(f.id, { fee: v })}
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
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <NumField
          label="מקדם המרה לקצבה"
          value={person.factor}
          placeholder="200"
          onChange={(v) => set({ factor: v })}
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            קצבה מוכרת
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              dir="ltr"
              value={person.recognizedValue}
              placeholder="0"
              onChange={(e) => set({ recognizedValue: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-right outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <select
              value={person.recognizedMode}
              onChange={(e) => set({ recognizedMode: e.target.value })}
              className="rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-brand-500"
              aria-label="יחידת קצבה מוכרת"
            >
              <option value="percent">%</option>
              <option value="amount">₪</option>
            </select>
          </div>
        </div>
      </div>

      {/* Result: pension */}
      <div className="mt-5 rounded-xl border-2 border-brand-200 bg-white p-4 text-center">
        <p className="text-sm text-ink-soft">קצבה חודשית צפויה</p>
        <p className="mt-1 text-3xl font-extrabold text-brand-700">
          {ILS.format(res.pension)}
        </p>
        {res.recognizedPension > 0 && (
          <p className="mt-2 text-sm text-ink-soft">
            מתוכה קצבה מוכרת (פטורה ממס):{" "}
            <span className="font-bold text-ink">
              {ILS.format(res.recognizedPension)}
            </span>
          </p>
        )}
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
      setPersons([
        { ...persons[0], label: "בן/בת זוג 1" },
        newPerson("בן/בת זוג 2"),
      ]);
    } else if (m === "single") {
      setPersons([{ ...persons[0], label: "בן/בת זוג 1" }]);
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
              <p className="text-sm text-brand-50/90">קצבה חודשית משותפת</p>
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
