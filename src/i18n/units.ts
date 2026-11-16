import { signal } from "@preact/signals";

/** Whether distances and weights are shown in metric units, and the locale to format them in. */
export const metricUnits = signal(false);
export const unitLocale = signal("en");

/** The game's own conversion: 5 feet are 1.5 meters, a mile 1.5 kilometers, a pound half a kilo. */
const FEET_TO_METERS = 0.3;
const MILES_TO_KM = 1.5;
const POUNDS_TO_KG = 0.5;

function format(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

/** A weight typed in the units in use, as pounds. */
export const toPounds = (value: number, metric = metricUnits.value) =>
  metric ? value / POUNDS_TO_KG : value;

const amount = (text: string) => Number(text.replace(/,/g, ""));

/** Feet as a distance in the units in use: `30 ft` or `9 m`. */
export function distance(feet: number, metric = metricUnits.value, locale = unitLocale.value) {
  return metric ? `${format(feet * FEET_TO_METERS, locale)} m` : `${feet} ft`;
}

/** Pounds as a weight in the units in use: `12 lb` or `6 kg`. */
export function weight(pounds: number, metric = metricUnits.value, locale = unitLocale.value) {
  return metric ? `${format(pounds * POUNDS_TO_KG, locale)} kg` : `${format(pounds, locale)} lb`;
}

const FEET = /(\d[\d,]*(?:\.\d+)?)[- ]?(?:feet|foot|ft\b\.?)/gi;
const MILES = /(\d[\d,]*(?:\.\d+)?)[- ]?miles?\b/gi;
const POUNDS = /(\d[\d,]*(?:\.\d+)?)[- ]?(?:pounds?|lb\b)/gi;

/**
 * Rewrites the English distances and weights in a rules text ("60 feet", "5-foot radius",
 * "10 pounds") in metric units. Translated texts already use meters and match nothing here.
 */
export function convertText(text: string, metric = metricUnits.value, locale = unitLocale.value) {
  if (!metric) return text;
  return text
    .replace(FEET, (_, n: string) => `${format(amount(n) * FEET_TO_METERS, locale)} m`)
    .replace(MILES, (_, n: string) => `${format(amount(n) * MILES_TO_KM, locale)} km`)
    .replace(POUNDS, (_, n: string) => `${format(amount(n) * POUNDS_TO_KG, locale)} kg`);
}

/** A distance in feet as a number in the units asked for (meters when metric), the game's own way. */
export const feetTo = (feet: number, metric: boolean) => (metric ? feet * FEET_TO_METERS : feet);
/** A distance typed in the units asked for, as feet. */
export const feetFrom = (value: number, metric: boolean) =>
  metric ? value / FEET_TO_METERS : value;
/** A weight in pounds as a number in the units asked for (kilograms when metric). */
export const poundsTo = (pounds: number, metric: boolean) =>
  metric ? pounds * POUNDS_TO_KG : pounds;
