import { ResourcePage, StatusBadge, fmtDate, fmtMoney } from "@/components/ops/ResourcePage";

const payTone = (v: string) => v === "paid" ? "success" : v === "refunded" || v === "cancelled" ? "danger" : "warn";
const fulfilTone = (v: string) => v === "fulfilled" ? "success" : v === "partial" ? "warn" : "danger";

export default function Orders() {
  return (
    <ResourcePage
      title="Orders"
      description="Alle bestellingen met betaal- en fulfilmentstatus."
      table="orders"
      rowLinkTo={(r) => `/orders/${r.id}`}
      fields={[
        { key: "order_number", label: "Ordernummer", required: true, placeholder: "#1042" },
        { key: "customer_name", label: "Klantnaam", placeholder: "Voornaam Achternaam" },
        { key: "customer_email", label: "Klant e-mail", type: "email" },
        { key: "status", label: "Betaalstatus", type: "select", options: ["open", "paid", "cancelled", "refunded"], defaultValue: "open" },
        { key: "fulfillment_status", label: "Fulfilment", type: "select", options: ["unfulfilled", "partial", "fulfilled"], defaultValue: "unfulfilled" },
        { key: "total", label: "Totaal", type: "number", defaultValue: 0 },
        { key: "currency", label: "Munt", defaultValue: "EUR" },
        { key: "tracking_number", label: "Tracking nummer" },
      ]}
      columns={[
        { key: "order_number", label: "Order" },
        { key: "customer_name", label: "Klant" },
        { key: "status", label: "Betaling", render: (v) => <StatusBadge value={v} tone={payTone(v)} /> },
        { key: "fulfillment_status", label: "Fulfilment", render: (v) => <StatusBadge value={v} tone={fulfilTone(v)} /> },
        { key: "total", label: "Totaal", render: (v, r) => fmtMoney(v, r.currency) },
        { key: "created_at", label: "Aangemaakt", render: (v) => fmtDate(v) },
      ]}
    />
  );
}
