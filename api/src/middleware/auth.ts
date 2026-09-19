import { FastifyRequest, FastifyReply } from "fastify";

const ROTAS_PUBLICAS = [
  "/certificados/:codigo",
  "/_teste/reset",
  "/_teste/relogio",
];

function isRotaPublica(path: string): boolean {
  return ROTAS_PUBLICAS.some((r) => {
    const regex = new RegExp("^" + r.replace(":codigo", "[^/]+") + "$");
    return regex.test(path);
  });
}

function rowToUsuario(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    papel: row.papel as string,
  };
}

export async function verifyAuth(req: FastifyRequest, reply: FastifyReply) {
  if (isRotaPublica(req.routeOptions?.url || req.url)) {
    return;
  }

  const usuarioId = req.headers["x-usuario"] as string | undefined;
  if (!usuarioId) {
    return reply.code(401).send({
      erro: "USUARIO_DESCONHECIDO",
      mensagem: "Cabeçalho X-Usuario é obrigatório",
    });
  }

  const db = req.server.db;
  const result = db.exec("SELECT id, papel FROM usuarios WHERE id = ?", [usuarioId]);
  if (result.length === 0 || result[0].values.length === 0) {
    return reply.code(401).send({
      erro: "USUARIO_DESCONHECIDO",
      mensagem: "Usuário não encontrado",
    });
  }
  const cols = result[0].columns;
  const vals = result[0].values[0];
  const row: Record<string, unknown> = {};
  cols.forEach((c, i) => { row[c] = vals[i]; });
  const usuario = rowToUsuario(row);

  req.usuario = { id: usuario.id, papel: usuario.papel };
}