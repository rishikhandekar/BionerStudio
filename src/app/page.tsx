/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import * as React from "react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  MotionConfig,
  animate,
  frame,
  motion,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowUpDown,
  Brain,
  Check,
  CheckCircle2,
  Dna,
  Download,
  FileJson,
  FileSpreadsheet,
  Gauge,
  Layers,
  Loader2,
  Percent,
  Pill,
  RotateCcw,
  Scissors,
  Search,
  Sparkles,
  Stethoscope,
  Syringe,
  Tags,
  Target,
  Timer,
  TriangleAlert,
  Workflow,
  X,
  HeartPulse,
  Microscope,
  ChevronDown,
  Undo2,
  ArrowRight,
} from "lucide-react";

/* ========================================================================== */
/*  Types                                                                     */
/* ========================================================================== */

type Cat = "DISEASE" | "CHEMICAL" | "GENE" | "ANATOMY" | "PROCEDURE";

interface Entity {
  start: number;
  end: number;
  word: string;
  entity_group: Cat;
  score: number;
  raw_label: string;
  source: "model" | "lexicon";
}

interface AnalyzeResponse {
  entities: Entity[];
  counts: Record<Cat, number>;
  total: number;
  latency_ms: number;
  engine: "huggingface" | "huggingface+lexicon" | "fallback";
  model: string;
  fallback_reason: string | null;
  char_count: number;
  word_count: number;
}

interface ServerInfo {
  ok: boolean;
  model: string;
  hf_configured: boolean;
}

interface TipState {
  ent: Entity;
  x: number;
  top: number;
  bottom: number;
}

type SortKey = "start" | "word" | "entity_group" | "score";

/* ========================================================================== */
/*  Utilities + self-contained UI primitives                                  */
/*  (replaces @/lib/utils and @/components/unlumen-ui/primitives/*)           */
/* ========================================================================== */

const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/* ---------------------------- SpotlightBackground ---------------------------- */

function SpotlightBackground() {
  const x = useMotionValue(-600);
  const y = useMotionValue(-600);
  const sx = useSpring(x, { stiffness: 160, damping: 22, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 160, damping: 22, mass: 0.5 });
  const [isMoving, setIsMoving] = useState(false);
  const moveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setIsMoving(true);
      if (moveTimeout.current) clearTimeout(moveTimeout.current);
      moveTimeout.current = setTimeout(() => setIsMoving(false), 150);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (moveTimeout.current) clearTimeout(moveTimeout.current);
    };
  }, [x, y]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 h-full w-full overflow-hidden">
      <motion.div
        className="absolute left-0 top-0 rounded-full"
        style={{
          x: sx,
          y: sy,
          width: 280,
          height: 280,
          marginLeft: -140,
          marginTop: -140,
          background: "radial-gradient(circle, rgba(56,189,248,0.5) 0%, rgba(5,150,105,0.12) 45%, transparent 70%)",
        }}
        animate={{ scale: isMoving ? 0.79 : 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </div>
  );
}

/* ------------------------------------ Tilt ----------------------------------- */

interface TiltProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  /** max rotation in degrees */
  rotationFactor?: number;
  /** show a soft light reflection that follows the pointer */
  glare?: boolean;
}

function Tilt({ children, className, rotationFactor = 12, glare = true, style, ...props }: TiltProps) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0); // -0.5 .. 0.5
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [rotationFactor, -rotationFactor]), { stiffness: 220, damping: 22 });
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-rotationFactor, rotationFactor]), { stiffness: 220, damping: 22 });
  const gx = useTransform(px, [-0.5, 0.5], [0, 100]);
  const gy = useTransform(py, [-0.5, 0.5], [0, 100]);
  const glareBg = useMotionTemplate`radial-gradient(240px circle at ${gx}% ${gy}%, rgba(255,255,255,0.65), transparent 65%)`;
  const glareOpacity = useMotionValue(0);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
    glareOpacity.set(1);
  };
  const onLeave = () => {
    px.set(0);
    py.set(0);
    glareOpacity.set(0);
  };

  return (
    <div className="h-full w-full" style={{ perspective: 1000 }}>
      <motion.div
        {...(props as React.ComponentProps<typeof motion.div>)}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ ...style, rotateX: reduce ? 0 : rotateX, rotateY: reduce ? 0 : rotateY, transformStyle: "preserve-3d" }}
        className={cn("h-full", className)}
      >
        {children}
        {glare && !reduce && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] mix-blend-soft-light transition-opacity duration-200"
            style={{ background: glareBg, opacity: glareOpacity }}
          />
        )}
      </motion.div>
    </div>
  );
}

/* ---------------------------------- ClippedCircle ---------------------------------- */

interface ClippedCircleProps {
  className?: string;
  /** background of the disc (pure black by default) */
  circleClassName?: string;
  /** disc diameter as a multiple of the card's width (1.75 = 175%) */
  sizeRatio?: number;
  /** content drawn ONLY inside the disc, laid out exactly like the card's own content */
  children?: React.ReactNode;
}

/**
 * Cursor-following disc. It is a single layer clipped with CSS `clip-path: circle(...)`: the layer has a
 * black background and holds a white copy of the card content, so only what lies inside the circle turns
 * white-on-black while everything outside keeps its original colours (letters on the edge split in two).
 * Position and radius are motion values, so mousemove never triggers a React re-render.
 */
function ClippedCircle({ className, circleClassName = "bg-black", sizeRatio = 1.75, children }: ClippedCircleProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const cx = useMotionValue(0);
  const cy = useMotionValue(0);
  const r = useMotionValue(0);
  const clipPath = useMotionTemplate`circle(${r}px at ${cx}px ${cy}px)`;

  React.useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    let controls: ReturnType<typeof animate> | null = null;

    const track = (e: MouseEvent) => {
      const rect = parent.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      // convert to layout px so the 3D tilt (which enlarges the bounding box) cannot offset the circle
      cx.set(((e.clientX - rect.left) / rect.width) * parent.offsetWidth);
      cy.set(((e.clientY - rect.top) / rect.height) * parent.offsetHeight);
    };
    const to = (target: number) => {
      controls?.stop();
      controls = animate(r, target, { duration: reduce ? 0.01 : 0.5, ease: [0.19, 1, 0.22, 1] });
    };
    const onEnter = (e: MouseEvent) => {
      track(e);
      to((parent.offsetWidth * sizeRatio) / 2);
    };
    const onLeave = () => to(0);

    parent.addEventListener("mouseenter", onEnter);
    parent.addEventListener("mousemove", track);
    parent.addEventListener("mouseleave", onLeave);
    return () => {
      controls?.stop();
      parent.removeEventListener("mouseenter", onEnter);
      parent.removeEventListener("mousemove", track);
      parent.removeEventListener("mouseleave", onLeave);
    };
  }, [cx, cy, r, sizeRatio, reduce]);

  return (
    <motion.div
      ref={ref}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{ clipPath, WebkitClipPath: clipPath }}
    >
      <div className={cn("absolute inset-0 flex flex-col", circleClassName)}>{children}</div>
    </motion.div>
  );
}

/* ---------------------------------- TiltCard ---------------------------------- */

interface TiltCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** left half of the split badge pill; shown as a simple pill if `badgeLabel` is omitted */
  price?: string;
  /** right half of the split pill, coloured by `badgeVariant` */
  badgeLabel?: string;
  badgeVariant?: "success" | "warning";
  children?: React.ReactNode;
  tiltProps?: Omit<TiltProps, "children" | "className">;
}

const BADGE_LABEL_CLASSES: Record<NonNullable<TiltCardProps["badgeVariant"]>, string> = {
  success: "bg-emerald-500/15 text-emerald-800",
  warning: "bg-amber-500/20 text-amber-900",
};

function TiltCard({
  title,
  description,
  icon: Icon,
  price,
  badgeLabel,
  badgeVariant = "success",
  children,
  tiltProps,
  className,
  ...props
}: TiltCardProps) {
  // The same markup is rendered twice: once in the card's own colours, once all-white inside the clipped disc.
  const renderContent = (overlay: boolean) => (
    <div className={overlay ? "flex flex-1 flex-col gap-2 p-4 text-white [&_*]:text-white!" : "relative flex flex-1 flex-col gap-2 p-4"}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {Icon && <Icon className={cn("h-4 w-4 shrink-0", !overlay && "text-sky-700")} aria-hidden />}
          <h3 className={cn("truncate text-xs font-bold uppercase tracking-wider", !overlay && "text-slate-600")}>{title}</h3>
        </div>
        {price && badgeLabel ? (
          <div className="inline-flex h-fit shrink-0 items-center whitespace-nowrap text-xs">
            <span className={cn("rounded-l-full px-2 py-0.5 font-semibold", overlay ? "bg-white/15" : "bg-sky-100 text-sky-900")}>{price}</span>
            <span className={cn("rounded-r-full px-2 py-0.5 font-semibold", overlay ? "bg-white/25" : BADGE_LABEL_CLASSES[badgeVariant])}>{badgeLabel}</span>
          </div>
        ) : price ? (
          <span className={cn("h-fit shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", overlay ? "bg-white/15" : "bg-sky-100 text-sky-900")}>{price}</span>
        ) : null}
      </div>
      {children && <div className="mt-1">{children}</div>}
      {description && <p className={cn("mt-auto text-xs", !overlay && "text-slate-600")}>{description}</p>}
    </div>
  );

  return (
    <div {...props} className="group h-full">
      <Tilt
        rotationFactor={13}
        glare={false}
        {...tiltProps}
        className={cn(
          "glass relative overflow-hidden rounded-2xl",
          "flex h-full flex-col transition-[box-shadow,scale] duration-300 ease-out",
          "hover:scale-[1.02] hover:shadow-xl hover:shadow-sky-900/10",
          className
        )}
      >
        {renderContent(false)}
        {/* Drawn after the content: black disc + white copy of the content, clipped to the circle at the cursor. */}
        <ClippedCircle circleClassName="bg-black" sizeRatio={1.35}>
          {renderContent(true)}
        </ClippedCircle>
      </Tilt>
    </div>
  );
}

/* ========================================================================== */
/*  Design tokens: entity categories                                          */
/* ========================================================================== */

const CAT_ORDER: Cat[] = ["DISEASE", "CHEMICAL", "GENE", "ANATOMY", "PROCEDURE"];

const CATS: Record<
  Cat,
  { label: string; icon: LucideIcon; pill: string; badge: string; bar: string; dot: string; toggleOn: string }
> = {
  DISEASE: {
    label: "Disease / Disorder",
    icon: Stethoscope,
    pill: "bg-rose-100 text-rose-900 ring-rose-400/70",
    badge: "bg-rose-100 text-rose-900 ring-rose-300",
    bar: "bg-rose-500",
    dot: "bg-rose-600",
    toggleOn: "bg-rose-100 text-rose-900 ring-rose-500",
  },
  CHEMICAL: {
    label: "Drug / Chemical",
    icon: Pill,
    pill: "bg-emerald-100 text-emerald-900 ring-emerald-400/70",
    badge: "bg-emerald-100 text-emerald-900 ring-emerald-300",
    bar: "bg-emerald-500",
    dot: "bg-emerald-600",
    toggleOn: "bg-emerald-100 text-emerald-900 ring-emerald-500",
  },
  GENE: {
    label: "Gene / Protein",
    icon: Dna,
    pill: "bg-indigo-100 text-indigo-900 ring-indigo-400/70",
    badge: "bg-indigo-100 text-indigo-900 ring-indigo-300",
    bar: "bg-indigo-500",
    dot: "bg-indigo-600",
    toggleOn: "bg-indigo-100 text-indigo-900 ring-indigo-500",
  },
  ANATOMY: {
    label: "Anatomy / Body Part",
    icon: Brain,
    pill: "bg-violet-100 text-violet-900 ring-violet-400/70",
    badge: "bg-violet-100 text-violet-900 ring-violet-300",
    bar: "bg-violet-500",
    dot: "bg-violet-600",
    toggleOn: "bg-violet-100 text-violet-900 ring-violet-500",
  },
  PROCEDURE: {
    label: "Procedure / Dosage",
    icon: Syringe,
    pill: "bg-amber-100 text-amber-900 ring-amber-400/70",
    badge: "bg-amber-100 text-amber-900 ring-amber-300",
    bar: "bg-amber-500",
    dot: "bg-amber-600",
    toggleOn: "bg-amber-100 text-amber-900 ring-amber-500",
  },
};

/* ========================================================================== */
/*  Category toggle: glowing blob card                                        */
/* ========================================================================== */

/** Per-category colours for the blob card. Full class strings so Tailwind can see them. */
const CAT_BLOB: Record<Cat, { blob: string; rim: string; frost: string; text: string; glow: string }> = {
  DISEASE: { blob: "bg-rose-500", rim: "bg-rose-200", frost: "bg-rose-50/90", text: "text-rose-900", glow: "shadow-rose-500/30" },
  CHEMICAL: { blob: "bg-emerald-500", rim: "bg-emerald-200", frost: "bg-emerald-50/90", text: "text-emerald-900", glow: "shadow-emerald-500/30" },
  GENE: { blob: "bg-indigo-500", rim: "bg-indigo-200", frost: "bg-indigo-50/90", text: "text-indigo-900", glow: "shadow-indigo-500/30" },
  ANATOMY: { blob: "bg-violet-500", rim: "bg-violet-200", frost: "bg-violet-50/90", text: "text-violet-900", glow: "shadow-violet-500/30" },
  PROCEDURE: { blob: "bg-amber-500", rim: "bg-amber-200", frost: "bg-amber-50/90", text: "text-amber-900", glow: "shadow-amber-500/30" },
};

/** Same path as the original `blob-bounce`: the blob starts at the centre's top-left and orbits a square of its own size. */
const BLOB_KEYFRAMES = `@keyframes bioner-blob-bounce {
  0%   { transform: translate(-100%, -100%) translate3d(0, 0, 0); }
  25%  { transform: translate(-100%, -100%) translate3d(100%, 0, 0); }
  50%  { transform: translate(-100%, -100%) translate3d(100%, 100%, 0); }
  75%  { transform: translate(-100%, -100%) translate3d(0, 100%, 0); }
  100% { transform: translate(-100%, -100%) translate3d(0, 0, 0); }
}`;

/** Render once on the page. Static, trusted CSS, so there is nothing to escape. */
function BlobKeyframes() {
  return <style dangerouslySetInnerHTML={{ __html: BLOB_KEYFRAMES }} />;
}

interface CategoryBlobToggleProps {
  cat: Cat;
  on: boolean;
  count: number;
  /** position in the row; offsets each blob's animation so the five buttons never pulse in sync */
  index: number;
  onToggle: () => void;
}

/**
 * Filter button with a frosted inner panel over a blurred, bouncing blob.
 *   z-1  blob   (category colour, blur, orbiting)
 *   z-2  frost  (tinted glass, inset 3px so the blob glows through the rim)
 *   z-3  content
 * ON  = coloured blob, always moving.   OFF = grey blob, paused until hovered.
 * Reduced motion: the blob stays parked in the centre.
 */
function CategoryBlobToggle({ cat, on, count, index, onToggle }: CategoryBlobToggleProps) {
  const Icon = CATS[cat].icon;
  const b = CAT_BLOB[cat];
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={cn(
        "group relative isolate min-h-[44px] cursor-pointer overflow-hidden rounded-xl text-sm font-semibold shadow-md",
        "transition-[box-shadow,transform] duration-300 hover:shadow-lg active:scale-[0.98]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700",
        on ? cn(b.rim, b.glow) : "bg-slate-200 shadow-slate-900/10"
      )}
    >
      <span
        aria-hidden
        style={{ animationDelay: `${-index * 0.9}s` }}
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 z-[1] aspect-square w-[60%] rounded-full blur-md will-change-transform",
          "[transform:translate(-50%,-50%)] animate-[bioner-blob-bounce_5s_ease_infinite] motion-reduce:animate-none",
          on ? b.blob : "bg-slate-400 opacity-50 [animation-play-state:paused] group-hover:[animation-play-state:running]"
        )}
      />
      <span
        aria-hidden
        className={cn("pointer-events-none absolute inset-[3px] z-[2] rounded-[9px] ring-1 ring-white/90 backdrop-blur-xl", on ? b.frost : "bg-white/85")}
      />
      <span className={cn("relative z-[3] flex min-h-[44px] items-center gap-2 px-3.5", on ? b.text : "text-slate-600")}>
        <Icon className="h-4 w-4" aria-hidden />
        <span className={cn(!on && "line-through decoration-slate-400")}>{CATS[cat].label}</span>
        <span className="rounded-md bg-white/80 px-1.5 py-0.5 font-mono text-xs text-slate-800">{count}</span>
      </span>
    </button>
  );
}

/* ========================================================================== */
/*  Sample abstracts                                                          */
/* ========================================================================== */

const SAMPLES: { id: string; label: string; field: string; icon: LucideIcon; text: string }[] = [
  {
    id: "oncology",
    label: "Oncology",
    field: "NSCLC · EGFR · Osimertinib",
    icon: Microscope,
    text: `Osimertinib versus standard EGFR-TKI in previously untreated EGFR-mutated advanced non-small cell lung cancer

BACKGROUND: Patients with advanced non-small cell lung cancer (NSCLC) harboring an EGFR exon 19 deletion or L858R mutation respond to first-generation tyrosine kinase inhibitors, but acquired resistance mediated by the T790M mutation limits durability.

METHODS: In this randomized, double-blind phase 3 trial, 556 patients with previously untreated EGFR-mutated advanced lung adenocarcinoma received osimertinib 80 mg once daily or a standard EGFR-TKI (gefitinib 250 mg once daily or erlotinib 150 mg once daily). Tumor response was assessed by computed tomography and brain MRI every 6 weeks.

RESULTS: Median progression-free survival was 18.9 months with osimertinib versus 10.2 months with standard EGFR-TKI (hazard ratio 0.46). Responses were also observed in patients with central nervous system metastases. Grade 3 or higher adverse events, including diarrhea, rash, and interstitial lung disease, were less frequent with osimertinib.

CONCLUSIONS: Osimertinib is an effective first-line therapy. Plasma ctDNA genotyping can detect resistance mutations and guide subsequent chemotherapy with cisplatin and pemetrexed.`,
  },
  {
    id: "cardiology",
    label: "Cardiology",
    field: "AF · Apixaban · Warfarin",
    icon: HeartPulse,
    text: `Apixaban versus warfarin in patients with atrial fibrillation: stroke, systemic embolism, and bleeding outcomes

BACKGROUND: Atrial fibrillation (AF) increases the risk of ischemic stroke and systemic embolism. Warfarin, a vitamin K antagonist, requires frequent INR monitoring and carries a risk of intracranial hemorrhage.

METHODS: We randomly assigned 18,201 patients with atrial fibrillation and at least one additional risk factor, such as hypertension, diabetes mellitus, or prior stroke, to apixaban 5 mg twice daily or dose-adjusted warfarin. The apixaban dose was reduced to 2.5 mg twice daily in patients with impaired renal function, age 80 years or older, or low body weight.

RESULTS: Apixaban reduced the rate of stroke or systemic embolism (hazard ratio 0.79), caused less major bleeding, and lowered mortality. The rate of hemorrhagic stroke was about half that with warfarin. Patients with heart failure or chronic kidney disease derived consistent benefit. CYP2C9 and VKORC1 genotypes influenced warfarin dose requirements.

CONCLUSIONS: In atrial fibrillation, apixaban was superior to warfarin in preventing stroke and systemic embolism, with fewer episodes of bleeding in the gastrointestinal tract and brain.`,
  },
  {
    id: "neurology",
    label: "Neurology",
    field: "Alzheimer's · Aβ · Lecanemab",
    icon: Brain,
    text: `Lecanemab in early Alzheimer's disease: amyloid-beta clearance and plasma biomarker outcomes

BACKGROUND: Accumulation of amyloid-beta plaques and hyperphosphorylated tau in the brain drives neurodegeneration in Alzheimer's disease. Lecanemab is a humanized monoclonal antibody that binds soluble amyloid-beta protofibrils.

METHODS: In an 18-month, multicenter, double-blind trial, 1,795 participants with mild cognitive impairment or mild dementia due to Alzheimer's disease and confirmed amyloid pathology on amyloid PET or cerebrospinal fluid analysis received intravenous lecanemab 10 mg/kg every 2 weeks or placebo. The primary endpoint was change in the Clinical Dementia Rating–Sum of Boxes (CDR-SB). Biomarkers included plasma p-tau181, neurofilament light, and APOE ε4 carrier status.

RESULTS: Lecanemab reduced amyloid burden on PET and slowed cognitive decline by 27% compared with placebo. Amyloid-related imaging abnormalities with edema (ARIA-E) occurred in 12.6% of participants, most often in the temporal lobe and frontal cortex of APOE ε4 homozygotes.

CONCLUSIONS: Lecanemab lowered amyloid-beta levels and modestly slowed decline; MRI monitoring is advised during treatment.`,
  },
];

const EXAMPLE_PMIDS: { pmid: string; label: string }[] = [
  { pmid: "29151359", label: "FLAURA (NEJM)" },
  { pmid: "21870978", label: "ARISTOTLE (NEJM)" },
  { pmid: "36449413", label: "Clarity AD (NEJM)" },
];

const MAX_CHARS = 6000;

/** Export JSON: same folding / zipper button and 164px size as Export CSV, in its white + sky look. */
const JSON_ZIP_THEME: Record<string, string> = {
  "--button-width": "164px",
  "--background": "#ffffff",
  "--background-transparent": "rgba(255,255,255,0)",
  "--background-hover": "#f0f9ff",
  "--background-back": "#e0f2fe",
  "--shadow": "rgba(3,105,161,.14)",
  "--text": "#0c4a6e",
  "--paper": "#ffffff",
  "--paper-lines": "#bae6fd",
  "--paper-shadow": "rgba(3,105,161,.18)",
  "--zipper": "#7dd3fc",
  "--zipper-end": "#bae6fd",
  "--zipper-line": "#38bdf8",
  "--zipper-lines": "#7dd3fc",
  "--tick": "#0369a1",
  "--ring": "#7dd3fc",
};

/** Export CSV keeps its solid sky-700 look (white text, hover sky-800) on the folding / zipper animation. */
const CSV_ZIP_THEME: Record<string, string> = {
  "--button-width": "164px",
  "--background": "#0369a1",
  "--background-transparent": "rgba(3,105,161,0)",
  "--background-hover": "#075985",
  "--background-back": "#0c4a6e",
  "--shadow": "rgba(3,105,161,.3)",
  "--text": "#ffffff",
  "--paper": "#ffffff",
  "--paper-lines": "#bae6fd",
  "--paper-shadow": "rgba(3,105,161,.25)",
  "--zipper": "#bae6fd",
  "--zipper-end": "#e0f2fe",
  "--zipper-line": "#7dd3fc",
  "--zipper-lines": "#38bdf8",
  "--tick": "#ffffff",
  "--ring": "transparent",
};

/* ========================================================================== */
/*  Helpers                                                                   */
/* ========================================================================== */

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvCell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
}

function buildSegments(text: string, ents: Entity[]) {
  const sorted = ents.slice().sort((a, b) => a.start - b.start || b.end - a.end);
  const segs: { text: string; ent?: Entity }[] = [];
  let cur = 0;
  sorted.forEach((e) => {
    if (e.start < cur || e.end > text.length || e.end <= e.start) return;
    if (e.start > cur) segs.push({ text: text.slice(cur, e.start) });
    segs.push({ text: text.slice(e.start, e.end), ent: e });
    cur = e.end;
  });
  if (cur < text.length) segs.push({ text: text.slice(cur) });
  return segs;
}

function wordCount(t: string) {
  const s = t.trim();
  return s ? s.split(/\s+/).length : 0;
}

/* ========================================================================== */
/*  Small UI pieces                                                           */
/* ========================================================================== */

function AnimatedNumber({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);
  return (
    <span>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ------------------------------ AnimatedField ------------------------------ */
/*  Typing input (spring entrance for newly typed characters + spring-animated cursor / selection).
    The real <input>/<textarea> stays on top and fully editable (selection, caret movement,
    paste, IME, undo); its text is made transparent and a mirrored layer underneath renders
    the same text with per-character animation and the caret.                              */

type FieldEl = HTMLInputElement | HTMLTextAreaElement;

interface AnimatedFieldProps {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<FieldEl>) => void;
  onKeyDown?: (e: React.KeyboardEvent<FieldEl>) => void;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLElement>["inputMode"];
  "aria-label"?: string;
  /** caret colour */
  color?: string;
  caretWidth?: number;
  /** caret blink period in ms */
  blinkSpeed?: number;
  /** outer box: border, background, radius, min-height */
  className?: string;
  /** typography + padding shared by the real field and the mirror (must not set text colour) */
  fieldClassName?: string;
}

const MAX_ANIMATED_INSERT = 8; // longer insertions (paste, sample load) appear instantly
const RUN_MS = 350; // how long a freshly typed run stays wrapped in a motion.span
const WJ = "\u2060"; // word joiner: stops the zero-width anchors from creating line-break opportunities
const CURSOR_SPRING = { stiffness: 700, damping: 30, mass: 0.2 };
const MAX_GHOST_CHARS = 60; // deleted text up to this length (single line) fades out instead of vanishing

/** A deleted run of text, kept just long enough to play its exit animation (absolutely positioned, out of flow). */
interface Ghost {
  key: number;
  text: string;
  x: number;
  y: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/*  Performance model: the mirror is plain text cut at only a handful of points (typed run, caret / selection
    anchors), never one element per character. Geometry comes from at most two zero-width anchors plus a
    single Range.getClientRects() call for selections, and only when the value / selection / size changes. */
function AnimatedField({
  id,
  value,
  onChange,
  onKeyDown,
  multiline = false,
  rows,
  maxLength,
  placeholder,
  inputMode,
  "aria-label": ariaLabel,
  color = "hsl(220, 100%, 60%)",
  caretWidth = 2,
  blinkSpeed = 530,
  className,
  fieldClassName,
}: AnimatedFieldProps) {
  const reduce = useReducedMotion();
  const fieldRef = useRef<FieldEl | null>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLSpanElement>(null);
  const endRef = useRef<HTMLSpanElement>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);
  const placed = useRef(false);
  const [focused, setFocused] = useState(false);
  const [sel, setSel] = useState({ s: 0, e: 0 });
  const [anim, setAnim] = useState<{ start: number; end: number; key: number } | null>(null);
  const [extra, setExtra] = useState<Box[]>([]);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);

  // one persistent cursor / selection indicator: targets are set on measure, the springs glide to them
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const tw = useMotionValue(caretWidth);
  const th = useMotionValue(18);
  const cx = useSpring(tx, CURSOR_SPRING);
  const cy = useSpring(ty, CURSOR_SPRING);
  const cw = useSpring(tw, CURSOR_SPRING);
  const ch = useSpring(th, CURSOR_SPRING);

  const syncView = useCallback(() => {
    const el = fieldRef.current;
    if (!el) return;
    setSel((prev) => {
      const s = el.selectionStart ?? 0;
      const e = el.selectionEnd ?? 0;
      return prev.s === s && prev.e === e ? prev : { s, e };
    });
    if (multiline) {
      if (mirrorRef.current) mirrorRef.current.scrollTop = el.scrollTop;
    } else if (innerRef.current) {
      innerRef.current.style.transform = `translateX(${-el.scrollLeft}px)`;
    }
  }, [multiline]);

  const schedule = useCallback(() => {
    requestAnimationFrame(syncView);
  }, [syncView]);

  useEffect(() => {
    schedule(); // value changed programmatically (sample load, clear): re-measure
  }, [value, schedule]);

  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    []
  );

  // Locates old text [from, to) in the CURRENT mirror DOM (before React commits the deletion) via the few
  // plain-text chunks (never per character) and returns where it sits, so it can fade out in place.
  const captureGhost = (from: number, to: number): Ghost | null => {
    const inner = innerRef.current;
    if (!inner) return null;
    const chunks = inner.querySelectorAll<HTMLElement>("[data-t]");
    let off = 0;
    let startNode: Text | null = null;
    let startOff = 0;
    let endNode: Text | null = null;
    let endOff = 0;
    for (let i = 0; i < chunks.length; i++) {
      const node = chunks[i].firstChild;
      const n = chunks[i].textContent?.length ?? 0;
      if (node && node.nodeType === 3) {
        if (!startNode && from >= off && from < off + n) {
          startNode = node as Text;
          startOff = from - off;
        }
        if (to > off && to <= off + n) {
          endNode = node as Text;
          endOff = to - off;
        }
      }
      off += n;
    }
    if (!startNode || !endNode) return null;
    const range = document.createRange();
    range.setStart(startNode, startOff);
    range.setEnd(endNode, endOff);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0.5 && r.height > 1);
    if (!rects.length) return null;
    const top = rects[0].top;
    if (rects.some((r) => Math.abs(r.top - top) > 2)) return null; // multi-line cut: just remove it
    const base = inner.getBoundingClientRect();
    const lhRaw = parseFloat(getComputedStyle(inner).lineHeight);
    const lh = Number.isFinite(lhRaw) ? lhRaw : rects[0].height;
    counter.current += 1;
    return {
      key: counter.current,
      text: value.slice(from, to),
      x: rects[0].left - base.left,
      y: rects[0].top - base.top - (lh - rects[0].height) / 2,
    };
  };

  const handleChange = (e: React.ChangeEvent<FieldEl>) => {
    const next = e.target.value;
    // Diff old/new by common prefix + suffix to find the typed characters.
    let p = 0;
    const max = Math.min(value.length, next.length);
    while (p < max && value[p] === next[p]) p++;
    let q = 0;
    while (q < max - p && value[value.length - 1 - q] === next[next.length - 1 - q]) q++;
    const inserted = next.length - q - p;
    const removed = value.length - q - p;
    if (!reduce && removed > 0 && removed <= MAX_GHOST_CHARS) {
      const g = captureGhost(p, p + removed);
      if (g) setGhosts((prev) => [...prev, g]);
    }
    if (!reduce && inserted > 0 && inserted <= MAX_ANIMATED_INSERT && !next.slice(p, p + inserted).includes("\n")) {
      counter.current += 1;
      setAnim({ start: p, end: p + inserted, key: counter.current });
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setAnim(null), RUN_MS);
    } else {
      setAnim(null);
    }
    // take the caret from the event so the cursor and the new character move in the same frame
    setSel({ s: e.target.selectionStart ?? 0, e: e.target.selectionEnd ?? 0 });
    onChange(e);
    schedule();
  };

  // Same-frame caret sync for input events (typing, backspace, cut, paste) so the cursor never trails the text.
  const syncSelNow = (el: FieldEl) => {
    const ns = el.selectionStart ?? 0;
    const ne = el.selectionEnd ?? 0;
    setSel((prev) => (prev.s === ns && prev.e === ne ? prev : { s: ns, e: ne }));
  };

  const len = value.length;
  const s = Math.min(sel.s, len);
  const e = Math.min(sel.e, len);
  const hasSel = focused && e > s;
  const showCaret = focused && !hasSel;
  const rs = anim ? Math.min(anim.start, len) : -1;
  const re = anim ? Math.min(anim.end, len) : -1;

  // ---- measure (no per-character DOM work): runs only when value / selection / focus / typed-run changes ----
  const measureRef = useRef<() => void>(() => {});
  measureRef.current = () => {
    const inner = innerRef.current;
    const a = startRef.current;
    if (!inner || !a || !focused) return;
    const go = (target: { set: (v: number) => void }, spring: { jump: (v: number) => void }, v: number) => {
      target.set(v);
      if (!placed.current || reduce) spring.jump(v);
    };
    let first: Box | null = null;
    let rest: Box[] = [];
    if (e > s && endRef.current) {
      const b = endRef.current;
      const base = inner.getBoundingClientRect();
      const range = document.createRange();
      range.setStartAfter(a);
      range.setEndBefore(b);
      const lines = new Map<number, { l: number; r: number; t: number; h: number }>();
      for (const r of Array.from(range.getClientRects())) {
        if (r.width < 0.5 || r.height < 1) continue;
        const key = Math.round(r.top - base.top);
        const cur = lines.get(key);
        if (cur) {
          cur.l = Math.min(cur.l, r.left - base.left);
          cur.r = Math.max(cur.r, r.right - base.left);
        } else {
          lines.set(key, { l: r.left - base.left, r: r.right - base.left, t: r.top - base.top, h: r.height });
        }
      }
      let boxes = [...lines.values()].sort((m, n) => m.t - n.t).map((ln) => ({ x: ln.l, y: ln.t, w: ln.r - ln.l, h: ln.h }));
      if (!boxes.length) boxes = [{ x: a.offsetLeft, y: a.offsetTop, w: Math.max(b.offsetLeft - a.offsetLeft, 3), h: a.offsetHeight }];
      [first, ...rest] = boxes;
    } else {
      first = { x: a.offsetLeft + 1, y: a.offsetTop, w: caretWidth, h: a.offsetHeight };
    }
    if (!first) return;
    go(tx, cx, first.x);
    go(ty, cy, first.y);
    go(tw, cw, first.w);
    go(th, ch, first.h);
    placed.current = true;
    setExtra((prev) => (prev.length === 0 && rest.length === 0 ? prev : rest));
  };

  // layout effect: the cursor targets are updated in the same commit as the text, before the browser paints
  useLayoutEffect(() => {
    measureRef.current();
  }, [value, sel.s, sel.e, focused, anim]);

  useEffect(() => {
    const el = mirrorRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measureRef.current());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- mirror: plain text chunks + [typed run] + invisible anchors ----
  const anchor = (key: string, ref: React.RefObject<HTMLSpanElement | null>) => (
    <React.Fragment key={key}>
      {WJ}
      <span ref={ref} className="inline-block w-0 align-[-0.28em]" style={{ height: "1.2em" }} />
      {WJ}
    </React.Fragment>
  );

  const cuts = Array.from(new Set([0, len, rs, re, focused ? s : -1, hasSel ? e : -1].filter((n) => n >= 0 && n <= len))).sort((x, y) => x - y);
  const nodes: React.ReactNode[] = [];
  cuts.forEach((pos, i) => {
    if (focused && pos === s) nodes.push(anchor("a-start", startRef));
    if (hasSel && pos === e) nodes.push(anchor("a-end", endRef));
    const next = cuts[i + 1];
    if (next === undefined) return;
    const seg = value.slice(pos, next);
    if (anim && pos >= rs && next <= re && re > rs) {
      nodes.push(
        <motion.span
          key={`run-${anim.key}`}
          data-t=""
          className="inline-block whitespace-pre"
          initial={{ opacity: 0, scale: 0.5, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 28, mass: 0.4 }}
        >
          {seg}
        </motion.span>
      );
    } else {
      nodes.push(
        <span key={`t-${pos}`} data-t="">
          {seg}
        </span>
      );
    }
  });

  const shared = {
    id,
    value,
    maxLength,
    placeholder,
    "aria-label": ariaLabel,
    onChange: handleChange,
    onKeyDown: (ev: React.KeyboardEvent<FieldEl>) => {
      onKeyDown?.(ev);
      schedule();
    },
    onSelect: schedule,
    onKeyUp: schedule,
    onClick: schedule,
    onInput: (ev: React.FormEvent<FieldEl>) => {
      syncSelNow(ev.currentTarget);
      schedule();
    },
    onScroll: schedule,
    onFocus: () => {
      setFocused(true);
      schedule();
    },
    onBlur: () => setFocused(false),
    spellCheck: false,
    className: cn(
      "relative z-10 block w-full border-0 bg-transparent text-transparent caret-transparent outline-none",
      "placeholder:text-slate-500 selection:bg-transparent selection:text-transparent",
      multiline ? "resize-y" : "h-[42px] leading-[42px]",
      fieldClassName
    ),
  };

  return (
    <div className={cn("relative", className)}>
      <div
        ref={mirrorRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 text-slate-900",
          multiline ? "overflow-y-auto [scrollbar-color:transparent_transparent]" : "overflow-hidden",
          fieldClassName,
          !multiline && "leading-[42px]"
        )}
      >
        <div ref={innerRef} className={cn("relative", multiline ? "whitespace-pre-wrap break-words" : "whitespace-pre")}>
          {nodes}
          {"\u200b"}

          {/* text-out: deleted characters fade/scale/rise away in place, mirroring the entrance animation */}
          {ghosts.map((g) => (
            <motion.span
              key={g.key}
              aria-hidden
              className="pointer-events-none absolute inline-block whitespace-pre"
              style={{ left: g.x, top: g.y }}
              initial={{ opacity: 1, scale: 1, y: 0 }}
              animate={{ opacity: 0, scale: 0.5, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onAnimationComplete={() => setGhosts((prev) => prev.filter((x) => x.key !== g.key))}
            >
              {g.text}
            </motion.span>
          ))}

          {/* continuation lines of a multi-line selection */}
          {hasSel &&
            extra.map((b, n) => (
              <div key={n} className="pointer-events-none absolute left-0 top-0 rounded-[3px]" style={{ background: color, opacity: 0.2, transform: `translate(${b.x}px, ${b.y}px)`, width: b.w, height: b.h }} />
            ))}

          {/* the single persistent cursor: glides between positions, morphs into the (first) selection rectangle */}
          <motion.div
            className="pointer-events-none absolute left-0 top-0"
            style={{ x: cx, y: cy, width: cw, height: ch }}
            animate={{ opacity: focused ? 1 : 0 }}
            transition={{ duration: 0.12 }}
          >
            {hasSel ? (
              <motion.div key="selection" className="h-full w-full rounded-[3px]" style={{ background: color }} initial={{ opacity: 0.45 }} animate={{ opacity: 0.2 }} transition={{ duration: 0.15 }} />
            ) : (
              showCaret && (
                <motion.div
                  key={`caret-${s}-${len}`}
                  className="h-full w-full rounded-full"
                  style={{ background: color }}
                  animate={reduce ? { opacity: 1 } : { opacity: [1, 1, 0, 0] }}
                  transition={reduce ? undefined : { duration: (blinkSpeed * 2) / 1000, times: [0, 0.5, 0.5, 1], repeat: Infinity, ease: "linear" }}
                />
              )
            )}
          </motion.div>
        </div>
      </div>
      {multiline ? (
        <textarea {...shared} rows={rows} ref={(el) => void (fieldRef.current = el)} />
      ) : (
        <input {...shared} inputMode={inputMode} type="text" ref={(el) => void (fieldRef.current = el)} />
      )}
    </div>
  );
}

function EntityTooltip({ tip }: { tip: TipState | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const W = 264;
  const left = tip ? Math.max(8, Math.min(window.innerWidth - W - 8, tip.x - W / 2)) : 0;
  const above = tip ? tip.top > 200 : true;
  const top = tip ? (above ? tip.top - 10 : tip.bottom + 10) : 0;

  return createPortal(
    <AnimatePresence>
      {tip && (
        <div
          style={{ position: "fixed", left, top, width: W, transform: above ? "translateY(-100%)" : undefined, zIndex: 60, pointerEvents: "none" }}
        >
          <motion.div
            role="tooltip"
            initial={{ opacity: 0, y: above ? 6 : -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16 }}
            className="rounded-xl border border-white/70 bg-white/95 p-3 text-sm shadow-xl shadow-sky-900/15 backdrop-blur"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold text-slate-900">{tip.ent.word}</span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset", CATS[tip.ent.entity_group].badge)}>
                {tip.ent.entity_group}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-slate-600">
              <dt>Span</dt>
              <dd className="font-mono font-semibold text-slate-900">
                [{tip.ent.start}:{tip.ent.end}]
              </dd>
              <dt>Type</dt>
              <dd className="font-semibold text-slate-900">{CATS[tip.ent.entity_group].label}</dd>
              <dt>Raw tag</dt>
              <dd className="truncate font-mono text-slate-900">{tip.ent.raw_label}</dd>
            </dl>
            <div className="mt-2.5">
              <div className="mb-1 flex justify-between text-xs text-slate-600">
                <span>Confidence</span>
                <span className="font-mono font-semibold text-slate-900">{(tip.ent.score * 100).toFixed(1)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className={cn("h-full rounded-full", CATS[tip.ent.entity_group].bar)} style={{ width: `${tip.ent.score * 100}%` }} />
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ========================================================================== */
/*  NLP pipeline drawer                                                       */
/* ========================================================================== */

const LOGITS: { tag: string; z: number }[] = [
  { tag: "B-Medication", z: 6.2 },
  { tag: "I-Medication", z: 1.9 },
  { tag: "O", z: 2.3 },
  { tag: "B-Disease_disorder", z: 1.1 },
  { tag: "B-Dosage", z: -0.4 },
];

/* ------------------------------- StepCard -------------------------------- */
/*  Pipeline step card: cursor-following 3D tilt while collapsed, click (or Enter / Space) to expand the card in
    place and reveal its details, click again to collapse. Every card has the same collapsed height; the tilt is
    applied to an inner layer while pointer tracking uses the un-rotated wrapper, so the hit-box never jitters. */

const STEP_TILT = 7; // max rotation in degrees

interface StepCardProps {
  n: number;
  icon: LucideIcon;
  title: string;
  /** one-line teaser shown while collapsed (clamped to two lines so all cards stay the same size) */
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function StepCard({ n, icon: Icon, title, summary, open, onToggle, children }: StepCardProps) {
  const reduce = useReducedMotion();
  const uid = React.useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const px = useMotionValue(0); // -0.5 .. 0.5
  const py = useMotionValue(0);
  const glare = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [STEP_TILT, -STEP_TILT]), { stiffness: 200, damping: 22 });
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-STEP_TILT, STEP_TILT]), { stiffness: 200, damping: 22 });
  const glareOpacity = useSpring(glare, { stiffness: 200, damping: 30 });
  const gx = useTransform(px, [-0.5, 0.5], [0, 100]);
  const gy = useTransform(py, [-0.5, 0.5], [0, 100]);
  const glareBg = useMotionTemplate`radial-gradient(220px circle at ${gx}% ${gy}%, rgba(255,255,255,0.7), transparent 65%)`;

  const settle = useCallback(() => {
    px.set(0);
    py.set(0);
    glare.set(0);
  }, [px, py, glare]);

  // an expanded card lies flat so its content stays crisp and aligned
  useEffect(() => {
    if (open) settle();
  }, [open, settle]);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || openRef.current || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || !r.height) return;
    px.set(Math.min(0.5, Math.max(-0.5, (e.clientX - r.left) / r.width - 0.5)));
    py.set(Math.min(0.5, Math.max(-0.5, (e.clientY - r.top) / r.height - 0.5)));
    glare.set(1);
  };

  const panelId = `${uid}-panel`;
  const btnId = `${uid}-btn`;
  const dur = reduce ? 0 : 0.35;

  // The same header markup is rendered twice: in the card's own colours, and all-white inside the clipped disc.
  const headInner = (overlay: boolean) => (
    <>
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
          overlay ? "bg-white/20" : "bg-sky-700 text-white shadow-sm"
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("flex items-baseline gap-1.5 text-base font-bold leading-6", !overlay && "text-sky-950")}>
          <span className={cn("font-mono", !overlay && "text-sky-700")}>0{n}</span>
          <span className="truncate">{title}</span>
        </span>
        <span className={cn("mt-0.5 line-clamp-2 block min-h-[2rem] text-xs font-normal leading-4", !overlay && "text-slate-600")}>{summary}</span>
      </span>
      {overlay ? (
        <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15 ring-1 ring-white/30">
          <ChevronDown className="h-4 w-4" />
        </span>
      ) : (
        <motion.span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/80 text-sky-800 ring-1 ring-sky-200"
          initial={false}
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: dur, ease: [0.22, 1, 0.36, 1] }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      )}
    </>
  );

  return (
    <div ref={wrapRef} style={{ perspective: 900 }} onPointerMove={onMove} onPointerLeave={settle}>
      <motion.div
        style={{ rotateX: reduce ? 0 : rotateX, rotateY: reduce ? 0 : rotateY }}
        className={cn(
          "glass relative overflow-hidden rounded-2xl ring-1 transition-shadow duration-300 will-change-transform",
          open ? "shadow-lg shadow-sky-900/10 ring-sky-500" : "shadow-sm ring-sky-200 hover:shadow-md hover:shadow-sky-900/10"
        )}
      >
        {/* tinted fill that washes over the card when it opens */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-100/90 via-sky-50/70 to-white/60"
          initial={false}
          animate={{ opacity: open ? 1 : 0 }}
          transition={{ duration: dur }}
        />

        {/* Header zone: the real button plus a cursor-following black disc that holds a white copy of the header.
            The wrapper is the disc's parent, so the circle is sized and tracked against the header only. */}
        <div className="relative z-10">
          <h3 className="m-0">
            <button
              type="button"
              id={btnId}
              aria-expanded={open}
              aria-controls={open ? panelId : undefined}
              onClick={onToggle}
              className="flex min-h-[88px] w-full cursor-pointer items-center gap-3 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-700"
            >
              {headInner(false)}
            </button>
          </h3>
          {/* Drawn after the button: only the part inside the circle turns white-on-black. Unmounted while open. */}
          {!open && (
            <ClippedCircle circleClassName="bg-black" sizeRatio={0.5}>
              <div className="flex min-h-[88px] flex-1 items-center gap-3 p-4 text-white [&_*]:text-white!">{headInner(true)}</div>
            </ClippedCircle>
          )}
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="body"
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              className="relative z-10 overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ height: { duration: dur, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: reduce ? 0 : 0.25 } }}
              onAnimationComplete={() => {
                // keep the whole expanded card visible inside the scrolling drawer
                if (openRef.current) wrapRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
              }}
            >
              <div className="border-t border-sky-200/80 px-4 pb-4 pt-3">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {!reduce && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] mix-blend-soft-light"
            style={{ background: glareBg, opacity: open ? 0 : glareOpacity }}
          />
        )}
      </motion.div>
    </div>
  );
}

function PipelineDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setOpenId(null); // every time the drawer opens, start with all cards collapsed
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => closeRef.current?.focus(), 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  const maxZ = Math.max(...LOGITS.map((l) => l.z));
  const exps = LOGITS.map((l) => Math.exp(l.z - maxZ));
  const sum = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e) => e / sum);

  const wp = [
    { t: "[CLS]", tag: "", special: true },
    { t: "osi", tag: "B-Medication" },
    { t: "##mer", tag: "I-Medication" },
    { t: "##tin", tag: "I-Medication" },
    { t: "##ib", tag: "I-Medication" },
    { t: "80", tag: "B-Dosage" },
    { t: "mg", tag: "I-Dosage" },
    { t: "[SEP]", tag: "", special: true },
  ];

  const toggleStep = (id: number) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-40 bg-sky-950/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pipeline-title"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-white/70 bg-sky-50/95 shadow-2xl backdrop-blur-xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-sky-200 px-4 py-4 sm:px-6 sm:py-5">
              <div>
                <h2 id="pipeline-title" className="text-xl font-extrabold text-sky-950">
                  How the NLP Pipeline Works
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  From raw abstract to colour-coded entities: transformer token classification, step by step.
                </p>
              </div>
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label="Close pipeline explanation"
                className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl bg-white text-slate-700 ring-1 ring-sky-200 transition hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-5 sm:px-6">
              <StepCard
                n={1}
                icon={Scissors}
                title="Tokenization"
                summary="Split the text into WordPiece sub-word tokens."
                open={openId === 1}
                onToggle={() => toggleStep(1)}
              >
                <p className="text-sm leading-relaxed text-slate-700">
                  The text is split into WordPiece sub-word tokens. Rare clinical words such as drug names are broken into
                  smaller pieces that the vocabulary knows; <code className="font-mono text-xs">##</code> marks a continuation.
                  Special tokens <code className="font-mono text-xs">[CLS]</code> and <code className="font-mono text-xs">[SEP]</code> frame
                  the sequence (max 512 tokens, so long abstracts are chunked).
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Example tokens">
                  {wp.map((w, i) => (
                    <span
                      key={i}
                      className={cn(
                        "rounded-md px-2 py-1 font-mono text-xs font-semibold ring-1 ring-inset",
                        w.special ? "bg-slate-100 text-slate-700 ring-slate-300" : "bg-white text-sky-900 ring-sky-300"
                      )}
                    >
                      {w.t}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-600">Illustrative split of “Osimertinib 80 mg”; exact word-pieces depend on the model vocabulary.</p>
              </StepCard>

              <StepCard
                n={2}
                icon={Layers}
                title="Subword Merging"
                summary="Glue sub-words back into exact character spans."
                open={openId === 2}
                onToggle={() => toggleStep(2)}
              >
                <p className="text-sm leading-relaxed text-slate-700">
                  The transformer produces a vector for every sub-word. Pieces that belong to the same entity are glued back
                  together using character offsets, so we recover the exact <span className="font-mono text-xs">[start:end]</span> span in
                  the original text (the Hugging Face <span className="font-mono text-xs">aggregation_strategy=&quot;simple&quot;</span>).
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md bg-white px-2 py-1 font-mono font-semibold text-sky-900 ring-1 ring-sky-300">osi + ##mer + ##tin + ##ib</span>
                  <span aria-hidden className="text-slate-500">→</span>
                  <span className={cn("rounded-md px-2 py-1 font-mono font-semibold ring-1 ring-inset", CATS.CHEMICAL.pill)}>osimertinib [0:11]</span>
                </div>
              </StepCard>

              <StepCard
                n={3}
                icon={Tags}
                title="BIO Tagging"
                summary="Tag every token B / I / O and map to 5 categories."
                open={openId === 3}
                onToggle={() => toggleStep(3)}
              >
                <p className="text-sm leading-relaxed text-slate-700">
                  Each token receives a tag: <strong>B-</strong> (Beginning of an entity), <strong>I-</strong> (Inside / continuing) or{" "}
                  <strong>O</strong> (Outside). The model’s fine-grained labels are then mapped to our 5 categories.
                </p>
                <div className="mt-3 overflow-x-auto rounded-lg">
                  <table className="w-full min-w-[400px] text-left text-xs">
                    <thead className="text-slate-600">
                      <tr>
                        <th className="py-1 pr-3 font-semibold">Token</th>
                        <th className="py-1 pr-3 font-semibold">BIO tag</th>
                        <th className="py-1 font-semibold">Mapped category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wp
                        .filter((w) => !w.special)
                        .map((w, i) => {
                          const cat: Cat = w.tag.endsWith("Medication") ? "CHEMICAL" : "PROCEDURE";
                          return (
                            <tr key={i} className="border-t border-sky-100">
                              <td className="py-1.5 pr-3 font-mono font-semibold text-slate-900">{w.t}</td>
                              <td className="py-1.5 pr-3 font-mono text-slate-800">{w.tag}</td>
                              <td className="py-1.5">
                                <span className={cn("rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset", CATS[cat].badge)}>{cat}</span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </StepCard>

              <StepCard
                n={4}
                icon={Percent}
                title="Softmax Confidence"
                summary="Turn raw logits into a probability for each tag."
                open={openId === 4}
                onToggle={() => toggleStep(4)}
              >
                <p className="text-sm leading-relaxed text-slate-700">
                  For every token the classifier outputs one raw score (logit) per tag. Softmax turns them into probabilities that
                  sum to 1; the winning probability is the token’s confidence. For a multi-token entity the scores are averaged.
                </p>
                <p className="mt-2 overflow-x-auto rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-900 ring-1 ring-sky-200">
                  P(tag<sub>i</sub>) = exp(z<sub>i</sub>) / Σ<sub>j</sub> exp(z<sub>j</sub>)
                </p>
                <div className="mt-3 space-y-1.5">
                  {LOGITS.map((l, i) => (
                    <div key={l.tag} className="grid grid-cols-[104px_1fr_48px] items-center gap-2 text-xs sm:grid-cols-[130px_1fr_56px]">
                      <span className="truncate font-mono text-slate-800" title={l.tag}>{l.tag}</span>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                        <motion.div
                          className={cn("h-full rounded-full", i === 0 ? "bg-emerald-500" : "bg-slate-400")}
                          initial={{ width: 0 }}
                          animate={{ width: `${probs[i] * 100}%` }}
                          transition={{ duration: 0.7, delay: 0.1 + i * 0.05 }}
                        />
                      </div>
                      <span className="text-right font-mono font-semibold text-slate-900">{(probs[i] * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-600">Example logits z = [{LOGITS.map((l) => l.z).join(", ")}] for the token “osi”.</p>
              </StepCard>

              <section className="rounded-2xl border border-sky-200 bg-white/70 p-4 text-sm leading-relaxed text-slate-700">
                <p className="font-bold text-sky-950">About the model</p>
                <p className="mt-1">
                  <span className="font-mono text-xs font-semibold">d4data/biomedical-ner-all</span> is a DistilBERT encoder fine-tuned for
                  token classification on the MACCROBAT biomedical case-report corpus (~40 clinical entity types). It has no gene/protein
                  label, so GENE spans come from the built-in clinical lexicon that also powers the offline demo engine.
                </p>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ========================================================================== */
/*  WakeSlider                                                                */
/* ========================================================================== */

const SETTLE = 9.23;
const FULL_SPEED = 320;
const MIN_REACH = 1.5;
const FLAT = 0.002;

interface WakeSliderProps {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  bars?: number;
  height?: number;
  restHeight?: number;
  gap?: number;
  fillColor?: string;
  trackColor?: string;
  crestColor?: string;
  sensitivity?: number;
  reach?: number;
  skew?: number;
  glide?: number;
  smoothing?: number;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (s: number) => s * s * (3 - 2 * s);
const toPct = (v: number, min: number, max: number) => (max > min ? ((v - min) / (max - min)) * 100 : 0);
const snap = (v: number, min: number, max: number, step: number) => {
  if (!(max > min)) return min;
  if (!(step > 0)) return clamp(v, min, max);
  const lastWhole = min + Math.floor(+((max - min) / step).toFixed(6)) * step;
  const grid = clamp(Math.round((v - min) / step) * step + min, min, lastWhole);
  return +(lastWhole < max && Math.abs(v - max) <= Math.abs(v - grid) ? max : grid).toFixed(6);
};

const WakeSlider: React.FC<WakeSliderProps> = ({
  value: valueProp,
  defaultValue = 50,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  bars = 32,
  height = 56,
  restHeight = 12,
  gap = 4,
  fillColor = '#f5f5f5',
  trackColor = '#27272a',
  crestColor = '',
  sensitivity = 1,
  reach = 6,
  skew = 0.6,
  glide = 0.3,
  smoothing = 100,
  showValue = false,
  formatValue,
  disabled = false,
  ariaLabel = 'Value',
  className = ''
}) => {
  const [inner, setInner] = useState(defaultValue);
  const value = clamp(valueProp ?? inner, min, max);
  const pct = toPct(value, min, max);
  const reduce = useReducedMotion();
  const format = formatValue ?? String;
  const rest = Math.min(restHeight, height - 1) / height;

  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const barEls = useRef<(HTMLSpanElement | null)[]>([]);
  const crestEls = useRef<(HTMLSpanElement | null)[]>([]);
  const pointerId = useRef<number | null>(null);
  const lastAmp = useRef(0);
  const latest = useRef(value);
  latest.current = value;

  const target = useMotionValue(pct);
  const w0 = SETTLE / glide;
  const head = useSpring(target, { stiffness: w0 * w0, damping: 2 * w0, mass: 1 });
  const rawSpeed = useVelocity(head);
  const wv = 2000 / smoothing;
  const speed = useSpring(rawSpeed, { stiffness: wv * wv, damping: 2.5 * wv, mass: 1 });

  useEffect(() => {
    target.set(pct);
  }, [pct, target]);

  const paint = (force = false) => {
    const h = ((reduce ? target.get() : head.get()) / 100) * (bars - 1);
    const v = reduce ? 0 : speed.get();
    const amp = smoothstep(clamp((Math.abs(v) * sensitivity) / FULL_SPEED, 0, 1));
    const dir = Math.sign(v) || 1;
    const r = MIN_REACH + (reach - MIN_REACH) * amp;
    const behind = r * (1 + skew);
    const ahead = r * (1 - 0.5 * skew);
    const lit = Math.round(h);
    const flat = !force && amp < FLAT && lastAmp.current < FLAT;
    for (let i = 0; i < bars; i++) {
      const el = barEls.current[i];
      if (!el) continue;
      const on = i <= lit ? 'true' : 'false';
      if (el.dataset.on !== on) el.dataset.on = on;
      if (flat) continue;
      const d = i - h;
      const R = d * dir < 0 ? behind : ahead;
      const lift = Math.abs(d) < R ? amp * Math.cos((Math.PI * d) / (2 * R)) ** 2 : 0;
      el.style.transform = `scaleY(${rest + lift * (1 - rest)})`;
      const crest = crestEls.current[i];
      if (crest) crest.style.opacity = String(lift);
    }
    lastAmp.current = amp;
  };
  const paintRef = useRef(paint);
  paintRef.current = paint;
  const run = useCallback(() => paintRef.current(), []);
  const schedule = useCallback(() => frame.render(run, false, true), [run]);
  useMotionValueEvent(head, 'change', schedule);
  useMotionValueEvent(speed, 'change', schedule);
  useLayoutEffect(() => {
    paintRef.current(true);
  });

  const commit = (next: number) => {
    const clean = snap(next, min, max, step);
    if (clean === latest.current) return;
    latest.current = clean;
    if (valueProp === undefined) setInner(clean);
    onChange?.(clean);
  };
  const commitFromX = (x: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (!rect.width) return;
    let ratio = clamp((x - rect.left) / rect.width, 0, 1);
    if (getComputedStyle(track).direction === 'rtl') ratio = 1 - ratio;
    commit(min + ratio * (max - min));
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || pointerId.current !== null) return;
    pointerId.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    rootRef.current?.removeAttribute('data-instant');
    handleRef.current?.focus({ preventScroll: true });
    commitFromX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === pointerId.current) commitFromX(e.clientX);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerId.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    pointerId.current = null;
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const jumps: Record<string, number> = {
      ArrowRight: value + step,
      ArrowUp: value + step,
      ArrowLeft: value - step,
      ArrowDown: value - step,
      PageUp: value + step * 10,
      PageDown: value - step * 10,
      Home: min,
      End: max
    };
    if (!(e.key in jumps)) return;
    e.preventDefault();
    const clean = snap(jumps[e.key], min, max, step);
    const p = toPct(clean, min, max);
    rootRef.current?.setAttribute('data-instant', 'true');
    head.jump(p);
    speed.jump(0);
    target.jump(p);
    commit(clean);
  };

  const barNodes = useMemo(() => {
    barEls.current.length = bars;
    crestEls.current.length = bars;
    return Array.from({ length: bars }, (_, i) => (
      <span
        key={i}
        ref={el => {
          barEls.current[i] = el;
        }}
        className="relative h-[var(--ws-height)] min-w-0 flex-1 origin-center rounded-full bg-[var(--ws-track)] [transform:scaleY(var(--ws-rest))] [transition:background-color_120ms_ease] data-[on=true]:bg-[var(--ws-fill)] group-data-[instant=true]:[transition-duration:0ms] motion-reduce:[transform:scaleY(var(--ws-rest))]!"
      >
        {crestColor ? (
          <span
            ref={el => {
              crestEls.current[i] = el;
            }}
            className="absolute inset-0 rounded-[inherit] bg-[var(--ws-crest)] opacity-0"
          />
        ) : null}
      </span>
    ));
  }, [bars, crestColor]);

  return (
    <div
      ref={rootRef}
      className={`group inline-flex w-full items-center gap-3 [color:inherit] aria-disabled:pointer-events-none aria-disabled:opacity-50${className ? ` ${className}` : ''}`}
      aria-disabled={disabled || undefined}
      style={
        {
          '--ws-fill': fillColor,
          '--ws-track': trackColor,
          '--ws-crest': crestColor || fillColor,
          '--ws-height': `${height}px`,
          '--ws-gap': `${gap}px`,
          '--ws-rest': rest
        } as CSSProperties
      }
    >
      <div
        ref={trackRef}
        className="relative flex h-[var(--ws-height)] min-h-11 flex-1 touch-none items-center gap-[var(--ws-gap)] select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [@media(hover:hover)_and_(pointer:fine)]:cursor-grab [@media(hover:hover)_and_(pointer:fine)]:active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      >
        {barNodes}
        <button
          ref={handleRef}
          type="button"
          role="slider"
          className="absolute inset-0 m-0 cursor-[inherit] touch-none rounded-xl border-0 bg-transparent p-0 outline-none [-webkit-tap-highlight-color:transparent]"
          tabIndex={disabled ? -1 : 0}
          aria-label={ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={format(value)}
          aria-disabled={disabled || undefined}
          onKeyDown={onKeyDown}
        />
      </div>
      {showValue ? (
        <span className="min-w-[3ch] text-right text-[13px] tabular-nums opacity-60" aria-hidden="true">
          {format(value)}
        </span>
      ) : null}
    </div>
  );
};

/* ========================================================================== */
/*  FuseButton (Fetch & analyze)                                              */
/* ========================================================================== */
/*  Port of the FuseButton reference using only React, Tailwind, framer-motion and lucide-react (no
    @hugeicons). Same look and motion: dark pill, amber fuse that burns around the outline, blur crossfade
    between layers, Undo icon that rotates in, press scale, hover/hidden-tab pause, Escape to undo, `inert`
    on inactive layers, and a check mark when done.

    The reference commits on press or on fuse end and then shows its done state unconditionally. Here the
    animation is bound to the real operation instead:

      idle     "Fetch & analyze"
      armed    the fuse burns for `undoWindow`. NOTHING has been requested yet, so Undo / Escape truly cancels.
      working  the fuse ended, so the real PubMed fetch + /api/analyze call started. Undo is gone (it could no
               longer cancel anything) and an indeterminate line shows work in progress.
      settled  entered ONLY when the operation resolved successfully. It holds, then returns to idle.
               A failure or abort returns straight to idle, where the existing error message is shown. */

type FusePhase = "idle" | "armed" | "working" | "settled";

interface FuseButtonHandle {
  /** arm the fuse with the payload to hand to onRun (ignored unless idle and enabled) */
  start: (payload: string) => void;
  /** undo a fuse that has not fired; does nothing once the operation has started */
  cancel: () => void;
}

interface FuseButtonProps {
  /** the real operation; must resolve true only when it fully succeeded */
  onRun: (payload: string) => Promise<boolean>;
  onUndo?: () => void;
  disabled?: boolean;
  /** an operation started elsewhere: the idle label shows a spinner */
  externalBusy?: boolean;
  label?: string;
  undoLabel?: string;
  workingLabel?: string;
  doneLabel?: string;
  color?: string;
  background?: string;
  fuseColor?: string;
  radius?: number;
  undoWindow?: number;
  fuseThickness?: number;
  crossfadeMs?: number;
  doneHoldMs?: number;
  /** false: no armed/Undo window at all. Pressing runs the operation immediately and the fuse burns as progress. */
  undoable?: boolean;
  /** minimum time (ms) the progress fuse stays visible when `undoable` is false (skipped for reduced motion) */
  progressMs?: number;
  /** true (default): the idle button is the form's submit button. false: a plain button that starts on click. */
  submit?: boolean;
  /** idle icon (defaults to the download icon) */
  icon?: React.ReactNode;
  /** screen-reader messages per phase (defaults describe the PubMed fetch) */
  status?: { armed?: string; working?: string; settled?: string };
  ref?: React.Ref<FuseButtonHandle>;
}

const FUSE_OUTLINE: Keyframe[] = [{ strokeDashoffset: 0 }, { strokeDashoffset: -1 }];

/* every layer shares this; only the "visible when" classes differ (written out so Tailwind can see them) */
const FB_LAYER =
  "relative [grid-area:1/1] inline-flex h-full w-full min-w-0 items-center justify-center gap-2 m-0 border-0 bg-transparent px-[var(--fb-px)] whitespace-nowrap invisible opacity-0 [filter:blur(2px)] [color:inherit] [font:inherit] [letter-spacing:inherit] [transition:opacity_var(--fb-fade)_ease,filter_var(--fb-fade)_ease,visibility_0s_linear_var(--fb-fade),background-color_160ms_ease] motion-reduce:[filter:none] motion-reduce:[transition:opacity_var(--fb-fade)_ease,visibility_0s_linear_var(--fb-fade)] group-data-[instant]:[transition-duration:0s]";
const FB_HOVER = "[@media(hover:hover)_and_(pointer:fine)]:hover:[background:color-mix(in_srgb,var(--fb-ink)_7%,transparent)]";
const FB_ICON = "inline-flex h-[var(--fb-icon)] w-[var(--fb-icon)] [&>svg]:h-full [&>svg]:w-full";

function FuseButton({
  onRun,
  onUndo,
  disabled = false,
  externalBusy = false,
  label = "Fetch & analyze",
  undoLabel = "Undo",
  workingLabel = "Fetching…",
  doneLabel = "Analyzed",
  color = "#1c1a1a",
  background = "#e9ecef",
  fuseColor = "#f5a524",
  radius = 22,
  undoWindow = 4000,
  fuseThickness = 1.5,
  crossfadeMs = 200,
  doneHoldMs = 2400,
  undoable = true,
  progressMs = 600,
  submit = true,
  icon,
  status,
  ref,
}: FuseButtonProps) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<FusePhase>("idle");
  const [instant, setInstant] = useState(false);
  const phaseRef = useRef<FusePhase>("idle");
  const rootRef = useRef<HTMLSpanElement>(null);
  const idleRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const rimRef = useRef<SVGRectElement>(null);
  const anim = useRef<Animation | null>(null);
  const pause = useRef({ hover: false, hidden: false, canHoverPause: false });
  const lastInput = useRef<"pointer" | "keyboard">("pointer");
  const payload = useRef("");
  const timer = useRef<number | null>(null);
  const mounted = useRef(true);
  const floorTimer = useRef<number | null>(null);
  const latest = useRef({ onRun, onUndo, disabled, undoWindow, doneHoldMs, undoable, progressMs, reduce });
  const statusId = useId();

  useEffect(() => {
    latest.current = { onRun, onUndo, disabled, undoWindow, doneHoldMs, undoable, progressMs, reduce };
  });

  const go = useCallback((next: FusePhase) => {
    phaseRef.current = next;
    setInstant(lastInput.current === "keyboard");
    setPhase(next);
  }, []);

  const syncPlayState = useCallback(() => {
    const a = anim.current;
    if (!a) return;
    const { hover, hidden } = pause.current;
    if (hover || hidden) {
      if (a.playState === "running") a.pause();
    } else if (a.playState === "paused") {
      a.play();
    }
  }, []);

  const finish = useCallback(
    (ok: boolean) => {
      if (!mounted.current) return;
      lastInput.current = "pointer";
      if (!ok) {
        go("idle"); // failed or aborted: no success state; the page already shows the error
        return;
      }
      go("settled");
      timer.current = window.setTimeout(() => go("idle"), latest.current.doneHoldMs);
    },
    [go]
  );

  /** fuse ended: from here the request is real and cannot be undone */
  const commit = useCallback(() => {
    lastInput.current = "pointer";
    go("working");
    const { onRun: run, undoable: canUndo, progressMs: floorMs, reduce: calm } = latest.current;
    // Without an Undo window the operation can be instant, so keep the progress fuse visible for a moment
    // (never for reduced motion). The check mark still appears only after the operation really succeeded.
    const floor =
      !canUndo && !calm && floorMs > 0
        ? new Promise<void>((resolve) => {
            floorTimer.current = window.setTimeout(resolve, floorMs);
          })
        : Promise.resolve();
    const op = run(payload.current).then(
      (ok) => ok,
      () => false
    );
    Promise.all([op, floor]).then(([ok]) => finish(ok));
  }, [finish, go]);

  const light = useCallback(() => {
    const el = rimRef.current;
    if (!el || typeof el.animate !== "function") {
      commit();
      return;
    }
    anim.current?.cancel();
    const a = el.animate(FUSE_OUTLINE, { duration: latest.current.undoWindow, easing: "linear", fill: "forwards" });
    a.onfinish = () => {
      a.onfinish = null;
      if (phaseRef.current === "armed") commit();
    };
    anim.current = a;
    syncPlayState();
  }, [commit, syncPlayState]);

  const start = useCallback(
    (value: string) => {
      if (latest.current.disabled || phaseRef.current !== "idle") return;
      payload.current = value;
      if (!latest.current.undoable) {
        commit(); // nothing to undo: run now
        return;
      }
      pause.current.canHoverPause = false;
      pause.current.hover = false;
      go("armed");
    },
    [commit, go]
  );

  const undo = useCallback(() => {
    if (phaseRef.current !== "armed") return; // too late: the operation already started
    const a = anim.current;
    if (a) {
      a.onfinish = null;
      a.pause();
    }
    latest.current.onUndo?.();
    go("idle");
  }, [go]);

  React.useImperativeHandle(ref, () => ({ start, cancel: undo }), [start, undo]);

  // Light the fuse once the armed layer is on screen.
  useEffect(() => {
    if (phase === "armed") light();
  }, [phase, light]);

  // Non-undoable: the outline fuse burns as a progress indicator while the operation runs.
  const progressFuse = phase === "working" && !undoable && !reduce;
  useEffect(() => {
    if (!progressFuse) return;
    const el = rimRef.current;
    if (!el || typeof el.animate !== "function") return;
    const a = el.animate(FUSE_OUTLINE, { duration: progressMs, easing: "linear", fill: "forwards" });
    return () => a.cancel();
  }, [progressFuse, progressMs]);

  useEffect(() => {
    const inside = rootRef.current?.contains(document.activeElement);
    if (phase === "armed") undoRef.current?.focus({ preventScroll: true });
    else if (inside) (phase === "idle" ? idleRef.current : rootRef.current)?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    mounted.current = true;
    const onVisibility = () => {
      pause.current.hidden = document.hidden;
      syncPlayState();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      anim.current?.cancel();
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (floorTimer.current !== null) window.clearTimeout(floorTimer.current);
    };
  }, [syncPlayState]);

  const handlePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    lastInput.current = "pointer";
    const pressable = phase === "armed" || (phase === "idle" && !disabled);
    if (e.button === 0 && pressable && rootRef.current) rootRef.current.dataset.pressed = "";
  };
  const release = () => {
    if (rootRef.current) delete rootRef.current.dataset.pressed;
  };
  const handlePointerEnter = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (e.pointerType === "mouse" && pause.current.canHoverPause) {
      pause.current.hover = true;
      syncPlayState();
    }
  };
  const handlePointerLeave = (e: React.PointerEvent<HTMLSpanElement>) => {
    release();
    if (e.pointerType !== "mouse") return;
    pause.current.canHoverPause = true;
    pause.current.hover = false;
    syncPlayState();
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter" || e.key === " ") lastInput.current = "keyboard";
    if (e.key === "Escape" && phase === "armed") {
      e.preventDefault();
      lastInput.current = "keyboard";
      undo();
    }
  };

  return (
    <span
      ref={rootRef}
      tabIndex={-1}
      className="group relative inline-grid h-[var(--fb-h)] shrink-0 grid-cols-[minmax(0,1fr)] isolate touch-manipulation select-none overflow-hidden rounded-[var(--fb-radius)] font-medium leading-none tracking-[0.01em] outline-none [font-size:var(--fb-fs)] [background:var(--fb-bg)] [color:var(--fb-ink)] [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] [transition:transform_160ms_var(--fb-ease-out)] data-[pressed]:[transform:scale(var(--fb-press))] motion-reduce:data-[pressed]:[transform:none] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:[outline-color:color-mix(in_srgb,var(--fb-ink)_60%,transparent)] data-[phase=idle]:has-[.fb-idle:disabled]:opacity-[0.55] contrast-more:[box-shadow:inset_0_0_0_1px_color-mix(in_srgb,var(--fb-ink)_40%,transparent)]"
      data-phase={phase}
      data-fuse={phase === "armed" || progressFuse ? "" : undefined}
      data-instant={instant ? "" : undefined}
      aria-disabled={phase === "settled" || undefined}
      style={
        {
          "--fb-ink": color,
          "--fb-bg": background,
          "--fb-fuse": fuseColor,
          "--fb-fuse-h": `${fuseThickness}px`,
          "--fb-radius": `${radius}px`,
          "--fb-fade": `${crossfadeMs}ms`,
          "--fb-h": "44px",
          "--fb-fs": "14px",
          "--fb-icon": "15px",
          "--fb-px": "20px",
          "--fb-press": 0.97,
          "--fb-ease-out": "cubic-bezier(0.23, 1, 0.32, 1)",
        } as CSSProperties
      }
      onPointerDown={handlePointerDown}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
    >
      {/* idle: the form's submit button (the form's onSubmit arms the fuse, so Enter in the input works too) */}
      <button
        ref={idleRef}
        type={submit ? "submit" : "button"}
        onClick={submit ? undefined : () => start("")}
        disabled={disabled}
        inert={phase !== "idle"}
        className={cn(
          FB_LAYER,
          "fb-idle cursor-pointer disabled:cursor-default focus-visible:outline-none group-data-[phase=idle]:visible group-data-[phase=idle]:opacity-100 group-data-[phase=idle]:[filter:blur(0)] group-data-[phase=idle]:[transition-delay:0s]",
          FB_HOVER.replace("hover:", "enabled:hover:")
        )}
      >
        <span className={FB_ICON} aria-hidden>
          {externalBusy ? <Loader2 className="animate-spin motion-reduce:animate-none" strokeWidth={1.8} /> : (icon ?? <Download strokeWidth={1.8} />)}
        </span>
        {label}
      </button>

      {/* armed: Undo, whose icon swings in while the fuse burns (not rendered at all when `undoable` is false) */}
      {undoable && (
        <button
          ref={undoRef}
          type="button"
          aria-describedby={statusId}
          aria-keyshortcuts="Escape"
          inert={phase !== "armed"}
          onClick={undo}
          className={cn(
            FB_LAYER,
            "cursor-pointer focus-visible:outline-none group-data-[phase=armed]:visible group-data-[phase=armed]:opacity-100 group-data-[phase=armed]:[filter:blur(0)] group-data-[phase=armed]:[transition-delay:0s]",
            FB_HOVER
          )}
        >
          <span
            className={cn(
              FB_ICON,
              "[transform:rotate(-70deg)] [transition:transform_var(--fb-fade)_var(--fb-ease-out)] group-data-[phase=armed]:[transform:rotate(0deg)] motion-reduce:transition-none motion-reduce:[transform:none]"
            )}
            aria-hidden
          >
            <Undo2 strokeWidth={2} />
          </span>
          {undoLabel}
        </button>
      )}

      {/* working: the real operation is running; nothing to undo any more */}
      <span
        inert={phase !== "working"}
        className={cn(
          FB_LAYER,
          "cursor-default group-data-[phase=working]:visible group-data-[phase=working]:opacity-100 group-data-[phase=working]:[filter:blur(0)] group-data-[phase=working]:[transition-delay:0s]"
        )}
      >
        <span className={FB_ICON} aria-hidden>
          <Loader2 className="animate-spin motion-reduce:animate-none" strokeWidth={2} />
        </span>
        {workingLabel}
        {phase === "working" && !progressFuse && (
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[var(--fb-fuse-h)] overflow-hidden">
            {reduce ? (
              <span className="block h-full w-full opacity-70 [background:var(--fb-fuse)]" />
            ) : (
              <motion.span
                className="block h-full w-1/3 [background:var(--fb-fuse)] [box-shadow:0_0_6px_color-mix(in_srgb,var(--fb-fuse)_55%,transparent)]"
                initial={{ x: "-100%" }}
                animate={{ x: "300%" }}
                transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity }}
              />
            )}
          </span>
        )}
      </span>

      {/* settled: reachable only after a real success */}
      <span
        inert={phase !== "settled"}
        className={cn(
          FB_LAYER,
          "cursor-default group-data-[phase=settled]:visible group-data-[phase=settled]:opacity-100 group-data-[phase=settled]:[filter:blur(0)] group-data-[phase=settled]:[transition-delay:0s]"
        )}
      >
        <span className={FB_ICON} aria-hidden>
          <Check strokeWidth={2.2} />
        </span>
        {doneLabel}
      </span>

      {/* the burning outline */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible opacity-0 [filter:drop-shadow(0_0_3px_color-mix(in_srgb,var(--fb-fuse)_60%,transparent))] [transition:opacity_var(--fb-fade)_ease] group-data-[fuse]:opacity-100 group-data-[instant]:[transition-duration:0s]"
        aria-hidden
      >
        <rect
          ref={rimRef}
          pathLength="1"
          className="fill-none [x:calc(var(--fb-fuse-h)/2)] [y:calc(var(--fb-fuse-h)/2)] [width:calc(100%-var(--fb-fuse-h))] [height:calc(100%-var(--fb-fuse-h))] [rx:max(0px,calc(var(--fb-radius)-var(--fb-fuse-h)/2))] [stroke:var(--fb-fuse)] [stroke-width:var(--fb-fuse-h)] [stroke-linecap:round] [stroke-dasharray:1] forced-colors:[stroke:Highlight]"
        />
      </svg>

      <span className="sr-only" id={statusId} role="status" aria-live="polite">
        {phase === "armed"
          ? (status?.armed ?? "Fetch starting. Press Undo or Escape to cancel.")
          : phase === "working"
            ? (status?.working ?? "Fetching and analyzing. This can no longer be undone.")
            : phase === "settled"
              ? (status?.settled ?? "PubMed abstract fetched and analyzed.")
              : ""}
      </span>
    </span>
  );
}

/* ========================================================================== */
/*  InteractiveHoverButton (Run NER Analysis)                                  */
/* ========================================================================== */
/*  Hover/focus: the label slides out, a dot expands to fill the button, and the label returns with an arrow.
    Fixed width + absolutely positioned layers, so nothing shifts. The motion-reduce variants make the swap
    instant. While `loading` the button shows a plain spinner state and the animation is switched off;
    it is disabled in that state (and when `disabled`), so the hover effect never plays on a dead button. */

interface InteractiveHoverButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text: string;
  loading?: boolean;
  loadingText?: string;
}

function InteractiveHoverButton({ text, loading = false, loadingText = "Analyzing…", className, disabled, ...props }: InteractiveHoverButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={loading || undefined}
      className={cn(
        "group relative flex min-h-[44px] w-[188px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-emerald-700 bg-white px-5 text-sm font-bold text-emerald-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
          {loadingText}
        </span>
      ) : (
        <>
          <span className="inline-block translate-x-1 transition-all duration-300 motion-reduce:transition-none group-enabled:group-hover:translate-x-12 group-enabled:group-hover:opacity-0 group-enabled:group-focus-visible:translate-x-12 group-enabled:group-focus-visible:opacity-0">
            {text}
          </span>
          <span
            aria-hidden
            className="absolute top-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2 text-white opacity-0 transition-all duration-300 motion-reduce:transition-none group-enabled:group-hover:-translate-x-1 group-enabled:group-hover:opacity-100 group-enabled:group-focus-visible:-translate-x-1 group-enabled:group-focus-visible:opacity-100"
          >
            <span>{text}</span>
            <ArrowRight className="h-4 w-4" />
          </span>
          <span
            aria-hidden
            className="absolute left-4 top-[40%] h-2 w-2 scale-[1] rounded-lg bg-emerald-700 transition-all duration-300 motion-reduce:transition-none group-enabled:group-hover:left-0 group-enabled:group-hover:top-0 group-enabled:group-hover:h-full group-enabled:group-hover:w-full group-enabled:group-hover:scale-[1.8] group-enabled:group-focus-visible:left-0 group-enabled:group-focus-visible:top-0 group-enabled:group-focus-visible:h-full group-enabled:group-focus-visible:w-full group-enabled:group-focus-visible:scale-[1.8]"
          />
        </>
      )}
    </button>
  );
}

/* ========================================================================== */
/*  ClearButton                                                               */
/* ========================================================================== */
/*  Port of the animated "Delete" button: the trash-bin lid and bin animate away, then each letter of the label
    tumbles out. The reference wraps letters in <span>s via innerHTML and toggles a `delete` class for 2.4 s;
    here the letters are React-rendered spans and `deleting` is state cleared by a timer (cleaned up on unmount).
    The real clear runs immediately on click; the animation is feedback only, clicks during it are ignored, and
    with prefers-reduced-motion the animation is skipped. Only transforms/opacity animate, so the size never changes. */

const CLEAR_LABEL = "Clear";
const CLEAR_MS = 2400;

const CLEAR_BUTTON_CSS = `
.clear-btn{--background:#e11d48;--background-hover:#be123c;--text:#fff;--icon:#fff;
  display:flex;align-items:center;justify-content:center;width:96px;min-height:44px;padding:0 12px;border:0;border-radius:12px;
  outline:none;cursor:pointer;line-height:24px;font-family:inherit;font-weight:600;font-size:14px;overflow:hidden;
  color:var(--text);background:var(--b,var(--background));
  transition:transform .3s,background .4s;transform:scale(var(--scale,1)) translateZ(0);
  -webkit-appearance:none;-webkit-tap-highlight-color:transparent;-webkit-mask-image:-webkit-radial-gradient(white,black)}
.clear-btn:active:not(:disabled){--scale:.95}
.clear-btn:hover:not(:disabled){--b:var(--background-hover)}
.clear-btn .clear-icon,.clear-btn .clear-text{display:inline-block;vertical-align:top;transform:translateZ(0)}
.clear-btn .clear-icon{width:24px;height:24px;position:relative;z-index:1;margin-right:8px;color:var(--text);flex:none}
.clear-btn .clear-icon svg{width:96px;height:96px;display:block;position:absolute;left:-36px;top:-36px;will-change:transform;fill:var(--icon);
  transform:scale(.25) translateZ(0);animation:var(--name,var(--name-top,none)) 2400ms ease forwards}
.clear-btn .clear-icon svg.bottom{--name:var(--name-bottom,none)}
.clear-btn .clear-text{animation:var(--name-text,none) 2400ms ease forwards}
.clear-btn .clear-text span{display:inline-block;vertical-align:top;opacity:var(--span-o,1);
  transform:translate(var(--span-x,0),var(--span-y,0)) rotate(var(--span-r,0deg)) translateZ(0);
  transition:transform .3s ease var(--span-d,0s),opacity .2s linear var(--span-o-d,.3s)}
.clear-btn .clear-text span:nth-child(1){--span-delay:0.4s;--span-o-d:0.325s}
.clear-btn .clear-text span:nth-child(2){--span-delay:0.45s;--span-o-d:0.35s}
.clear-btn .clear-text span:nth-child(3){--span-delay:0.5s;--span-o-d:0.375s}
.clear-btn .clear-text span:nth-child(4){--span-delay:0.55s;--span-o-d:0.4s}
.clear-btn .clear-text span:nth-child(5){--span-delay:0.6s;--span-o-d:0.425s}
.clear-btn.is-deleting{--name-top:clear-trash-top;--name-bottom:clear-trash-bottom;--name-text:clear-text;--span-x:-8px;--span-y:8px;--span-r:-40deg;--span-o:0}
.clear-btn.is-deleting .clear-text span{--span-o-d:1s;--span-d:var(--span-delay)}
@keyframes clear-trash-bottom{
  25%,32%{transform:translate(32px,19px) scale(1) translateZ(0)}
  70%,80%{transform:translate(32px,0) scale(.25) translateZ(0)}
  90%{transform:translateX(-2px) scale(.25) translateZ(0)}
  100%{transform:scale(.25) translateZ(0)}
}
@keyframes clear-trash-top{
  25%,32%{transform:translate(38px,4px) scale(1) rotate(-20deg) translateZ(0)}
  70%,80%{transform:translate(32px,0) scale(.25) translateZ(0)}
  90%{transform:translateX(-2px) scale(.25) translateZ(0)}
  100%{transform:scale(.25) translateZ(0)}
}
@keyframes clear-text{
  25%{transform:translate(-4px,-6px) rotate(-20deg) translateZ(0)}
  70%{opacity:1;transform:translate(-12px,48px) rotate(-80deg) scale(.2) translateZ(0)}
  71%{opacity:0}
  72%,90%{opacity:0;transform:translateZ(0)}
  100%{opacity:1}
}
@media (prefers-reduced-motion:reduce){
  .clear-btn,.clear-btn .clear-icon svg,.clear-btn .clear-text,.clear-btn .clear-text span{animation:none!important;transition:none!important}
}
`;

function ClearButton({ onClear, disabled }: { onClear: () => void; disabled: boolean }) {
  const reduce = useReducedMotion();
  const [deleting, setDeleting] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const handleClick = () => {
    if (deleting) return; // already animating: ignore repeated clicks
    onClear(); // the real action, exactly as before
    if (reduce) return; // no motion: the cleared input is the feedback
    setDeleting(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setDeleting(false);
    }, CLEAR_MS);
  };

  return (
    <>
      <style>{CLEAR_BUTTON_CSS}</style>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled && !deleting}
        aria-label={CLEAR_LABEL}
        className={cn(
          "clear-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50",
          deleting && "is-deleting"
        )}
      >
        <span aria-hidden className="clear-icon">
          <svg className="top" viewBox="0 0 24 24">
            <path d="M15,3.75 C15.5522847,3.75 16,4.19771525 16,4.75 L16,5.75 L18.25,5.75 C18.6642136,5.75 19,6.08578644 19,6.5 C19,6.91421356 18.6642136,7.25 18.25,7.25 L5.75,7.25 C5.33578644,7.25 5,6.91421356 5,6.5 C5,6.08578644 5.33578644,5.75 5.75,5.75 L8,5.75 L8,4.75 C8,4.19771525 8.44771525,3.75 9,3.75 L15,3.75 Z M14,5 L10,5 C9.72385763,5 9.5,5.22385763 9.5,5.5 C9.5,5.74545989 9.67687516,5.94960837 9.91012437,5.99194433 L10,6 L14,6 C14.2761424,6 14.5,5.77614237 14.5,5.5 C14.5,5.25454011 14.3231248,5.05039163 14.0898756,5.00805567 L14,5 Z" />
          </svg>
          <svg className="bottom" viewBox="0 0 24 24">
            <path d="M7.02498527,8.25 L16.9751371,8.25 C17.5411532,8.25 18,8.69771525 18,9.25 C18,9.2951932 17.9968602,9.34033442 17.9906022,9.3851132 L16.6878729,18.7066989 C16.6389095,19.0569074 16.4041276,19.3558931 16.0703039,19.4931212 C14.8428392,19.9977071 13.4860916,20.25 12.0000612,20.25 C10.5140229,20.25 9.1572688,19.9977044 7.92979891,19.4931132 C7.59597391,19.3558774 7.36118974,19.0568881 7.31224574,18.7066728 L6.00952014,9.3851132 C5.93304388,8.83789281 6.32568685,8.33379079 6.88651275,8.25916983 C6.93240487,8.25306363 6.97866843,8.25 7.02498527,8.25 Z" />
          </svg>
        </span>
        <span aria-hidden className="clear-text">
          {Array.from(CLEAR_LABEL).map((ch, i) => (
            <span key={i}>{ch}</span>
          ))}
        </span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {deleting ? "Text cleared" : ""}
      </span>
    </>
  );
}

/* ========================================================================== */
/*  ExportZipButton (used by Export CSV)                                      */
/* ========================================================================== */
/*  Port of the "Compress files" button: the front panel folds back in 3D, paper sheets fly in behind it, a zipper
    runs across, the label drops out and a check mark appears. The reference toggles a `compress` class for 4 s;
    here `busy` is React state that adds `zb-on`, cleared by a cleanup-safe timer. The real download runs
    immediately on click (animation is feedback only), clicks during the animation are ignored, and with
    prefers-reduced-motion everything is instant: no fold / paper / zipper, just the check mark, for a shorter time.
    Colours come from CSS variables (`theme`), so each button keeps its own look; the button is 44px tall. */

const ZIP_MS = 4000;
const ZIP_MS_REDUCED = 2000;
const ZIP_DOTS = Array.from({ length: 29 }, (_, k) => `${(k + 1) * 5}px 0 0 var(--zipper-lines)`).join(",");

const ZIP_BUTTON_CSS = `
.zb{--button-width:136px;--background:#ffffff;--background-transparent:rgba(255,255,255,0);--background-hover:#f0f9ff;--background-back:#e0f2fe;
  --shadow:rgba(3,105,161,.14);--text:#0c4a6e;--paper:#ffffff;--paper-lines:#bae6fd;--paper-shadow:rgba(3,105,161,.18);
  --zipper:#7dd3fc;--zipper-end:#bae6fd;--zipper-line:#38bdf8;--zipper-lines:#7dd3fc;--tick:#0369a1;
  position:relative;display:flex;flex:none;cursor:pointer;text-align:center;border:0;padding:0;line-height:24px;font-family:inherit;
  font-weight:600;font-size:14px;border-radius:12px;color:var(--text);background:var(--background-back);box-shadow:0 0 0 1px var(--ring,#7dd3fc);
  transition:transform .3s;transform:scale(var(--scale,1)) translateZ(0);-webkit-appearance:none;-webkit-tap-highlight-color:transparent}
.zb:disabled{cursor:not-allowed;opacity:.5}
.zb:not(.zb-on):not(:disabled):active{--scale:.95}
.zb:not(.zb-on):not(:disabled):hover{--b:var(--background-hover)}
.zb-paper{display:block;width:26px;height:32px;pointer-events:none;position:absolute;top:-2px;left:var(--left,50%);margin:0 0 0 -13px;
  background:var(--paper);border-radius:3px;box-shadow:0 1px 1px var(--paper-shadow);opacity:0;transform:translate(var(--x,0),var(--y,-68px))}
.zb-paper:before{content:'';position:absolute;left:4px;top:6px;width:18px;height:2px;border-radius:1px;background:var(--paper-lines);
  box-shadow:0 6px 0 var(--paper-lines),0 12px 0 var(--paper-lines),0 18px 0 var(--paper-lines)}
.zb-paper.left{--left:25%;--x:-12px;--y:-52px}
.zb-paper.right{--left:75%;--x:12px;--y:-52px}
.zb-inner{display:block;position:relative;z-index:1;overflow:hidden;padding:10px 0;width:var(--button-width);border-radius:12px;color:var(--text);
  transform-origin:50% 100%;background:var(--b,var(--background));box-shadow:0 1px 2px var(--shadow),0 4px 7px var(--shadow);transition:background .4s}
.zb-label{display:flex;align-items:center;justify-content:center;gap:8px;opacity:var(--span-o,1);transform:translateY(var(--span-y,0)) translateZ(0);
  transition:transform .3s ease var(--span-de,.5s),opacity .3s linear var(--span-de,.5s)}
.zb-tick{width:20px;height:16px;display:block;position:absolute;top:14px;left:calc(var(--button-width) / 2);margin-left:-10px;fill:none;stroke-width:2px;
  stroke-linecap:round;stroke-linejoin:round;stroke:var(--tick);opacity:var(--tick-o,0);transform:scale(var(--tick-s,.5));
  transition:transform .4s ease var(--tick-de,0s),opacity .3s linear var(--tick-de,0s)}
.zb-zipper{display:block;width:calc(var(--button-width) + 12px);position:absolute;top:4px;left:0;height:12px;overflow:hidden;opacity:0}
.zb-zipper:before,.zb-zipper:after{content:'';position:absolute;top:var(--top,1px);left:var(--left,1px);height:3px;width:2px;border-radius:1px;
  box-shadow:${ZIP_DOTS};background:var(--zipper-lines)}
.zb-zipper:after{--top:8px;--left:3px}
.zb-gradient{display:block;position:absolute;top:0;bottom:0;width:200%;right:12px;z-index:1;
  background:linear-gradient(to right,var(--background-transparent) 0%,var(--background-transparent) 33.33%,var(--background) 66.66%,var(--background) 100%);
  background-size:300% 100%;background-position-x:var(--gradient,100%);transition:background-position var(--gradient-d,0s) ease var(--gradient-de,0s)}
.zb-line{display:block;width:calc(var(--button-width) + 12px);height:2px;margin:5px 0;position:relative;left:-12px;z-index:2;background:var(--zipper-line);
  transform:translateX(calc(calc(var(--button-width) * -1) + 8px))}
.zb-line:before,.zb-line:after{content:'';position:absolute;right:var(--right,0);width:var(--width,6px);height:var(--height,2px);border-radius:1px}
.zb-line:before{background:var(--zipper-end)}
.zb-line:after{--right:-7px;--width:8px;--height:8px;transform:translate(0,-3px) scaleY(.6) rotate(-45deg);clip-path:polygon(0 0,100% 0,0 100%);background:var(--zipper)}
.zb.zb-on{--span-o:0;--span-y:8px;--span-de:0s;--tick-o:1;--tick-s:1;--tick-de:3.2s;--gradient:0%;--gradient-d:1.8s;--gradient-de:1.8s}
.zb.zb-on .zb-paper{animation:zb-paper 1.8s linear forwards}
.zb.zb-on .zb-inner{animation:zb-fold 1.8s linear forwards}
.zb.zb-on .zb-zipper{animation:zb-zipper 3.5s linear}
.zb.zb-on .zb-line{animation:zb-line 1.2s linear forwards 1.8s}
@keyframes zb-paper{
  10%,100%{opacity:1}
  0%,5%{transform:translate(var(--x,0),var(--y,-68px))}
  30%{transform:translate(0,1px)}
  50%,70%{transform:translate(0,-3px)}
  95%,100%{transform:translate(0,4px)}
}
@keyframes zb-line{60%{transform:translateX(5px)}80%{transform:translateX(-2px)}100%{transform:translateX(0)}}
@keyframes zb-fold{10%,80%{transform:perspective(500px) rotateX(-20deg) translateZ(16px)}}
@keyframes zb-zipper{20%,90%{opacity:1}}
@media (prefers-reduced-motion:reduce){
  .zb,.zb-inner,.zb-label,.zb-tick,.zb-gradient{transition:none!important}
  .zb.zb-on .zb-paper,.zb.zb-on .zb-inner,.zb.zb-on .zb-zipper,.zb.zb-on .zb-line{animation:none!important}
}
`;

interface ExportZipButtonProps {
  onExport: () => void;
  disabled: boolean;
  label: string;
  icon: React.ReactNode;
  /** CSS custom properties that colour / size the button (see `.zb` in ZIP_BUTTON_CSS for the names) */
  theme: Record<string, string>;
  doneStatus: string;
}

function ExportZipButton({ onExport, disabled, label, icon, theme, doneStatus }: ExportZipButtonProps) {
  const reduce = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const handleClick = () => {
    if (busy) return; // already animating: ignore overlapping clicks
    onExport(); // the real download, exactly as before
    setBusy(true);
    timer.current = window.setTimeout(
      () => {
        timer.current = null;
        setBusy(false);
      },
      reduce ? ZIP_MS_REDUCED : ZIP_MS
    );
  };

  return (
    <>
      <style>{ZIP_BUTTON_CSS}</style>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={label}
        style={theme as CSSProperties}
        className={cn(
          "zb focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700",
          busy && "zb-on"
        )}
      >
        <span aria-hidden className="zb-paper left" />
        <span aria-hidden className="zb-paper middle" />
        <span aria-hidden className="zb-paper right" />
        <span aria-hidden className="zb-inner">
          <span className="zb-zipper">
            <span className="zb-line" />
            <span className="zb-gradient" />
          </span>
          <span className="zb-label">
            {icon}
            {label}
          </span>
          <svg className="zb-tick" viewBox="0 0 20 16">
            <polyline points="3 8.75 7.75 13.5 17 2.5" />
          </svg>
        </span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {busy ? doneStatus : ""}
      </span>
    </>
  );
}

/* ========================================================================== */
/*  Page                                                                      */
/* ========================================================================== */

export default function Page() {
  const [text, setText] = useState(SAMPLES[0].text);
  const [activeSample, setActiveSample] = useState<string | null>(SAMPLES[0].id);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [analyzedText, setAnalyzedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pmid, setPmid] = useState("");
  const [pmidLoading, setPmidLoading] = useState(false);
  const [pmidMsg, setPmidMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [active, setActive] = useState<Record<Cat, boolean>>({ DISEASE: true, CHEMICAL: true, GENE: true, ANATOMY: true, PROCEDURE: true });
  const [threshold, setThreshold] = useState(70);
  // Keyboard-only focus indicator for the WakeSlider. WakeSlider focuses its button via script on every
  // pointer-down, and browsers report script focus as :focus-visible, so CSS (:focus-visible / :focus-within /
  // :has) draws the ring on mouse clicks too. We track the input modality ourselves instead.
  const [sliderKbd, setSliderKbd] = useState(false);
  const sliderPointer = useRef(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "start", dir: "asc" });

  const [drawer, setDrawer] = useState(false);
  const [tip, setTip] = useState<TipState | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const fetchBtn = useRef<FuseButtonHandle>(null);
  const drawerBtnRef = useRef<HTMLButtonElement>(null);

  // The header floats (position: fixed), so a spacer the same height as the bar keeps the content from sliding under it.
  const barRef = useRef<HTMLDivElement>(null);
  const [barH, setBarH] = useState(68);
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const measure = () => setBarH(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawer(false);
    window.setTimeout(() => drawerBtnRef.current?.focus(), 0);
  }, []);

  /* ------------------------------- analysis -------------------------------- */

  const analyze = useCallback(async (input: string): Promise<boolean> => {
    if (!input.trim()) {
      setError("Paste or select some clinical text first.");
      return false;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setTip(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      setResult(data as AnalyzeResponse);
      setAnalyzedText(input);
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return false;
      setError(e instanceof Error ? e.message : "Something went wrong while analyzing.");
      return false;
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, []);

  useEffect(() => {
    analyze(SAMPLES[0].text);
    fetch("/api/analyze")
      .then((r) => r.json())
      .then((j: ServerInfo) => setServerInfo(j))
      .catch(() => setServerInfo(null));
    return () => abortRef.current?.abort();
  }, [analyze]);

  useEffect(() => {
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);

  const pickSample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) return;
    fetchBtn.current?.cancel();
    setActiveSample(id);
    setText(s.text);
    setPmidMsg(null);
    analyze(s.text);
  };

  /* ------------------------------ PubMed fetch ------------------------------ */

  const normalizePmid = (rawId: string) => rawId.trim().replace(/^PMID:?\s*/i, "");

  /** resolves true only when the abstract was fetched AND the analysis succeeded */
  const fetchPubMed = async (rawId: string): Promise<boolean> => {
    const id = normalizePmid(rawId);
    if (!/^\d{1,9}$/.test(id)) {
      setPmidMsg({ kind: "error", text: "Enter a numeric PMID, for example 29151359." });
      return false;
    }
    setPmidLoading(true);
    setPmidMsg(null);
    try {
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${id}&retmode=xml&tool=bioner-nlp-demo`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`NCBI E-utilities returned HTTP ${res.status}.`);
      const xml = await res.text();
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      const art = doc.querySelector("PubmedArticle");
      if (!art) throw new Error(`No PubMed record found for PMID ${id}.`);
      const title = (art.querySelector("ArticleTitle")?.textContent ?? "").trim();
      const parts = Array.from(art.querySelectorAll("Abstract > AbstractText")).map((n) => {
        const label = n.getAttribute("Label");
        const body = (n.textContent ?? "").trim();
        return label ? `${label}: ${body}` : body;
      });
      if (parts.length === 0) throw new Error(`PMID ${id} has no abstract available.`);
      const journal = (art.querySelector("Journal > Title")?.textContent ?? "PubMed").trim();
      let body = `${title}\n\n${parts.join("\n\n")}`;
      let truncated = false;
      if (body.length > MAX_CHARS) {
        body = body.slice(0, MAX_CHARS);
        truncated = true;
      }
      setText(body);
      setActiveSample(null);
      setPmidMsg({ kind: "ok", text: `Loaded PMID ${id} · ${journal}${truncated ? " (truncated to 6,000 characters)" : ""}` });
      return await analyze(body);
    } catch (e) {
      setPmidMsg({
        kind: "error",
        text: e instanceof TypeError ? "Network error while contacting NCBI. Check your connection and try again." : e instanceof Error ? e.message : "Could not fetch this PMID.",
      });
      return false;
    } finally {
      setPmidLoading(false);
    }
  };

  /* ------------------------------ derived data ------------------------------ */

  const inThreshold = useMemo(
    () => (result ? result.entities.filter((e) => e.score * 100 >= threshold) : []),
    [result, threshold]
  );

  const countsAtThreshold = useMemo(() => {
    const c: Record<Cat, number> = { DISEASE: 0, CHEMICAL: 0, GENE: 0, ANATOMY: 0, PROCEDURE: 0 };
    inThreshold.forEach((e) => {
      c[e.entity_group] += 1;
    });
    return c;
  }, [inThreshold]);

  const visible = useMemo(() => inThreshold.filter((e) => active[e.entity_group]), [inThreshold, active]);

  const stats = useMemo(() => {
    const counts: Record<Cat, number> = { DISEASE: 0, CHEMICAL: 0, GENE: 0, ANATOMY: 0, PROCEDURE: 0 };
    let sum = 0;
    visible.forEach((e) => {
      counts[e.entity_group] += 1;
      sum += e.score;
    });
    const total = visible.length;
    let dominant: Cat | null = null;
    CAT_ORDER.forEach((c) => {
      if (counts[c] > 0 && (dominant === null || counts[c] > counts[dominant])) dominant = c;
    });
    return { counts, total, mean: total ? (sum / total) * 100 : 0, dominant: dominant as Cat | null };
  }, [visible]);

  // Highest / lowest confidence among the entities currently shown (same set as the distribution card).
  const confidence = useMemo(() => {
    if (visible.length === 0) return null;
    let high = visible[0];
    let low = visible[0];
    visible.forEach((e) => {
      if (e.score > high.score) high = e;
      if (e.score < low.score) low = e;
    });
    return { mean: stats.mean, high, low };
  }, [visible, stats.mean]);

  const segments = useMemo(() => buildSegments(analyzedText, visible), [analyzedText, visible]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = visible.filter(
      (e) =>
        !q ||
        e.word.toLowerCase().includes(q) ||
        e.entity_group.toLowerCase().includes(q) ||
        CATS[e.entity_group].label.toLowerCase().includes(q) ||
        e.raw_label.toLowerCase().includes(q)
    );
    const d = sort.dir === "asc" ? 1 : -1;
    return filtered.slice().sort((a, b) => {
      if (sort.key === "word") return a.word.localeCompare(b.word) * d;
      if (sort.key === "entity_group") return a.entity_group.localeCompare(b.entity_group) * d || a.start - b.start;
      if (sort.key === "score") return (a.score - b.score) * d;
      return (a.start - b.start) * d;
    });
  }, [visible, query, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "score" ? "desc" : "asc" }));

  const stale = Boolean(result) && text !== analyzedText;
  const filtersChanged = threshold !== 70 || CAT_ORDER.some((c) => !active[c]);

  /* -------------------------------- exports --------------------------------- */

  const exportJSON = () => {
    const payload = {
      model: result?.model,
      engine: result?.engine,
      exported_at: new Date().toISOString(),
      confidence_threshold: threshold / 100,
      entity_count: rows.length,
      entities: rows.map(({ start, end, word, entity_group, score, raw_label, source }) => ({ start, end, word, entity_group, score, raw_label, source })),
    };
    downloadFile(`bioner-entities-${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json");
  };

  const exportCSV = () => {
    const header = ["word", "entity_group", "raw_label", "start", "end", "score", "source"].join(",");
    const lines = rows.map((e) => [csvCell(e.word), e.entity_group, csvCell(e.raw_label), e.start, e.end, e.score, e.source].join(","));
    downloadFile(`bioner-entities-${Date.now()}.csv`, [header, ...lines].join("\n"), "text/csv;charset=utf-8");
  };

  /* ------------------------------ status badge ------------------------------ */

  const engine = result?.engine ?? (serverInfo?.hf_configured ? "huggingface" : "fallback");
  const live = engine !== "fallback";
  const statusLabel = !serverInfo && !result ? "Checking engine…" : live ? "Live · Hugging Face" : "Offline demo engine";

  const latencyDecimals = result && result.latency_ms < 10 ? 1 : 0;

  /* --------------------------------- render --------------------------------- */

  return (
    <MotionConfig reducedMotion="user">
      <SpotlightBackground />
      <div className="relative z-10 min-h-screen pb-16">
        {/* ------------------------------ Navbar ------------------------------ */}
        <header className="pointer-events-none fixed inset-x-0 top-5 z-30 px-4 sm:px-6">
          <div
            ref={barRef}
            className="pointer-events-auto mx-auto flex w-full max-w-[1415px] flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.34)_100%)] px-4 py-2.5 shadow-[0_8px_32px_rgba(3,105,161,0.14),0_2px_6px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-1px_0_rgba(255,255,255,0.3)] ring-1 ring-sky-900/5 backdrop-blur-[20px] backdrop-saturate-150 sm:px-5 lg:flex-nowrap"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky-600 to-emerald-600 text-white shadow-md shadow-sky-900/20">
                <Dna className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <h1 className="whitespace-nowrap text-lg font-extrabold leading-tight tracking-tight text-sky-950 sm:text-xl">BioNER Studio</h1>
                <p className="text-xs text-slate-600 sm:text-sm lg:truncate">Biomedical Named Entity Recognition in Medical Literature</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 lg:shrink-0 lg:flex-nowrap">
              <div
                className="flex items-center gap-2 whitespace-nowrap rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-800 ring-1 ring-sky-200"
                title={result?.fallback_reason ?? undefined}
              >
                <span className="relative flex h-2.5 w-2.5" aria-hidden>
                  {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />}
                  <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", live ? "bg-emerald-600" : "bg-amber-500")} />
                </span>
                <span className="hidden sm:inline">Powered by</span>
                <span className="font-mono">d4data/biomedical-ner-all</span>
                <span className="hidden text-slate-500 xl:inline">·</span>
                <span className="hidden xl:inline">{statusLabel}</span>
              </div>
              <button
                ref={drawerBtnRef}
                onClick={() => setDrawer(true)}
                className="group relative isolate flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2 overflow-hidden whitespace-nowrap rounded-xl border-2 border-sky-700 bg-white px-4 text-sm font-semibold text-sky-800 shadow-sm transition-colors duration-500 hover:text-white focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 active:text-white motion-reduce:transition-none"
              >
                {/* Corner-fill: a sky ellipse slides in from the bottom-right corner on hover / keyboard focus and
                    floods the button; pressing darkens it instantly. Sits behind the label (isolate + -z-10). */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-full top-full -z-10 h-[150px] w-[calc(100%+120px)] rounded-full bg-sky-700 transition-[top,left] duration-700 will-change-[top,left] group-hover:-left-[60px] group-hover:-top-[30px] group-focus-visible:-left-[60px] group-focus-visible:-top-[30px] group-active:bg-sky-900 group-active:transition-none motion-reduce:transition-none"
                />
                <Workflow className="h-4 w-4 shrink-0" aria-hidden />
                How the NLP Pipeline Works
              </button>
            </div>
          </div>
        </header>
        {/* spacer: bar height + its top offset (top-5 = 20px) so nothing sits under the floating header */}
        <div aria-hidden style={{ height: barH + 20 }} />

        <PipelineDrawer open={drawer} onClose={closeDrawer} />
        <EntityTooltip tip={tip} />

        <main className="mx-auto max-w-[1400px] space-y-5 px-4 pt-5 sm:px-6">
          <p className="sr-only" aria-live="polite">
            {loading ? "Analyzing text" : result ? `${stats.total} entities shown` : ""}
          </p>

          {/* --------------------------- KPI tilt cards --------------------------- */}
          <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <TiltCard
              title="Entities Extracted"
              icon={Target}
              description={result ? `of ${result.total} detected` : "—"}
              className="bg-gradient-to-br from-sky-500/15 to-transparent"
            >
              <p className="font-mono text-3xl font-bold tracking-tight text-sky-950">
                <AnimatedNumber value={stats.total} />
              </p>
            </TiltCard>

            <TiltCard
              title="Dominant Category"
              icon={Layers}
              description={stats.dominant ? `${stats.counts[stats.dominant]} mentions` : "no entities"}
              className={cn("bg-gradient-to-br to-transparent", stats.dominant ? "from-emerald-500/15" : "from-slate-400/10")}
            >
              <p className="font-mono text-3xl font-bold tracking-tight text-sky-950">
                {stats.dominant ? <span className="text-xl leading-tight sm:text-2xl">{CATS[stats.dominant].label.split(" / ")[0]}</span> : <span>—</span>}
              </p>
            </TiltCard>

            <TiltCard
              title="Inference Speed"
              icon={Timer}
              price={result ? (result.engine === "fallback" ? "local" : "HF API") : undefined}
              badgeLabel={result ? (result.engine === "fallback" ? "offline" : "live") : undefined}
              badgeVariant={result?.engine === "fallback" ? "warning" : "success"}
              description={result ? (result.engine === "fallback" ? "local span-matcher" : "Hugging Face API") : "—"}
              className="bg-gradient-to-br from-amber-500/15 to-transparent"
            >
              <p className="font-mono text-3xl font-bold tracking-tight text-sky-950">
                {result ? <AnimatedNumber value={result.latency_ms} decimals={latencyDecimals} suffix=" ms" /> : <span>—</span>}
              </p>
            </TiltCard>

            <TiltCard
              title="Mean Confidence"
              icon={Gauge}
              description={`threshold ≥ ${threshold}%`}
              className="bg-gradient-to-br from-violet-500/15 to-transparent"
            >
              <p className="font-mono text-3xl font-bold tracking-tight text-sky-950">
                <AnimatedNumber value={stats.mean} decimals={1} suffix="%" />
              </p>
            </TiltCard>
          </section>

          {/* --------------------------- Filter bar --------------------------- */}
          <section aria-label="Entity filters" className="glass rounded-2xl p-4">
            <BlobKeyframes />
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">Entity categories</p>
                <div className="flex flex-wrap gap-2">
                  {CAT_ORDER.map((c, i) => (
                    <CategoryBlobToggle
                      key={c}
                      cat={c}
                      on={active[c]}
                      count={countsAtThreshold[c]}
                      index={i}
                      onToggle={() => setActive((a) => ({ ...a, [c]: !a[c] }))}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-end gap-4">
                <div className="min-w-[240px] flex-1 lg:w-72">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Confidence threshold</span>
                    <span className="rounded-md bg-sky-700 px-2 py-0.5 font-mono text-xs font-bold text-white">≥ {threshold}%</span>
                  </div>
                  <div
                    data-kbd={sliderKbd}
                    className="rounded-xl data-[kbd=true]:outline-2 data-[kbd=true]:outline-offset-4 data-[kbd=true]:outline-sky-700"
                    onPointerDownCapture={() => {
                      sliderPointer.current = true;
                    }}
                    onFocus={() => setSliderKbd(!sliderPointer.current)}
                    onKeyDownCapture={() => setSliderKbd(true)}
                    onBlur={() => {
                      sliderPointer.current = false;
                      setSliderKbd(false);
                    }}
                  >
                    <WakeSlider
                      value={threshold}
                      onChange={setThreshold}
                      min={50}
                      max={99}
                      step={1}
                      bars={32}
                      height={44}
                      restHeight={10}
                      gap={3}
                      fillColor="#0369a1"
                      trackColor="#cbd5e1"
                      crestColor="#38bdf8"
                      sensitivity={1}
                      reach={6}
                      skew={0.6}
                      glide={0.3}
                      smoothing={100}
                      formatValue={(v) => `${v} percent`}
                      ariaLabel="Confidence threshold"
                    />
                  </div>
                  <div className="flex justify-between font-mono text-xs text-slate-600">
                    <span>50%</span>
                    <span>99%</span>
                  </div>
                </div>
                <FuseButton
                  undoable={false}
                  submit={false}
                  icon={<RotateCcw strokeWidth={1.8} />}
                  label="Reset"
                  workingLabel="Resetting…"
                  doneLabel="Done"
                  status={{ working: "Resetting filters.", settled: "Filters reset to their defaults." }}
                  progressMs={600}
                  doneHoldMs={1400}
                  disabled={!filtersChanged}
                  onRun={async () => {
                    setThreshold(70);
                    setActive({ DISEASE: true, CHEMICAL: true, GENE: true, ANATOMY: true, PROCEDURE: true });
                    return true;
                  }}
                />
              </div>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-12">
            {/* ---------------------------- Left column ---------------------------- */}
            <div className="space-y-5 lg:col-span-7">
              {/* Input card */}
              <section aria-label="Text input" className="glass rounded-2xl p-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">Sample abstracts</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {SAMPLES.map((s) => {
                    const on = activeSample === s.id;
                    return (
                      <TiltCard
                        key={s.id}
                        title={s.label}
                        icon={s.icon}
                        description={s.field}
                        role="button"
                        tabIndex={0}
                        aria-pressed={on}
                        aria-label={`Load ${s.label} sample abstract: ${s.field}`}
                        onClick={() => pickSample(s.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            pickSample(s.id);
                          }
                        }}
                        tiltProps={{ rotationFactor: 13 }}
                        className={cn(
                          "min-h-[84px] cursor-pointer",
                          on ? "bg-sky-100/90 ring-2 ring-sky-600" : "ring-1 ring-sky-200"
                        )}
                      />
                    );
                  })}
                </div>

                <div className="mt-4 rounded-xl bg-white/60 p-3 ring-1 ring-sky-100">
                  <label htmlFor="pmid" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Fetch by PubMed PMID
                  </label>
                  <form
                    className="mt-1.5 flex flex-wrap gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      // an invalid PMID has nothing to fetch, so skip the fuse and show the validation message
                      if (!/^\d{1,9}$/.test(normalizePmid(pmid))) fetchPubMed(pmid);
                      else fetchBtn.current?.start(pmid);
                    }}
                  >
                    <div className="relative min-w-[200px] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 z-20 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                      <AnimatedField
                        id="pmid"
                        inputMode="numeric"
                        value={pmid}
                        onChange={(e) => setPmid(e.target.value)}
                        placeholder="e.g. 29151359"
                        className="min-h-[44px] w-full rounded-xl border border-sky-200 bg-white focus-within:outline focus-within:outline-2 focus-within:outline-sky-700"
                        fieldClassName="pl-9 pr-3 font-mono text-sm"
                      />
                    </div>
                    <FuseButton ref={fetchBtn} onRun={fetchPubMed} undoWindow={3000} disabled={pmidLoading || !pmid.trim()} externalBusy={pmidLoading} />
                  </form>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                    <span>Try:</span>
                    {EXAMPLE_PMIDS.map((p) => (
                      <button
                        key={p.pmid}
                        type="button"
                        onClick={() => {
                          fetchBtn.current?.cancel();
                          setPmid(p.pmid);
                          fetchPubMed(p.pmid);
                        }}
                        className="cursor-pointer rounded-md bg-white px-2 py-1 font-mono font-semibold text-sky-800 ring-1 ring-sky-200 transition hover:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
                      >
                        {p.pmid} <span className="font-sans font-medium text-slate-600">{p.label}</span>
                      </button>
                    ))}
                  </div>
                  {pmidMsg && (
                    <p
                      role={pmidMsg.kind === "error" ? "alert" : "status"}
                      className={cn("mt-2 flex items-start gap-1.5 text-sm font-medium", pmidMsg.kind === "error" ? "text-red-700" : "text-emerald-800")}
                    >
                      {pmidMsg.kind === "error" ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
                      {pmidMsg.text}
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  <label htmlFor="clinical-text" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Clinical text
                  </label>
                  <AnimatedField
                    multiline
                    id="clinical-text"
                    value={text}
                    maxLength={MAX_CHARS}
                    onChange={(e) => {
                      setText(e.target.value);
                      setActiveSample(null);
                    }}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analyze(text);
                    }}
                    rows={7}
                    placeholder="Paste a PubMed abstract or clinical note…"
                    className="mt-1.5 w-full rounded-xl border border-sky-200 bg-white focus-within:outline focus-within:outline-2 focus-within:outline-sky-700"
                    fieldClassName="p-3 text-sm leading-relaxed"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono text-xs text-slate-600">
                      {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} chars · {wordCount(text).toLocaleString()} words
                      <span className="ml-2 hidden text-slate-500 sm:inline">Ctrl/⌘ + Enter to run</span>
                    </p>
                    <div className="flex gap-2">
                      <ClearButton
                        onClear={() => {
                          setText("");
                          setActiveSample(null);
                        }}
                        disabled={!text}
                      />
                      <InteractiveHoverButton text="Run NER Analysis" loading={loading} onClick={() => analyze(text)} disabled={loading || !text.trim()} />
                    </div>
                  </div>
                </div>
              </section>

              {/* Annotated view */}
              <section aria-label="Annotated literature" className="glass rounded-2xl p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-base font-bold text-sky-950">
                    <Sparkles className="h-5 w-5 text-sky-700" aria-hidden />
                    Annotated Literature View
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700">
                    {CAT_ORDER.map((c) => (
                      <span key={c} className="flex items-center gap-1.5">
                        <span className={cn("h-2.5 w-2.5 rounded-full", CATS[c].dot)} aria-hidden />
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                {stale && (
                  <p className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 ring-1 ring-amber-300">
                    <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
                    The text was edited after the last analysis. Run NER again to refresh the highlights.
                  </p>
                )}
                {error && (
                  <p role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800 ring-1 ring-red-300">
                    <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
                    {error}
                  </p>
                )}
                {result?.fallback_reason && (
                  <p className="mb-3 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-900 ring-1 ring-sky-200">
                    <Activity className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {result.fallback_reason}
                  </p>
                )}

                <div className="relative rounded-xl bg-white/85 p-4 ring-1 ring-sky-100">
                  {loading && !result ? (
                    <div className="space-y-3" aria-busy="true">
                      {[92, 100, 84, 96, 70].map((w, i) => (
                        <div key={i} className="h-4 animate-pulse rounded bg-sky-100 motion-reduce:animate-none" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  ) : !result ? (
                    <p className="py-8 text-center text-sm text-slate-600">Run an analysis to see entities highlighted here.</p>
                  ) : (
                    <p className={cn("whitespace-pre-wrap text-[15px] leading-[2.5] text-slate-900 transition-opacity", loading && "opacity-50")}>
                      {segments.map((s, i) =>
                        s.ent ? (
                          <mark
                            key={i}
                            tabIndex={0}
                            aria-label={`${s.ent.word}, ${CATS[s.ent.entity_group].label}, confidence ${(s.ent.score * 100).toFixed(0)} percent, characters ${s.ent.start} to ${s.ent.end}`}
                            onMouseEnter={(e) => {
                              const r = e.currentTarget.getBoundingClientRect();
                              setTip({ ent: s.ent as Entity, x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
                            }}
                            onFocus={(e) => {
                              const r = e.currentTarget.getBoundingClientRect();
                              setTip({ ent: s.ent as Entity, x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
                            }}
                            onMouseLeave={() => setTip(null)}
                            onBlur={() => setTip(null)}
                            className={cn(
                              "box-decoration-clone cursor-help rounded-md px-1.5 py-[3px] font-semibold ring-1 ring-inset transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-700",
                              CATS[s.ent.entity_group].pill
                            )}
                          >
                            {s.text}
                            <span aria-hidden className="ml-1.5 align-middle font-mono text-[11px] font-bold uppercase tracking-tight opacity-75">
                              {s.ent.entity_group}
                            </span>
                          </mark>
                        ) : (
                          <span key={i}>{s.text}</span>
                        )
                      )}
                    </p>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-600">Hover or keyboard-focus any highlighted entity to inspect its span, type and confidence.</p>
              </section>
            </div>

            {/* ---------------------------- Right column ---------------------------- */}
            <div className="space-y-5 lg:col-span-5">
              <section aria-label="Entity distribution" className="glass rounded-2xl p-5">
                <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-sky-950">
                  <Activity className="h-5 w-5 text-sky-700" aria-hidden />
                  Entity Distribution
                </h2>
                <ul className="space-y-3.5">
                  {CAT_ORDER.map((c) => {
                    const n = stats.counts[c];
                    const pct = stats.total ? (n / stats.total) * 100 : 0;
                    const Icon = CATS[c].icon;
                    return (
                      <li key={c}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 font-semibold text-slate-900">
                            <Icon className="h-4 w-4 text-slate-600" aria-hidden />
                            {CATS[c].label}
                          </span>
                          <span className="font-mono text-xs text-slate-700">
                            <strong className="text-sm text-slate-900">{n}</strong> · {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`${CATS[c].label}: ${n} entities, ${pct.toFixed(0)} percent`}>
                          <motion.div
                            className={cn("h-full rounded-full", CATS[c].bar)}
                            initial={false}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {result && (
                  <p className="mt-4 border-t border-sky-100 pt-3 font-mono text-xs text-slate-600">
                    {result.word_count} words · {result.char_count} chars · engine: {result.engine}
                  </p>
                )}
              </section>

              <section aria-label="Entity confidence summary" className="glass rounded-2xl p-5">
                <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-sky-950">
                  <Gauge className="h-5 w-5 text-sky-700" aria-hidden />
                  Entity Confidence Summary
                </h2>
                <ul className="space-y-3.5">
                  {(
                    [
                      { key: "avg", label: "Average", pct: confidence ? confidence.mean : null, note: confidence ? `across ${stats.total} ${stats.total === 1 ? "entity" : "entities"}` : "", bar: "bg-sky-600" },
                      { key: "high", label: "Highest", pct: confidence ? confidence.high.score * 100 : null, note: confidence ? confidence.high.word : "", bar: "bg-emerald-600" },
                      { key: "low", label: "Lowest", pct: confidence ? confidence.low.score * 100 : null, note: confidence ? confidence.low.word : "", bar: "bg-amber-500" },
                    ] as { key: string; label: string; pct: number | null; note: string; bar: string }[]
                  ).map((r) => (
                    <li key={r.key}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-semibold text-slate-900">{r.label}</span>
                        <span className="font-mono text-sm font-bold text-slate-900">{r.pct === null ? "—" : `${r.pct.toFixed(1)}%`}</span>
                      </div>
                      <div
                        className="h-3 overflow-hidden rounded-full bg-slate-200"
                        role="img"
                        aria-label={r.pct === null ? `${r.label} confidence: no data` : `${r.label} confidence: ${r.pct.toFixed(1)} percent`}
                      >
                        <motion.div className={cn("h-full rounded-full", r.bar)} initial={false} animate={{ width: `${r.pct ?? 0}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
                      </div>
                      {r.note && <p className="mt-1 truncate font-mono text-xs text-slate-600">{r.note}</p>}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-sky-100 pt-3 font-mono text-xs text-slate-600">
                  {confidence
                    ? `Entities at ≥ ${threshold}% in the selected categories`
                    : result
                      ? `No entities at ≥ ${threshold}% in the selected categories`
                      : "Run an analysis to see confidence statistics"}
                </p>
              </section>
            </div>
          </div>

          {/* ------------------------------ Table ------------------------------ */}
          <section aria-label="Extracted entities table" className="glass rounded-2xl p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-bold text-sky-950">
                <Tags className="h-5 w-5 text-sky-700" aria-hidden />
                Extracted Entities
                <span className="rounded-md bg-sky-100 px-2 py-0.5 font-mono text-xs text-sky-900">{rows.length}</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <label htmlFor="table-search" className="sr-only">
                    Search extracted entities
                  </label>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                  <input
                    id="table-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search entities, types, tags…"
                    className="min-h-[44px] w-64 max-w-full rounded-xl border border-sky-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
                  />
                </div>
                <ExportZipButton
                  onExport={exportJSON}
                  disabled={rows.length === 0}
                  label="Export JSON"
                  icon={<FileJson className="h-4 w-4" aria-hidden />}
                  theme={JSON_ZIP_THEME}
                  doneStatus="JSON downloaded"
                />
                <ExportZipButton
                  onExport={exportCSV}
                  disabled={rows.length === 0}
                  label="Export CSV"
                  icon={<FileSpreadsheet className="h-4 w-4" aria-hidden />}
                  theme={CSV_ZIP_THEME}
                  doneStatus="CSV downloaded"
                />
              </div>
            </div>

            <div className="max-h-[420px] overflow-auto rounded-xl bg-white/85 ring-1 ring-sky-100">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-sky-50 text-xs uppercase tracking-wider text-slate-700">
                  <tr>
                    {(
                      [
                        ["word", "Entity"],
                        ["entity_group", "Category"],
                        ["start", "Span [start:end]"],
                        ["score", "Confidence"],
                      ] as [SortKey, string][]
                    ).map(([key, label]) => (
                      <th key={key} scope="col" className="px-4 py-2.5 font-bold" aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <button
                          type="button"
                          onClick={() => toggleSort(key)}
                          className="flex min-h-[32px] cursor-pointer items-center gap-1 uppercase tracking-wider focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
                        >
                          {label}
                          <ArrowUpDown className={cn("h-3.5 w-3.5", sort.key === key ? "text-sky-700" : "text-slate-400")} aria-hidden />
                        </button>
                      </th>
                    ))}
                    <th scope="col" className="px-4 py-2.5 font-bold">
                      Raw tag
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-600">
                        {result ? "No entities match the current filters or search." : "Results will appear here after analysis."}
                      </td>
                    </tr>
                  ) : (
                    rows.map((e) => (
                      <tr key={`${e.start}-${e.end}`} className="border-t border-sky-100 transition-colors hover:bg-sky-50/70">
                        <td className="px-4 py-2 font-semibold text-slate-900">{e.word}</td>
                        <td className="px-4 py-2">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", CATS[e.entity_group].badge)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", CATS[e.entity_group].dot)} aria-hidden />
                            {e.entity_group}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-slate-800">
                          [{e.start}:{e.end}]
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200" aria-hidden>
                              <div className={cn("h-full rounded-full", CATS[e.entity_group].bar)} style={{ width: `${e.score * 100}%` }} />
                            </div>
                            <span className="font-mono text-xs font-semibold text-slate-900">{(e.score * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-slate-700">{e.raw_label}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-600">Exports include the {rows.length} rows currently shown (filters, threshold and search applied).</p>
          </section>

          <footer className="pt-2 text-center text-xs text-slate-600">
            BioNER Studio · NLP course project · For education and research demonstration only, not for clinical decision-making.
          </footer>
        </main>
      </div>
    </MotionConfig>
  );
}