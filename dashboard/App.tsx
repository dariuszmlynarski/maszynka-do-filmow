import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Scena, Scenariusz } from "../src/typy";
import { czasCalosci, formatujCzas } from "../src/czas";
import { audioAktualne } from "../src/hash";
import { scal } from "../src/scalanie";
import { klatkiA4 } from "../src/a4/Film";
import { api, BladKonfliktu, urlPliku, type OpcjeNowego, type PlanSprzatania, type Kontrola, type PozycjaPlanu, type StanPisania, type StanRenderu, type Status } from "./api";
import { domyslnyEkran, EdytorSceny } from "./EdytorSceny";
import { Podglad } from "./Podglad";
import { Ustawienia } from "./Ustawienia";
import { Galeria } from "./Galeria";
import { EdytorExplainera } from "./EdytorExplainera";
import { PodgladA4 } from "./PodgladA4";
import { AlertTriangle, AudioLines, Check, ChevronLeft, ChevronRight, Clapperboard, Film, FolderOpen, Mic, Play, Plus, Sparkles, Trash2, Upload, Wand2, XCircle } from "lucide-react";

const NAZWY_STATUSOW = { scenariusz: "Scenariusz", lektor: "Lektor gotowy", gotowe: "Rolka gotowa" } as const;
const NAZWY_STATUSOW_A4 = { scenariusz: "Czeka na nagranie", lektor: "Plan gotowy", gotowe: "Film gotowy" } as const;
const nazwaStatusu = (p: Scenariusz) => (p.typ === "explainer" ? NAZWY_STATUSOW_A4 : NAZWY_STATUSOW)[p.status];
/** Format bez zapisu w projekcie: rolki powstawały w pionie, explainery w poziomie. */
const formatProjektu = (p: Scenariusz): "pion" | "poziom" => p.format ?? (p.typ === "explainer" ? "poziom" : "pion");
const liczbaScen = (p: Scenariusz) => (p.typ === "explainer" ? (p.a4?.sceny.length ?? 0) : p.sceny.length);
const I = { className: "ikona", strokeWidth: 1.75 } as const;


export const App: React.FC = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [projekty, setProjekty] = useState<Scenariusz[]>([]);
  const [aktywny, setAktywny] = useState<Scenariusz | null>(null);
  const [aktywnaScena, setAktywnaScena] = useState<string | undefined>();
  const [pokazUstawienia, setPokazUstawienia] = useState(false);
  const [pokazNowa, setPokazNowa] = useState(false);
  const [pokazSprzatanie, setPokazSprzatanie] = useState(false);
  const [komunikat, setKomunikat] = useState<{ typ: "blad" | "info" | "ok"; tekst: string } | null>(null);
  const [zajete, setZajete] = useState(false);
  const [render, setRender] = useState<StanRenderu | null>(null);
  const [bladPolaczenia, setBladPolaczenia] = useState(false);
  const [widok, setWidok] = useState<"edycja" | "galeria">("edycja");
  const [zakladka, setZakladka] = useState<"sceny" | "wersje">("sceny");
  const [licznikGalerii, setLicznikGalerii] = useState(0);
  const [pisanie, setPisanie] = useState<StanPisania | null>(null);
  const [kontrola, setKontrola] = useState<Kontrola | null>(null);
  const [podgladZwiniety, setPodgladZwiniety] = useState<boolean>(() => {
    try {
      return localStorage.getItem("maszynka.podglad") === "zwiniety";
    } catch {
      return false;
    }
  });
  const przelaczPodglad = () => {
    const nowy = !podgladZwiniety;
    setPodgladZwiniety(nowy);
    try {
      localStorage.setItem("maszynka.podglad", nowy ? "zwiniety" : "rozwiniety");
    } catch {
      /* bez znaczenia */
    }
  };
  const brudny = useRef(false);
  const timerZapisu = useRef<number | undefined>(undefined);
  // Wersja projektu, którą ostatnio widzieliśmy na serwerze. Od niej liczymy, co zmieniliśmy tutaj.
  const baza = useRef<Scenariusz | null>(null);
  const licznikZmian = useRef(0);

  /**
   * Zapis z kontrolą wersji. Gdy ktoś inny (Claude przez API, lektor, nagranie) zmienił projekt
   * w międzyczasie, serwer odsyła swoją wersję, a my nanosimy na nią tylko własne zmiany.
   */
  const zapiszBezpiecznie = useCallback(async (nowy: Scenariusz): Promise<Scenariusz> => {
    let doZapisu = nowy;
    for (let proba = 0; proba < 3; proba++) {
      try {
        const zapisany = await api.zapiszProjekt(doZapisu);
        baza.current = zapisany;
        return zapisany;
      } catch (e) {
        if (!(e instanceof BladKonfliktu) || baza.current?.id !== nowy.id) throw e;
        doZapisu = { ...scal(baza.current, doZapisu, e.projekt), zmieniono: e.projekt.zmieniono };
        baza.current = e.projekt;
      }
    }
    throw new Error("Projekt zmienia się bez przerwy w innym miejscu. Odczekaj chwilę i spróbuj ponownie.");
  }, []);

  const odswiezStatus = useCallback(async () => {
    try {
      setStatus(await api.status());
      setBladPolaczenia(false);
    } catch {
      setBladPolaczenia(true);
    }
  }, []);

  const odswiezListe = useCallback(async () => {
    try {
      const lista = await api.projekty();
      setProjekty(lista);
      setBladPolaczenia(false);
      return lista;
    } catch {
      setBladPolaczenia(true);
      return [];
    }
  }, []);

  const wczytaj = useCallback(async (id: string) => {
    try {
      const p = await api.projekt(id);
      brudny.current = false;
      baza.current = p;
      setAktywny(p);
      setAktywnaScena(p.sceny[0]?.id);
      setRender(null);
      localStorage.setItem("maszynka.aktywny", id);
      const st = await api.stanPisania(id).catch(() => null);
      setPisanie(st && st.stan === "pisze" ? st : null);
    } catch (e) {
      setKomunikat({ typ: "blad", tekst: (e as Error).message });
    }
  }, []);

  // Odświeżenie aktywnego projektu po pracy serwera, bez zmiany zaznaczonej sceny.
  const przeladuj = useCallback(async () => {
    if (!aktywny) return;
    const p = await api.projekt(aktywny.id).catch(() => null);
    if (!p) return;
    baza.current = p;
    if (!brudny.current) setAktywny(p);
    void odswiezListe();
  }, [aktywny, odswiezListe]);

  // Start: status, lista, ostatnio otwarty projekt.
  useEffect(() => {
    void odswiezStatus();
    void odswiezListe().then((lista) => {
      const ostatni = localStorage.getItem("maszynka.aktywny");
      const cel = lista.find((p) => p.id === ostatni) ?? lista[0];
      if (cel) void wczytaj(cel.id);
    });
  }, [odswiezStatus, odswiezListe, wczytaj]);

  // Co 4 s odświeżaj listę; jeśli aktywny projekt zmienił się na dysku (np. Claude napisał scenariusz), wczytaj go ponownie.
  useEffect(() => {
    const t = window.setInterval(async () => {
      const lista = await odswiezListe();
      if (aktywny && !brudny.current) {
        const zDysku = lista.find((p) => p.id === aktywny.id);
        if (zDysku && zDysku.zmieniono !== aktywny.zmieniono) {
          baza.current = zDysku;
          setAktywny(zDysku);
        }
      }
    }, 4000);
    return () => window.clearInterval(t);
  }, [aktywny, odswiezListe]);

  // Autozapis 800 ms po ostatniej zmianie.
  const zmien = (nowy: Scenariusz) => {
    brudny.current = true;
    const nr = ++licznikZmian.current;
    setAktywny(nowy);
    window.clearTimeout(timerZapisu.current);
    timerZapisu.current = window.setTimeout(async () => {
      try {
        const zapisany = await zapiszBezpiecznie(nowy);
        if (licznikZmian.current === nr) brudny.current = false;
        // Zmiany wpisane w trakcie zapisu zostają; reszta przychodzi z serwera (także to, co scalił).
        setAktywny((a) => (a && a.id === zapisany.id ? scal(nowy, a, zapisany) : a));
        void odswiezListe();
      } catch (e) {
        setKomunikat({ typ: "blad", tekst: `Nie udało się zapisać: ${(e as Error).message}` });
      }
    }, 800);
  };

  const zmienScene = (id: string, s: Scena) => aktywny && zmien({ ...aktywny, sceny: aktywny.sceny.map((x) => (x.id === id ? s : x)) });

  const dodajScene = () => {
    if (!aktywny) return;
    const n = aktywny.sceny.length + 1;
    let id = `s${n}`;
    while (aktywny.sceny.some((s) => s.id === id)) id = `${id}b`;
    const nowa: Scena = { id, lektor: "", ekran: domyslnyEkran("karta") };
    zmien({ ...aktywny, sceny: [...aktywny.sceny, nowa] });
    setAktywnaScena(id);
  };

  const przesun = (i: number, k: -1 | 1) => {
    if (!aktywny) return;
    const j = i + k;
    if (j < 0 || j >= aktywny.sceny.length) return;
    const sceny = [...aktywny.sceny];
    [sceny[i], sceny[j]] = [sceny[j], sceny[i]];
    zmien({ ...aktywny, sceny });
  };

  const wykonaj = async (co: () => Promise<Scenariusz>, sukces?: string | (() => string)) => {
    if (!aktywny) return;
    window.clearTimeout(timerZapisu.current);
    setZajete(true);
    setKomunikat({ typ: "info", tekst: "Pracuję…" });
    try {
      if (brudny.current) await zapiszBezpiecznie(aktywny);
      const p = await co();
      brudny.current = false;
      baza.current = p;
      setAktywny(p);
      const tekst = typeof sukces === "function" ? sukces() : sukces;
      setKomunikat(tekst ? { typ: "ok", tekst } : null);
      void odswiezListe();
    } catch (e) {
      setKomunikat({ typ: "blad", tekst: (e as Error).message });
      void wczytaj(aktywny.id);
    } finally {
      setZajete(false);
    }
  };

  const startRenderu = async () => {
    if (!aktywny) return;
    window.clearTimeout(timerZapisu.current);
    try {
      if (brudny.current) {
        await zapiszBezpiecznie(aktywny);
        brudny.current = false;
      }
      setRender(await api.startRenderu(aktywny.id));
    } catch (e) {
      setKomunikat({ typ: "blad", tekst: (e as Error).message });
    }
  };

  // Uruchomienie pisania scenariusza przez Claude.
  const napisz = async (tryb: "nowy" | "poprawki") => {
    if (!aktywny) return;
    if (tryb === "nowy" && aktywny.sceny.length && !confirm("Napisać scenariusz od nowa? Obecne sceny zostaną zastąpione.")) return;
    window.clearTimeout(timerZapisu.current);
    try {
      if (brudny.current) {
        await zapiszBezpiecznie(aktywny);
        brudny.current = false;
      }
      setKomunikat(null);
      setPisanie(await api.napiszScenariusz(aktywny.id, tryb));
    } catch (e) {
      setKomunikat({ typ: "blad", tekst: (e as Error).message });
    }
  };

  // Przebudowa jednej sceny według opisu.
  const poprawScene = async (scenaId: string, opis: string) => {
    if (!aktywny) return;
    window.clearTimeout(timerZapisu.current);
    try {
      if (brudny.current) {
        await zapiszBezpiecznie(aktywny);
        brudny.current = false;
      }
      setKomunikat(null);
      setPisanie(await api.poprawScene(aktywny.id, scenaId, opis));
    } catch (e) {
      setKomunikat({ typ: "blad", tekst: (e as Error).message });
    }
  };

  // Śledzenie pisania scenariusza.
  useEffect(() => {
    if (!aktywny || !pisanie || pisanie.stan !== "pisze") return;
    const t = window.setInterval(async () => {
      const st = await api.stanPisania(aktywny.id).catch(() => null);
      if (!st) return;
      setPisanie(st);
      if (st.stan === "gotowe") {
        await wczytaj(aktywny.id);
        setZakladka("sceny");
        setKomunikat({ typ: "ok", tekst: `${st.komunikat ?? "Scenariusz gotowy."} Przejrzyj sceny i popraw, co chcesz.` });
        setPisanie(null);
      } else if (st.stan === "blad") {
        setKomunikat({ typ: "blad", tekst: st.komunikat ?? "Nie udało się napisać scenariusza." });
        setPisanie(null);
      }
    }, 2000);
    return () => window.clearInterval(t);
  }, [pisanie, aktywny, wczytaj]);

  // Śledzenie postępu renderu.
  useEffect(() => {
    if (!aktywny || !render || render.stan === "gotowe" || render.stan === "blad") return;
    const t = window.setInterval(async () => {
      const s = await api.stanRenderu(aktywny.id);
      setRender(s);
      if (s.stan === "gotowe") {
        void wczytaj(aktywny.id);
        setRender(s);
        setLicznikGalerii((n) => n + 1);
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [render, aktywny, wczytaj]);

  // Kontrola jakości przelicza się chwilę po każdej zmianie scenariusza.
  useEffect(() => {
    if (!aktywny || aktywny.typ === "explainer") {
      setKontrola(null);
      return;
    }
    const t = window.setTimeout(() => {
      void api.kontrola(aktywny.id).then(setKontrola).catch(() => setKontrola(null));
    }, 1200);
    return () => window.clearTimeout(t);
  }, [aktywny]);

  // Nagranie w folderze rekordu sejfu — sprawdzane przy wejściu w rolkę.
  const [audioRekordu, setAudioRekordu] = useState<string | null>(null);
  const idAktywnego = aktywny?.id;
  useEffect(() => {
    setAudioRekordu(null);
    if (!idAktywnego) return;
    api.audioRekordu(idAktywnego).then((r) => setAudioRekordu(r.audio)).catch(() => setAudioRekordu(null));
  }, [idAktywnego]);

  const brakLektora = aktywny?.sceny.some((s) => !audioAktualne(s)) ?? true;
  const maNagranie = aktywny?.sceny.some((s) => s.audio?.zrodlo === "nagranie") ?? false;

  // Własne nagranie: z pliku wskazanego w dashboardzie albo leżącego obok rekordu w sejfie.
  const pocnij = (co: () => Promise<{ projekt: Scenariusz; raport: string }>) => {
    let raport = "";
    return wykonaj(async () => {
      const w = await co();
      raport = w.raport;
      return w.projekt;
    }, () => raport);
  };
  const czas = aktywny ? czasCalosci(aktywny) : 0;
  const zaDlugo = aktywny ? czas > aktywny.docelowaDlugosc * 1.15 : false;

  return (
    <div className={`uklad ${podgladZwiniety ? "podglad-zwiniety" : aktywny && formatProjektu(aktywny) === "poziom" && widok === "edycja" ? "szeroki" : ""}`}>
      <aside className="panel lewy">
        <div className="logo">
          <span className="znaczek"><Clapperboard {...I} style={{ width: 13, height: 13 }} /></span>
          Maszynka do filmów
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button className="btn glowny nav-btn" onClick={() => setPokazNowa(true)}>
            <Plus {...I} /> Nowy film
          </button>
          <button className={`btn nav-btn ${widok === "galeria" ? "" : "cichy"}`} onClick={() => setWidok("galeria")}>
            <Film {...I} /> Galeria
          </button>
          <button className="btn nav-btn cichy" onClick={() => setPokazSprzatanie(true)} title="Usuń starsze wersje, pliki robocze i kosz">
            <Trash2 {...I} /> Posprzątaj maszynkę
          </button>
        </div>
        <div>
          <p className="etykieta-sekcji">Twoje filmy</p>
          <div className="lista-projektow">
            {projekty.map((p) => (
              <button key={p.id} className={`projekt ${widok === "edycja" && aktywny?.id === p.id ? "aktywny" : ""}`} onClick={() => { setWidok("edycja"); setZakladka("sceny"); void wczytaj(p.id); }}>
                <span className={`status-kropka ${p.status}`} title={nazwaStatusu(p)} />
                <span>
                  <span className="tytul">{p.tytul}</span>
                  <span className="meta">{p.typ === "explainer" ? "Explainer · " : ""}{nazwaStatusu(p)}, {liczbaScen(p)} scen</span>
                </span>
              </button>
            ))}
            {projekty.length === 0 && <p className="male">Nie masz jeszcze żadnego filmu. Zacznij od przycisku „Nowy film”.</p>}
          </div>
        </div>
        <div className="panel-lektor">
          <p className="etykieta-sekcji">Lektor</p>
          {status?.maKlucz ? (
            <div className="male" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="kropka ok" /> Głos: <strong style={{ color: "var(--ink)" }}>{status.voiceName ?? "nie wybrano"}</strong>
            </div>
          ) : (
            <div className="male" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="kropka brak" /> Brak klucza ElevenLabs
            </div>
          )}
          <button className="btn maly" style={{ marginTop: 10 }} onClick={() => setPokazUstawienia(true)}>
            Ustawienia głosu
          </button>
          {bladPolaczenia && <div className="komunikat blad" style={{ marginTop: 12 }}>Brak połączenia z serwerem. Uruchom ponownie plik „Uruchom maszynkę”.</div>}
        </div>
      </aside>

      <main className="panel srodek">
        {widok === "galeria" ? (
          <>
            <div className="naglowek-projektu">
              <h1>Galeria</h1>
              <div className="male">Wszystkie wygenerowane pliki MP4. Kliknij tytuł, żeby wrócić do edycji.</div>
            </div>
            <div className="tresc" style={{ maxWidth: "none" }}>
              <Galeria onOtworzProjekt={(id) => { setWidok("edycja"); setZakladka("sceny"); void wczytaj(id); }} odswiez={licznikGalerii} />
            </div>
          </>
        ) : !aktywny ? (
          <div className="pusty">
            <div className="ikona-duza"><Clapperboard {...I} style={{ width: 20, height: 20 }} /></div>
            Wybierz film z listy albo utwórz nowy.
          </div>
        ) : aktywny.typ === "explainer" ? (
          <>
            <div className="naglowek-projektu">
              <div className="wiersz-tytulu">
                <input className="tytul-input" value={aktywny.tytul} onChange={(e) => zmien({ ...aktywny, tytul: e.target.value })} aria-label="Tytuł filmu" />
                <span className={`odznaka ${aktywny.status}`}>{nazwaStatusu(aktywny)}</span>
              </div>
              <div className="akcje">
                <select className="wybor-formatu" value={formatProjektu(aktywny)} onChange={(e) => zmien({ ...aktywny, format: e.target.value as "pion" | "poziom" })} aria-label="Format" title="Format filmu">
                  <option value="pion">Pion 9:16</option>
                  <option value="poziom">Poziom 16:9</option>
                </select>
                <label className="przelacznik">
                  <input type="checkbox" checked={aktywny.napisy} onChange={(e) => zmien({ ...aktywny, napisy: e.target.checked })} /> Napisy
                </label>
                <button className="btn glowny" disabled={!aktywny.a4?.sceny.length || (render && render.stan !== "gotowe" && render.stan !== "blad") || false} onClick={startRenderu}>
                  <Clapperboard {...I} /> Renderuj film
                </button>
                <span className="odstep" />
                <button className="btn cichy ikonowy" onClick={() => api.otworzFolder(aktywny.id)} title="Pokaż folder w Finderze" aria-label="Pokaż folder w Finderze">
                  <FolderOpen {...I} />
                </button>
                <button
                  className="btn cichy ikonowy niebezpieczny"
                  title="Usuń film"
                  aria-label="Usuń film"
                  onClick={async () => {
                    if (!confirm(`Usunąć „${aktywny.tytul}”? Trafi do folderu _kosz.`)) return;
                    await api.usunProjekt(aktywny.id);
                    setAktywny(null);
                    void odswiezListe();
                  }}
                >
                  <Trash2 {...I} />
                </button>
              </div>
            </div>
            <div className="tresc">
              {aktywny.plikMp4 && !render && (
                <div className="komunikat ok">
                  <Check {...I} />
                  <span>Ostatni gotowy film: <strong>{aktywny.plikMp4}</strong></span>
                  <span className="odstep" />
                  <a className="btn maly" href={urlPliku(aktywny.id, aktywny.plikMp4)} target="_blank" rel="noreferrer"><Play {...I} /> Otwórz</a>
                  <button className="btn maly" onClick={() => api.otworzFolder(aktywny.id)}><FolderOpen {...I} /> Finder</button>
                </div>
              )}
              {komunikat && (
                <div className={`komunikat ${komunikat.typ}`} onClick={() => setKomunikat(null)}>
                  {komunikat.tekst}
                </div>
              )}
              {render && (
                <div className="karta" style={{ marginBottom: 14, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <strong>{render.stan === "gotowe" ? "Film gotowy" : render.stan === "blad" ? "Render nie powiódł się" : "Renderuję film"}</strong>
                    <span className="male">{Math.round(render.postep * 100)}%</span>
                  </div>
                  <div className="postep">
                    <div style={{ width: `${render.postep * 100}%` }} />
                  </div>
                  <div className="male" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{render.komunikat}</div>
                  {render.stan === "gotowe" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <a className="btn" href={urlPliku(aktywny.id, render.plik ?? aktywny.plikMp4 ?? "")} target="_blank" rel="noreferrer"><Play {...I} /> Otwórz MP4</a>
                      <button className="btn" onClick={() => api.otworzFolder(aktywny.id)}><FolderOpen {...I} /> Pokaż w Finderze</button>
                    </div>
                  )}
                </div>
              )}
              <div className="zakladki">
                <button className={zakladka === "sceny" ? "aktywna" : ""} onClick={() => setZakladka("sceny")}>Nagranie i plan</button>
                <button className={zakladka === "wersje" ? "aktywna" : ""} onClick={() => setZakladka("wersje")}>Wygenerowane wersje</button>
              </div>
              {zakladka === "wersje" && <Galeria projektId={aktywny.id} onOtworzProjekt={() => {}} odswiez={licznikGalerii} />}
              {zakladka === "sceny" && (
                <EdytorExplainera projekt={aktywny} aktywnaScena={aktywnaScena} onAktywnaScena={setAktywnaScena} zmien={zmien} odswiez={przeladuj} setKomunikat={setKomunikat} />
              )}
            </div>
          </>
        ) : (
          <>
            <div className="naglowek-projektu">
              <div className="wiersz-tytulu">
                <input className="tytul-input" value={aktywny.tytul} onChange={(e) => zmien({ ...aktywny, tytul: e.target.value })} aria-label="Tytuł rolki" />
                <span className={`odznaka ${aktywny.status}`}>{nazwaStatusu(aktywny)}</span>
              </div>
              <div className="zrodlo-wiersz">
                <span>Źródło</span>
                <input value={aktywny.zrodlo ?? ""} onChange={(e) => zmien({ ...aktywny, zrodlo: e.target.value })} placeholder="link do artykułu albo pomysł na rolkę" aria-label="Źródło rolki" />
              </div>
              <div className="akcje">
                <label className="pole-liczbowe" title="Docelowa długość rolki">
                  <input type="number" min={5} max={300} step={5} value={aktywny.docelowaDlugosc} onChange={(e) => zmien({ ...aktywny, docelowaDlugosc: Math.max(5, Math.min(300, Number(e.target.value) || 0)) })} aria-label="Docelowa długość w sekundach" />
                  <span className="male">s</span>
                </label>
                <select className="wybor-formatu" value={formatProjektu(aktywny)} onChange={(e) => zmien({ ...aktywny, format: e.target.value as "pion" | "poziom" })} aria-label="Format" title="Format filmu">
                  <option value="pion">Pion 9:16</option>
                  <option value="poziom">Poziom 16:9</option>
                </select>
                <label className="przelacznik">
                  <input type="checkbox" checked={aktywny.napisy} onChange={(e) => zmien({ ...aktywny, napisy: e.target.checked })} /> Napisy
                </label>
                <button className="btn" disabled={zajete || pisanie?.stan === "pisze" || !aktywny.zrodlo?.trim()} onClick={() => napisz("nowy")} title={!aktywny.zrodlo?.trim() ? "Najpierw wpisz link albo pomysł w polu Źródło" : ""}>
                  <Sparkles {...I} /> {aktywny.sceny.length ? "Napisz od nowa" : "Napisz scenariusz"}
                </button>
                {maNagranie ? (
                  <button
                    className="btn"
                    disabled={zajete}
                    title="Rolka ma Twoje nagranie. Ten przycisk zastąpi je głosem z ElevenLabs we wszystkich scenach."
                    onClick={() => {
                      if (!confirm("Zastąpić Twoje nagranie głosem z ElevenLabs we wszystkich scenach?")) return;
                      void wykonaj(() => api.lektorWszystkich(aktywny.id, true), "Lektor z ElevenLabs wygenerowany.");
                    }}
                  >
                    <Mic {...I} /> Wróć do ElevenLabs
                  </button>
                ) : (
                  <button className={`btn ${aktywny.glos === "nagranie" ? "cichy" : ""}`} disabled={zajete || !aktywny.sceny.length} onClick={() => wykonaj(() => api.lektorWszystkich(aktywny.id), "Lektor wygenerowany.")} title={aktywny.glos === "nagranie" ? "Ten film miał mieć Twój głos. Lektor AI zastąpi nagranie." : ""}>
                    {brakLektora ? <Mic {...I} /> : <Check {...I} />} {brakLektora ? "Generuj lektora" : "Lektor aktualny"}
                  </button>
                )}
                <label className={`btn ${aktywny.glos === "nagranie" && !maNagranie ? "glowny" : ""} ${zajete || !aktywny.sceny.length ? "wylaczony" : ""}`} title="Wgraj plik z Twoim głosem (m4a, mp3, wav). Maszynka potnie go na sceny.">
                  <Upload {...I} /> {maNagranie ? "Wgraj nagranie ponownie" : "Wgraj nagranie"}
                  <input
                    type="file"
                    accept="audio/*,.m4a,.mp3,.wav,.aac,.caf,.flac,.ogg,.opus"
                    hidden
                    disabled={zajete || !aktywny.sceny.length}
                    onChange={(e) => {
                      const plik = e.target.files?.[0];
                      e.target.value = "";
                      if (plik) void pocnij(() => api.wgrajNagranie(aktywny.id, plik));
                    }}
                  />
                </label>
                {audioRekordu && (
                  <button className="btn" disabled={zajete || !aktywny.sceny.length} title={`Nagranie z folderu rekordu w sejfie: ${audioRekordu}`} onClick={() => void pocnij(() => api.nagranieZRekordu(aktywny.id))}>
                    <AudioLines {...I} /> Głos z rekordu
                  </button>
                )}
                <button className="btn glowny" disabled={zajete || !aktywny.sceny.length || (render && render.stan !== "gotowe" && render.stan !== "blad") || false} onClick={startRenderu} title={brakLektora ? "Możesz renderować bez lektora, ale sceny będą miały szacowaną długość" : ""}>
                  <Clapperboard {...I} /> Renderuj MP4
                </button>
                <span className="odstep" />
                <button className="btn cichy ikonowy" onClick={() => api.otworzFolder(aktywny.id)} title="Pokaż folder rolki w Finderze" aria-label="Pokaż folder w Finderze">
                  <FolderOpen {...I} />
                </button>
                <button
                  className="btn cichy ikonowy niebezpieczny"
                  title="Usuń rolkę"
                  aria-label="Usuń rolkę"
                  onClick={async () => {
                    if (!confirm(`Usunąć rolkę „${aktywny.tytul}”? Trafi do folderu _kosz.`)) return;
                    await api.usunProjekt(aktywny.id);
                    setAktywny(null);
                    void odswiezListe();
                  }}
                >
                  <Trash2 {...I} />
                </button>
              </div>
            </div>

            <div className="tresc">
              {pisanie?.stan === "pisze" && (
                <div className="komunikat info">
                  <span className="kreci" />
                  <span>
                    <strong>{pisanie.komunikat?.includes("scenę") ? "Claude przebudowuje scenę" : "Claude pisze scenariusz"}</strong>
                    <span className="male" style={{ color: "inherit", opacity: 0.8 }}> — {pisanie.komunikat} {pisanie.komunikat?.includes("scenę") ? "Zwykle 10–30 sekund." : "Zwykle 30–90 sekund."}</span>
                  </span>
                </div>
              )}
              {aktywny.plikMp4 && !render && (
                <div className="komunikat ok">
                  <Check {...I} />
                  <span>Ostatnia gotowa rolka: <strong>{aktywny.plikMp4}</strong></span>
                  <span className="odstep" />
                  <a className="btn maly" href={urlPliku(aktywny.id, aktywny.plikMp4)} target="_blank" rel="noreferrer"><Play {...I} /> Otwórz</a>
                  <button className="btn maly" onClick={() => api.otworzFolder(aktywny.id)}><FolderOpen {...I} /> Finder</button>
                </div>
              )}
              {komunikat && (
                <div className={`komunikat ${komunikat.typ}`} onClick={() => setKomunikat(null)}>
                  {komunikat.tekst}
                </div>
              )}
              {render && (
                <div className="karta" style={{ marginBottom: 14, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <strong>{render.stan === "gotowe" ? "Rolka gotowa" : render.stan === "blad" ? "Render nie powiódł się" : "Renderuję rolkę"}</strong>
                    <span className="male">{Math.round(render.postep * 100)}%</span>
                  </div>
                  <div className="postep">
                    <div style={{ width: `${render.postep * 100}%` }} />
                  </div>
                  <div className="male" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{render.komunikat}</div>
                  {render.stan === "gotowe" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <a className="btn" href={urlPliku(aktywny.id, render.plik ?? aktywny.plikMp4 ?? "")} target="_blank" rel="noreferrer"><Play {...I} /> Otwórz MP4</a>
                      <button className="btn" onClick={() => api.otworzFolder(aktywny.id)}><FolderOpen {...I} /> Pokaż w Finderze</button>
                    </div>
                  )}
                </div>
              )}

              <div className="zakladki">
                <button className={zakladka === "sceny" ? "aktywna" : ""} onClick={() => setZakladka("sceny")}>Sceny</button>
                <button className={zakladka === "wersje" ? "aktywna" : ""} onClick={() => setZakladka("wersje")}>Wygenerowane wersje</button>
              </div>
              {zakladka === "wersje" && <Galeria projektId={aktywny.id} onOtworzProjekt={() => {}} odswiez={licznikGalerii} />}
              {zakladka === "sceny" && aktywny.sceny.length === 0 && pisanie?.stan !== "pisze" && (
                <div className="pusty" style={{ padding: "30px 20px" }}>
                  <div className="ikona-duza"><Sparkles {...I} style={{ width: 20, height: 20 }} /></div>
                  Ta rolka nie ma jeszcze scen. Wpisz link albo pomysł w polu Źródło i kliknij <strong>Napisz scenariusz</strong>. Możesz też dodać sceny ręcznie.
                </div>
              )}
              {zakladka === "sceny" && aktywny.sceny.map((s, i) => (
                <EdytorSceny
                  key={s.id}
                  scena={s}
                  numer={i + 1}
                  aktywna={aktywnaScena === s.id}
                  projektId={aktywny.id}
                  audioAktualne={audioAktualne(s)}
                  zajete={zajete}
                  onKlik={() => setAktywnaScena(s.id)}
                  onZmiana={(n) => zmienScene(s.id, n)}
                  onUsun={() => zmien({ ...aktywny, sceny: aktywny.sceny.filter((x) => x.id !== s.id) })}
                  onPrzesun={(k) => przesun(i, k)}
                  onLektor={() => wykonaj(() => api.lektorSceny(aktywny.id, s.id), `Lektor sceny ${i + 1} gotowy.`)}
                  onEfekt={() => wykonaj(() => api.efektSceny(aktywny.id, s.id), `Efekt sceny ${i + 1} gotowy.`)}
                  onPopraw={(opis) => poprawScene(s.id, opis)}
                />
              ))}
              {zakladka === "sceny" && (
                <button className="btn dodaj-scene" onClick={dodajScene}>
                  <Plus {...I} /> Dodaj scenę
                </button>
              )}

              {zakladka === "sceny" && (
                <div className="karta uwagi" style={{ marginTop: 22, marginLeft: 50 }}>
                  <h2>Uwagi do całej rolki</h2>
                  <p className="male" style={{ marginTop: 0 }}>Napisz, co zmienić, np. „scena 3 za długa, dodaj scenę z liczbą 80%”. Claude poprawi scenariusz, a sceny bez zmian zachowają nagrany lektor.</p>
                  <textarea className="wejscie" value={aktywny.uwagi ?? ""} onChange={(e) => zmien({ ...aktywny, uwagi: e.target.value })} placeholder="Co poprawić?" />
                  <div style={{ marginTop: 10 }}>
                    <button className="btn glowny" disabled={zajete || pisanie?.stan === "pisze" || !aktywny.uwagi?.trim() || !aktywny.sceny.length} onClick={() => napisz("poprawki")}>
                      <Wand2 {...I} /> Zastosuj uwagi
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <aside className={`panel prawy ${podgladZwiniety ? "zwiniety" : ""}`}>
        {podgladZwiniety ? (
          <button className="btn cichy pionowy" onClick={przelaczPodglad} title="Pokaż podgląd">
            <ChevronLeft {...I} /> Podgląd
          </button>
        ) : (
          <div className="podglad-naglowek">
            <p className="etykieta-sekcji" style={{ margin: 0 }}>Podgląd</p>
            <button className="btn maly cichy" onClick={przelaczPodglad} title="Zwiń podgląd">
              Zwiń <ChevronRight {...I} />
            </button>
          </div>
        )}
        {podgladZwiniety ? null : aktywny?.typ === "explainer" ? (
          <>
            <PodgladA4 projekt={aktywny} aktywnaScena={aktywnaScena} />
            <div className="licznik">
              <span>
                <strong>{formatujCzas(klatkiA4(aktywny) / 30)}</strong>
                <span className="male"> po cięciach</span>
              </span>
              <span className="male">{aktywny.a4?.sceny.length ?? 0} scen</span>
            </div>
            <p className="male" style={{ margin: "10px 0 0" }}>Podgląd pokazuje to samo, co wyjdzie z renderu. Kliknij scenę w planie, a podgląd do niej przeskoczy.</p>
          </>
        ) : aktywny ? (
          <>
            <Podglad scenariusz={aktywny} aktywnaScena={aktywnaScena} />
            <div className="licznik">
              <span>
                <strong className={zaDlugo ? "za-dlugo" : ""}>{formatujCzas(czas)}</strong>
                <span className="male"> z {aktywny.docelowaDlugosc} s</span>
              </span>
              <span className="male">{aktywny.sceny.length} scen</span>
            </div>
            {brakLektora && <p className="male" style={{ margin: "0 0 6px" }}>Długość jest szacowana, dopóki nie wygenerujesz lektora.</p>}
            <PanelKontroli kontrola={kontrola} onPokazScene={(id) => setAktywnaScena(id)} />
            <p className="male" style={{ margin: "10px 0 0" }}>Kliknij scenę, a podgląd do niej przeskoczy. Spacja uruchamia odtwarzanie.</p>
          </>
        ) : (
          <div className="podglad-ramka" />
        )}
      </aside>

      {pokazSprzatanie && <Sprzatanie onZamknij={() => { setPokazSprzatanie(false); setLicznikGalerii((n) => n + 1); void odswiezListe(); }} />}
      {pokazUstawienia && status && <Ustawienia status={status} onZamknij={() => setPokazUstawienia(false)} onZapisano={odswiezStatus} />}
      {pokazNowa && (
        <NowaRolka
          onZamknij={() => setPokazNowa(false)}
          onUtworz={async (tytul, zrodlo, dl, rekord, opcje) => {
            const p = await api.nowyProjekt(tytul, zrodlo, dl, rekord, opcje);
            setPokazNowa(false);
            setWidok("edycja");
            await odswiezListe();
            await wczytaj(p.id);
            if (zrodlo && opcje.typ !== "explainer") setPisanie(await api.napiszScenariusz(p.id, "nowy"));
          }}
        />
      )}
    </div>
  );
};

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(b > 100 * 1024 * 1024 ? 0 : 1)} MB`;

/** Podgląd i wykonanie sprzątania: najpierw lista z powodami, kasowanie dopiero po kliknięciu. */
const Sprzatanie: React.FC<{ onZamknij: () => void }> = ({ onZamknij }) => {
  const [plan, setPlan] = useState<PlanSprzatania | null>(null);
  const [wynik, setWynik] = useState<PlanSprzatania | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [pracuje, setPracuje] = useState(false);
  useEffect(() => {
    api.planSprzatania().then(setPlan).catch((e) => setBlad((e as Error).message));
  }, []);
  const usun = async () => {
    setPracuje(true);
    try {
      setWynik(await api.posprzataj());
    } catch (e) {
      setBlad((e as Error).message);
    } finally {
      setPracuje(false);
    }
  };
  return (
    <div className="dialog-tlo" onClick={onZamknij}>
      <div className="karta dialog szeroki" onClick={(e) => e.stopPropagation()}>
        <h1>Posprzątaj maszynkę</h1>
        <p className="male">
          Zostaje najnowsza wersja każdego filmu, Twoje nagrania i wszystko, czego maszynka potrzebuje do ponownego renderu. Znika reszta: starsze wersje, stare audio lektora, pliki robocze, podwójne kopie i kosz. Kasowanie jest
          ostateczne.
        </p>
        {blad && <div className="komunikat blad">{blad}</div>}
        {!plan && !blad && <p className="male">Liczę…</p>}
        {wynik ? (
          <div className={`komunikat ${wynik.bledy?.length ? "blad" : "ok"}`}>
            Usunięte: {wynik.pozycje.length - (wynik.bledy?.length ?? 0)} pozycji, {mb(wynik.razem)} wolnego miejsca.
            {wynik.bledy?.length ? ` Nie udało się: ${wynik.bledy.join("; ")}` : ""}
          </div>
        ) : (
          plan && (
            <>
              {plan.pozycje.length === 0 ? (
                <div className="komunikat ok">Czysto. Nie ma nic do usunięcia.</div>
              ) : (
                <div className="lista-sprzatania">
                  {plan.pozycje.map((p) => (
                    <div key={p.sciezka} className="wiersz-sprzatania">
                      <span className="rozmiar">{mb(p.rozmiar)}</span>
                      <span>
                        {p.powod}
                        <span className="male sciezka">{p.sciezka}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        )}
        <div className="stopka">
          <button className="btn" onClick={onZamknij}>{wynik ? "Zamknij" : "Anuluj"}</button>
          {!wynik && plan && plan.pozycje.length > 0 && (
            <button className="btn glowny niebezpieczny" disabled={pracuje} onClick={usun}>
              <Trash2 {...I} /> {pracuje ? "Usuwam…" : `Usuń na stałe (${mb(plan.razem)})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const PanelKontroli: React.FC<{ kontrola: Kontrola | null; onPokazScene: (id: string) => void }> = ({ kontrola, onPokazScene }) => {
  if (!kontrola) return null;
  const { uwagi, bledy, ostrzezenia, slowa, budzetSlow } = kontrola;
  return (
    <div className="kontrola">
      <div className="kontrola-naglowek">
        <span className="etykieta-sekcji" style={{ margin: 0 }}>Kontrola jakości</span>
        {uwagi.length === 0 ? (
          <span className="odznaka gotowe">Bez uwag</span>
        ) : (
          <span className="male">
            {bledy > 0 && <strong style={{ color: "var(--red)" }}>{bledy} do poprawy</strong>}
            {bledy > 0 && ostrzezenia > 0 && ", "}
            {ostrzezenia > 0 && `${ostrzezenia} do przejrzenia`}
          </span>
        )}
      </div>
      <div className="male" style={{ marginBottom: uwagi.length ? 8 : 0 }}>
        Lektor: {slowa} słów z około {budzetSlow} na tę długość.
      </div>
      {uwagi.map((u, i) => (
        <button
          key={i}
          className={`uwaga ${u.waga}`}
          onClick={() => u.scena && onPokazScene(u.scena)}
          title={u.scena ? "Pokaż tę scenę w podglądzie" : undefined}
        >
          {u.waga === "blad" ? <XCircle className="ikona" strokeWidth={1.75} /> : <AlertTriangle className="ikona" strokeWidth={1.75} />}
          <span>{u.tekst}</span>
        </button>
      ))}
    </div>
  );
};

/**
 * Rodzaj filmu mówi, skąd biorą się obraz i głos. Format jest osobnym wyborem, bo każdy rodzaj
 * da się zrobić i w pionie (Reels, Shorts), i w poziomie (YouTube) — decyzja Dariusza 17.10.2026.
 */
const RODZAJE = [
  { id: "lektor", nazwa: "Animacje + lektor AI", opis: "Z linku albo pomysłu: Claude pisze scenariusz, klon głosu go czyta, obraz to animacje.", opcje: { typ: "rolka", glos: "lektor" } },
  { id: "glos", nazwa: "Animacje + Twój głos", opis: "Claude pisze scenariusz, Ty go nagrywasz (dyktafon, telefon), maszynka dopasowuje animacje do Twojego głosu.", opcje: { typ: "rolka", glos: "nagranie" } },
  { id: "kamera", nazwa: "Twarz + animacje", opis: "Mówisz do kamery, maszynka wycina pauzy i powtórki, a grafiki wchodzą na Twoje słowa.", opcje: { typ: "explainer" } },
  { id: "ekran", nazwa: "Twarz + ekran + animacje", opis: "Dwa nagrania naraz: kamera i Zoom albo prezentacja. Maszynka zgrywa je po dźwięku i przełącza między nimi.", opcje: { typ: "explainer", zEkranem: true } },
] as const;

type RodzajId = (typeof RODZAJE)[number]["id"];

const NowaRolka: React.FC<{ onZamknij: () => void; onUtworz: (tytul: string, zrodlo: string, dl: number, rekord: string | undefined, opcje: OpcjeNowego) => Promise<void> }> = ({ onZamknij, onUtworz }) => {
  const [rodzaj, setRodzaj] = useState<RodzajId>("lektor");
  const [format, setFormat] = useState<"pion" | "poziom">("pion");
  const [tytul, setTytul] = useState("");
  const [zrodlo, setZrodlo] = useState("");
  const [dl, setDl] = useState(45);
  const [plan, setPlan] = useState<PozycjaPlanu[]>([]);
  const [wybrana, setWybrana] = useState<string | null>(null);
  const wybrany = RODZAJE.find((r) => r.id === rodzaj)!;
  const zKamery = wybrany.opcje.typ === "explainer";

  // Plan social media z sejfu: pozycje z „rolka: Do nagrania”. Gdy sejfu nie ma, sekcja znika.
  useEffect(() => {
    api.plan().then((p) => setPlan(p.pozycje)).catch(() => setPlan([]));
  }, []);

  const wezZPlanu = (p: PozycjaPlanu) => {
    if (wybrana === p.id) {
      setWybrana(null);
      return;
    }
    setWybrana(p.id);
    setTytul(p.tytul.replace(/\s*\(rolka\)\s*$/i, "").trim());
    setZrodlo(p.tresc);
    if (p.dlugosc) setDl(p.dlugosc);
    if (p.audio) setRodzaj("glos");
  };

  const utworz = () => onUtworz(tytul.trim(), zKamery ? "" : zrodlo.trim(), zKamery ? 0 : dl, zKamery ? undefined : (wybrana ?? undefined), { ...wybrany.opcje, format });

  return (
    <div className="dialog-tlo" onClick={onZamknij}>
      <div className="karta dialog szeroki" onClick={(e) => e.stopPropagation()}>
        <h1>Nowy film</h1>
        <div className="pole" style={{ marginTop: 12 }}>
          <label>Rodzaj filmu</label>
          <div className="wybor-rodzaju">
            {RODZAJE.map((r) => (
              <button key={r.id} className={`kafel-wyboru ${rodzaj === r.id ? "wybrany" : ""}`} onClick={() => setRodzaj(r.id)}>
                <strong>{r.nazwa}</strong>
                <span className="male">{r.opis}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="pole">
          <label>Format</label>
          <div className="skroty">
            <button className={`btn maly ${format === "pion" ? "" : "cichy"}`} onClick={() => setFormat("pion")}>Pion 9:16 · Reels, Shorts, TikTok</button>
            <button className={`btn maly ${format === "poziom" ? "" : "cichy"}`} onClick={() => setFormat("poziom")}>Poziom 16:9 · YouTube</button>
          </div>
        </div>
        <div className="pole">
          <label>Tytuł roboczy</label>
          <input value={tytul} onChange={(e) => setTytul(e.target.value)} placeholder={zKamery ? "np. Jak zbudować kontekst dla Claude" : "np. 3 błędy w automatyzacjach"} autoFocus />
        </div>
        {zKamery ? (
          <p className="male">Długość wynika z nagrania. {rodzaj === "ekran" ? "Oba nagrania" : "Nagranie"} wgrasz w następnym kroku.</p>
        ) : (
          <>
            {plan.length > 0 && (
              <div className="pole">
                <label>Z planu social media — czeka na nagranie</label>
                <div className="plan-lista">
                  {plan.map((p) => (
                    <button key={p.id} className={`plan-pozycja ${wybrana === p.id ? "wybrana" : ""}`} onClick={() => wezZPlanu(p)}>
                      <span className="plan-tytul">{p.tytul.replace(/\s*\(rolka\)\s*$/i, "")}</span>
                      <span className="plan-meta">{[p.filar, p.status, p.dlugosc ? `${p.dlugosc} s` : null, p.audio ? "🎙 nagranie w rekordzie" : null].filter(Boolean).join(" · ")}</span>
                    </button>
                  ))}
                </div>
                <p className="male">Kliknięcie wciąga treść pozycji jako źródło scenariusza.</p>
              </div>
            )}
            <div className="pole">
              <label>Link do artykułu albo pomysł</label>
              <textarea value={zrodlo} onChange={(e) => setZrodlo(e.target.value)} placeholder="https://dariuszmlynarski.pl/... albo: 3 błędy, które robi każdy w n8n" />
            </div>
            <div className="pole">
              <label>Docelowa długość</label>
              <div className="skroty">
                <label className="pole-liczbowe">
                  <input type="number" min={5} max={600} step={5} value={dl} onChange={(e) => setDl(Number(e.target.value) || 0)} />
                  <span className="male">s</span>
                </label>
                {(format === "pion" ? [15, 30, 45, 60, 90] : [60, 120, 180, 300]).map((s) => (
                  <button key={s} className={`btn maly ${dl === s ? "" : "cichy"}`} onClick={() => setDl(s)}>
                    {s < 120 ? `${s} s` : `${s / 60} min`}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="stopka">
          <button className="btn" onClick={onZamknij}>Anuluj</button>
          <button className="btn glowny" disabled={!tytul.trim() || (!zKamery && dl < 5)} onClick={utworz}>
            {!zKamery && zrodlo.trim() ? <><Sparkles {...I} /> Utwórz i napisz scenariusz</> : "Utwórz film"}
          </button>
        </div>
      </div>
    </div>
  );
};
