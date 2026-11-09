// Styl marki Dariusza Młynarskiego przełożony na kadr pionowy.
// Źródło: 3-DM/About/Branding/Identyfikacja-Wizualna.md — ciemne tło, pomarańcz #fc5400,
// Schibsted Grotesk Black w nagłówkach, Figtree w treści (od 05.11.2026), Montserrat w napisach na wideo.
import { loadFont as loadFigtree } from "@remotion/google-fonts/Figtree";
import { loadFont as loadSchibsted } from "@remotion/google-fonts/SchibstedGrotesk";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

const figtree = loadFigtree("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin", "latin-ext"],
});
// Tylko Black: nagłówki bez podanej grubości też dostają 900, jak dawniej jedyną grubość Archivo Black.
const schibsted = loadSchibsted("normal", { weights: ["900"], subsets: ["latin", "latin-ext"] });
const montserrat = loadMontserrat("normal", {
  weights: ["600", "700", "800"],
  subsets: ["latin", "latin-ext"],
});

export const CZCIONKA = {
  tekst: figtree.fontFamily,
  naglowek: schibsted.fontFamily,
  /** Dopiski i etykiety. U DM nie ma odręcznego kroju — tech/flat, nie notatnik. */
  odreczna: montserrat.fontFamily,
  /** Napisy na wideo zostają na Montserracie (decyzja 01.09.2026). */
  napisy: montserrat.fontFamily,
  kod: "Menlo, 'SF Mono', Consolas, monospace",
};

export const KOLOR = {
  /** Baza kadru: ciemna czekolada z konwencji grafik DM. */
  paper: "#1E110A",
  paper2: "#120A05",
  card: "#202020",
  ink: "#FFFFFF",
  inkSoft: "#E8E2DC",
  muted: "#9C938A",
  line: "#3A2E24",
  lineStrong: "#574636",
  accent: "#FC5400",
  /** Wypełnienie akcentowe na ciemnym: przygaszony pomarańcz, nie pastel. */
  accentSoft: "#3A1B08",
  /** Marką jest ciemna zieleń #1a5c2a, ale na ciemnym tle znika — tu jaśniejszy wariant. */
  green: "#3FAE5A",
  greenSoft: "#10240F",
  red: "#FF5A4E",
  redSoft: "#2A0F0C",
  /** Jądro poświaty z tła grafik DM. */
  poswiata: "#965A30",
};

// Kadr
export const SZEROKOSC = 1080;
export const WYSOKOSC = 1920;
export const FPS = 30;
export const SRODEK_X = SZEROKOSC / 2;

/**
 * Bezpieczne pole kadru. Górne 250 px i dolne 360 px zasłania interfejs
 * TikToka, Reels i Shorts, więc treść może żyć tylko między nimi.
 */
export const SAFE = { gora: 250, dol: 1560 };
export const MARGINES = 80;

// Kształty
export const PROMIEN = 38;
export const PROMIEN_MALY = 26;
export const RAMKA = 2;

/**
 * Cień dwuwarstwowy: bliski styku i daleki od otoczenia. Na ciemnym tle czarny cień
 * nie istnieje, więc dalszą warstwę niesie ciepła poświata (#965A30) z konwencji grafik.
 */
export const CIEN_KARTY = "0 3px 8px rgba(0,0,0,.55), 0 16px 52px rgba(150,90,48,.16)";
export const CIEN_UNIESIONY = "0 8px 18px rgba(0,0,0,.6), 0 38px 96px rgba(150,90,48,.24)";
/** Cień przesunięty bez rozmycia, w kolorze akcentu. Sygnatura marki na przyciskach. */
export const CIEN_NAKLEJKI = "8px 8px 0 rgba(252,84,0,.38)";
/** Ten sam cień wciśnięty — przycisk w makiecie po kliknięciu. */
export const CIEN_NAKLEJKI_WCISNIETY = "2px 2px 0 rgba(252,84,0,.38)";

/** Skala pisma dla kadru 1080 px. */
export const PISMO = {
  liczba: 210,
  naglowekDuzy: 96,
  naglowek: 76,
  naglowekMaly: 62,
  cta: 64,
  chip: 52,
  tytulKarty: 48,
  tresc: 40,
  kicker: 36,
  meta: 32,
  kod: 32,
  drobne: 26,
};

/** Odstęp między osobnymi elementami sceny. Nic nie może się dotykać. */
export const ODSTEP = 60;
/** Zapas tekstu od krawędzi kafelka. */
export const ZAPAS_W_KAFELKU = 30;

// Tło
export const SIATKA_PX = 54;
export const SIATKA_DRYF_PX_S = 16;
/** Kratka na ciemnym tle musi być jaśniejsza od tła, nie ciemniejsza. */
export const SIATKA_KOLOR = "rgba(255,255,255,0.055)";
/** Poświata pod treścią — odpowiednik jądra z `tlo-czekolada-poswiata.png`. */
export const POSWIATA_TLA =
  "radial-gradient(120% 70% at 50% 34%, rgba(150,90,48,.34) 0%, rgba(150,90,48,.10) 42%, rgba(0,0,0,0) 72%)";

/** Podpis marki u góry kadru. */
export const PODPIS_MARKI = "DARIUSZ MŁYNARSKI";
/** Adres w makietach przeglądarki i w CTA, gdy rolka odsyła pod konkretny URL. */
export const DOMENA = "dariuszmlynarski.pl";
/** Domyślne wezwanie na ostatniej scenie — rolki kierują na profil, nie na stronę. */
export const CTA_PRZYCISK = "Obserwuj po więcej";
