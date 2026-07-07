import { useMemo } from "react";
import TrackerBoard, { BoardConfig } from "./TrackerBoard";

/* ─── formula helpers (recreated from the GB Creative Testing Tracker sheet) ─ */
const fmtDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); // "Oct 16, 2025"
};
const monthNum = (iso?: string) => {
  if (!iso) return "";
  const m = iso.slice(5, 7);
  return m ? String(parseInt(m, 10)) : "";
};

/* ─── board config ───────────────────────────────────────────────────────── */
const config: BoardConfig = {
  table: "creative_tests",
  title: "Testing Tracker",
  description: "Creative testing tracker · elke ad-test met auto-ID, samengestelde ad-namen en de metrics uit het ad-platform.",
  statusKey: "status",
  autoId: { key: "test_id", prefix: "CTT" },
  fields: [
    { key: "test_id",      label: "Test ID",      type: "readonly", w: "90px" },
    // Ad Set Name = TestID | Batch n | Product | Angle | Hook | Concept | Format | Editor | Date
    { key: "ad_set_name",  label: "Ad Set Name",  type: "computed", w: "minmax(300px,2fr)",
      compute: (r) => [
        r.test_id || "",
        "Batch " + (r.batch || 1),
        r.product_name || "",
        r.angle_id || "",
        r.hook_id || "",
        r.concept_id || "",
        r.ad_format || "",
        r.editor_name || "",
        fmtDate(r.date),
      ].join(" | ") },
    // Ad Name = TestID - Format
    { key: "ad_name",      label: "Ad Name",      type: "computed", w: "130px",
      compute: (r) => (r.test_id || "") + (r.ad_format ? " - " + r.ad_format : "") },
    { key: "batch",        label: "Batch",        type: "num",      w: "70px" },
    { key: "date",         label: "Date",         type: "date",     w: "110px" },
    // Month = month number from Date
    { key: "month",        label: "Month",        type: "computed", w: "70px",
      compute: (r) => monthNum(r.date) },
    { key: "editor_name",  label: "Editor Name",  type: "text",     w: "120px" },
    { key: "product_name", label: "Product Name", type: "text",     w: "140px" },
    { key: "hypothesis",   label: "Hypothesis",   type: "textarea", w: "minmax(220px,1.4fr)" },
    { key: "angle_id",     label: "Angle ID",     type: "select",   w: "110px", optionsKey: "angle_ids" },
    { key: "concept_id",   label: "Concept ID",   type: "select",   w: "115px", optionsKey: "concept_ids" },
    { key: "hook_id",      label: "Hook ID",      type: "select",   w: "105px", optionsKey: "hook_ids" },
    { key: "ad_copy_id",   label: "Ad copy ID",   type: "select",   w: "120px", optionsKey: "adcopy_ids" },
    { key: "lp_link",      label: "LP link",      type: "url",      w: "90px" },
    { key: "ad_format",    label: "Ad Format",    type: "select",   w: "110px",
      options: ["VID", "IMG", "GIF", "Carousel"],
      tones: { VID: "info", IMG: "idle", GIF: "info", Carousel: "idle" } },
    { key: "creative_link", label: "Creative link", type: "url",    w: "100px" },
    { key: "status",       label: "Status",       type: "select",   w: "120px",
      options: ["to_test", "testing", "tested", "killed"],
      tones: { to_test: "idle", testing: "info", tested: "ok", killed: "bad" } },
    { key: "result",       label: "Result",       type: "select",   w: "110px",
      options: ["win", "loss", "neutral"],
      tones: { win: "ok", loss: "bad", neutral: "idle" } },
    { key: "spent",        label: "Spent",        type: "eur",      w: "100px" },
    { key: "roas",         label: "ROAS",         type: "num",      w: "80px" },
    { key: "cr",           label: "CR",           type: "pct",      w: "80px" },
    { key: "aov",          label: "AOV",          type: "eur",      w: "90px" },
    { key: "ctr",          label: "CTR",          type: "pct",      w: "80px" },
    { key: "cpm",          label: "CPM",          type: "eur",      w: "90px" },
    { key: "cpc",          label: "CPC",          type: "eur",      w: "90px" },
    { key: "hook_rate",    label: "Hook Rate",    type: "pct",      w: "100px" },
    { key: "hold_rate",    label: "Hold Rate",    type: "pct",      w: "100px" },
    { key: "results",      label: "Results",      type: "textarea", w: "minmax(200px,1.2fr)" },
    { key: "learnings",    label: "Learnings",    type: "textarea", w: "minmax(280px,1.8fr)" },
  ],
};

/* ─── cross-reference codes from the creative studios ────────────────────── */
const readCodes = (table: string): string[] => {
  try {
    const raw = localStorage.getItem(`gb_${table}`);
    if (!raw) return [];
    return (JSON.parse(raw) as any[]).map((r) => r.code).filter(Boolean);
  } catch { return []; }
};
const AD_COPY_TABLES = [
  "ad_copies_most_aware", "ad_copies_product_aware", "ad_copies_solution_aware",
  "ad_copies_problem_aware", "ad_copies_unaware",
];

/* ─── page ───────────────────────────────────────────────────────────────── */
export default function TestingTracker() {
  const optionSets = useMemo(() => ({
    angle_ids: readCodes("creative_angles"),
    concept_ids: readCodes("creative_concepts"),
    hook_ids: readCodes("creative_hooks"),
    adcopy_ids: AD_COPY_TABLES.flatMap(readCodes),
  }), []);

  return <TrackerBoard config={config} optionSets={optionSets} />;
}
