// Wspólne klocki serii filmów strefy partnera CNW (16:9): paleta, nagłówek sceny, napisy karaoke,
// awatar w kółku i synchronizacja animacji ze słowami lektora. Każdy film ma własny os.json
// (sceny z czasem startu i słowami) — `zrobFilm(os)` zwraca narzędzia związane z tym plikiem.
import React from "react";
import { AbsoluteFill, Easing, OffthreadVideo, interpolate, spring, useCurrentFrame } from "remotion";
import { CZCIONKA } from "../marka";

export const FPS = 30;
export const SZER = 1920;
export const WYS = 1080;

export const K = {
  bg: "#F4F9F3",
  card: "#FFFFFF",
  ink: "#16211A",
  mut: "#5D6B61",
  line: "#DDE7DC",
  a: "#19A020",
  ad: "#137A18",
  tint: "#E9F4E7",
  warn: "#B7791F",
  warnT: "#FDF3E1",
  dark: "#0E2412",
};

export type Slowo = { tekst: string; start: number; koniec: number };
export type Sc = { id: string; start: number; czas: number; slowa: Slowo[] };
export type Os = { sceny: Sc[]; calosc: number };

export const useT = () => useCurrentFrame() / FPS;

/** 0→1 od chwili t0 (s), łagodnie. */
export const useP = (t0: number, dlug = 0.45) => {
  const t = useT();
  return interpolate(t, [t0, t0 + dlug], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
};
export const useSpr = (t0: number, damping = 14) => {
  const f = useCurrentFrame();
  return spring({ frame: f - Math.round(t0 * FPS), fps: FPS, config: { damping, stiffness: 120 } });
};

/** Kolory napisów karaoke: tło paska i kolor słów już wypowiedzianych. Domyślnie CNW. */
export type StylNapisow = { tlo: string; akcent: string };

export function zrobFilm(os: Os, styl: StylNapisow = { tlo: "rgba(14,36,18,.88)", akcent: "#7EE08A" }) {
  const SC = os.sceny;
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\d-]/gu, "");
  /** Globalny czas (s), w którym w scenie pada słowo zaczynające się od `rdzen` (`ktore` = które wystąpienie). */
  const kiedy = (id: string, rdzen: string, ktore = 0) => {
    const s = SC.find((x) => x.id === id)!;
    const hit = s.slowa.filter((w) => norm(w.tekst).startsWith(rdzen))[ktore];
    return s.start + (hit ? hit.start : 0);
  };
  const start = (id: string) => SC.find((x) => x.id === id)!.start;
  const zakres = (id: string) => {
    const i = SC.findIndex((x) => x.id === id);
    const nast = SC[i + 1];
    return { od: i === 0 ? 0 : SC[i].start - 0.3, do: nast ? nast.start - 0.3 : os.calosc };
  };

  const Scena: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
    const t = useT();
    const z = zakres(id);
    if (t < z.od - 0.01 || t > z.do + 0.35) return null;
    const op = Math.min(
      interpolate(t, [z.od, z.od + 0.35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      interpolate(t, [z.do, z.do + 0.35], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    );
    const y = interpolate(t, [z.od, z.od + 0.5], [24, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
    return <AbsoluteFill style={{ opacity: op, transform: `translateY(${y}px)` }}>{children}</AbsoluteFill>;
  };

  type Linia = { slowa: Slowo[]; od: number; do: number };
  const LINIE: Linia[] = [];
  for (const s of SC) {
    let cur: Slowo[] = [];
    let len = 0;
    const flush = () => {
      if (cur.length) LINIE.push({ slowa: cur, od: cur[0].start, do: cur[cur.length - 1].koniec });
      cur = [];
      len = 0;
    };
    for (const w of s.slowa) {
      if (len + w.tekst.length > 46) flush();
      cur.push({ tekst: w.tekst, start: s.start + w.start, koniec: s.start + w.koniec });
      len += w.tekst.length + 1;
      if (/[.?!:]$/.test(w.tekst) && len > 18) flush();
    }
    flush();
  }
  const Napisy: React.FC = () => {
    const t = useT();
    const i = LINIE.findIndex((l, j) => t >= l.od - 0.05 && t < (LINIE[j + 1]?.od ?? l.do + 0.6) - 0.05);
    if (i < 0) return null;
    const l = LINIE[i];
    if (t > l.do + 0.8) return null;
    return (
      <div style={{ position: "absolute", left: 120, right: 520, bottom: 64, display: "flex" }}>
        <div style={{ background: styl.tlo, borderRadius: 16, padding: "14px 24px", fontFamily: CZCIONKA.napisy, fontWeight: 700, fontSize: 36, lineHeight: 1.25, color: "#fff" }}>
          {l.slowa.map((w, j) => (
            <span key={j} style={{ color: t >= w.start ? styl.akcent : "#FFFFFF" }}>{w.tekst} </span>
          ))}
        </div>
      </div>
    );
  };

  return { kiedy, start, zakres, Scena, Napisy, klatki: Math.ceil(os.calosc * FPS) };
}

export const Naglowek: React.FC<{ eyebrow: string; tytul: string; kolor?: string; tusz?: string }> = ({ eyebrow, tytul, kolor = K.a, tusz = K.ink }) => (
  <div style={{ position: "absolute", left: 120, top: 92 }}>
    <div style={{ fontFamily: CZCIONKA.tekst, fontWeight: 800, fontSize: 24, letterSpacing: "0.16em", textTransform: "uppercase", color: kolor, marginBottom: 12 }}>{eyebrow}</div>
    <div style={{ fontFamily: CZCIONKA.tekst, fontWeight: 800, fontSize: 64, letterSpacing: "-0.02em", color: tusz, lineHeight: 1.08, maxWidth: 1300 }}>{tytul}</div>
  </div>
);

/** Plakietka disclosure nad kółkiem awatara (AI Act art. 50.4, `rules/content.md` § Oznaczanie AI) — przez cały film. */
export const PlakietkaAI: React.FC<{ p: number; tlo?: string }> = ({ p, tlo = K.dark }) => (
  <div style={{ position: "absolute", right: 90, bottom: 470, width: 376, display: "flex", justifyContent: "center", opacity: p }}>
    <div style={{ fontFamily: CZCIONKA.tekst, fontWeight: 700, fontSize: 22, letterSpacing: "0.04em", color: K.card, background: tlo, borderRadius: 999, padding: "8px 20px", boxShadow: "0 8px 24px rgba(14,36,18,.22)" }}>Cyfrowy awatar AI</div>
  </div>
);

/** Awatar HeyGen w kółku w prawym dolnym rogu (kadr dopasowany do looku „Office Desk 1”). */
/** `ramka` i `tlo` domyślnie w barwach CNW; film innej marki podaje swoje. */
export const Awatar: React.FC<{ src: string; ramka?: string; tlo?: string }> = ({ src, ramka = K.a, tlo = K.dark }) => {
  const f = useCurrentFrame();
  const p = spring({ frame: f - 4, fps: FPS, config: { damping: 200 } });
  const D = 360;
  return (
    <>
    <PlakietkaAI p={p} tlo={tlo} />
    <div style={{ position: "absolute", right: 90, bottom: 70, width: D, height: D, borderRadius: 999, overflow: "hidden", border: `8px solid ${K.card}`, boxShadow: `0 0 0 4px ${ramka}, 0 24px 60px rgba(14,36,18,.28)`, transform: `scale(${0.8 + 0.2 * p})`, opacity: p, background: tlo }}>
      <OffthreadVideo src={src} muted style={{ position: "absolute", height: 520, left: "50%", top: -18, transform: "translateX(-50%)" }} />
    </div>
    </>
  );
};

export const tekst = (size: number, weight = 700, color: string = K.ink): React.CSSProperties => ({ fontFamily: CZCIONKA.tekst, fontSize: size, fontWeight: weight, color, lineHeight: 1.2 });

/** Treść sceny w powiększeniu 1.2 — współrzędne w „małych” pikselach (100 → 120 w kadrze). Nagłówek zostaje poza nią. */
export const Tresc: React.FC<{ children: React.ReactNode }> = ({ children }) => <div style={{ position: "absolute", inset: 0, zoom: 1.2 }}>{children}</div>;
export const OBSZAR: React.CSSProperties = { position: "absolute", left: 100, right: 430, top: 250 };
