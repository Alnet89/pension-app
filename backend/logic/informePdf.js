import PDFDocument from "pdfkit";

/**
 * Genera un Buffer PDF a partir del resultado de calcularPension
 * @param {object} datosPension Resultado de calcularPension(...)
 * @param {object} opciones { tipo, fechaJubilacion, fechaUltimaBase, nacimiento }
 */
export function generarInformePdf(datosPension, opciones) {
  const { tipo } = opciones;

  console.log(">>> generarInformePdf llamado, tipo:", tipo);
  console.log(">>> claves datosPension:", Object.keys(datosPension || {}));

  // Preparar bloques según tipo
  let bloquePrincipal = null;
  let bloque25 = null;
  let bloqueNuevo = null;

  if (tipo === "jubilacion") {
    const mejor = datosPension.mejor; // "nuevo" o "25anios"
    bloque25 = datosPension.escenario25Anios;
    bloqueNuevo = datosPension.escenarioNuevo;
    bloquePrincipal = mejor === "nuevo" ? bloqueNuevo : bloque25;
  } else {
    // Incapacidad ya viene como bloque único
    bloquePrincipal = datosPension;
  }

  const detalle = bloquePrincipal.detalleBases || [];
  console.log(">>> detalleBases longitud:", detalle.length);
  console.log(">>> ejemplo detalle[0]:", detalle[0]);

  // Ordenar de más reciente a más antigua (fecha AAAA-MM)
  const detalleOrdenado = [...detalle].sort((a, b) =>
    a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0
  );

  // Separar últimas 24 (sin revalorización) del resto
  const ultimas24 = detalleOrdenado.filter(d => d.tipo === "ultima24");
  const resto = detalleOrdenado.filter(d => d.tipo !== "ultima24");

  const sumaUltimas24 = ultimas24.reduce(
    (acc, d) => acc + (d.baseActualizada || 0),
    0
  );
  const sumaResto = resto.reduce(
    (acc, d) => acc + (d.baseActualizada || 0),
    0
  );
  const sumaTotal = sumaUltimas24 + sumaResto;

  const titulo =
    tipo === "jubilacion"
      ? "Informe detallado de cálculo de pensión de jubilación"
      : "Informe detallado de cálculo de pensión de incapacidad permanente";

  const doc = new PDFDocument({ margin: 40 });
  const buffers = [];

  doc.on("data", buffers.push.bind(buffers));
  doc.on("end", () => {});

  // ===== Portada y resumen =====
  doc
    .fontSize(18)
    .fillColor("#2c3e50")
    .text(titulo, { align: "left" });

  doc.moveDown(0.5);
  doc
    .fontSize(11)
    .fillColor("black")
    .text(
      tipo === "jubilacion"
        ? "Cálculo según normativa de jubilación (24 últimas bases sin revalorización, anteriores actualizadas por IPC)."
        : "Cálculo según normativa de incapacidad permanente (24 últimas bases sin revalorización, anteriores actualizadas por IPC)."
    );

  doc.moveDown(0.5);
  doc.fontSize(11);

  if (tipo === "jubilacion" && opciones.fechaJubilacion) {
    doc.text(`Fecha de jubilación: ${opciones.fechaJubilacion}`);
  }
  if (tipo === "incapacidad" && opciones.fechaUltimaBase) {
    doc.text(
      `Última base que entra en el cálculo: ${opciones.fechaUltimaBase}`
    );
  }
  if (opciones.nacimiento) {
    doc.text(
      `Fecha de nacimiento: ${opciones.nacimiento.year}-${String(
        opciones.nacimiento.month
      ).padStart(2, "0")}`
    );
  }

 doc.moveDown();
doc
  .fontSize(13)
  .fillColor("#34495e")
  .text("Resumen del resultado");
doc.moveDown(0.3);

// Bloque de pensiones destacado
// Título del bloque en color
doc
  .fontSize(11)
  .fillColor("#1f618d")
  .font("Helvetica-Bold")
  .text("Importes de pensión:", { underline: true });

doc.moveDown(0.2);

// Pensión 100% destacada
doc
  .fillColor("#27ae60") // verde
  .font("Helvetica-Bold")
  .text(
    `Pensión en 14 pagas (escenario aplicado): ${bloquePrincipal.pension14.toFixed(2)} €`
  );

if (
  tipo === "incapacidad" &&
  bloquePrincipal.pension75 != null &&
  bloquePrincipal.pension55 != null
) {
  doc
    .fillColor("#d35400") // naranja
    .font("Helvetica-Bold")
    .text(
      `Pensión al 75% (incapacidad total): ${bloquePrincipal.pension75.toFixed(2)} €`
    );

  doc
    .fillColor("#8e44ad") // morado
    .font("Helvetica-Bold")
    .text(
      `Pensión al 55% (incapacidad total con menores de 55): ${bloquePrincipal.pension55.toFixed(2)} €`
    );
}

// Volvemos a estilo normal para el resto de datos
doc.moveDown(0.4);
doc
  .fontSize(11)
  .font("Helvetica")
  .fillColor("black");

doc.text(
  `Bases usadas en el cálculo (escenario aplicado): ${bloquePrincipal.numeroBases}`
);
doc.text(
  `Suma de bases revalorizadas (todas): ${bloquePrincipal.suma.toFixed(2)} €`
);
  // Información 24 últimas vs resto
  doc.moveDown(0.5);
  doc.text(
    `Suma de las últimas 24 bases sin revalorizar: ${sumaUltimas24.toFixed(2)} €`
  );
  doc.text(
    `Suma del resto de bases revalorizadas: ${sumaResto.toFixed(2)} €`
  );
  doc.text(
    `Total de bases usadas (24 + resto): ${sumaTotal.toFixed(2)} €`
  );

  // Comparativa de escenarios sólo en jubilación
  if (tipo === "jubilacion") {
    doc.moveDown(0.5);
    doc.text("Escenarios comparados (25 años vs nuevo sistema):");

    if (bloque25) {
      const divisor25 = bloque25.numeroBases * (14 / 12);
      doc.text(
        `- Escenario 25 años (últimas 300 bases): ${bloque25.numeroBases} bases, divisor ${divisor25.toFixed(2)}, ` +
        `pensión 14 pagas: ${bloque25.pension14.toFixed(2)} €`
      );
    }

    if (bloqueNuevo) {
      const divisorNuevo = bloqueNuevo.numeroBases * (14 / 12);
      doc.text(
        `- Escenario nuevo (calendario de transición): ${bloqueNuevo.numeroBases} bases, divisor ${divisorNuevo.toFixed(2)}, ` +
        `pensión 14 pagas: ${bloqueNuevo.pension14.toFixed(2)} €`
      );
    }

    doc.text(
      `Escenario aplicado: ${
        datosPension.mejor === "nuevo" ? "nuevo sistema" : "25 años"
      }`
    );
  }

  // ===== Detalle de bases mes a mes (escenario aplicado) =====
  doc.addPage();
  doc
    .fontSize(13)
    .fillColor("#34495e")
    .text("Detalle de bases mes a mes (escenario aplicado)");
  doc.moveDown(0.5);

  const startX = doc.x;
  let posY = doc.y;

  const colWidths = [60, 85, 80, 80, 70, 100, 45];

  const drawCell = (x, y, w, h, text, options = {}) => {
    const {
      align = "left",
      bold = false,
      fill = null,
      color = "black"
    } = options;

    if (fill) {
      doc.rect(x, y, w, h).fill(fill);
    }
    doc.fillColor(color);

    doc
      .fontSize(8)
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .text(text, x + 3, y + 3, {
        width: w - 6,
        height: h - 6,
        align,
        ellipsis: true
      });

    doc
      .strokeColor("#dddddd")
      .lineWidth(0.5)
      .rect(x, y, w, h)
      .stroke();
  };

  const headerHeight = 20;
  const headers = [
    "Mes/Año",
    "Base original",
    "Índice origen",
    "Índice destino",
    "% reval.",
    "Base revalorizada",
    "Usada"
  ];

  let currentX = startX;
  for (let i = 0; i < headers.length; i++) {
    drawCell(
      currentX,
      posY,
      colWidths[i],
      headerHeight,
      headers[i],
      { bold: true, fill: "#4a90e2", color: "white" }
    );
    currentX += colWidths[i];
  }
  posY += headerHeight;

  const rowHeight = 18;

  const drawRow = (row, index) => {
    let x = startX;

    const isEven = index % 2 === 0;
    const fillBase = isEven ? "#f7f7f7" : null;
    const isUltima24 = row.tipo === "ultima24";
    const fill = isUltima24 ? "#e0f7fa" : fillBase;
    const bold = isUltima24;

    const valores = [
      row.fecha,
      row.baseOriginal != null ? row.baseOriginal.toFixed(2) : "",
      row.indiceDesde != null ? row.indiceDesde.toFixed(3) : "",
      row.indiceHasta != null ? row.indiceHasta.toFixed(3) : "",
      row.porcentajeIncremento != null
        ? row.porcentajeIncremento.toFixed(2) + " %"
        : "",
      row.baseActualizada != null ? row.baseActualizada.toFixed(2) : "",
      row.usadaEnCalculo ? "Sí" : "No"
    ];

    for (let i = 0; i < valores.length; i++) {
      drawCell(x, posY, colWidths[i], rowHeight, valores[i], {
        fill,
        color: "black",
        bold
      });
      x += colWidths[i];
    }
    posY += rowHeight;
  };

  const maxY = doc.page.height - doc.page.margins.bottom;

  detalleOrdenado.forEach((d, idx) => {
    if (posY + rowHeight > maxY) {
      doc.addPage();
      posY = doc.y;

      let x = startX;
      for (let i = 0; i < headers.length; i++) {
        drawCell(
          x,
          posY,
          colWidths[i],
          headerHeight,
          headers[i],
          { bold: true, fill: "#4a90e2", color: "white" }
        );
        x += colWidths[i];
      }
      posY += headerHeight;
    }

    drawRow(d, idx);
  });

  // ===== Bases descartadas en el escenario nuevo =====
  if (
    tipo === "jubilacion" &&
    bloqueNuevo &&
    bloqueNuevo.basesDescartadas &&
    bloqueNuevo.basesDescartadas.length
  ) {
    doc.addPage();
    doc
      .fontSize(13)
      .fillColor("#34495e")
      .text("Bases descartadas en el escenario nuevo (tras revalorización)");
    doc.moveDown(0.5);

    const startX2 = doc.x;
    let posY2 = doc.y;
    const colWidths2 = [80, 100, 100];
    const headers2 = ["Fecha", "Base original", "Base revalorizada"];

    let cx = startX2;
    for (let i = 0; i < headers2.length; i++) {
      drawCell(
        cx,
        posY2,
        colWidths2[i],
        20,
        headers2[i],
        { bold: true, fill: "#4a90e2", color: "white" }
      );
      cx += colWidths2[i];
    }
    posY2 += 20;

    const rowHeight2 = 18;
    const maxY2 = doc.page.height - doc.page.margins.bottom;

    bloqueNuevo.basesDescartadas.forEach((d, idx) => {
      if (posY2 + rowHeight2 > maxY2) {
        doc.addPage();
        posY2 = doc.y;
        let cx2 = startX2;
        for (let i = 0; i < headers2.length; i++) {
          drawCell(
            cx2,
            posY2,
            colWidths2[i],
            20,
            headers2[i],
            { bold: true, fill: "#4a90e2", color: "white" }
          );
          cx2 += colWidths2[i];
        }
        posY2 += 20;
      }

      const fill = idx % 2 === 0 ? "#f7f7f7" : null;
      let cx3 = startX2;
      const valores = [
        d.fecha,
        d.baseOriginal != null ? d.baseOriginal.toFixed(2) : "",
        d.baseRevalorizada != null ? d.baseRevalorizada.toFixed(2) : ""
      ];
      for (let i = 0; i < valores.length; i++) {
        drawCell(cx3, posY2, colWidths2[i], rowHeight2, valores[i], {
          fill,
          color: "black"
        });
        cx3 += colWidths2[i];
      }
      posY2 += rowHeight2;
    });
  }

  doc.end();

  return new Promise((resolve) => {
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
  });
}