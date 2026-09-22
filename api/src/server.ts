import Fastify from "fastify";
import { inicializarBanco } from "./db.js";
import { registrarRotasTeste } from "./rotas/teste.js";
import { registrarRotasSalas } from "./rotas/salas.js";
import { registrarRotasAtividades } from "./rotas/atividades.js";

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

  return app;
}