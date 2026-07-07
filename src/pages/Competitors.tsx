import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Copy, Loader2, Plus, Trash2, ArrowLeft, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

// Use CSS variables so dark mode works
const BORDEAUX = "hsl(var(--primary))";
const CREAM    = "hsl(var(--background))";

type AxisKey =
  | "positioning"
  | "product_format"
  | "claims"
  | "pricing"
  | "funnel"
  | "social_proof";

type Status = "verified" | "uncertain" | "not_found";

const AXES: { key: AxisKey; title: string; hint: string }[] = [
  {
    key: "positioning",
    title: "Positionering & Branding",
    hint:
      "Wat zegt het merk te zijn versus hoe het aanvoelt. Premium-rustig of speels-druk? Hoe spreekt het de baasje aan? Waar zit het in het categorie-register — en waar ligt de reverse-marketing kans?",
  },
  {
    key: "product_format",
    title: "Product & Format",
    hint:
      "Wat verkopen ze werkelijk (niet hun marketingframe). Classificeer op twee assen: format (soft chew / poeder / poeder+olie / capsule) én structuur (één all-in-one hero / rek losse probleem-specifieke producten / voeding-first met supplementen erbij). Is de all-in-one de hero of een bijproduct?",
  },
  {
    key: "claims",
    title: "Claims & Onderbouwing",
    hint:
      "Welke claims, en hoe onderbouwd (dierenarts, studies, certificering, testimonials). Support-taal of ziekteclaims? Hoe geloofwaardig werkelijk versus hoe het oogt?",
  },
  {
    key: "pricing",
    title: "Pricing & Offer",
    hint:
      "Alles in euro. Prijs per eenheid en per 30 dagen. Single buy, bundels, abonnement. Abonnementskorting en cadence. Add-ons en AOV-opbouw. Retentie-instrumenten (gratis gifts, garantie, opzeggemak).",
  },
  {
    key: "funnel",
    title: "Funnel Strategie",
    hint:
      "Hoe halen ze klanten binnen — quiz, advertorials, influencers, retail, kanalen. DTC-only of omnichannel? Actief in de Benelux/EU of alleen thuismarkt?",
  },
  {
    key: "social_proof",
    title: "Social Proof",
    hint:
      "Hoeveel reviews en welke score. Geclaimde klantenaantallen. Terugkerende klachten in negatieve reviews. Wat geprezen wordt. Onderscheid geverifieerde cijfers van merk-eigen claims.",
  },
];

const STATUS_META: Record<Status, { label: string; dot: string; bg: string; text: string; border: string }> = {
  verified: {
    label: "Geverifieerd",
    dot: "hsl(var(--ok))",
    bg: "hsl(var(--ok) / 0.12)",
    text: "hsl(var(--ok))",
    border: "hsl(var(--ok) / 0.25)",
  },
  uncertain: {
    label: "Onzeker — checken",
    dot: "hsl(var(--warn))",
    bg: "hsl(var(--warn) / 0.12)",
    text: "hsl(var(--warn))",
    border: "hsl(var(--warn) / 0.25)",
  },
  not_found: {
    label: "Niet gevonden",
    dot: "hsl(var(--muted-foreground))",
    bg: "hsl(var(--muted))",
    text: "hsl(var(--muted-foreground))",
    border: "hsl(var(--border))",
  },
};

type Axis = {
  id: string;
  competitor_id: string;
  axis_key: AxisKey;
  content: string | null;
  status: Status;
};

type Competitor = {
  id: string;
  user_id: string;
  name: string;
  url: string | null;
  logo_url: string | null;
  strong_points: string | null;
  missed_points: string | null;
  gooodboys_edge: string | null;
  competitor_axes: Axis[];
};

export default function Competitors() {
  const [loading, setLoading] = useState(true);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [selectedCompare, setSelectedCompare] = useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("competitors")
      .select("*, competitor_axes(*)")
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Kon concurrenten niet laden", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    // Normalise: a competitor with no related rows can come back without the
    // embedded array — guarantee it's always an array so nothing downstream crashes.
    const rows = ((data ?? []) as Competitor[]).map((c) => ({ ...c, competitor_axes: c.competitor_axes ?? [] }));
    // ensure every axis exists
    for (const c of rows) {
      const existing = new Set(c.competitor_axes.map((a) => a.axis_key));
      const missing = AXES.filter((a) => !existing.has(a.key));
      if (missing.length) {
        const userId = c.user_id;
        const inserts = missing.map((a) => ({
          competitor_id: c.id,
          user_id: userId,
          axis_key: a.key,
          content: "",
          status: "not_found" as Status,
        }));
        const { data: created } = await supabase.from("competitor_axes").insert(inserts).select("*");
        if (created) c.competitor_axes = [...c.competitor_axes, ...(created as Axis[])];
      }
    }
    setCompetitors(rows);
    setSelectedCompare(new Set(rows.map((r) => r.id)));
    setLoading(false);
  }

  async function createCompetitor(name: string, url: string, logoUrl: string) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { data: created, error } = await supabase
      .from("competitors")
      .insert({ name, url: url || null, logo_url: logoUrl || null, user_id: userId })
      .select("*")
      .single();
    if (error || !created) {
      toast({ title: "Aanmaken mislukt", description: error?.message, variant: "destructive" });
      return;
    }
    const axesInserts = AXES.map((a) => ({
      competitor_id: created.id,
      user_id: userId,
      axis_key: a.key,
      content: "",
      status: "not_found" as Status,
    }));
    const { data: axes } = await supabase.from("competitor_axes").insert(axesInserts).select("*");
    const full: Competitor = { ...(created as any), competitor_axes: (axes as Axis[]) ?? [] };
    setCompetitors((prev) => [...prev, full]);
    setSelectedCompare((prev) => new Set(prev).add(full.id));
    setOpenIds((prev) => new Set(prev).add(full.id));
    setNewOpen(false);
  }

  async function duplicateCompetitor(c: Competitor) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { data: created, error } = await supabase
      .from("competitors")
      .insert({
        name: `${c.name} (kopie)`,
        url: c.url,
        logo_url: c.logo_url,
        strong_points: c.strong_points,
        missed_points: c.missed_points,
        gooodboys_edge: c.gooodboys_edge,
        user_id: userId,
      })
      .select("*")
      .single();
    if (error || !created) {
      toast({ title: "Dupliceren mislukt", description: error?.message, variant: "destructive" });
      return;
    }
    const axesInserts = c.competitor_axes.map((a) => ({
      competitor_id: created.id,
      user_id: userId,
      axis_key: a.axis_key,
      content: a.content,
      status: a.status,
    }));
    const { data: axes } = await supabase.from("competitor_axes").insert(axesInserts).select("*");
    const full: Competitor = { ...(created as any), competitor_axes: (axes as Axis[]) ?? [] };
    setCompetitors((prev) => [...prev, full]);
    setSelectedCompare((prev) => new Set(prev).add(full.id));
  }

  async function deleteCompetitor(id: string) {
    const { error } = await supabase.from("competitors").delete().eq("id", id);
    if (error) {
      toast({ title: "Verwijderen mislukt", description: error.message, variant: "destructive" });
      return;
    }
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
    setSelectedCompare((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setDeleteId(null);
  }

  function updateCompetitorLocal(id: string, patch: Partial<Competitor>) {
    setCompetitors((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function updateAxisLocal(competitorId: string, axisId: string, patch: Partial<Axis>) {
    setCompetitors((prev) =>
      prev.map((c) =>
        c.id !== competitorId
          ? c
          : {
              ...c,
              competitor_axes: c.competitor_axes.map((a) => (a.id === axisId ? { ...a, ...patch } : a)),
            },
      ),
    );
  }

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCompare(id: string) {
    setSelectedCompare((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Premium page header */}
      <div className="border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-end justify-between gap-4 flex-wrap">
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.45, ease:[0.16,1,0.3,1] }}>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Strategy</p>
            <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight text-foreground leading-none">
              Concurrentie-analyse
            </h1>
            <p className="text-sm text-muted-foreground mt-2">Zes vaste assen. Eén beeld per merk. Eén tabel om de gaten te zien.</p>
          </motion.div>
          <motion.div initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.4, delay:0.1 }}>
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <button className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all">
                  <Plus size={14} /> Nieuwe concurrent
                </button>
              </DialogTrigger>
              <NewCompetitorDialog onCreate={createCompetitor} />
            </Dialog>
          </motion.div>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="animate-spin mr-2" size={16} /> Laden…
          </div>
        ) : competitors.length === 0 ? (
          <div className="border border-border rounded-2xl p-16 text-center bg-card">
            <p className="font-display italic text-lg mb-2 text-primary">
              Nog geen concurrenten.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Voeg de eerste toe om de zes assen in te vullen.
            </p>
            <button
              onClick={() => setNewOpen(true)}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all inline-flex items-center gap-2"
            >
              <Plus size={14} /> Nieuwe concurrent
            </button>
          </div>
        ) : (
          <Tabs defaultValue="profiles" className="w-full">
            <TabsList className="mb-8 bg-muted p-1 rounded-xl h-auto">
              <TabsTrigger value="profiles" className="rounded-lg">Profielen</TabsTrigger>
              <TabsTrigger value="compare" className="rounded-lg">Vergelijken</TabsTrigger>
            </TabsList>

            <TabsContent value="profiles" className="space-y-6">
              {competitors.map((c) => (
                <CompetitorCard
                  key={c.id}
                  competitor={c}
                  open={openIds.has(c.id)}
                  onToggleOpen={() => toggleOpen(c.id)}
                  onLocalUpdate={(patch) => updateCompetitorLocal(c.id, patch)}
                  onLocalAxis={(axisId, patch) => updateAxisLocal(c.id, axisId, patch)}
                  onDuplicate={() => duplicateCompetitor(c)}
                  onDelete={() => setDeleteId(c.id)}
                />
              ))}
            </TabsContent>

            <TabsContent value="compare">
              <CompareView
                competitors={competitors}
                selected={selectedCompare}
                onToggle={toggleCompare}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concurrent verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle ingevulde assen en de gap-synthese gaan verloren. Deze actie kan niet ongedaan gemaakt worden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteCompetitor(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NewCompetitorDialog({
  onCreate,
}: {
  onCreate: (name: string, url: string, logoUrl: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name.trim(), url.trim(), logoUrl.trim());
    setSaving(false);
    setName("");
    setUrl("");
    setLogoUrl("");
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nieuwe concurrent</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="comp-name">Merknaam</Label>
          <Input id="comp-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="comp-url">Website (optioneel)</Label>
          <Input
            id="comp-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            maxLength={500}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="comp-logo">Logo URL (optioneel)</Label>
          <Input
            id="comp-logo"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…/logo.png"
            maxLength={500}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={submit}
          disabled={!name.trim() || saving}
          style={{ background: BORDEAUX, color: CREAM }}
          className="hover:opacity-90"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Toevoegen
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CompetitorCard({
  competitor,
  open,
  onToggleOpen,
  onLocalUpdate,
  onLocalAxis,
  onDuplicate,
  onDelete,
}: {
  competitor: Competitor;
  open: boolean;
  onToggleOpen: () => void;
  onLocalUpdate: (patch: Partial<Competitor>) => void;
  onLocalAxis: (axisId: string, patch: Partial<Axis>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [editingHeader, setEditingHeader] = useState(false);
  const [name, setName] = useState(competitor.name);
  const [url, setUrl] = useState(competitor.url ?? "");
  const [logoUrl, setLogoUrl] = useState(competitor.logo_url ?? "");

  async function saveHeader() {
    const { error } = await supabase
      .from("competitors")
      .update({ name: name.trim() || competitor.name, url: url.trim() || null, logo_url: logoUrl.trim() || null })
      .eq("id", competitor.id);
    if (error) {
      toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" });
      return;
    }
    onLocalUpdate({ name: name.trim() || competitor.name, url: url.trim() || null, logo_url: logoUrl.trim() || null });
    setEditingHeader(false);
  }

  const axesByKey = useMemo(() => {
    const map: Record<string, Axis> = {};
    (competitor.competitor_axes ?? []).forEach((a) => (map[a.axis_key] = a));
    return map;
  }, [competitor.competitor_axes]);

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
    >
      <div className="p-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          {competitor.logo_url ? (
            <img
              src={competitor.logo_url}
              alt={competitor.name}
              className="w-12 h-12 rounded object-contain bg-[hsl(var(--muted))]"
            />
          ) : (
            <div className="w-11 h-11 rounded-lg flex items-center justify-center text-base font-semibold bg-muted text-foreground border border-border">
              {competitor.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            {editingHeader ? (
              <div className="space-y-2 max-w-xl">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Merknaam" />
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Website" />
                <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="Logo URL" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveHeader} style={{ background: BORDEAUX, color: CREAM }}>
                    Opslaan
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setName(competitor.name);
                      setUrl(competitor.url ?? "");
                      setLogoUrl(competitor.logo_url ?? "");
                      setEditingHeader(false);
                    }}
                  >
                    Annuleren
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h2
                  className="text-lg font-semibold tracking-tight cursor-pointer text-foreground hover:text-primary transition-colors"
                  onClick={() => setEditingHeader(true)}
                  title="Klik om te bewerken"
                >
                  {competitor.name}
                </h2>
                {competitor.url && (
                  <a
                    href={competitor.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {competitor.url}
                  </a>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onDuplicate} title="Dupliceren">
            <Copy size={15} />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} title="Verwijderen">
            <Trash2 size={15} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onToggleOpen}>
            <ChevronDown
              size={16}
              style={{
                transition: "transform 0.2s",
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
            {open ? "Inklappen" : "Openen"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t px-6 py-6 space-y-6" style={{ borderColor: "hsl(var(--border))" }}>
          {AXES.map((axis) => {
            const a = axesByKey[axis.key];
            if (!a) return null;
            return (
              <AxisField
                key={a.id}
                axis={axis}
                value={a}
                onLocal={(patch) => onLocalAxis(a.id, patch)}
              />
            );
          })}

          <div
            className="border-t pt-6 mt-6 space-y-4"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <h3
              className="font-display text-lg font-semibold"
              style={{ color: BORDEAUX }}
            >
              Gap-synthese
            </h3>
            <GapField
              competitorId={competitor.id}
              label="Wat doen ze sterk (evenaren)"
              field="strong_points"
              value={competitor.strong_points ?? ""}
              onLocal={(v) => onLocalUpdate({ strong_points: v })}
            />
            <GapField
              competitorId={competitor.id}
              label="Wat laten ze liggen"
              field="missed_points"
              value={competitor.missed_points ?? ""}
              onLocal={(v) => onLocalUpdate({ missed_points: v })}
            />
            <GapField
              competitorId={competitor.id}
              label="Waar kan Gooodboys anders/beter zijn"
              field="gooodboys_edge"
              value={competitor.gooodboys_edge ?? ""}
              onLocal={(v) => onLocalUpdate({ gooodboys_edge: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AxisField({
  axis,
  value,
  onLocal,
}: {
  axis: { key: AxisKey; title: string; hint: string };
  value: Axis;
  onLocal: (patch: Partial<Axis>) => void;
}) {
  const [content, setContent] = useState(value.content ?? "");
  const [status, setStatus] = useState<Status>(value.status);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setContent(value.content ?? "");
    setStatus(value.status);
  }, [value.id]);

  function scheduleSave(nextContent: string, nextStatus: Status) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      const { error } = await supabase
        .from("competitor_axes")
        .update({ content: nextContent, status: nextStatus })
        .eq("id", value.id);
      setSaving(false);
      if (error) {
        toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" });
        return;
      }
      onLocal({ content: nextContent, status: nextStatus });
    }, 600);
  }

  async function updateStatus(s: Status) {
    setStatus(s);
    const { error } = await supabase
      .from("competitor_axes")
      .update({ status: s })
      .eq("id", value.id);
    if (error) {
      toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" });
      return;
    }
    onLocal({ status: s });
  }

  const meta = STATUS_META[status] ?? STATUS_META.not_found;

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h4 className="font-display text-base font-semibold" style={{ color: BORDEAUX }}>
              {axis.title}
            </h4>
            <span
              className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border"
              style={{ background: meta.bg, color: meta.text, borderColor: meta.border }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: meta.dot }}
              />
              {meta.label}
            </span>
            {saving && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{axis.hint}</p>
        </div>
        <div className="flex items-center gap-1">
          {(Object.keys(STATUS_META) as Status[]).map((s) => {
            const m = STATUS_META[s];
            const active = status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => updateStatus(s)}
                className="w-5 h-5 rounded-full border transition-all"
                style={{
                  background: active ? m.dot : "transparent",
                  borderColor: m.dot,
                  boxShadow: active ? `0 0 0 2px ${m.bg}` : undefined,
                }}
                title={m.label}
              />
            );
          })}
        </div>
      </div>
      <Textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          scheduleSave(e.target.value, status);
        }}
        rows={4}
        className="resize-y"
        style={{ background: "hsl(var(--muted))", borderColor: "hsl(var(--border))" }}
        maxLength={8000}
      />
    </div>
  );
}

function GapField({
  competitorId,
  label,
  field,
  value,
  onLocal,
}: {
  competitorId: string;
  label: string;
  field: "strong_points" | "missed_points" | "gooodboys_edge";
  value: string;
  onLocal: (v: string) => void;
}) {
  const [val, setVal] = useState(value);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVal(value);
  }, [competitorId]);

  function schedule(next: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      const { error } = await supabase
        .from("competitors")
        .update({ [field]: next } as never)
        .eq("id", competitorId);
      setSaving(false);
      if (error) {
        toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" });
        return;
      }
      onLocal(next);
    }, 600);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
        {saving && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
      </div>
      <Textarea
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          schedule(e.target.value);
        }}
        rows={2}
        className="resize-y"
        style={{ background: "hsl(var(--muted))", borderColor: "hsl(var(--border))" }}
        maxLength={2000}
      />
    </div>
  );
}

function CompareView({
  competitors,
  selected,
  onToggle,
}: {
  competitors: Competitor[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const ALL_STATUSES: Status[] = ["verified", "uncertain", "not_found"];
  const [axisFilters, setAxisFilters] = useState<Record<AxisKey, Set<Status>>>(() => {
    const init = {} as Record<AxisKey, Set<Status>>;
    AXES.forEach((a) => (init[a.key] = new Set(ALL_STATUSES)));
    return init;
  });

  function toggleAxisStatus(axisKey: AxisKey, status: Status) {
    setAxisFilters((prev) => {
      const next = { ...prev };
      const set = new Set(next[axisKey]);
      if (set.has(status)) set.delete(status);
      else set.add(status);
      next[axisKey] = set;
      return next;
    });
  }

  function resetFilters() {
    const init = {} as Record<AxisKey, Set<Status>>;
    AXES.forEach((a) => (init[a.key] = new Set(ALL_STATUSES)));
    setAxisFilters(init);
  }

  const anyFilterActive = AXES.some((a) => axisFilters[a.key].size < ALL_STATUSES.length);

  const visible = competitors.filter((c) => {
    if (!selected.has(c.id)) return false;
    // competitor passes if for every axis its status is allowed
    return AXES.every((axis) => {
      const a = (c.competitor_axes ?? []).find((x) => x.axis_key === axis.key);
      const s = (a?.status ?? "not_found") as Status;
      return axisFilters[axis.key].has(s);
    });
  });

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-2 p-3 rounded-lg border"
        style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
      >
        <span className="text-xs uppercase tracking-wider text-muted-foreground self-center mr-2">
          Toon kolommen
        </span>
        {competitors.map((c) => {
          const on = selected.has(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onToggle(c.id)}
              className="text-xs px-3 py-1 rounded-full border transition-all"
              style={{
                background: on ? BORDEAUX : "transparent",
                color: on ? CREAM : "hsl(var(--muted-foreground))",
                borderColor: on ? BORDEAUX : "hsl(var(--border))",
              }}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      <div
        className="p-4 rounded-lg border space-y-3"
        style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Filter per as op status
          </span>
          {anyFilterActive && (
            <button
              onClick={resetFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
          {AXES.map((axis) => (
            <div key={axis.key} className="flex items-center justify-between gap-3 py-1">
              <span className="text-sm font-medium" style={{ color: BORDEAUX }}>
                {axis.title}
              </span>
              <div className="flex items-center gap-1.5">
                {ALL_STATUSES.map((s) => {
                  const meta = STATUS_META[s];
                  const on = axisFilters[axis.key].has(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleAxisStatus(axis.key, s)}
                      title={meta.label}
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border transition-all"
                      style={{
                        background: on ? meta.bg : "transparent",
                        color: on ? meta.text : "hsl(var(--muted-foreground))",
                        borderColor: on ? meta.border : "hsl(var(--border))",
                        opacity: on ? 1 : 0.55,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: meta.dot }}
                      />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div
          className="p-12 text-center text-sm text-muted-foreground border rounded-lg"
          style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
        >
          {anyFilterActive
            ? "Geen concurrenten matchen deze status-filters."
            : "Selecteer minstens één concurrent om te vergelijken."}
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-lg" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
          <table className="w-full border-collapse" style={{ minWidth: 200 + visible.length * 280 }}>
            <thead>
              <tr style={{ background: "hsl(var(--muted))" }}>
                <th
                  className="text-left p-4 font-display text-sm font-semibold sticky left-0 z-10"
                  style={{ color: BORDEAUX, background: "hsl(var(--muted))", width: 200 }}
                >
                  As
                </th>
                {visible.map((c) => (
                  <th
                    key={c.id}
                    className="text-left p-4 font-display text-sm font-semibold border-l"
                    style={{ color: BORDEAUX, borderColor: "hsl(var(--border))", minWidth: 280 }}
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AXES.map((axis, i) => (
                <tr key={axis.key} style={{ background: i % 2 ? "hsl(var(--muted))" : "hsl(var(--card))" }}>
                  <td
                    className="p-4 align-top text-sm font-medium sticky left-0 z-10"
                    style={{ background: i % 2 ? "hsl(var(--muted))" : "hsl(var(--card))", width: 200 }}
                  >
                    <div style={{ color: BORDEAUX }}>{axis.title}</div>
                  </td>
                  {visible.map((c) => {
                    const a = (c.competitor_axes ?? []).find((x) => x.axis_key === axis.key);
                    const meta = (a && STATUS_META[a.status]) ?? STATUS_META.not_found;
                    return (
                      <td
                        key={c.id}
                        className="p-4 align-top text-sm border-l"
                        style={{ borderColor: "hsl(var(--border))", minWidth: 280 }}
                      >
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: meta.dot }} />
                          <span className="text-[10px] uppercase tracking-wider" style={{ color: meta.text }}>
                            {meta.label}
                          </span>
                        </div>
                        <div className="whitespace-pre-wrap text-foreground/80 leading-relaxed">
                          {a?.content?.trim() ? a.content : <span className="text-muted-foreground italic">—</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr style={{ background: "hsl(var(--muted))" }}>
                <td
                  className="p-4 align-top text-sm font-display font-semibold sticky left-0"
                  style={{ color: BORDEAUX, background: "hsl(var(--muted))" }}
                  colSpan={1 + visible.length}
                >
                  Gap-synthese
                </td>
              </tr>
              {[
                { label: "Sterk (evenaren)", field: "strong_points" as const },
                { label: "Laten liggen", field: "missed_points" as const },
                { label: "Gooodboys-edge", field: "gooodboys_edge" as const },
              ].map((row, i) => (
                <tr key={row.field} style={{ background: i % 2 ? "hsl(var(--muted))" : "hsl(var(--card))" }}>
                  <td
                    className="p-4 align-top text-sm font-medium sticky left-0"
                    style={{ background: i % 2 ? "hsl(var(--muted))" : "hsl(var(--card))", color: BORDEAUX }}
                  >
                    {row.label}
                  </td>
                  {visible.map((c) => (
                    <td
                      key={c.id}
                      className="p-4 align-top text-sm border-l whitespace-pre-wrap text-foreground/80 leading-relaxed"
                      style={{ borderColor: "hsl(var(--border))" }}
                    >
                      {c[row.field]?.trim() ? c[row.field] : <span className="text-muted-foreground italic">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
