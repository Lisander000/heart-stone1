import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Copy,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Trophy,
} from "lucide-react";
import { motion } from "framer-motion";
import { getPricing, setPricing, usePricing, useAllPricing, isSub, singleDays, singleDayPrice, singleDayPriceBundle, singlePerUnit, SUB_TIERS, tierDayPrice, subBestDayPrice, dayPrice, headlinePrice, type OfferPricing, type OfferModel } from "@/lib/offerPricing";

const BORDEAUX = "hsl(var(--primary))";
const CREAM    = "hsl(var(--primary-foreground))";
const SUN   = "hsl(var(--sun))";
const EMBER = "hsl(var(--ember))";
const money = (v: number, c = "EUR") => `${c} ${(v || 0).toFixed(2)}`;
const perDayFmt = (v: number, c = "EUR") => `${c} ${(v || 0).toFixed(2)}/dag`;

type Offer = {
  id: string;
  user_id: string;
  competitor_id: string | null;
  is_own: boolean;
  name: string;
  brand_name: string | null;
  price: number | null;
  currency: string;
  url: string | null;
  image_url: string | null;
  discount: string | null;
  bundle: string | null;
  guarantee: string | null;
  shipping: string | null;
  upsell: string | null;
  format: string | null;
  ingredients: string | null;
  target_audience: string | null;
  claims: string | null;
  ai_value_score: number | null;
  ai_positioning: string | null;
  ai_reasoning: string | null;
  ai_analyzed_at: string | null;
  created_at: string;
  updated_at: string;
};

type Competitor = { id: string; name: string };

type Comparison = {
  id: string;
  offer_ids: string[];
  winners: Record<string, string>;
  summary: string | null;
  created_at: string;
};

const POSITIONING_META: Record<string, { label: string; bg: string; text: string }> = {
  premium: { label: "Premium", bg: "hsl(var(--primary))", text: "hsl(var(--primary-foreground))" },
  mid: { label: "Mid", bg: "hsl(var(--muted))", text: "hsl(var(--muted-foreground))" },
  budget: { label: "Budget", bg: "hsl(var(--ok) / 0.15)", text: "hsl(var(--ok))" },
  "value-leader": { label: "Value leader", bg: "hsl(var(--sun) / 0.18)", text: "hsl(var(--ember))" },
};

const CURRENCIES = ["EUR", "USD", "GBP"];

const CRITERIA = [
  { key: "model", label: "Verkoopmodel" },
  { key: "day_price", label: "Prijs / dag (beste)" },
  { key: "price30", label: "Abo 30 dagen" },
  { key: "price90", label: "Abo 90 dagen" },
  { key: "price180", label: "Abo 180 dagen" },
  { key: "singleref30", label: "Single buy 30 dagen" },
  { key: "singleref90", label: "Single buy 90 dagen" },
  { key: "singleref180", label: "Single buy 180 dagen" },
  { key: "total", label: "Prijs totaal (single)" },
  { key: "bundle", label: "Bundelkorting" },
  { key: "grams", label: "Gram / stuk" },
  { key: "perday", label: "Aantal / dag" },
] as const;

const WINNER_KEY_FOR_CRITERION: Record<string, string> = {};
// criteria where the lowest value wins (computed locally, cheapest = best)
const LOWEST_WINS = new Set(["day_price", "price30", "price90", "price180", "singleref30", "singleref90", "singleref180"]);

function formatPrice(o: Offer) {
  if (o.price == null) return "—";
  return `${o.currency} ${Number(o.price).toFixed(2)}`;
}

function emptyOffer(): Partial<Offer> {
  return {
    name: "",
    brand_name: "",
    price: null,
    currency: "EUR",
    url: "",
    image_url: "",
    competitor_id: null,
    is_own: false,
    discount: "",
    bundle: "",
    guarantee: "",
    shipping: "",
    upsell: "",
    format: "",
    ingredients: "",
    target_audience: "",
    claims: "",
  };
}

export default function Offers() {
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [selectedCompare, setSelectedCompare] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  // Price-point test folders (saved offer sets) — local per browser.
  const [folders, setFolders] = useState<{ id: string; name: string; offerIds: string[] }[]>(() => {
    try { return JSON.parse(localStorage.getItem("gb_offer_folders") || "[]"); } catch { return []; }
  });
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const saveFolders = (f: typeof folders) => { setFolders(f); try { localStorage.setItem("gb_offer_folders", JSON.stringify(f)); } catch { /* ignore */ } };

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [offersRes, compRes, cmpRes] = await Promise.all([
      supabase.from("offers").select("*").order("created_at", { ascending: true }),
      supabase.from("competitors").select("id, name").order("name"),
      supabase
        .from("offer_comparisons")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (offersRes.error) {
      toast({ title: "Kon offers niet laden", description: offersRes.error.message, variant: "destructive" });
    } else {
      const rows = (offersRes.data ?? []) as Offer[];
      setOffers(rows);
      setSelectedCompare(new Set(rows.map((o) => o.id)));
    }
    if (!compRes.error) setCompetitors((compRes.data ?? []) as Competitor[]);
    if (!cmpRes.error && cmpRes.data) setComparison(cmpRes.data as Comparison);
    setLoading(false);
  }

  async function saveOffer(draft: Partial<Offer>, pricing: OfferPricing, id?: string) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const payload: any = {
      name: (draft.name ?? "").trim(),
      brand_name: (draft.brand_name ?? "").trim() || null,
      price: headlinePrice(pricing),
      currency: draft.currency || "EUR",
      url: (draft.url ?? "").trim() || null,
      image_url: (draft.image_url ?? "").trim() || null,
      competitor_id: draft.competitor_id || null,
      is_own: !!draft.is_own,
      discount: (draft.discount ?? "").trim() || null,
      bundle: (draft.bundle ?? "").trim() || null,
      guarantee: (draft.guarantee ?? "").trim() || null,
      shipping: (draft.shipping ?? "").trim() || null,
      upsell: (draft.upsell ?? "").trim() || null,
      format: (draft.format ?? "").trim() || null,
      ingredients: (draft.ingredients ?? "").trim() || null,
      target_audience: (draft.target_audience ?? "").trim() || null,
      claims: (draft.claims ?? "").trim() || null,
    };

    // ensure only one is_own
    if (payload.is_own) {
      await supabase.from("offers").update({ is_own: false }).eq("user_id", userId).neq("id", id ?? "00000000-0000-0000-0000-000000000000");
    }

    if (id) {
      const { data, error } = await supabase.from("offers").update(payload).eq("id", id).select("*").single();
      if (error) {
        toast({ title: "Opslaan mislukt", description: error.message, variant: "destructive" });
        return false;
      }
      setOffers((prev) => prev.map((o) => (o.id === id ? (data as Offer) : { ...o, is_own: payload.is_own && o.id !== id ? false : o.is_own })));
      setPricing(id, pricing);
    } else {
      const { data, error } = await supabase
        .from("offers")
        .insert({ ...payload, user_id: userId })
        .select("*")
        .single();
      if (error) {
        toast({ title: "Aanmaken mislukt", description: error.message, variant: "destructive" });
        return false;
      }
      setOffers((prev) => [...prev.map((o) => (payload.is_own ? { ...o, is_own: false } : o)), data as Offer]);
      setSelectedCompare((prev) => new Set(prev).add((data as Offer).id));
      setPricing((data as Offer).id, pricing);
    }
    return true;
  }

  async function duplicateOffer(o: Offer) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { id, created_at, updated_at, ai_analyzed_at, ai_positioning, ai_reasoning, ai_value_score, ...rest } = o;
    const { data, error } = await supabase
      .from("offers")
      .insert({ ...rest, is_own: false, name: `${o.name} (kopie)`, user_id: userId })
      .select("*")
      .single();
    if (error) {
      toast({ title: "Dupliceren mislukt", description: error.message, variant: "destructive" });
      return;
    }
    setOffers((prev) => [...prev, data as Offer]);
    setSelectedCompare((prev) => new Set(prev).add((data as Offer).id));
    setPricing((data as Offer).id, getPricing(o.id)); // carry supplement pricing to the copy
  }

  async function removeOffer(id: string) {
    const { error } = await supabase.from("offers").delete().eq("id", id);
    if (error) {
      toast({ title: "Verwijderen mislukt", description: error.message, variant: "destructive" });
      return;
    }
    setOffers((prev) => prev.filter((o) => o.id !== id));
    setSelectedCompare((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setDeleteId(null);
  }

  async function runAnalysis() {
    const ids = offers.filter((o) => selectedCompare.has(o.id)).map((o) => o.id);
    if (ids.length < 2) {
      toast({ title: "Minstens 2 offers nodig", description: "Selecteer 2 of meer offers om te vergelijken." });
      return;
    }
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-offers", {
        body: { offer_ids: ids },
      });
      if (error) throw error;
      toast({ title: "Analyse klaar", description: `${ids.length} offers geanalyseerd.` });
      await load();
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      let desc = msg;
      if (msg.includes("429")) desc = "Rate limit bereikt. Probeer het straks opnieuw.";
      else if (msg.includes("402")) desc = "Credits op. Voeg credits toe in je workspace.";
      toast({ title: "Analyse mislukt", description: desc, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleCompare(id: string) {
    setSelectedCompare((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Offers shown for the active folder (or all).
  const shownOffers = useMemo(() => {
    if (!activeFolder) return offers;
    const f = folders.find((x) => x.id === activeFolder);
    return f ? offers.filter((o) => f.offerIds.includes(o.id)) : offers;
  }, [offers, folders, activeFolder]);

  const compareOffers = useMemo(
    () => shownOffers.filter((o) => selectedCompare.has(o.id)),
    [shownOffers, selectedCompare],
  );

  // Quick compare modes.
  function selectMode(mode: "own_vs" | "comp") {
    const pool = shownOffers;
    const ids = mode === "own_vs" ? pool.map((o) => o.id) : pool.filter((o) => !o.is_own).map((o) => o.id);
    setSelectedCompare(new Set(ids));
  }

  function createFolder() {
    const name = window.prompt("Naam van de map (bv. 'Prijspunt €189 test')");
    if (!name || !name.trim()) return;
    const offerIds = selectedCompare.size ? [...selectedCompare] : shownOffers.map((o) => o.id);
    const f = { id: crypto.randomUUID(), name: name.trim(), offerIds };
    saveFolders([...folders, f]);
    setActiveFolder(f.id);
  }

  return (
    <div className="min-h-screen bg-background">
      {analyzing && (
        <div className="sticky top-0 z-40 border-b border-primary/20 bg-primary flex items-center gap-3 px-6 py-3 text-primary-foreground">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm font-medium">Offers analyseren met AI…</span>
        </div>
      )}

      {/* Premium page header */}
      <div className="border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-end justify-between gap-4 flex-wrap">
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.45, ease:[0.16,1,0.3,1] }}>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Strategy</p>
            <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight text-foreground leading-none">
              Offer-vergelijking
            </h1>
            <p className="text-sm text-muted-foreground mt-2">Prijs, mechaniek en positionering van elke concurrent, in één blik.</p>
          </motion.div>
          <motion.div
            initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }}
            transition={{ duration:0.4, delay:0.1 }}
            className="flex items-center gap-2"
          >
            <button
              onClick={runAnalysis}
              disabled={analyzing || offers.length < 2 || selectedCompare.size < 2}
              className="h-9 px-4 rounded-xl border border-border bg-card text-sm font-medium flex items-center gap-2 hover:bg-muted disabled:opacity-40 transition-all"
            >
              {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {analyzing ? "Analyseren…" : "Analyseer met AI"}
            </button>
            <button
              onClick={() => { setEditing(null); setDialogOpen(true); }}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all"
            >
              <Plus size={14} /> Nieuw offer
            </button>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="animate-spin mr-2" size={16} /> Laden…
          </div>
        ) : offers.length === 0 ? (
          <div className="border border-border rounded-2xl p-16 text-center bg-card">
            <p className="font-display italic text-lg mb-2 text-primary">Nog geen offers.</p>
            <p className="text-sm text-muted-foreground mb-6">
              Voeg offers van concurrenten toe om te vergelijken.
            </p>
            <button
              onClick={() => { setEditing(null); setDialogOpen(true); }}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all"
            >
              <Plus size={14} /> Nieuw offer
            </button>
          </div>
        ) : (
          <Tabs defaultValue="cards" className="w-full">
            {/* Price-point test folders */}
            <div className="flex items-center gap-2 flex-wrap mb-5">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground mr-1">Mappen</span>
              <button onClick={() => setActiveFolder(null)}
                className={`h-8 px-3 rounded-full text-xs font-medium transition-all ${!activeFolder ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
                Alle offers <span className="tabular-nums opacity-70">{offers.length}</span>
              </button>
              {folders.map((f) => (
                <span key={f.id} className={`h-8 pl-3 pr-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${activeFolder === f.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground"}`}>
                  <button onClick={() => { setActiveFolder(f.id); setSelectedCompare(new Set(f.offerIds)); }} className="flex items-center gap-1.5">
                    {f.name} <span className="tabular-nums opacity-70">{f.offerIds.length}</span>
                  </button>
                  <button onClick={() => { saveFolders(folders.filter((x) => x.id !== f.id)); if (activeFolder === f.id) setActiveFolder(null); }}
                    className="h-4 w-4 grid place-items-center rounded-full hover:bg-black/10" title="Map verwijderen"><X size={11} /></button>
                </span>
              ))}
              <button onClick={createFolder}
                className="h-8 px-3 rounded-full border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1">
                <Plus size={12} /> Nieuwe map
              </button>
            </div>

            <TabsList className="mb-8 bg-muted p-1 rounded-xl h-auto">
              <TabsTrigger value="cards" className="rounded-lg">Kaarten</TabsTrigger>
              <TabsTrigger value="compare" className="rounded-lg">Vergelijken</TabsTrigger>
            </TabsList>

            <TabsContent value="cards">
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {shownOffers.map((o) => (
                  <OfferCard
                    key={o.id}
                    offer={o}
                    competitor={competitors.find((c) => c.id === o.competitor_id)}
                    onEdit={() => {
                      setEditing(o);
                      setDialogOpen(true);
                    }}
                    onDuplicate={() => duplicateOffer(o)}
                    onDelete={() => setDeleteId(o.id)}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="compare">
              {/* Quick comparison modes */}
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-widest text-muted-foreground mr-1">Vergelijk:</span>
                <button onClick={() => selectMode("own_vs")}
                  className="h-8 px-3 rounded-full text-xs font-medium bg-card border border-border text-foreground hover:border-primary/40 hover:text-primary transition-all">
                  Ons vs concurrentie
                </button>
                <button onClick={() => selectMode("comp")}
                  className="h-8 px-3 rounded-full text-xs font-medium bg-card border border-border text-foreground hover:border-primary/40 hover:text-primary transition-all">
                  Concurrentie onderling
                </button>
                <button onClick={() => setSelectedCompare(new Set())}
                  className="h-8 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-all">
                  Wis
                </button>
              </div>

              <div className="mb-4 flex items-center gap-3 flex-wrap">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Toon:</span>
                {shownOffers.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedCompare.has(o.id)}
                      onCheckedChange={() => toggleCompare(o.id)}
                    />
                    <span>{o.name}</span>
                    {o.is_own && (
                      <span
                        className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: SUN, color: "hsl(var(--foreground))" }}
                      >
                        eigen
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <CompareMatrix offers={compareOffers} winners={comparison?.winners ?? {}} />
              {comparison?.summary && (
                <div
                  className="mt-8 rounded-lg border p-6"
                  style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={16} style={{ color: EMBER }} />
                    <h3 className="font-display text-xl font-semibold" style={{ color: BORDEAUX }}>
                      Gooodboys-advies
                    </h3>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{comparison.summary}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-4">
                    Laatste analyse: {new Date(comparison.created_at).toLocaleString("nl-BE")}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <OfferDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        competitors={competitors}
        initial={editing}
        onSave={async (draft, pricing) => {
          const ok = await saveOffer(draft, pricing, editing?.id);
          if (ok) setDialogOpen(false);
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Offer verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze actie kan niet ongedaan gemaakt worden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && removeOffer(deleteId)}
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

function OfferCard({
  offer,
  competitor,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  offer: Offer;
  competitor?: Competitor;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const pos = offer.ai_positioning ? POSITIONING_META[offer.ai_positioning] : null;
  const isStale =
    offer.ai_analyzed_at && new Date(offer.updated_at) > new Date(offer.ai_analyzed_at);
  const pricing = usePricing(offer.id);
  const sub = isSub(pricing);
  const dp = dayPrice(pricing);

  return (
    <div
      className="rounded-lg border overflow-hidden flex flex-col"
      style={{
        borderColor: offer.is_own ? SUN : "hsl(var(--border))",
        background: "hsl(var(--card))",
        borderWidth: offer.is_own ? 2 : 1,
      }}
    >
      {offer.image_url && (
        <div className="aspect-video w-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
          <img src={offer.image_url} alt={offer.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-lg font-semibold truncate" style={{ color: BORDEAUX }}>
                {offer.name}
              </h3>
              {offer.is_own && (
                <Badge style={{ background: SUN, color: "hsl(var(--foreground))" }} className="text-[10px] uppercase tracking-wider">
                  <Star size={10} className="mr-1" /> Eigen
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {offer.brand_name || competitor?.name || "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-semibold" style={{ color: BORDEAUX }}>
              {formatPrice(offer)}
            </p>
          </div>
        </div>

        {pos && (
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: pos.bg, color: pos.text }}
            >
              {pos.label}
            </span>
            {offer.ai_value_score != null && (
              <span className="text-xs text-muted-foreground">
                Value {Math.round(offer.ai_value_score)}/100
              </span>
            )}
            {isStale && (
              <span className="text-[10px] uppercase tracking-wider text-amber-700">
                verouderd
              </span>
            )}
          </div>
        )}

        {offer.ai_reasoning && (
          <p className="text-sm italic text-foreground/70 leading-relaxed">{offer.ai_reasoning}</p>
        )}

        <div className="text-xs space-y-1.5 pt-2 border-t" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={sub ? { background: "hsl(var(--ok) / 0.15)", color: "hsl(var(--ok))" } : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>{sub ? "Abonnement" : "Single buy"}</span>
          </div>
          {dp > 0 ? (
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Prijs / dag</span><span className="font-semibold" style={{ color: EMBER }}>{perDayFmt(dp, offer.currency)}</span></div>
          ) : <p className="text-muted-foreground italic">Nog geen prijzen — klik Bewerken.</p>}
          {sub ? (
            <>
              {pricing.price30 != null && <div className="flex items-center justify-between"><span className="text-muted-foreground">30 dagen</span><span className="tabular-nums text-foreground/80">{money(pricing.price30, offer.currency)}</span></div>}
              {pricing.price90 != null && <div className="flex items-center justify-between"><span className="text-muted-foreground">90 dagen</span><span className="tabular-nums text-foreground/80">{money(pricing.price90, offer.currency)}</span></div>}
              {pricing.price180 != null && <div className="flex items-center justify-between"><span className="text-muted-foreground">180 dagen</span><span className="tabular-nums text-foreground/80">{money(pricing.price180, offer.currency)}</span></div>}
              {(pricing.singleRef30 != null || pricing.singleRef90 != null || pricing.singleRef180 != null) && (
                <div className="flex items-center justify-between text-muted-foreground gap-2">
                  <span className="shrink-0">Single buy <span className="opacity-60">· ref</span></span>
                  <span className="tabular-nums text-right">{[[30, pricing.singleRef30], [90, pricing.singleRef90], [180, pricing.singleRef180]].filter(([, v]) => v != null).map(([d, v]) => `${d}d ${money(v as number, offer.currency)}`).join(" · ")}</span>
                </div>
              )}
            </>
          ) : (
            <>
              {singlePerUnit(pricing) > 0 && <div className="flex items-center justify-between"><span className="text-muted-foreground">Prijs / stuk</span><span className="tabular-nums text-foreground/80">{money(singlePerUnit(pricing), offer.currency)}</span></div>}
              {pricing.total != null && <div className="flex items-center justify-between"><span className="text-muted-foreground">Totaal</span><span className="tabular-nums text-foreground/80">{money(pricing.total, offer.currency)}{pricing.units ? ` · ${pricing.units} stuks` : ""}</span></div>}
              {pricing.bundleDiscount ? <div className="flex items-center justify-between text-muted-foreground"><span>Met bundelkorting ({pricing.bundleDiscount}%)</span><span className="tabular-nums">{perDayFmt(singleDayPriceBundle(pricing), offer.currency)}</span></div> : null}
            </>
          )}
          <div className="text-[11px] text-muted-foreground pt-0.5">{pricing.gramsPerUnit != null ? `${pricing.gramsPerUnit} g/stuk` : "—"} · {pricing.perDay != null ? `${pricing.perDay}/dag` : "—"}</div>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-3">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil size={12} /> Bewerken
          </Button>
          <Button size="sm" variant="ghost" onClick={onDuplicate}>
            <Copy size={12} />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive">
            <Trash2 size={12} />
          </Button>
          {offer.url && (
            <a
              href={offer.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
            >
              bron ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function CompareMatrix({
  offers,
  winners,
}: {
  offers: Offer[];
  winners: Record<string, string>;
}) {
  const allPricing = useAllPricing();
  const P = (o: Offer) => allPricing[o.id] ?? {};
  const metric = (o: Offer, key: string): number | null => {
    const p = P(o); const sub = isSub(p);
    if (key === "day_price") { const d = dayPrice(p); return d > 0 ? d : null; }
    if (key === "price30") return sub && p.price30 ? p.price30 : null;
    if (key === "price90") return sub && p.price90 ? p.price90 : null;
    if (key === "price180") return sub && p.price180 ? p.price180 : null;
    if (key === "singleref30") return sub && p.singleRef30 ? p.singleRef30 : null;
    if (key === "singleref90") return sub && p.singleRef90 ? p.singleRef90 : null;
    if (key === "singleref180") return sub && p.singleRef180 ? p.singleRef180 : null;
    if (key === "per_unit") { if (sub) return null; const v = singlePerUnit(p); return v > 0 ? v : null; }
    return null;
  };
  const localWinner = (key: string): string | undefined => {
    let best: { id: string; v: number } | null = null;
    for (const o of offers) { const v = metric(o, key); if (v != null && v > 0 && (!best || v < best.v)) best = { id: o.id, v }; }
    return best?.id;
  };

  if (offers.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-12">
        Selecteer offers hierboven om te vergelijken.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "hsl(var(--muted))" }}>
            <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium sticky left-0" style={{ background: "hsl(var(--muted))" }}>
              Criterium
            </th>
            {offers.map((o) => (
              <th
                key={o.id}
                className="text-left px-4 py-3 font-display font-semibold min-w-[180px]"
                style={{ color: BORDEAUX }}
              >
                <div className="flex items-center gap-1.5">
                  {o.name}
                  {o.is_own && (
                    <span className="text-[9px] uppercase tracking-wider px-1 rounded" style={{ background: SUN, color: "hsl(var(--foreground))" }}>
                      eigen
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground font-normal font-sans">
                  {o.brand_name}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CRITERIA.map((c) => {
            const winnerId = LOWEST_WINS.has(c.key)
              ? localWinner(c.key)
              : (WINNER_KEY_FOR_CRITERION[c.key] ? winners[WINNER_KEY_FOR_CRITERION[c.key]] : undefined);
            return (
              <tr key={c.key} className="border-t" style={{ borderColor: "hsl(var(--border))" }}>
                <td className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground font-medium sticky left-0 bg-card align-top">
                  {c.label}
                </td>
                {offers.map((o) => {
                  const p = P(o);
                  const isWinner = winnerId && winnerId === o.id;
                  const sub = isSub(p);
                  let content: any = "—";
                  if (c.key === "model") content = sub ? "Abonnement" : "Single buy";
                  else if (c.key === "day_price") { const d = dayPrice(p); content = d > 0 ? perDayFmt(d, o.currency) : "—"; }
                  else if (c.key === "price30") content = sub && p.price30 ? `${money(p.price30, o.currency)} · ${perDayFmt(tierDayPrice(p.price30, 30), o.currency)}` : "—";
                  else if (c.key === "price90") content = sub && p.price90 ? `${money(p.price90, o.currency)} · ${perDayFmt(tierDayPrice(p.price90, 90), o.currency)}` : "—";
                  else if (c.key === "price180") content = sub && p.price180 ? `${money(p.price180, o.currency)} · ${perDayFmt(tierDayPrice(p.price180, 180), o.currency)}` : "—";
                  else if (c.key === "singleref30") content = sub && p.singleRef30 ? `${money(p.singleRef30, o.currency)} · ${perDayFmt(tierDayPrice(p.singleRef30, 30), o.currency)}` : "—";
                  else if (c.key === "singleref90") content = sub && p.singleRef90 ? `${money(p.singleRef90, o.currency)} · ${perDayFmt(tierDayPrice(p.singleRef90, 90), o.currency)}` : "—";
                  else if (c.key === "singleref180") content = sub && p.singleRef180 ? `${money(p.singleRef180, o.currency)} · ${perDayFmt(tierDayPrice(p.singleRef180, 180), o.currency)}` : "—";
                  else if (c.key === "per_unit") content = !sub && singlePerUnit(p) > 0 ? `${money(singlePerUnit(p), o.currency)}/stuk` : "—";
                  else if (c.key === "total") content = sub ? "—" : (p.total ? money(p.total, o.currency) : "—");
                  else if (c.key === "bundle") content = !sub && p.bundleDiscount ? `${p.bundleDiscount}%` : "—";
                  else if (c.key === "grams") content = p.gramsPerUnit != null ? `${p.gramsPerUnit} g` : "—";
                  else if (c.key === "perday") content = p.perDay != null ? String(p.perDay) : "—";
                  return (
                    <td
                      key={o.id}
                      className="px-4 py-3 align-top text-sm"
                      style={isWinner ? { background: "hsl(var(--sun) / 0.15)" } : undefined}
                    >
                      <div className="flex items-start gap-1.5">
                        {isWinner && <Trophy size={12} style={{ color: EMBER, flexShrink: 0, marginTop: 2 }} />}
                        <span className="whitespace-pre-wrap break-words">{content}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OfferDialog({
  open,
  onOpenChange,
  competitors,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  competitors: Competitor[];
  initial: Offer | null;
  onSave: (draft: Partial<Offer>, pricing: OfferPricing) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Partial<Offer>>(emptyOffer());
  const [pricing, setPricingState] = useState<OfferPricing>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(initial ? { ...initial } : emptyOffer());
      setPricingState(initial ? getPricing(initial.id) : {});
    }
  }, [open, initial]);

  function set<K extends keyof Offer>(k: K, v: any) {
    setDraft((d) => ({ ...d, [k]: v }));
  }
  const setP = (patch: Partial<OfferPricing>) => setPricingState((p) => ({ ...p, ...patch }));
  const numP = (k: keyof OfferPricing) => (e: any) => setP({ [k]: e.target.value === "" ? undefined : Number(e.target.value) } as any);
  const cur = draft.currency || "EUR";
  const model: OfferModel = pricing.model ?? "single";
  const sub = model === "subscription";

  async function submit() {
    if (!draft.name?.trim()) return;
    setSaving(true);
    await onSave(draft, pricing);
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Offer bewerken" : "Nieuw offer"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <section className="space-y-3">
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground">Basis</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Naam *</Label>
                <Input value={draft.name ?? ""} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Merk</Label>
                <Input value={draft.brand_name ?? ""} onChange={(e) => set("brand_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Koppel aan concurrent</Label>
                <Select
                  value={draft.competitor_id ?? "none"}
                  onValueChange={(v) => set("competitor_id", v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— geen —</SelectItem>
                    {competitors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valuta</Label>
                <Select value={draft.currency ?? "EUR"} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="col-span-2 flex items-center gap-2 text-sm cursor-pointer pt-1">
                <Checkbox checked={!!draft.is_own} onCheckedChange={(v) => set("is_own", !!v)} />
                <span>Dit is mijn eigen Gooodboys-offer</span>
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase tracking-widest text-muted-foreground">Verkoopmodel</h4>
              <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: "hsl(var(--muted))" }}>
                {([["Single buy", "single"], ["Abonnement", "subscription"]] as const).map(([lbl, val]) => (
                  <button key={val} type="button" onClick={() => setP({ model: val })}
                    className={`h-7 px-3 rounded-md text-[11px] font-semibold transition-colors ${model === val ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{lbl}</button>
                ))}
              </div>
            </div>

            {/* shared product info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Gram per stuk</Label><Input type="number" step="0.1" value={pricing.gramsPerUnit ?? ""} placeholder="bv. 5" onChange={numP("gramsPerUnit")} /></div>
              <div className="space-y-1.5"><Label>Aantal per dag</Label><Input type="number" step="1" value={pricing.perDay ?? ""} placeholder="1" onChange={numP("perDay")} /></div>
            </div>

            {!sub ? (
              /* ── SINGLE BUY ── */
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5"><Label>Prijs totaal ({cur})</Label><Input type="number" step="0.01" value={pricing.total ?? ""} placeholder="bv. 45" onChange={numP("total")} /></div>
                  <div className="space-y-1.5"><Label>Aantal stuks</Label><Input type="number" step="1" value={pricing.units ?? ""} placeholder="bv. 60" onChange={numP("units")} /></div>
                  <div className="space-y-1.5"><Label>Bundelkorting (%)</Label><Input type="number" step="1" value={pricing.bundleDiscount ?? ""} placeholder="0" onChange={numP("bundleDiscount")} /></div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {singleDays(pricing) > 0 && <span className="rounded-full px-2.5 py-1" style={{ background: "hsl(var(--muted))" }}>{Math.round(singleDays(pricing))} dagen supply</span>}
                  {singleDayPrice(pricing) > 0 && <span className="rounded-full px-2.5 py-1 font-medium" style={{ background: "hsl(var(--sun) / 0.18)", color: EMBER }}>{perDayFmt(singleDayPrice(pricing), cur)}</span>}
                  {singlePerUnit(pricing) > 0 && <span className="rounded-full px-2.5 py-1" style={{ background: "hsl(var(--muted))" }}>{money(singlePerUnit(pricing), cur)} / stuk</span>}
                  {(pricing.bundleDiscount ?? 0) > 0 && singleDayPrice(pricing) > 0 && <span className="rounded-full px-2.5 py-1" style={{ background: "hsl(var(--ok) / 0.15)", color: "hsl(var(--ok))" }}>met bundel: {perDayFmt(singleDayPriceBundle(pricing), cur)}</span>}
                </div>
              </>
            ) : (
              /* ── SUBSCRIPTION ── */
              <>
                <div className="grid grid-cols-3 gap-3">
                  {SUB_TIERS.map((t) => (
                    <div key={t.key} className="space-y-1.5">
                      <Label>Prijs {t.label} ({cur})</Label>
                      <Input type="number" step="0.01" value={(pricing as any)[t.key] ?? ""} placeholder="prijs" onChange={numP(t.key)} />
                      <p className="text-[11px] h-4" style={{ color: EMBER }}>{(pricing as any)[t.key] ? perDayFmt(tierDayPrice((pricing as any)[t.key], t.days), cur) : ""}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label>Single buy prijs <span className="text-muted-foreground font-normal">· per periode, referentie (geen berekening)</span></Label>
                  <div className="grid grid-cols-3 gap-3">
                    {([["singleRef30", "30 dagen"], ["singleRef90", "90 dagen"], ["singleRef180", "180 dagen"]] as const).map(([k, l]) => (
                      <Input key={k} type="number" step="0.01" value={(pricing as any)[k] ?? ""} placeholder={l} onChange={numP(k)} />
                    ))}
                  </div>
                </div>
                {subBestDayPrice(pricing) > 0 && <span className="inline-block rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "hsl(var(--sun) / 0.18)", color: EMBER }}>beste prijs/dag: {perDayFmt(subBestDayPrice(pricing), cur)}</span>}
              </>
            )}
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button
            onClick={submit}
            disabled={!draft.name?.trim() || saving}
            style={{ background: BORDEAUX, color: CREAM }}
            className="hover:opacity-90"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {initial ? "Opslaan" : "Toevoegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
