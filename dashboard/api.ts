import type { Scenariusz } from "../src/typy";

export const SERWER = "http://localhost:4545";

export type Status = {
  maKlucz: boolean;
  kluczZEnv: boolean;
  voiceId?: string;
  voiceName?: string;
  model: string;
  stabilnosc: number;
  podobienstwo: number;
  styl: number;
  katalogProjektow: string;
};

export type Glos = { id: string; nazwa: string; kategoria?: string; podglad?: string };

export type WpisGalerii = { projektId: string; tytul: string; plik: string; rozmiar: number; data: string };

export type Uwaga = { waga: "blad" | "ostrzezenie"; scena?: string; numer?: number; tekst: string };
export type Kontrola = {
  uwagi: Uwaga[];
  bledy: number;
  ostrzezenia: number;
  slowa: number;
  budzetSlow: number;
  czas: number;
  tempo: number;
};

export type StanPisania = { stan: "brak" | "pisze" | "gotowe" | "blad"; komunikat?: string };

export type StanRenderu = {
  stan: "czeka" | "przygotowanie" | "renderowanie" | "gotowe" | "blad";
  postep: number;
  komunikat?: string;
  plik?: string;
};

/** Zapis odrzucony, bo projekt na dysku jest nowszy niż wersja, na której pracował dashboard. */
export class BladKonfliktu extends Error {
  constructor(komunikat: string, public projekt: Scenariusz) {
    super(komunikat);
  }
}

async function zapytaj<T>(sciezka: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SERWER}${sciezka}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error("Nie mogę połączyć się z serwerem maszynki. Czy jest uruchomiony?");
  }
  const dane = await res.json().catch(() => ({}));
  if (res.status === 409 && dane?.konflikt && dane.projekt) throw new BladKonfliktu(dane.blad, dane.projekt);
  if (!res.ok) throw new Error(dane?.blad ?? `Błąd ${res.status}`);
  return dane as T;
}

/** Pozycja planu social media oznaczona jako rolka do nagrania. */
export type PozycjaPlanu = {
  id: string;
  tytul: string;
  filar?: string;
  format?: string;
  status?: string;
  data?: string;
  dlugosc?: number;
  tresc: string;
  sciezka: string;
  audio?: string;
};

export type WynikNagrania = { projekt: Scenariusz; raport: string };

export type PlanSprzatania = { pozycje: { sciezka: string; powod: string; rozmiar: number }[]; razem: number; bledy?: string[] };

export type OpcjeNowego = { typ: "rolka" | "explainer"; format: "pion" | "poziom"; glos?: "lektor" | "nagranie"; zEkranem?: boolean };

export type StanA4 = { stan: "brak" | "pracuje" | "gotowe" | "blad"; etap?: string; komunikat?: string };

export const api = {
  status: () => zapytaj<Status>("/api/status"),
  zapiszUstawienia: (u: Partial<Status> & { elevenLabsApiKey?: string }) =>
    zapytaj<{ ok: true }>("/api/ustawienia", { method: "PUT", body: JSON.stringify(u) }),
  glosy: () => zapytaj<Glos[]>("/api/glosy"),

  plan: () => zapytaj<{ dostepny: boolean; pozycje: PozycjaPlanu[] }>("/api/plan"),

  projekty: () => zapytaj<Scenariusz[]>("/api/projekty"),
  projekt: (id: string) => zapytaj<Scenariusz>(`/api/projekty/${id}`),
  nowyProjekt: (tytul: string, zrodlo: string | undefined, docelowaDlugosc: number | undefined, rekord: string | undefined, opcje: OpcjeNowego) =>
    zapytaj<Scenariusz>("/api/projekty", { method: "POST", body: JSON.stringify({ tytul, zrodlo, docelowaDlugosc, rekord, ...opcje }) }),
  planSprzatania: () => zapytaj<PlanSprzatania>("/api/sprzatanie"),
  posprzataj: () => zapytaj<PlanSprzatania>("/api/sprzatanie", { method: "POST", body: "{}" }),
  zapiszProjekt: (s: Scenariusz) => zapytaj<Scenariusz>(`/api/projekty/${s.id}`, { method: "PUT", body: JSON.stringify(s) }),
  usunProjekt: (id: string) => zapytaj<{ ok: true }>(`/api/projekty/${id}`, { method: "DELETE" }),
  otworzFolder: (id: string) => zapytaj<{ ok: true }>(`/api/projekty/${id}/otworz-folder`, { method: "POST" }),

  lektorSceny: (id: string, scenaId: string) => zapytaj<Scenariusz>(`/api/projekty/${id}/lektor/${scenaId}`, { method: "POST" }),
  lektorWszystkich: (id: string, wszystkie = false) =>
    zapytaj<Scenariusz>(`/api/projekty/${id}/lektor`, { method: "POST", body: JSON.stringify({ wszystkie }) }),
  wgrajNagranie: (id: string, plik: File) =>
    zapytaj<WynikNagrania>(`/api/projekty/${id}/nagranie`, {
      method: "POST",
      body: plik,
      headers: { "Content-Type": plik.type || "application/octet-stream", "X-Nazwa-Pliku": encodeURIComponent(plik.name) },
    }),
  audioRekordu: (id: string) => zapytaj<{ rekord: string | null; audio: string | null }>(`/api/projekty/${id}/rekord`),
  nagranieZRekordu: (id: string) => zapytaj<WynikNagrania>(`/api/projekty/${id}/nagranie-z-rekordu`, { method: "POST", body: "{}" }),
  efektSceny: (id: string, scenaId: string) => zapytaj<Scenariusz>(`/api/projekty/${id}/efekt/${scenaId}`, { method: "POST", body: "{}" }),

  napiszScenariusz: (id: string, tryb: "nowy" | "poprawki") =>
    zapytaj<StanPisania>(`/api/projekty/${id}/scenariusz`, { method: "POST", body: JSON.stringify({ tryb }) }),
  poprawScene: (id: string, scenaId: string, opis: string) =>
    zapytaj<StanPisania>(`/api/projekty/${id}/scena/${scenaId}/popraw`, { method: "POST", body: JSON.stringify({ opis }) }),
  stanPisania: (id: string) => zapytaj<StanPisania>(`/api/projekty/${id}/scenariusz`),

  kontrola: (id: string) => zapytaj<Kontrola>(`/api/projekty/${id}/kontrola`),

  galeria: () => zapytaj<WpisGalerii[]>("/api/galeria"),
  usunRolke: (id: string, plik: string) => zapytaj<{ ok: true }>(`/api/projekty/${id}/rolki/${plik}`, { method: "DELETE" }),

  // Explainer z kamery (ścieżka A4)
  stanA4: (id: string) => zapytaj<StanA4>(`/api/projekty/${id}/a4`),
  wgrajWideo: (id: string, plik: File, rodzaj: "kamera" | "ekran") =>
    zapytaj<StanA4>(`/api/projekty/${id}/a4/wideo?rodzaj=${rodzaj}`, {
      method: "POST",
      body: plik,
      headers: { "Content-Type": "application/octet-stream", "X-Nazwa-Pliku": encodeURIComponent(plik.name) },
    }),
  wideoZDysku: (id: string, sciezka: string, rodzaj: "kamera" | "ekran") =>
    zapytaj<StanA4>(`/api/projekty/${id}/a4/wideo-z-dysku`, { method: "POST", body: JSON.stringify({ sciezka, rodzaj }) }),
  przetworzA4: (id: string, tylkoPlan = false) => zapytaj<StanA4>(`/api/projekty/${id}/a4/przetworz`, { method: "POST", body: JSON.stringify({ tylkoPlan }) }),
  przebudujSceneA4: (id: string, scenaId: string, opis: string) =>
    zapytaj<StanA4>(`/api/projekty/${id}/a4/scena/${scenaId}/przebuduj`, { method: "POST", body: JSON.stringify({ opis }) }),
  muzykaA4: (id: string, opis: string) => zapytaj<StanA4>(`/api/projekty/${id}/a4/muzyka`, { method: "POST", body: JSON.stringify({ opis }) }),
  muzykaPlikA4: (id: string, plik: File) =>
    zapytaj<Scenariusz>(`/api/projekty/${id}/a4/muzyka-plik`, {
      method: "POST",
      body: plik,
      headers: { "Content-Type": "application/octet-stream", "X-Nazwa-Pliku": encodeURIComponent(plik.name) },
    }),
  synchronizujA4: (id: string) => zapytaj<Scenariusz>(`/api/projekty/${id}/a4/synchronizuj`, { method: "POST", body: "{}" }),

  startRenderu: (id: string) => zapytaj<StanRenderu>(`/api/projekty/${id}/render`, { method: "POST" }),
  stanRenderu: (id: string) => zapytaj<StanRenderu>(`/api/projekty/${id}/render`),
};

export const urlPliku = (id: string, plik: string) => `${SERWER}/projekty/${id}/${plik}`;
