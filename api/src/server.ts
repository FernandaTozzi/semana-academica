import Fastify from "fastify";
import path from "node:path";
import { pathToFileURL } from "node:url";
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

  app.addHook("onSend", async (_req, reply, payload) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type, X-Usuario");
    return payload;
  });

  app.options("/*", async (_req, reply) => {
    return reply.code(204).send();
  });

  // Permitir body vazio em POST
  // Parse body as string to allow custom JSON parsing with error handling
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    done(null, body);
  });

  // Pre-validation hook to parse JSON and handle invalid JSON
  app.addHook("preValidation", async (req, reply) => {
    const body = req.body;
    if (typeof body === "string" && body.trim() !== "") {
      try {
        req.body = JSON.parse(body);
      } catch (err) {
        return reply.code(422).send({
          erro: "DADOS_INVALIDOS",
          mensagem: "JSON inválido",
        });
      }
    } else if (typeof body === "string" && body.trim() === "") {
      req.body = {};
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

export async function startServer() {
  const app = await createServer();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port });
  return app;
}

const isMainModule =
  process.argv[1] != null &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  startServer();
}