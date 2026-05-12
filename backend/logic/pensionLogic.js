import { cargarIPCMapa, obtenerUltimaFechaIPC } from "./ipcData.js";

export function parseFecha(fecha) {
  const [y, m] = fecha.split("-").map(Number);
  return { year: y, month: m };
}

export function formatFecha(year, month) {
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}`;
}

export function restarMeses(fecha, n) {
  let { year, month } = parseFecha(fecha);
  let total = year * 12 + (month - 1) - n;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return formatFecha(newYear, newMonth);
}

export function cmpFecha(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

// Devuelve el índice IPC para una fecha, usando:
// - valor real si existe en ipcMapa
// - extrapolación con subidaAnualFutura (anual, ej 3 -> 3%) si es posterior al último mes real
export function obtenerIndiceIPC(fecha, subidaAnualFutura, ipcMapa) {
  const real = ipcMapa[fecha];
  if (real != null) return real;

  const ultimaFecha = obtenerUltimaFechaIPC(ipcMapa);
  const idxUltReal = ipcMapa[ultimaFecha];

  if (cmpFecha(fecha, ultimaFecha) <= 0 || !subidaAnualFutura) {
    return idxUltReal;
  }

  const { year: yU, month: mU } = parseFecha(ultimaFecha);
  const { year: yF, month: mF } = parseFecha(fecha);
  const mesesDiff = (yF - yU) * 12 + (mF - mU);
  if (mesesDiff <= 0) return idxUltReal;

  const tasaMensual = subidaAnualFutura / 12 / 100;
  const factor = Math.pow(1 + tasaMensual, mesesDiff);

  return idxUltReal * factor;
}

/**
 * Versión simple (para lógica interna que no necesita detalle)
 * subidaAnualFutura: porcentaje anual (ej 3 -> 3%), opcional
 */
export function factorReval(fechaOrigen, fechaDestino, subidaAnualFutura, ipcMapa) {
  const idxO = obtenerIndiceIPC(fechaOrigen, subidaAnualFutura, ipcMapa);
  const idxD = obtenerIndiceIPC(fechaDestino, subidaAnualFutura, ipcMapa);

  if (idxD <= idxO) return 1;
  return idxD / idxO;
}

export function factorRevalDetalle(fechaOrigen, fechaDestino, subidaAnualFutura, ipcMapa) {
  const idxO = obtenerIndiceIPC(fechaOrigen, subidaAnualFutura, ipcMapa);
  const idxD = obtenerIndiceIPC(fechaDestino, subidaAnualFutura, ipcMapa);

  if (idxD <= idxO) {
    return {
      indiceDesde: idxO,
      indiceHasta: idxD,
      factor: 1,
      porcentajeIncremento: 0
    };
  }

  const factor = idxD / idxO;
  const porcentajeIncremento = (factor - 1) * 100;
  return { indiceDesde: idxO, indiceHasta: idxD, factor, porcentajeIncremento };
}

/**
 * Complemento por hijos
 */
export function calcularComplementoHijos(numHijos = 0, importePorHijo = 0) {
  return Number(numHijos || 0) * Number(importePorHijo || 0);
}

/**
 * Versión simple: solo devuelve la base revalorizada.
 */
export function revalorizarBase(baseObj, fechaDestino, subidaAnualFutura, ipcMapa) {
  const f = factorReval(baseObj.fecha, fechaDestino, subidaAnualFutura, ipcMapa);
  return baseObj.base * f;
}

/**
 * Versión con detalle: devuelve base actualizada y datos IPC.
 */
export function revalorizarBaseConDetalle(baseObj, fechaDestino, subidaAnualFutura, ipcMapa) {
  const { indiceDesde, indiceHasta, factor, porcentajeIncremento } =
    factorRevalDetalle(baseObj.fecha, fechaDestino, subidaAnualFutura, ipcMapa);

  const baseActualizada = baseObj.base * factor;

  return {
    fecha: baseObj.fecha,
    baseOriginal: baseObj.base,
    indiceDesde,
    indiceHasta,
    factor,
    porcentajeIncremento,
    baseActualizada
  };
}

/**
 * Versión simple (la que ya usabas) para 24+reval, solo valores.
 */
export function revalorizarTramoCon24Ultimas(tramo, subidaAnualFutura, ipcMapa) {
  if (tramo.length < 25) {
    throw new Error("Se necesitan al menos 25 bases para aplicar la regla 24+reval.");
  }

  const n = tramo.length;
  const ultimas24Inicio = n - 24;
  const mes25Fecha = tramo[ultimas24Inicio - 1].fecha;
  const result = [];

  for (let i = 0; i < n; i++) {
    const base = tramo[i];
    if (i >= ultimas24Inicio) {
      result.push(base.base);
    } else {
      result.push(revalorizarBase(base, mes25Fecha, subidaAnualFutura, ipcMapa));
    }
  }

  return result;
}

/**
 * Nueva versión CON DETALLE para 24+reval:
 * - devuelve un array con info por mes (para PDF)
 * - y un array de valores revalorizados para la parte matemática.
 */
export function revalorizarTramoCon24UltimasDetalle(tramo, subidaAnualFutura, ipcMapa) {
  if (tramo.length < 25) {
    throw new Error("Se necesitan al menos 25 bases para aplicar la regla 24+reval.");
  }

  const n = tramo.length;
  const ultimas24Inicio = n - 24;
  const mes25Fecha = tramo[ultimas24Inicio - 1].fecha;

  const valoresReval = [];
  const detalle = [];

  for (let i = 0; i < n; i++) {
    const base = tramo[i];

    if (i >= ultimas24Inicio) {
      valoresReval.push(base.base);
      detalle.push({
        fecha: base.fecha,
        baseOriginal: base.base,
        indiceDesde: null,
        indiceHasta: null,
        factor: 1,
        porcentajeIncremento: 0,
        baseActualizada: base.base,
        tipo: "ultima24"
      });
    } else {
      const d = revalorizarBaseConDetalle(base, mes25Fecha, subidaAnualFutura, ipcMapa);
      valoresReval.push(d.baseActualizada);
      detalle.push({
        ...d,
        tipo: "revalorizadaHastaMes25",
        fechaDestino: mes25Fecha
      });
    }
  }

  return { valoresReval, detalle };
}

export function pension14PagasDesdeSuma(sumaBases, numeroBases) {
  const divisor = numeroBases * (14 / 12);
  return sumaBases / divisor;
}

export function obtenerTramoDesdeInforme(bases, fechaCorte, mesesHaciaAtras) {
  const lista = bases.filter(b => cmpFecha(b.fecha, fechaCorte) <= 0);
  lista.sort((a, b) => cmpFecha(a.fecha, b.fecha));

  const n = lista.length;
  if (n < mesesHaciaAtras) {
    throw new Error(`No hay suficientes bases: se necesitan ${mesesHaciaAtras}, hay ${n}`);
  }

  return lista.slice(n - mesesHaciaAtras, n);
}

const paramsNuevoSistema = [
  { anyo: 2026, totales: 304, usadas: 302 },
  { anyo: 2027, totales: 308, usadas: 304 },
  { anyo: 2028, totales: 312, usadas: 306 },
  { anyo: 2029, totales: 316, usadas: 308 },
  { anyo: 2030, totales: 320, usadas: 310 },
  { anyo: 2031, totales: 324, usadas: 312 },
  { anyo: 2032, totales: 328, usadas: 314 },
  { anyo: 2033, totales: 332, usadas: 316 },
  { anyo: 2034, totales: 336, usadas: 318 },
  { anyo: 2035, totales: 340, usadas: 320 },
  { anyo: 2036, totales: 344, usadas: 322 },
  { anyo: 2037, totales: 348, usadas: 324 },
  { anyo: 2038, totales: 348, usadas: 324 },
  { anyo: 2039, totales: 348, usadas: 324 },
  { anyo: 2040, totales: 348, usadas: 324 }
];

/**
 * Jubilación: escenario genérico con detalle de bases
 */
export function calcularPensionJubilacionEscenario(
  bases,
  fechaJubilacion,
  basesTotalesTramo,
  basesUsadasFinales,
  subidaAnualFutura,
  ipcMapa
) {
  const fechaCorte = restarMeses(fechaJubilacion, 2);
  const tramo = obtenerTramoDesdeInforme(bases, fechaCorte, basesTotalesTramo);

  const { valoresReval, detalle } =
    revalorizarTramoCon24UltimasDetalle(tramo, subidaAnualFutura, ipcMapa);

  const suma = [...valoresReval]
    .sort((a, b) => b - a)
    .slice(0, basesUsadasFinales)
    .reduce((acc, v) => acc + v, 0);

  const pension14 = pension14PagasDesdeSuma(suma, basesUsadasFinales);

  const indicesOrdenados = detalle
    .map((d, idx) => ({ idx, valor: d.baseActualizada }))
    .sort((a, b) => b.valor - a.valor);

  const usados = new Set(
    indicesOrdenados.slice(0, basesUsadasFinales).map(x => x.idx)
  );

  const detalleConUso = detalle.map((d, idx) => ({
    ...d,
    usadaEnCalculo: usados.has(idx)
  }));

  const basesDescartadas = detalleConUso
    .filter(d => !d.usadaEnCalculo)
    .map(d => ({
      fecha: d.fecha,
      baseOriginal: d.baseOriginal,
      baseRevalorizada: d.baseActualizada
    }));

  return {
    suma,
    pension14,
    numeroBases: basesUsadasFinales,
    numeroBasesTotalesTramo: basesTotalesTramo,
    detalleBases: detalleConUso,
    basesDescartadas
  };
}

export function calcularPensionJubilacion(
  bases,
  fechaJubilacion,
  subidaAnualFutura = 0,
  numHijos = 0,
  importePorHijo = 0
) {
  const ipcMapa = cargarIPCMapa();
  const { year: anyoJub } = parseFecha(fechaJubilacion);
  const complementoHijos = calcularComplementoHijos(numHijos, importePorHijo);

  const esc25Base = calcularPensionJubilacionEscenario(
    bases,
    fechaJubilacion,
    300,
    300,
    subidaAnualFutura,
    ipcMapa
  );

  const esc25 = {
    ...esc25Base,
    complementoHijos,
    pension14SinComplemento: esc25Base.pension14,
    pension14: esc25Base.pension14 + complementoHijos
  };

  let escNuevo = null;
  let mejor = "25anios";

  const param = paramsNuevoSistema.find(p => p.anyo === anyoJub);

  if (param) {
    const escNuevoBase = calcularPensionJubilacionEscenario(
      bases,
      fechaJubilacion,
      param.totales,
      param.usadas,
      subidaAnualFutura,
      ipcMapa
    );

    escNuevo = {
      ...escNuevoBase,
      complementoHijos,
      pension14SinComplemento: escNuevoBase.pension14,
      pension14: escNuevoBase.pension14 + complementoHijos
    };

    if (escNuevo.pension14 > esc25.pension14) {
      mejor = "nuevo";
    }
  }

  return {
    escenario25Anios: esc25,
    escenarioNuevo: escNuevo,
    mejor,
    complementoHijos,
    numHijos,
    importePorHijo
  };
}

export function calcularEdadEnFecha(nacimiento, fecha) {
  let anios = fecha.year - nacimiento.year;
  let meses = fecha.month - nacimiento.month;

  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  return { anios, meses };
}

export function determinarNumeroBasesIncapacidad(fechaUltimaBase, nacimiento) {
  const f = parseFecha(fechaUltimaBase);
  const edad = calcularEdadEnFecha(nacimiento, f);

  if (edad.anios >= 52) {
    return 96;
  }

  const aniosMenos20 = edad.anios - 20;
  const totalMeses = aniosMenos20 * 12 + edad.meses;
  const mesesMinimos = Math.floor(totalMeses / 4);
  return mesesMinimos;
}

/**
 * Incapacidad con detalle (24+reval sobre el tramo completo)
 */
export function calcularPensionIncapacidad(
  bases,
  fechaUltimaBase,
  nacimiento,
  numHijos = 0,
  importePorHijo = 0
) {
  const numBases = determinarNumeroBasesIncapacidad(fechaUltimaBase, nacimiento);
  const tramo = obtenerTramoDesdeInforme(bases, fechaUltimaBase, numBases);

  if (tramo.length < 25) {
    throw new Error("Se necesitan al menos 25 bases para aplicar 24+reval.");
  }

  const ipcMapa = cargarIPCMapa();
  const { valoresReval, detalle } =
    revalorizarTramoCon24UltimasDetalle(tramo, 0, ipcMapa);

  const suma = valoresReval.reduce((acc, v) => acc + v, 0);
  const pension14Base = pension14PagasDesdeSuma(suma, numBases);

  const complementoHijos = calcularComplementoHijos(numHijos, importePorHijo);
  const pension75Base = pension14Base * 0.75;
  const pension55Base = pension14Base * 0.55;

  const detalleConUso = detalle.map(d => ({
    ...d,
    usadaEnCalculo: true
  }));

  return {
    suma,
    pension14SinComplemento: pension14Base,
    pension14: pension14Base + complementoHijos,
    pension75SinComplemento: pension75Base,
    pension75: pension75Base + complementoHijos,
    pension55SinComplemento: pension55Base,
    pension55: pension55Base + complementoHijos,
    complementoHijos,
    numHijos,
    importePorHijo,
    numeroBases: numBases,
    detalleBases: detalleConUso
  };
}

export function calcularPension(req) {
  const { tipo } = req;
  const numHijos = Number(req.numHijos || 0);
  const importePorHijo = Number(req.importePorHijo || 0);

  if (tipo === "jubilacion") {
    if (!req.fechaJubilacion) {
      throw new Error("Falta fecha de jubilación");
    }
    return calcularPensionJubilacion(
      req.bases,
      req.fechaJubilacion,
      req.subidaAnualFutura || 0,
      numHijos,
      importePorHijo
    );
  }

  if (tipo === "incapacidad") {
    if (!req.fechaUltimaBase || !req.nacimiento) {
      throw new Error("Faltan datos para incapacidad");
    }
    return calcularPensionIncapacidad(
      req.bases,
      req.fechaUltimaBase,
      req.nacimiento,
      numHijos,
      importePorHijo
    );
  }

  throw new Error("Tipo de cálculo no soportado");
}