"use client";

import { useMemo, useState } from "react";
import { useMiluimConfig, computeMiluim } from "@/lib/miluimConfig";

const ILS = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

// Per-day rates can carry agorot (e.g. 133.33) — show them so the
// "days × rate" lines in the breakdown add up on screen.
const ILSrate = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 2,
});

function num(v) {
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

// ----- shared field components (matching IncomeTaxCalculator) -----

function NumField({ label, value, onChange, placeholder, suffix, asText, hint }) {
  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      )}
      <div className="relative">
        <input
          type={asText ? "text" : "number"}
          inputMode={asText ? "numeric" : "decimal"}
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
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="rtl"
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

function Toggle({ label, checked, onChange, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked ? "bg-brand-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            checked ? "-translate-x-5" : "-translate-x-0.5"
          }`}
        />
      </button>
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
      </span>
    </label>
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

function SectionTitle({ children }) {
  return <h3 className="mb-4 text-lg font-bold text-ink">{children}</h3>;
}

// ----- the calculator (single screen) -----

export default function MiluimCalculator() {
  const cfg = useMiluimConfig();

  const [grade, setGrade] = useState(cfg.specialComp.grades[0].k);
  const [days, setDays] = useState("60");
  const [combatant, setCombatant] = useState(false);
  const [combatGrant, setCombatGrant] = useState(false);
  const [familyGrant, setFamilyGrant] = useState(false);

  // Editable assumptions (rates), seeded from the published config.
  const [rates, setRates] = useState(() => ({
    lowerThreshold: String(cfg.specialComp.lowerThreshold),
    upperThreshold: String(cfg.specialComp.upperThreshold),
    basicRate: String(cfg.specialComp.basicRate),
    gradeRate: String(cfg.specialComp.grades[0].rate),
    pegRegular: String(cfg.personalExpensesGrant.regular),
    pegCombatant: String(cfg.personalExpensesGrant.combatant),
    familyAmount: String(cfg.familyGrant.amount),
  }));

  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showDetail, setShowDetail] = useState(true);

  // When the grade changes, refresh the editable grade-rate to that grade's
  // published default (unless the user has been editing it).
  const setGrade2 = (k) => {
    setGrade(k);
    const g = cfg.specialComp.grades.find((x) => x.k === k);
    if (g) setRates((r) => ({ ...r, gradeRate: String(g.rate) }));
  };

  // Build an effective config from the editable assumptions, then compute.
  const result = useMemo(() => {
    const effCfg = {
      ...cfg,
      specialComp: {
        ...cfg.specialComp,
        lowerThreshold: num(rates.lowerThreshold),
        upperThreshold: num(rates.upperThreshold),
        basicRate: num(rates.basicRate),
        grades: cfg.specialComp.grades.map((g) =>
          g.k === grade ? { ...g, rate: num(rates.gradeRate) } : g
        ),
      },
      personalExpensesGrant: {
        ...cfg.personalExpensesGrant,
        regular: num(rates.pegRegular),
        combatant: num(rates.pegCombatant),
      },
      familyGrant: { ...cfg.familyGrant, amount: num(rates.familyAmount) },
    };
    return computeMiluim(effCfg, { grade, days, combatant, combatGrant, familyGrant });
  }, [cfg, rates, grade, days, combatant, combatGrant, familyGrant]);

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="card">
        <SectionTitle>פרטי השירות</SectionTitle>

        <div className="grid gap-6 sm:grid-cols-2">
          <Select
            label="דרג (רמת פעילות היחידה)"
            value={grade}
            onChange={setGrade2}
            options={cfg.specialComp.grades}
          />
          <NumField
            label="מספר ימי מילואים בשנה"
            value={days}
            asText
            suffix="ימים"
            placeholder="0"
            onChange={setDays}
            hint={`התגמול המיוחד מחושב על ימים מעל ${num(rates.lowerThreshold)}; מעל ${num(
              rates.upperThreshold
            )} ימים לפי הדרג.`}
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Toggle
            label="משרת/ת במערך הלוחם"
            checked={combatant}
            onChange={setCombatant}
            hint="מגדיל את מענק ההוצאות האישיות."
          />
          <Toggle
            label="זכאי/ת למענק לחימה (תעסוקה מבצעית)"
            checked={combatGrant}
            onChange={setCombatGrant}
            hint="מדורג לפי טווחי ימים."
          />
          <Toggle
            label="זכאי/ת למענק משפחה"
            checked={familyGrant}
            onChange={setFamilyGrant}
            hint="לכל 10 ימי מילואים."
          />
        </div>
      </div>

      {/* Result */}
      <div className="card">
        <SectionTitle>תוצאה — סך התגמולים והמענקים</SectionTitle>

        <div className="rounded-2xl border-2 border-brand-200 bg-white p-5 text-center">
          <p className="text-sm text-ink-soft">סה״כ צפוי (פטור ממס)</p>
          <p className="mt-1 text-4xl font-extrabold text-brand-700">
            {ILS.format(result.total)}
          </p>
          <p className="mt-2 text-xs text-ink-soft">
            {result.days} ימי מילואים · {result.grade.t}
          </p>
        </div>

        {/* Breakdown */}
        <div className="mt-5 rounded-xl border border-slate-100">
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-ink"
          >
            <span>פירוט הרכיבים</span>
            <span className="text-ink-soft">{showDetail ? "−" : "+"}</span>
          </button>
          {showDetail && (
            <dl className="divide-y divide-slate-100 border-t border-slate-100 text-sm">
              <Row label="תגמול מיוחד — סה״כ" value={ILS.format(result.specialComp)} strong />
              {result.basicDays > 0 && (
                <Row
                  muted
                  label={`  תעריף בסיס — ${result.basicDays} ימים × ${ILSrate.format(
                    num(rates.basicRate)
                  )}`}
                  value={ILS.format(result.basicPay)}
                />
              )}
              {result.gradeDays > 0 && (
                <Row
                  muted
                  label={`  ${result.grade.t} — ${result.gradeDays} ימים × ${ILSrate.format(
                    num(rates.gradeRate)
                  )}`}
                  value={ILS.format(result.gradePay)}
                />
              )}

              {combatGrant && (
                <>
                  <Row label="מענק לחימה — סה״כ" value={ILS.format(result.combatGrant)} strong />
                  {result.combatBreakdown.map((t, i) => (
                    <Row
                      key={i}
                      muted
                      label={`  ימים ${t.from}–${t.to} × ${ILS.format(t.rate)}`}
                      value={ILS.format(t.pay)}
                    />
                  ))}
                </>
              )}

              <Row
                label={`מענק הוצאות אישיות — ${result.pegUnits} × ${ILS.format(result.pegRate)}`}
                value={ILS.format(result.personalExpenses)}
              />

              {familyGrant && (
                <Row
                  label={`מענק משפחה — ${result.fgUnits} × ${ILS.format(num(rates.familyAmount))}`}
                  value={ILS.format(result.familyGrant)}
                />
              )}

              <Row label="סה״כ צפוי" value={ILS.format(result.total)} strong />
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
            <span>הנחות ותעריפים (ניתן לעריכה) · מדיניות {cfg.year}</span>
            <span className="text-ink-soft">{showAssumptions ? "−" : "+"}</span>
          </button>
          {showAssumptions && (
            <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
              <NumField
                label="סף תחתון (ימים)"
                value={rates.lowerThreshold}
                asText
                onChange={(v) => setRates((r) => ({ ...r, lowerThreshold: v }))}
              />
              <NumField
                label="סף עליון (ימים)"
                value={rates.upperThreshold}
                asText
                onChange={(v) => setRates((r) => ({ ...r, upperThreshold: v }))}
              />
              <NumField
                label="תעריף בסיס לתגמול מיוחד"
                value={rates.basicRate}
                suffix="₪/יום"
                asText
                onChange={(v) => setRates((r) => ({ ...r, basicRate: v }))}
              />
              <NumField
                label={`תעריף ${result.grade.t}`}
                value={rates.gradeRate}
                suffix="₪/יום"
                asText
                onChange={(v) => setRates((r) => ({ ...r, gradeRate: v }))}
              />
              <NumField
                label="מענק הוצאות אישיות (רגיל, ל-10 ימים)"
                value={rates.pegRegular}
                suffix="₪"
                asText
                onChange={(v) => setRates((r) => ({ ...r, pegRegular: v }))}
              />
              <NumField
                label="מענק הוצאות אישיות (לוחם, ל-10 ימים)"
                value={rates.pegCombatant}
                suffix="₪"
                asText
                onChange={(v) => setRates((r) => ({ ...r, pegCombatant: v }))}
              />
              <NumField
                label="מענק משפחה (ל-10 ימים)"
                value={rates.familyAmount}
                suffix="₪"
                asText
                onChange={(v) => setRates((r) => ({ ...r, familyAmount: v }))}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
