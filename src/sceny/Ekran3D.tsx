import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import type { Ekran, Ksztalt3D } from "../typy";
import * as THREE from "three";
import { KOLOR, PISMO } from "../marka";
import { useKadr } from "../kadr";
import { Dopisek, Kicker } from "./wspolne";
import { wjazd } from "../ruch";

type E3D = Extract<Ekran, { typ: "3d" }>;

// Na ciemnym tle bryły muszą być JAŚNIEJSZE od tła, inaczej są czarnymi sylwetkami.
// Paleta brył trzyma się marki: pomarańcz i ciepła czekolada. Zieleń i czerń
// wypadły 19.09 — na renderze wyglądały jak wtręt z innego zestawu.
const KOLORY_3D = [KOLOR.accent, KOLOR.poswiata, KOLOR.lineStrong, KOLOR.accent, "#8A4A20", KOLOR.poswiata];

/** Obrys krawędzi. Bez niego bryły wyglądają jak generyczny render, a nie jak rysunek techniczny. */
const Obrys: React.FC<{ geometria: THREE.BufferGeometry; kolor?: string }> = ({ geometria, kolor = KOLOR.ink }) => {
  const krawedzie = useMemo(() => new THREE.EdgesGeometry(geometria, 25), [geometria]);
  return (
    <lineSegments geometry={krawedzie}>
      <lineBasicMaterial color={kolor} />
    </lineSegments>
  );
};

/** Matowy materiał marki: zero połysku, zero metaliczności. */
const materialMatowy = { roughness: 1, metalness: 0 } as const;

const Kostki: React.FC<{ frame: number }> = ({ frame }) => {
  const geo = useMemo(() => new THREE.BoxGeometry(1.6, 1.6, 1.6), []);
  const kostki = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        x: ((i % 3) - 1) * 2.4,
        y: (Math.floor(i / 3) - 1) * 2.4,
        kolor: KOLORY_3D[i % KOLORY_3D.length],
        faza: i * 0.7,
      })),
    [],
  );
  return (
    <group rotation={[0.32, frame * 0.012, 0]}>
      {kostki.map((k, i) => (
        <group key={i} position={[k.x, k.y + Math.sin(frame * 0.05 + k.faza) * 0.3, 0]} rotation={[frame * 0.01 + k.faza, frame * 0.015, 0]}>
          <mesh geometry={geo}>
            <meshStandardMaterial color={k.kolor} {...materialMatowy} />
          </mesh>
          <Obrys geometria={geo} />
        </group>
      ))}
    </group>
  );
};

/** Kartki papieru w przestrzeni. Płaskie bryły z obrysem, bliskie stylowi marki. */
const Kartki: React.FC<{ frame: number }> = ({ frame }) => {
  const geo = useMemo(() => new THREE.BoxGeometry(3, 1.8, 0.12), []);
  const kartki = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        x: ((i % 2) - 0.5) * 3.4,
        y: (1 - Math.floor(i / 2)) * 2.3,
        kolor: i === 2 ? KOLOR.accent : KOLOR.lineStrong,
        faza: i * 0.9,
      })),
    [],
  );
  return (
    <group rotation={[0.18, -0.22 + Math.sin(frame * 0.012) * 0.08, 0]}>
      {kartki.map((k, i) => (
        <group
          key={i}
          position={[k.x, k.y + Math.sin(frame * 0.045 + k.faza) * 0.18, Math.sin(frame * 0.03 + k.faza) * 0.25]}
          rotation={[0, 0, Math.sin(frame * 0.02 + k.faza) * 0.06]}
        >
          <mesh geometry={geo}>
            <meshStandardMaterial color={k.kolor} {...materialMatowy} />
          </mesh>
          <Obrys geometria={geo} kolor={KOLOR.inkSoft} />
        </group>
      ))}
    </group>
  );
};

const Kula: React.FC<{ frame: number }> = ({ frame }) => (
  <group rotation={[frame * 0.006, frame * 0.012, 0]}>
    <mesh>
      <sphereGeometry args={[3.2, 48, 48]} />
      <meshStandardMaterial color={KOLOR.accent} {...materialMatowy} />
    </mesh>
    <mesh scale={1.015}>
      <sphereGeometry args={[3.2, 18, 14]} />
      <meshBasicMaterial color={KOLOR.ink} wireframe transparent opacity={0.22} />
    </mesh>
  </group>
);

const Torus: React.FC<{ frame: number }> = ({ frame }) => (
  <mesh rotation={[Math.PI / 2 + Math.sin(frame * 0.02) * 0.35, frame * 0.02, 0]}>
    <torusKnotGeometry args={[2.4, 0.7, 180, 28]} />
    <meshStandardMaterial color={KOLOR.accent} {...materialMatowy} />
  </mesh>
);

const Pierscienie: React.FC<{ frame: number }> = ({ frame }) => (
  <group rotation={[0.6, frame * 0.01, 0]}>
    {[2.2, 3.2, 4.2].map((r, i) => (
      <mesh key={i} rotation={[frame * 0.01 * (i + 1), frame * 0.008, i]}>
        <torusGeometry args={[r, 0.22, 20, 80]} />
        <meshStandardMaterial color={i === 1 ? KOLOR.inkSoft : KOLORY_3D[i]} {...materialMatowy} />
      </mesh>
    ))}
    <mesh>
      <sphereGeometry args={[1.1, 32, 32]} />
      <meshStandardMaterial color={KOLOR.ink} {...materialMatowy} />
    </mesh>
  </group>
);

function bryla(ksztalt: Ksztalt3D) {
  return ksztalt === "kula"
    ? Kula
    : ksztalt === "torus"
      ? Torus
      : ksztalt === "pierscienie"
        ? Pierscienie
        : ksztalt === "kartki"
          ? Kartki
          : Kostki;
}

/**
 * Te same bryły co w scenie „3d", ale przygaszone i odsunięte w głąb — jako tło
 * pod treścią. Daje scenie głębię, której płaskie karty nie mają, i nie zabiera
 * miejsca napisom. Opacity trzymamy nisko, bo napisy na ciemnym tle tracą
 * czytelność szybciej, niż się wydaje.
 */
export const Tlo3D: React.FC<{ ksztalt: Ksztalt3D }> = ({ ksztalt }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const Ksztalt = bryla(ksztalt);
  return (
    <AbsoluteFill style={{ opacity: 0.22, transform: "scale(1.25)", pointerEvents: "none" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [0, 0, 34], fov: 38 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true, preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[4, 8, 10]} intensity={0.5} />
        <Ksztalt frame={frame} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export const Ekran3D: React.FC<{ ekran: E3D }> = ({ ekran }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const nag = wjazd(frame, 4, 60);
  const dop = wjazd(frame, 16, 40);
  const Ksztalt = bryla(ekran.ksztalt);
  const k = useKadr();

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ top: -20 }}>
        <ThreeCanvas
          width={width}
          height={height}
          camera={{ position: [0, 0, 27], fov: 38 }}
          style={{ background: "transparent" }}
          gl={{ alpha: true, preserveDrawingBuffer: true }}
        >
          {/* Miękkie światło: bryły mają zachować kolory marki, nie pociemnieć ani nie przepalić się. */}
          <ambientLight intensity={1.35} />
          <directionalLight position={[4, 8, 10]} intensity={0.55} />
          <directionalLight position={[-6, -3, 4]} intensity={0.2} />
          <Ksztalt frame={frame} />
        </ThreeCanvas>
      </AbsoluteFill>
      <div style={{ position: "absolute", top: k.safe.gora, left: k.margines, right: k.margines }}>
        {ekran.etykieta && <Kicker style={{ marginBottom: 26 }}>{ekran.etykieta}</Kicker>}
        <div
          style={{
            ...nag,
            fontFamily: "inherit",
            fontSize: PISMO.naglowek,
            fontWeight: 800,
            lineHeight: 1.06,
            letterSpacing: "-0.01em",
          }}
        >
          {ekran.naglowek}
        </div>
        {ekran.dopisek && <Dopisek style={{ ...dop, marginTop: 18 }}>{ekran.dopisek}</Dopisek>}
      </div>
    </AbsoluteFill>
  );
};
