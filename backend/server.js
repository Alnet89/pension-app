import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import { calcularPension } from "./logic/pensionLogic.js";
import { generarInformePdf } from "./logic/informePdf.js";
import { cargarIPCMapa, guardarIPCMapa } from "./logic/ipcData.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Servir frontend estático
app.use(express.static(path.join(__dirname, "../frontend")));

// Guardar/actualizar un mes de IPC
app.post("/api/ipc", (req, res) => {
  try {
    const { fecha, indice } = req.body;
    if (!fecha || typeof indice !== "number") {
      return res
        .status(400)
        .json({ ok: false, error: "Faltan fecha o índice numérico" });
    }

    const ipcMapa = cargarIPCMapa();
    ipcMapa[fecha] = indice;
    guardarIPCMapa(ipcMapa);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ ok: false, error: "Error al guardar IPC" });
  }
});

// Cálculo normal (JSON)
app.post("/api/calcular", (req, res) => {
  try {
    const result = calcularPension(req.body);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Generar y devolver PDF
app.post("/api/informe", async (req, res) => {
  try {
    const result = calcularPension(req.body);

    const tipo = req.body.tipo;
    const opciones = {
      tipo,
      fechaJubilacion: req.body.fechaJubilacion || null,
      fechaUltimaBase: req.body.fechaUltimaBase || null,
      nacimiento: req.body.nacimiento || null
    };

    const pdfBuffer = await generarInformePdf(result, opciones);

    const nombre =
      tipo === "jubilacion"
        ? "informe_jubilacion.pdf"
        : "informe_incapacidad.pdf";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});