import { ResourcePage, StatusBadge } from "@/components/ops/ResourcePage";

const tone = (v: string) => v === "active" ? "success" : v === "paused" ? "warn" : v === "error" ? "danger" : "default";

export default function Agents() {
  return (
    <ResourcePage
      title="Agents"
      description="Interne en geautomatiseerde agents en hun status."
      table="agents"
      fields={[
        { key: "name", label: "Naam", required: true },
        { key: "role", label: "Rol", placeholder: "CS, fulfilment, marketing…" },
        { key: "status", label: "Status", type: "select", options: ["idle", "active", "paused", "error"], defaultValue: "idle" },
        { key: "workload", label: "Workload", type: "number", defaultValue: 0 },
        { key: "description", label: "Beschrijving", type: "textarea" },
      ]}
      columns={[
        { key: "name", label: "Naam" },
        { key: "role", label: "Rol" },
        { key: "status", label: "Status", render: (v) => <StatusBadge value={v} tone={tone(v)} /> },
        { key: "workload", label: "Workload", render: (v) => <span className="tabular-nums">{v ?? 0}</span> },
      ]}
    />
  );
}
