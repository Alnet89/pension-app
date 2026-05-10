// ===== Utilidades de fechas (frontend) =====
function parseFecha(fecha) {
  const [y, m] = fecha.split("-").map(Number);
  return { year: y, month: m };
}

function formatFecha(year, month) {
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}`;
}

function restarMeses(fecha, n) {
  let { year, month } = parseFecha(fecha);
  let total = year * 12 + (month - 1) - n;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return formatFecha(newYear, newMonth);
}

// ===== Jubilación: sugerencia de número de bases según año =====
function sugerirNumBasesJubilacion(fechaJub) {
  const { year } = parseFecha(fechaJub);
  if (year <= 2025) return 300;
  if (year === 2026) return 304;
  if (year === 2027) return 308;
  if (year === 2028) return 312;
  if (year === 2029) return 316;
  if (year === 2030) return 320;
  if (year === 2031) return 324;
  if (year === 2032) return 328;
  if (year === 2033) return 332;
  if (year === 2034) return 336;
  if (year === 2035) return 340;
  if (year === 2036) return 344;
  if (year === 2037) return 348;
  if (year === 2038) return 348;
  if (year === 2039) return 348;
  if (year === 2040) return 348;
  return 300;
}

// ===== Generar lista de fechas (de más antigua a más reciente) =====
function generarFechasDesdeCorte(fechaCorte, n) {
  const fechas = [];
  for (let i = n - 1; i >= 0; i--) {
    fechas.push(restarMeses(fechaCorte, i));
  }
  return fechas;
}

// ===== Incapacidad <52 años: cálculo nº de bases =====
function calcularBasesMenor52(fechaUltimaBase, fechaNacimiento) {
  const [yUlt, mUlt] = fechaUltimaBase.split("-").map(Number);
  const [yNac, mNac] = fechaNacimiento.split("-").map(Number);

  const y20 = yNac + 20;
  const m20 = mNac;

  const mesesTotal = (yUlt - y20) * 12 + (mUlt - m20);

  let mesesMinimos = Math.floor(mesesTotal / 4);

  if (mesesMinimos < 60) {
    mesesMinimos = 60;
  }

  return mesesMinimos;
}

// ===== Proyección de bases futuras =====
function proyectarBasesFuturas(fechas, basesUsuario, subidaAnualPct) {
  const subida = subidaAnualPct / 100;

  const mapaUsuario = new Map();
  for (const b of basesUsuario) {
    mapaUsuario.set(b.fecha, b.base);
  }

  let ultimaFechaReal = null;
  let ultimaBaseReal = null;
  for (const f of fechas) {
    if (mapaUsuario.has(f)) {
      ultimaFechaReal = f;
      ultimaBaseReal = mapaUsuario.get(f);
    } else {
      break;
    }
  }

  if (ultimaFechaReal == null) {
    throw new Error("No hay ninguna base real para proyectar.");
  }

  const { year: yearUlt } = parseFecha(ultimaFechaReal);

  const resultado = [];

  for (const f of fechas) {
    if (mapaUsuario.has(f)) {
      resultado.push({ fecha: f, base: mapaUsuario.get(f) });
    } else {
      const { year } = parseFecha(f);
      const anosDiferencia = year - yearUlt;
      const factor = Math.pow(1 + subida, anosDiferencia);
      const baseProyectada = ultimaBaseReal * factor;
      resultado.push({ fecha: f, base: baseProyectada });
    }
  }

  return resultado;
}

// ===== Referencias a elementos del DOM =====
const tipoSelect = document.getElementById("tipo");
const bloqueJub = document.getElementById("bloque-jubilacion");
const bloqueInc = document.getElementById("bloque-incapacidad");
const bloqueJubFutura = document.getElementById("bloque-jubilacion-futura");

const numBasesInput = document.getElementById("numBases");
const generarBtn = document.getElementById("generarBases");
const basesSection = document.getElementById("bases-section");
const basesContainer = document.getElementById("bases-container");
const calcularBtn = document.getElementById("calcularBtn");
const resultadoSection = document.getElementById("resultado-section");
const resultadoPre = document.getElementById("resultado");

// Botones extra
const exportarBasesBtn = document.getElementById("exportarBasesBtn");
const importarBasesFile = document.getElementById("importarBasesFile");
const baseComunInput = document.getElementById("baseComun");
const rellenarBaseComunBtn = document.getElementById("rellenarBaseComunBtn");

// Bloque IPC manual
const ipcGuardarBtn = document.getElementById("ipcGuardarBtn");

// API base
// API base
const API_BASE = "https://pension-app-backend.onrender.com";

// ===== Cambio de tipo =====
tipoSelect.addEventListener("change", () => {
  const tipo = tipoSelect.value;
  if (tipo === "jubilacion") {
    bloqueJub.classList.remove("hidden");
    bloqueInc.classList.add("hidden");
    bloqueJubFutura.classList.add("hidden");
  } else if (tipo === "incapacidad") {
    bloqueJub.classList.add("hidden");
    bloqueInc.classList.remove("hidden");
    bloqueJubFutura.classList.add("hidden");
  } else if (tipo === "jubilacionFutura") {
    bloqueJub.classList.add("hidden");
    bloqueInc.classList.add("hidden");
    bloqueJubFutura.classList.remove("hidden");
  }
});

// ===== Generar formulario de bases =====
generarBtn.addEventListener("click", () => {
  const tipo = tipoSelect.value;

  let n = parseInt(numBasesInput.value, 10);
  let fechaCorte = null;

  if (tipo === "jubilacion") {
    const fechaJub = document.getElementById("fechaJubilacion").value;
    if (!fechaJub) {
      alert("Indica mes y año de jubilación.");
      return;
    }
    const [y, m] = fechaJub.split("-");
    const fechaJubStr = `${y}-${m}`;

    if (!n || n < 25) {
      n = sugerirNumBasesJubilacion(fechaJubStr);
      numBasesInput.value = n;
    }

    fechaCorte = restarMeses(fechaJubStr, 2);

  } else if (tipo === "incapacidad") {
    const fechaUltima = document.getElementById("fechaUltimaBase").value;
    const fechaNac = document.getElementById("fechaNacimiento").value;

    if (!fechaUltima) {
      alert("Indica la última base que entra en el cálculo.");
      return;
    }
    if (!fechaNac) {
      alert("Indica la fecha de nacimiento.");
      return;
    }

    const [yu, mu] = fechaUltima.split("-");
    const fechaUltimaStr = `${yu}-${mu}`;
    fechaCorte = fechaUltimaStr;

    const { year: yearUlt, month: monthUlt } = parseFecha(fechaUltimaStr);
    const { year: yearNac, month: monthNac } = parseFecha(fechaNac);
    let edad = yearUlt - yearNac;
    if (monthUlt < monthNac) {
      edad -= 1;
    }

    if (!n || n < 25) {
      if (edad < 52) {
        n = calcularBasesMenor52(fechaUltimaStr, fechaNac);
      } else {
        n = 96;
      }
      numBasesInput.value = n;
    }

  } else if (tipo === "jubilacionFutura") {
    const fechaJubFut = document.getElementById("fechaJubilacionFutura").value;
    if (!fechaJubFut) {
      alert("Indica mes y año de jubilación futura.");
      return;
    }
    const [y, m] = fechaJubFut.split("-");
    const fechaJubStr = `${y}-${m}`;

    if (!n || n < 25) {
      n = sugerirNumBasesJubilacion(fechaJubStr);
      numBasesInput.value = n;
    }

    fechaCorte = restarMeses(fechaJubStr, 2);
  }

  if (!fechaCorte) {
    alert("No se ha podido determinar la fecha de corte.");
    return;
  }

  const fechas = generarFechasDesdeCorte(fechaCorte, n);

  basesContainer.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const row = document.createElement("div");
    row.className = "base-row";

    const labelFecha = document.createElement("span");
    labelFecha.textContent = fechas[i];

    const inputValor = document.createElement("input");
    inputValor.type = "number";
    inputValor.step = "0.01";
    inputValor.className = "base-valor";
    inputValor.placeholder = "Importe base";

    row.appendChild(labelFecha);
    row.appendChild(inputValor);
    basesContainer.appendChild(row);
  }

  basesContainer.dataset.fechas = JSON.stringify(fechas);
  basesSection.classList.remove("hidden");
});

// ===== Rellenar todas las bases con una base común =====
if (rellenarBaseComunBtn) {
  rellenarBaseComunBtn.addEventListener("click", () => {
    const valor = baseComunInput.value;
    if (!valor) {
      alert("Introduce primero una base común.");
      return;
    }
    const inputs = basesContainer.querySelectorAll(".base-valor");
    if (!inputs.length) {
      alert("Primero genera el formulario de bases.");
      return;
    }
    for (const input of inputs) {
      input.value = valor;
    }
  });
}

// ===== Calcular pensión (envío al backend) =====
calcularBtn.addEventListener("click", async () => {
  let tipo = tipoSelect.value;

  const fechas = JSON.parse(basesContainer.dataset.fechas || "[]");
  const filas = basesContainer.querySelectorAll(".base-row");
  if (fechas.length !== filas.length) {
    alert("Error interno: número de fechas y filas no coincide.");
    return;
  }

  const basesTodas = [];
  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const valorInput = fila.querySelector(".base-valor");
    if (!valorInput.value) {
      alert("Rellena todas las bases de cotización.");
      return;
    }
    basesTodas.push({
      fecha: fechas[i],
      base: Number(valorInput.value)
    });
  }

  let payload = { tipo, bases: basesTodas };

  if (tipo === "jubilacion") {
    const fechaJub = document.getElementById("fechaJubilacion").value;
    if (!fechaJub) {
      alert("Indica mes y año de jubilación.");
      return;
    }
    const [y, m] = fechaJub.split("-");
    payload.fechaJubilacion = `${y}-${m}`;

  } else if (tipo === "incapacidad") {
    const fechaUltima = document.getElementById("fechaUltimaBase").value;
    const fechaNac = document.getElementById("fechaNacimiento").value;
    if (!fechaUltima || !fechaNac) {
      alert("Indica última base y fecha de nacimiento.");
      return;
    }
    const [yu, mu] = fechaUltima.split("-");
    const [yn, mn] = fechaNac.split("-");
    payload.fechaUltimaBase = `${yu}-${mu}`;
    payload.nacimiento = { year: Number(yn), month: Number(mn) };

  } else if (tipo === "jubilacionFutura") {
    const fechaJubFut = document.getElementById("fechaJubilacionFutura").value;
    if (!fechaJubFut) {
      alert("Indica mes y año de jubilación futura.");
      return;
    }

    const subidaAnual = Number(document.getElementById("subidaAnual").value);

    // Bases reales hasta último mes cerrado (aprox: mes anterior al actual)
    const hoy = new Date();
    const yearHoy = hoy.getFullYear();
    const monthHoy = hoy.getMonth() + 1;
    const fechaMaxReal = formatFecha(yearHoy, monthHoy - 1);

    const basesUsuario = basesTodas.filter(b => b.fecha <= fechaMaxReal);
    if (!basesUsuario.length) {
      alert("Debes introducir bases reales al menos hasta el último mes cerrado.");
      return;
    }

    const basesProyectadas = proyectarBasesFuturas(fechas, basesUsuario, subidaAnual);

    const [y, m] = fechaJubFut.split("-");
    payload = {
      tipo: "jubilacion",
      bases: basesProyectadas,
      fechaJubilacion: `${y}-${m}`,
      subidaAnualFutura: subidaAnual
    };
  }

  try {
    const resp = await fetch(`${API_BASE}/api/calcular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!data.ok) {
      throw new Error(data.error || "Error desconocido");
    }
    resultadoSection.classList.remove("hidden");
    resultadoPre.textContent = JSON.stringify(data.result, null, 2);
  } catch (e) {
    alert("Error al calcular: " + e.message);
  }
});

// ===== Exportar bases a CSV =====
function exportarBasesCSV() {
  const fechas = JSON.parse(basesContainer.dataset.fechas || "[]");
  const filas = basesContainer.querySelectorAll(".base-row");
  if (!fechas.length || !filas.length) {
    alert("No hay bases generadas para exportar.");
    return;
  }

  let csv = "fecha;base\n";

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const valorInput = fila.querySelector(".base-valor");
    const baseValor = valorInput.value || "";
    csv += `${fechas[i]};${baseValor}\n`;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;

  const tipo = tipoSelect.value;
  let nombre = "bases.csv";
  if (tipo === "jubilacion") {
    const fj = document.getElementById("fechaJubilacion").value || "jubilacion";
    nombre = `bases_jubilacion_${fj}.csv`;
  } else if (tipo === "incapacidad") {
    const fu = document.getElementById("fechaUltimaBase").value || "incapacidad";
    nombre = `bases_incapacidad_${fu}.csv`;
  } else if (tipo === "jubilacionFutura") {
    const fj = document.getElementById("fechaJubilacionFutura").value || "jubfutura";
    nombre = `bases_jub_futura_${fj}.csv`;
  }
  link.download = nombre;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

if (exportarBasesBtn) {
  exportarBasesBtn.addEventListener("click", exportarBasesCSV);
}

// ===== Importar bases desde CSV =====
function importarBasesDesdeCSV(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const texto = e.target.result;
    const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "");

    if (lineas.length <= 1) {
      alert("El fichero CSV no tiene datos.");
      return;
    }

    lineas.shift();

    const datos = [];
    for (const linea of lineas) {
      const partes = linea.split(";");
      if (partes.length < 2) continue;
      const fecha = partes[0].trim();
      const baseStr = partes[1].trim().replace(",", ".");
      const baseVal = baseStr ? Number(baseStr) : null;
      if (!fecha) continue;
      datos.push({ fecha, base: baseVal });
    }

    if (!datos.length) {
      alert("No se han encontrado bases válidas en el CSV.");
      return;
    }

    const fechasForm = JSON.parse(basesContainer.dataset.fechas || "[]");
    const filas = basesContainer.querySelectorAll(".base-row");
    if (!fechasForm.length || !filas.length) {
      alert("Primero genera el formulario de bases y luego importa.");
      return;
    }

    const mapa = new Map();
    for (const d of datos) {
      mapa.set(d.fecha, d.base);
    }

    for (let i = 0; i < filas.length; i++) {
      const fecha = fechasForm[i];
      const fila = filas[i];
      const valorInput = fila.querySelector(".base-valor");
      if (mapa.has(fecha) && mapa.get(fecha) != null) {
        valorInput.value = mapa.get(fecha);
      }
    }

    alert("Importación de bases completada (solo para las fechas que coinciden).");
  };

  reader.onerror = function () {
    alert("Error al leer el fichero CSV.");
  };

  reader.readAsText(file, "utf-8");
}

if (importarBasesFile) {
  importarBasesFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importarBasesDesdeCSV(file);
    e.target.value = "";
  });
}

// ===== Gestión manual del IPC =====
if (ipcGuardarBtn) {
  ipcGuardarBtn.addEventListener("click", async () => {
    const fechaInput = document.getElementById("ipcFecha").value;
    const indiceStr = document.getElementById("ipcIndice").value;

    if (!fechaInput || !indiceStr) {
      alert("Indica fecha e índice IPC.");
      return;
    }

    const [y, m] = fechaInput.split("-");
    const fecha = `${y}-${m}`;
    const indice = Number(indiceStr);

    try {
      const res = await fetch(`${API_BASE}/api/ipc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, indice })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert("Error al guardar IPC: " + (data.error || res.status));
        return;
      }
      alert(`IPC guardado para ${fecha}`);
    } catch (err) {
      console.error(err);
      alert("Error de conexión al guardar IPC.");
    }
  });
}

// ===== Descargar informe PDF =====
const descargarPdfBtn = document.getElementById("descargarPdfBtn");
if (descargarPdfBtn) {
  descargarPdfBtn.addEventListener("click", async () => {
    let tipo = tipoSelect.value;

    const fechas = JSON.parse(basesContainer.dataset.fechas || "[]");
    const filas = basesContainer.querySelectorAll(".base-row");
    if (fechas.length !== filas.length) {
      alert("Error interno: número de fechas y filas no coincide.");
      return;
    }

    const basesTodas = [];
    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const valorInput = fila.querySelector(".base-valor");
      if (!valorInput.value) {
        alert("Rellena todas las bases de cotización.");
        return;
      }
      basesTodas.push({
        fecha: fechas[i],
        base: Number(valorInput.value)
      });
    }

    let payload = { tipo, bases: basesTodas };

    if (tipo === "jubilacion") {
      const fechaJub = document.getElementById("fechaJubilacion").value;
      if (!fechaJub) {
        alert("Indica mes y año de jubilación.");
        return;
      }
      const [y, m] = fechaJub.split("-");
      payload.fechaJubilacion = `${y}-${m}`;
    } else if (tipo === "incapacidad") {
      const fechaUltima = document.getElementById("fechaUltimaBase").value;
      const fechaNac = document.getElementById("fechaNacimiento").value;
      if (!fechaUltima || !fechaNac) {
        alert("Indica última base y fecha de nacimiento.");
        return;
      }
      const [yu, mu] = fechaUltima.split("-");
      const [yn, mn] = fechaNac.split("-");
      payload.fechaUltimaBase = `${yu}-${mu}`;
      payload.nacimiento = { year: Number(yn), month: Number(mn) };
    } else if (tipo === "jubilacionFutura") {
      const fechaJubFut = document.getElementById("fechaJubilacionFutura").value;
      if (!fechaJubFut) {
        alert("Indica mes y año de jubilación futura.");
        return;
      }
      const subidaAnual = Number(document.getElementById("subidaAnual").value);

      const hoy = new Date();
      const yearHoy = hoy.getFullYear();
      const monthHoy = hoy.getMonth() + 1;
      const fechaMaxReal = formatFecha(yearHoy, monthHoy - 1);

      const basesUsuario = basesTodas.filter(b => b.fecha <= fechaMaxReal);
      if (!basesUsuario.length) {
        alert("Debes introducir bases reales al menos hasta el último mes cerrado.");
        return;
      }

      const basesProyectadas = proyectarBasesFuturas(fechas, basesUsuario, subidaAnual);

      tipo = "jubilacion";
      payload = {
        tipo: "jubilacion",
        bases: basesProyectadas,
        fechaJubilacion: fechaJubFut.replace(/-/g, "-"),
        subidaAnualFutura: subidaAnual
      };
    }

    try {
      const resp = await fetch(`${API_BASE}/api/informe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Error al generar PDF");
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        tipo === "incapacidad"
          ? "informe_incapacidad.pdf"
          : "informe_jubilacion.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Error al descargar el PDF: " + e.message);
    }
  });
}