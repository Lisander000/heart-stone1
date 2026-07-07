import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, stagger } from "@/lib/motion";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { ConfirmDelete } from "@/components/ConfirmDelete";

/* ─── types ──────────────────────────────────────────────────────────────── */
type Awareness = { stage: string; thinks: string; feels: string; questions: string; channelFit: string; approach: string };
type Angle = { headline: string; funnel: string; why: string };
type Evidence = { quote: string; source: string };
type Persona = {
  id: string; name: string; tagline: string;
  demographics: { age: string; income: string; location: string; household: string; education: string; lifestyle: string };
  goals: string[]; fears: string[];
  buyingBehavior: string; channels: string;
  dataEvidence: Evidence[]; awareness: Awareness[]; topAngles: Angle[];
};

/* ─── seed (the two existing personas) ───────────────────────────────────── */
const SEED: Persona[] = [
  {
    id: "aesthetic", name: "The Aesthetic", tagline: "Hond en eigenaar als visueel geheel.",
    demographics: {
      age: "25–40 jaar", income: "Modaal tot bovenmodaal",
      location: "(Voor)stedelijk — Antwerpen, Brussel, Amsterdam, Berlijn, Kopenhagen",
      household: "Koppel of alleenstaand, 1 hond", education: "Creatieve richting of HBO+",
      lifestyle: "Design-bewust in alles: interieur, kleding, koffie, restaurants. Volgt ALD, Sporty & Rich, Aesop, Kinfolk op Instagram. Denkt in esthetische systemen — kleuren moeten matchen, stijl moet consistent zijn.",
    },
    goals: ["Hond en eigenaar als visueel geheel","Producten die passen bij interieur en persoonlijke stijl","Complimenten krijgen tijdens wandelingen","Seizoensgebonden vernieuwing zonder kwaliteitsverlies"],
    fears: ["Goedkope generieke pet store look","Babytalk branding en cartoon graphics","Producten die niet bij hun esthetiek passen","Overdreven girly of overdreven rugged — ze willen gender-neutraal verfijnd"],
    buyingBehavior: "Snellere beslisser. Koopt op visueel gevoel. Scrollt Instagram, ziet iets moois, klikt door. Koopt vaak meerdere kleuren. Seizoensgebonden koopgedrag.",
    channels: "Instagram (primair), Pinterest, TikTok lifestyle, design blogs. Reageert sterk op visuele ads.",
    dataEvidence: [
      { quote: "I am absolutely in love with my raincoat, which matches my dog's raincoat!!", source: "PAIKKA review" },
      { quote: "visually it fits really well in the apartment", source: "Cloud 7 review" },
      { quote: "we don't get stopped and asked about the jacket", source: "Maxbone review" },
      { quote: "I have 3 colors to go with all my outfits", source: "Maxbone review" },
    ],
    awareness: [
      { stage: "Unaware", thinks: "Mijn hond heeft een halsband van de dierenwinkel. Het werkt.", feels: "Milde, onbewuste onvrede — past niet bij hun stijl maar nog niet gearticuleerd.", questions: "Geen — ze zoeken niet.", channelFit: "TOF ad · Instagram organic", approach: "Pure sfeer. 60-seconde video: hond en eigenaar op Antwerpse kasseien, ochtendlicht, matching aardtinten. Geen tekst. Geen logo tot laatste 3 seconden." },
      { stage: "World Aware", thinks: "Wacht — er bestaan hondenspullen die er zo uitzien?", feels: "Verlangen. 'Dit is wat ik wilde maar niet wist te zoeken.'", questions: "Welke kleuren zijn er? Hoe ziet het eruit in context?", channelFit: "TOF ad · Instagram carousel · Pinterest", approach: "Walk/Live/Play carousel. Drie sferen, drie kleurpaletten. Lifestyle fotografie, geen productfoto's, geen prijzen." },
      { stage: "Identity Aware", thinks: "Dit merk is voor mensen zoals ik. Niet de typische 'dog mom' esthetiek.", feels: "Herkenning en belonging. 'Eindelijk een pet brand dat niet babytalk doet.'", questions: "Wie zijn de andere mensen die dit kopen?", channelFit: "MOF retargeting · email welcome · Instagram stories", approach: "Gooodboys Family ambassadeurs. Echte mensen: architect met Whippet, designer met rescue. 'You'll know if you're one of us.'" },
      { stage: "Product Aware", thinks: "The Mayor in Tomato. Dat is de kleur. Past bij mijn jas en mijn bank.", feels: "Verlangen naar specifiek product. Visualiseert het al in hun leven.", questions: "Is de kleur in het echt zoals op foto? Hoe voelt het materiaal?", channelFit: "BOF retargeting · productpagina", approach: "Gedetailleerde productfotografie met kleur-accuracy. 'How it looks at home' sectie. User-generated foto's in werkelijke interieurs." },
      { stage: "Most Aware", thinks: "Ik wil The Walk Kit in Tomato. Nu. Voordat de kleur weg is.", feels: "Schaarste-urgentie, niet prijs-urgentie.", questions: "Is deze colorway seizoensgebonden? Komt het terug?", channelFit: "BOF email · Drop launch · member-only preview", approach: "Seizoensgebonden schaarste. 'Tomato is Spring 2026. When it's gone, it's gone.' Geen korting. Monthly Drop met member-first access." },
    ],
    topAngles: [
      { headline: "The pet industry has been beige for too long.", funnel: "TOF", why: "Culturele herkenning — stopt de scroll door gedeelde frustratie" },
      { headline: "Stop assembling your dog's gear from five brands.", funnel: "TOF/MOF", why: "Format remix — articuleerde onbenoemde frustratie" },
      { headline: "Walk. Live. Play. Your palette.", funnel: "MOF", why: "Design systeem — werkt voor wie de wereld al kent" },
      { headline: "Tomato is Spring 2026. When it's gone, it's gone.", funnel: "BOF", why: "Seizoensschaarste als conversie trigger" },
    ],
  },
  {
    id: "lover", name: "The Lover", tagline: "Doet alles voor hun hond en is er trots op.",
    demographics: {
      age: "24–38 jaar", income: "Modaal — besteedt disproportioneel aan hun hond",
      location: "Stedelijk, actief op social media",
      household: "Alleenstaand of koppel, 1 hond die behandeld wordt als persoonlijkheid",
      education: "Variabel — lifestyle-gedreven",
      lifestyle: "De hond is het middelpunt. Heeft een honden-Instagram. Praat over de hond op feestjes. Kent het verschil tussen goede en slechte hondenvoeding. De hond is een extensie van hun eigen identiteit.",
    },
    goals: ["De beste dingen voor hun hond, openlijk en zonder excuus","Validatie dat geobsedeerd zijn door je hond cool is, niet raar","Producten die het waard zijn om over te posten","Een merk dat hun obsessie begrijpt en bevestigt"],
    fears: ["Gezien worden als 'crazy dog person' in negatieve zin","Producten die het geld niet waard zijn","Merken die hun passie niet serieus nemen","Het gevoel dat ze te veel geven om iets dat 'maar een hond' is"],
    buyingBehavior: "Impulsieve koper. Ziet iets, voelt het, koopt het. Deelt op social media. Hoge CLV wanneer emotionele band met merk sterk is. Evangelical — vertelt vrienden, post unboxing.",
    channels: "TikTok (dominant), Instagram Reels, Reddit (r/dogs), referrals van vrienden. Reageert sterk op UGC en humor.",
    dataEvidence: [
      { quote: "He only eats the best — and he's made it clear this one passes the test", source: "Maxbone review" },
      { quote: "I'm honestly obsessed with everything Maxbone", source: "Maxbone review" },
      { quote: "Every time they release a new color, we HAVE to have it!", source: "Maxbone review" },
      { quote: "His wardrobe has had a serious upgrade", source: "Maxbone review" },
    ],
    awareness: [
      { stage: "Unaware", thinks: "Ik doe al veel voor mijn hond. De spullen koop ik gewoon bij de pet store.", feels: "Tevreden met hun zorg maar hebben het 'gear' aspect nog niet opgewaardeerd.", questions: "Geen.", channelFit: "TOF ad op TikTok · Instagram Reels · UGC-stijl", approach: "Herkenning via humor. 30-seconde TikTok: 'Things I do for my dog that I don't do for myself.' De scroll-stop is herkenning: 'dat ben ik.'" },
      { stage: "World Aware", thinks: "Er is een merk dat snapt dat ik niet gek ben?", feels: "Validatie. 'Eindelijk iemand die het niet raar vindt.'", questions: "Wat is dit merk? Zijn er meer mensen zoals ik hier?", channelFit: "TOF ad type 2 · TikTok · Instagram community", approach: "Community-first content. Niet product tonen maar mensen tonen. Eindframe: 'We get it. Gooodboys.'" },
      { stage: "Identity Aware", thinks: "Dit is mijn merk. Deze mensen zijn mijn mensen.", feels: "Belonging. Trots. 'Ik wil hier bij horen.'", questions: "Hoe word ik deel van dit? Is er een community?", channelFit: "MOF retargeting · email welcome · Club content", approach: "Club als identity marker. 'The Gooodboys Club. For people who already know they're doing too much.'" },
      { stage: "Product Aware", thinks: "The Walk Kit. Alles in één. €189. Mijn hond verdient dit.", feels: "Emotioneel geladen. Dit is niet rationeel — het is een daad van liefde.", questions: "Hoe snel wordt het geleverd? Kan ik het posten?", channelFit: "BOF retargeting · productpagina · landing page /club", approach: "UGC van klanten die hun aankoop tonen. Unboxing moments. 'Your dog doesn't know what this costs. You do. That's fine.'" },
      { stage: "Most Aware", thinks: "Ik koop dit. En ik ga het posten. En ik ga het aan iedereen vertellen.", feels: "Klaar. Enthousiast. Dit wordt een moment.", questions: "Is er een referral? Kan ik iets voor mijn vriend(in)'s hond meenemen?", channelFit: "BOF email · Drop launch · referral program", approach: "Referral incentive: 'Share with your dog-obsessed friend. Both get 15% off.' Plus post-purchase: 'If you post your dog, tag us.'" },
    ],
    topAngles: [
      { headline: "For people who do too much for their dog. And know it.", funnel: "TOF", why: "Identiteitsvalidatie — stopt de scroll door herkenning" },
      { headline: "Your dog doesn't know what this costs. You do. That's fine.", funnel: "MOF/BOF", why: "Verwijdert de schuldvraag die Lovers soms voelen" },
      { headline: "We get it.", funnel: "TOF", why: "Twee woorden die zeggen: jij bent niet gek, jij bent thuis" },
      { headline: "Once a month, something arrives. Your dog didn't have to ask.", funnel: "BOF", why: "Club als het logische eindpunt" },
    ],
  },
];

const LS = "gb_icp_personas";
const blankAwareness = (): Awareness => ({ stage: "Nieuwe stage", thinks: "", feels: "", questions: "", channelFit: "", approach: "" });
const blankPersona = (): Persona => ({
  id: crypto.randomUUID(), name: "Nieuwe ICP", tagline: "",
  demographics: { age: "", income: "", location: "", household: "", education: "", lifestyle: "" },
  goals: [], fears: [], buyingBehavior: "", channels: "", dataEvidence: [], awareness: [], topAngles: [],
});

const TABS = [
  { id: "profile",   label: "Profiel" },
  { id: "awareness", label: "Awareness stages" },
  { id: "angles",    label: "Top angles" },
] as const;

/* ─── tiny inline editors ────────────────────────────────────────────────── */
const IN = "w-full bg-muted/60 border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-ring/50 focus:bg-card transition-colors";
function TIn({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={IN} />;
}
function TArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea value={value} placeholder={placeholder} rows={rows} onChange={(e) => onChange(e.target.value)} className={`${IN} resize-y leading-relaxed`} />;
}

export default function ICPDocument() {
  const [personas, setPersonas] = useState<Persona[]>(() => {
    try { const r = localStorage.getItem(LS); if (r) return JSON.parse(r); } catch { /* ignore */ }
    return SEED;
  });
  const [activeId, setActiveId] = useState(() => personas[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<"profile" | "awareness" | "angles">("profile");
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(personas)); } catch { /* ignore */ } }, [personas]);

  const persona = personas.find((p) => p.id === activeId) ?? personas[0];

  const patch = (p: Partial<Persona>) => setPersonas((prev) => prev.map((x) => (x.id === activeId ? { ...x, ...p } : x)));
  const patchDemo = (d: Partial<Persona["demographics"]>) => patch({ demographics: { ...persona.demographics, ...d } });

  const addPersona = () => { const p = blankPersona(); setPersonas((prev) => [...prev, p]); setActiveId(p.id); setActiveTab("profile"); setEditing(true); };
  const delPersona = () => { setPersonas((prev) => { const next = prev.filter((p) => p.id !== activeId); setActiveId(next[0]?.id ?? ""); return next; }); setConfirmDel(false); };

  if (!persona) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="text-center">
          <p className="text-sm font-medium text-foreground mb-3">Nog geen ICP's</p>
          <button onClick={addPersona} className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-1.5"><Plus className="h-4 w-4" /> Nieuwe ICP</button>
        </div>
      </div>
    );
  }

  const idx = personas.findIndex((p) => p.id === persona.id);

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <div className="max-w-4xl mx-auto px-6 pt-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Focus ICP's</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Persona's die leven in ads, landing pages en email-segmenten. Bewerk of voeg er toe.</p>
          </motion.div>
          <button onClick={() => setEditing((e) => !e)}
            className={`h-9 px-4 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all shadow-xs ${editing ? "bg-primary text-primary-foreground shadow-sm" : "border border-border bg-card text-muted-foreground hover:text-foreground"}`}>
            {editing ? <><Check className="h-4 w-4" /> Klaar</> : <><Pencil className="h-3.5 w-3.5" /> Bewerken</>}
          </button>
        </div>

        {/* Persona switcher */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
          {personas.map((p, i) => (
            <button key={p.id} onClick={() => { setActiveId(p.id); setActiveTab("profile"); }}
              className={`group text-left p-5 rounded-2xl border-2 transition-all duration-200 ${activeId === p.id ? "border-primary bg-primary text-primary-foreground shadow-lg" : "border-border bg-card text-foreground hover:border-primary/30"}`}>
              <span className={`font-display text-4xl font-semibold leading-none block mb-3 ${activeId === p.id ? "text-primary-foreground/45" : "text-muted-foreground/30"}`}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className={`text-lg font-semibold block mb-1 ${activeId === p.id ? "text-primary-foreground" : "text-foreground"}`}>{p.name}</span>
              <span className={`text-xs block ${activeId === p.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{p.tagline || "—"}</span>
            </button>
          ))}
          <button onClick={addPersona}
            className="text-left p-5 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all grid place-items-center min-h-[128px]">
            <span className="flex flex-col items-center gap-1.5"><Plus className="h-6 w-6" /><span className="text-sm font-medium">Nieuwe ICP</span></span>
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* name/tagline editor in edit mode */}
        {editing && (
          <div className="card-soft p-4 mb-6 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">ICP {String(idx + 1).padStart(2, "0")}</p>
              <button onClick={() => setConfirmDel(true)} className="text-xs text-muted-foreground hover:text-bad flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Verwijderen</button>
            </div>
            <TIn value={persona.name} onChange={(v) => patch({ name: v })} placeholder="Naam" />
            <TIn value={persona.tagline} onChange={(v) => patch({ tagline: v })} placeholder="Tagline" />
          </div>
        )}

        {/* Tab nav */}
        <div className="flex gap-1 mb-8 p-1 bg-muted rounded-xl w-fit">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={`${activeId}-${activeTab}-${editing}`} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }} transition={{ duration:0.28 }}>

            {/* ── Profile ── */}
            {activeTab === "profile" && (
              <motion.div variants={stagger(0.04)} initial="hidden" animate="visible" className="space-y-8">
                {/* Demographics */}
                <motion.section variants={fadeUp}>
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-4">Demografie</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                    {([["Leeftijd","age"],["Inkomen","income"],["Locatie","location"],["Huishouden","household"],["Opleiding","education"]] as const).map(([label, key]) => (
                      <div key={key} className="p-3 rounded-xl border border-border bg-card">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                        {editing
                          ? <TIn value={persona.demographics[key]} onChange={(v) => patchDemo({ [key]: v } as any)} />
                          : <p className="text-sm text-foreground leading-snug">{persona.demographics[key] || "—"}</p>}
                      </div>
                    ))}
                  </div>
                  {editing
                    ? <TArea value={persona.demographics.lifestyle} onChange={(v) => patchDemo({ lifestyle: v })} placeholder="Lifestyle" rows={4} />
                    : <p className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-border pl-4">{persona.demographics.lifestyle}</p>}
                </motion.section>

                {/* Goals + Fears */}
                <motion.div variants={fadeUp} className="grid sm:grid-cols-2 gap-4">
                  <ListEditor title="Doelen" dot="bg-emerald-500" items={persona.goals} editing={editing} onChange={(v) => patch({ goals: v })} />
                  <ListEditor title="Angsten" dot="bg-red-500" items={persona.fears} editing={editing} onChange={(v) => patch({ fears: v })} />
                </motion.div>

                {/* Buying + Channels */}
                <motion.div variants={fadeUp} className="grid sm:grid-cols-2 gap-4">
                  {([["Koopgedrag","buyingBehavior"],["Favoriete kanalen","channels"]] as const).map(([title, key]) => (
                    <div key={key} className="p-4 rounded-xl border border-border bg-card">
                      <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2">{title}</h2>
                      {editing
                        ? <TArea value={persona[key]} onChange={(v) => patch({ [key]: v } as any)} rows={4} />
                        : <p className="text-sm text-foreground leading-relaxed">{persona[key] || "—"}</p>}
                    </div>
                  ))}
                </motion.div>

                {/* Data evidence */}
                <motion.section variants={fadeUp}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Data evidence</h2>
                    {editing && <AddBtn onClick={() => patch({ dataEvidence: [...persona.dataEvidence, { quote: "", source: "" }] })} />}
                  </div>
                  <div className="space-y-2">
                    {persona.dataEvidence.map((d, i) => (
                      <div key={i} className="flex gap-3 items-start p-4 rounded-xl border border-border bg-card">
                        <span className="text-lg text-muted-foreground/30 font-display leading-none mt-0.5">"</span>
                        <div className="flex-1">
                          {editing ? (
                            <div className="space-y-1.5">
                              <TArea value={d.quote} onChange={(v) => patch({ dataEvidence: persona.dataEvidence.map((x, j) => j === i ? { ...x, quote: v } : x) })} placeholder="Quote" rows={2} />
                              <TIn value={d.source} onChange={(v) => patch({ dataEvidence: persona.dataEvidence.map((x, j) => j === i ? { ...x, source: v } : x) })} placeholder="Bron" />
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-foreground leading-relaxed italic">{d.quote}</p>
                              <p className="text-[11px] text-muted-foreground mt-1">— {d.source}</p>
                            </>
                          )}
                        </div>
                        {editing && <RemoveBtn onClick={() => patch({ dataEvidence: persona.dataEvidence.filter((_, j) => j !== i) })} />}
                      </div>
                    ))}
                  </div>
                </motion.section>
              </motion.div>
            )}

            {/* ── Awareness ── */}
            {activeTab === "awareness" && (
              <motion.div variants={stagger(0.05)} initial="hidden" animate="visible" className="space-y-3">
                {persona.awareness.map((a, i) => (
                  <motion.div key={i} variants={fadeUp} className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="font-display text-2xl font-semibold text-muted-foreground/30 leading-none">{String(i + 1).padStart(2, "0")}</span>
                        {editing
                          ? <TIn value={a.stage} onChange={(v) => patch({ awareness: patchList(persona.awareness, i, { stage: v }) })} placeholder="Stage" />
                          : <span className="text-sm font-semibold text-foreground">{a.stage}</span>}
                      </div>
                      {editing
                        ? <div className="flex items-center gap-2 ml-2 shrink-0"><TIn value={a.channelFit} onChange={(v) => patch({ awareness: patchList(persona.awareness, i, { channelFit: v }) })} placeholder="Channel fit" /><RemoveBtn onClick={() => patch({ awareness: persona.awareness.filter((_, j) => j !== i) })} /></div>
                        : <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full shrink-0">{a.channelFit}</span>}
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <AwField label="Denkt" value={a.thinks} editing={editing} italic onChange={(v) => patch({ awareness: patchList(persona.awareness, i, { thinks: v }) })} />
                        <AwField label="Voelt" value={a.feels} editing={editing} onChange={(v) => patch({ awareness: patchList(persona.awareness, i, { feels: v }) })} />
                      </div>
                      <AwField label="Vragen" value={a.questions} editing={editing} muted onChange={(v) => patch({ awareness: patchList(persona.awareness, i, { questions: v }) })} />
                      <div className="p-4 rounded-xl bg-primary/[0.04] border border-border">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">Gooodboys aanpak</p>
                        {editing
                          ? <TArea value={a.approach} onChange={(v) => patch({ awareness: patchList(persona.awareness, i, { approach: v }) })} rows={3} />
                          : <p className="text-sm text-foreground leading-relaxed">{a.approach}</p>}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {editing && <button onClick={() => patch({ awareness: [...persona.awareness, blankAwareness()] })} className="w-full h-11 rounded-2xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 flex items-center justify-center gap-1.5"><Plus className="h-4 w-4" /> Stage toevoegen</button>}
              </motion.div>
            )}

            {/* ── Angles ── */}
            {activeTab === "angles" && (
              <motion.div variants={stagger(0.06)} initial="hidden" animate="visible">
                <p className="text-sm text-muted-foreground mb-6">Top marketing angles voor <strong className="text-foreground">{persona.name}</strong>, met funnel-positie en onderbouwing.</p>
                <div className="space-y-3">
                  {persona.topAngles.map((a, i) => (
                    <motion.div key={i} variants={fadeUp} className="rounded-2xl border border-border bg-card p-5 flex gap-4 items-start">
                      <span className="font-display text-2xl font-semibold text-muted-foreground/25 leading-none shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                      <div className="flex-1">
                        {editing ? (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <TIn value={a.headline} onChange={(v) => patch({ topAngles: patchList(persona.topAngles, i, { headline: v }) })} placeholder="Headline" />
                              <div className="w-28 shrink-0"><TIn value={a.funnel} onChange={(v) => patch({ topAngles: patchList(persona.topAngles, i, { funnel: v }) })} placeholder="Funnel" /></div>
                              <RemoveBtn onClick={() => patch({ topAngles: persona.topAngles.filter((_, j) => j !== i) })} />
                            </div>
                            <TArea value={a.why} onChange={(v) => patch({ topAngles: patchList(persona.topAngles, i, { why: v }) })} placeholder="Waarom werkt dit" rows={2} />
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <h3 className="font-display text-lg font-semibold italic text-foreground leading-tight">"{a.headline}"</h3>
                              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full shrink-0">{a.funnel}</span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{a.why}</p>
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {editing && <button onClick={() => patch({ topAngles: [...persona.topAngles, { headline: "", funnel: "TOF", why: "" }] })} className="w-full h-11 rounded-2xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 flex items-center justify-center gap-1.5"><Plus className="h-4 w-4" /> Angle toevoegen</button>}
                </div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <ConfirmDelete open={confirmDel} onOpenChange={setConfirmDel} onConfirm={delPersona}
        title="ICP verwijderen?" description={`"${persona.name}" wordt permanent verwijderd. Deze actie kan niet ongedaan gemaakt worden.`} />
    </div>
  );
}

/* ─── helpers ────────────────────────────────────────────────────────────── */
function patchList<T>(arr: T[], i: number, p: Partial<T>): T[] { return arr.map((x, j) => (j === i ? { ...x, ...p } : x)); }

function AddBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Toevoegen</button>;
}
function RemoveBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="shrink-0 h-7 w-7 grid place-items-center rounded-lg text-muted-foreground/50 hover:text-bad hover:bg-bad/10 transition-colors"><X className="h-4 w-4" /></button>;
}

function AwField({ label, value, editing, onChange, italic, muted }: { label: string; value: string; editing: boolean; onChange: (v: string) => void; italic?: boolean; muted?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      {editing
        ? <TArea value={value} onChange={onChange} rows={2} />
        : <p className={`text-sm leading-relaxed ${muted ? "text-muted-foreground" : "text-foreground"} ${italic ? "italic" : ""}`}>{italic ? `"${value}"` : value}</p>}
    </div>
  );
}

function ListEditor({ title, dot, items, editing, onChange }: { title: string; dot: string; items: string[]; editing: boolean; onChange: (v: string[]) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{title}</h2>
        {editing && <AddBtn onClick={() => onChange([...items, ""])} />}
      </div>
      <ul className="space-y-2">
        {items.map((g, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className={`mt-[7px] h-1.5 w-1.5 rounded-full ${dot} shrink-0`} />
            {editing
              ? <><div className="flex-1"><TIn value={g} onChange={(v) => onChange(items.map((x, j) => j === i ? v : x))} /></div><RemoveBtn onClick={() => onChange(items.filter((_, j) => j !== i))} /></>
              : <span className="text-sm text-foreground leading-relaxed">{g}</span>}
          </li>
        ))}
        {items.length === 0 && !editing && <li className="text-sm text-muted-foreground/50">—</li>}
      </ul>
    </div>
  );
}
