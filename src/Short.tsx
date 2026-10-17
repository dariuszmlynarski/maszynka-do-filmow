import React from "react";
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import type { TransitionPresentation } from "@remotion/transitions";
import type { PropsRolki, Scena } from "./typy";
import { klatkiSceny, maPrzejscie, OGON_KONCOWY, PRZEJSCIE_KLATKI } from "./czas";
import { Tlo, Podpis, KontekstNapisow, KontekstSlow } from "./sceny/wspolne";
import { punch } from "./ruch";
import { Napisy } from "./sceny/Napisy";
import { KontekstKadru, kadrFormatu, useKadr } from "./kadr";
import { EkranCta, EkranKarta, EkranKod, EkranLiczba, EkranLista, EkranPorownanie, EkranTytul } from "./sceny/Ekrany";
import { Ekran3D, Tlo3D } from "./sceny/Ekran3D";
import { EkranWykres } from "./sceny/Wykres";
import { EkranCzat, EkranFormularz, EkranPrzegladarka, EkranTelefon } from "./sceny/Makiety";
import { CZCIONKA, KOLOR } from "./marka";

const Ekran: React.FC<{ scena: Scena }> = ({ scena }) => {
  const e = scena.ekran;
  switch (e.typ) {
    case "tytul":
      return <EkranTytul ekran={e} />;
    case "lista":
      return <EkranLista ekran={e} />;
    case "karta":
      return <EkranKarta ekran={e} />;
    case "liczba":
      return <EkranLiczba ekran={e} />;
    case "porownanie":
      return <EkranPorownanie ekran={e} />;
    case "cta":
      return <EkranCta ekran={e} />;
    case "wykres":
      return <EkranWykres ekran={e} />;
    case "3d":
      return <Ekran3D ekran={e} />;
    case "kod":
      return <EkranKod ekran={e} />;
    case "telefon":
      return <EkranTelefon ekran={e} />;
    case "czat":
      return <EkranCzat ekran={e} />;
    case "przegladarka":
      return <EkranPrzegladarka ekran={e} />;
    case "formularz":
      return <EkranFormularz ekran={e} />;
    default:
      return null;
  }
};

/**
 * O tyle klatek wyprzedzamy czas w PIERWSZEJ scenie, żeby jej elementy były już
 * po animacji wejścia w klatce zerowej. Bez tego rolka otwiera się pustym kadrem —
 * a to właśnie ta klatka jest miniaturą w feedzie i pierwszym, co widz zobaczy
 * przed naciśnięciem play. Najdłuższe wejście w scenie tytułowej kończy się
 * około 31. klatki, więc 45 daje zapas także dla zakreślenia akcentu.
 */
const START_BEZ_WJAZDU = 45;

const SceneWidok: React.FC<{ scena: Scena; bazaUrl: string; napisy: boolean; pierwsza?: boolean }> = ({ scena, bazaUrl, napisy, pierwsza }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Uderzenie kamery na wejściu sceny: lekkie zbliżenie, które opada.
  // Zostaje także w pierwszej scenie — to jest ten „huk", nie wjazd z pustego.
  const skala = punch(frame, fps, [0], 0.03);
  const k = useKadr();
  const tresc = (
    <KontekstNapisow.Provider value={napisy}>
      <KontekstSlow.Provider value={scena.audio?.slowa}>
        <Ekran scena={scena} />
      </KontekstSlow.Provider>
    </KontekstNapisow.Provider>
  );
  return (
    <Tlo>
      {scena.tlo3d && <Tlo3D ksztalt={scena.tlo3d} />}
      <Podpis />
      <AbsoluteFill style={{ transform: `scale(${skala})`, transformOrigin: `${k.szer / 2}px ${k.wys / 2}px` }}>
        {pierwsza ? (
          // Ujemne `from` przesuwa wyłącznie czas ekranu. Audio i napisy zostają
          // na swoim miejscu, bo leżą poza tą sekwencją.
          <Sequence from={-START_BEZ_WJAZDU} layout="none">
            {tresc}
          </Sequence>
        ) : (
          tresc
        )}
      </AbsoluteFill>
      {napisy && <Napisy slowa={scena.audio?.slowa} lektor={scena.lektor} />}
      {scena.audio && <Audio src={`${bazaUrl}/${scena.audio.plik}`} />}
      {/* Efekt dźwiękowy jest tłem dla lektora, nie może go zagłuszać. */}
      {scena.efektAudio && <Audio src={`${bazaUrl}/${scena.efektAudio.plik}`} volume={0.13} />}
    </Tlo>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prezentacja = (rodzaj: Scena["przejscie"]): TransitionPresentation<any> => {
  switch (rodzaj) {
    case "slide":
      return slide({ direction: "from-right" });
    case "wipe":
      return wipe({ direction: "from-left" });
    default:
      return fade();
  }
};

export const Short: React.FC<PropsRolki> = ({ scenariusz, bazaUrl }) => {
  if (!scenariusz.sceny.length) {
    return (
      <Tlo>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: CZCIONKA.tekst, color: KOLOR.muted, fontSize: 48 }}>
          Brak scen w scenariuszu
        </AbsoluteFill>
      </Tlo>
    );
  }

  const elementy: React.ReactNode[] = [];
  const ostatnia = scenariusz.sceny.length - 1;
  scenariusz.sceny.forEach((scena, i) => {
    // Ostatnia scena dostaje ogon, żeby zakończenie zdążyło wybrzmieć.
    const klatki = klatkiSceny(scena) + (i === ostatnia ? Math.round(OGON_KONCOWY * 30) : 0);
    elementy.push(
      <TransitionSeries.Sequence key={scena.id} durationInFrames={klatki}>
        <SceneWidok scena={scena} bazaUrl={bazaUrl} napisy={scenariusz.napisy} pierwsza={i === 0} />
      </TransitionSeries.Sequence>,
    );
    if (i < scenariusz.sceny.length - 1 && maPrzejscie(scena)) {
      elementy.push(
        <TransitionSeries.Transition
          key={`${scena.id}-p`}
          presentation={prezentacja(scena.przejscie)}
          timing={linearTiming({ durationInFrames: PRZEJSCIE_KLATKI })}
        />,
      );
    }
  });

  return (
    <KontekstKadru.Provider value={kadrFormatu(scenariusz.format)}>
      <TransitionSeries>{elementy}</TransitionSeries>
    </KontekstKadru.Provider>
  );
};
