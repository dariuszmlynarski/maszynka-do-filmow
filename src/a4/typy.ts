// Ścieżka explainer (A4): Dariusz mówi do kamery, obraz dopasowuje się do jego słów.
// Odwrotność rolki: tam tekst → głos → obraz, tu nagranie → transkrypt → plan scen → obraz.
import type { Slowo } from "../typy";

export const A4_FPS = 30;
export const A4_SZER = 1920;
export const A4_WYS = 1080;

/** Wymiary kadru explainera: domyślnie poziom (YouTube), na życzenie pion (Reels, Shorts). */
export const wymiaryA4 = (format: "pion" | "poziom" | undefined) => (format === "pion" ? { szer: 1080, wys: 1920 } : { szer: A4_SZER, wys: A4_WYS });

/** Plik wideo w folderze projektu (po konwersji na stałe 30 kl./s i H.264). */
export type Zrodlo = {
  plik: string; // względem folderu projektu, np. zrodlo/kamera.mp4
  czas: number; // sekundy
  szer: number;
  wys: number;
  nazwa?: string; // nazwa pliku, który wgrał użytkownik
};

/** Fragment surówki, który zostaje w filmie (czas źródła, sekundy). */
export type Odcinek = { od: number; do: number };

/** Słowo transkryptu w czasie surówki. */
export type SlowoZrodla = { tekst: string; start: number; koniec: number };

/**
 * Układ kadru, czyli gdzie stoi twarz, a gdzie grafika.
 * `ekran` i `ekran-okienko` pokazują drugie źródło (Zoom, prezentacja).
 */
export const UKLADY = ["twarz", "okienko", "podzial", "grafika", "ekran", "ekran-okienko"] as const;
export type Uklad = (typeof UKLADY)[number];

export const NAZWY_UKLADOW: Record<Uklad, string> = {
  twarz: "Twarz na pełnym ekranie",
  okienko: "Grafika, twarz w okienku",
  podzial: "Podział: twarz i grafika",
  grafika: "Sama grafika, Twój głos",
  ekran: "Nagranie ekranu na pełnym",
  "ekran-okienko": "Nagranie ekranu, twarz w okienku",
};

/**
 * Klocki: skończony inwentarz, z którego składa się każdą scenę. Kolory i ruch siedzą w klockach,
 * więc plan może je dowolnie łączyć, a marka trzyma się sama. Nowe sceny to nowe kombinacje, nie nowy kod.
 */
export const TYPY_KLOCKOW = [
  "naglowek",
  "etykieta",
  "kafel",
  "lista",
  "licznik",
  "pasek",
  "strzalka",
  "podswietlenie",
  "cytat",
  "ikona",
  "obraz",
  "siatka",
  "linia-czasu",
  "porownanie",
] as const;
export type TypKlocka = (typeof TYPY_KLOCKOW)[number];

export type Klocek = {
  id: string;
  typ: TypKlocka;
  /** Słowo (albo jego początek), przy którym klocek wchodzi. Bez niego klocki wchodzą po kolei. */
  wejscie?: string;
  tekst?: string;
  akcent?: string; // fragment `tekst` w kolorze marki (naglowek, podswietlenie)
  podpis?: string;
  ikona?: string; // emoji albo logo:claude
  wartosc?: number; // licznik, pasek (0–100)
  prefiks?: string;
  sufiks?: string;
  punkty?: string[]; // lista, siatka, linia-czasu
  lewo?: { naglowek: string; punkty: string[] };
  prawo?: { naglowek: string; punkty: string[] };
  src?: string; // obraz: plik w folderze projektu albo logo:nazwa
};

export type PrzejscieA4 = "auto" | "swist" | "brak";

/** Scena = jedno zdanie (czasem dwa krótkie). Czasy w osi gotowego filmu. */
export type ScenaA4 = {
  id: string;
  od: number;
  do: number;
  tekst: string; // co Dariusz mówi w tej scenie
  uklad: Uklad;
  klocki: Klocek[];
  /** Jedno zdanie po ludzku: co widać. Edytujesz je, gdy chcesz, żeby Claude przebudował scenę. */
  opis?: string;
  przejscie?: PrzejscieA4;
};

export type Muzyka = { plik: string; glosnosc: number; opis?: string };

export type DaneA4 = {
  kamera?: Zrodlo;
  /** Drugie źródło. `przesuniecie`: sekunda nagrania ekranu = sekunda kamery + przesuniecie. */
  ekran?: Zrodlo & { przesuniecie: number; pewnosc?: number };
  slowa?: SlowoZrodla[];
  odcinki?: Odcinek[];
  /** Ile sekund wycięło czyszczenie i z jakiego powodu — do raportu w dashboardzie. */
  raport?: string;
  sceny: ScenaA4[];
  muzyka?: Muzyka;
  swisty?: boolean;
  /** Film zakładany od razu z nagraniem ekranu: dashboard otwiera sekcję drugiego źródła. */
  zEkranem?: boolean;
};

// ---- Oś czasu: surówka → gotowy film ----

export type OdcinekWOsi = Odcinek & { klatkaWyjscia: number; klatki: number };

/** Odcinki ułożone jeden za drugim, policzone w klatkach, żeby nic nie dryfowało przy zaokrągleniach. */
export function osOdcinkow(odcinki: Odcinek[] | undefined, fps = A4_FPS): OdcinekWOsi[] {
  let klatka = 0;
  return (odcinki ?? []).map((o) => {
    const klatki = Math.max(1, Math.round(o.do * fps) - Math.round(o.od * fps));
    const wynik = { ...o, klatkaWyjscia: klatka, klatki };
    klatka += klatki;
    return wynik;
  });
}

export function klatkiFilmu(dane: DaneA4 | undefined, fps = A4_FPS): number {
  const os = osOdcinkow(dane?.odcinki, fps);
  const ostatni = os[os.length - 1];
  return ostatni ? ostatni.klatkaWyjscia + ostatni.klatki : fps * 5;
}

/** Sekunda surówki → sekunda gotowego filmu (albo null, gdy ten moment wycięto). */
export function naWyjscie(t: number, os: OdcinekWOsi[], fps = A4_FPS): number | null {
  for (const o of os) {
    if (t >= o.od - 1e-3 && t <= o.do + 1e-3) return o.klatkaWyjscia / fps + Math.min(t, o.do) - o.od;
  }
  return null;
}

/** Sekunda gotowego filmu → sekunda surówki. */
export function naZrodlo(t: number, os: OdcinekWOsi[], fps = A4_FPS): number {
  for (const o of os) {
    const start = o.klatkaWyjscia / fps;
    if (t < start + o.klatki / fps) return o.od + Math.max(0, t - start);
  }
  const ostatni = os[os.length - 1];
  return ostatni ? ostatni.do : t;
}

/** Słowa w czasie gotowego filmu. Słowo, którego środek wycięto, znika razem z cięciem. */
export function slowaFilmu(dane: DaneA4 | undefined, fps = A4_FPS): Slowo[] {
  if (!dane?.slowa?.length) return [];
  const os = osOdcinkow(dane.odcinki, fps);
  const wynik: Slowo[] = [];
  for (const w of dane.slowa) {
    const srodek = (w.start + w.koniec) / 2;
    const odc = os.find((o) => srodek >= o.od && srodek <= o.do);
    if (!odc) continue;
    const baza = odc.klatkaWyjscia / fps - odc.od;
    wynik.push({ tekst: w.tekst, start: baza + Math.max(w.start, odc.od), koniec: baza + Math.min(w.koniec, odc.do) });
  }
  return wynik;
}

export const normujSlowo = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
