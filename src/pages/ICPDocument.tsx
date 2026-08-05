import { useEffect, useState, type ElementType, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, stagger } from "@/lib/motion";
import { Pencil, Plus, Trash2, Check, X, Users, Dog, User, Brain, AlertTriangle, Target, Zap, ShoppingBag, Download } from "lucide-react";
import { ConfirmDelete } from "@/components/ConfirmDelete";

/* ─── types ──────────────────────────────────────────────────────────────── */
type Awareness = { stage: string; thinks: string; feels: string; questions: string; channelFit: string; approach: string };
type Angle = { headline: string; funnel: string; why: string };
type Evidence = { quote: string; source: string };
type Persona = {
  id: string; name: string; tagline: string;
  dog: { breed: string; age: string; needs: string };
  owner: { age: string; income: string; location: string; household: string; extra: string };
  psychographics: string; coreProblem: string;
  goals: string[]; triggers: string;
  buying: { where: string; what: string; how: string };
  dataEvidence: Evidence[]; awareness: Awareness[]; topAngles: Angle[];
};

/* ─── seed (the two existing personas) ───────────────────────────────────── */
const SEED: Persona[] = [
  {
    id: "aesthetic", name: "The Aesthetic", tagline: "Hond en eigenaar als visueel geheel.",
    dog: { breed: "Whippet, Vizsla of rescue met clean look · klein tot middelgroot", age: "1–6 jaar", needs: "Rustig, elegant en fotogeniek. Moet er verzorgd uitzien en passen bij de esthetiek van hond én baasje." },
    owner: { age: "25–40 jaar", income: "Modaal tot bovenmodaal", location: "(Voor)stedelijk — Antwerpen, Brussel, Amsterdam, Berlijn, Kopenhagen", household: "Koppel of alleenstaand, 1 hond", extra: "Woont in een strak, design-bewust interieur en volgt merken als Aesop, ALD en Kinfolk. Koopt weloverwogen en hecht aan kwaliteit en een consistente uitstraling." },
    psychographics: "De hond is een verlengstuk van hun eigen esthetiek en identiteit. Spullen moeten matchen met interieur, outfit en kleurenpalet — ze denken in visuele systemen waarin stijl consistent moet zijn (ALD, Aesop, Kinfolk).",
    coreProblem: "Hondenspullen zien er goedkoop en generiek uit (babytalk branding, cartoon graphics) en passen niet bij hun verfijnde, gender-neutrale stijl.",
    goals: ["Hond en eigenaar als visueel geheel","Producten die passen bij interieur en persoonlijke stijl","Complimenten krijgen tijdens wandelingen","Seizoensgebonden vernieuwing zonder kwaliteitsverlies"],
    triggers: "Mooie beelden op Instagram, matching colorways, seizoensgebonden drops en complimenten tijdens de wandeling.",
    buying: { where: "Instagram (primair), Pinterest, TikTok lifestyle en design blogs.", what: "Meerdere kleuren, matching sets en seizoensitems — verfijnd en consistent.", how: "Snelle beslisser die op visueel gevoel koopt: ziet iets moois, klikt door en koopt vaak meteen meerdere kleuren." },
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
    dog: { breed: "Elk ras — behandeld als een persoonlijkheid · elk formaat", age: "Elke leeftijd", needs: "Het middelpunt van het gezin, vol karakter. Wil alleen het beste; producten die het waard zijn om over te posten." },
    owner: { age: "24–38 jaar", income: "Modaal — besteedt disproportioneel aan hun hond", location: "Stedelijk, actief op social media", household: "Alleenstaand of koppel, 1 hond als persoonlijkheid", extra: "Zeer actief op social media rond hun hond, deelt alles en zoekt aansluiting bij gelijkgestemden. Besteedt gul aan de hond, ook als dat 'te veel' lijkt." },
    psychographics: "De hond is een extensie van hun eigen identiteit. Heeft een honden-Instagram, praat over de hond op feestjes en kent goede van slechte hondenvoeding. Geobsedeerd — en er trots op.",
    coreProblem: "Wil gezien worden als een toegewijde baas, niet als 'crazy dog person'. Zoekt validatie dat te veel geven om je hond cool is, niet raar.",
    goals: ["De beste dingen voor hun hond, openlijk en zonder excuus","Validatie dat geobsedeerd zijn door je hond cool is, niet raar","Producten die het waard zijn om over te posten","Een merk dat hun obsessie begrijpt en bevestigt"],
    triggers: "UGC en humor ('things I do for my dog'), nieuwe kleuren en drops, validatie van een community en referrals van vrienden.",
    buying: { where: "TikTok (dominant), Instagram Reels, Reddit (r/dogs) en referrals.", what: "Premium items, nieuwe colorways en alles-in-één kits — emotioneel geladen aankopen.", how: "Impulsief en emotioneel: ziet iets, voelt het, koopt het en deelt het op social. Hoge CLV, evangelical." },
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
  dog: { breed: "", age: "", needs: "" },
  owner: { age: "", income: "", location: "", household: "", extra: "" },
  psychographics: "", coreProblem: "", goals: [], triggers: "",
  buying: { where: "", what: "", how: "" },
  dataEvidence: [], awareness: [], topAngles: [],
});

/* migrate a saved persona (old shape: demographics/fears/buyingBehavior/channels) to the new shape */
function migrate(p: any): Persona {
  const b = blankPersona();
  const d = p?.demographics ?? {};
  return {
    id: p?.id ?? b.id,
    name: p?.name ?? b.name,
    tagline: p?.tagline ?? "",
    dog: { breed: [p?.dog?.breed, p?.dog?.size].filter(Boolean).join(" · "), age: p?.dog?.age ?? "", needs: [p?.dog?.temperament, p?.dog?.needs].filter(Boolean).join(" ") },
    owner: { age: p?.owner?.age ?? d.age ?? "", income: p?.owner?.income ?? d.income ?? "", location: p?.owner?.location ?? d.location ?? "", household: p?.owner?.household ?? d.household ?? "", extra: p?.owner?.extra ?? "" },
    psychographics: p?.psychographics ?? d.lifestyle ?? "",
    coreProblem: p?.coreProblem ?? (Array.isArray(p?.fears) ? p.fears.join(" · ") : ""),
    goals: Array.isArray(p?.goals) ? p.goals : [],
    triggers: p?.triggers ?? "",
    buying: p?.buying ?? { where: p?.channels ?? "", what: "", how: p?.buyingBehavior ?? "" },
    dataEvidence: Array.isArray(p?.dataEvidence) ? p.dataEvidence : [],
    awareness: Array.isArray(p?.awareness) ? p.awareness : [],
    topAngles: Array.isArray(p?.topAngles) ? p.topAngles : [],
  };
}

/* ─── export one ICP to a clean, printable HTML document ─────────────────── */
function exportPersona(p: Persona) {
  const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const row = (label: string, val: string) => val ? `<div class="row"><span class="lab">${esc(label)}</span><span class="val">${esc(val)}</span></div>` : "";
  const para = (title: string, val: string) => val ? `<section><h2>${esc(title)}</h2><p>${esc(val)}</p></section>` : "";
  const goals = p.goals.filter(Boolean).map((g) => `<li>${esc(g)}</li>`).join("");
  const stages = p.awareness.map((a, i) => `
      <div class="stage">
        <div class="stage-head"><strong>${String(i + 1).padStart(2, "0")} · ${esc(a.stage)}</strong>${a.channelFit ? `<span class="chip">${esc(a.channelFit)}</span>` : ""}</div>
        ${a.thinks ? `<p class="denkt"><em>&ldquo;${esc(a.thinks)}&rdquo;</em></p>` : ""}
        ${a.approach ? `<div class="aanpak"><span class="aanpak-lab">Gooodboys aanpak</span><p>${esc(a.approach)}</p></div>` : ""}
      </div>`).join("");
  const css = `*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.55}header{border-bottom:3px solid #490303;padding-bottom:16px;margin-bottom:28px}h1{font-size:32px;margin:0 0 4px;color:#490303}.tag{font-size:16px;color:#555;margin:0;font-style:italic}.meta{font-size:12px;color:#999;margin-top:8px;text-transform:uppercase;letter-spacing:.08em}section{margin:0 0 22px;page-break-inside:avoid}h2{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#490303;border-bottom:1px solid #eee;padding-bottom:6px;margin:0 0 12px}.row{display:flex;gap:12px;padding:4px 0;border-bottom:1px solid #f4f4f4}.lab{font-weight:600;width:150px;flex-shrink:0;color:#444;font-size:14px}.val{color:#222;font-size:14px}.extra{margin-top:10px;color:#333;font-size:14px}p{font-size:14px;color:#222;margin:0}ul{margin:0;padding-left:20px}li{font-size:14px;margin:4px 0}.stage{border:1px solid #eee;border-radius:10px;padding:14px 16px;margin-bottom:12px;page-break-inside:avoid}.stage-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:12px}.chip{font-size:11px;background:#f0f0f0;color:#666;padding:3px 8px;border-radius:20px;white-space:nowrap}.denkt{color:#333;margin-bottom:8px}.aanpak{background:#fafafa;border-left:3px solid #490303;padding:8px 12px;border-radius:6px}.aanpak-lab{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#490303;font-weight:600;display:block;margin-bottom:4px}@media print{body{margin:0}}`;
  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(p.name)} — ICP</title><style>${css}</style></head><body>`
    + `<header><h1>${esc(p.name)}</h1><p class="tag">${esc(p.tagline)}</p><p class="meta">Focus ICP · Gooodboys · ${new Date().toLocaleDateString("nl-BE")}</p></header>`
    + `<section><h2>1 &middot; De hond</h2>${row("Ras & grootte", p.dog.breed)}${row("Leeftijd", p.dog.age)}${p.dog.needs ? `<p class="extra">${esc(p.dog.needs)}</p>` : ""}</section>`
    + `<section><h2>2 &middot; Het baasje</h2>${row("Leeftijd", p.owner.age)}${row("Inkomen", p.owner.income)}${row("Locatie", p.owner.location)}${row("Huishouden", p.owner.household)}${p.owner.extra ? `<p class="extra">${esc(p.owner.extra)}</p>` : ""}</section>`
    + para("3 · Psychografie — hoe denken ze over hun hond?", p.psychographics)
    + para("4 · Kernprobleem", p.coreProblem)
    + (goals ? `<section><h2>5 &middot; Doelen</h2><ul>${goals}</ul></section>` : "")
    + para("6 · Wat triggert hen?", p.triggers)
    + `<section><h2>7 &middot; Koopgedrag</h2>${row("Waar", p.buying.where)}${row("Wat", p.buying.what)}${row("Hoe", p.buying.how)}</section>`
    + (stages ? `<section><h2>Stages matrix</h2>${stages}</section>` : "")
    + `</body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = (p.name || "icp").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "icp";
  a.href = url; a.download = `${slug}-icp.html`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const TABS = [
  { id: "profile",   label: "Profiel" },
  { id: "awareness", label: "Stages matrix" },
] as const;

/* ─── tiny inline editors ────────────────────────────────────────────────── */
const IN = "w-full bg-muted/60 border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-ring/50 focus:bg-card transition-colors";
function TIn({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={IN} />;
}
function TArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea value={value} placeholder={placeholder} rows={rows} onChange={(e) => onChange(e.target.value)} className={`${IN} resize-y leading-relaxed`} />;
}
function SectionCard({ icon: Icon, title, accent, children }: { icon: ElementType; title: string; accent: string; children: ReactNode }) {
  return (
    <motion.section variants={fadeUp} className="card-soft p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="h-8 w-8 rounded-xl grid place-items-center shrink-0" style={{ background: `hsl(var(--${accent}) / 0.12)` }}>
          <Icon className="h-4 w-4" style={{ color: `hsl(var(--${accent}))` }} />
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}
function FieldTile({ label, value, editing, onChange, area }: { label: string; value: string; editing: boolean; onChange: (v: string) => void; area?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      {editing
        ? (area ? <TArea value={value} onChange={onChange} rows={3} /> : <TIn value={value} onChange={onChange} />)
        : <p className="text-sm text-foreground leading-relaxed">{value || "—"}</p>}
    </div>
  );
}
function TextField({ value, editing, onChange }: { value: string; editing: boolean; onChange: (v: string) => void }) {
  return editing
    ? <TArea value={value} onChange={onChange} rows={4} />
    : <p className="text-sm text-foreground leading-relaxed">{value || "—"}</p>;
}

export default function ICPDocument() {
  const [personas, setPersonas] = useState<Persona[]>(() => {
    try { const r = localStorage.getItem(LS); if (r) return (JSON.parse(r) as any[]).map(migrate); } catch { /* ignore */ }
    return SEED;
  });
  const [activeId, setActiveId] = useState(() => personas[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<"profile" | "awareness">("profile");
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => { try { localStorage.setItem(LS, JSON.stringify(personas)); } catch { /* ignore */ } }, [personas]);

  const persona = personas.find((p) => p.id === activeId) ?? personas[0];

  const patch = (p: Partial<Persona>) => setPersonas((prev) => prev.map((x) => (x.id === activeId ? { ...x, ...p } : x)));
  const patchDog = (d: Partial<Persona["dog"]>) => patch({ dog: { ...persona.dog, ...d } });
  const patchOwner = (d: Partial<Persona["owner"]>) => patch({ owner: { ...persona.owner, ...d } });
  const patchBuying = (d: Partial<Persona["buying"]>) => patch({ buying: { ...persona.buying, ...d } });

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
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }} className="flex items-center gap-2.5">
            <span className="h-10 w-10 rounded-2xl grid place-items-center shrink-0" style={{ background: "hsl(var(--info)/0.12)" }}><Users className="h-5 w-5" style={{ color: "hsl(var(--info))" }} /></span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Strategy</p>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Focus ICP's</h1>
            </div>
          </motion.div>
          <div className="flex items-center gap-2">
            <button onClick={() => persona && exportPersona(persona)}
              className="h-9 px-4 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all shadow-xs border border-border bg-card text-muted-foreground hover:text-foreground">
              <Download className="h-3.5 w-3.5" /> Exporteren
            </button>
            <button onClick={() => setEditing((e) => !e)}
              className={`h-9 px-4 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all shadow-xs ${editing ? "bg-primary text-primary-foreground shadow-sm" : "border border-border bg-card text-muted-foreground hover:text-foreground"}`}>
              {editing ? <><Check className="h-4 w-4" /> Klaar</> : <><Pencil className="h-3.5 w-3.5" /> Bewerken</>}
            </button>
          </div>
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
              <motion.div variants={stagger(0.04)} initial="hidden" animate="visible" className="space-y-4">
                {/* 1 · De hond */}
                <SectionCard icon={Dog} title="1 · De hond" accent="info">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    {([["Ras & grootte","breed"],["Leeftijd","age"]] as const).map(([label, key]) => (
                      <FieldTile key={key} label={label} value={persona.dog[key]} editing={editing} onChange={(v) => patchDog({ [key]: v } as any)} />
                    ))}
                  </div>
                  <FieldTile label="Extra info." value={persona.dog.needs} editing={editing} onChange={(v) => patchDog({ needs: v })} area />
                </SectionCard>

                {/* 2 · Het baasje */}
                <SectionCard icon={User} title="2 · Het baasje" accent="grape">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    {([["Leeftijd","age"],["Inkomen","income"],["Locatie","location"],["Huishouden","household"]] as const).map(([label, key]) => (
                      <FieldTile key={key} label={label} value={persona.owner[key]} editing={editing} onChange={(v) => patchOwner({ [key]: v } as any)} />
                    ))}
                  </div>
                  <FieldTile label="Extra info." value={persona.owner.extra} editing={editing} onChange={(v) => patchOwner({ extra: v })} area />
                </SectionCard>

                {/* 3 · Psychografie */}
                <SectionCard icon={Brain} title="3 · Psychografie — hoe denken ze over hun hond?" accent="ember">
                  <TextField value={persona.psychographics} editing={editing} onChange={(v) => patch({ psychographics: v })} />
                </SectionCard>

                {/* 4 · Kernprobleem */}
                <SectionCard icon={AlertTriangle} title="4 · Kernprobleem" accent="bad">
                  <TextField value={persona.coreProblem} editing={editing} onChange={(v) => patch({ coreProblem: v })} />
                </SectionCard>

                {/* 5 · Doelen */}
                <SectionCard icon={Target} title="5 · Doelen" accent="ok">
                  <ListEditor title="" dot="bg-emerald-500" items={persona.goals} editing={editing} onChange={(v) => patch({ goals: v })} />
                </SectionCard>

                {/* 6 · Triggers */}
                <SectionCard icon={Zap} title="6 · Wat triggert hen?" accent="sun">
                  <TextField value={persona.triggers} editing={editing} onChange={(v) => patch({ triggers: v })} />
                </SectionCard>

                {/* 7 · Koopgedrag */}
                <SectionCard icon={ShoppingBag} title="7 · Koopgedrag — waar, wat & hoe?" accent="warn">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {([["Waar","where"],["Wat","what"],["Hoe","how"]] as const).map(([label, key]) => (
                      <FieldTile key={key} label={label} value={persona.buying[key]} editing={editing} onChange={(v) => patchBuying({ [key]: v } as any)} area />
                    ))}
                  </div>
                </SectionCard>

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
                      <AwField label="Denkt" value={a.thinks} editing={editing} italic onChange={(v) => patch({ awareness: patchList(persona.awareness, i, { thinks: v }) })} />
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
