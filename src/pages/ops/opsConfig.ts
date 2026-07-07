// Shared configuration for all Operations record types.
// Single source of truth for field definitions, sections, titles, KPIs and status tones —
// consumed by RecordForm (create/edit), RecordDetail (read) and OrderDetail (related records).

import { fmtDate, fmtMoney } from "@/components/ops/ResourcePage";

export type OpsFieldType = "text" | "textarea" | "number" | "select" | "email" | "date";

export type OpsField = {
  key: string;
  label: string;
  type?: OpsFieldType;
  options?: string[];
  required?: boolean;
  defaultValue?: any;
  placeholder?: string;
  help?: string;
  full?: boolean; // span the full width of a two-column grid
};

export type OpsSection = {
  title: string;
  description?: string;
  fields: OpsField[];
};

export type Tone = "default" | "success" | "warn" | "danger";

export type OpsConfig = {
  table: string;
  label: string;        // singular, e.g. "Shipment"
  labelPlural: string;  // e.g. "Shipments"
  listPath: string;     // e.g. "/shipments"
  hasOrderLink: boolean;
  sections: OpsSection[];
  title: (row: any) => string;
  subtitle?: (row: any) => string;
  statusKey?: string;
  statusTone?: (v: any) => Tone;
  kpis?: (row: any) => { label: string; value: any }[];
  detailPath?: (id: string) => string; // override where the detail view lives (e.g. a custom page instead of /ops/:table/:id)
  /** Summary KPI cards computed from the full row set (list-view header). */
  metrics?: (rows: any[]) => { label: string; value: string | number; tone?: Tone }[];
  /** Column used to build status filter chips in the list view. */
  filterKey?: string;
};

const money = (n: number, c = "EUR") => fmtMoney(n, c);
const sumBy = (rows: any[], pred: (r: any) => boolean, key = "amount") =>
  rows.filter(pred).reduce((s, r) => s + Math.abs(Number(r[key] ?? 0)), 0);
const countBy = (rows: any[], pred: (r: any) => boolean) => rows.filter(pred).length;

/** Flatten every section's fields into a single list (for payload building / edit init). */
export function allFields(cfg: OpsConfig): OpsField[] {
  return cfg.sections.flatMap((s) => s.fields);
}

export const opsRegistry: Record<string, OpsConfig> = {
  orders: {
    table: "orders", label: "Order", labelPlural: "Orders", listPath: "/orders", hasOrderLink: false,
    sections: [
      {
        title: "Order",
        fields: [
          { key: "order_number", label: "Ordernummer", required: true, placeholder: "#1042" },
        ],
      },
      {
        title: "Klant",
        description: "Wie plaatste deze bestelling.",
        fields: [
          { key: "customer_name", label: "Naam", placeholder: "Voornaam Achternaam" },
          { key: "customer_email", label: "E-mail", type: "email", placeholder: "klant@voorbeeld.com" },
        ],
      },
      {
        title: "Status & fulfilment",
        fields: [
          { key: "status", label: "Betaalstatus", type: "select", options: ["open", "paid", "cancelled", "refunded"], defaultValue: "open" },
          { key: "fulfillment_status", label: "Fulfilment", type: "select", options: ["unfulfilled", "partial", "fulfilled"], defaultValue: "unfulfilled" },
        ],
      },
      {
        title: "Bedrag & verzending",
        fields: [
          { key: "total", label: "Totaal", type: "number", defaultValue: 0 },
          { key: "currency", label: "Munt", defaultValue: "EUR" },
          { key: "tracking_number", label: "Tracking nummer", full: true, placeholder: "bpost / DPD tracking" },
        ],
      },
      {
        title: "Notities",
        fields: [{ key: "notes", label: "Interne notitie", type: "textarea", full: true }],
      },
    ],
    title: (r) => r.order_number || "Order",
    subtitle: (r) => [r.customer_name, r.customer_email].filter(Boolean).join(" · "),
    statusKey: "status",
    statusTone: (v) => (v === "paid" ? "success" : v === "cancelled" ? "danger" : "warn"),
    kpis: (r) => [
      { label: "Totaal", value: fmtMoney(r.total, r.currency) },
      { label: "Status", value: r.status ?? "—" },
      { label: "Fulfilment", value: r.fulfillment_status ?? "—" },
    ],
    detailPath: (id) => `/orders/${id}`,
  },

  shipments: {
    table: "shipments", label: "Shipment", labelPlural: "Shipments", listPath: "/shipments", hasOrderLink: true,
    sections: [
      {
        title: "Vervoerder",
        fields: [
          { key: "carrier", label: "Carrier", placeholder: "bpost, DHL, DPD…" },
          { key: "tracking_number", label: "Tracking nummer" },
          { key: "status", label: "Status", type: "select", options: ["pending", "in_transit", "delivered", "failed", "returned"], defaultValue: "pending" },
        ],
      },
      {
        title: "Tijdlijn",
        fields: [
          { key: "shipped_at", label: "Verzonden op", type: "date" },
          { key: "delivered_at", label: "Geleverd op", type: "date" },
        ],
      },
      {
        title: "Notities",
        fields: [{ key: "notes", label: "Notitie", type: "textarea", full: true }],
      },
    ],
    title: (r) => r.tracking_number || r.carrier || "Shipment",
    subtitle: (r) => [r.carrier, r.tracking_number].filter(Boolean).join(" · "),
    statusKey: "status",
    statusTone: (v) => (v === "delivered" ? "success" : v === "failed" ? "danger" : "warn"),
    kpis: (r) => [
      { label: "Status", value: r.status ?? "—" },
      { label: "Verzonden", value: fmtDate(r.shipped_at) },
      { label: "Geleverd", value: fmtDate(r.delivered_at) },
    ],
  },

  returns: {
    table: "returns", label: "Return", labelPlural: "Returns", listPath: "/returns", hasOrderLink: true,
    sections: [
      {
        title: "Retour",
        fields: [
          { key: "reason", label: "Reden", full: true, placeholder: "Verkeerde maat, defect, van gedachten veranderd…" },
          { key: "status", label: "Status", type: "select", options: ["requested", "approved", "received", "refunded", "rejected", "pending", "resolved"], defaultValue: "requested" },
        ],
      },
      {
        title: "Terugbetaling",
        fields: [
          { key: "refund_amount", label: "Refund bedrag", type: "number", defaultValue: 0 },
          { key: "currency", label: "Munt", defaultValue: "EUR" },
        ],
      },
      {
        title: "Notities",
        fields: [{ key: "notes", label: "Notitie", type: "textarea", full: true }],
      },
    ],
    title: (r) => r.reason || "Return",
    subtitle: (r) => `Aangevraagd ${fmtDate(r.requested_at)}`,
    statusKey: "status",
    statusTone: (v) => (v === "refunded" || v === "resolved" ? "success" : v === "rejected" ? "danger" : "warn"),
    kpis: (r) => [
      { label: "Refund", value: fmtMoney(r.refund_amount, r.currency) },
      { label: "Status", value: r.status ?? "—" },
      { label: "Opgelost", value: fmtDate(r.resolved_at) },
    ],
  },

  tickets: {
    table: "tickets", label: "Ticket", labelPlural: "Tickets", listPath: "/tickets", hasOrderLink: true,
    sections: [
      {
        title: "Onderwerp",
        fields: [
          { key: "subject", label: "Onderwerp", required: true, full: true },
          { key: "customer_email", label: "Klant e-mail", type: "email" },
          { key: "channel", label: "Kanaal", type: "select", options: ["email", "chat", "phone", "social", "instagram"], defaultValue: "email" },
        ],
      },
      {
        title: "Toewijzing",
        fields: [
          { key: "priority", label: "Prioriteit", type: "select", options: ["low", "normal", "medium", "high", "urgent"], defaultValue: "normal" },
          { key: "status", label: "Status", type: "select", options: ["open", "pending", "solved", "resolved", "closed"], defaultValue: "open" },
          { key: "assigned_to", label: "Toegewezen aan", full: true },
        ],
      },
      {
        title: "Bericht",
        fields: [{ key: "body", label: "Bericht", type: "textarea", full: true }],
      },
    ],
    title: (r) => r.subject || "Ticket",
    subtitle: (r) => [r.customer_email, r.channel].filter(Boolean).join(" · "),
    statusKey: "status",
    statusTone: (v) => (v === "solved" || v === "resolved" || v === "closed" ? "success" : "warn"),
    kpis: (r) => [
      { label: "Prioriteit", value: r.priority ?? "—" },
      { label: "Status", value: r.status ?? "—" },
      { label: "Kanaal", value: r.channel ?? "—" },
    ],
  },

  product_health: {
    table: "product_health", label: "Product", labelPlural: "Product Health", listPath: "/product-health", hasOrderLink: false,
    sections: [
      {
        title: "Product",
        fields: [
          { key: "product_name", label: "Productnaam", required: true, full: true },
          { key: "sku", label: "SKU" },
          { key: "status", label: "Status", type: "select", options: ["healthy", "watch", "at_risk", "issue", "critical"], defaultValue: "healthy" },
        ],
      },
      {
        title: "Metrics",
        fields: [
          { key: "stock", label: "Voorraad", type: "number", defaultValue: 0 },
          { key: "return_rate", label: "Retour-ratio %", type: "number", defaultValue: 0 },
          { key: "review_score", label: "Review score (0–5)", type: "number", defaultValue: 0 },
        ],
      },
      {
        title: "Issues",
        fields: [{ key: "issues", label: "Bekende issues", type: "textarea", full: true }],
      },
    ],
    title: (r) => r.product_name || "Product",
    subtitle: (r) => (r.sku ? `SKU ${r.sku}` : ""),
    statusKey: "status",
    statusTone: (v) => (v === "healthy" ? "success" : v === "critical" || v === "issue" ? "danger" : "warn"),
    kpis: (r) => [
      { label: "Voorraad", value: r.stock ?? 0 },
      { label: "Retour %", value: `${r.return_rate ?? 0}%` },
      { label: "Score", value: `${Number(r.review_score ?? 0).toFixed(1)} / 5` },
    ],
  },

  agents: {
    table: "agents", label: "Agent", labelPlural: "Agents", listPath: "/agents", hasOrderLink: false,
    sections: [
      {
        title: "Agent",
        fields: [
          { key: "name", label: "Naam", required: true },
          { key: "role", label: "Rol" },
          { key: "status", label: "Status", type: "select", options: ["idle", "active", "paused", "error"], defaultValue: "idle" },
          { key: "workload", label: "Workload", type: "number", defaultValue: 0 },
        ],
      },
      {
        title: "Beschrijving",
        fields: [{ key: "description", label: "Beschrijving", type: "textarea", full: true }],
      },
    ],
    title: (r) => r.name || "Agent",
    subtitle: (r) => r.role ?? "",
    statusKey: "status",
    statusTone: (v) => (v === "active" ? "success" : v === "error" ? "danger" : "warn"),
    kpis: (r) => [
      { label: "Status", value: r.status ?? "—" },
      { label: "Workload", value: `${r.workload ?? 0} taken` },
    ],
  },

  finance_entries: {
    table: "finance_entries", label: "Boeking", labelPlural: "Financial Overview", listPath: "/finance", hasOrderLink: true,
    sections: [
      {
        title: "Boeking",
        fields: [
          { key: "type", label: "Type", type: "select", options: ["revenue", "expense", "refund"], defaultValue: "revenue" },
          { key: "amount", label: "Bedrag", type: "number", required: true, defaultValue: 0 },
          { key: "currency", label: "Munt", defaultValue: "EUR" },
          { key: "category", label: "Categorie" },
        ],
      },
      {
        title: "Detail",
        fields: [
          { key: "occurred_at", label: "Datum", type: "date" },
          { key: "description", label: "Beschrijving", type: "textarea", full: true },
        ],
      },
    ],
    title: (r) => r.category || r.description || r.type || "Boeking",
    subtitle: (r) => fmtDate(r.occurred_at ?? r.created_at),
    statusKey: "type",
    statusTone: (v) => (v === "revenue" ? "success" : "danger"),
    kpis: (r) => [
      { label: "Bedrag", value: fmtMoney(r.amount, r.currency) },
      { label: "Type", value: r.type ?? "—" },
    ],
  },

  notifications_inbox: {
    table: "notifications_inbox", label: "Notificatie", labelPlural: "Notifications", listPath: "/notifications", hasOrderLink: false,
    sections: [
      {
        title: "Notificatie",
        fields: [
          { key: "title", label: "Titel", required: true, full: true },
          { key: "kind", label: "Soort", type: "select", options: ["info", "warning", "critical", "success"], defaultValue: "info" },
          { key: "link", label: "Link", placeholder: "/orders" },
        ],
      },
      {
        title: "Bericht",
        fields: [{ key: "body", label: "Bericht", type: "textarea", full: true }],
      },
    ],
    title: (r) => r.title || "Notificatie",
    subtitle: (r) => fmtDate(r.created_at),
    statusKey: "kind",
    statusTone: (v) => (v === "critical" ? "danger" : v === "success" ? "success" : "warn"),
    kpis: (r) => [
      { label: "Soort", value: r.kind ?? "—" },
      { label: "Gelezen", value: r.is_read ? "Ja" : "Nee" },
    ],
  },

  team_members: {
    table: "team_members", label: "Teamlid", labelPlural: "Team", listPath: "/team", hasOrderLink: false,
    sections: [
      {
        title: "Teamlid",
        fields: [
          { key: "name", label: "Naam", required: true },
          { key: "email", label: "E-mail", type: "email" },
          { key: "role", label: "Rol", type: "select", options: ["owner", "admin", "member", "viewer"], defaultValue: "member" },
          { key: "status", label: "Status", type: "select", options: ["invited", "active", "suspended"], defaultValue: "invited" },
        ],
      },
    ],
    title: (r) => r.name || "Teamlid",
    subtitle: (r) => r.email ?? "",
    statusKey: "status",
    statusTone: (v) => (v === "active" ? "success" : v === "suspended" ? "danger" : "warn"),
    kpis: (r) => [
      { label: "Rol", value: r.role ?? "—" },
      { label: "Status", value: r.status ?? "—" },
      { label: "Uitgenodigd", value: fmtDate(r.invited_at) },
    ],
  },
};

/* ── List-view metrics + filters (data density & character) ──────────────── */

const metricsMap: Record<string, NonNullable<OpsConfig["metrics"]>> = {
  orders: (rows) => [
    { label: "Orders", value: rows.length },
    { label: "Omzet (betaald)", value: money(sumBy(rows, (r) => r.status === "paid", "total")) },
    { label: "Onvervuld", value: countBy(rows, (r) => r.fulfillment_status !== "fulfilled"), tone: "warn" },
    { label: "Geannuleerd", value: countBy(rows, (r) => r.status === "cancelled"), tone: "danger" },
  ],
  shipments: (rows) => [
    { label: "Shipments", value: rows.length },
    { label: "Onderweg", value: countBy(rows, (r) => r.status === "in_transit"), tone: "warn" },
    { label: "Geleverd", value: countBy(rows, (r) => r.status === "delivered"), tone: "success" },
    { label: "Mislukt", value: countBy(rows, (r) => r.status === "failed"), tone: "danger" },
  ],
  returns: (rows) => [
    { label: "Returns", value: rows.length },
    { label: "In behandeling", value: countBy(rows, (r) => r.status === "pending" || r.status === "requested"), tone: "warn" },
    { label: "Terugbetaald", value: money(sumBy(rows, (r) => r.status === "refunded" || r.status === "resolved", "refund_amount")) },
  ],
  tickets: (rows) => [
    { label: "Tickets", value: rows.length },
    { label: "Open", value: countBy(rows, (r) => r.status === "open" || r.status === "pending"), tone: "warn" },
    { label: "Hoge prio", value: countBy(rows, (r) => r.priority === "high" || r.priority === "urgent"), tone: "danger" },
    { label: "Opgelost", value: countBy(rows, (r) => r.status === "solved" || r.status === "resolved" || r.status === "closed"), tone: "success" },
  ],
  product_health: (rows) => [
    { label: "SKU's", value: rows.length },
    { label: "Gezond", value: countBy(rows, (r) => r.status === "healthy"), tone: "success" },
    { label: "Aandacht", value: countBy(rows, (r) => r.status === "watch"), tone: "warn" },
    { label: "Probleem", value: countBy(rows, (r) => r.status === "issue" || r.status === "critical" || r.status === "at_risk"), tone: "danger" },
  ],
  agents: (rows) => [
    { label: "Agents", value: rows.length },
    { label: "Actief", value: countBy(rows, (r) => r.status === "active"), tone: "success" },
    { label: "Gepauzeerd", value: countBy(rows, (r) => r.status === "paused"), tone: "warn" },
    { label: "Totale workload", value: rows.reduce((s, r) => s + Number(r.workload ?? 0), 0) },
  ],
  finance_entries: (rows) => {
    const rev = sumBy(rows, (r) => r.type === "revenue");
    const exp = sumBy(rows, (r) => r.type === "expense") + sumBy(rows, (r) => r.type === "refund");
    return [
      { label: "Omzet", value: money(rev), tone: "success" },
      { label: "Uitgaven", value: money(exp), tone: "danger" },
      { label: "Netto", value: money(rev - exp), tone: rev - exp >= 0 ? "success" : "danger" },
      { label: "Boekingen", value: rows.length },
    ];
  },
  team_members: (rows) => [
    { label: "Teamleden", value: rows.length },
    { label: "Actief", value: countBy(rows, (r) => r.status === "active"), tone: "success" },
    { label: "Uitgenodigd", value: countBy(rows, (r) => r.status === "invited"), tone: "warn" },
  ],
  notifications_inbox: (rows) => [
    { label: "Notificaties", value: rows.length },
    { label: "Ongelezen", value: countBy(rows, (r) => !r.is_read), tone: "warn" },
    { label: "Kritiek", value: countBy(rows, (r) => r.kind === "critical"), tone: "danger" },
  ],
};

const filterKeyMap: Record<string, string> = {
  orders: "status",
  shipments: "status",
  returns: "status",
  tickets: "status",
  cases: "status",
  product_health: "status",
  agents: "status",
  finance_entries: "type",
  team_members: "status",
  notifications_inbox: "kind",
};

for (const [k, m] of Object.entries(metricsMap)) if (opsRegistry[k]) opsRegistry[k].metrics = m;
for (const [k, fk] of Object.entries(filterKeyMap)) if (opsRegistry[k]) opsRegistry[k].filterKey = fk;
