/**
 * GymnastTuningPanel – Leva-baserad dev-panel som live-tweakar gymnasten.
 *
 * Aktiveras bara när URL:n innehåller `?tune=1`, annars renderas ingenting.
 * Alla värden persisteras via useGymnastTuning (localStorage) så tweaks
 * överlever reload.
 */
import { useEffect } from "react";
import { Leva, useControls, button } from "leva";
import { useGymnastTuning } from "../store/useGymnastTuning";

function isTuningEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("tune");
}

function TuningControls() {
  const tuning = useGymnastTuning();

  // Färger
  const colors = useControls(
    "Färger",
    {
      skin:    { value: tuning.colors.skin,    label: "Hud" },
      hair:    { value: tuning.colors.hair,    label: "Hår" },
      leotard: { value: tuning.colors.leotard, label: "Leotard" },
      ribbon:  { value: tuning.colors.ribbon,  label: "Band" },
      lip:     { value: tuning.colors.lip,     label: "Läpp" },
      pupil:   { value: tuning.colors.pupil,   label: "Pupill" },
      eyebrow: { value: tuning.colors.eyebrow, label: "Ögonbryn" },
    },
    { collapsed: true },
  );

  // Ögon
  const eyes = useControls(
    "Ögon",
    {
      azimuthDeg:  { value: tuning.eyes.azimuthDeg,  min: 0, max: 40, step: 0.5, label: "Azimut°" },
      yFrac:       { value: tuning.eyes.yFrac,       min: -0.3, max: 0.3, step: 0.005, label: "Y-offset" },
      radius:      { value: tuning.eyes.radius,      min: 0.004, max: 0.030, step: 0.0005, label: "Grund-radie" },
      scaleX:      { value: tuning.eyes.scaleX,      min: 0.5, max: 2.5, step: 0.05, label: "Bredd" },
      scaleY:      { value: tuning.eyes.scaleY,      min: 0.3, max: 1.5, step: 0.05, label: "Höjd" },
      scaleZ:      { value: tuning.eyes.scaleZ,      min: 0.1, max: 1.2, step: 0.05, label: "Utbuktning" },
      pupilRadius: { value: tuning.eyes.pupilRadius, min: 0.0010, max: 0.012, step: 0.0002, label: "Pupill-radie" },
      catchLight:  { value: tuning.eyes.catchLight, label: "Ljusreflex" },
    },
    { collapsed: false },
  );

  // Ögonbryn
  const eyebrows = useControls(
    "Ögonbryn",
    {
      yFrac:     { value: tuning.eyebrows.yFrac,     min: 0.0, max: 0.45, step: 0.005, label: "Y-offset" },
      zFrac:     { value: tuning.eyebrows.zFrac,     min: -1.05, max: -0.7, step: 0.005, label: "Z-offset" },
      xFrac:     { value: tuning.eyebrows.xFrac,     min: 0.1, max: 0.5, step: 0.005, label: "X-offset" },
      length:    { value: tuning.eyebrows.length,    min: 0.005, max: 0.06, step: 0.001, label: "Längd" },
      thickness: { value: tuning.eyebrows.thickness, min: 0.0005, max: 0.006, step: 0.0002, label: "Tjocklek" },
      tiltDeg:   { value: tuning.eyebrows.tiltDeg,   min: -25, max: 25, step: 0.5, label: "Lutning°" },
    },
    { collapsed: true },
  );

  // Mun
  const mouth = useControls(
    "Mun",
    {
      yFrac:      { value: tuning.mouth.yFrac,      min: -0.5, max: 0.1, step: 0.005, label: "Y-offset" },
      zFrac:      { value: tuning.mouth.zFrac,      min: -1.05, max: -0.75, step: 0.005, label: "Z-offset" },
      radius:     { value: tuning.mouth.radius,     min: 0.008, max: 0.05, step: 0.001, label: "Bredd" },
      tubeRadius: { value: tuning.mouth.tubeRadius, min: 0.0005, max: 0.008, step: 0.0002, label: "Läpp-tjocklek" },
    },
    { collapsed: true },
  );

  // Näsa
  const nose = useControls(
    "Näsa",
    {
      yFrac:      { value: tuning.nose.yFrac,      min: -0.25, max: 0.15, step: 0.005, label: "Y-offset" },
      zFrac:      { value: tuning.nose.zFrac,      min: -1.15, max: -0.8, step: 0.005, label: "Z-offset" },
      length:     { value: tuning.nose.length,     min: 0.01, max: 0.08, step: 0.001, label: "Längd" },
      baseRadius: { value: tuning.nose.baseRadius, min: 0.003, max: 0.025, step: 0.0005, label: "Bas-radie" },
    },
    { collapsed: true },
  );

  // Hår
  const hair = useControls(
    "Hår",
    {
      skullcapThetaFrac: { value: tuning.hair.skullcapThetaFrac, min: 0.15, max: 0.55, step: 0.005, label: "Fram-täckning" },
      skullcapScaleY:    { value: tuning.hair.skullcapScaleY,    min: 0.9,  max: 1.4,  step: 0.01,  label: "Höjd-skala" },
      bunRadiusFrac:     { value: tuning.hair.bunRadiusFrac,     min: 0.15, max: 0.7,  step: 0.01,  label: "Knut-storlek" },
      bunZFrac:          { value: tuning.hair.bunZFrac,          min: 0.7,  max: 1.5,  step: 0.01,  label: "Knut bakåt" },
    },
    { collapsed: true },
  );

  // Torso-profil (kosmetisk – ändrar bara bålens rendering)
  const torso = useControls(
    "Torso-profil",
    {
      hipWidth:      { value: tuning.torso.hipWidth,      min: 0.6, max: 1.5, step: 0.02, label: "Höft-bredd" },
      waistNarrow:   { value: tuning.torso.waistNarrow,   min: 0.4, max: 1.2, step: 0.02, label: "Midje-smalhet" },
      chestWidth:    { value: tuning.torso.chestWidth,    min: 0.8, max: 1.8, step: 0.02, label: "Bröst-bredd" },
      shoulderWidth: { value: tuning.torso.shoulderWidth, min: 0.8, max: 1.9, step: 0.02, label: "Axel-bredd" },
    },
    { collapsed: true },
  );

  // Återställ till defaults
  useControls({
    "Återställ alla": button(() => useGymnastTuning.getState().reset()),
    "Dumpa JSON": button(() => {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(useGymnastTuning.getState(), null, 2));
    }),
  });

  // Skriv tillbaka ändringar till store (en-vägs synk)
  useEffect(() => { useGymnastTuning.getState().update("colors",   colors);   }, [colors]);
  useEffect(() => { useGymnastTuning.getState().update("eyes",     eyes);     }, [eyes]);
  useEffect(() => { useGymnastTuning.getState().update("eyebrows", eyebrows); }, [eyebrows]);
  useEffect(() => { useGymnastTuning.getState().update("mouth",    mouth);    }, [mouth]);
  useEffect(() => { useGymnastTuning.getState().update("nose",     nose);     }, [nose]);
  useEffect(() => { useGymnastTuning.getState().update("hair",     hair);     }, [hair]);
  useEffect(() => { useGymnastTuning.getState().update("torso",    torso);    }, [torso]);

  return null;
}

/** Rendras alltid – själva Leva-UI:t syns bara om `?tune=1`. */
export function GymnastTuningPanel() {
  const enabled = isTuningEnabled();
  if (!enabled) return null;
  return (
    <>
      <Leva collapsed={false} titleBar={{ title: "Gymnast-tuner" }} />
      <TuningControls />
    </>
  );
}

