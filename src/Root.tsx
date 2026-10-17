import React from "react";
import { Composition } from "remotion";
import { Short } from "./Short";
import { PRZYKLAD } from "./przyklad";
import { klatkiCalosci, FPS } from "./czas";
import { SZEROKOSC, WYSOKOSC } from "./marka";
import type { PropsRolki } from "./typy";
import { Explainer, EX_FPS, EX_SZER, EX_WYS, exKlatki } from "./explainer/Explainer";
import { Dashboard, dashboardKlatki } from "./explainer/Dashboard";
import { LejkiFilm, lejkiKlatki } from "./explainer/Lejki";
import { LongevityFilm, longevityKlatki } from "./explainer/Longevity";
import { KontaktyFilm, kontaktyKlatki } from "./explainer/Kontakty";
import { ZadaniaFilm, zadaniaKlatki } from "./explainer/Zadania";
import { ZapowiedzFilm, zapowiedzKlatki } from "./explainer/Zapowiedz";
import { WynikiFilm, wynikiKlatki } from "./explainer/Wyniki";
import { FilmA4, klatkiA4, type PropsA4 } from "./a4/Film";
import { A4_FPS, A4_SZER, A4_WYS, wymiaryA4 } from "./a4/typy";
import { kadrFormatu } from "./kadr";

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="Short"
      component={Short}
      fps={FPS}
      width={SZEROKOSC}
      height={WYSOKOSC}
      durationInFrames={klatkiCalosci(PRZYKLAD)}
      defaultProps={{ scenariusz: PRZYKLAD, bazaUrl: "" } satisfies PropsRolki}
      calculateMetadata={({ props }) => ({
        durationInFrames: klatkiCalosci(props.scenariusz),
        width: kadrFormatu(props.scenariusz.format).szer,
        height: kadrFormatu(props.scenariusz.format).wys,
      })}
    />
    {/* Explainer z nagrania kamery (ścieżka A4): plan scen z dashboardu, 16:9 na YouTube. */}
    <Composition
      id="ExplainerA4"
      component={FilmA4}
      fps={A4_FPS}
      width={A4_SZER}
      height={A4_WYS}
      durationInFrames={klatkiA4(PRZYKLAD)}
      defaultProps={{ projekt: { ...PRZYKLAD, typ: "explainer", a4: { sceny: [] } }, bazaUrl: "" } satisfies PropsA4}
      calculateMetadata={({ props }) => ({ durationInFrames: klatkiA4(props.projekt), width: wymiaryA4(props.projekt.format).szer, height: wymiaryA4(props.projekt.format).wys })}
    />
    {/* Film „Czym jest lejek” do strefy partnera CNW (16:9, osobny od rolek). */}
    <Composition id="Lejki16x9" component={Explainer} fps={EX_FPS} width={EX_SZER} height={EX_WYS} durationInFrames={exKlatki()} defaultProps={{ zAwatarem: false }} />
    <Composition id="Dashboard16x9" component={Dashboard} fps={EX_FPS} width={EX_SZER} height={EX_WYS} durationInFrames={dashboardKlatki} defaultProps={{ zAwatarem: false }} />
    <Composition id="LejkiJak16x9" component={LejkiFilm} fps={EX_FPS} width={EX_SZER} height={EX_WYS} durationInFrames={lejkiKlatki} defaultProps={{ zAwatarem: false }} />
    <Composition id="Longevity16x9" component={LongevityFilm} fps={EX_FPS} width={EX_SZER} height={EX_WYS} durationInFrames={longevityKlatki} defaultProps={{ zAwatarem: false }} />
    <Composition id="Kontakty16x9" component={KontaktyFilm} fps={EX_FPS} width={EX_SZER} height={EX_WYS} durationInFrames={kontaktyKlatki} defaultProps={{ zAwatarem: false }} />
    <Composition id="Zadania16x9" component={ZadaniaFilm} fps={EX_FPS} width={EX_SZER} height={EX_WYS} durationInFrames={zadaniaKlatki} defaultProps={{ zAwatarem: false }} />
    <Composition id="Wyniki16x9" component={WynikiFilm} fps={EX_FPS} width={EX_SZER} height={EX_WYS} durationInFrames={wynikiKlatki} defaultProps={{ zAwatarem: false }} />
    <Composition id="Zapowiedz16x9" component={ZapowiedzFilm} fps={EX_FPS} width={EX_SZER} height={EX_WYS} durationInFrames={zapowiedzKlatki} defaultProps={{ zAwatarem: false }} />
    </>
  );
};
