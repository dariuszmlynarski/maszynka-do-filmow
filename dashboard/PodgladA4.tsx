import React, { useEffect, useMemo, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import type { Scenariusz } from "../src/typy";
import { FilmA4, klatkiA4 } from "../src/a4/Film";
import { A4_FPS, A4_SZER, A4_WYS } from "../src/a4/typy";
import { SERWER } from "./api";

/** Podgląd explainera 16:9 na żywo: to samo, co wyjdzie z renderu, bez renderowania. */
export const PodgladA4: React.FC<{ projekt: Scenariusz; aktywnaScena?: string }> = ({ projekt, aktywnaScena }) => {
  const ref = useRef<PlayerRef>(null);
  const props = useMemo(() => ({ projekt, bazaUrl: `${SERWER}/projekty/${projekt.id}` }), [projekt]);
  const klatki = klatkiA4(projekt);

  useEffect(() => {
    const s = projekt.a4?.sceny.find((x) => x.id === aktywnaScena);
    if (!s || !ref.current) return;
    ref.current.pause();
    ref.current.seekTo(Math.min(klatki - 1, Math.round(s.od * A4_FPS) + 15));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktywnaScena]);

  return (
    <div className="podglad-ramka poziomy">
      <Player
        ref={ref}
        component={FilmA4}
        inputProps={props}
        durationInFrames={klatki}
        fps={A4_FPS}
        compositionWidth={A4_SZER}
        compositionHeight={A4_WYS}
        style={{ width: "100%", height: "100%" }}
        controls
        clickToPlay
        doubleClickToFullscreen
        acknowledgeRemotionLicense
      />
    </div>
  );
};
