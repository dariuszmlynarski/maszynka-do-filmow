// Układy kadru 16:9: gdzie stoi kamera, gdzie nagranie ekranu, gdzie klocki.
// Prostokąty w pikselach kadru 1920×1080. Zmiana układu między scenami to płynne przejście tych prostokątów.
import type { Uklad } from "./typy";

export type Prostokat = { x: number; y: number; w: number; h: number; r: number; widoczny: number };

const UKRYTY = (p: Prostokat): Prostokat => ({ ...p, widoczny: 0 });

/** Okienko z twarzą w prawym dolnym rogu — kółko, jak awatar w filmach strefy partnera. */
const OKIENKO: Prostokat = { x: 1450, y: 560, w: 400, h: 400, r: 200, widoczny: 1 };
const PELNY: Prostokat = { x: 0, y: 0, w: 1920, h: 1080, r: 0, widoczny: 1 };

/** Pas na napisy u dołu kadru. Klocki nie wchodzą niżej niż jego górna krawędź. */
export const GORA_NAPISOW = 930;

export type Kadr = { kamera: Prostokat; ekran: Prostokat; klocki: Prostokat | null; tloKlockow: boolean };

/**
 * `pionowa`: nagranie z telefonu trzymanego pionowo. Na pełnym ekranie 16:9 zostałoby z niego samo czoło,
 * więc twarz staje w kolumnie na środku, a po bokach widać tło marki.
 */
export function kadr(uklad: Uklad, pionowa = false, format: "pion" | "poziom" = "poziom"): Kadr {
  if (format === "pion") return kadrPion(uklad);
  switch (uklad) {
    case "twarz":
      // Twarz gra główną rolę; klocki najwyżej jako mała plansza w lewym dolnym rogu, nad napisami.
      return {
        kamera: pionowa ? { x: 656, y: 0, w: 608, h: 1080, r: 0, widoczny: 1 } : PELNY,
        ekran: UKRYTY(PELNY),
        klocki: pionowa ? { x: 70, y: 120, w: 540, h: 770, r: 28, widoczny: 1 } : { x: 90, y: 330, w: 860, h: 560, r: 28, widoczny: 1 },
        tloKlockow: true,
      };
    case "okienko":
      return { kamera: OKIENKO, ekran: UKRYTY(PELNY), klocki: { x: 110, y: 90, w: 1280, h: 820, r: 0, widoczny: 1 }, tloKlockow: false };
    case "podzial":
      return { kamera: { x: 0, y: 0, w: 860, h: 1080, r: 0, widoczny: 1 }, ekran: UKRYTY(PELNY), klocki: { x: 960, y: 110, w: 870, h: 790, r: 0, widoczny: 1 }, tloKlockow: false };
    case "grafika":
      return { kamera: UKRYTY(OKIENKO), ekran: UKRYTY(PELNY), klocki: { x: 170, y: 90, w: 1580, h: 820, r: 0, widoczny: 1 }, tloKlockow: false };
    case "ekran":
      return { kamera: UKRYTY(OKIENKO), ekran: PELNY, klocki: null, tloKlockow: false };
    case "ekran-okienko":
      return { kamera: OKIENKO, ekran: { x: 60, y: 60, w: 1360, h: 765, r: 24, widoczny: 1 }, klocki: null, tloKlockow: false };
  }
}

// ---- Pion 1080×1920 (Reels, Shorts) ----
// Bezpieczne pole jak w rolkach: górne 250 px i dolne 360 px zasłania interfejs aplikacji, napisy stoją tuż nad dolnym.

const PELNY_PION: Prostokat = { x: 0, y: 0, w: 1080, h: 1920, r: 0, widoczny: 1 };
const OKIENKO_PION: Prostokat = { x: 340, y: 1000, w: 400, h: 400, r: 200, widoczny: 1 };
const EKRAN_PION: Prostokat = { x: 0, y: 560, w: 1080, h: 608, r: 0, widoczny: 1 };

function kadrPion(uklad: Uklad): Kadr {
  switch (uklad) {
    case "twarz":
      return { kamera: PELNY_PION, ekran: UKRYTY(EKRAN_PION), klocki: { x: 60, y: 880, w: 960, h: 500, r: 28, widoczny: 1 }, tloKlockow: true };
    case "okienko":
      return { kamera: OKIENKO_PION, ekran: UKRYTY(EKRAN_PION), klocki: { x: 70, y: 260, w: 940, h: 700, r: 0, widoczny: 1 }, tloKlockow: false };
    case "podzial":
      return { kamera: { x: 0, y: 0, w: 1080, h: 960, r: 0, widoczny: 1 }, ekran: UKRYTY(EKRAN_PION), klocki: { x: 70, y: 1000, w: 940, h: 400, r: 0, widoczny: 1 }, tloKlockow: false };
    case "grafika":
      return { kamera: UKRYTY(OKIENKO_PION), ekran: UKRYTY(EKRAN_PION), klocki: { x: 70, y: 260, w: 940, h: 1120, r: 0, widoczny: 1 }, tloKlockow: false };
    case "ekran":
      return { kamera: UKRYTY(OKIENKO_PION), ekran: EKRAN_PION, klocki: null, tloKlockow: false };
    case "ekran-okienko":
      return { kamera: OKIENKO_PION, ekran: { x: 0, y: 260, w: 1080, h: 608, r: 0, widoczny: 1 }, klocki: null, tloKlockow: false };
  }
}

/** Czy układ ma miejsce na klocki. Przy nagraniu ekranu obraz niesie samo nagranie. */
export const maKlocki = (uklad: Uklad) => kadr(uklad).klocki !== null;

export function mieszaj(a: Prostokat, b: Prostokat, p: number): Prostokat {
  const m = (x: number, y: number) => x + (y - x) * p;
  // Ukryty prostokąt nie podróżuje przez kadr: chowa się i pojawia w miejscu docelowym.
  if (a.widoczny === 0) return { ...b, widoczny: b.widoczny * p };
  if (b.widoczny === 0) return { ...a, widoczny: a.widoczny * (1 - p) };
  return { x: m(a.x, b.x), y: m(a.y, b.y), w: m(a.w, b.w), h: m(a.h, b.h), r: m(a.r, b.r), widoczny: m(a.widoczny, b.widoczny) };
}
