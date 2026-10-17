// Zamiana scenariusza w plik MP4 przez Remotion.
import fs from "node:fs";
import path from "node:path";
import { uruchom } from "./nagranie";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { Scenariusz } from "../src/typy";
import { KATALOG_GLOWNY, katalogProjektu } from "./magazyn";

export type StanRenderu = {
  stan: "czeka" | "przygotowanie" | "renderowanie" | "gotowe" | "blad";
  postep: number; // 0–1
  komunikat?: string;
  plik?: string;
  start: number;
  koniec?: number;
};

const stany = new Map<string, StanRenderu>();
let paczkaPromise: Promise<string> | null = null;

/** Buduje paczkę Remotion raz i trzyma ją w pamięci na czas działania serwera. */
function paczka(): Promise<string> {
  if (!paczkaPromise) {
    paczkaPromise = bundle({
      entryPoint: path.join(KATALOG_GLOWNY, "src", "index.ts"),
      onProgress: () => {},
    }).catch((e) => {
      paczkaPromise = null;
      throw e;
    });
  }
  return paczkaPromise;
}

/** Wymusza ponowne zbudowanie paczki (po zmianach w kodzie scen). */
export function odswiezPaczke() {
  paczkaPromise = null;
}

export function stanRenderu(id: string): StanRenderu | undefined {
  return stany.get(id);
}

export function trwaRender(id: string) {
  const s = stany.get(id);
  return s && (s.stan === "czeka" || s.stan === "przygotowanie" || s.stan === "renderowanie");
}

function wyrownajFilm(wejscie: string, wyjscie: string) {
  return uruchom("ffmpeg", ["-v", "error", "-y", "-i", wejscie, "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", wyjscie]);
}

export async function renderuj(scenariusz: Scenariusz, bazaUrl: string): Promise<void> {
  const id = scenariusz.id;
  const stan: StanRenderu = { stan: "przygotowanie", postep: 0, start: Date.now(), komunikat: "Przygotowuję paczkę wideo…" };
  stany.set(id, stan);
  try {
    const serveUrl = await paczka();
    stan.komunikat = "Obliczam długość rolki…";
    const explainer = scenariusz.typ === "explainer";
    // Explainer (ścieżka A4) to osobna kompozycja 16:9 z kamerą jako warstwą.
    const inputProps = explainer ? { projekt: scenariusz, bazaUrl } : { scenariusz, bazaUrl };
    const composition = await selectComposition({ serveUrl, id: explainer ? "ExplainerA4" : "Short", inputProps, chromiumOptions: { gl: "angle" } });
    const d = new Date();
    const znacznik = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}-${String(d.getMinutes()).padStart(2, "0")}-${String(d.getSeconds()).padStart(2, "0")}`;
    const nazwaPliku = `${explainer ? "film" : "rolka"}_${znacznik}.mp4`;
    const wyjscie = path.join(katalogProjektu(id), nazwaPliku);
    stan.stan = "renderowanie";
    stan.komunikat = "Renderuję klatki…";
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: wyjscie,
      inputProps,
      chromiumOptions: { gl: "angle" },
      concurrency: Math.max(1, Math.floor((await import("node:os")).cpus().length / 2)),
      onProgress: ({ progress, renderedFrames, encodedFrames }) => {
        stan.postep = progress;
        stan.komunikat = `Klatki: ${renderedFrames}/${composition.durationInFrames}, zakodowane: ${encodedFrames}`;
      },
    });
    if (explainer) {
      // Dźwięk z kamery ma własny poziom; wyrównanie do -16 LUFS jak reszta fabryki (YouTube i tak normalizuje).
      stan.komunikat = "Wyrównuję głośność…";
      const tmp = wyjscie.replace(/\.mp4$/, ".tmp.mp4");
      await wyrownajFilm(wyjscie, tmp);
      fs.renameSync(tmp, wyjscie);
    }
    stan.stan = "gotowe";
    stan.postep = 1;
    stan.plik = nazwaPliku;
    stan.koniec = Date.now();
    stan.komunikat = `Gotowe w ${Math.round((stan.koniec - stan.start) / 1000)} s`;
  } catch (e) {
    stan.stan = "blad";
    stan.koniec = Date.now();
    stan.komunikat = e instanceof Error ? e.message : String(e);
    console.error(`Błąd renderu ${id}:`, e);
  }
}
