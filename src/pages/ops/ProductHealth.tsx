import { ResourcePage, StatusBadge } from "@/components/ops/ResourcePage";

const tone = (v: string) => v === "healthy" ? "success" : v === "watch" ? "warn" : "danger";

export default function ProductHealth() {
  return (
    <ResourcePage
      title="Product Health"
      description="Voorraad, retour-ratio en reviewscore per product."
      table="product_health"
      fields={[
        { key: "product_name", label: "Productnaam", required: true },
        { key: "sku", label: "SKU" },
        { key: "status", label: "Status", type: "select", options: ["healthy", "watch", "at_risk", "issue", "critical"], defaultValue: "healthy" },
        { key: "stock", label: "Voorraad", type: "number", defaultValue: 0 },
        { key: "return_rate", label: "Retour-ratio %", type: "number", defaultValue: 0 },
        { key: "review_score", label: "Review score (0–5)", type: "number", defaultValue: 0 },
        { key: "issues", label: "Bekende issues", type: "textarea" },
      ]}
      columns={[
        { key: "product_name", label: "Product" },
        { key: "sku", label: "SKU" },
        { key: "status", label: "Status", render: (v) => <StatusBadge value={v} tone={tone(v)} /> },
        { key: "stock", label: "Voorraad", render: (v) => <span className="tabular-nums">{v ?? 0}</span> },
        { key: "return_rate", label: "Retour %", render: (v) => <span className="tabular-nums">{v ?? 0}%</span> },
        { key: "review_score", label: "Review", render: (v) => <span className="tabular-nums">{v ?? "—"}</span> },
      ]}
    />
  );
}
