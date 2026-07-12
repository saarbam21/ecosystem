// Single source of truth for the reserve-duty (מילואים) grants calculator.
//
// Mirrors lib/incomeTaxConfig.js: the numbers live in lib/miluimParams.json
// (owner-editable, yearly), this module exposes the default config, a pure
// calculation helper that takes a config object, and a client hook
// (useMiluimConfig) that layers an optional localStorage override on top —
// used by the planned admin "parameters" page to preview edits before publish.
//
// Model follows the IDF 2026 policy (miluim.idf.il): every grant is
// differential by activity grade (מדרג), and each is paid per-day above a
// threshold (תגמול מיוחד from day 61; מענק הוצאות אישיות and מענק משפחה from
// day 41), plus one-time grants (מענק כלכלת הבית, מענק משפחה מיוחדת). The
// reserve pay itself (החזר שכר מביטוח לאומי) is a separate, taxable component.

"use client";

import { useEffect, useState } from "react";
import params from "./miluimParams.json";

export const MILUIM_CONFIG_STORAGE_KEY = "ecosystem_miluim_config_override";

// The canonical, published configuration.
export const DEFAULT_MILUIM_CONFIG = params;

// Shallow-merge a partial override over the defaults. Nested tables
// (specialComp, familyGrant, ...) are replaced wholesale when present.
export function mergeConfig(override) {
  if (!override || typeof override !== "object") return DEFAULT_MILUIM_CONFIG;
  return { ...DEFAULT_MILUIM_CONFIG, ...override };
}

export function loadOverride() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MILUIM_CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Returns the active config. On the server and the first client render it is the
// published default (so hydration matches); any saved admin override is applied
// after mount.
export function useMiluimConfig() {
  const [config, setConfig] = useState(DEFAULT_MILUIM_CONFIG);
  useEffect(() => {
    const override = loadOverride();
    if (override) setConfig(mergeConfig(override));
  }, []);
  return config;
}

// ---------- pure calculation helper ----------

// חישוב תגמולי המילואים והמענקים לפי מדרג פעילות ומספר ימי השירות בשנה.
//
// input = { grade, days, familyGrant, specialFamily, reserveSalary }
//   grade         — מפתח המדרג (k) מתוך grades
//   days          — סך ימי המילואים המזכים בשנה (כולל ימי צו 8 מ-7.10.23, לפי המדיניות)
//   familyGrant   — הורה לילד עד גיל 14 (זכאות למענק משפחה מוגדל)
//   specialFamily — הורה לילד עם צרכים מיוחדים (זכאות למענק משפחה מיוחדת)
//   reserveSalary — שכר ברוטו חודשי, לחישוב התגמול היומי
export function computeMiluim(cfg, input) {
  const days = Math.max(0, Math.floor(num(input.days)));
  const grade = cfg.grades.find((g) => g.k === input.grade) ?? cfg.grades[0];
  const gk = grade.k;

  // ----- תגמול המילואים (החזר שכר מביטוח לאומי) — חייב במס -----
  // תגמול יומי = שכר ברוטו חודשי / 30 (שווה־ערך לשכר רבע־שנתי / 90), בכפוף
  // למינימום ולמקסימום. שכר נמוך מהמינימום (או ריק) מזכה בתגמול המינימלי.
  const rp = cfg.reservePay ?? { minDaily: 0, maxDaily: Infinity, monthlyDivisor: 30 };
  const rawDaily = num(input.reserveSalary) / (num(rp.monthlyDivisor) || 30);
  const reserveDaily = Math.min(Math.max(rawDaily, num(rp.minDaily)), num(rp.maxDaily));
  const reservePay = reserveDaily * days;

  // Days served strictly above a threshold day (paid "from day N" ⇒ N-1 free).
  const daysFrom = (fromDay) => Math.max(0, days - (num(fromDay) - 1));

  // ----- תגמול מיוחד — יומי מהיום ה-61, לפי מדרג -----
  const scRate = num(cfg.specialComp.rates[gk]);
  const specialDays = daysFrom(cfg.specialComp.fromDay);
  const specialComp = specialDays * scRate;

  // ----- מענק הוצאות אישיות — יומי מהיום ה-41, לפי מדרג -----
  const peRate = num(cfg.personalExpenses.rates[gk]);
  const peDays = daysFrom(cfg.personalExpenses.fromDay);
  const personalExpenses = peDays * peRate;

  // ----- מענק משפחה מוגדל — יומי מהיום ה-41, לפי מדרג (הורה לילד עד גיל 14) -----
  const fgRate = num(cfg.familyGrant.rates[gk]);
  const fgDays = input.familyGrant ? daysFrom(cfg.familyGrant.fromDay) : 0;
  const familyGrant = fgDays * fgRate;

  // ----- מענק כלכלת הבית מוגדל — חד־פעמי, מדרגים א׳+/א׳/ב׳, מ-45 ימים -----
  const householdGrant =
    days >= num(cfg.householdGrant.minDays) ? num(cfg.householdGrant.amounts[gk] ?? 0) : 0;

  // ----- מענק משפחה מיוחדת — חד־פעמי, הורה לילד עם צרכים מיוחדים, מ-45 ימים -----
  const specialFamilyGrant =
    input.specialFamily && days >= num(cfg.specialFamilyGrant.minDays)
      ? num(cfg.specialFamilyGrant.amount)
      : 0;

  // ----- תגמול נוסף — חד־פעמי, מדורג לפי סך הימים בשנה (מכפלות נקודת זיכוי) -----
  // הסכום = מספר הנקודות של המדרגה הגבוהה ביותר שהתנאי שלה מתקיים × שווי נקודה.
  const ac = cfg.additionalComp;
  let acPoints = 0;
  for (const t of ac.tiers) if (days >= num(t.minDays)) acPoints = num(t.points);
  const additionalComp = acPoints * num(ac.pointValue);

  // ----- הטבות לא כספיות — מחושבות ומסוכמות בנפרד, לא נכללות בסך התגמול -----
  const benefit = computeBenefits(cfg.benefits, gk, days, !!input.familyGrant);

  // רכיבים שוטפים (משולמים במהלך השנה) מול מענקים חד־פעמיים (משולמים פעם בשנה).
  // התגמול המיוחד והתגמול הנוסף נצברים לפי יום אך משולמים פעם אחת, ולכן חד־פעמיים.
  const recurringTotal = reservePay + personalExpenses + familyGrant;
  const oneTimeTotal = specialComp + additionalComp + householdGrant + specialFamilyGrant;
  // סך המענקים הפטורים ממס, והתגמול (החזר שכר) חייב במס בנפרד.
  const grantsTotal =
    specialComp +
    additionalComp +
    personalExpenses +
    familyGrant +
    householdGrant +
    specialFamilyGrant;
  const total = recurringTotal + oneTimeTotal;
  const avgPerDay = days > 0 ? total / days : 0;

  return {
    days,
    grade,
    reserveDaily,
    reservePay,
    scRate,
    specialDays,
    specialComp,
    peRate,
    peDays,
    personalExpenses,
    fgRate,
    fgDays,
    familyGrant,
    householdGrant,
    specialFamilyGrant,
    acPoints,
    additionalComp,
    vacationVoucher: benefit.vacationVoucher,
    fighterWallet: benefit.fighterWallet,
    benefitsTotal: benefit.benefitsTotal,
    recurringTotal,
    oneTimeTotal,
    grantsTotal,
    total,
    avgPerDay,
  };
}

// הטבות לא כספיות (שובר נופש, ארנק פייטר) — ערכן מחושב לתצוגה בלבד ואינו נכלל
// בסך התגמול או בממוצע היומי.
function computeBenefits(benefits, gk, days, hasChild) {
  let vacationVoucher = 0;
  const vv = benefits?.vacationVoucher;
  const vg = vv?.byGrade?.[gk];
  if (vg && days >= num(vv.minDays)) {
    const base = hasChild ? num(vg.baseChild) : num(vg.base);
    const perDay = hasChild ? num(vg.perDayChild) : num(vg.perDay);
    const max = hasChild ? num(vg.maxChild) : num(vg.max);
    const suppDays = Math.max(0, Math.min(days, num(vv.supplementToDay)) - (num(vv.supplementFromDay) - 1));
    vacationVoucher = Math.min(base + perDay * suppDays, max);
  }

  let fighterWallet = 0;
  const fw = benefits?.fighterWallet;
  const fg = fw?.byGrade?.[gk];
  if (fg && Array.isArray(fg.tiers) && fg.tiers.length && days >= num(fw.minDays)) {
    let prev = 0;
    for (const t of fg.tiers) {
      const ceil = t.upto == null ? Infinity : num(t.upto);
      if (days <= prev) break;
      fighterWallet += (Math.min(days, ceil) - prev) * num(t.rate);
      prev = ceil;
    }
    fighterWallet = Math.min(fighterWallet, num(fg.max));
  }

  return { vacationVoucher, fighterWallet, benefitsTotal: vacationVoucher + fighterWallet };
}

function num(v) {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}
