// Format scenariusza rolki. Ten sam plik czyta dashboard, serwer i Remotion.

import type { DaneA4 } from "./a4/typy";

export type Slowo = {
  tekst: string;
  start: number; // sekundy od początku sceny
  koniec: number;
};

export type AudioSceny = {
  plik: string; // ścieżka względem folderu projektu, np. audio/s1.mp3
  czas: number; // długość w sekundach
  slowa: Slowo[];
  hash: string; // skrót tekstu lektora, dla którego wygenerowano audio
  /** Skąd głos: własne nagranie Dariusza pocięte na sceny. Brak pola = ElevenLabs. */
  zrodlo?: "nagranie";
};

export type EfektAudio = {
  plik: string;
  hash: string;
};

export type Punkt = {
  ikona?: string;
  tekst: string;
  /** Wyróżnienie kafelka: czerwony błąd albo zielone powodzenie. */
  stan?: "blad" | "ok";
  /** Mała pieczątka przy kafelku, np. „error”. */
  etykieta?: string;
};

export type Ksztalt3D = "kostki" | "kula" | "torus" | "pierscienie" | "kartki";

export type Ekran =
  | { typ: "tytul"; naglowek: string; akcent?: string; dopisek?: string; etykieta?: string }
  | {
      typ: "lista";
      naglowek?: string;
      punkty: Punkt[];
      /** Czym połączone są kafelki: kropkowaną linią, strzałką, albo niczym. */
      polaczenie?: "kropki" | "strzalka" | "brak";
      /** Czy kafelki mają cały czas delikatnie pulsować. */
      pulsujace?: boolean;
    }
  | { typ: "karta"; ikona?: string; etykieta?: string; naglowek: string; tekst?: string }
  | { typ: "liczba"; wartosc: number; prefiks?: string; sufiks?: string; podpis: string }
  | {
      typ: "porownanie";
      lewo: { naglowek: string; punkty: string[]; zle?: boolean };
      prawo: { naglowek: string; punkty: string[]; zle?: boolean };
    }
  | {
      typ: "wykres";
      /** Słupki do porównań między rzeczami, linia do zmiany jednej rzeczy w czasie. */
      rodzaj: "slupki" | "linia";
      naglowek?: string;
      podpis?: string;
      /** Jednostka doklejana do wartości na wykresie, np. „%". */
      sufiks?: string;
      punkty: { etykieta: string; wartosc: number; wyroznij?: boolean }[];
    }
  | { typ: "cta"; naglowek: string; przycisk: string; dopisek?: string }
  | {
      typ: "3d";
      ksztalt: Ksztalt3D;
      naglowek: string;
      etykieta?: string;
      dopisek?: string;
    }
  | { typ: "kod"; tytul?: string; linie: string[]; naglowek?: string }
  | {
      typ: "telefon";
      naglowek?: string;
      etykieta?: string;
      tytulEkranu?: string;
      powiadomienie?: { tytul: string; tekst: string };
      wiersze?: { ikona?: string; tytul: string; podtytul?: string }[];
      przycisk?: string;
    }
  | {
      typ: "czat";
      naglowek?: string;
      etykieta?: string;
      rozmowca?: string;
      wiadomosci: { odNas?: boolean; tekst: string }[];
    }
  | {
      typ: "przegladarka";
      naglowek?: string;
      etykieta?: string;
      adres: string;
      tytulStrony: string;
      opis?: string;
      obrazTekst?: string;
      przycisk?: string;
    }
  | {
      typ: "formularz";
      naglowek?: string;
      etykieta?: string;
      tytul?: string;
      pola: { etykieta: string; wartosc: string }[];
      przycisk: string;
      potwierdzenie?: string;
      dopisek?: string;
    };

export type TypEkranu = Ekran["typ"];

/**
 * Wszystkie typy ekranów w jednym miejscu.
 * Każdy, kto sprawdza poprawność sceny, korzysta z tej listy, żeby się nie rozjechać.
 */
export const TYPY_EKRANOW = [
  "tytul",
  "lista",
  "karta",
  "liczba",
  "porownanie",
  "cta",
  "wykres",
  "3d",
  "kod",
  "telefon",
  "czat",
  "przegladarka",
  "formularz",
] as const satisfies readonly TypEkranu[];

export function czyZnanyTyp(typ: unknown): typ is TypEkranu {
  return typeof typ === "string" && (TYPY_EKRANOW as readonly string[]).includes(typ);
}

export type Przejscie = "fade" | "slide" | "wipe" | "brak";

export type Scena = {
  id: string;
  lektor: string; // co mówi lektor
  opis?: string; // co widać na ekranie, ludzkim językiem (edytuje użytkownik, Claude zamienia na `ekran`)
  ekran: Ekran; // co widać (struktura techniczna)
  przejscie?: Przejscie; // przejście DO następnej sceny (domyślnie fade)
  efekt?: string; // opis efektu dźwiękowego do wygenerowania, np. "krótki whoosh"
  minCzas?: number; // minimalna długość sceny w sekundach
  /** Bryły 3D przygaszone w tle, pod treścią. Dodaje głębi scenom, które inaczej są płaskie. */
  tlo3d?: Ksztalt3D;
  audio?: AudioSceny;
  efektAudio?: EfektAudio;
};

export type StatusProjektu = "scenariusz" | "lektor" | "gotowe";

export type Scenariusz = {
  id: string;
  /** Rodzaj projektu: rolka z tekstu (domyślnie) albo explainer z nagrania kamery (ścieżka A4). */
  typ?: "rolka" | "explainer";
  /** Pion 9:16 (Reels, Shorts) albo poziom 16:9 (YouTube). Brak = domyślny dla rodzaju: rolka w pionie, explainer w poziomie. */
  format?: "pion" | "poziom";
  /** Rolka: kto mówi. "nagranie" = Dariusz nagrywa scenariusz sam, „lektor” (domyślnie) = klon ElevenLabs. */
  glos?: "lektor" | "nagranie";
  tytul: string;
  zrodlo?: string; // link lub opis pomysłu
  /** Rekord planu social media, z którego powstała rolka (ścieżka względem folderu postów, bez .md). */
  rekord?: string;
  docelowaDlugosc: number; // sekundy
  status: StatusProjektu;
  utworzono: string;
  zmieniono: string;
  napisy: boolean;
  uwagi?: string; // uwagi użytkownika dla Claude
  sceny: Scena[];
  plikMp4?: string;
  /** Dane explainera (tylko gdy `typ` = "explainer"). */
  a4?: DaneA4;
};

export type PropsRolki = {
  scenariusz: Scenariusz;
  bazaUrl: string; // skąd pobierać pliki audio, np. http://localhost:4545/projekty/moja-rolka
};
