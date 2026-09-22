import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../src/server.js";

const PORT = 3199;
let server: Awaited<ReturnType<typeof startServer>>;

describe("Inicialização executável da API", () => {
  before(async () => {
    process.env.PORT = String(PORT);
    server = await startServer();
  });

  after(async () => {
    await server.close();
    delete process.env.PORT;
  });

  it("startServer escuta na porta de PORT e responde a uma rota", async () => {
    const res = await fetch(`http://localhost:${PORT}/salas`, {
      headers: { "X-Usuario": "org-ana" },
    });
    assert.equal(res.status, 200);
  });
});