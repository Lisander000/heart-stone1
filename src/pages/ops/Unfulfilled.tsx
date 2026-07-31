import { ResourcePage, StatusBadge, fmtDate, fmtMoney } from "@/components/ops/ResourcePage";
import { ResourceDashboard } from "@/components/ops/ResourceDashboard";
import { PackageOpen } from "lucide-react";

const payTone = (v: string) => v === "paid" ? "success" : v === "refunded" || v === "cancelled" ? "danger" : "warn";

export default function Unfulfilled() {
  return (
    <ResourcePage
      title="Unfulfilled"
      icon={PackageOpen}
      iconTone="warn"
      category="Operations"
      description="Betaalde orders die nog verzonden moeten worden."
      table="orders"
      extraFilter={{ fulfillment_status: "unfulfilled" }}
      rowLinkTo={(r) => `/unfulfilled/${r.id}`}
      dashboard={
        <ResourceDashboard
          table="orders" label="orders" accent="hsl(var(--warn))"
          extraFilter={{ fulfillment_status: "unfulfilled" }}
          statusField="status" moneyField="total"
          openStatuses={["paid"]} openLabel="Betaald"
          statusColors={{ paid: "hsl(var(--ok))", open: "hsl(var(--warn))", refunded: "hsl(var(--bad))", cancelled: "hsl(var(--bad))" }}
        />
      }
      emptyText="Geen openstaande fulfilments. Alles is verzonden 🎉"
      fields={[
        { key: "order_number", label: "Ordernummer", required: true, placeholder: "#1042" },
        { key: "customer_name", label: "Klantnaam" },
        { key: "customer_email", label: "Klant e-mail", type: "email" },
        { key: "status", label: "Betaalstatus", type: "select", options: ["open", "paid", "cancelled", "refunded"], defaultValue: "paid" },
        { key: "fulfillment_status", label: "Fulfilment", type: "select", options: ["unfulfilled", "partial", "fulfilled"], defaultValue: "unfulfilled" },
        { key: "total", label: "Totaal", type: "number", defaultValue: 0 },
        { key: "currency", label: "Munt", defaultValue: "EUR" },
      ]}
      columns={[
        { key: "order_number", label: "Order" },
        { key: "customer_name", label: "Klant" },
        { key: "status", label: "Betaling", render: (v) => <StatusBadge value={v} tone={payTone(v)} /> },
        { key: "total", label: "Totaal", render: (v, r) => fmtMoney(v, r.currency) },
        { key: "created_at", label: "Aangemaakt", render: (v) => fmtDate(v) },
      ]}
    />
  );
}
