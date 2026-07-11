// Single source of truth for the reserve-duty (מילואים) grants calculator.
//
// Mirrors lib/incomeTaxConfig.js: the numbers live in lib/miluimParams.json
// (owner-editable, yearly), this module exposes the default config, a pure
// calculation helper that takes a config object, and a client hook
// (useMiluimConfig) that layers an optional localStorage override on top —
// used by the planned admin "parameters" page to preview edits before publish.

"use client";

import { useEffect, useState } from "react";
import params from "./miluimParams.json";

export const MILUIM_CONFIG_STORAGE_KEY = "ecosystem_miluim_config_override";

// The canonical, published configuration.
export const DEFAULT_MILUIM_CONFIG = params;

// Shallow-merge a partial override over the defaults. Nested tables
// (specialComp, combatGrant, ...) are replaced wholesale when present.
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

// חישוב תגמולי המילואים והמענקים לפי דרג (רמת פעילות) ומספר ימי השירות בשנה.
//
// input = { grade, days, combatant, combatGrant, familyGrant, reserveMode, reserveSalary }
//   grade        — מפתח הדרג (k) מתוך specialComp.grades
//   days         — סך ימי המילואים בשנה הקלנדרית
//   combatant    — משרת במערך הלוחם (משפיע על מענק ההוצאות האישיות)
//   combatGrant  — זכאי למענק לחימה (תעסוקה מבצעית)
//   familyGrant  — זכאי למענק משפחה
//   reserveMode  — "salary" (תגמול לפי שכר) | "min" (תגמול מינימלי) | "none"
//   reserveSalary — שכר ברוטו חודשי, לחישוב התגמול היומי (mode "salary")
export function computeMiluim(cfg, input) {
  const days = Math.max(0, Math.floor(num(input.days)));
  const sc = cfg.specialComp;
  const grade = sc.grades.find((g) => g.k === input.grade) ?? sc.grades[0];

  // ----- תגמול המילואים (החזר שכר מביטוח לאומי) — חייב במס -----
  // תגמול יומי = שכר ברוטו חודשי / 30 (שווה־ערך לשכר רבע־שנתי / 90), בכפוף
  // למינימום ולמקסימום. במצב "min" משלמים את התגמול המינימלי.
  const rp = cfg.reservePay ?? { minDaily: 0, maxDaily: Infinity, monthlyDivisor: 30 };
  let reserveDaily = 0;
  if (input.reserveMode === "min") {
    reserveDaily = num(rp.minDaily);
  } else if (input.reserveMode === "salary") {
    const raw = num(input.reserveSalary) / (num(rp.monthlyDivisor) || 30);
    reserveDaily = Math.min(Math.max(raw, num(rp.minDaily)), num(rp.maxDaily));
  }
  const reservePay = reserveDaily * days;

  const lower = num(sc.lowerThreshold); // סף כניסה לתגמול המיוחד
  const upper = num(sc.upperThreshold); // עד כאן — התעריף הבסיסי; מעבר לו — לפי דרג

  // ----- תגמול מיוחד -----
  // ימים בטווח [סף תחתון, סף עליון] מזכים בתעריף הבסיסי; ימים מעבר לסף העליון
  // מזכים בתעריף הדרג. מתחת לסף התחתון אין תגמול מיוחד (רק תגמול רגיל מבט״ל).
  const basicDays = days >= lower ? Math.min(days, upper) - (lower - 1) : 0;
  const gradeDays = Math.max(0, days - upper);
  const basicPay = basicDays * num(sc.basicRate);
  const gradePay = gradeDays * num(grade.rate);
  const specialComp = basicPay + gradePay;

  // ----- מענק לחימה (תעסוקה מבצעית) — מדורג לפי טווחי ימים -----
  let combatGrant = 0;
  const combatBreakdown = [];
  if (input.combatGrant) {
    let prev = 0;
    for (const tier of cfg.combatGrant.tiers) {
      const ceil = tier.upto == null ? Infinity : num(tier.upto);
      if (days <= prev) break;
      const tierDays = Math.min(days, ceil) - prev;
      const pay = tierDays * num(tier.rate);
      combatGrant += pay;
      combatBreakdown.push({ from: prev + 1, to: Math.min(days, ceil), rate: num(tier.rate), pay });
      prev = ceil;
    }
  }

  // ----- מענק הוצאות אישיות — לכל 10 ימי מילואים -----
  const peg = cfg.personalExpensesGrant;
  const pegUnits = Math.floor(days / num(peg.per));
  const pegRate = input.combatant ? num(peg.combatant) : num(peg.regular);
  const personalExpenses = pegUnits * pegRate;

  // ----- מענק משפחה — לכל 10 ימי מילואים -----
  const fg = cfg.familyGrant;
  const fgUnits = input.familyGrant ? Math.floor(days / num(fg.per)) : 0;
  const familyGrant = fgUnits * num(fg.amount);

  // סך המענקים הפטורים ממס (התגמול המיוחד + המענקים), והתגמול (החזר שכר) בנפרד.
  const grantsTotal = specialComp + combatGrant + personalExpenses + familyGrant;
  const total = grantsTotal + reservePay;

  return {
    days,
    grade,
    basicDays,
    gradeDays,
    basicPay,
    gradePay,
    specialComp,
    combatGrant,
    combatBreakdown,
    pegUnits,
    pegRate,
    personalExpenses,
    fgUnits,
    familyGrant,
    reserveDaily,
    reservePay,
    grantsTotal,
    total,
  };
}

function num(v) {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}
