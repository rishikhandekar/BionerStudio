import { NextRequest, NextResponse } from "next/server";

/* -------------------------------------------------------------------------- */
/*  BioNER Studio – /api/analyze                                              */
/*  1. Tries Hugging Face Inference API (d4data/biomedical-ner-all)           */
/*  2. Falls back to a built-in clinical span-matcher if the token is         */
/*     missing, the model is cold-starting, or the network fails.             */
/* -------------------------------------------------------------------------- */


type EntityGroup = "DISEASE" | "CHEMICAL" | "GENE" | "ANATOMY" | "PROCEDURE";
type Engine = "huggingface" | "huggingface+lexicon" | "fallback";

interface Entity {
  start: number;
  end: number;
  word: string;
  entity_group: EntityGroup;
  score: number;
  raw_label: string;
  source: "model" | "lexicon";
}

interface RawItem {
  entity_group?: string;
  entity?: string;
  score?: number;
  word?: string;
  start?: number;
  end?: number;
}

const MODEL_ID = "d4data/biomedical-ner-all";
const HF_URL =
  process.env.HF_API_URL ??
  `https://router.huggingface.co/hf-inference/models/${MODEL_ID}`;
const MAX_CHARS = 8000;
const HF_TIMEOUT_MS = 12000;
const GROUPS: EntityGroup[] = ["DISEASE", "CHEMICAL", "GENE", "ANATOMY", "PROCEDURE"];

/* ------------------------- label mapping (raw -> 5) ------------------------ */

const LABEL_MAP: Record<string, EntityGroup> = {
  // d4data/biomedical-ner-all (MACCROBAT) labels
  disease_disorder: "DISEASE",
  sign_symptom: "DISEASE",
  medication: "CHEMICAL",
  biological_structure: "ANATOMY",
  therapeutic_procedure: "PROCEDURE",
  diagnostic_procedure: "PROCEDURE",
  dosage: "PROCEDURE",
  // generic labels so other NER models can be swapped in via HF_API_URL
  disease: "DISEASE",
  chemical: "CHEMICAL",
  drug: "CHEMICAL",
  gene: "GENE",
  protein: "GENE",
  gene_or_gene_product: "GENE",
  anatomy: "ANATOMY",
  procedure: "PROCEDURE",
};

/* ----------------------------- clinical lexicon ---------------------------- */
/* ci = case-insensitive terms (plural "s"/"es" allowed)                       */
/* cs = case-sensitive terms (abbreviations / gene symbols)                    */

interface Lex {
  ci: string[];
  cs: string[];
}

const LEXICON: Record<EntityGroup, Lex> = {
  DISEASE: {
    ci: [
      "non-small cell lung cancer", "small cell lung cancer", "lung adenocarcinoma", "adenocarcinoma",
      "squamous cell carcinoma", "hepatocellular carcinoma", "carcinoma", "lung cancer", "breast cancer",
      "colorectal cancer", "prostate cancer", "pancreatic cancer", "gastric cancer", "ovarian cancer",
      "melanoma", "lymphoma", "leukemia", "myeloma", "glioblastoma", "sarcoma", "cancer", "malignancy",
      "neoplasm", "tumor", "tumour", "metastasis", "metastases", "brain metastases",
      "central nervous system metastases", "CNS metastases", "leptomeningeal disease",
      "interstitial lung disease", "pneumonitis", "pneumonia", "tuberculosis", "COVID-19", "SARS-CoV-2",
      "influenza", "sepsis", "infection", "fever", "cough", "dyspnea", "fatigue", "nausea", "vomiting",
      "diarrhea", "rash", "headache", "dizziness", "edema", "anemia", "neutropenia", "thrombocytopenia",
      "hypertension", "hypotension", "diabetes mellitus", "type 2 diabetes", "type 1 diabetes", "diabetes",
      "obesity", "hyperlipidemia", "dyslipidemia", "hypoxia", "atrial fibrillation", "atrial flutter",
      "ischemic stroke", "hemorrhagic stroke", "stroke", "systemic embolism", "venous thromboembolism",
      "thromboembolism", "embolism", "deep vein thrombosis", "pulmonary embolism", "intracranial hemorrhage",
      "gastrointestinal bleeding", "major bleeding", "bleeding", "hemorrhage", "myocardial infarction",
      "heart failure", "coronary artery disease", "cardiovascular disease", "arrhythmia", "bradycardia",
      "tachycardia", "palpitations", "syncope", "chronic kidney disease", "renal impairment", "renal failure",
      "kidney disease", "liver disease", "cirrhosis", "asthma", "chronic obstructive pulmonary disease",
      "Alzheimer's disease", "Alzheimer disease", "mild dementia", "dementia", "mild cognitive impairment",
      "cognitive impairment", "cognitive decline", "neurodegeneration", "amyloid pathology", "amyloid plaques",
      "amyloid-related imaging abnormalities", "neurofibrillary tangles", "cerebral amyloid angiopathy",
      "microhemorrhage", "Parkinson's disease", "multiple sclerosis", "epilepsy", "seizures", "depression",
      "anxiety", "schizophrenia", "rheumatoid arthritis", "arthritis", "osteoporosis", "psoriasis",
      "Crohn's disease", "ulcerative colitis", "hepatitis", "HIV", "anaphylaxis", "sleep apnea",
      "hyperthyroidism", "hypothyroidism", "migraine",
    ],
    cs: ["NSCLC", "SCLC", "AF", "MCI", "COPD", "CKD", "CAD", "ILD", "ARIA-E", "ARIA-H", "ARIA", "VTE", "DVT", "T2DM", "CVD"],
  },
  CHEMICAL: {
    ci: [
      "osimertinib", "gefitinib", "erlotinib", "afatinib", "dacomitinib", "imatinib", "sunitinib", "lapatinib",
      "crizotinib", "alectinib", "lorlatinib", "sotorasib", "trametinib", "dabrafenib", "vemurafenib", "olaparib",
      "pemetrexed", "cisplatin", "carboplatin", "oxaliplatin", "paclitaxel", "docetaxel", "gemcitabine",
      "irinotecan", "fluorouracil", "capecitabine", "temozolomide", "cyclophosphamide", "doxorubicin",
      "methotrexate", "lenalidomide", "bortezomib", "azacitidine", "pembrolizumab", "nivolumab", "atezolizumab",
      "durvalumab", "ipilimumab", "bevacizumab", "trastuzumab", "cetuximab", "rituximab", "tocilizumab",
      "adalimumab", "infliximab", "etanercept", "ruxolitinib", "tamoxifen", "apixaban", "rivaroxaban",
      "dabigatran", "edoxaban", "warfarin", "heparin", "enoxaparin", "fondaparinux", "bivalirudin", "andexanet",
      "protamine", "tranexamic acid", "alteplase", "tenecteplase", "aspirin", "clopidogrel", "ticagrelor",
      "prasugrel", "digoxin", "amiodarone", "metoprolol", "bisoprolol", "carvedilol", "propranolol", "verapamil",
      "diltiazem", "atorvastatin", "rosuvastatin", "simvastatin", "lisinopril", "enalapril", "ramipril",
      "losartan", "valsartan", "sacubitril", "amlodipine", "furosemide", "spironolactone", "hydrochlorothiazide",
      "empagliflozin", "dapagliflozin", "semaglutide", "liraglutide", "sitagliptin", "glipizide", "pioglitazone",
      "metformin", "insulin", "nitroglycerin", "lecanemab", "donanemab", "aducanumab", "donepezil", "memantine",
      "rivastigmine", "galantamine", "levodopa", "levetiracetam", "valproate", "carbamazepine", "sertraline",
      "fluoxetine", "ibuprofen", "acetaminophen", "paracetamol", "dexamethasone", "prednisone", "amoxicillin",
      "azithromycin", "vancomycin", "remdesivir", "nirmatrelvir", "ritonavir", "tenofovir", "hydroxychloroquine",
      "ivermectin", "oseltamivir", "omeprazole", "pantoprazole", "levothyroxine", "tacrolimus", "cyclosporine",
      "sirolimus", "everolimus", "morphine", "fentanyl", "ketamine", "propofol", "lidocaine", "naloxone",
      "epinephrine", "norepinephrine", "dopamine", "serotonin", "acetylcholine", "glutamate", "caffeine",
      "nicotine", "ethanol", "vitamin K antagonist", "vitamin K", "vitamin D", "tyrosine kinase inhibitor",
      "direct oral anticoagulant", "anticoagulant", "antiplatelet", "antibiotic", "opioid", "corticosteroid",
      "beta-blocker", "ACE inhibitor", "statin", "monoclonal antibody", "platinum", "placebo", "oxygen",
      "glucose", "LDL cholesterol", "cholesterol",
    ],
    cs: ["TKI", "TKIs", "DOAC", "DOACs", "NOAC", "NOACs", "LMWH", "NSAID", "NSAIDs"],
  },
  GENE: {
    ci: [
      "amyloid-beta", "amyloid beta", "beta-amyloid", "amyloid-β", "amyloid precursor protein",
      "hyperphosphorylated tau", "phosphorylated tau", "tau protein", "p-tau181", "p-tau217", "p-tau", "tau",
      "neurofilament light chain", "neurofilament light", "apolipoprotein E", "cytochrome P450", "factor Xa",
      "thrombin", "fibrinogen", "vascular endothelial growth factor", "epidermal growth factor receptor",
      "tumor necrosis factor alpha", "tumor necrosis factor", "interleukin-6", "interleukin-1",
      "C-reactive protein", "troponin", "brain natriuretic peptide", "natriuretic peptide", "NT-proBNP",
      "programmed death-ligand 1", "programmed cell death protein 1", "insulin receptor", "hemoglobin",
      "albumin", "ctDNA", "cell-free DNA", "exon 19 deletion", "exon 20 insertion",
    ],
    cs: [
      "EGFR", "ALK", "ROS1", "KRAS", "NRAS", "HRAS", "BRAF", "MET", "RET", "NTRK", "HER2", "ERBB2", "TP53",
      "PIK3CA", "PTEN", "APC", "MLH1", "MSH2", "BRCA1", "BRCA2", "APOE ε4", "APOE4", "APOE", "APP", "PSEN1",
      "PSEN2", "MAPT", "TREM2", "GBA", "LRRK2", "SNCA", "CYP2C9", "CYP3A4", "CYP2D6", "CYP2C19", "VKORC1",
      "ABCB1", "P-gp", "PD-L1", "PD-1", "CTLA-4", "VEGF", "VEGFR", "TNF-α", "IL-6", "IL-1β", "CRP", "BNP",
      "T790M", "L858R", "C797S", "G12C", "V600E", "Aβ42", "Aβ40", "Aβ", "NfL", "GFAP", "BDNF",
    ],
  },
  ANATOMY: {
    ci: [
      "central nervous system", "cerebrospinal fluid", "left atrial appendage", "left atrium", "right atrium",
      "left ventricle", "right ventricle", "atrium", "ventricle", "lungs", "lung", "brain", "heart", "liver",
      "kidney", "pancreas", "colon", "breast", "prostate", "stomach", "intestine", "gastrointestinal tract",
      "bone marrow", "bone", "lymph node", "blood", "plasma", "serum", "hippocampus", "cerebral cortex",
      "frontal cortex", "temporal lobe", "frontal lobe", "parietal lobe", "occipital lobe", "cortex",
      "brainstem", "spinal cord", "coronary artery", "artery", "vein", "skin", "thyroid", "pleura",
      "mediastinum", "chest", "abdomen", "neuron", "synapse", "cerebral", "intracranial", "thorax", "pelvis",
      "bladder", "esophagus", "cervix", "ovary", "uterus", "muscle", "joint", "retina",
    ],
    cs: ["CNS", "CSF"],
  },
  PROCEDURE: {
    ci: [
      "computed tomography", "CT scan", "brain MRI", "magnetic resonance imaging", "positron emission tomography",
      "amyloid PET", "tau PET", "PET imaging", "PET scan", "MRI monitoring", "ultrasound", "echocardiography",
      "electrocardiogram", "cardiac catheterization", "catheter ablation", "electrical cardioversion",
      "cardioversion", "percutaneous coronary intervention", "coronary artery bypass grafting", "stenting",
      "angioplasty", "thrombolysis", "thrombectomy", "left atrial appendage occlusion", "rate control",
      "rhythm control", "anticoagulant therapy", "antithrombotic therapy", "anticoagulation", "dose adjustment",
      "dose reduction", "INR monitoring", "genotyping", "next-generation sequencing", "liquid biopsy", "biopsy",
      "lumbar puncture", "cerebrospinal fluid analysis", "blood test", "chemotherapy", "radiotherapy",
      "radiation therapy", "immunotherapy", "targeted therapy", "first-line therapy", "second-line therapy",
      "adjuvant therapy", "neoadjuvant therapy", "maintenance therapy", "surgical resection", "surgery",
      "resection", "lobectomy", "mastectomy", "stem cell transplantation", "transplantation", "dialysis",
      "transfusion", "intubation", "mechanical ventilation", "vaccination", "intravenous infusion", "infusion",
      "cognitive assessment", "neuropsychological testing", "Clinical Dementia Rating-Sum of Boxes",
      "Mini-Mental State Examination",
    ],
    cs: ["MRI", "PET", "CT", "ECG", "EKG", "PCI", "CABG", "NGS", "CDR-SB", "MMSE"],
  },
};

/* Regex rules for dosage / frequency expressions (always PROCEDURE) */
const UNIT = "(?:mg|mcg|µg|μg|g|mL|ml|IU|units?)";
const DOSE_RULES: RegExp[] = [
  new RegExp(
    `(?<![\\w.])\\d+(?:[.,]\\d+)?\\s?${UNIT}(?:\\/(?:kg|day|d|m2|m²|mL|ml))?(?:\\s(?:once|twice|three times)\\s(?:daily|a day|weekly|per day))?(?![\\p{L}])`,
    "giu"
  ),
  new RegExp("(?<![\\p{L}])(?:once|twice)\\s+daily(?![\\p{L}])", "giu"),
  new RegExp("(?<![\\p{L}])(?:QD|BID|TID)(?![\\p{L}])", "gu"),
];

/* ------------------------------ regex compiler ----------------------------- */

const BOUND_L = "(?<![\\p{L}\\p{N}])";
const BOUND_R = "(?![\\p{L}\\p{N}])";

function toPattern(term: string): string {
  return term
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+")
    .replace(/-/g, "[-\\s]?");
}

function compile(terms: string[], flags: string, plural: boolean): RegExp | null {
  if (terms.length === 0) return null;
  const alts = terms
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(toPattern)
    .join("|");
  return new RegExp(`${BOUND_L}(?:${alts})${plural ? "(?:s|es)?" : ""}${BOUND_R}`, flags);
}

interface CompiledRule {
  group: EntityGroup;
  re: RegExp;
}

const COMPILED: CompiledRule[] = [];
GROUPS.forEach((group) => {
  const ci = compile(LEXICON[group].ci, "giu", true);
  const cs = compile(LEXICON[group].cs, "gu", false);
  if (ci) COMPILED.push({ group, re: ci });
  if (cs) COMPILED.push({ group, re: cs });
});

interface Span {
  start: number;
  end: number;
  group: EntityGroup;
}

function lexiconSpans(text: string, only?: EntityGroup[]): Span[] {
  // Normalise typography WITHOUT changing string length, so offsets stay exact.
  const norm = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u00a0/g, " ");
  const spans: Span[] = [];
  const run = (re: RegExp, group: EntityGroup) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(norm)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      spans.push({ start: m.index, end: m.index + m[0].length, group });
    }
  };
  COMPILED.forEach(({ group, re }) => {
    if (!only || only.indexOf(group) !== -1) run(re, group);
  });
  if (!only || only.indexOf("PROCEDURE") !== -1) DOSE_RULES.forEach((re) => run(re, "PROCEDURE"));
  return spans;
}

/* --------------------------------- scoring --------------------------------- */

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic pseudo-confidence in [0.82, 0.99] so repeated demos are stable. */
function pseudoScore(word: string, group: EntityGroup): number {
  const h = fnv1a(`${group}:${word.toLowerCase()}`);
  return Math.round((0.82 + (h % 1701) / 10000) * 1000) / 1000;
}

/* ------------------------- overlap resolution / merge ---------------------- */

function mergeEntities(primary: Entity[], secondary: Entity[], textLength: number): Entity[] {
  const mask = new Uint8Array(textLength + 1);
  const out: Entity[] = [];
  const take = (e: Entity) => {
    for (let i = e.start; i < e.end; i++) if (mask[i]) return;
    for (let i = e.start; i < e.end; i++) mask[i] = 1;
    out.push(e);
  };
  const byPriority = (a: Entity, b: Entity) =>
    b.end - b.start - (a.end - a.start) || a.start - b.start;
  primary.slice().sort(byPriority).forEach(take);
  secondary.slice().sort(byPriority).forEach(take);
  return out.sort((a, b) => a.start - b.start || b.end - a.end);
}

function lexiconEntities(text: string, only?: EntityGroup[]): Entity[] {
  return lexiconSpans(text, only).map((s) => {
    const word = text.slice(s.start, s.end);
    return {
      start: s.start,
      end: s.end,
      word,
      entity_group: s.group,
      score: pseudoScore(word, s.group),
      raw_label: `lexicon:${s.group.toLowerCase()}`,
      source: "lexicon" as const,
    };
  });
}

/* ------------------------------ Hugging Face ------------------------------- */

function chunkText(text: string, max = 1000): { text: string; offset: number }[] {
  const chunks: { text: string; offset: number }[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + max, text.length);
    if (end < text.length) {
      const win = text.slice(start, end);
      const brk = Math.max(win.lastIndexOf(". "), win.lastIndexOf(".\n"), win.lastIndexOf("\n"));
      if (brk > max * 0.4) {
        end = start + brk + 1;
      } else {
        const sp = win.lastIndexOf(" ");
        if (sp > max * 0.4) end = start + sp;
      }
    }
    chunks.push({ text: text.slice(start, end), offset: start });
    start = end;
  }
  return chunks;
}

/** Defensive: merge raw token-level B-/I- output if the endpoint ignores aggregation. */
function mergeTokenLevel(items: RawItem[]): RawItem[] {
  const out: (RawItem & { _scores: number[] })[] = [];
  let cur: (RawItem & { _scores: number[] }) | null = null;
  items.forEach((it) => {
    const m = /^([BI])-(.+)$/.exec(it.entity ?? "");
    if (!m || typeof it.start !== "number" || typeof it.end !== "number") return;
    const label = m[2];
    const score = typeof it.score === "number" ? it.score : 0;
    if (cur && m[1] === "I" && cur.entity_group === label && it.start - (cur.end as number) <= 1) {
      cur.end = it.end;
      cur._scores.push(score);
    } else {
      cur = { entity_group: label, start: it.start, end: it.end, _scores: [score] };
      out.push(cur);
    }
  });
  return out.map((o) => ({
    entity_group: o.entity_group,
    start: o.start,
    end: o.end,
    score: o._scores.reduce((a, b) => a + b, 0) / o._scores.length,
  }));
}

async function callHF(chunk: string, token: string, signal: AbortSignal): Promise<RawItem[]> {
  const res = await fetch(HF_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: chunk, parameters: { aggregation_strategy: "simple" } }),
    signal,
    cache: "no-store",
  });
  if (res.status === 503) throw new Error("Model is cold-starting (HTTP 503)");
  if (res.status === 401 || res.status === 403) throw new Error(`Hugging Face rejected the token (HTTP ${res.status})`);
  if (!res.ok) throw new Error(`Hugging Face API error (HTTP ${res.status})`);
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error("Unexpected Hugging Face response format");
  const flat = (Array.isArray(json[0]) ? (json as RawItem[][]).reduce<RawItem[]>((a, b) => a.concat(b), []) : json) as RawItem[];
  return flat.length > 0 && flat[0].entity_group === undefined && flat[0].entity !== undefined
    ? mergeTokenLevel(flat)
    : flat;
}

function toEntities(items: RawItem[], offset: number, fullText: string): Entity[] {
  const out: Entity[] = [];
  items.forEach((it) => {
    if (typeof it.start !== "number" || typeof it.end !== "number") return;
    const rawLabel = (it.entity_group ?? it.entity ?? "").replace(/^[BI]-/, "");
    const group = LABEL_MAP[rawLabel.toLowerCase()];
    if (!group) return;
    let start = it.start + offset;
    let end = it.end + offset;
    while (start < end && /\s/.test(fullText[start])) start++;
    while (end > start && /\s/.test(fullText[end - 1])) end--;
    if (end <= start) return;
    const score = typeof it.score === "number" ? Math.min(0.9999, Math.max(0, it.score)) : 0.9;
    out.push({
      start,
      end,
      word: fullText.slice(start, end),
      entity_group: group,
      score: Math.round(score * 1000) / 1000,
      raw_label: rawLabel,
      source: "model",
    });
  });
  return out;
}

async function runHuggingFace(text: string, token: string): Promise<Entity[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HF_TIMEOUT_MS);
  try {
    const chunks = chunkText(text);
    const results = await Promise.all(
      chunks.map(async (c) => ({ items: await callHF(c.text, token, controller.signal), offset: c.offset }))
    );
    let all: Entity[] = [];
    results.forEach((r) => {
      all = all.concat(toEntities(r.items, r.offset, text));
    });
    return mergeEntities(all, [], text.length);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new Error("Hugging Face request timed out");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------- handlers -------------------------------- */

function countBy(entities: Entity[]): Record<EntityGroup, number> {
  const counts: Record<EntityGroup, number> = { DISEASE: 0, CHEMICAL: 0, GENE: 0, ANATOMY: 0, PROCEDURE: 0 };
  entities.forEach((e) => {
    counts[e.entity_group] += 1;
  });
  return counts;
}

export async function GET() {
  return NextResponse.json({ ok: true, model: MODEL_ID, hf_configured: Boolean(process.env.HF_TOKEN) });
}

export async function POST(req: NextRequest) {
  const t0 = performance.now();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const text = typeof (body as { text?: unknown })?.text === "string" ? (body as { text: string }).text : "";
  if (text.trim().length === 0) {
    return NextResponse.json({ error: "Please provide some text to analyze." }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json({ error: `Text is too long (max ${MAX_CHARS} characters).` }, { status: 413 });
  }

  const token = process.env.HF_TOKEN;
  let entities: Entity[] = [];
  let engine: Engine = "fallback";
  let fallbackReason: string | null = null;

  if (!token) {
    fallbackReason = "HF_TOKEN is not set – using the built-in clinical span-matcher.";
  } else {
    try {
      const modelEntities = await runHuggingFace(text, token);
      // d4data/biomedical-ner-all has no gene/protein label, so the lexicon
      // contributes GENE spans (and only non-overlapping ones).
      entities = mergeEntities(modelEntities, lexiconEntities(text, ["GENE"]), text.length);
      engine = "huggingface+lexicon";
      if (entities.length === 0) throw new Error("Model returned no entities");
    } catch (err) {
      entities = [];
      engine = "fallback";
      fallbackReason = `${err instanceof Error ? err.message : "Hugging Face unavailable"} – switched to built-in span-matcher.`;
    }
  }

  if (engine === "fallback") {
    entities = lexiconEntities(text);
    entities = mergeEntities(entities, [], text.length);
  }

  const latency = Math.round((performance.now() - t0) * 10) / 10;
  const trimmed = text.trim();

  return NextResponse.json({
    entities,
    counts: countBy(entities),
    total: entities.length,
    latency_ms: latency,
    engine,
    model: MODEL_ID,
    fallback_reason: fallbackReason,
    char_count: text.length,
    word_count: trimmed ? trimmed.split(/\s+/).length : 0,
  });
}
