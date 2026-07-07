// Lightweight language detection for customer-research text.
// Uses franc-min (returns ISO 639-3) and maps to the ISO 639-1 codes we support.
import { franc } from "franc-min";
import ISO6391 from "iso-639-1";

export const SUPPORTED_LANGUAGES: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "nl", name: "Dutch" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "es", name: "Spanish" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "pl", name: "Polish" },
  { code: "sv", name: "Swedish" },
  { code: "da", name: "Danish" },
  { code: "no", name: "Norwegian" },
  { code: "fi", name: "Finnish" },
  { code: "tr", name: "Turkish" },
  { code: "ru", name: "Russian" },
];

// franc's ISO 639-3 → our ISO 639-1
const ISO3_TO_1: Record<string, string> = {
  eng: "en", nld: "nl", fra: "fr", deu: "de", spa: "es", ita: "it",
  por: "pt", pol: "pl", swe: "sv", dan: "da", nob: "no", nno: "no",
  fin: "fi", tur: "tr", rus: "ru",
};

/** Detect the ISO 639-1 language code of a piece of text. Falls back to "en". */
export function detectLanguage(text: string): string {
  if (!text || text.trim().length < 12) return "en";
  const guess = franc(text, { only: Object.keys(ISO3_TO_1) });
  if (guess === "und") return "en";
  return ISO3_TO_1[guess] ?? "en";
}

/** Human-readable name for an ISO 639-1 code. */
export function languageName(code: string): string {
  if (!code) return "Unknown";
  return ISO6391.getName(code) || code.toUpperCase();
}
