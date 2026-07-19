import { ResourcePage, StatusBadge, fmtDate } from "@/components/ops/ResourcePage";

const prioTone = (v: string) => v === "urgent" || v === "high" ? "danger" : v === "medium" ? "warn" : "default";
const statusTone = (v: string) => v === "solved" || v === "resolved" || v === "closed" ? "success" : v === "pending" ? "warn" : "default";

export default function Tickets() {
  return (
    <ResourcePage
      title="Tickets"
      description="Klantenservice-tickets per kanaal. Open er een om het ticket af te handelen."
      table="tickets"
      rowLinkTo={(r) => `/tickets/${r.id}`}
      fields={[
        { key: "subject", label: "Onderwerp", required: true, placeholder: "Waar gaat het over?" },
        { key: "customer_email", label: "Klant e-mail", type: "email" },
        { key: "channel", label: "Kanaal", type: "select", options: ["email", "chat", "phone", "social", "instagram"], defaultValue: "email" },
        { key: "priority", label: "Prioriteit", type: "select", options: ["low", "normal", "medium", "high", "urgent"], defaultValue: "normal" },
        { key: "status", label: "Status", type: "select", options: ["open", "pending", "solved", "resolved", "closed"], defaultValue: "open" },
        { key: "assigned_to", label: "Toegewezen aan" },
        { key: "body", label: "Bericht", type: "textarea" },
      ]}
      columns={[
        { key: "subject", label: "Onderwerp" },
        { key: "customer_email", label: "Klant" },
        { key: "channel", label: "Kanaal" },
        { key: "priority", label: "Prio", render: (v) => <StatusBadge value={v} tone={prioTone(v)} /> },
        { key: "status", label: "Status", render: (v) => <StatusBadge value={v} tone={statusTone(v)} /> },
        { key: "created_at", label: "Aangemaakt", render: (v) => fmtDate(v) },
      ]}
    />
  );
}
