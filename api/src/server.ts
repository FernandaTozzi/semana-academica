import Fastify from "fastify";
import { inicializarBanco } from "./db.js";
import { registrarRotasTeste } from "./rotas/teste.js";
import { registrarRotasSalas } from "./rotas/salas.js";
import { registrarRotasAtividades } from "./rotas/atividades.js";
import { registrarRotasEncontros } from "./rotas/encontros.js";
import { registrarRotasPresencas } from "./rotas/presencas.js";

let cachedDb: Awaited<ReturnType<typeof inicializarBanco>> | null = null;

async function getDb() {
  if (!cachedDb) {
    cachedDb = await inicializarBanco();
  }
  return cachedDb;
}

export async function createServer() {
  const app = Fastify({ logger: false });

  const db = await getDb();

  app.decorate("db", db);

  // Permitir body vazio em POST
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    try {
      const json = body ? JSON.parse(body as string) : {};
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  if (process.env.MODO_TESTE === "1") {
    registrarRotasTeste(app);
  }

  registrarRotasSalas(app);
  registrarRotasAtividades(app);
  registrarRotasEncontros(app);
  registrarRotasPresencas(app);

  return app;
}