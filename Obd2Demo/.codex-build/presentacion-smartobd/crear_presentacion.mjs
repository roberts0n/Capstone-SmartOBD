import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const SKILL_DIR = "C:/Users/Roberto/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations";
const workspaceDir = "C:/SmartOBD/Obd2Demo";
const buildDir = path.join(workspaceDir, ".codex-build/presentacion-smartobd");
const sourceDir = path.join(buildDir, "source");
const stagingDir = path.join(workspaceDir, ".codex-finalizer");
const finalPath = path.join(workspaceDir, "entregables/SmartOBD_presentacion_actualizada_taller.pptx");
const pythonExecutable = "C:/Users/Roberto/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
process.env.RUNTIME_NODE_MODULES = "C:/Users/Roberto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
process.env.RUNTIME_NODE = "C:/Users/Roberto/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe";

const { makeNativeBulletParagraphs, finalizePresentation } = await import(
  pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href,
);

const W = 1440;
const H = 810;
const FONT = "Calibri";
const COLOR_FONDO = "#D6E8EF";
const COLOR_TEXTO = "#19374D";
const COLOR_CAJA = "#416882";
const COLOR_CAJA_CLARA = "#6998AB";
const COLOR_CAJA_OSCURA = "#385468";
const COLOR_BLANCO = "#F8FBFC";
const COLOR_ROJO = "#E64B55";

function agregarRectangulo(slide, position, fill) {
  return slide.shapes.add({
    geometry: "rect",
    position,
    fill,
    line: { fill: "none", width: 0 },
  });
}

function agregarTexto(slide, texto, position, opciones = {}) {
  const caja = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  caja.text = texto;
  caja.text.style = {
    typeface: opciones.typeface ?? FONT,
    fontSize: opciones.fontSize ?? 22,
    bold: opciones.bold ?? false,
    color: opciones.color ?? COLOR_TEXTO,
    alignment: opciones.alignment ?? "left",
    verticalAlignment: opciones.verticalAlignment ?? "top",
    autoFit: opciones.autoFit ?? "shrinkText",
    wrap: "square",
    insets: opciones.insets ?? { top: 2, right: 4, bottom: 2, left: 4 },
  };
  return caja;
}

function agregarLista(slide, items, position, opciones = {}) {
  const caja = slide.shapes.add({
    geometry: "textbox",
    position,
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  caja.text = makeNativeBulletParagraphs(items, {
    marginLeftPoints: opciones.marginLeftPoints ?? 18,
    hangingPoints: opciones.hangingPoints ?? 9,
    spaceAfterPoints: opciones.spaceAfterPoints ?? 8,
  });
  caja.text.style = {
    typeface: FONT,
    fontSize: opciones.fontSize ?? 19,
    bold: opciones.bold ?? false,
    color: opciones.color ?? COLOR_TEXTO,
    alignment: opciones.alignment ?? "left",
    verticalAlignment: opciones.verticalAlignment ?? "top",
    autoFit: opciones.autoFit ?? "shrinkText",
    wrap: "square",
    insets: opciones.insets ?? { top: 2, right: 4, bottom: 2, left: 4 },
  };
  return caja;
}

const presentation = Presentation.create({ slideSize: { width: W, height: H } });

for (let numero = 1; numero <= 12; numero += 1) {
  const slide = presentation.slides.add();
  const nombre = `pagina-${String(numero).padStart(2, "0")}.png`;
  const bytes = await fs.readFile(path.join(sourceDir, nombre));
  slide.images.add({
    blob: bytes,
    contentType: "image/png",
    alt: `Diseño original de la diapositiva ${numero}`,
    fit: "cover",
    position: { left: 0, top: 0, width: W, height: H },
  });

  if (numero === 1) {
    agregarTexto(
      slide,
      "Diagnóstico asistido y gestión para talleres",
      { left: 585, top: 531, width: 700, height: 42 },
      { fontSize: 25, bold: true, alignment: "center", verticalAlignment: "middle" },
    );
  }

  if (numero === 3) {
    agregarRectangulo(slide, { left: 145, top: 225, width: 1165, height: 125 }, COLOR_FONDO);
    agregarTexto(
      slide,
      "En muchos talleres, los antecedentes del cliente, la información del vehículo y los resultados del escáner quedan separados. Esto retrasa el traspaso desde recepción al mecánico y dificulta mantener un historial claro de cada diagnóstico.",
      { left: 155, top: 235, width: 1140, height: 100 },
      { fontSize: 23, alignment: "center", verticalAlignment: "middle" },
    );

    agregarRectangulo(slide, { left: 147, top: 376, width: 522, height: 351 }, COLOR_CAJA_CLARA);
    agregarTexto(slide, "Impacto operacional", { left: 158, top: 388, width: 500, height: 42 }, { fontSize: 27, bold: true });
    agregarLista(
      slide,
      [
        "Información de clientes, vehículos y diagnósticos dispersa.",
        "Traspaso manual de antecedentes entre recepción y mecánicos.",
        "Poco seguimiento de casos, asignaciones e historial.",
      ],
      { left: 165, top: 438, width: 480, height: 245 },
      { fontSize: 19, spaceAfterPoints: 11 },
    );

    agregarRectangulo(slide, { left: 766, top: 376, width: 522, height: 351 }, COLOR_CAJA_CLARA);
    agregarTexto(slide, "Impacto en el taller", { left: 780, top: 388, width: 490, height: 42 }, { fontSize: 27, bold: true });
    agregarLista(
      slide,
      [
        "Más tiempo para reunir y contextualizar antecedentes.",
        "Datos OBD-II difíciles de relacionar con el motivo de ingreso.",
        "Menor trazabilidad de decisiones y evidencias del diagnóstico.",
      ],
      { left: 790, top: 438, width: 465, height: 245 },
      { fontSize: 19, spaceAfterPoints: 11 },
    );
  }

  if (numero === 4) {
    agregarRectangulo(slide, { left: 118, top: 122, width: 1320, height: 207 }, COLOR_FONDO);
    agregarTexto(
      slide,
      "SmartOBD propone una aplicación Android para talleres que integra el registro del cliente y su vehículo, la lectura OBD-II, el apoyo del chatbot y la asignación del diagnóstico al personal del taller.",
      { left: 126, top: 132, width: 1188, height: 82 },
      { fontSize: 22, alignment: "center", verticalAlignment: "middle" },
    );

    const tarjetas = [
      { x: 17, w: 374, texto: "REGISTRO DE USUARIOS,\nCLIENTES Y VEHÍCULOS\nPARA CENTRALIZAR LOS\nANTECEDENTES DEL TALLER." },
      { x: 400, w: 342, texto: "CONEXIÓN CON ELM327\nPARA OBTENER DATOS\nREALES DEL VEHÍCULO Y\nCÓDIGOS DE FALLA." },
      { x: 748, w: 342, texto: "CHATBOT DE APOYO PARA\nEXPLICAR RESULTADOS,\nPROPONER VERIFICACIONES\nY ORDENAR EL DIAGNÓSTICO." },
      { x: 1097, w: 333, texto: "GESTIÓN DE CASOS,\nHISTORIAL Y ASIGNACIÓN\nENTRE RECEPCIÓN Y\nMECÁNICOS." },
    ];
    for (const tarjeta of tarjetas) {
      agregarRectangulo(slide, { left: tarjeta.x + 10, top: 420, width: tarjeta.w - 20, height: 236 }, COLOR_CAJA);
      agregarTexto(
        slide,
        tarjeta.texto,
        { left: tarjeta.x + 20, top: 430, width: tarjeta.w - 40, height: 215 },
        { fontSize: 17.5, color: COLOR_BLANCO, alignment: "center", verticalAlignment: "middle", bold: false },
      );
    }
  }

  if (numero === 5) {
    const tarjetas = [
      { x: 23, w: 244, items: ["REACT NATIVE", "TYPESCRIPT", "ANDROID / METRO"] },
      { x: 314, w: 266, items: ["BLUETOOTH / BLE", "ELM327", "COMANDOS AT Y OBD-II"] },
      { x: 619, w: 240, items: ["LECTURAS Y DTC", "REGISTRO E HISTORIAL", "CHATBOT (PLANIFICADO)"] },
      { x: 879, w: 270, items: ["JEST / TESTS", "VALIDACIÓN DE SERVICIOS", "MANEJO DE ERRORES"] },
      { x: 1171, w: 232, items: ["GIT / GITHUB", "SUPABASE (PLANIFICADO)", "ANDROID STUDIO / GRADLE"] },
    ];
    for (const tarjeta of tarjetas) {
      agregarRectangulo(slide, { left: tarjeta.x + 2, top: 505, width: tarjeta.w - 4, height: 190 }, COLOR_CAJA);
      agregarLista(
        slide,
        tarjeta.items,
        { left: tarjeta.x + 14, top: 528, width: tarjeta.w - 28, height: 145 },
        { fontSize: 15.5, color: COLOR_BLANCO, marginLeftPoints: 14, hangingPoints: 7, spaceAfterPoints: 8 },
      );
    }
  }

  if (numero === 6) {
    const parrafos = [
      {
        rect: { left: 238, top: 248, width: 535, height: 127 },
        text: "Aborda una necesidad real del taller y combina desarrollo móvil, comunicación con hardware, gestión de información y asistencia inteligente en un mismo sistema.",
      },
      {
        rect: { left: 832, top: 248, width: 568, height: 127 },
        text: "Al personal de recepción, mecánicos y administradores del taller. El cliente se beneficia mediante una atención más ordenada y con mayor trazabilidad.",
      },
      {
        rect: { left: 238, top: 503, width: 535, height: 165 },
        text: "En talleres automotrices que reciben vehículos compatibles con OBD-II y necesitan centralizar antecedentes, lecturas del escáner y seguimiento del diagnóstico.",
      },
      {
        rect: { left: 832, top: 503, width: 568, height: 165 },
        text: "Conecta la recepción del vehículo con el trabajo técnico. Reúne antecedentes, datos OBD-II, historial y asignaciones, con un chatbot que apoya la interpretación.",
      },
    ];
    for (const item of parrafos) {
      agregarRectangulo(slide, item.rect, COLOR_FONDO);
      agregarTexto(slide, item.text, item.rect, { fontSize: 20.5, verticalAlignment: "top" });
    }
  }

  if (numero === 7) {
    const columnas = [
      { x: 82, items: ["BASE BLUETOOTH Y OBD-II YA FUNCIONAL.", "ARQUITECTURA MODULAR CON PRUEBAS.", "DESARROLLO INCREMENTAL POR MÓDULOS."] },
      { x: 412, items: ["TELÉFONOS ANDROID Y ESCÁNER ELM327.", "VEHÍCULOS REALES PARA VALIDACIÓN.", "GITHUB Y PLAN GRATUITO DE SUPABASE."] },
      { x: 739, items: ["PLANIFICACIÓN ORGANIZADA EN 18 SEMANAS.", "NÚCLEO OBD-II VALIDADO.", "INTEGRACIÓN PROGRESIVA DEL SISTEMA DE TALLER."] },
      { x: 1065, items: ["COMPATIBILIDAD ENTRE ESCÁNERES Y VEHÍCULOS.", "DEPENDENCIA DE PRUEBAS EN TALLER.", "SEGURIDAD DE DATOS Y PERMISOS POR ROL."] },
    ];
    for (const columna of columnas) {
      agregarRectangulo(slide, { left: columna.x + 1, top: 386, width: 286, height: 237 }, "#19374D");
      agregarLista(
        slide,
        columna.items,
        { left: columna.x + 15, top: 397, width: 258, height: 215 },
        { fontSize: 14.5, bold: true, color: COLOR_BLANCO, marginLeftPoints: 14, hangingPoints: 7, spaceAfterPoints: 17 },
      );
    }
  }

  if (numero === 8) {
    agregarRectangulo(slide, { left: 630, top: 136, width: 780, height: 225 }, COLOR_FONDO);
    agregarTexto(
      slide,
      "Objetivo general",
      { left: 650, top: 145, width: 720, height: 55 },
      { typeface: "Century", fontSize: 32, color: COLOR_TEXTO, alignment: "center", verticalAlignment: "middle" },
    );
    agregarTexto(
      slide,
      "Diseñar e implementar una aplicación Android para talleres que centralice la recepción del vehículo y la información del diagnóstico OBD-II, mantenga su trazabilidad y apoye el análisis mediante un chatbot dirigido al personal del taller.",
      { left: 650, top: 207, width: 730, height: 130 },
      { fontSize: 20, verticalAlignment: "top" },
    );

    agregarRectangulo(slide, { left: 638, top: 430, width: 770, height: 356 }, COLOR_FONDO);
    agregarLista(
      slide,
      [
        "Gestionar el acceso de administradores, recepción y mecánicos mediante roles.",
        "Registrar clientes, vehículos, motivos de ingreso y casos de diagnóstico.",
        "Conectar el escáner ELM327 para leer e interpretar información OBD-II.",
        "Conservar evidencias e historial asociados a cada vehículo y diagnóstico.",
        "Asignar casos al personal mecánico y apoyar la organización del trabajo.",
        "Integrar un chatbot de apoyo y validar el sistema con pruebas automatizadas y vehículos reales.",
      ],
      { left: 646, top: 438, width: 748, height: 336 },
      { fontSize: 17.5, marginLeftPoints: 17, hangingPoints: 8, spaceAfterPoints: 7 },
    );
  }

  if (numero === 9) {
    agregarRectangulo(slide, { left: 124, top: 216, width: 504, height: 512 }, "#19374D");
    agregarTexto(slide, "SCRUM", { left: 160, top: 230, width: 430, height: 55 }, { fontSize: 31, bold: true, color: COLOR_BLANCO, alignment: "center", verticalAlignment: "middle" });
    agregarLista(
      slide,
      [
        "Desarrollo incremental por sprints.",
        "Backlog organizado por módulos funcionales.",
        "Revisión periódica del repositorio y los avances.",
        "Priorización según el flujo del taller y el valor para sus usuarios.",
        "Integración progresiva de pantallas, servicios y backend.",
      ],
      { left: 145, top: 326, width: 458, height: 335 },
      { fontSize: 17.5, color: COLOR_BLANCO, marginLeftPoints: 18, hangingPoints: 9, spaceAfterPoints: 15 },
    );

    agregarRectangulo(slide, { left: 690, top: 216, width: 585, height: 512 }, "#19374D");
    agregarTexto(slide, "VALIDACIÓN DEL SISTEMA", { left: 730, top: 230, width: 495, height: 55 }, { fontSize: 27, bold: true, color: COLOR_BLANCO, alignment: "center", verticalAlignment: "middle" });
    agregarLista(
      slide,
      [
        "Pruebas unitarias de reglas del sistema e interpretación OBD-II.",
        "Validación de Bluetooth y ELM327 en vehículos reales.",
        "Pruebas de autenticación, roles y persistencia de información.",
        "Comprobación del flujo desde recepción hasta el mecánico.",
        "Registro de fallas y regresión antes de cada entrega.",
      ],
      { left: 724, top: 326, width: 505, height: 335 },
      { fontSize: 17.5, color: COLOR_BLANCO, marginLeftPoints: 18, hangingPoints: 9, spaceAfterPoints: 15 },
    );
  }

  if (numero === 10) {
    const filas = [
      {
        y: 293,
        fill: "#FFFFFF",
        tipo: "Avance",
        nombre: "Conexión y gestión del escáner",
        descripcion: "Búsqueda Bluetooth/BLE, selección del dispositivo y comunicación con el servicio ELM327.",
      },
      {
        y: 398,
        fill: "#F1F3F8",
        tipo: "Avance",
        nombre: "Lectura e interpretación OBD-II",
        descripcion: "Identificación del vehículo, detección de parámetros compatibles y lectura de datos y códigos de falla.",
      },
      {
        y: 500,
        fill: "#FFFFFF",
        tipo: "Avance",
        nombre: "Pruebas automatizadas",
        descripcion: "Validación de servicios, interpretación de respuestas, manejo de errores y regresiones.",
      },
      {
        y: 603,
        fill: "#F1F3F8",
        tipo: "Validación real",
        nombre: "Núcleo OBD-II validado",
        descripcion: "Conexión, identificación, parámetros y DTC comprobados en vehículos reales. Continúa la integración del sistema de taller.",
      },
    ];
    for (const fila of filas) {
      agregarRectangulo(slide, { left: 250, top: fila.y + 2, width: 138, height: 98 }, fila.fill);
      agregarRectangulo(slide, { left: 390, top: fila.y + 2, width: 319, height: 98 }, fila.fill);
      agregarRectangulo(slide, { left: 711, top: fila.y + 2, width: 580, height: 98 }, fila.fill);
      agregarTexto(slide, fila.tipo, { left: 260, top: fila.y + 16, width: 118, height: 65 }, { fontSize: 13.5, bold: true, color: fila.tipo === "Validación real" ? "#46A36D" : COLOR_TEXTO, alignment: "center", verticalAlignment: "middle" });
      agregarTexto(slide, fila.nombre, { left: 405, top: fila.y + 13, width: 289, height: 72 }, { fontSize: 13.8, bold: true, alignment: "center", verticalAlignment: "middle" });
      agregarTexto(slide, fila.descripcion, { left: 728, top: fila.y + 10, width: 545, height: 78 }, { fontSize: 13.2, alignment: "left", verticalAlignment: "middle" });
    }
  }

  if (numero === 11) {
    const etiquetas = [
      { y: 294, texto: "Definición y arquitectura" },
      { y: 353, texto: "Núcleo OBD-II" },
      { y: 409, texto: "Usuarios y datos del taller" },
      { y: 471, texto: "Casos, asignación y chatbot" },
      { y: 528, texto: "Integración y pruebas" },
      { y: 584, texto: "Validación real y cierre" },
    ];
    for (const etiqueta of etiquetas) {
      agregarRectangulo(slide, { left: 83, top: etiqueta.y, width: 288, height: 43 }, COLOR_FONDO);
      agregarTexto(slide, etiqueta.texto, { left: 88, top: etiqueta.y + 3, width: 278, height: 36 }, { fontSize: 14.5, bold: true, color: "#111111", alignment: "center", verticalAlignment: "middle" });
    }
  }
}

await fs.mkdir(stagingDir, { recursive: true });
await fs.mkdir(path.dirname(finalPath), { recursive: true });
const candidatePath = path.join(stagingDir, "SmartOBD_presentacion_actualizada_taller.candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const requirements = {
  explicitTotalSlideCount: 12,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
};

await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "13716000,7715250",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
  ],
  requiredNativeTableOwnerSlides: [],
  fontPolicy: { basis: "design", families: [FONT, "Century"] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "SmartOBD_presentacion_actualizada_taller.validation.json"),
});

console.log(finalPath);
