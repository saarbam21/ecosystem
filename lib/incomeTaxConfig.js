// Single source of truth for the income-tax calculator's statutory parameters.
//
// Mirrors lib/taxConfig.js: the numbers live in lib/incomeTaxParams.json
// (owner-editable, yearly), this module exposes the default config, pure
// calculation helpers that take a config object, and a client hook
// (useIncomeTaxConfig) that layers an optional localStorage override on top —
// used by the planned admin "parameters" page to preview edits before publish.

"use client";

import { useEffect, useState } from "react";
import params from "./incomeTaxParams.json";

export const INCOME_TAX_CONFIG_STORAGE_KEY = "ecosystem_income_tax_config_override";

// The canonical, published configuration.
export const DEFAULT_INCOME_TAX_CONFIG = params;

// Shallow-merge a partial override over the defaults. Tables (taxBrackets,
// capitalRates, ...) are replaced wholesale when present in the override.
export function mergeConfig(override) {
  if (!override || typeof override !== "object") return DEFAULT_INCOME_TAX_CONFIG;
  return { ...DEFAULT_INCOME_TAX_CONFIG, ...override };
}

export function loadOverride() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(INCOME_TAX_CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Returns the active config. On the server and the first client render it is the
// published default (so hydration matches); any saved admin override is applied
// after mount.
export function useIncomeTaxConfig() {
  const [config, setConfig] = useState(DEFAULT_INCOME_TAX_CONFIG);
  useEffect(() => {
    const override = loadOverride();
    if (override) setConfig(mergeConfig(override));
  }, []);
  return config;
}

// ---------- pure calculation helpers ----------

// מס הכנסה שנתי לפי מדרגות, על הכנסה חייבת שנתית מיגיעה אישית (לפני זיכויים).
export function annualIncomeTax(cfg, taxable) {
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

// מדרגת המס השולית (השיעור על השקל הבא) עבור הכנסה חייבת נתונה.
export function marginalRate(cfg, taxable) {
  let prev = 0;
  for (const b of cfg.taxBrackets) {
    const ceil = b.ceil == null ? Infinity : b.ceil;
    if (taxable <= ceil) return b.rate;
    prev = ceil;
  }
  return cfg.taxBrackets[cfg.taxBrackets.length - 1].rate;
}
