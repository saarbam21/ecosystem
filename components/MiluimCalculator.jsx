"use client";

import { useMemo, useState } from "react";
import { useMiluimConfig, computeMiluim } from "@/lib/miluimConfig";

const ILS = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

// Per-day rates can carry agorot (e.g. 328.76) — show them so the
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

// Format a numeric string with thousands separators while typing.
function formatThousands(str) {
  const cleaned = String(str ?? "").replace(/[^\d.]/g, "");
  if (cleaned === "") return "";
  const [intPart, ...rest] = cleaned.split(".");
  const dec = rest.length ? "." + rest.join("") : "";
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + dec;
}

const MONTHS = [
  { k: "", t: "— בחרו חודש —" },
  { k: "1", t: "ינואר" },
  { k: "2", t: "פברואר" },
  { k: "3", t: "מרץ" },
  { k: "4", t: "אפריל" },
  { k: "5", t: "מאי" },
  { k: "6", t: "יוני" },
  { k: "7", t: "יולי" },
  { k: "8", t: "אוגוסט" },
  { k: "9", t: "ספטמבר" },
  { k: "10", t: "אוקטובר" },
  { k: "11", t: "נובמבר" },
  { k: "12", t: "דצמבר" },
];
const monthLabel = (k) => MONTHS.find((m) => m.k === k && k !== "")?.t ?? "";

// ----- shared field components (matching IncomeTaxCalculator) -----

function NumField({ label, value, onChange, placeholder, suffix, asText, thousands, hint }) {
  const handle = (e) =>
    onChange(thousands ? formatThousands(e.target.value) : e.target.value);
  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-ink">{label}</label>
      )}
      <div className="relative">
        <input
          type={asText || thousands ? "text" : "number"}
          inputMode="numeric"
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

// A breakdown line. `note` renders a muted sub-line (e.g. payment timing).
function Row({ label, value, strong, muted, note }) {
  return (
    <div className="flex items-start justify-between px-4 py-2.5">
      <dt className={strong ? "font-bold text-ink" : muted ? "text-ink-soft" : "text-ink"}>
        <span>{label}</span>
        {note && (
          <span className="mt-0.5 block text-xs font-normal text-ink-soft">{note}</span>
        )}
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

// A collapsible breakdown category. The header shows the subtotal so it stays
// informative when collapsed. Replaces the old static GroupHeader.
function Group({ title, subtotal, open, onToggle, muted, children }) {
  return (
    <div className="border-t border-slate-100 first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-2 text-right"
      >
        <span className="text-xs font-bold text-ink-soft">{title}</span>
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span
            dir="rtl"
            className={`text-sm font-extrabold ${muted ? "text-ink-soft" : "text-brand-700"}`}
          >
            {subtotal}
          </span>
          <span className="w-3 text-center text-ink-soft">{open ? "−" : "+"}</span>
        </span>
      </button>
      {open && <dl className="divide-y divide-slate-100 border-t border-slate-100">{children}</dl>}
    </div>
  );
}

// The grand-total line (not inside a group).
function TotalRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-t-2 border-slate-200 px-4 py-3">
      <span className="font-bold text-ink">{label}</span>
      <span dir="rtl" className="font-extrabold text-brand-700">
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h3 className="mb-4 text-lg font-bold text-ink">{children}</h3>;
}

// ----- the calculator (single screen) -----

export default function MiluimCalculator() {
  const cfg = useMiluimConfig();

  const [grade, setGrade] = useState(cfg.grades[0].k);
  const [days, setDays] = useState("60");
  const [familyGrant, setFamilyGrant] = useState(false);
  const [specialFamily, setSpecialFamily] = useState(false);

  // Reserve pay (income replacement) — always by salary; below-minimum is
  // topped up to the minimum automatically.
  const [reserveSalary, setReserveSalary] = useState("");

  // Optional per-month drill-down.
  const [monthlyOn, setMonthlyOn] = useState(false);
  const [monthName, setMonthName] = useState("");
  const [cumEnd, setCumEnd] = useState("");
  const [monthDays, setMonthDays] = useState("");

  // Editable assumptions — the selected grade's rates, seeded from the config.
  const seedRates = (g) => ({
    specialRate: String(cfg.specialComp.rates[g]),
    peRate: String(cfg.personalExpenses.rates[g]),
    familyRate: String(cfg.familyGrant.rates[g]),
    householdAmount: String(cfg.householdGrant.amounts[g] ?? 0),
    minDaily: String(cfg.reservePay.minDaily),
    maxDaily: String(cfg.reservePay.maxDaily),
  });
  const [rates, setRates] = useState(() => seedRates(cfg.grades[0].k));

  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showDetail, setShowDetail] = useState(true);

  // Per-category open/close within the breakdown (keeps a crowded list tidy).
  const [openGroups, setOpenGroups] = useState({
    recurring: false,
    oneTime: false,
    benefits: false,
    mRecurring: false,
    mOneTime: false,
    mBenefits: false,
  });
  const toggleGroup = (k) => setOpenGroups((g) => ({ ...g, [k]: !g[k] }));

  // Changing the grade re-seeds the editable rates to that grade's defaults.
  const setGrade2 = (k) => {
    setGrade(k);
    setRates(seedRates(k));
  };

  // Effective config: override the selected grade's rates with the edited ones.
  const effCfg = useMemo(
    () => ({
      ...cfg,
      specialComp: {
        ...cfg.specialComp,
        rates: { ...cfg.specialComp.rates, [grade]: num(rates.specialRate) },
      },
      personalExpenses: {
        ...cfg.personalExpenses,
        rates: { ...cfg.personalExpenses.rates, [grade]: num(rates.peRate) },
      },
      familyGrant: {
        ...cfg.familyGrant,
        rates: { ...cfg.familyGrant.rates, [grade]: num(rates.familyRate) },
      },
      householdGrant: {
        ...cfg.householdGrant,
        amounts: { ...cfg.householdGrant.amounts, [grade]: num(rates.householdAmount) },
      },
      reservePay: {
        ...cfg.reservePay,
        minDaily: num(rates.minDaily),
        maxDaily: num(rates.maxDaily),
      },
    }),
    [cfg, rates, grade]
  );

  const input = { grade, days, familyGrant, specialFamily, reserveSalary };

  const result = useMemo(
    () => computeMiluim(effCfg, input),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effCfg, grade, days, familyGrant, specialFamily, reserveSalary]
  );

  // A specific month's share = the marginal compensation of the days served
  // that month, given their position in the yearly cumulative count:
  // compute(days through end of month) − compute(days before the month). This
  // attributes the day-41/day-61 thresholds and one-time grants to the right
  // month automatically, and gives the day-count that fell into each band.
  const monthly = useMemo(() => {
    if (!monthlyOn) return null;
    const base = { grade, familyGrant, specialFamily, reserveSalary };
    const end = Math.max(0, Math.floor(num(cumEnd) || num(days)));
    const m = Math.max(0, Math.floor(num(monthDays)));
    const start = Math.max(0, end - m);
    const full = computeMiluim(effCfg, { ...base, days: end });
    const before = computeMiluim(effCfg, { ...base, days: start });
    const d = (k) => full[k] - before[k];
    const reservePay = d("reservePay");
    const specialComp = d("specialComp");
    const personalExpenses = d("personalExpenses");
    const familyGrantV = d("familyGrant");
    const householdGrant = d("householdGrant");
    const specialFamilyGrant = d("specialFamilyGrant");
    const additionalComp = d("additionalComp");
    const vacationVoucher = d("vacationVoucher");
    const fighterWallet = d("fighterWallet");
    const recurringTotal = reservePay + personalExpenses + familyGrantV;
    const oneTimeTotal = specialComp + additionalComp + householdGrant + specialFamilyGrant;
    const total = recurringTotal + oneTimeTotal;
    const mdays = end - start;
    return {
      days: mdays,
      reserveDaily: full.reserveDaily,
      reservePay,
      specialDays: d("specialDays"),
      scRate: full.scRate,
      specialComp,
      peDays: d("peDays"),
      peRate: full.peRate,
      personalExpenses,
      fgDays: d("fgDays"),
      fgRate: full.fgRate,
      familyGrant: familyGrantV,
      householdGrant,
      specialFamilyGrant,
      additionalComp,
      vacationVoucher,
      fighterWallet,
      benefitsTotal: vacationVoucher + fighterWallet,
      recurringTotal,
      oneTimeTotal,
      total,
      avgPerDay: mdays > 0 ? total / mdays : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyOn, cumEnd, monthDays, days, effCfg, grade, familyGrant, specialFamily, reserveSalary]);

  const hasOneTime = result.oneTimeTotal > 0;

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="card">
        <SectionTitle>פרטי השירות</SectionTitle>

        <div className="grid gap-6 sm:grid-cols-2">
          <Select
            label="מדרג פעילות (יחידה)"
            value={grade}
            onChange={setGrade2}
            options={cfg.grades}
          />
          <NumField
            label="ימי מילואים מזכים בשנה"
            value={days}
            asText
            suffix="ימים"
            placeholder="0"
            onChange={setDays}
            hint="לפי המדיניות, למניין הימים נספרים גם ימי צו 8 מ-7.10.23 ואילך."
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Toggle
            label="הורה לילד עד גיל 14"
            checked={familyGrant}
            onChange={setFamilyGrant}
            hint="זכאות למענק משפחה מוגדל (יומי מהיום ה-41)."
          />
          <Toggle
            label="הורה לילד עם צרכים מיוחדים"
            checked={specialFamily}
            onChange={setSpecialFamily}
            hint="מענק משפחה מיוחדת — חד־פעמי, מ-45 ימים."
          />
        </div>
      </div>

      {/* Reserve pay (income replacement) */}
      <div className="card">
        <SectionTitle>תשלום עבור ימי המילואים (תגמול)</SectionTitle>
        <p className="-mt-2 mb-4 text-sm text-ink-soft">
          תגמול המילואים מהמוסד לביטוח לאומי מחליף את השכר בימי השירות ומחושב לפי
          השכר. רכיב זה חייב במס (בשונה מהתגמול המיוחד והמענקים שפטורים).
        </p>

        <NumField
          label="שכר ברוטו חודשי"
          value={reserveSalary}
          suffix="₪"
          thousands
          placeholder="0"
          onChange={setReserveSalary}
          hint={`התגמול היומי = שכר חודשי ÷ ${num(cfg.reservePay.monthlyDivisor)}, בין ${ILS.format(
            num(rates.minDaily)
          )} ל-${ILS.format(num(rates.maxDaily))} ליום. שכר נמוך מהמינימום (או ריק) מחושב לפי התגמול המינימלי.`}
        />

        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-ink-soft">
          תגמול יומי:{" "}
          <span className="font-bold text-brand-700">{ILSrate.format(result.reserveDaily)}</span>{" "}
          × {result.days} ימים ={" "}
          <span className="font-bold text-brand-700">{ILS.format(result.reservePay)}</span>
        </p>
      </div>

      {/* Result */}
      <div className="card">
        <SectionTitle>תוצאה — סך התגמול והמענקים</SectionTitle>

        <div className="rounded-2xl border-2 border-brand-200 bg-white p-5 text-center">
          <p className="text-sm text-ink-soft">סה״כ צפוי (ברוטו)</p>
          <p className="mt-1 text-4xl font-extrabold text-brand-700">
            {ILS.format(result.total)}
          </p>
          <p className="mt-3 inline-block rounded-full bg-brand-50 px-4 py-1.5 text-sm font-bold text-brand-700">
            תגמול ממוצע ליום: {ILSrate.format(result.avgPerDay)}
          </p>
          <p className="mt-3 text-xs text-ink-soft">
            {result.days} ימי מילואים · {result.grade.t}
          </p>
          <p className="mt-2 text-xs text-ink-soft">
            תגמול (חייב במס) {ILS.format(result.reservePay)} · מענקים (פטורים){" "}
            {ILS.format(result.grantsTotal)}
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
            <div className="border-t border-slate-100 text-sm">
              <Group
                title="תגמולים ומענקים שוטפים"
                subtotal={ILS.format(result.recurringTotal)}
                open={openGroups.recurring}
                onToggle={() => toggleGroup("recurring")}
              >
                {result.reservePay > 0 && (
                  <Row
                    label={`תגמול המילואים — ${result.days} ימים × ${ILSrate.format(
                      result.reserveDaily
                    )} (חייב במס)`}
                    value={ILS.format(result.reservePay)}
                    note={cfg.reservePay.paidOn}
                  />
                )}
                {result.personalExpenses > 0 && (
                  <Row
                    label={`מענק הוצאות אישיות — ${result.peDays} ימים (מהיום ה-41) × ${ILS.format(
                      result.peRate
                    )}`}
                    value={ILS.format(result.personalExpenses)}
                    note={cfg.personalExpenses.paidOn}
                  />
                )}
                {result.familyGrant > 0 && (
                  <Row
                    label={`מענק משפחה מוגדל — ${result.fgDays} ימים × ${ILS.format(result.fgRate)}`}
                    value={ILS.format(result.familyGrant)}
                    note={cfg.familyGrant.paidOn}
                  />
                )}
              </Group>

              {hasOneTime && (
                <Group
                  title="מענקים חד־פעמיים (משולמים פעם בשנה)"
                  subtotal={ILS.format(result.oneTimeTotal)}
                  open={openGroups.oneTime}
                  onToggle={() => toggleGroup("oneTime")}
                >
                  {result.specialComp > 0 && (
                    <Row
                      label={`תגמול מיוחד — ${result.specialDays} ימים (מהיום ה-61) × ${ILS.format(
                        result.scRate
                      )}`}
                      value={ILS.format(result.specialComp)}
                      note={cfg.specialComp.paidOn}
                    />
                  )}
                  {result.additionalComp > 0 && (
                    <Row
                      label={`תגמול נוסף — ${result.acPoints} נק׳ זיכוי × ${ILS.format(
                        cfg.additionalComp.pointValue
                      )}`}
                      value={ILS.format(result.additionalComp)}
                      note={cfg.additionalComp.paidOn}
                    />
                  )}
                  {result.householdGrant > 0 && (
                    <Row
                      label="מענק כלכלת הבית מוגדל"
                      value={ILS.format(result.householdGrant)}
                      note={cfg.householdGrant.paidOn}
                    />
                  )}
                  {result.specialFamilyGrant > 0 && (
                    <Row
                      label="מענק משפחה מיוחדת"
                      value={ILS.format(result.specialFamilyGrant)}
                      note={cfg.specialFamilyGrant.paidOn}
                    />
                  )}
                </Group>
              )}

              <TotalRow label="סה״כ צפוי (ברוטו)" value={ILS.format(result.total)} />

              {result.benefitsTotal > 0 && (
                <Group
                  title="הטבות נוספות (לא כספיות · אינן נכללות בסך התגמול)"
                  subtotal={ILS.format(result.benefitsTotal)}
                  open={openGroups.benefits}
                  onToggle={() => toggleGroup("benefits")}
                  muted
                >
                  {result.vacationVoucher > 0 && (
                    <>
                      <Row
                        label="שובר נופש"
                        value={ILS.format(result.vacationVoucher)}
                        note={cfg.benefits.vacationVoucher.paidOn}
                      />
                      {result.vacationDetail && (
                        <Row
                          muted
                          label={`  בסיס ${ILS.format(result.vacationDetail.base)}${
                            result.vacationDetail.suppDays > 0
                              ? ` + ${ILS.format(result.vacationDetail.perDay)} × ${
                                  result.vacationDetail.suppDays
                                } ימים (${result.vacationDetail.from}–${result.vacationDetail.to})`
                              : ""
                          }${
                            result.vacationDetail.capped
                              ? ` · מוגבל לתקרה ${ILS.format(result.vacationDetail.max)}`
                              : ""
                          }`}
                          value=""
                        />
                      )}
                    </>
                  )}
                  {result.fighterWallet > 0 && (
                    <>
                      <Row
                        label="ארנק דיגיטלי (Fighter)"
                        value={ILS.format(result.fighterWallet)}
                        note={cfg.benefits.fighterWallet.paidOn}
                      />
                      {result.fighterDetail?.bands.map((b, i) => (
                        <Row
                          key={i}
                          muted
                          label={`  ימים ${b.from}–${b.to === Infinity ? "…" : b.to} × ${ILS.format(
                            b.rate
                          )}`}
                          value={ILS.format(b.pay)}
                        />
                      ))}
                      {result.fighterDetail?.capped && (
                        <Row
                          muted
                          label={`  מוגבל לתקרה ${ILS.format(result.fighterDetail.max)}`}
                          value=""
                        />
                      )}
                    </>
                  )}
                </Group>
              )}
            </div>
          )}
        </div>

        {/* Editable assumptions */}
        <div className="mt-3 rounded-xl border border-slate-100">
          <button
            type="button"
            onClick={() => setShowAssumptions((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-ink"
          >
            <span>הנחות ותעריפים (ניתן לעריכה) · {result.grade.t} · מדיניות {cfg.year}</span>
            <span className="text-ink-soft">{showAssumptions ? "−" : "+"}</span>
          </button>
          {showAssumptions && (
            <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2">
              <NumField
                label="תגמול מיוחד (יומי, מהיום ה-61)"
                value={rates.specialRate}
                suffix="₪/יום"
                asText
                onChange={(v) => setRates((r) => ({ ...r, specialRate: v }))}
              />
              <NumField
                label="מענק הוצאות אישיות (יומי, מהיום ה-41)"
                value={rates.peRate}
                suffix="₪/יום"
                asText
                onChange={(v) => setRates((r) => ({ ...r, peRate: v }))}
              />
              <NumField
                label="מענק משפחה מוגדל (יומי, מהיום ה-41)"
                value={rates.familyRate}
                suffix="₪/יום"
                asText
                onChange={(v) => setRates((r) => ({ ...r, familyRate: v }))}
              />
              <NumField
                label="מענק כלכלת הבית (חד־פעמי, מ-45 ימים)"
                value={rates.householdAmount}
                suffix="₪"
                asText
                onChange={(v) => setRates((r) => ({ ...r, householdAmount: v }))}
              />
              <NumField
                label="תגמול מילואים מינימלי (ביטוח לאומי)"
                value={rates.minDaily}
                suffix="₪/יום"
                asText
                onChange={(v) => setRates((r) => ({ ...r, minDaily: v }))}
              />
              <NumField
                label="תגמול מילואים מקסימלי (ביטוח לאומי)"
                value={rates.maxDaily}
                suffix="₪/יום"
                asText
                onChange={(v) => setRates((r) => ({ ...r, maxDaily: v }))}
              />
            </div>
          )}
        </div>
      </div>

      {/* Specific-month drill-down */}
      <div className="card">
        <div className="mb-2">
          <Toggle
            label="חישוב לחודש ספציפי"
            checked={monthlyOn}
            onChange={setMonthlyOn}
            hint="כמה מהתגמול מיוחס לחודש מסוים."
          />
        </div>

        {monthlyOn && (
          <>
            <p className="mb-4 mt-3 text-sm text-ink-soft">
              הזינו את סך ימי המילואים שנצברו מתחילת השנה עד תום החודש, ומתוכם כמה
              בוצעו בחודש עצמו. התגמול לחודש מחושב לפי מיקום הימים בצבירה השנתית —
              כך שספי היום ה-41 וה-61 והמענקים החד־פעמיים מיוחסים לחודש הנכון.
            </p>

            <div className="grid gap-6 sm:grid-cols-3">
              <Select label="חודש" value={monthName} onChange={setMonthName} options={MONTHS} />
              <NumField
                label="ימים שנצברו עד תום החודש"
                value={cumEnd}
                asText
                suffix="ימים"
                placeholder={String(num(days))}
                onChange={setCumEnd}
                hint="ברירת מחדל: סך הימים בשנה שלמעלה."
              />
              <NumField
                label="מתוכם, ימים בחודש זה"
                value={monthDays}
                asText
                suffix="ימים"
                placeholder="0"
                onChange={setMonthDays}
              />
            </div>

            <div className="mt-5 rounded-2xl border-2 border-brand-200 bg-white p-5 text-center">
              <p className="text-sm text-ink-soft">
                תגמול עבור {monthLabel(monthName) || "החודש"} (ברוטו)
              </p>
              <p className="mt-1 text-4xl font-extrabold text-brand-700">
                {ILS.format(monthly?.total || 0)}
              </p>
              <p className="mt-3 inline-block rounded-full bg-brand-50 px-4 py-1.5 text-sm font-bold text-brand-700">
                תגמול ממוצע ליום: {ILSrate.format(monthly?.avgPerDay || 0)}
              </p>
              <p className="mt-3 text-xs text-ink-soft">
                {monthly?.days || 0} ימים בחודש · {result.grade.t}
              </p>
            </div>

            {monthly && (monthly.total !== 0 || monthly.benefitsTotal !== 0) && (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-100 text-sm">
                <Group
                  title="שוטף (החודש)"
                  subtotal={ILS.format(monthly.recurringTotal)}
                  open={openGroups.mRecurring}
                  onToggle={() => toggleGroup("mRecurring")}
                >
                  {monthly.reservePay > 0 && (
                    <Row
                      label={`תגמול המילואים — ${monthly.days} ימים × ${ILSrate.format(
                        monthly.reserveDaily
                      )} (חייב במס)`}
                      value={ILS.format(monthly.reservePay)}
                    />
                  )}
                  {monthly.personalExpenses > 0 && (
                    <Row
                      label={`מענק הוצאות אישיות — ${monthly.peDays} ימים (מעל 40) × ${ILS.format(
                        monthly.peRate
                      )}`}
                      value={ILS.format(monthly.personalExpenses)}
                    />
                  )}
                  {monthly.familyGrant > 0 && (
                    <Row
                      label={`מענק משפחה מוגדל — ${monthly.fgDays} ימים × ${ILS.format(monthly.fgRate)}`}
                      value={ILS.format(monthly.familyGrant)}
                    />
                  )}
                </Group>

                {monthly.oneTimeTotal > 0 && (
                  <Group
                    title="השפעה על מענקים חד־פעמיים צפויים"
                    subtotal={ILS.format(monthly.oneTimeTotal)}
                    open={openGroups.mOneTime}
                    onToggle={() => toggleGroup("mOneTime")}
                  >
                    {monthly.specialComp > 0 && (
                      <Row
                        label={`תגמול מיוחד — ${monthly.specialDays} ימים (מעל 60) × ${ILS.format(
                          monthly.scRate
                        )}`}
                        value={ILS.format(monthly.specialComp)}
                        note={cfg.specialComp.paidOn}
                      />
                    )}
                    {monthly.householdGrant > 0 && (
                      <Row
                        label="מענק כלכלת הבית מוגדל (מזוכה החודש)"
                        value={ILS.format(monthly.householdGrant)}
                        note={cfg.householdGrant.paidOn}
                      />
                    )}
                    {monthly.additionalComp > 0 && (
                      <Row
                        label="תגמול נוסף (מזוכה החודש)"
                        value={ILS.format(monthly.additionalComp)}
                        note={cfg.additionalComp.paidOn}
                      />
                    )}
                    {monthly.specialFamilyGrant > 0 && (
                      <Row
                        label="מענק משפחה מיוחדת (מזוכה החודש)"
                        value={ILS.format(monthly.specialFamilyGrant)}
                        note={cfg.specialFamilyGrant.paidOn}
                      />
                    )}
                  </Group>
                )}

                <TotalRow label="סה״כ לחודש" value={ILS.format(monthly.total)} />

                {monthly.benefitsTotal > 0 && (
                  <Group
                    title="הטבות נוספות (לא כספיות · אינן נכללות בסך)"
                    subtotal={ILS.format(monthly.benefitsTotal)}
                    open={openGroups.mBenefits}
                    onToggle={() => toggleGroup("mBenefits")}
                    muted
                  >
                    {monthly.vacationVoucher > 0 && (
                      <Row label="שובר נופש (מזוכה החודש)" value={ILS.format(monthly.vacationVoucher)} />
                    )}
                    {monthly.fighterWallet > 0 && (
                      <Row label="ארנק דיגיטלי (Fighter)" value={ILS.format(monthly.fighterWallet)} />
                    )}
                  </Group>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
