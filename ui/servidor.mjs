import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIRETORIO_ATUAL = path.dirname(fileURLToPath(import.meta.url));
const PUBLICO = path.resolve(DIRETORIO_ATUAL, "public");
const PORT = Number(process.env.PORT || 3001);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    let caminho = decodeURIComponent(url.pathname);
    if (caminho === "/") caminho = "/index.html";
    const arquivo = path.resolve(PUBLICO, "." + path.normalize(caminho));
    if (arquivo !== PUBLICO && !arquivo.startsWith(PUBLICO + path.sep)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Proibido");
      return;
    }
    const conteudo = await readFile(arquivo);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(arquivo)] || "application/octet-stream",
    });
    res.end(conteudo);
  } catch (erro) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Não encontrado");
  }
});

servidor.listen(PORT, () => {
  console.log(`UI M3 — Presença por QR em http://localhost:${PORT}`);
});