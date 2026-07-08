import { ResourcePage, StatusBadge, fmtDate } from "@/components/ops/ResourcePage";

const tone = (v: string) => ["delivered", "resolved"].includes(v) ? "success"
  : ["failed", "returned", "returned_to_sender", "lost", "delivered_disputed"].includes(v) ? "danger"
  : ["in_transit", "no_movement"].includes(v) ? "warn" : "default";

export default function Shipments() {
  return (
    <ResourcePage
      title="Shipments"
      description="Verzendingen en hun trackingstatus. Open er een om het verzendprobleem af te handelen."
      table="shipments"
      rowLinkTo={(s) => `/shipments/${s.id}`}
      fields={[
        { key: "carrier", label: "Carrier", placeholder: "bpost, DPD, PostNL…" },
        { key: "tracking_number", label: "Tracking nummer" },
        { key: "status", label: "Status", type: "select", options: ["info_received", "in_transit", "no_movement", "returned_to_sender", "lost", "delivered_disputed", "resolved"], defaultValue: "in_transit" },
        { key: "shipped_at", label: "Verzonden op", type: "date" },
        { key: "delivered_at", label: "Geleverd op", type: "date" },
        { key: "notes", label: "Notitie", type: "textarea" },
      ]}
      columns={[
        { key: "carrier", label: "Carrier" },
        { key: "tracking_number", label: "Tracking" },
        { key: "status", label: "Status", render: (v) => <StatusBadge value={v} tone={tone(v)} /> },
        { key: "shipped_at", label: "Verzonden", render: (v) => fmtDate(v) },
        { key: "delivered_at", label: "Geleverd", render: (v) => fmtDate(v) },
      ]}
    />
  );
}
