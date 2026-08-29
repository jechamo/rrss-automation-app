import type { AiEngine, AiResult, AiTask, TestResult } from "./engine";
import { simulateMockProvider } from "@/core/testing/mock-runtime";

export class MockFixtureMissingError extends Error {
  readonly code = "E2E_CAPABILITY_UNMOCKED";

  constructor() {
    super("E2E_CAPABILITY_UNMOCKED: no existe una respuesta simulada para esta capacidad.");
    this.name = "MockFixtureMissingError";
  }
}

export class MockAiEngine implements AiEngine {
  readonly id = "claude-cli" as const;

  async test(): Promise<TestResult> {
    await simulateMockProvider("claude");
    return { ok: true, detail: "Motor simulado local activo." };
  }

  async run(task: AiTask): Promise<AiResult> {
    const data = fixtureFor(task);
    if (data === undefined) throw new MockFixtureMissingError();
    await simulateMockProvider("claude");
    if (/descubrir competidores|investigador de mercado|contenido viral/iu.test(task.system ?? "")) {
      await simulateMockProvider("web-search");
    }
    const text = JSON.stringify(data);
    return { data, text, raw: text };
  }
}

function fixtureFor(task: AiTask): unknown | undefined {
  const system = task.system ?? "";
  const localUrl = process.env.RRSS_E2E_FIXTURE_URL ?? "http://localhost:41731/fixture";

  if (system.includes("analista de negocio y marketing experto")) {
    return {
      negocio: "Estudio local que automatiza contenido para redes sociales",
      propuestaValor: "Convierte una appweb en contenido revisable sin publicar automáticamente",
      marca: { tono: "claro", voz: "práctica", identidad: "tecnología local y control humano" },
      ctas: ["Crear proyecto", "Revisar contenido"],
      puntosDolor: ["Falta de tiempo", "Procesos manuales dispersos"],
      pros: ["Ejecución local", "Flujo trazable"],
      contras: ["Requiere herramientas opcionales"],
      publicoObjetivo: "Equipos pequeños y creadores que operan sus propias apps",
      funcionalidades: ["Dossier", "Análisis de mercado", "Generación de contenido"],
      nicho: "automatización de contenido",
    };
  }
  if (system.includes("arquitecto de informacion experto")) {
    return {
      summary: "Mapa funcional simulado",
      audience: "operador local",
      maxDepth: 3,
      warnings: [],
      roots: [{
        id: "inicio",
        label: "Inicio",
        description: "Página fixture",
        route: localUrl,
        surface: "page",
        actions: [],
        requiresLogin: false,
        roles: [],
        conditions: [],
        evidence: ["fixture local"],
        verification: "pending",
        children: [],
      }],
    };
  }
  if (system.includes("descubrir competidores directos")) {
    return { competidores: [{ nombre: "Competidor Fixture", url: `${localUrl}/competidor`, motivo: "Mismo público" }] };
  }
  if (system.includes("analista competitivo experto")) {
    return {
      resumen: "Mercado simulado estable",
      competidores: [{
        nombre: "Competidor Fixture",
        url: `${localUrl}/competidor`,
        propuestaValor: "Planificación de contenido",
        precios: "no disponible",
        pros: ["Sencillez"],
        contras: ["Menor control local"],
        diferenciadores: "RRSS Studio conserva los datos localmente",
        scores: { producto: 3, presenciaRRSS: 2, amenaza: 2, justificacion: "Fixture sin actividad externa" },
      }],
      ventajas: ["Control local"],
      amenazas: ["Mercado competido"],
      oportunidades: ["Privacidad y trazabilidad"],
    };
  }
  if (system.includes("estratega de captacion de clientes")) {
    return {
      resumen: "Oportunidad local simulada",
      zona: "Madrid",
      perfilObjetivo: "Estudios digitales pequeños",
      personas: [{ nombre: "Responsable digital", rol: "decisor", dolores: ["poco tiempo"], trigger: "necesita publicar" }],
      estrategiaGlobal: ["Demostración corta"],
    };
  }
  if (system.includes("investigador de mercado que localiza")) {
    return { leads: [{
      nombre: "Lead Fixture",
      tipo: "estudio digital",
      direccion: "Madrid",
      web: `${localUrl}/lead`,
      telefono: "",
      email: "",
      motivo: "Encaje simulado",
    }] };
  }
  if (system.includes("experto en captacion comercial")) {
    return {
      resumen: "Captación simulada",
      zona: "Madrid",
      personas: [],
      estrategiaGlobal: ["Contacto directo"],
      leads: [{
        nombre: "Lead Fixture",
        tipo: "estudio digital",
        direccion: "Madrid",
        web: `${localUrl}/lead`,
        telefono: "",
        email: "",
        motivo: "Encaje simulado",
        temperatura: "templado",
        canalRecomendado: "correo",
        estrategia: "Mostrar un recorrido local",
        borrador: { asunto: "Demo local", cuerpo: "¿Quieres ver el flujo?" },
        fitScore: 4,
        intentScore: 2,
        scoreRazon: "Fixture con encaje y sin señal de compra",
      }],
    };
  }
  if (system.includes("analista de contenido viral de redes sociales")) {
    return { virales: [{
      url: `${localUrl}/viral`,
      plataforma: "youtube",
      titulo: "Viral Fixture",
      autor: "Autor Fixture",
      vistas: "10000",
      fecha: "2026-08-01",
      ratioAutor: 2,
      viralScore: 75,
      formato: "tutorial corto",
      motivo: "Hook claro",
    }] };
  }
  if (system.includes("analista experto en contenido viral")) {
    return {
      nicho: "automatización de contenido",
      criterio: { metrica: "views", umbral: 1000, ventanaDias: 30 },
      virales: [{
        url: `${localUrl}/viral`,
        plataforma: "youtube",
        titulo: "Viral Fixture",
        autor: "Autor Fixture",
        vistas: "10000",
        fecha: "2026-08-01",
        ratioAutor: 2,
        viralScore: 75,
        formato: "tutorial corto",
        hook: { tipo: "promesa", texto: "Resultado visible", segundos: 3 },
        estructura: [{ bloque: "hook", desde: 0, hasta: 3, nota: "Promesa" }],
        shareTrigger: "utilidad",
        porQueFunciona: "Resultado inmediato",
        patronTransferible: "Mostrar antes y después",
      }],
      patronesRecurrentes: [{ patron: "Resultado primero", frecuencia: "1/1", comoAplicar: "Abrir con el resultado" }],
    };
  }
  if (system.includes("Reinterpretas el")) return contentFixture(false);
  if (system.includes("estratega de producto y contenido")) {
    return { funciones: [{
      nombre: "Crear un proyecto",
      descripcion: "Analiza una appweb local",
      url: localUrl,
      pasos: ["Abrir fixture", "Revisar resultado"],
      evidencias: ["fixture local"],
      confianza: "alta",
      navSteps: [{ action: "goto", url: localUrl }],
    }] };
  }
  if (system.includes("muestra producto") || system.includes("product-led")) return contentFixture(true);
  return undefined;
}

function contentFixture(demo: boolean): unknown {
  return {
    plataforma: "tiktok",
    patronAplicado: demo ? "demostración del resultado" : "resultado primero",
    notaLegal: demo ? "Contenido propio que muestra nuestra app." : "Concepto reinterpretado para nuestra marca; no reproduce el video original.",
    guion: {
      gancho: "Mira el resultado antes del proceso",
      desarrollo: "Un recorrido local y controlado",
      cta: "Revisa tu proyecto",
      locucion: "Mira cómo convertimos una app en un dossier revisable.",
      hashtags: ["#automatizacion"],
      duracionTotal: 12,
    },
    escaleta: demo
      ? [{ n: 1, descripcion: "GRABACION de pantalla", prompt: "", texto: "Resultado", segundos: 6 }]
      : [{ n: 1, descripcion: "Panel local", prompt: "vertical local software dashboard", texto: "Resultado", segundos: 5 }],
  };
}
