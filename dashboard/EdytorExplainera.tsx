// Edytor explainera (ścieżka A4): nagranie, przetwarzanie, plan scen i dźwięk.
// Plan scen to jedyna bramka: Dariusz przegląda tabelę, poprawia, a render idzie bez klikania.
import React, { useEffect, useState } from "react";
import type { Scenariusz } from "../src/typy";
import { NAZWY_UKLADOW, TYPY_KLOCKOW, UKLADY, type DaneA4, type Klocek, type PrzejscieA4, type ScenaA4, type TypKlocka, type Uklad } from "../src/a4/typy";
import { formatujCzas } from "../src/czas";
import { api, urlPliku, type StanA4 } from "./api";
import { ArrowDown, ChevronDown, ChevronUp, Merge, Music, Plus, RefreshCw, Sparkles, Upload, Video, Wand2, X } from "lucide-react";

const I = { className: "ikona", strokeWidth: 1.75 };

export const NAZWY_KLOCKOW: Record<TypKlocka, string> = {
  naglowek: "Nagłówek",
  etykieta: "Etykieta",
  kafel: "Kafel",
  lista: "Lista",
  licznik: "Licznik",
  pasek: "Pasek postępu",
  strzalka: "Strzałka",
  podswietlenie: "Zakreślenie",
  cytat: "Cytat",
  ikona: "Duża ikona",
  obraz: "Obraz",
  siatka: "Siatka",
  "linia-czasu": "Linia czasu",
  porownanie: "Porównanie",
};

/** Które pola pokazać w formularzu danego klocka. */
const POLA: Record<TypKlocka, (keyof Klocek)[]> = {
  naglowek: ["tekst", "akcent"],
  etykieta: ["tekst"],
  kafel: ["ikona", "tekst", "podpis"],
  lista: ["punkty"],
  licznik: ["wartosc", "prefiks", "sufiks", "podpis"],
  pasek: ["tekst", "wartosc"],
  strzalka: ["tekst"],
  podswietlenie: ["tekst", "akcent"],
  cytat: ["tekst", "podpis"],
  ikona: ["ikona", "podpis"],
  obraz: ["src", "podpis"],
  siatka: ["punkty"],
  "linia-czasu": ["punkty"],
  porownanie: ["lewo", "prawo"],
};

const ETYKIETY_POL: Partial<Record<keyof Klocek, string>> = {
  tekst: "Tekst",
  akcent: "Wyróżniony fragment",
  podpis: "Podpis",
  ikona: "Ikona (emoji albo logo:claude)",
  wartosc: "Liczba",
  prefiks: "Przed liczbą",
  sufiks: "Po liczbie",
  punkty: "Punkty (każdy w osobnej linii)",
  src: "Plik obrazu w folderze projektu",
};

let licznik = 0;
const nowyId = () => `k${Date.now().toString(36)}${(licznik++).toString(36)}`;

const FormularzKlocka: React.FC<{ k: Klocek; onZmiana: (k: Klocek) => void; onUsun: () => void; onWyzej?: () => void }> = ({ k, onZmiana, onUsun, onWyzej }) => (
  <div className="klocek-edycja">
    <div className="klocek-naglowek">
      <select value={k.typ} onChange={(e) => onZmiana({ ...k, typ: e.target.value as TypKlocka })} aria-label="Rodzaj klocka">
        {TYPY_KLOCKOW.map((t) => (
          <option key={t} value={t}>
            {NAZWY_KLOCKOW[t]}
          </option>
        ))}
      </select>
      <input className="wejscie-slowo" value={k.wejscie ?? ""} onChange={(e) => onZmiana({ ...k, wejscie: e.target.value || undefined })} placeholder="wchodzi na słowie…" title="Słowo z Twojej wypowiedzi, przy którym klocek się pojawia" />
      {onWyzej && (
        <button className="btn maly cichy ikonowy" title="Zamień z poprzednim" aria-label="Zamień z poprzednim" onClick={onWyzej}>
          <ArrowDown {...I} style={{ transform: "rotate(180deg)" }} />
        </button>
      )}
      <button className="btn maly cichy ikonowy niebezpieczny" title="Usuń klocek" aria-label="Usuń klocek" onClick={onUsun}>
        <X {...I} />
      </button>
    </div>
    <div className="wiersz dwa">
      {POLA[k.typ].map((pole) => {
        if (pole === "punkty") {
          return (
            <div className="pole" key={pole} style={{ gridColumn: "1 / -1" }}>
              <label>{ETYKIETY_POL.punkty}</label>
              <textarea value={(k.punkty ?? []).join("\n")} onChange={(e) => onZmiana({ ...k, punkty: e.target.value.split("\n") })} rows={3} />
            </div>
          );
        }
        if (pole === "lewo" || pole === "prawo") {
          const strona = k[pole] ?? { naglowek: "", punkty: [] };
          return (
            <div className="pole" key={pole}>
              <label>{pole === "lewo" ? "Lewa strona (źle)" : "Prawa strona (dobrze)"}</label>
              <input value={strona.naglowek} onChange={(e) => onZmiana({ ...k, [pole]: { ...strona, naglowek: e.target.value } })} placeholder="nagłówek" />
              <textarea value={strona.punkty.join("\n")} onChange={(e) => onZmiana({ ...k, [pole]: { ...strona, punkty: e.target.value.split("\n") } })} rows={3} placeholder="punkty, każdy w linii" />
            </div>
          );
        }
        const wartosc = k[pole];
        return (
          <div className="pole" key={pole}>
            <label>{ETYKIETY_POL[pole]}</label>
            <input
              type={pole === "wartosc" ? "number" : "text"}
              value={wartosc === undefined ? "" : String(wartosc)}
              onChange={(e) => onZmiana({ ...k, [pole]: pole === "wartosc" ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value || undefined })}
            />
          </div>
        );
      })}
    </div>
  </div>
);

const WierszSceny: React.FC<{
  scena: ScenaA4;
  numer: number;
  aktywna: boolean;
  zajete: boolean;
  maEkran: boolean;
  ostatnia: boolean;
  onKlik: () => void;
  onZmiana: (s: ScenaA4) => void;
  onPolacz: () => void;
  onPrzebuduj: (opis: string) => void;
}> = ({ scena, numer, aktywna, zajete, maEkran, ostatnia, onKlik, onZmiana, onPolacz, onPrzebuduj }) => {
  const [rozwin, setRozwin] = useState(false);
  const [opis, setOpis] = useState(scena.opis ?? "");
  useEffect(() => setOpis(scena.opis ?? ""), [scena.opis]);
  const zmienKlocek = (i: number, k: Klocek) => onZmiana({ ...scena, klocki: scena.klocki.map((x, j) => (j === i ? k : x)) });
  return (
    <div className={`scena ${aktywna ? "aktywna" : ""}`} onClick={onKlik}>
      <div className="rail">
        <span className="numer">{numer}</span>
        {!ostatnia && (
          <button className="btn maly cichy ikonowy" title="Połącz z następną sceną" aria-label="Połącz z następną sceną" onClick={onPolacz}>
            <Merge {...I} />
          </button>
        )}
      </div>
      <div className="karta cialo">
        <div className="naglowek-sceny">
          <select className="uklad-wybor" value={scena.uklad} onChange={(e) => onZmiana({ ...scena, uklad: e.target.value as Uklad })} aria-label="Układ kadru">
            {UKLADY.filter((u) => maEkran || !u.startsWith("ekran")).map((u) => (
              <option key={u} value={u}>
                {NAZWY_UKLADOW[u]}
              </option>
            ))}
          </select>
          <span className="male">
            {formatujCzas(scena.od)}–{formatujCzas(scena.do)}
          </span>
          <span className="rozciagnij" />
          <button className="btn maly cichy" onClick={() => setRozwin((v) => !v)}>
            Klocki ({scena.klocki.length}) {rozwin ? <ChevronUp {...I} /> : <ChevronDown {...I} />}
          </button>
        </div>
        <p className="wypowiedz">„{scena.tekst}”</p>
        <div className="pole opis-pole">
          <textarea value={opis} onChange={(e) => setOpis(e.target.value)} placeholder="Co ma być widać w tej scenie" />
        </div>
        <div className="pasek-akcji">
          <button className={`btn maly ${opis.trim() !== (scena.opis ?? "").trim() ? "glowny" : ""}`} disabled={zajete || !opis.trim()} onClick={() => onPrzebuduj(opis)} title="Claude przebuduje scenę według opisu">
            <Sparkles {...I} /> Przebuduj według opisu
          </button>
          <select value={scena.przejscie ?? "auto"} onChange={(e) => onZmiana({ ...scena, przejscie: e.target.value as PrzejscieA4 })} title="Dźwięk na wejściu sceny" aria-label="Przejście">
            <option value="auto">świst przy zmianie układu</option>
            <option value="swist">zawsze świst</option>
            <option value="brak">bez świstu</option>
          </select>
        </div>
        {rozwin && (
          <div className="szczegoly">
            {scena.klocki.map((k, i) => (
              <FormularzKlocka
                key={k.id}
                k={k}
                onZmiana={(n) => zmienKlocek(i, n)}
                onUsun={() => onZmiana({ ...scena, klocki: scena.klocki.filter((_, j) => j !== i) })}
                onWyzej={i > 0 ? () => onZmiana({ ...scena, klocki: scena.klocki.map((x, j) => (j === i - 1 ? scena.klocki[i] : j === i ? scena.klocki[i - 1] : x)) }) : undefined}
              />
            ))}
            <button className="btn maly" style={{ marginBottom: 10 }} onClick={() => onZmiana({ ...scena, klocki: [...scena.klocki, { id: nowyId(), typ: "naglowek", tekst: "" }] })}>
              <Plus {...I} /> Dodaj klocek
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/** Wgranie jednego źródła: plik z przeglądarki albo ścieżka na dysku (szybciej przy dużych plikach). */
const Wgrywanie: React.FC<{ rodzaj: "kamera" | "ekran"; zajete: boolean; onPlik: (f: File) => void; onSciezka: (s: string) => void }> = ({ rodzaj, zajete, onPlik, onSciezka }) => {
  const [sciezka, setSciezka] = useState("");
  return (
    <div className="wgrywanie">
      <label className={`btn ${zajete ? "wylaczony" : ""}`}>
        <Upload {...I} /> {rodzaj === "kamera" ? "Wgraj nagranie z kamery" : "Wgraj nagranie ekranu"}
        <input
          type="file"
          accept="video/*,.mov,.mp4,.m4v"
          hidden
          disabled={zajete}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onPlik(f);
          }}
        />
      </label>
      <span className="male">albo ścieżka:</span>
      <input className="wejscie" value={sciezka} onChange={(e) => setSciezka(e.target.value)} placeholder="~/Movies/surowka.mov" />
      <button className="btn" disabled={zajete || !sciezka.trim()} onClick={() => onSciezka(sciezka.trim())}>
        Weź z dysku
      </button>
    </div>
  );
};

export const EdytorExplainera: React.FC<{
  projekt: Scenariusz;
  aktywnaScena?: string;
  onAktywnaScena: (id: string) => void;
  zmien: (p: Scenariusz) => void;
  odswiez: () => Promise<void>;
  setKomunikat: (k: { typ: "info" | "ok" | "blad"; tekst: string } | null) => void;
}> = ({ projekt, aktywnaScena, onAktywnaScena, zmien, odswiez, setKomunikat }) => {
  const dane: DaneA4 = projekt.a4 ?? { sceny: [] };
  const [stan, setStan] = useState<StanA4 | null>(null);
  const [opisMuzyki, setOpisMuzyki] = useState(dane.muzyka?.opis && dane.muzyka.opis !== "własny plik" ? dane.muzyka.opis : "");
  const zajete = stan?.stan === "pracuje";
  const zmienDane = (d: Partial<DaneA4>) => zmien({ ...projekt, a4: { ...dane, ...d } });

  // Stan pracy w tle: przy wejściu w projekt i co półtorej sekundy, dopóki serwer pracuje.
  useEffect(() => {
    let zywy = true;
    api.stanA4(projekt.id).then((s) => zywy && setStan(s)).catch(() => {});
    return () => {
      zywy = false;
    };
  }, [projekt.id]);
  useEffect(() => {
    if (stan?.stan !== "pracuje") return;
    const t = window.setInterval(async () => {
      const s = await api.stanA4(projekt.id).catch(() => null);
      if (!s) return;
      setStan(s);
      if (s.stan !== "pracuje") {
        await odswiez();
        setKomunikat({ typ: s.stan === "blad" ? "blad" : "ok", tekst: s.komunikat ?? "" });
      }
    }, 1500);
    return () => window.clearInterval(t);
  }, [stan?.stan, projekt.id, odswiez, setKomunikat]);

  const uruchom = async (co: () => Promise<StanA4 | Scenariusz>) => {
    try {
      setKomunikat(null);
      const w = await co();
      if ("stan" in w && typeof w.stan === "string" && ["pracuje", "gotowe", "blad", "brak"].includes(w.stan)) setStan(w as StanA4);
      else await odswiez();
    } catch (e) {
      setKomunikat({ typ: "blad", tekst: (e as Error).message });
    }
  };

  const zmienScene = (id: string, s: ScenaA4) => zmienDane({ sceny: dane.sceny.map((x) => (x.id === id ? s : x)) });
  const polacz = (i: number) => {
    const a = dane.sceny[i];
    const b = dane.sceny[i + 1];
    if (!b) return;
    const razem: ScenaA4 = { ...a, do: b.do, tekst: `${a.tekst} ${b.tekst}`, klocki: [...a.klocki, ...b.klocki].slice(0, 5), opis: [a.opis, b.opis].filter(Boolean).join(" ") };
    zmienDane({ sceny: [...dane.sceny.slice(0, i), razem, ...dane.sceny.slice(i + 2)] });
  };

  return (
    <div className="explainer">
      {zajete && (
        <div className="komunikat info">
          <span className="kreci" />
          <span>
            <strong>{stan?.komunikat}</strong>
            <span className="male" style={{ color: "inherit", opacity: 0.8 }}> Minuta nagrania to zwykle pół minuty do minuty pracy.</span>
          </span>
        </div>
      )}

      <div className="karta sekcja">
        <h2>
          <Video {...I} /> Nagranie
        </h2>
        {dane.kamera ? (
          <p className="male">
            Kamera: <strong style={{ color: "var(--ink)" }}>{dane.kamera.nazwa ?? dane.kamera.plik}</strong>, {formatujCzas(dane.kamera.czas)}, {dane.kamera.szer}×{dane.kamera.wys}
            {dane.raport ? ` · ${dane.raport}` : ""}
          </p>
        ) : (
          <p className="male">Wgraj nagranie, w którym mówisz do kamery. Maszynka spisze, co mówisz, wytnie pauzy i powtórki, a potem zaplanuje obraz do każdego zdania.</p>
        )}
        <Wgrywanie rodzaj="kamera" zajete={zajete} onPlik={(f) => uruchom(() => api.wgrajWideo(projekt.id, f, "kamera"))} onSciezka={(s) => uruchom(() => api.wideoZDysku(projekt.id, s, "kamera"))} />
        {dane.kamera && (
          <div className="pasek-akcji" style={{ marginTop: 10 }}>
            <button className="btn maly" disabled={zajete} onClick={() => confirm("Przetworzyć nagranie od nowa? Twoje poprawki w planie scen przepadną.") && uruchom(() => api.przetworzA4(projekt.id))}>
              <RefreshCw {...I} /> Przetwórz od nowa
            </button>
            <button className="btn maly" disabled={zajete || !dane.slowa?.length} onClick={() => confirm("Zaplanować obraz od nowa? Cięcia zostają, plan scen zostanie zastąpiony.") && uruchom(() => api.przetworzA4(projekt.id, true))}>
              <Wand2 {...I} /> Zaplanuj obraz od nowa
            </button>
          </div>
        )}

        <details className="drugie-zrodlo" open={!!dane.ekran || !!dane.zEkranem}>
          <summary>Drugie źródło: nagranie ekranu albo Zooma (opcjonalnie)</summary>
          {dane.ekran ? (
            <>
              <p className="male">
                Ekran: <strong style={{ color: "var(--ink)" }}>{dane.ekran.nazwa ?? dane.ekran.plik}</strong>, {formatujCzas(dane.ekran.czas)}. Dopasowanie po dźwięku
                {dane.ekran.pewnosc !== undefined ? `, pewność ${Math.round(dane.ekran.pewnosc * 100)}%` : ""}.
              </p>
              <div className="suwak-synchro">
                <label className="male">Przesunięcie ekranu względem kamery</label>
                <input type="range" min={dane.ekran.przesuniecie - 3} max={dane.ekran.przesuniecie + 3} step={0.04} value={dane.ekran.przesuniecie} onChange={(e) => zmienDane({ ekran: { ...dane.ekran!, przesuniecie: Number(e.target.value) } })} />
                <input type="number" step={0.04} value={dane.ekran.przesuniecie} onChange={(e) => zmienDane({ ekran: { ...dane.ekran!, przesuniecie: Number(e.target.value) || 0 } })} />
                <span className="male">s</span>
                <button className="btn maly" disabled={zajete} onClick={() => uruchom(() => api.synchronizujA4(projekt.id))}>
                  <RefreshCw {...I} /> Dopasuj jeszcze raz
                </button>
              </div>
              <p className="male">Odtwórz podgląd w scenie z nagraniem ekranu i sprawdź, czy ruch ust i slajdy zgadzają się z głosem. Suwak przesuwa o 0,04 s, czyli o klatkę.</p>
            </>
          ) : (
            <p className="male">Gdy pokazujesz prezentację albo coś na ekranie, wgraj też to nagranie. Maszynka dopasuje je do kamery po dźwięku, a w planie pojawią się układy z nagraniem ekranu.</p>
          )}
          <Wgrywanie rodzaj="ekran" zajete={zajete} onPlik={(f) => uruchom(() => api.wgrajWideo(projekt.id, f, "ekran"))} onSciezka={(s) => uruchom(() => api.wideoZDysku(projekt.id, s, "ekran"))} />
        </details>
      </div>

      <div className="karta sekcja">
        <h2>
          <Music {...I} /> Dźwięk
        </h2>
        <label className="przelacznik">
          <input type="checkbox" checked={dane.swisty !== false} onChange={(e) => zmienDane({ swisty: e.target.checked })} /> Świst przy każdej zmianie układu kadru
        </label>
        <div className="wgrywanie" style={{ marginTop: 10 }}>
          <input className="wejscie" value={opisMuzyki} onChange={(e) => setOpisMuzyki(e.target.value)} placeholder="Nastrój podkładu, np. spokojny, nowoczesny, ciepłe klawisze" />
          <button className="btn" disabled={zajete || !dane.kamera} onClick={() => uruchom(() => api.muzykaA4(projekt.id, opisMuzyki))}>
            <Sparkles {...I} /> {dane.muzyka ? "Wygeneruj inny" : "Wygeneruj podkład"}
          </button>
          <label className={`btn ${zajete ? "wylaczony" : ""}`} title="Własny plik muzyki">
            <Upload {...I} /> Własny plik
            <input
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uruchom(() => api.muzykaPlikA4(projekt.id, f));
              }}
            />
          </label>
        </div>
        {dane.muzyka && (
          <div className="suwak-synchro" style={{ marginTop: 10 }}>
            <audio controls src={urlPliku(projekt.id, dane.muzyka.plik)} />
            <label className="male">Głośność</label>
            <input type="range" min={0} max={0.5} step={0.01} value={dane.muzyka.glosnosc} onChange={(e) => zmienDane({ muzyka: { ...dane.muzyka!, glosnosc: Number(e.target.value) } })} />
            <span className="male">{Math.round(dane.muzyka.glosnosc * 100)}%</span>
            <button className="btn maly cichy niebezpieczny" onClick={() => zmienDane({ muzyka: undefined })}>
              <X {...I} /> Bez podkładu
            </button>
          </div>
        )}
      </div>

      <h2 className="tytul-sekcji">Plan scen {dane.sceny.length ? <span className="male">· {dane.sceny.length} scen · kliknij scenę, a podgląd do niej przeskoczy</span> : null}</h2>
      {!dane.sceny.length && !zajete && <div className="pusty" style={{ padding: "24px 20px" }}>Plan pojawi się tu po przetworzeniu nagrania.</div>}
      {dane.sceny.map((s, i) => (
        <WierszSceny
          key={s.id}
          scena={s}
          numer={i + 1}
          aktywna={aktywnaScena === s.id}
          zajete={zajete}
          maEkran={!!dane.ekran}
          ostatnia={i === dane.sceny.length - 1}
          onKlik={() => onAktywnaScena(s.id)}
          onZmiana={(n) => zmienScene(s.id, n)}
          onPolacz={() => polacz(i)}
          onPrzebuduj={(opis) => uruchom(() => api.przebudujSceneA4(projekt.id, s.id, opis))}
        />
      ))}
    </div>
  );
};
