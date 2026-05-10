// backend/logic/ipcData.js
import fs from "fs";
import path from "path";

const ipcJsonPath = path.join(
  process.cwd(),
  "backend",
  "logic",
  "ipcData.json"
);

// Cargar IPC desde el JSON
export function cargarIPCMapa() {
  const raw = fs.readFileSync(ipcJsonPath, "utf8");
  return JSON.parse(raw);
}

// Guardar (sobrescribir) el JSON con los cambios
export function guardarIPCMapa(ipcMapa) {
  fs.writeFileSync(ipcJsonPath, JSON.stringify(ipcMapa, null, 2), "utf8");
}

// Obtener la última fecha disponible en el mapa (max key AAAA-MM)
export function obtenerUltimaFechaIPC(ipcMapa) {
  const fechas = Object.keys(ipcMapa);
  fechas.sort(); // AAAA-MM se ordena bien
  return fechas[fechas.length - 1];
}