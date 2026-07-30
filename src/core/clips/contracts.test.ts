import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDirectImportedTranscript,
  applyImportedAlignment,
  parseTimestamp,
  parseImportedClipPlan,
  selectClipMoments,
  selectionFromImportedPlan,
  subtitleCuesForMoment,
} from "./contracts.js";

test("interpreta segundos y timecodes sin inventar valores", () => {
  assert.equal(parseTimestamp(12.5), 12.5);
  assert.equal(parseTimestamp("01:12.5"), 72.5);
  assert.equal(parseTimestamp("1:02:03"), 3723);
  assert.equal(parseTimestamp("no-es-tiempo"), 0);
});

test("selecciona rankings sólidos y descarta baja confianza", () => {
  const selection = selectClipMoments({
    summary: "Debate con varios cambios de postura.",
    language: "es",
    transcript: [
      { start: 20, end: 25, text: "No estoy de acuerdo con esa idea." },
      { start: 25, end: 35, text: "La evidencia demuestra lo contrario." },
    ],
    moments: [
      {
        id: "debate",
        title: "Choque frontal",
        start: 20,
        end: 42,
        viralScore: 86,
        controversyScore: 94,
        confidence: 91,
        hook: "No estoy de acuerdo",
        evidence: "La evidencia demuestra lo contrario",
        whyViral: "Conflicto inmediato y comprensible.",
        whyControversial: "Contradice una creencia extendida.",
        risk: "medium",
      },
      {
        id: "relleno",
        title: "Transición",
        start: 60,
        end: 80,
        viralScore: 40,
        controversyScore: 45,
        confidence: 92,
        hook: "Seguimos",
        evidence: "Ahora vamos al siguiente tema",
        whyViral: "No hay señal suficiente.",
      },
    ],
  }, 120);

  assert.equal(selection.moments.length, 1);
  assert.deepEqual(selection.topViral, ["debate"]);
  assert.deepEqual(selection.topControversial, ["debate"]);
  assert.equal(selection.rejectedCount, 1);
});

test("elimina candidatos muy solapados y conserva el de mayor calidad", () => {
  const base = {
    viralScore: 80,
    controversyScore: 70,
    confidence: 80,
    hook: "Una frase fuerte",
    evidence: "Evidencia verificable",
    whyViral: "Tiene un giro claro.",
    whyControversial: "Provoca desacuerdo.",
  };
  const selection = selectClipMoments({
    moments: [
      { ...base, id: "mejor", title: "Mejor", start: 10, end: 40, viralScore: 95 },
      { ...base, id: "duplicado", title: "Duplicado", start: 12, end: 39 },
      { ...base, id: "distinto", title: "Distinto", start: 70, end: 95 },
    ],
  }, 120);

  assert.deepEqual(selection.moments.map((moment) => moment.id), ["mejor", "distinto"]);
});

test("genera subtítulos relativos al inicio del corte", () => {
  const selection = selectClipMoments({
    transcript: [
      { start: 30, end: 34, text: "Primera frase" },
      { start: 34, end: 39, text: "Segunda frase" },
    ],
    moments: [{
      id: "clip",
      title: "Clip",
      start: 30,
      end: 50,
      viralScore: 90,
      controversyScore: 70,
      confidence: 90,
      hook: "Primera frase",
      evidence: "Primera frase",
      whyViral: "Hook claro.",
      whyControversial: "Opinión fuerte.",
    }],
  }, 80);
  const cues = subtitleCuesForMoment(selection, selection.moments[0]);

  assert.deepEqual(cues.map((cue) => [cue.start, cue.end]), [[0, 4], [4, 9]]);
});

test("importa el JSON editorial sin recalcular rankings ni cortes", () => {
  const plan = parseImportedClipPlan({
    top_10_virales: [{
      ranking: 1,
      start_time: "01:05:45",
      end_time: "01:06:18",
      hook_inicial: "Este juego no es lo que prometieron.",
      transcripcion_completa: "Este juego no es lo que prometieron y ahora voy a explicar por qué.",
      justificacion: "Conflicto inmediato y promesa de explicación.",
    }],
    top_10_polemicos: [{
      ranking: 1,
      start_time: "01:05:45",
      end_time: "01:06:18",
      hook_inicial: "Este juego no es lo que prometieron.",
      transcripcion_completa: "Este juego no es lo que prometieron y ahora voy a explicar por qué.",
      justificacion: "Cuestiona frontalmente su marketing.",
    }],
  });
  const selection = selectionFromImportedPlan(plan, 4_000);

  assert.equal(selection.source, "json");
  assert.equal(selection.moments.length, 1);
  assert.deepEqual(selection.topViral, selection.topControversial);
  assert.equal(selection.moments[0].start, 3_945);
  assert.equal(selection.moments[0].duration, 33);
});

test("alinea el texto importado y evita mezclar cues de otros cortes", () => {
  const plan = parseImportedClipPlan({
    top_10_virales: [{
      ranking: 1,
      start_time: "00:00:20",
      end_time: "00:00:40",
      hook_inicial: "No es lo que prometieron.",
      transcripcion_completa: "No es lo que prometieron y esta es la razón principal.",
      justificacion: "Abre un conflicto claro.",
    }],
  });
  const base = selectionFromImportedPlan(plan, 120);
  const moment = base.moments[0];
  const aligned = applyImportedAlignment(base, {
    alignments: [{
      id: moment.id,
      match: 94,
      correctedTranscript: "No es lo que prometieron y esta es la razón principal.",
      cues: [
        { start: 20, end: 24, text: "No es lo que prometieron" },
        { start: 24.2, end: 29, text: "y esta es la razón principal" },
      ],
    }],
  });

  assert.equal(aligned.moments[0].alignmentScore, 94);
  assert.deepEqual(
    subtitleCuesForMoment(aligned, aligned.moments[0]).map((cue) => [cue.start, cue.end]),
    [[0, 4], [4.2, 9]],
  );
});

test("bloquea un JSON cuyo texto no coincide con el audio alineado", () => {
  const plan = parseImportedClipPlan({
    top_10_polemicos: [{
      ranking: 1,
      start_time: "00:00:20",
      end_time: "00:00:40",
      hook_inicial: "La regulación siempre funciona.",
      transcripcion_completa: "La regulación siempre funciona y no existe ninguna excepción.",
      justificacion: "Provoca debate.",
    }],
  });
  const base = selectionFromImportedPlan(plan, 120);
  assert.throws(() => applyImportedAlignment(base, {
    alignments: [{
      id: base.moments[0].id,
      match: 30,
      correctedTranscript: "Hoy vamos a cocinar una receta con verduras.",
      cues: [{ start: 20, end: 30, text: "Hoy vamos a cocinar una receta con verduras." }],
    }],
  }), /no coincide suficientemente/);
});

test("usa directamente los subtítulos sincronizados del nuevo JSON sin Gemini", () => {
  const plan = parseImportedClipPlan({
    top_10_virales: [{
      ranking: 1,
      start_time: "00:01:00",
      end_time: "00:01:20",
      hook_inicial: "Esta es una prueba determinista.",
      transcripcion_completa: "Esta es una prueba determinista con subtítulos ya temporizados.",
      justificacion: "Permite probar el montaje sin consumir Gemini.",
      subtitulos_sincronizados: [
        { start_time: "00:01:00", end_time: "00:01:07", texto: "Esta es una prueba determinista." },
        { start_time: "00:01:09", end_time: "00:01:20", texto: "Los tiempos vienen exactamente del JSON." },
      ],
    }],
  });
  const direct = applyDirectImportedTranscript(selectionFromImportedPlan(plan, 180));
  const moment = direct.moments[0];
  const cues = subtitleCuesForMoment(direct, moment);

  assert.equal(moment.subtitleSource, "synced_json");
  assert.deepEqual(cues.map((cue) => [cue.start, cue.end, cue.text]), [
    [0, 7, "Esta es una prueba determinista."],
    [9, 20, "Los tiempos vienen exactamente del JSON."],
  ]);
});

test("mantiene el reparto proporcional para JSON anteriores sin cues sincronizados", () => {
  const plan = parseImportedClipPlan({
    top_10_virales: [{
      ranking: 1,
      start_time: "00:01:00",
      end_time: "00:01:20",
      hook_inicial: "Esta es una prueba directa.",
      transcripcion_completa: "Esta es una prueba directa que conserva el texto y reparte sus frases dentro del intervalo aportado.",
      justificacion: "Permite probar el montaje sin consumir Gemini.",
    }],
  });
  const base = selectionFromImportedPlan(plan, 180);
  const direct = applyDirectImportedTranscript(base);
  const moment = direct.moments[0];
  const cues = subtitleCuesForMoment(direct, moment);

  assert.equal(direct.jsonTiming, "direct");
  assert.equal(moment.start, 60);
  assert.equal(moment.end, 80);
  assert.equal(moment.alignmentScore, undefined);
  assert.equal(moment.subtitleSource, "transcript_fallback");
  assert.equal(cues[0].start, 0);
  assert.equal(cues.at(-1)?.end, 20);
  assert.equal(cues.map((cue) => cue.text).join(" "), moment.sourceTranscript);
});

test("rechaza subtítulos sincronizados solapados o fuera del corte", () => {
  assert.throws(() => parseImportedClipPlan({
    top_10_polemicos: [{
      ranking: 1,
      start_time: "00:00:20",
      end_time: "00:00:40",
      hook_inicial: "Un corte polémico.",
      transcripcion_completa: "Texto suficiente para validar el corte polémico.",
      justificacion: "Genera debate.",
      subtitulos_sincronizados: [
        { start_time: "00:00:20", end_time: "00:00:30", texto: "Primer cue." },
        { start_time: "00:00:29", end_time: "00:00:35", texto: "Cue solapado." },
      ],
    }],
  }), /solapan o no están ordenados/);

  assert.throws(() => parseImportedClipPlan({
    top_10_virales: [{
      ranking: 1,
      start_time: "00:00:20",
      end_time: "00:00:40",
      hook_inicial: "Un corte viral.",
      transcripcion_completa: "Texto suficiente para validar el corte viral.",
      justificacion: "Puede compartirse.",
      subtitulos_sincronizados: [
        { start_time: "00:00:19", end_time: "00:00:25", texto: "Cue fuera del corte." },
      ],
    }],
  }), /queda fuera del corte/);
});

test("rechaza cues distintos para el mismo corte compartido por ambos rankings", () => {
  const plan = parseImportedClipPlan({
    top_10_virales: [{
      ranking: 1,
      start_time: "00:00:20",
      end_time: "00:00:40",
      hook_inicial: "El mismo corte.",
      transcripcion_completa: "Una transcripción compartida por ambos rankings.",
      justificacion: "Tiene potencial viral.",
      subtitulos_sincronizados: [
        { start_time: "00:00:20", end_time: "00:00:30", texto: "Versión viral." },
      ],
    }],
    top_10_polemicos: [{
      ranking: 1,
      start_time: "00:00:20",
      end_time: "00:00:40",
      hook_inicial: "El mismo corte.",
      transcripcion_completa: "Una transcripción compartida por ambos rankings.",
      justificacion: "También genera debate.",
      subtitulos_sincronizados: [
        { start_time: "00:00:20", end_time: "00:00:30", texto: "Versión polémica." },
      ],
    }],
  });

  assert.throws(() => selectionFromImportedPlan(plan, 120), /subtítulos_sincronizados diferentes/);
});
