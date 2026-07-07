import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Trash2, ChevronDown, ChevronRight, Building2, Quote,
  Lightbulb, Target, Heart, AlertCircle, Sparkles, Download, Wand2,
  Loader2, Layers, X, LogOut, FolderOpen, Image as ImageIcon, Upload, Languages, Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { detectLanguage, languageName, SUPPORTED_LANGUAGES } from "@/lib/languageDetect";

type Brand = {
  id: string;
  name: string;
  url: string | null;
  notes: string | null;
  created_at: string;
};

type Collection = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
};

const COLLECTION_COLORS = [
  { id: "tomato", label: "Tomato", hex: "#841F16" },
  { id: "sun", label: "Sun", hex: "#FFAE03" },
  { id: "ember", label: "Ember", hex: "#E67F0D" },
  { id: "sage", label: "Sage", hex: "#7C8A6B" },
  { id: "slate", label: "Slate", hex: "#4B5563" },
  { id: "stone", label: "Stone", hex: "#A8A29E" },
];
function colorHex(id: string | null | undefined) {
  if (!id) return null;
  const c = COLLECTION_COLORS.find((c) => c.id === id);
  return c ? c.hex : id; // accept raw hex too
}

const STARTER_COLLECTIONS = [
  { name: "Winning Ads", description: "Ads from any brand that stop you scrolling, including non-pet brands.", color: "tomato" },
  { name: "Industry Insights", description: "Blog posts, podcasts, newsletters about DTC, branding, marketing.", color: "sun" },
  { name: "Founder Inspiration", description: "Quotes, interviews, philosophies from founders you admire.", color: "ember" },
  { name: "Customer Discovery", description: "Direct customer conversations, DMs, surveys, interviews about Gooodboys.", color: "sage" },
  { name: "Cultural Reference", description: "Broader cultural moments that inform the brand.", color: "slate" },
];

type EntryRow = {
  id: string;
  brand_id: string | null;
  collection_id: string | null;
  source: string;
  raw_text: string;
  customer_language: string | null;
  pain_point: string | null;
  angle: string | null;
  emotional_trigger: string | null;
  use_case: string | null;
  objection: string | null;
  desire: string | null;
  sentiment: string | null;
  rating: string | null;
  source_url: string | null;
  tags: string[] | null;
  subject_type: string | null;
  product_category: string | null;
  image_url: string | null;
  image_path: string | null;
  visual_style: string | null;
  visual_elements: string[] | null;
  original_language: string | null;
  translated_text: string | null;
  customer_language_en: string | null;
  created_at: string;
};

type EntryUI = {
  id: string;
  brandId: string | null;
  collectionId: string | null;
  source: string;
  rawText: string;
  customerLanguage: string;
  painPoint: string;
  angle: string;
  emotionalTrigger: string;
  useCase: string;
  objection: string;
  desire: string;
  sentiment: string;
  rating: string;
  sourceUrl: string;
  tags: string[];
  subjectType: string;
  productCategory: string;
  imageUrl: string;
  imagePath: string;
  visualStyle: string;
  visualElements: string[];
  originalLanguage: string;
  translatedText: string;
  customerLanguageEn: string;
  createdAt: string;
};

const sourceTypes = [
  { id: "review", label: "Customer review", color: "bg-accent/10 text-blue-700 border-accent/30" },
  { id: "competitor_review", label: "Competitor review", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: "dm_comment", label: "DM or comment", color: "bg-pink-50 text-pink-700 border-pink-200" },
  { id: "support_ticket", label: "Support ticket", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { id: "post_purchase", label: "Post purchase survey", color: "bg-green-50 text-green-700 border-green-200" },
  { id: "blog", label: "Blog or article", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { id: "social", label: "Social comment", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { id: "ad", label: "Winning ad", color: "bg-red-50 text-red-700 border-red-200" },
  { id: "interview", label: "Customer interview", color: "bg-teal-50 text-teal-700 border-teal-200" },
];

const categories = [
  { id: "customerLanguage", label: "Customer language", icon: Quote },
  { id: "painPoint", label: "Pain point", icon: AlertCircle },
  { id: "angle", label: "Angle", icon: Target },
  { id: "emotionalTrigger", label: "Emotional trigger", icon: Heart },
  { id: "useCase", label: "Use case", icon: Lightbulb },
  { id: "objection", label: "Objection", icon: AlertCircle },
  { id: "desire", label: "Desire", icon: Sparkles },
] as const;

function rowToUI(r: EntryRow): EntryUI {
  return {
    id: r.id,
    brandId: r.brand_id,
    collectionId: r.collection_id,
    source: r.source,
    rawText: r.raw_text,
    customerLanguage: r.customer_language ?? "",
    painPoint: r.pain_point ?? "",
    angle: r.angle ?? "",
    emotionalTrigger: r.emotional_trigger ?? "",
    useCase: r.use_case ?? "",
    objection: r.objection ?? "",
    desire: r.desire ?? "",
    sentiment: r.sentiment ?? "neutral",
    rating: r.rating ?? "",
    sourceUrl: r.source_url ?? "",
    tags: r.tags ?? [],
    subjectType: r.subject_type ?? "",
    productCategory: r.product_category ?? "",
    imageUrl: r.image_url ?? "",
    imagePath: r.image_path ?? "",
    visualStyle: r.visual_style ?? "",
    visualElements: r.visual_elements ?? [],
    originalLanguage: r.original_language ?? "",
    translatedText: r.translated_text ?? "",
    customerLanguageEn: r.customer_language_en ?? "",
    createdAt: r.created_at,
  };
}

const emptyEntry = {
  source: "review",
  rawText: "",
  customerLanguage: "",
  customerLanguageEn: "",
  painPoint: "",
  angle: "",
  emotionalTrigger: "",
  useCase: "",
  objection: "",
  desire: "",
  sentiment: "",
  rating: "",
  sourceUrl: "",
  tags: "" as string | string[],
  subjectType: "",
  productCategory: "",
  visualStyle: "",
  visualElements: [] as string[],
  imageFile: null as File | null,
  imagePreviewUrl: "" as string,
  detectedLanguage: "en" as string,
  languageOverridden: false as boolean,
  translatedText: "" as string,
};

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type ViewName = "brands" | "collections" | "entries" | "synthesis";

export default function DataBank({ initialView = "brands" }: { initialView?: ViewName } = {}) {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [entries, setEntries] = useState<EntryUI[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandUrl, setNewBrandUrl] = useState("");
  const [newBrandNotes, setNewBrandNotes] = useState("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDesc, setNewCollectionDesc] = useState("");
  const [newCollectionColor, setNewCollectionColor] = useState<string>("");
  const [savingCollection, setSavingCollection] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterContainer, setFilterContainer] = useState<"all" | "brands" | "collections">("all");
  const [filterLanguage, setFilterLanguage] = useState<string>("all");
  const [displayMode, setDisplayMode] = useState<"english" | "original">(() => {
    if (typeof window === "undefined") return "english";
    return (localStorage.getItem("gb_display_mode") as "english" | "original") || "english";
  });
  useEffect(() => { try { localStorage.setItem("gb_display_mode", displayMode); } catch {} }, [displayMode]);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [view, setView] = useState<ViewName>(initialView);
  useEffect(() => { setView(initialView); }, [initialView]);
  // synthScope: "all_brands" | "all_collections" | "brand:<id>" | "collection:<id>"
  const [synthScope, setSynthScope] = useState<string>("all_brands");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [savingBrand, setSavingBrand] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ run: () => void; title: string; desc: string } | null>(null);
  const askDelete = (run: () => void, title: string, desc: string) => setConfirmAction({ run, title, desc });
  const [signingOut, setSigningOut] = useState(false);

  const [batchText, setBatchText] = useState("");
  const [batchSource, setBatchSource] = useState("review");
  const [batchSeparator, setBatchSeparator] = useState("smart_ai");
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, language: "" as string });
  const [batchStartTime, setBatchStartTime] = useState<number | null>(null);
  const [batchNow, setBatchNow] = useState(Date.now());
  const [batchResults, setBatchResults] = useState<{ rawText: string; angle: string; painPoint: string }[]>([]);
  const [batchError, setBatchError] = useState("");
  const [detectedChunks, setDetectedChunks] = useState<string[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState("");

  const [newEntry, setNewEntry] = useState<typeof emptyEntry>(emptyEntry);

  const [synthesis, setSynthesis] = useState<any | null>(null);
  const [synthesisMeta, setSynthesisMeta] = useState<{ entryCount: number; updatedAt: string } | null>(null);
  const [synthesisLoading, setSynthesisLoading] = useState(false);
  const [synthesisError, setSynthesisError] = useState("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) {
        navigate("/auth", { replace: true });
      } else {
        setUserId(session.user.id);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth", { replace: true });
      } else {
        setUserId(session.user.id);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    loadData();
  }, [userId]);

  useEffect(() => {
    if (!batchProcessing) return;
    const id = setInterval(() => setBatchNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [batchProcessing]);

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const [{ data: bs, error: be }, { data: cs, error: ce }, { data: es, error: ee }] = await Promise.all([
        supabase.from("brands").select("*").order("created_at", { ascending: false }),
        supabase.from("collections").select("*").order("created_at", { ascending: false }),
        supabase.from("entries").select("*").order("created_at", { ascending: false }),
      ]);
      if (be) throw be;
      if (ce) throw ce;
      if (ee) throw ee;
      setBrands((bs ?? []) as Brand[]);
      setCollections((cs ?? []) as Collection[]);
      setEntries(((es ?? []) as EntryRow[]).map(rowToUI));
    } catch (err: any) {
      const msg = err?.message || "Failed to load data";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function aiExtractText(rawText: string, sourceType: string, language: string, image?: { base64: string; mediaType: string } | { url: string }) {
    const body: any = { rawText, sourceType, language };
    if (image && "base64" in image) {
      body.imageBase64 = image.base64;
      body.imageMediaType = image.mediaType;
    } else if (image && "url" in image) {
      body.imageUrl = image.url;
    }
    const { data, error } = await supabase.functions.invoke("extract-insights", {
      body,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function aiExtract() {
    if (aiLoading) return;
    const hasText = !!newEntry.rawText.trim();
    const hasImage = !!newEntry.imageFile;
    if (!hasText && !hasImage) {
      setAiError("Add text or attach an image first");
      return;
    }
    setAiLoading(true);
    setAiError("");
    try {
      let imageArg: { base64: string; mediaType: string } | undefined;
      if (hasImage && newEntry.imageFile) {
        const base64 = await fileToBase64(newEntry.imageFile);
        imageArg = { base64, mediaType: newEntry.imageFile.type };
      }
      const lang = hasText ? newEntry.detectedLanguage : "en";
      const parsed = await aiExtractText(newEntry.rawText, newEntry.source, lang, imageArg);
      setNewEntry({
        ...newEntry,
        customerLanguage: parsed.customerLanguage || newEntry.customerLanguage,
        customerLanguageEn: parsed.customerLanguageEn || newEntry.customerLanguageEn,
        translatedText: parsed.translatedText || newEntry.translatedText,
        painPoint: parsed.painPoint || newEntry.painPoint,
        angle: parsed.angle || newEntry.angle,
        emotionalTrigger: parsed.emotionalTrigger || newEntry.emotionalTrigger,
        useCase: parsed.useCase || newEntry.useCase,
        objection: parsed.objection || newEntry.objection,
        desire: parsed.desire || newEntry.desire,
        sentiment: parsed.sentiment || newEntry.sentiment,
        tags: parsed.tags || newEntry.tags,
        subjectType: parsed.subjectType || newEntry.subjectType,
        productCategory: parsed.productCategory || newEntry.productCategory,
        visualStyle: parsed.visualStyle || newEntry.visualStyle,
        visualElements: Array.isArray(parsed.visualElements) ? parsed.visualElements : newEntry.visualElements,
      });
      if (parsed.sentiment) {
        toast.success(`Sentiment detected: ${parsed.sentiment}`);
      }
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || "AI extract failed. You can fill manually.";
      setAiError(msg);
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  }

  async function detectEntries() {
    if (detecting || batchProcessing) return;
    if (!batchText.trim()) {
      setDetectError("Paste some text first");
      return;
    }
    setDetectError("");
    setBatchError("");
    setBatchResults([]);

    if (batchSeparator === "smart_ai") {
      setDetecting(true);
      try {
        const { data, error } = await supabase.functions.invoke("split-reviews", {
          body: { text: batchText },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        const chunks: string[] = Array.isArray(data?.chunks) ? data.chunks : [];
        if (chunks.length === 0) throw new Error("No entries detected");
        setDetectedChunks(chunks);
      } catch (err: any) {
        setDetectError("Smart split failed: " + (err?.message || err) + ". Try a manual separator.");
      } finally {
        setDetecting(false);
      }
      return;
    }

    let chunks: string[] = [];
    if (batchSeparator === "blank_line") {
      chunks = batchText.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean);
    } else if (batchSeparator === "triple_dash") {
      chunks = batchText.split(/\n---\n|\n---/).map((c) => c.trim()).filter(Boolean);
    } else if (batchSeparator === "numbered") {
      chunks = batchText
        .split(/\n(?=\d+[\.\)]\s)/)
        .map((c) => c.trim().replace(/^\d+[\.\)]\s*/, ""))
        .filter(Boolean);
    }
    if (chunks.length === 0) {
      setDetectError("No entries detected with this separator.");
      return;
    }
    setDetectedChunks(chunks);
  }

  function mergeChunkWithNext(i: number) {
    setDetectedChunks((prev) => {
      if (i >= prev.length - 1) return prev;
      const copy = [...prev];
      copy[i] = (copy[i] + "\n\n" + copy[i + 1]).trim();
      copy.splice(i + 1, 1);
      return copy;
    });
  }

  function deleteChunk(i: number) {
    setDetectedChunks((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateChunk(i: number, value: string) {
    setDetectedChunks((prev) => prev.map((c, idx) => (idx === i ? value : c)));
  }

  function moveChunk(from: number, to: number) {
    setDetectedChunks((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }

  async function processBatch() {
    if (batchProcessing) return;
    if ((!selectedBrand && !selectedCollection) || !userId) {
      setBatchError("Make sure a brand or collection is selected");
      return;
    }
    const chunks = detectedChunks.filter((c) => c.trim());
    if (chunks.length === 0) {
      setBatchError("Detect entries first.");
      return;
    }
    if (chunks.length > 50) {
      setBatchError(`${chunks.length} entries. Maximum 50 per batch to avoid rate limits.`);
      return;
    }

    setBatchProcessing(true);
    setBatchError("");
    setBatchProgress({ current: 0, total: chunks.length, language: "" });
    setBatchResults([]);
    setBatchStartTime(Date.now());
    setBatchNow(Date.now());

    const inserts: any[] = [];
    const failed: { index: number }[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const text = chunks[i];
      const chunkLang = detectLanguage(text);
      setBatchProgress({ current: i + 1, total: chunks.length, language: chunkLang });
      try {
        const parsed = await aiExtractText(text, batchSource, chunkLang);
        inserts.push({
          user_id: userId,
          brand_id: selectedBrand,
          collection_id: selectedCollection,
          source: batchSource,
          raw_text: text,
          customer_language: parsed.customerLanguage || null,
          customer_language_en: parsed.customerLanguageEn || null,
          original_language: parsed.originalLanguage || chunkLang || "en",
          translated_text: parsed.translatedText || null,
          pain_point: parsed.painPoint || null,
          angle: parsed.angle || null,
          emotional_trigger: parsed.emotionalTrigger || null,
          use_case: parsed.useCase || null,
          objection: parsed.objection || null,
          desire: parsed.desire || null,
          sentiment: parsed.sentiment || "neutral",
          tags: parsed.tags
            ? parsed.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
            : [],
          subject_type: parsed.subjectType || null,
          product_category: parsed.productCategory || null,
        });
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        console.error("Failed on entry", i, err);
        failed.push({ index: i + 1 });
      }
    }

    if (inserts.length > 0) {
      const { data, error } = await supabase.from("entries").insert(inserts).select();
      if (error) {
        setBatchError("Save failed: " + error.message);
        setBatchProcessing(false);
        return;
      }
      const newRows = (data as EntryRow[]).map(rowToUI);
      setEntries([...newRows, ...entries]);
      setBatchResults(
        newRows.map((e) => ({
          rawText: e.rawText.substring(0, 100) + (e.rawText.length > 100 ? "..." : ""),
          angle: e.angle,
          painPoint: e.painPoint,
        }))
      );
    }

    if (failed.length > 0) {
      setBatchError(
        `Processed ${inserts.length} entries. ${failed.length} failed: ${failed
          .map((f) => `#${f.index}`)
          .join(", ")}`
      );
    }
    setBatchProcessing(false);
  }

  function resetBatch() {
    setBatchText("");
    setBatchResults([]);
    setBatchError("");
    setBatchProgress({ current: 0, total: 0, language: "" });
    setDetectedChunks([]);
    setDetectError("");
  }

  async function addBrand() {
    if (!newBrandName.trim() || !userId || savingBrand) return;
    setSavingBrand(true);
    try {
      const { data, error } = await supabase
        .from("brands")
        .insert({
          user_id: userId,
          name: newBrandName.trim(),
          url: newBrandUrl.trim() || null,
          notes: newBrandNotes.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      setBrands([data as Brand, ...brands]);
      setNewBrandName("");
      setNewBrandUrl("");
      setNewBrandNotes("");
      setShowAddBrand(false);
      toast.success("Brand added");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save brand");
    } finally {
      setSavingBrand(false);
    }
  }

  async function deleteBrand(brandId: string) {
    setDeletingId(brandId);
    try {
      const { error } = await supabase.from("brands").delete().eq("id", brandId);
      if (error) throw error;
      setBrands(brands.filter((b) => b.id !== brandId));
      setEntries(entries.filter((e) => e.brandId !== brandId));
      if (selectedBrand === brandId) setSelectedBrand(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete brand");
    } finally {
      setDeletingId(null);
    }
  }

  async function addCollection(preset?: { name: string; description: string; color: string }) {
    const name = (preset?.name ?? newCollectionName).trim();
    if (!name || !userId || savingCollection) return;
    setSavingCollection(true);
    try {
      const { data, error } = await supabase
        .from("collections")
        .insert({
          user_id: userId,
          name,
          description: (preset?.description ?? newCollectionDesc).trim() || null,
          color: (preset?.color ?? newCollectionColor) || null,
        })
        .select()
        .single();
      if (error) throw error;
      setCollections([data as Collection, ...collections]);
      setNewCollectionName("");
      setNewCollectionDesc("");
      setNewCollectionColor("");
      setShowAddCollection(false);
      toast.success("Collection added");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save collection");
    } finally {
      setSavingCollection(false);
    }
  }

  async function deleteCollection(collectionId: string) {
    setDeletingId(collectionId);
    try {
      const { error } = await supabase.from("collections").delete().eq("id", collectionId);
      if (error) throw error;
      setCollections(collections.filter((c) => c.id !== collectionId));
      setEntries(entries.filter((e) => e.collectionId !== collectionId));
      if (selectedCollection === collectionId) setSelectedCollection(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete collection");
    } finally {
      setDeletingId(null);
    }
  }

  async function renameCollection(collectionId: string) {
    const current = collections.find((c) => c.id === collectionId);
    if (!current) return;
    const newName = window.prompt("New collection name", current.name);
    if (!newName || newName.trim() === "" || newName.trim() === current.name) return;
    try {
      const { data, error } = await supabase
        .from("collections")
        .update({ name: newName.trim() })
        .eq("id", collectionId)
        .select()
        .single();
      if (error) throw error;
      setCollections(collections.map((c) => (c.id === collectionId ? (data as Collection) : c)));
      toast.success("Collection renamed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to rename collection");
    }
  }

  async function editCollectionDescription(collectionId: string) {
    const current = collections.find((c) => c.id === collectionId);
    if (!current) return;
    const newDesc = window.prompt("Collection description", current.description || "");
    if (newDesc === null) return;
    const trimmed = newDesc.trim();
    if (trimmed === (current.description || "")) return;
    try {
      const { data, error } = await supabase
        .from("collections")
        .update({ description: trimmed || null })
        .eq("id", collectionId)
        .select()
        .single();
      if (error) throw error;
      setCollections(collections.map((c) => (c.id === collectionId ? (data as Collection) : c)));
      toast.success("Description updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update description");
    }
  }

  async function addEntry() {
    const hasText = !!newEntry.rawText.trim();
    const hasImage = !!newEntry.imageFile;
    if ((!hasText && !hasImage) || (!selectedBrand && !selectedCollection) || !userId || savingEntry) return;
    setSavingEntry(true);
    const tagsArr =
      typeof newEntry.tags === "string"
        ? newEntry.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : newEntry.tags;
    try {
      const entryId = (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let imageUrl: string | null = null;
      let imagePath: string | null = null;
      if (newEntry.imageFile) {
        const file = newEntry.imageFile;
        const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
        const safeName = `image-${Date.now()}.${ext || "bin"}`;
        const path = `${userId}/${entryId}/${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("entry-images")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          toast.error(`Image upload failed: ${upErr.message}. Saving entry without image.`);
        } else {
          imagePath = path;
          const { data: pub } = supabase.storage.from("entry-images").getPublicUrl(path);
          imageUrl = pub.publicUrl;
        }
      }
      const { data, error } = await supabase
        .from("entries")
        .insert({
          id: entryId,
          user_id: userId,
          brand_id: selectedBrand,
          collection_id: selectedCollection,
          source: newEntry.source,
          raw_text: newEntry.rawText || "",
          customer_language: newEntry.customerLanguage || null,
          customer_language_en: newEntry.customerLanguageEn || null,
          original_language: newEntry.detectedLanguage || "en",
          translated_text: newEntry.translatedText || null,
          pain_point: newEntry.painPoint || null,
          angle: newEntry.angle || null,
          emotional_trigger: newEntry.emotionalTrigger || null,
          use_case: newEntry.useCase || null,
          objection: newEntry.objection || null,
          desire: newEntry.desire || null,
          sentiment: newEntry.sentiment || "neutral",
          rating: newEntry.rating || null,
          source_url: newEntry.sourceUrl || null,
          tags: tagsArr,
          subject_type: newEntry.subjectType || null,
          product_category: newEntry.productCategory || null,
          image_url: imageUrl,
          image_path: imagePath,
          visual_style: newEntry.visualStyle || null,
          visual_elements: (newEntry.visualElements && newEntry.visualElements.length > 0) ? newEntry.visualElements : null,
        })
        .select()
        .single();
      if (error) {
        if (imagePath) {
          await supabase.storage.from("entry-images").remove([imagePath]).catch(() => {});
        }
        throw error;
      }
      setEntries([rowToUI(data as EntryRow), ...entries]);
      if (newEntry.imagePreviewUrl) URL.revokeObjectURL(newEntry.imagePreviewUrl);
      setNewEntry(emptyEntry);
      setShowAddEntry(false);
      setAiError("");
      toast.success("Entry saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save entry");
    } finally {
      setSavingEntry(false);
    }
  }

  async function deleteEntry(entryId: string) {
    setDeletingId(entryId);
    try {
      const target = entries.find((e) => e.id === entryId);
      const { error } = await supabase.from("entries").delete().eq("id", entryId);
      if (error) throw error;
      if (target?.imagePath) {
        await supabase.storage.from("entry-images").remove([target.imagePath]).catch(() => {});
      }
      setEntries(entries.filter((e) => e.id !== entryId));
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete entry");
    } finally {
      setDeletingId(null);
    }
  }

  async function updateEntryTranslation(entryId: string, translatedText: string) {
    const { error } = await supabase
      .from("entries")
      .update({ translated_text: translatedText || null })
      .eq("id", entryId);
    if (error) throw error;
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, translatedText } : e)));
  }

  async function reExtractEntry(entryId: string) {
    const target = entries.find((e) => e.id === entryId);
    if (!target) return;
    const lang = target.originalLanguage || detectLanguage(target.rawText);
    const imageArg = target.imageUrl ? { url: target.imageUrl } : undefined;
    const parsed = await aiExtractText(target.rawText, target.source, lang, imageArg);
    const updates: any = {
      customer_language: parsed.customerLanguage || null,
      customer_language_en: parsed.customerLanguageEn || null,
      original_language: parsed.originalLanguage || lang || "en",
      translated_text: parsed.translatedText || null,
      pain_point: parsed.painPoint || null,
      angle: parsed.angle || null,
      emotional_trigger: parsed.emotionalTrigger || null,
      use_case: parsed.useCase || null,
      objection: parsed.objection || null,
      desire: parsed.desire || null,
      sentiment: parsed.sentiment || target.sentiment || "neutral",
      tags: parsed.tags ? parsed.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : target.tags,
      subject_type: parsed.subjectType || null,
      product_category: parsed.productCategory || null,
      visual_style: parsed.visualStyle || target.visualStyle || null,
      visual_elements: parsed.visualElements && parsed.visualElements.length > 0 ? parsed.visualElements : (target.visualElements?.length ? target.visualElements : null),
    };
    const { data, error } = await supabase.from("entries").update(updates).eq("id", entryId).select().single();
    if (error) throw error;
    const updated = rowToUI(data as EntryRow);
    setEntries((prev) => prev.map((e) => (e.id === entryId ? updated : e)));
  }

  function getBrandEntries(brandId: string) {
    return entries.filter((e) => e.brandId === brandId);
  }
  function getCollectionEntries(collectionId: string) {
    return entries.filter((e) => e.collectionId === collectionId);
  }

  function getFilteredEntries() {
    let result: EntryUI[];
    if (selectedBrand) result = entries.filter((e) => e.brandId === selectedBrand);
    else if (selectedCollection) result = entries.filter((e) => e.collectionId === selectedCollection);
    else result = entries;
    if (filterContainer === "brands") result = result.filter((e) => !!e.brandId);
    else if (filterContainer === "collections") result = result.filter((e) => !!e.collectionId);
    if (filterSource !== "all") result = result.filter((e) => e.source === filterSource);
    if (filterSubject !== "all") result = result.filter((e) => (e.subjectType || "unclear") === filterSubject);
    if (filterLanguage !== "all") result = result.filter((e) => (e.originalLanguage || "en") === filterLanguage);
    if (filterCategory !== "all")
      result = result.filter((e) => (e as any)[filterCategory] && (e as any)[filterCategory].toString().trim());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => {
        const allText = [
          e.rawText, e.customerLanguage, e.painPoint, e.angle, e.emotionalTrigger,
          e.useCase, e.objection, e.desire, e.productCategory, e.subjectType,
          e.visualStyle,
          ...(Array.isArray(e.tags) ? e.tags : []),
          ...(Array.isArray(e.visualElements) ? e.visualElements : []),
        ].join(" ").toLowerCase();
        return allText.includes(q);
      });
    }
    return result;
  }

  function getSourceLabel(sourceId: string) {
    return sourceTypes.find((s) => s.id === sourceId) || sourceTypes[0];
  }
  function getBrandName(brandId: string | null) {
    if (!brandId) return "Unknown";
    const b = brands.find((b) => b.id === brandId);
    return b ? b.name : "Unknown";
  }
  function getCollectionName(id: string | null) {
    if (!id) return "Unknown";
    const c = collections.find((c) => c.id === id);
    return c ? c.name : "Unknown";
  }

  function exportData() {
    const data = { brands, collections, entries, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `data_bank_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getStats() {
    return {
      totalBrands: brands.length,
      totalCollections: collections.length,
      totalEntries: entries.length,
      withPainPoints: entries.filter((e) => e.painPoint && e.painPoint.trim()).length,
      withAngles: entries.filter((e) => e.angle && e.angle.trim()).length,
      withQuotes: entries.filter((e) => e.customerLanguage && e.customerLanguage.trim()).length,
    };
  }

  function entriesForScope(scope: string): EntryUI[] {
    if (scope === "all_brands") return entries.filter((e) => !!e.brandId);
    if (scope === "all_collections") return entries.filter((e) => !!e.collectionId);
    if (scope.startsWith("brand:")) {
      const id = scope.slice(6);
      return entries.filter((e) => e.brandId === id);
    }
    if (scope.startsWith("collection:")) {
      const id = scope.slice(11);
      return entries.filter((e) => e.collectionId === id);
    }
    return [];
  }

  function scopeMeta(scope: string): { containerType: string; containerName: string; label: string } {
    if (scope === "all_brands") return { containerType: "all_brands", containerName: "", label: "All brands combined" };
    if (scope === "all_collections") return { containerType: "all_collections", containerName: "", label: "All collections combined" };
    if (scope.startsWith("brand:")) {
      const id = scope.slice(6);
      const name = getBrandName(id);
      return { containerType: "brand", containerName: name, label: name };
    }
    if (scope.startsWith("collection:")) {
      const id = scope.slice(11);
      const name = getCollectionName(id);
      return { containerType: "collection", containerName: name, label: name };
    }
    return { containerType: "all_brands", containerName: "", label: "All brands combined" };
  }

  async function loadSynthesis() {
    if (!userId) return;
    setSynthesisError("");
    const { data, error } = await supabase
      .from("syntheses")
      .select("result, entry_count, updated_at")
      .eq("user_id", userId)
      .eq("scope", synthScope)
      .maybeSingle();
    if (error) {
      console.error(error);
      setSynthesis(null);
      setSynthesisMeta(null);
      return;
    }
    if (data) {
      setSynthesis(data.result);
      setSynthesisMeta({ entryCount: data.entry_count, updatedAt: data.updated_at });
    } else {
      setSynthesis(null);
      setSynthesisMeta(null);
    }
  }

  useEffect(() => {
    if (view === "synthesis" && userId) {
      loadSynthesis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, synthScope, userId]);

  async function generateSynthesis() {
    if (synthesisLoading || !userId) return;
    const scope = synthScope;
    const scopedEntries = entriesForScope(scope);

    if (scopedEntries.length === 0) {
      setSynthesisError("No entries to synthesize for this scope.");
      return;
    }

    const compact = scopedEntries.map((e) => ({
      id: e.id,
      brand: e.brandId ? getBrandName(e.brandId) : null,
      collection: e.collectionId ? getCollectionName(e.collectionId) : null,
      source: getSourceLabel(e.source),
      sentiment: e.sentiment || "",
      raw: (e.rawText || "").substring(0, 300),
      lang: e.customerLanguage || "",
      langEn: e.customerLanguageEn || "",
      originalLanguage: e.originalLanguage || "en",
      translatedText: e.translatedText || "",
      pain: e.painPoint || "",
      angle: e.angle || "",
      trigger: e.emotionalTrigger || "",
      useCase: e.useCase || "",
      objection: e.objection || "",
      desire: e.desire || "",
      tags: Array.isArray(e.tags) ? e.tags.join(",") : "",
      subject: e.subjectType || "",
      category: e.productCategory || "",
      visualStyle: e.visualStyle || "",
      visualElements: Array.isArray(e.visualElements) ? e.visualElements : [],
      imageUrl: e.imageUrl || "",
    }));

    setSynthesisLoading(true);
    setSynthesisError("");
    try {
      const meta = scopeMeta(scope);
      const { data, error } = await supabase.functions.invoke("ai-synthesize", {
        body: { scope, containerType: meta.containerType, containerName: meta.containerName, brandName: meta.containerName, entries: compact },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { error: upsertError } = await supabase
        .from("syntheses")
        .upsert(
          {
            user_id: userId,
            scope,
            entry_count: scopedEntries.length,
            result: data,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,scope" }
        );
      if (upsertError) throw upsertError;

      setSynthesis(data);
      setSynthesisMeta({ entryCount: scopedEntries.length, updatedAt: new Date().toISOString() });
      toast.success("Synthesis generated");
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || "Synthesis failed";
      setSynthesisError(msg);
      toast.error(msg);
    } finally {
      setSynthesisLoading(false);
    }
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err: any) {
      toast.error(err?.message || "Sign out failed");
    } finally {
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading data bank...</p>
      </div>
    );
  }

  const stats = getStats();
  const filteredEntries = getFilteredEntries();

  return (
    <div className="min-h-screen bg-background">
      {(aiLoading || batchProcessing) && (() => {
        const pct = batchProcessing && batchProgress.total > 0
          ? (batchProgress.current / batchProgress.total) * 100
          : 0;
        let etaLabel = "";
        if (batchProcessing && batchStartTime && batchProgress.current > 0 && batchProgress.current < batchProgress.total) {
          const elapsed = batchNow - batchStartTime;
          const perItem = elapsed / batchProgress.current;
          const remainingMs = perItem * (batchProgress.total - batchProgress.current);
          const s = Math.max(1, Math.round(remainingMs / 1000));
          etaLabel = s >= 60 ? `~${Math.floor(s / 60)}m ${s % 60}s left` : `~${s}s left`;
        }
        return (
          <div className="sticky top-0 z-50 bg-primary text-white shadow">
            <div className="text-sm px-4 py-2 flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {batchProcessing ? (
                <span>
                  AI processing batch… {batchProgress.current}/{batchProgress.total}
                  {batchProgress.total > 0 && <> · {Math.round(pct)}%</>}
                  {etaLabel && <> · {etaLabel}</>}
                </span>
              ) : (
                "AI processing…"
              )}
            </div>
            <div className="h-1 bg-primary-foreground/20 overflow-hidden">
              {batchProcessing && batchProgress.total > 0 ? (
                <div
                  className="h-full bg-card transition-all duration-300 ease-out"
                  style={{ width: `${pct}%` }}
                />
              ) : (
                <div className="h-full w-1/3 bg-card/80 animate-indeterminate" />
              )}
            </div>
          </div>
        );
      })()}
      {/* ── Soft page header (per route — no cross-tabs) ── */}
      <div className="max-w-7xl mx-auto px-6 pt-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }}>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {view === "brands" ? "Data Bank" : view === "collections" ? "Collections" : view === "entries" ? "All Entries" : "Synthesis"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {view === "brands" ? "Alles wat we weten over onszelf en onze concurrenten — reviews, ads en insights."
                : view === "collections" ? "Onderzoek gebundeld per thema — winning ads, insights, founder inspiration en meer."
                : view === "entries" ? "Elke ruwe insight op één plek — doorzoekbaar en filterbaar."
                : "AI-samenvatting die je in één oogopslag vertelt wat je moet weten."}
            </p>
          </motion.div>
          <button onClick={exportData}
            className="h-9 px-3.5 rounded-full border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground shadow-xs flex items-center gap-1.5 transition-colors">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {loadError && (
          <div className="mb-4 border border-destructive/20 bg-destructive/5 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-destructive">{loadError}</p>
            <button onClick={loadData} className="text-xs bg-destructive text-destructive-foreground px-3 py-1 rounded-lg hover:bg-destructive/90">Retry</button>
          </div>
        )}

        {view !== "synthesis" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
            {(view === "collections"
              ? [["Collections", stats.totalCollections], ["Entries", stats.totalEntries]]
              : view === "entries"
              ? [["Entries", stats.totalEntries], ["Pain points", stats.withPainPoints], ["Angles", stats.withAngles], ["Customer quotes", stats.withQuotes]]
              : [["Brands", stats.totalBrands], ["Entries", stats.totalEntries], ["Pain points", stats.withPainPoints], ["Angles", stats.withAngles], ["Customer quotes", stats.withQuotes]]
            ).map(([label, value]) => (
              <div key={label as string} className="card-soft p-3.5">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-num text-2xl font-bold text-foreground tabular-nums leading-none mt-1.5">{value}</p>
              </div>
            ))}
          </div>
        )}

        {view === "brands" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground tracking-tight">{selectedBrand ? `Entries for ${getBrandName(selectedBrand)}` : "All brands"}</h2>
              <div className="flex gap-2">
                {selectedBrand && (
                  <button onClick={() => setSelectedBrand(null)} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">Back to all brands</button>
                )}
                {selectedBrand ? (
                  <>
                    <button onClick={() => setShowBatchImport(true)} className="bg-card border border-border text-foreground/80 text-sm px-3 py-1.5 rounded-md hover:border-primary/50 flex items-center gap-1.5">
                      <Layers size={14} />Batch import
                    </button>
                    <button onClick={() => setShowAddEntry(true)} className="bg-primary text-white text-sm px-3 py-1.5 rounded-md hover:bg-primary/90 flex items-center gap-1.5">
                      <Plus size={14} />Add entry
                    </button>
                  </>
                ) : (
                  <button onClick={() => setShowAddBrand(true)} className="bg-primary text-white text-sm px-3 py-1.5 rounded-md hover:bg-primary/90 flex items-center gap-1.5">
                    <Plus size={14} />Add brand
                  </button>
                )}
              </div>
            </div>

            {showAddBrand && !selectedBrand && (
              <div className="bg-card border border-border rounded-lg p-4 mb-4">
                <input type="text" placeholder="Brand name" value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} className="w-full px-3 py-2 border border-border rounded-md text-sm mb-2 focus:outline-none focus:border-primary" />
                <input type="text" placeholder="Website URL (optional)" value={newBrandUrl} onChange={(e) => setNewBrandUrl(e.target.value)} className="w-full px-3 py-2 border border-border rounded-md text-sm mb-2 focus:outline-none focus:border-primary" />
                <textarea placeholder="Notes about this brand" value={newBrandNotes} onChange={(e) => setNewBrandNotes(e.target.value)} rows={3} className="w-full px-3 py-2 border border-border rounded-md text-sm mb-3 focus:outline-none focus:border-primary resize-none" />
                <div className="flex gap-2">
                  <button onClick={addBrand} disabled={savingBrand || !newBrandName.trim()} className="bg-primary text-white text-sm px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed flex items-center gap-1.5">
                    {savingBrand && <Loader2 size={12} className="animate-spin" />}
                    {savingBrand ? "Saving…" : "Save brand"}
                  </button>
                  <button onClick={() => { setShowAddBrand(false); setNewBrandName(""); setNewBrandUrl(""); setNewBrandNotes(""); }} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">Cancel</button>
                </div>
              </div>
            )}

            {!selectedBrand && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {brands.length === 0 && !showAddBrand && (
                  <div className="col-span-full bg-card border border-dashed border-border rounded-lg p-12 text-center">
                    <Building2 className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">No brands yet. Add one to start collecting research.</p>
                    <button onClick={() => setShowAddBrand(true)} className="bg-primary text-white text-sm px-3 py-1.5 rounded-md hover:bg-primary/90">Add first brand</button>
                  </div>
                )}
                {brands.map((brand) => {
                  const brandEntries = getBrandEntries(brand.id);
                  return (
                    <div key={brand.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors group">
                      <div className="flex items-start justify-between mb-2">
                        <button onClick={() => setSelectedBrand(brand.id)} className="text-left flex-1">
                          <h3 className="font-medium text-foreground hover:text-foreground/80">{brand.name}</h3>
                          {brand.url && <p className="text-xs text-muted-foreground truncate">{brand.url}</p>}
                        </button>
                        <button onClick={() => askDelete(() => deleteBrand(brand.id), "Brand verwijderen?", "Deze brand én al zijn entries worden permanent verwijderd. Deze actie kan niet ongedaan gemaakt worden.")} disabled={deletingId === brand.id} className="text-muted-foreground/70 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100">
                          {deletingId === brand.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                      {brand.notes && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{brand.notes}</p>}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{brandEntries.length} entries</span>
                        <button onClick={() => setSelectedBrand(brand.id)} className="text-foreground/80 hover:text-foreground font-medium">View →</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedBrand && (
              <BrandDetail
                brand={brands.find((b) => b.id === selectedBrand)!}
                entries={getBrandEntries(selectedBrand)}
                showAddEntry={showAddEntry}
                setShowAddEntry={setShowAddEntry}
                showBatchImport={showBatchImport}
                setShowBatchImport={setShowBatchImport}
                newEntry={newEntry}
                setNewEntry={setNewEntry}
                addEntry={addEntry}
                deleteEntry={deleteEntry}
                savingEntry={savingEntry}
                deletingId={deletingId}
                expandedEntry={expandedEntry}
                setExpandedEntry={setExpandedEntry}
                getSourceLabel={getSourceLabel}
                aiExtract={aiExtract}
                aiLoading={aiLoading}
                aiError={aiError}
                setAiError={setAiError}
                batchText={batchText}
                setBatchText={setBatchText}
                batchSource={batchSource}
                setBatchSource={setBatchSource}
                batchSeparator={batchSeparator}
                setBatchSeparator={setBatchSeparator}
                batchProcessing={batchProcessing}
                batchProgress={batchProgress}
                batchResults={batchResults}
                batchError={batchError}
                processBatch={processBatch}
                resetBatch={resetBatch}
                detectedChunks={detectedChunks}
                setDetectedChunks={setDetectedChunks}
                detecting={detecting}
                detectError={detectError}
                detectEntries={detectEntries}
                mergeChunkWithNext={mergeChunkWithNext}
                deleteChunk={deleteChunk}
                updateChunk={updateChunk}
                moveChunk={moveChunk}
                displayMode={displayMode}
                onReExtract={reExtractEntry}
                onUpdateTranslation={updateEntryTranslation}
              />
            )}
          </div>
        )}

        {view === "collections" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground tracking-tight">{selectedCollection ? `Entries for ${getCollectionName(selectedCollection)}` : "All collections"}</h2>
              <div className="flex gap-2">
                {selectedCollection && (
                  <button onClick={() => setSelectedCollection(null)} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">Back to all collections</button>
                )}
                {selectedCollection ? (
                  <>
                    <button onClick={() => setShowBatchImport(true)} className="bg-card border border-border text-foreground/80 text-sm px-3 py-1.5 rounded-md hover:border-primary/50 flex items-center gap-1.5">
                      <Layers size={14} />Batch import
                    </button>
                    <button onClick={() => setShowAddEntry(true)} className="bg-primary text-white text-sm px-3 py-1.5 rounded-md hover:bg-primary/90 flex items-center gap-1.5">
                      <Plus size={14} />Add entry
                    </button>
                  </>
                ) : (
                  <button onClick={() => setShowAddCollection(true)} className="bg-primary text-white text-sm px-3 py-1.5 rounded-md hover:bg-primary/90 flex items-center gap-1.5">
                    <Plus size={14} />Add collection
                  </button>
                )}
              </div>
            </div>

            {showAddCollection && !selectedCollection && (
              <div className="bg-card border border-border rounded-lg p-4 mb-4">
                <input type="text" placeholder="Collection name" value={newCollectionName} onChange={(e) => setNewCollectionName(e.target.value)} className="w-full px-3 py-2 border border-border rounded-md text-sm mb-2 focus:outline-none focus:border-primary" />
                <textarea placeholder="What's this collection for?" value={newCollectionDesc} onChange={(e) => setNewCollectionDesc(e.target.value)} rows={2} className="w-full px-3 py-2 border border-border rounded-md text-sm mb-3 focus:outline-none focus:border-primary resize-none" />
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1.5">Accent color (optional)</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setNewCollectionColor("")} className={`text-xs px-2 py-1 rounded-md border ${!newCollectionColor ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>None</button>
                    {COLLECTION_COLORS.map((c) => (
                      <button key={c.id} type="button" onClick={() => setNewCollectionColor(c.id)} className={`text-xs px-2 py-1 rounded-md border flex items-center gap-1.5 ${newCollectionColor === c.id ? "border-primary" : "border-border"}`}>
                        <span className="w-3 h-3 rounded-full" style={{ background: c.hex }} />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => addCollection()} disabled={savingCollection || !newCollectionName.trim()} className="bg-primary text-white text-sm px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed flex items-center gap-1.5">
                    {savingCollection && <Loader2 size={12} className="animate-spin" />}
                    {savingCollection ? "Saving…" : "Save collection"}
                  </button>
                  <button onClick={() => { setShowAddCollection(false); setNewCollectionName(""); setNewCollectionDesc(""); setNewCollectionColor(""); }} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">Cancel</button>
                </div>
              </div>
            )}

            {!selectedCollection && (
              <>
                {collections.length === 0 && !showAddCollection && (
                  <div className="bg-card border border-dashed border-border rounded-lg p-8 mb-4">
                    <div className="text-center mb-4">
                      <FolderOpen className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="font-display text-base text-foreground">No collections yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Collections hold thematic research that isn't tied to a specific competitor. Start with one of these:</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl mx-auto">
                      {STARTER_COLLECTIONS.map((s) => (
                        <button key={s.name} onClick={() => addCollection(s)} disabled={savingCollection} className="text-left bg-card border border-border rounded-md p-3 hover:border-primary/50 transition-colors disabled:opacity-50" style={{ borderLeftColor: colorHex(s.color) ?? undefined, borderLeftWidth: 3 }}>
                          <p className="text-sm font-medium text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                        </button>
                      ))}
                    </div>
                    <div className="text-center mt-4">
                      <button onClick={() => setShowAddCollection(true)} className="text-xs text-primary hover:underline">Or create your own →</button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {collections.map((c) => {
                    const cEntries = getCollectionEntries(c.id);
                    const accent = colorHex(c.color);
                    return (
                      <div key={c.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors group" style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}>
                        <div className="flex items-start justify-between mb-2">
                          <button onClick={() => setSelectedCollection(c.id)} className="text-left flex-1">
                            <h3 className="font-medium text-foreground hover:text-foreground/80 flex items-center gap-1.5">
                              <FolderOpen size={14} className="text-muted-foreground" />
                              {c.name}
                            </h3>
                          </button>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => renameCollection(c.id)} className="text-muted-foreground/70 hover:text-foreground" title="Rename">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => askDelete(() => deleteCollection(c.id), "Collectie verwijderen?", "Deze collectie én al zijn entries worden permanent verwijderd. Deze actie kan niet ongedaan gemaakt worden.")} disabled={deletingId === c.id} className="text-muted-foreground/70 hover:text-red-500 disabled:opacity-100">
                              {deletingId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          </div>
                        </div>
                        {c.description ? (
                          <p className="text-xs text-muted-foreground mb-3 line-clamp-2 group/desc cursor-pointer hover:text-foreground" onClick={() => editCollectionDescription(c.id)} title="Click to edit">{c.description}</p>
                        ) : (
                          <button onClick={() => editCollectionDescription(c.id)} className="text-xs text-muted-foreground/60 hover:text-foreground mb-3 italic">+ Add description</button>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{cEntries.length} entries</span>
                          <button onClick={() => setSelectedCollection(c.id)} className="text-foreground/80 hover:text-foreground font-medium">View →</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {selectedCollection && (() => {
              const c = collections.find((c) => c.id === selectedCollection)!;
              return (
                <BrandDetail
                  brand={{ name: c.name, url: null, notes: c.description }}
                  entries={getCollectionEntries(selectedCollection)}
                  showAddEntry={showAddEntry}
                  setShowAddEntry={setShowAddEntry}
                  showBatchImport={showBatchImport}
                  setShowBatchImport={setShowBatchImport}
                  newEntry={newEntry}
                  setNewEntry={setNewEntry}
                  addEntry={addEntry}
                  deleteEntry={deleteEntry}
                  savingEntry={savingEntry}
                  deletingId={deletingId}
                  expandedEntry={expandedEntry}
                  setExpandedEntry={setExpandedEntry}
                  getSourceLabel={getSourceLabel}
                  aiExtract={aiExtract}
                  aiLoading={aiLoading}
                  aiError={aiError}
                  setAiError={setAiError}
                  batchText={batchText}
                  setBatchText={setBatchText}
                  batchSource={batchSource}
                  setBatchSource={setBatchSource}
                  batchSeparator={batchSeparator}
                  setBatchSeparator={setBatchSeparator}
                  batchProcessing={batchProcessing}
                  batchProgress={batchProgress}
                  batchResults={batchResults}
                  batchError={batchError}
                  processBatch={processBatch}
                  resetBatch={resetBatch}
                  detectedChunks={detectedChunks}
                  setDetectedChunks={setDetectedChunks}
                  detecting={detecting}
                  detectError={detectError}
                  detectEntries={detectEntries}
                  mergeChunkWithNext={mergeChunkWithNext}
                  deleteChunk={deleteChunk}
                  updateChunk={updateChunk}
                  moveChunk={moveChunk}
                  displayMode={displayMode}
                  onReExtract={reExtractEntry}
                  onUpdateTranslation={updateEntryTranslation}
                />
              );
            })()}
          </div>
        )}

        {view === "entries" && (
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                <input type="text" placeholder="Search across all entries..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-primary" />
              </div>
              <select value={filterContainer} onChange={(e) => setFilterContainer(e.target.value as any)} className="px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-primary">
                <option value="all">All containers</option>
                <option value="brands">Brands only</option>
                <option value="collections">Collections only</option>
              </select>
              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-primary">
                <option value="all">All sources</option>
                {sourceTypes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-primary">
                <option value="all">All subjects</option>
                <option value="product">Product</option>
                <option value="service">Service</option>
                <option value="brand">Brand</option>
                <option value="unclear">Unclear</option>
              </select>
              <LanguageFilter entries={entries} value={filterLanguage} onChange={setFilterLanguage} />
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-primary">
                <option value="all">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>Has {c.label.toLowerCase()}</option>)}
              </select>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{filteredEntries.length} entries</p>
            {filteredEntries.length === 0 ? (
              <div className="bg-card border border-dashed border-border rounded-lg p-12 text-center">
                <p className="text-sm text-muted-foreground">No entries match your filters.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEntries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    containerLabel={entry.brandId ? getBrandName(entry.brandId) : getCollectionName(entry.collectionId)}
                    containerKind={entry.brandId ? "brand" : "collection"}
                    sourceInfo={getSourceLabel(entry.source)}
                    expanded={expandedEntry === entry.id}
                    onToggle={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                    onDelete={() => askDelete(() => deleteEntry(entry.id), "Entry verwijderen?", "Deze entry wordt permanent verwijderd. Deze actie kan niet ongedaan gemaakt worden.")}
                    deleting={deletingId === entry.id}
                    showContainer={true}
                    displayMode={displayMode}
                    onReExtract={reExtractEntry}
                    onUpdateTranslation={updateEntryTranslation}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {view === "synthesis" && (
          <SynthesisView
            scope={synthScope}
            setScope={setSynthScope}
            brands={brands}
            collections={collections}
            entriesForScope={entriesForScope}
            scopeMeta={scopeMeta}
            synthesis={synthesis}
            synthesisMeta={synthesisMeta}
            synthesisLoading={synthesisLoading}
            synthesisError={synthesisError}
            generateSynthesis={generateSynthesis}
          />
        )}
      </div>

      <ConfirmDelete
        open={!!confirmAction}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        onConfirm={() => { confirmAction?.run(); setConfirmAction(null); }}
        title={confirmAction?.title ?? "Verwijderen?"}
        description={confirmAction?.desc ?? "Deze actie kan niet ongedaan gemaakt worden."}
      />
    </div>
  );
}

function BrandDetail(props: any) {
  const {
    brand, entries, showAddEntry, setShowAddEntry, showBatchImport, setShowBatchImport,
    newEntry, setNewEntry, addEntry, deleteEntry, expandedEntry, setExpandedEntry,
    getSourceLabel, aiExtract, aiLoading, aiError, setAiError,
    batchText, setBatchText, batchSource, setBatchSource, batchSeparator, setBatchSeparator,
    batchProcessing, batchProgress, batchResults, batchError, processBatch, resetBatch,
    detectedChunks, setDetectedChunks, detecting, detectError, detectEntries, mergeChunkWithNext, deleteChunk, updateChunk, moveChunk,
    savingEntry, deletingId, displayMode, onReExtract, onUpdateTranslation,
  } = props;
  const [overrideSentiment, setOverrideSentiment] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  return (
    <div>
      <div className="bg-card border border-border rounded-lg p-4 mb-4">
        <h3 className="font-display text-lg font-semibold text-foreground mb-1">{brand.name}</h3>
        {brand.url && <p className="text-xs text-muted-foreground mb-2"><a href={brand.url} target="_blank" rel="noopener" className="hover:text-foreground">{brand.url}</a></p>}
        {brand.notes && <p className="text-sm text-muted-foreground">{brand.notes}</p>}
      </div>

      {showBatchImport && (
        <div className="bg-card border border-border rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-display text-base font-semibold text-foreground flex items-center gap-2"><Layers size={14} />Batch import</h4>
            <button onClick={() => { setShowBatchImport(false); resetBatch(); }} className="text-muted-foreground/70 hover:text-foreground/80"><X size={16} /></button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Paste multiple entries at once. The AI will analyze each one separately and save them all.</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Source type for all entries</label>
              <select value={batchSource} onChange={(e) => setBatchSource(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:border-primary" disabled={batchProcessing}>
                {sourceTypes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">How are entries separated?</label>
              <select value={batchSeparator} onChange={(e) => { setBatchSeparator(e.target.value); setDetectedChunks([]); }} className="w-full px-2 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:border-primary" disabled={batchProcessing || detecting}>
                <option value="smart_ai">Smart split (AI) — recommended</option>
                <option value="blank_line">Blank line between entries</option>
                <option value="triple_dash">Three dashes (---)</option>
                <option value="numbered">Numbered list (1. 2. 3.)</option>
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs text-muted-foreground mb-1 block">Paste your entries</label>
            <textarea value={batchText} onChange={(e) => { setBatchText(e.target.value); if (detectedChunks.length) setDetectedChunks([]); }} rows={10} className="w-full px-2 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:border-primary resize-none font-mono" disabled={batchProcessing || detecting} />
            <p className="text-xs text-muted-foreground/70 mt-1">Maximum 50 entries per batch. Click "Detect entries" to preview the split before AI extraction.</p>
            <p className="text-[11px] text-muted-foreground/80 mt-1 italic">Batch import is text-only. For visual entries, add them one at a time.</p>
          </div>
          {detectError && (
            <div className="bg-orange-50 border border-orange-200 rounded-md p-3 mb-3">
              <p className="text-xs text-orange-900">{detectError}</p>
            </div>
          )}
          {detectedChunks.length > 0 && !batchProcessing && batchResults.length === 0 && (
            <div className="bg-muted/40 border border-border rounded-md p-3 mb-3">
              <p className="text-xs font-medium text-foreground mb-2">{detectedChunks.length} {detectedChunks.length === 1 ? "entry" : "entries"} detected — drag to reorder, edit, or merge before processing</p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {detectedChunks.map((c: string, i: number) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverIndex !== i) setDragOverIndex(i); }}
                    onDragLeave={() => { if (dragOverIndex === i) setDragOverIndex(null); }}
                    onDrop={(e) => { e.preventDefault(); if (dragIndex !== null && dragIndex !== i) moveChunk(dragIndex, i); setDragIndex(null); setDragOverIndex(null); }}
                    onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                    className={`bg-card border rounded p-2 transition-colors ${dragOverIndex === i && dragIndex !== i ? "border-primary bg-primary/5" : "border-border"} ${dragIndex === i ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <span className="cursor-grab active:cursor-grabbing select-none text-muted-foreground/60" title="Drag to reorder">⋮⋮</span>
                        #{i + 1} · {c.length} chars
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => moveChunk(i, i - 1)} disabled={i === 0} className="text-xs text-primary hover:underline disabled:opacity-30 disabled:no-underline" title="Move up">↑</button>
                        <button onClick={() => moveChunk(i, i + 1)} disabled={i === detectedChunks.length - 1} className="text-xs text-primary hover:underline disabled:opacity-30 disabled:no-underline" title="Move down">↓</button>
                        {i < detectedChunks.length - 1 && (
                          <button onClick={() => mergeChunkWithNext(i)} className="text-xs text-primary hover:underline" title="Merge with next">Merge ↓</button>
                        )}
                        <button onClick={() => deleteChunk(i)} className="text-xs text-orange-700 hover:underline" title="Delete">Delete</button>
                      </div>
                    </div>
                    <textarea
                      value={c}
                      onChange={(e) => updateChunk(i, e.target.value)}
                      onDragStart={(e) => e.stopPropagation()}
                      draggable={false}
                      rows={Math.min(6, Math.max(2, c.split("\n").length))}
                      className="w-full px-2 py-1 border border-border rounded text-xs focus:outline-none focus:border-primary resize-none font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {batchProcessing && (
            <div className="bg-accent/10 border border-accent/30 rounded-md p-3 mb-3">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Loader2 size={14} className="animate-spin" />
                Processing {batchProgress.current} of {batchProgress.total}{batchProgress.language && batchProgress.language !== "en" ? ` (${languageName(batchProgress.language)})` : ""}...
              </div>
              <div className="mt-2 bg-accent/20 rounded-full h-1.5 overflow-hidden">
                <div className="bg-primary h-full transition-all" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
              </div>
            </div>
          )}
          {batchError && !batchProcessing && (
            <div className="bg-orange-50 border border-orange-200 rounded-md p-3 mb-3">
              <p className="text-xs text-orange-900">{batchError}</p>
            </div>
          )}
          {batchResults.length > 0 && !batchProcessing && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-3">
              <p className="text-xs text-green-900 font-medium mb-2">Successfully imported {batchResults.length} entries</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {batchResults.slice(0, 5).map((r: any, i: number) => (
                  <div key={i} className="text-xs text-green-800 bg-card/50 p-2 rounded">
                    <p className="line-clamp-1 mb-0.5">{r.rawText}</p>
                    {r.angle && <p className="text-green-700"><span className="font-medium">Angle:</span> {r.angle}</p>}
                  </div>
                ))}
                {batchResults.length > 5 && <p className="text-xs text-green-700">... and {batchResults.length - 5} more</p>}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {batchResults.length === 0 && (
              <>
                <button
                  onClick={detectEntries}
                  disabled={detecting || batchProcessing || !batchText.trim()}
                  className="bg-card border border-primary text-primary text-sm px-3 py-1.5 rounded-md hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {detecting ? (
                    <><Loader2 size={12} className="animate-spin" /> Detecting...</>
                  ) : (
                    <>{detectedChunks.length > 0 ? "Re-detect entries" : "Detect entries"}</>
                  )}
                </button>
                <button
                  onClick={processBatch}
                  disabled={batchProcessing || detecting || detectedChunks.length === 0}
                  className="bg-primary text-white text-sm px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {batchProcessing ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Processing {batchProgress.current}/{batchProgress.total}...
                    </>
                  ) : (
                    <>
                      <Wand2 size={12} />
                      Process {detectedChunks.length || ""} {detectedChunks.length === 1 ? "entry" : "entries"}
                    </>
                  )}
                </button>
              </>
            )}
            {batchResults.length > 0 && !batchProcessing && (
              <button onClick={resetBatch} className="bg-primary text-white text-sm px-3 py-1.5 rounded-md hover:bg-primary/90">Import another batch</button>
            )}
            <button onClick={() => { setShowBatchImport(false); resetBatch(); }} disabled={batchProcessing} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 disabled:text-muted-foreground/40">
              {batchResults.length > 0 ? "Done" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {showAddEntry && (
        <div className="bg-card border border-border rounded-lg p-4 mb-4">
          <h4 className="font-display text-base font-semibold text-foreground mb-3">New entry</h4>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Source type</label>
              <select value={newEntry.source} onChange={(e) => setNewEntry({ ...newEntry, source: e.target.value })} className="w-full px-2 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:border-primary">
                {sourceTypes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sentiment</label>
              {overrideSentiment ? (
                <select value={newEntry.sentiment} onChange={(e) => setNewEntry({ ...newEntry, sentiment: e.target.value })} className="w-full px-2 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:border-primary">
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
                  <option value="mixed">Mixed</option>
                </select>
              ) : (
                <div className="w-full px-2 py-1.5 border border-border rounded-md text-sm flex items-center justify-between bg-muted/30">
                  {newEntry.sentiment ? (
                    <span className={`text-xs px-2 py-0.5 rounded-md ${
                      newEntry.sentiment === "positive" ? "text-green-700 bg-green-50" :
                      newEntry.sentiment === "negative" ? "text-red-700 bg-red-50" :
                      newEntry.sentiment === "mixed" ? "text-orange-700 bg-orange-50" :
                      "text-foreground/80 bg-stone-100"
                    }`}>{newEntry.sentiment}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Auto-detected by AI</span>
                  )}
                  <button type="button" onClick={() => setOverrideSentiment(true)} className="text-xs text-primary hover:underline">Override</button>
                </div>
              )}
            </div>
          </div>
          {newEntry.source === "ad" && (
            <ImageUploader newEntry={newEntry} setNewEntry={setNewEntry} />
          )}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
              <label className="text-xs text-muted-foreground block">Raw text</label>
              <div className="flex items-center gap-2">
                {newEntry.imageFile && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ImageIcon size={11} className="text-primary" />
                    Image will be analyzed alongside text
                  </span>
                )}
                <button onClick={aiExtract} disabled={aiLoading || (!newEntry.rawText.trim() && !newEntry.imageFile)} className="text-xs bg-primary text-white px-2.5 py-1 rounded-md hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed flex items-center gap-1">
                  {aiLoading ? <><Loader2 size={11} className="animate-spin" />Analyzing...</> : <><Wand2 size={11} />AI extract</>}
                </button>
              </div>
            </div>
            <textarea
              placeholder="Paste the original text here, then click 'AI extract'..."
              value={newEntry.rawText}
              onChange={(e) => {
                const v = e.target.value;
                const next = { ...newEntry, rawText: v };
                if (!newEntry.languageOverridden) {
                  next.detectedLanguage = v.trim() ? detectLanguage(v) : "en";
                }
                setNewEntry(next);
              }}
              rows={4}
              className="w-full px-2 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:border-primary resize-none"
            />
            {newEntry.rawText.trim() && (
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Languages size={11} />
                  {newEntry.detectedLanguage === "en"
                    ? "Detected: English — no translation needed"
                    : `Detected: ${languageName(newEntry.detectedLanguage)} — will be translated to English for analysis`}
                </span>
                <select
                  value={newEntry.detectedLanguage}
                  onChange={(e) => setNewEntry({ ...newEntry, detectedLanguage: e.target.value, languageOverridden: true })}
                  className="text-[11px] px-1.5 py-0.5 border border-border rounded bg-card text-muted-foreground focus:outline-none focus:border-primary"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}
            {aiError && <p className="text-xs text-red-600 mt-1">{aiError}</p>}
          </div>
          {[
            ["customerLanguage", "Customer language", "painPoint", "Pain point"],
            ["angle", "Angle", "emotionalTrigger", "Emotional trigger"],
            ["useCase", "Use case", "objection", "Objection"],
            ["desire", "Desire", "tags", "Tags"],
            ["sourceUrl", "Source URL", "rating", "Rating"],
          ].map(([k1, l1, k2, l2], i) => (
            <div key={i} className="grid grid-cols-2 gap-2 mb-3">
              <Field label={l1} value={k1 === "tags" ? (typeof newEntry.tags === "string" ? newEntry.tags : (newEntry.tags as string[]).join(", ")) : (newEntry as any)[k1]} onChange={(v) => setNewEntry({ ...newEntry, [k1]: v })} />
              <Field label={l2} value={k2 === "tags" ? (typeof newEntry.tags === "string" ? newEntry.tags : (newEntry.tags as string[]).join(", ")) : (newEntry as any)[k2]} onChange={(v) => setNewEntry({ ...newEntry, [k2]: v })} />
            </div>
          ))}
          {(newEntry.visualStyle || (newEntry.visualElements && newEntry.visualElements.length > 0)) && (
            <div className="mb-3 p-3 rounded-md bg-muted/40 border border-border">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5 flex items-center gap-1">
                <ImageIcon size={11} /> Visual analysis
              </p>
              {newEntry.visualStyle && <p className="text-xs text-foreground/80 leading-relaxed mb-1.5">{newEntry.visualStyle}</p>}
              {newEntry.visualElements && newEntry.visualElements.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {newEntry.visualElements.map((el, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-card text-muted-foreground border border-border">{el}</span>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={addEntry} disabled={savingEntry || (!newEntry.rawText.trim() && !newEntry.imageFile)} className="bg-primary text-white text-sm px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed flex items-center gap-1.5">
              {savingEntry && <Loader2 size={12} className="animate-spin" />}
              {savingEntry ? "Saving…" : "Save entry"}
            </button>
            <button onClick={() => { if (newEntry.imagePreviewUrl) URL.revokeObjectURL(newEntry.imagePreviewUrl); setNewEntry(emptyEntry); setShowAddEntry(false); setAiError(""); }} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {entries.length === 0 && !showAddEntry && !showBatchImport && (
          <div className="bg-card border border-dashed border-border rounded-lg p-12 text-center">
            <p className="text-sm text-muted-foreground mb-3">No entries for this brand yet.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setShowAddEntry(true)} className="bg-primary text-white text-sm px-3 py-1.5 rounded-md hover:bg-primary/90">Add first entry</button>
              <button onClick={() => setShowBatchImport(true)} className="bg-card border border-border text-foreground/80 text-sm px-3 py-1.5 rounded-md hover:border-primary/50">Or batch import</button>
            </div>
          </div>
        )}
        {entries.map((entry: EntryUI) => (
          <EntryCard key={entry.id} entry={entry} containerLabel={brand.name} containerKind="brand" sourceInfo={getSourceLabel(entry.source)} expanded={expandedEntry === entry.id} onToggle={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)} onDelete={() => askDelete(() => deleteEntry(entry.id), "Entry verwijderen?", "Deze entry wordt permanent verwijderd. Deze actie kan niet ongedaan gemaakt worden.")} deleting={deletingId === entry.id} showContainer={false} displayMode={displayMode} onReExtract={onReExtract} onUpdateTranslation={onUpdateTranslation} />
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:border-primary" />
    </div>
  );
}

function EntryCard({ entry, containerLabel, containerKind, sourceInfo, expanded, onToggle, onDelete, deleting, showContainer, displayMode = "english", onReExtract, onUpdateTranslation }: any) {
  const sentimentColors: Record<string, string> = {
    positive: "text-green-700 bg-green-50",
    negative: "text-red-700 bg-red-50",
    mixed: "text-orange-700 bg-orange-50",
    neutral: "text-foreground/80 bg-stone-100",
  };
  const hasExtras = entry.customerLanguage || entry.painPoint || entry.angle || entry.emotionalTrigger || entry.useCase || entry.objection || entry.desire || entry.visualStyle || (Array.isArray(entry.visualElements) && entry.visualElements.length > 0);
  const tagList: string[] = Array.isArray(entry.tags) ? entry.tags : [];
  const elementsList: string[] = Array.isArray(entry.visualElements) ? entry.visualElements : [];
  const ContainerIcon = containerKind === "collection" ? FolderOpen : Building2;
  const [lightbox, setLightbox] = useState(false);
  const [showTranslationPanel, setShowTranslationPanel] = useState(false);

  const langCode: string = entry.originalLanguage || "en";
  const isNonEnglish = langCode && langCode !== "en";
  const hasTranslation = isNonEnglish && !!entry.translatedText;
  // For non-English entries, default raw text view follows displayMode (english => translated, original => raw).
  // Per-card toggle lets user override.
  const initialShowOriginal = !hasTranslation || displayMode === "original";
  const [showOriginal, setShowOriginal] = useState(initialShowOriginal);
  // Re-sync when global displayMode flips
  useEffect(() => { setShowOriginal(!hasTranslation || displayMode === "original"); }, [displayMode, hasTranslation]);

  const displayedRaw = showOriginal || !hasTranslation ? entry.rawText : entry.translatedText;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden group">
      {entry.imageUrl && (
        <button type="button" onClick={() => setLightbox(true)} className="block w-full bg-muted/30">
          <img src={entry.imageUrl} alt="Entry visual" className="w-full object-cover" style={{ maxHeight: 200 }} loading="lazy" />
        </button>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-md border ${sourceInfo.color}`}>{sourceInfo.label}</span>
            {showContainer && (
              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <ContainerIcon size={11} className="text-muted-foreground/70" />
                {containerLabel}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-md ${sentimentColors[entry.sentiment] ?? sentimentColors.neutral}`}>{entry.sentiment}</span>
            {entry.rating && <span className="text-xs text-muted-foreground">{entry.rating}</span>}
            {isNonEnglish && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/30 font-medium" title={languageName(langCode)}>
                {langCode}
              </span>
            )}
            {entry.subjectType && entry.subjectType !== "unclear" && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 capitalize">{entry.subjectType}</span>
            )}
            {entry.productCategory && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-stone-100 text-foreground/70 border border-stone-200">{entry.productCategory}</span>
            )}
          </div>
          <button onClick={onDelete} disabled={deleting} className="text-muted-foreground/70 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
        {displayedRaw && <p className="text-sm text-foreground/80 mb-2 leading-relaxed whitespace-pre-wrap">{displayedRaw}</p>}
        {hasTranslation && (
          <button
            onClick={() => setShowOriginal((v) => !v)}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
            title={showOriginal ? "Show English translation" : "Show original"}
          >
            <Languages size={11} />
            {showOriginal ? `Show English translation` : `Show original (${languageName(langCode)})`}
          </button>
        )}
        {tagList.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {tagList.map((tag, i) => <span key={i} className="text-xs px-1.5 py-0.5 bg-stone-100 text-muted-foreground rounded">{tag}</span>)}
          </div>
        )}
        {hasExtras && (
          <button onClick={onToggle} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {expanded ? "Hide" : "Show"} extracted insights
          </button>
        )}
        {isNonEnglish && (
          <button
            onClick={() => setShowTranslationPanel((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
          >
            {showTranslationPanel ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Languages size={11} />
            {showTranslationPanel ? "Hide translation review" : "Review translation"}
          </button>
        )}
      </div>
      {showTranslationPanel && isNonEnglish && (
        <TranslationReviewPanel
          entry={entry}
          langCode={langCode}
          onReExtract={onReExtract}
          onUpdateTranslation={onUpdateTranslation}
        />
      )}
      {expanded && hasExtras && (
        <div className="border-t border-stone-100 bg-background p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {isNonEnglish && entry.customerLanguage && entry.customerLanguageEn && entry.customerLanguage !== entry.customerLanguageEn ? (
            <>
              <Insight icon={Quote} label={`Customer language (original — ${languageName(langCode)})`} italic>"{entry.customerLanguage}"</Insight>
              <Insight icon={Quote} label="Customer language (English)" italic>"{entry.customerLanguageEn}"</Insight>
            </>
          ) : (
            (entry.customerLanguageEn || entry.customerLanguage) && <Insight icon={Quote} label="Customer language" italic>"{entry.customerLanguageEn || entry.customerLanguage}"</Insight>
          )}
          {entry.painPoint && <Insight icon={AlertCircle} label="Pain point">{entry.painPoint}</Insight>}
          {entry.angle && <Insight icon={Target} label="Angle">{entry.angle}</Insight>}
          {entry.emotionalTrigger && <Insight icon={Heart} label="Emotional trigger">{entry.emotionalTrigger}</Insight>}
          {entry.useCase && <Insight icon={Lightbulb} label="Use case">{entry.useCase}</Insight>}
          {entry.objection && <Insight icon={AlertCircle} label="Objection">{entry.objection}</Insight>}
          {entry.desire && <div className="md:col-span-2"><Insight icon={Sparkles} label="Desire">{entry.desire}</Insight></div>}
          {entry.visualStyle && (
            <div className="md:col-span-2"><Insight icon={ImageIcon} label="Visual style">{entry.visualStyle}</Insight></div>
          )}
          {elementsList.length > 0 && (
            <div className="md:col-span-2">
              <p className="text-muted-foreground mb-1 flex items-center gap-1"><ImageIcon size={11} />Visual elements</p>
              <div className="flex flex-wrap gap-1">
                {elementsList.map((el, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-foreground/70 border border-stone-200">{el}</span>
                ))}
              </div>
            </div>
          )}
          {entry.sourceUrl && <div className="md:col-span-2"><p className="text-muted-foreground mb-1">Source</p><a href={entry.sourceUrl} target="_blank" rel="noopener" className="text-primary hover:underline truncate block">{entry.sourceUrl}</a></div>}
        </div>
      )}
      {lightbox && entry.imageUrl && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6" onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 text-white/90 hover:text-white" onClick={(e) => { e.stopPropagation(); setLightbox(false); }}>
            <X size={24} />
          </button>
          <img src={entry.imageUrl} alt="Entry visual full size" className="max-w-full max-h-full object-contain rounded" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function TranslationReviewPanel({ entry, langCode, onReExtract, onUpdateTranslation }: any) {
  const [draft, setDraft] = useState<string>(entry.translatedText || "");
  const [saving, setSaving] = useState(false);
  const [reExtracting, setReExtracting] = useState(false);

  useEffect(() => { setDraft(entry.translatedText || ""); }, [entry.id, entry.translatedText]);

  const dirty = draft !== (entry.translatedText || "");
  const origLen = (entry.rawText || "").length;
  const trLen = draft.length;
  const suspiciouslyShort = origLen > 200 && trLen > 0 && trLen < origLen * 0.4;

  async function handleSave() {
    if (!onUpdateTranslation || !dirty) return;
    setSaving(true);
    try {
      await onUpdateTranslation(entry.id, draft);
      toast.success("Translation updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save translation");
    } finally {
      setSaving(false);
    }
  }

  async function handleReExtract() {
    if (!onReExtract) return;
    setReExtracting(true);
    try {
      await onReExtract(entry.id);
      toast.success("Extraction refreshed");
    } catch (err: any) {
      toast.error(err?.message || "Re-extraction failed");
    } finally {
      setReExtracting(false);
    }
  }

  return (
    <div className="border-t border-stone-100 bg-background p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
          <Languages size={12} />Translation review
        </h4>
        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/30 font-medium">
          {langCode} → EN
        </span>
      </div>
      {suspiciouslyShort && (
        <div className="mb-3 text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded-md px-2 py-1">
          Translation looks much shorter than the original — consider re-running extraction.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">Original ({languageName(langCode)})</p>
          <div className="text-xs text-foreground/80 bg-card border border-border rounded-md p-2 whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed">
            {entry.rawText}
          </div>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground mb-1">English translation <span className="text-muted-foreground/70">— editable</span></p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full text-xs text-foreground/80 bg-card border border-border rounded-md p-2 leading-relaxed focus:outline-none focus:border-primary"
            rows={Math.min(14, Math.max(6, Math.ceil((entry.rawText || "").length / 80)))}
            placeholder="No translation yet. Re-run extraction to generate one."
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="text-xs bg-primary text-white px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : null}
          Save edits
        </button>
        <button
          onClick={() => setDraft(entry.translatedText || "")}
          disabled={!dirty || saving}
          className="text-xs bg-card border border-border text-foreground/80 px-3 py-1.5 rounded-md hover:border-primary/50 disabled:opacity-50"
        >
          Revert
        </button>
        <button
          onClick={handleReExtract}
          disabled={reExtracting}
          className="text-xs bg-card border border-border text-foreground/80 px-3 py-1.5 rounded-md hover:border-primary/50 disabled:opacity-50 flex items-center gap-1.5 ml-auto"
        >
          {reExtracting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {reExtracting ? "Re-running…" : "Re-run extraction"}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground/70 mt-2">
        Re-running extraction overwrites translation, customer phrases, and all extracted fields for this entry.
      </p>
    </div>
  );
}

function LanguageFilter({ entries, value, onChange }: { entries: EntryUI[]; value: string; onChange: (v: string) => void }) {
  const codes = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(e.originalLanguage || "en"));
    return Array.from(set).sort();
  }, [entries]);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:border-primary">
      <option value="all">All languages</option>
      {codes.map((c) => (
        <option key={c} value={c}>{languageName(c)}</option>
      ))}
    </select>
  );
}

function ImageUploader({ newEntry, setNewEntry }: { newEntry: typeof emptyEntry; setNewEntry: (v: typeof emptyEntry) => void }) {
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file: File | null | undefined) {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Only JPEG, PNG, WebP, or GIF images are allowed");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be 10MB or smaller");
      return;
    }
    if (newEntry.imagePreviewUrl) URL.revokeObjectURL(newEntry.imagePreviewUrl);
    const previewUrl = URL.createObjectURL(file);
    setNewEntry({ ...newEntry, imageFile: file, imagePreviewUrl: previewUrl });
  }

  function clearImage() {
    if (newEntry.imagePreviewUrl) URL.revokeObjectURL(newEntry.imagePreviewUrl);
    setNewEntry({ ...newEntry, imageFile: null, imagePreviewUrl: "" });
  }

  return (
    <div className="mb-3">
      <label className="text-xs text-muted-foreground mb-1 block">Image <span className="text-muted-foreground/70">— optional, adds visual context for AI analysis</span></label>
      {newEntry.imagePreviewUrl ? (
        <div className="relative inline-block">
          <img src={newEntry.imagePreviewUrl} alt="Preview" className="rounded border border-border" style={{ maxHeight: 240 }} />
          <button type="button" onClick={clearImage} className="absolute -top-2 -right-2 bg-card border border-border rounded-full p-1 shadow hover:bg-muted">
            <X size={12} />
          </button>
        </div>
      ) : (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
          className={`flex flex-col items-center justify-center gap-1 px-3 py-6 border border-dashed rounded-md cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
        >
          <Upload size={16} className="text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Drag and drop or <span className="text-primary">click to upload</span></p>
          <p className="text-[10px] text-muted-foreground/70">JPEG, PNG, WebP, GIF · max 10MB</p>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        </label>
      )}
    </div>
  );
}

function Insight({ icon: Icon, label, children, italic }: any) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 flex items-center gap-1"><Icon size={11} />{label}</p>
      <p className={`text-stone-800 ${italic ? "italic" : ""}`}>{children}</p>
    </div>
  );
}

function SynthesisView({
  scope, setScope, brands, collections, entriesForScope, scopeMeta,
  synthesis, synthesisMeta, synthesisLoading, synthesisError, generateSynthesis,
}: any) {
  const scopedCount = entriesForScope(scope).length;
  const scopeLabel = scopeMeta(scope).label;
  const isStale = synthesisMeta && synthesisMeta.entryCount !== scopedCount;
  const intensityColor: Record<string, string> = {
    high: "bg-red-50 text-red-700 border-red-200",
    medium: "bg-orange-50 text-orange-700 border-orange-200",
    low: "bg-stone-100 text-foreground/70 border-border",
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground/80 mb-1.5">Brands</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button onClick={() => setScope("all_brands")} className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1 ${scope === "all_brands" ? "bg-primary text-white border-primary" : "bg-card text-foreground/80 border-border hover:border-primary/50"}`}>
            <Building2 size={11} /> All brands combined
          </button>
          {brands.map((b: Brand) => {
            const s = `brand:${b.id}`;
            return (
              <button key={b.id} onClick={() => setScope(s)} className={`text-xs px-2.5 py-1 rounded-md border ${scope === s ? "bg-primary text-white border-primary" : "bg-card text-foreground/80 border-border hover:border-primary/50"}`}>{b.name}</button>
            );
          })}
        </div>
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground/80 mb-1.5">Collections</p>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setScope("all_collections")} className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1 ${scope === "all_collections" ? "bg-primary text-white border-primary" : "bg-card text-foreground/80 border-border hover:border-primary/50"}`}>
            <FolderOpen size={11} /> All collections combined
          </button>
          {collections.map((c: Collection) => {
            const s = `collection:${c.id}`;
            return (
              <button key={c.id} onClick={() => setScope(s)} className={`text-xs px-2.5 py-1 rounded-md border ${scope === s ? "bg-primary text-white border-primary" : "bg-card text-foreground/80 border-border hover:border-primary/50"}`}>{c.name}</button>
            );
          })}
          {collections.length === 0 && <span className="text-xs text-muted-foreground italic">No collections yet</span>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-display text-xl font-semibold text-foreground tracking-tight">{scopeLabel} synthesis</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {scopedCount} {scopedCount === 1 ? "entry" : "entries"} in scope
              {synthesisMeta && (
                <> · last generated {new Date(synthesisMeta.updatedAt).toLocaleString()} ({synthesisMeta.entryCount} entries)</>
              )}
            </p>
            {isStale && (
              <p className="text-xs text-primary mt-1 italic">
                {scopedCount - synthesisMeta!.entryCount > 0
                  ? `${scopedCount - synthesisMeta!.entryCount} new entries since last synthesis`
                  : "Entry count changed — regenerate for fresh insights"}
              </p>
            )}
          </div>
          <button
            onClick={generateSynthesis}
            disabled={synthesisLoading || scopedCount === 0}
            className="bg-primary text-white text-sm px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground flex items-center gap-1.5"
          >
            {synthesisLoading ? <><Loader2 size={12} className="animate-spin" /> Synthesizing…</> : <><Sparkles size={12} /> {synthesis ? "Regenerate" : "Generate synthesis"}</>}
          </button>
        </div>
        {synthesisError && (
          <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{synthesisError}</div>
        )}
      </div>

      {!synthesis && !synthesisLoading && (
        <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center">
          <Sparkles size={20} className="text-muted-foreground mx-auto mb-2" />
          <p className="font-display text-base text-foreground">No synthesis yet</p>
          <p className="text-xs text-muted-foreground mt-1">Hit "Generate synthesis" to let the AI find patterns across {scopedCount || "your"} entries.</p>
        </div>
      )}

      {synthesis && (
        <>
          <div className="bg-card border border-border rounded-lg p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Executive summary</p>
            <p className="font-display italic text-lg text-foreground/90 leading-snug">{synthesis.summary}</p>
          </div>

          {Array.isArray(synthesis.painPointClusters) && synthesis.painPointClusters.length > 0 && (
            <SynthesisSection title="Pain point clusters" icon={AlertCircle}>
              {synthesis.painPointClusters.map((c: any, i: number) => (
                <div key={i} className="border-l-2 border-primary/40 pl-3 py-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-display text-sm font-semibold text-foreground">{c.theme}</h4>
                    <span className="text-[10px] text-muted-foreground">×{c.frequency}</span>
                    {c.intensity && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${intensityColor[c.intensity] ?? intensityColor.low}`}>{c.intensity}</span>}
                  </div>
                  <p className="text-sm text-foreground/80 mt-1">{c.description}</p>
                  {Array.isArray(c.exampleQuotes) && c.exampleQuotes.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {c.exampleQuotes.map((q: string, j: number) => (
                        <li key={j} className="text-xs italic text-muted-foreground">"{q}"</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </SynthesisSection>
          )}

          {Array.isArray(synthesis.angleClusters) && synthesis.angleClusters.length > 0 && (
            <SynthesisSection title="Angle clusters" icon={Target}>
              {synthesis.angleClusters.map((c: any, i: number) => (
                <div key={i} className="border-l-2 border-accent/40 pl-3 py-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-display text-sm font-semibold text-foreground">{c.theme}</h4>
                    <span className="text-[10px] text-muted-foreground">×{c.frequency}</span>
                  </div>
                  <p className="text-sm text-foreground/80 mt-1">{c.description}</p>
                  {Array.isArray(c.examples) && c.examples.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {c.examples.map((q: string, j: number) => (
                        <li key={j} className="text-xs italic text-muted-foreground">"{q}"</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </SynthesisSection>
          )}

          {Array.isArray(synthesis.customerLanguagePatterns) && synthesis.customerLanguagePatterns.length > 0 && (
            <SynthesisSection title="Customer language patterns" icon={Quote}>
              {synthesis.customerLanguagePatterns.map((p: any, i: number) => (
                <CustomerLanguagePattern key={i} pattern={p} />
              ))}
            </SynthesisSection>
          )}

          {synthesis.emotionalLandscape && (
            <SynthesisSection title="Emotional landscape" icon={Heart}>
              <div>
                <span className="inline-block text-xs px-2 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/30 font-medium">
                  {synthesis.emotionalLandscape.dominant}
                </span>
                <p className="text-sm text-foreground/80 mt-2">{synthesis.emotionalLandscape.breakdown}</p>
              </div>
            </SynthesisSection>
          )}

          {Array.isArray(synthesis.marketGaps) && synthesis.marketGaps.length > 0 && (
            <SynthesisSection title="Market gaps" icon={Layers}>
              {synthesis.marketGaps.map((g: any, i: number) => (
                <div key={i} className="border-l-2 border-primary/40 pl-3 py-1">
                  <h4 className="font-display text-sm font-semibold text-foreground">{g.gap}</h4>
                  <p className="text-xs text-muted-foreground mt-1"><span className="text-foreground/70 font-medium">Evidence:</span> {g.evidence}</p>
                  <p className="text-xs text-muted-foreground mt-0.5"><span className="text-foreground/70 font-medium">Opportunity:</span> {g.opportunity}</p>
                </div>
              ))}
            </SynthesisSection>
          )}

          {Array.isArray(synthesis.topAngles) && synthesis.topAngles.length > 0 && (
            <SynthesisSection title="Top angles" icon={Sparkles}>
              {synthesis.topAngles.map((a: any, i: number) => (
                <div key={i} className="border-l-2 border-primary pl-3 py-1">
                  <h4 className="font-display text-base font-semibold text-foreground tracking-tight">{a.headline}</h4>
                  <p className="text-sm text-foreground/80 mt-1">{a.rationale}</p>
                  {a.supportingEvidence && <p className="text-xs italic text-muted-foreground mt-1">"{a.supportingEvidence}"</p>}
                </div>
              ))}
            </SynthesisSection>
          )}

          {Array.isArray(synthesis.objections) && synthesis.objections.length > 0 && (
            <SynthesisSection title="Objections" icon={AlertCircle}>
              {synthesis.objections.map((o: any, i: number) => (
                <div key={i} className="border-l-2 border-border pl-3 py-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-display text-sm font-semibold text-foreground">{o.objection}</h4>
                    <span className="text-[10px] text-muted-foreground">×{o.frequency}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1"><span className="text-foreground/70 font-medium">How to address:</span> {o.howToAddress}</p>
                </div>
              ))}
            </SynthesisSection>
          )}

          {Array.isArray(synthesis.visualPatterns) && synthesis.visualPatterns.length > 0 && (
            <SynthesisSection title="Visual patterns" icon={ImageIcon}>
              {synthesis.visualPatterns.map((p: any, i: number) => {
                const exampleIds: string[] = Array.isArray(p.examples) ? p.examples : [];
                const thumbs = exampleIds
                  .map((id) => entriesForScope(scope).find((e: EntryUI) => e.id === id))
                  .filter((e: any) => e && e.imageUrl);
                return (
                  <div key={i} className="border-l-2 border-accent/40 pl-3 py-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-display text-sm font-semibold text-foreground">{p.pattern}</h4>
                      <span className="text-[10px] text-muted-foreground">×{p.frequency}</span>
                    </div>
                    <p className="text-sm text-foreground/80 mt-1">{p.description}</p>
                    {thumbs.length > 0 && (
                      <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                        {thumbs.map((e: any) => (
                          <img key={e.id} src={e.imageUrl} alt="" className="h-16 w-16 object-cover rounded border border-border flex-shrink-0" loading="lazy" />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </SynthesisSection>
          )}

          {synthesis.strategicRecommendations && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary mb-2">Strategic recommendations</p>
              <p className="font-display text-base text-foreground leading-relaxed">{synthesis.strategicRecommendations}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SynthesisSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <Icon size={16} className="text-muted-foreground" />
        <h3 className="font-display text-base font-semibold text-foreground tracking-tight">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function CustomerLanguagePattern({ pattern }: { pattern: any }) {
  const [open, setOpen] = useState(false);
  const originals: { language: string; phrase: string }[] = Array.isArray(pattern.originalPhrases) ? pattern.originalPhrases : [];
  return (
    <div className="border-l-2 border-border pl-3 py-1">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-display italic text-sm text-foreground">"{pattern.phrase}"</p>
        <span className="text-[10px] text-muted-foreground">×{pattern.frequency}</span>
        {originals.length > 0 && (
          <button onClick={() => setOpen((v) => !v)} className="text-[10px] text-primary hover:underline flex items-center gap-1">
            <Languages size={10} />
            {open ? "Hide" : "Show"} originals ({originals.length})
          </button>
        )}
      </div>
      {pattern.context && <p className="text-xs text-muted-foreground mt-0.5">{pattern.context}</p>}
      {open && originals.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {originals.map((o, i) => (
            <li key={i} className="text-xs text-muted-foreground">
              <span className="text-[10px] uppercase tracking-wider px-1 py-0.5 rounded bg-stone-100 text-foreground/70 mr-1.5">{o.language}</span>
              <span className="italic">"{o.phrase}"</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
