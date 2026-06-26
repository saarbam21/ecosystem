// Single source of truth for the net-pension calculator's statutory parameters.
//
// The numbers themselves live in lib/taxParams.json (owner-editable, yearly).
// This module exposes the default config, pure calculation helpers that take a
// config object, and a client hook (useTaxConfig) that layers an optional
// localStorage override on top — used by the admin "parameters" page to preview
// edits before they are published.

"use client";

import { useEffect, useState } from "react";
import params from "./taxParams.json";

export const TAX_CONFIG_STORAGE_KEY = "ecosystem_tax_config_override";

// The canonical, published configuration.
export const DEFAULT_TAX_CONFIG = params;

// ---------- override handling (admin preview, client only) ----------

// Shallow-merge a partial override over the defaults. Tables (exemptByYear,
// cpiMonthly, ...) are replaced wholesale when present in the override.
export function mergeConfig(override) {
  if (!override || typeof override !== "object") return DEFAULT_TAX_CONFIG;
  return { ...DEFAULT_TAX_CONFIG, ...override };
}

export function loadOverride() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TAX_CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveOverride(config) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TAX_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function clearOverride() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TAX_CONFIG_STORAGE_KEY);
}

// Returns the active config. On the server and the first client render it is the
// published default (so hydration matches); any saved admin override is applied
// after mount.
export function useTaxConfig() {
  const [config, setConfig] = useState(DEFAULT_TAX_CONFIG);
  useEffect(() => {
    const override = loadOverride();
    if (override) setConfig(mergeConfig(override));
  }, []);
  return config;
}

// ---------- pure calculation helpers ----------

// תקרת קצבה מזכה ושיעור הפטור לפי שנת הזכאות. התקרה אינה מוצמדת.
// לפני 2012 — שיעור הוראת מעבר; אחרי הטבלה — שיעורים צפויים (rateEstimate).
export function exemptForYear(cfg, year) {
  const y = Math.round(year);
  const years = Object.keys(cfg.exemptByYear).map(Number);
  const min = Math.min(...years);
  const max = Math.max(...years);
  if (y < min) return { ...cfg.preTransition, rateEstimate: false };
  if (y <= max) return { ...cfg.exemptByYear[y], rateEstimate: false };
  const rate = cfg.futureExemptRates[String(y)] ?? cfg.futureExemptRates.default;
  return { ceiling: cfg.currentCeiling, rate, rateEstimate: true };
}

// מס הכנסה חודשי לפי מדרגות, על הכנסה חייבת חודשית (לפני זיכויים).
export function incomeTaxMonthly(cfg, taxable) {
  let tax = 0;
  let prev = 0;
  for (const b of cfg.taxBrackets) {
    const ceil = b.ceil == null ? Infinity : b.ceil;
    if (taxable <= prev) break;
    const slice = Math.min(taxable, ceil) - prev;
    tax += slice * b.rate;
    prev = ceil;
  }
  return tax;
}

// רמת המדד לחודש "YYYY-MM", חסומה לטווח הידוע (ללא תחזית קדימה).
export function cpiAtMonth(cfg, monthKey) {
  const table = cfg.cpiMonthly;
  const keys = Object.keys(table);
  const first = keys[0];
  const lastKey = keys[keys.length - 1];
  if (table[monthKey] != null) return table[monthKey];
  if (!monthKey || monthKey < first) return table[first];
  if (monthKey > lastKey) return table[lastKey];
  let v = table[first];
  for (const k of keys) {
    if (k <= monthKey) v = table[k];
    else break;
  }
  return v;
}

// גיל פרישה חוקי — גברים 67; נשים עולה בהדרגה לפי שנת לידה.
export function legalRetirementAge(cfg, gender, birthYear) {
  if (gender === "male") return 67;
  if (birthYear <= 1959) return 62;
  if (birthYear >= 1970) return 65;
  return cfg.womenRetirementByBirthYear[birthYear] ?? 65;
}
