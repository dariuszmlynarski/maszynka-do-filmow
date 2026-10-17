// Format kadru rolki: pion 9:16 (Reels, Shorts, TikTok) albo poziom 16:9 (YouTube).
// Sceny liczą miejsce z tego kontekstu zamiast ze stałych, więc ten sam scenariusz renderuje się w obu formatach.
import { createContext, useContext } from "react";
import { MARGINES, SAFE, SZEROKOSC, WYSOKOSC } from "./marka";

export type Format = "pion" | "poziom";

export type Kadr = {
  format: Format;
  szer: number;
  wys: number;
  /** Bezpieczne pole: w pionie omija interfejs Reels i Shorts, w poziomie tylko margines od krawędzi. */
  safe: { gora: number; dol: number };
  margines: number;
  /** Miejsce zarezerwowane na napisy pod treścią. */
  pasNapisow: number;
  /**
   * Powiększenie treści. Sceny są projektowane pod szerokość 1080 px, a w poziomie wysokość kadru
   * to też 1080 px, więc treść trzeba zmniejszyć, żeby zmieściła się w pionie, i dać jej szerszy obszar.
   */
  zoom: number;
  /** Najszersza kolumna treści (w pikselach projektu). W poziomie treść stoi na środku, zamiast rozjeżdżać się na całą szerokość. */
  kolumna?: number;
};

export const KADR_PION: Kadr = { format: "pion", szer: SZEROKOSC, wys: WYSOKOSC, safe: SAFE, margines: MARGINES, pasNapisow: 250, zoom: 1 };
export const KADR_POZIOM: Kadr = { format: "poziom", szer: 1920, wys: 1080, safe: { gora: 110, dol: 1010 }, margines: 160, pasNapisow: 160, zoom: 0.86, kolumna: 1260 };

export const kadrFormatu = (format: Format | undefined) => (format === "poziom" ? KADR_POZIOM : KADR_PION);

export const KontekstKadru = createContext<Kadr>(KADR_PION);
export const useKadr = () => useContext(KontekstKadru);
