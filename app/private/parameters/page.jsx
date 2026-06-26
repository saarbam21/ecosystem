"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_TAX_CONFIG,
  loadOverride,
  saveOverride,
  clearOverride,
} from "@/lib/taxConfig";

// Deep clone helper so edits never mutate the imported defaults.
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      {hint ? <span className="mb-1 block text-xs text-ink-soft">{hint}</span> : null}
      {children}
    </label>
  );
}

function NumberInput({ value, onChange, step = "any" }) {
  return (
    <input
      type="number"
      step={step}
      className={inputClass}
      value={value}
      onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
    />
  );
}

function RemoveButton({ onClick, title = "מחיקה" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
    >
      ×
    </button>
  );
}

function AddButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-brand-300 px-3 py-2 text-sm font-semibold text-brand-700 transition hover:border-brand-500 hover:bg-brand-50"
    >
      <span className="text-base leading-none">+</span>
      {children}
    </button>
  );
}

export default function ParametersPage() {
  // Start from published defaults so SSR/first render match; load any saved
  // preview override after mount.
  const [cfg, setCfg] = useState(() => clone(DEFAULT_TAX_CONFIG));
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const override = loadOverride();
    if (override) {
      setCfg({ ...clone(DEFAULT_TAX_CONFIG), ...override });
      setStatus("נטענה תצוגה מקדימה שמורה מהדפדפן הזה.");
    }
  }, []);

  // Update a top-level scalar.
  function setScalar(key, val) {
    setCfg((c) => ({ ...c, [key]: val }));
    setDirty(true);
  }
  // Update a nested {ceiling,rate}-style object field.
  function setNested(key, field, val) {
    setCfg((c) => ({ ...c, [key]: { ...c[key], [field]: val } }));
    setDirty(true);
  }
  function setDefault(field, val) {
    setCfg((c) => ({ ...c, defaults: { ...c.defaults, [field]: val } }));
    setDirty(true);
  }
  function setExemptYear(year, field, val) {
    setCfg((c) => ({
      ...c,
      exemptByYear: {
        ...c.exemptByYear,
        [year]: { ...c.exemptByYear[year], [field]: val },
      },
    }));
    setDirty(true);
  }
  function setBracket(i, field, val) {
    setCfg((c) => {
      const next = c.taxBrackets.map((b, idx) =>
        idx === i ? { ...b, [field]: val } : b,
      );
      return { ...c, taxBrackets: next };
    });
    setDirty(true);
  }
  function setCpi(monthKey, val) {
    setCfg((c) => ({
      ...c,
      cpiMonthly: { ...c.cpiMonthly, [monthKey]: val },
    }));
    setDirty(true);
  }
  function setWomen(year, val) {
    setCfg((c) => ({
      ...c,
      womenRetirementByBirthYear: {
        ...c.womenRetirementByBirthYear,
        [year]: val,
      },
    }));
    setDirty(true);
  }
  function setFutureRate(key, val) {
    setCfg((c) => ({
      ...c,
      futureExemptRates: { ...c.futureExemptRates, [key]: val },
    }));
    setDirty(true);
  }

  // ----- add / remove rows -----

  // Add a year to a year-keyed map, copying the latest year's shape as a
  // starting point. Refuses duplicates and non-4-digit years.
  function addExemptYear() {
    setCfg((c) => {
      const years = Object.keys(c.exemptByYear).sort();
      const next = String(Number(years[years.length - 1]) + 1);
      if (c.exemptByYear[next]) return c;
      const template = c.exemptByYear[years[years.length - 1]];
      return {
        ...c,
        exemptByYear: { ...c.exemptByYear, [next]: { ...template } },
      };
    });
    setDirty(true);
  }
  function addBracket() {
    setCfg((c) => ({
      ...c,
      taxBrackets: [...c.taxBrackets, { ceil: null, rate: 0 }],
    }));
    setDirty(true);
  }
  function removeBracket(i) {
    setCfg((c) => ({
      ...c,
      taxBrackets: c.taxBrackets.filter((_, idx) => idx !== i),
    }));
    setDirty(true);
  }

  function addCpiMonth() {
    setCfg((c) => {
      const keys = Object.keys(c.cpiMonthly).sort();
      const last = keys[keys.length - 1]; // "YYYY-MM"
      const [y, m] = last.split("-").map(Number);
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      const next = `${ny}-${String(nm).padStart(2, "0")}`;
      if (c.cpiMonthly[next] != null) return c;
      return {
        ...c,
        cpiMonthly: { ...c.cpiMonthly, [next]: c.cpiMonthly[last] },
      };
    });
    setDirty(true);
  }
  function addWomenYear() {
    setCfg((c) => {
      const years = Object.keys(c.womenRetirementByBirthYear).sort();
      const next = String(Number(years[years.length - 1]) + 1);
      if (c.womenRetirementByBirthYear[next] != null) return c;
      const template = c.womenRetirementByBirthYear[years[years.length - 1]];
      return {
        ...c,
        womenRetirementByBirthYear: {
          ...c.womenRetirementByBirthYear,
          [next]: template,
        },
      };
    });
    setDirty(true);
  }
  function removeWomenYear(year) {
    setCfg((c) => {
      const next = { ...c.womenRetirementByBirthYear };
      delete next[year];
      return { ...c, womenRetirementByBirthYear: next };
    });
    setDirty(true);
  }

  // ----- actions -----

  function preview() {
    saveOverride(cfg);
    setDirty(false);
    setStatus(
      "התצוגה המקדימה נשמרה. המחשבונים בדפדפן הזה יציגו כעת את הערכים החדשים.",
    );
  }

  function resetPreview() {
    clearOverride();
    setCfg(clone(DEFAULT_TAX_CONFIG));
    setDirty(false);
    setStatus("התצוגה המקדימה נמחקה. חזרה לערכים המפורסמים.");
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(cfg, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "taxParams.json";
    a.click();
    URL.revokeObjectURL(url);
    setStatus(
      "הקובץ taxParams.json הורד. החליפו אותו ב-lib/taxParams.json במאגר ובצעו commit + push כדי לפרסם.",
    );
  }

  const exemptYears = useMemo(
    () => Object.keys(cfg.exemptByYear).sort(),
    [cfg.exemptByYear],
  );
  const cpiKeys = useMemo(
    () => Object.keys(cfg.cpiMonthly).sort(),
    [cfg.cpiMonthly],
  );
  const womenYears = useMemo(
    () => Object.keys(cfg.womenRetirementByBirthYear).sort(),
    [cfg.womenRetirementByBirthYear],
  );
  const futureKeys = useMemo(
    () => Object.keys(cfg.futureExemptRates).sort(),
    [cfg.futureExemptRates],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">פרמטרים שנתיים</h1>
        <p className="mt-2 text-ink-soft">
          עריכת הערכים הקבועים בחוק של מחשבון הקצבה נטו. &quot;תצוגה מקדימה&quot;
          מחילה את השינויים במחשבונים בדפדפן הזה בלבד. &quot;ייצוא&quot; מוריד
          קובץ taxParams.json לפרסום במאגר.
        </p>
      </div>

      {/* sticky action bar */}
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3 backdrop-blur">
        <button onClick={preview} className="btn-primary">
          תצוגה מקדימה
        </button>
        <button onClick={exportJson} className="btn-outline">
          ייצוא קובץ לפרסום
        </button>
        <button
          onClick={resetPreview}
          className="text-sm font-semibold text-ink-soft hover:text-brand-700"
        >
          איפוס לערכים המפורסמים
        </button>
        {dirty ? (
          <span className="text-xs font-semibold text-amber-600">
            יש שינויים שלא נשמרו בתצוגה המקדימה
          </span>
        ) : null}
      </div>

      {status ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          {status}
        </div>
      ) : null}

      {/* scalars */}
      <section className="card space-y-4">
        <h2 className="text-lg font-bold text-ink">ערכים כלליים</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="תקרת קצבה מזכה נוכחית (ש''ח)">
            <NumberInput
              value={cfg.currentCeiling}
              onChange={(v) => setScalar("currentCeiling", v)}
            />
          </Field>
          <Field label="מקדם היוון (חודשים)">
            <NumberInput
              value={cfg.capitalDivisor}
              onChange={(v) => setScalar("capitalDivisor", v)}
            />
          </Field>
          <Field label="מקדם פיצויים">
            <NumberInput
              value={cfg.severanceFactor}
              onChange={(v) => setScalar("severanceFactor", v)}
            />
          </Field>
          <Field label="שיעור תקרת קיזוז פיצויים">
            <NumberInput
              value={cfg.severanceOffsetCapRate}
              onChange={(v) => setScalar("severanceOffsetCapRate", v)}
            />
          </Field>
          <Field label="תקרת שנות ותק לפיצויים">
            <NumberInput
              value={cfg.severanceYearsCap}
              onChange={(v) => setScalar("severanceYearsCap", v)}
            />
          </Field>
          <Field label="שנת תחילת טבלת הפטור">
            <NumberInput
              value={cfg.transitionBeforeYear}
              onChange={(v) => setScalar("transitionBeforeYear", v)}
            />
          </Field>
          <Field label="שנות הוראת מעבר">
            <NumberInput
              value={cfg.transitionYears}
              onChange={(v) => setScalar("transitionYears", v)}
            />
          </Field>
        </div>
      </section>

      {/* preTransition */}
      <section className="card space-y-4">
        <h2 className="text-lg font-bold text-ink">הוראת מעבר (לפני הטבלה)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="תקרה (ש''ח)">
            <NumberInput
              value={cfg.preTransition.ceiling}
              onChange={(v) => setNested("preTransition", "ceiling", v)}
            />
          </Field>
          <Field label="שיעור פטור (%)">
            <NumberInput
              value={cfg.preTransition.rate}
              onChange={(v) => setNested("preTransition", "rate", v)}
            />
          </Field>
        </div>
      </section>

      {/* defaults */}
      <section className="card space-y-4">
        <h2 className="text-lg font-bold text-ink">ברירות מחדל</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="ערך נקודת זיכוי (ש''ח)">
            <NumberInput
              value={cfg.defaults.pointValue}
              onChange={(v) => setDefault("pointValue", v)}
            />
          </Field>
          <Field label="נקודות זיכוי - גבר">
            <NumberInput
              value={cfg.defaults.pointsMale}
              onChange={(v) => setDefault("pointsMale", v)}
            />
          </Field>
          <Field label="נקודות זיכוי - אישה">
            <NumberInput
              value={cfg.defaults.pointsFemale}
              onChange={(v) => setDefault("pointsFemale", v)}
            />
          </Field>
          <Field label="הצמדה עתידית (%)">
            <NumberInput
              value={cfg.defaults.indexFuture}
              onChange={(v) => setDefault("indexFuture", v)}
            />
          </Field>
        </div>
      </section>

      {/* future exempt rates */}
      <section className="card space-y-4">
        <h2 className="text-lg font-bold text-ink">שיעורי פטור צפויים</h2>
        <p className="text-xs text-ink-soft">
          לשנים שאחרי הטבלה. המפתח &quot;default&quot; חל על כל שנה ללא ערך ייעודי.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {futureKeys.map((k) => (
            <Field key={k} label={k === "default" ? "ברירת מחדל (%)" : `${k} (%)`}>
              <NumberInput
                value={cfg.futureExemptRates[k]}
                onChange={(v) => setFutureRate(k, v)}
              />
            </Field>
          ))}
        </div>
      </section>

      {/* exemptByYear table */}
      <section className="card space-y-4">
        <h2 className="text-lg font-bold text-ink">תקרה ושיעור פטור לפי שנה</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-right text-ink-soft">
                <th className="py-2 pe-4 font-semibold">שנה</th>
                <th className="py-2 pe-4 font-semibold">תקרה (ש''ח)</th>
                <th className="py-2 font-semibold">שיעור (%)</th>
              </tr>
            </thead>
            <tbody>
              {exemptYears.map((y) => (
                <tr key={y} className="border-b border-slate-100">
                  <td className="py-2 pe-4 font-semibold text-ink">{y}</td>
                  <td className="py-2 pe-4">
                    <NumberInput
                      value={cfg.exemptByYear[y].ceiling}
                      onChange={(v) => setExemptYear(y, "ceiling", v)}
                    />
                  </td>
                  <td className="py-2">
                    <NumberInput
                      value={cfg.exemptByYear[y].rate}
                      onChange={(v) => setExemptYear(y, "rate", v)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AddButton onClick={addExemptYear}>הוספת שנה</AddButton>
      </section>

      {/* tax brackets */}
      <section className="card space-y-4">
        <h2 className="text-lg font-bold text-ink">מדרגות מס הכנסה (חודשי)</h2>
        <p className="text-xs text-ink-soft">
          תקרה ריקה במדרגה האחרונה = ללא תקרה. השיעור כשבר עשרוני (0.1 = 10%).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-right text-ink-soft">
                <th className="py-2 pe-4 font-semibold">תקרת המדרגה (ש''ח)</th>
                <th className="py-2 pe-4 font-semibold">שיעור (0-1)</th>
                <th className="py-2 font-semibold" aria-label="מחיקה"></th>
              </tr>
            </thead>
            <tbody>
              {cfg.taxBrackets.map((b, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 pe-4">
                    <input
                      type="number"
                      step="any"
                      placeholder="ללא תקרה"
                      className={inputClass}
                      value={b.ceil == null ? "" : b.ceil}
                      onChange={(e) =>
                        setBracket(
                          i,
                          "ceil",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    />
                  </td>
                  <td className="py-2 pe-4">
                    <NumberInput
                      value={b.rate}
                      onChange={(v) => setBracket(i, "rate", v)}
                    />
                  </td>
                  <td className="py-2">
                    <RemoveButton onClick={() => removeBracket(i)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AddButton onClick={addBracket}>הוספת מדרגה</AddButton>
      </section>

      {/* women retirement */}
      <section className="card space-y-4">
        <h2 className="text-lg font-bold text-ink">גיל פרישה לנשים לפי שנת לידה</h2>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {womenYears.map((y) => (
            <div key={y}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold text-ink">{y}</span>
                <RemoveButton onClick={() => removeWomenYear(y)} />
              </div>
              <NumberInput
                value={cfg.womenRetirementByBirthYear[y]}
                onChange={(v) => setWomen(y, v)}
              />
            </div>
          ))}
        </div>
        <AddButton onClick={addWomenYear}>הוספת שנת לידה</AddButton>
      </section>

      {/* CPI */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-ink">מדד המחירים לצרכן (חודשי)</h2>
          <a
            href="https://www.dekel.co.il/%D7%9E%D7%93%D7%93-%D7%94%D7%9E%D7%97%D7%99%D7%A8%D7%99%D7%9D-%D7%9C%D7%A6%D7%A8%D7%9B%D7%9F"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-50"
          >
            בדיקת המדד באתר דקל ↗
          </a>
        </div>
        <p className="text-xs text-ink-soft">
          לחיצה על &quot;הוספת חודש&quot; מוסיפה את החודש העוקב לחודש האחרון, עם
          ערך התחלתי שניתן לערוך. את ערך המדד ניתן לבדוק בקישור למעלה.
        </p>
        <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-100">
          <div className="grid gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4">
            {cpiKeys.map((k) => (
              <Field key={k} label={k}>
                <NumberInput
                  value={cfg.cpiMonthly[k]}
                  onChange={(v) => setCpi(k, v)}
                />
              </Field>
            ))}
          </div>
        </div>
        <AddButton onClick={addCpiMonth}>הוספת חודש</AddButton>

        <div className="mt-2 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-ink-soft">
          <h3 className="mb-2 font-bold text-ink">איך מפרסמים את השינויים?</h3>
          <ol className="list-decimal space-y-1 pe-5">
            <li>
              לוחצים על <span className="font-semibold">&quot;תצוגה מקדימה&quot;</span> ובודקים
              שהמחשבונים מציגים את הערכים הנכונים.
            </li>
            <li>
              לוחצים על <span className="font-semibold">&quot;ייצוא קובץ לפרסום&quot;</span> —
              הקובץ <code className="rounded bg-white px-1 font-mono">taxParams.json</code> יורד
              לתיקיית ההורדות.
            </li>
            <li>
              מעבירים את הקובץ לתוך תיקיית{" "}
              <code className="rounded bg-white px-1 font-mono">lib</code> של הפרויקט (מחליפים
              את הקובץ הקיים).
            </li>
            <li>
              לוחצים פעמיים על הקובץ{" "}
              <code className="rounded bg-white px-1 font-mono">publish.bat</code> שבתיקיית
              הפרויקט. הוא יעלה את השינוי ויפרסם אותם.
            </li>
            <li>כעבור כ-2 דקות האתר החי יציג את הערכים החדשים.</li>
          </ol>
        </div>
      </section>
    </div>
  );
}
