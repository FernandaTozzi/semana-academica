import initSqlJs, { Database } from "sql.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DB_DIR, "semana.db");
const WASM_PATH = path.join(__dirname, "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm");

let dbInstance: Database | null = null;

function ensureDbDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

export async function inicializarBanco(): Promise<Database> {
  if (dbInstance) return dbInstance;

  ensureDbDir();

  const SQL = await initSqlJs({ locateFile: () => WASM_PATH });

  let db: Database;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.exec("PRAGMA foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      papel TEXT NOT NULL CHECK (papel IN ('organizacao', 'participante'))
    );

    CREATE TABLE IF NOT EXISTS salas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      capacidade INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS atividades (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('palestra', 'minicurso')),
      sala_id TEXT NOT NULL REFERENCES salas(id),
      vagas INTEGER NOT NULL,
      situacao TEXT NOT NULL DEFAULT 'prevista' CHECK (situacao IN ('prevista', 'em_andamento', 'encerrada', 'cancelada')),
      criada_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS encontros (
      id TEXT PRIMARY KEY,
      atividade_id TEXT NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
      inicio TEXT NOT NULL,
      fim TEXT NOT NULL,
      ordem INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inscricoes (
      id TEXT PRIMARY KEY,
      atividade_id TEXT NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
      participante_id TEXT NOT NULL REFERENCES usuarios(id),
      status TEXT NOT NULL CHECK (status IN ('confirmada', 'em_espera', 'convocada', 'cancelada', 'expirada')),
      posicao_na_espera INTEGER,
      convocada_ate TEXT,
      criada_em TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (atividade_id, participante_id)
    );

    CREATE TABLE IF NOT EXISTS presencas (
      id TEXT PRIMARY KEY,
      encontro_id TEXT NOT NULL REFERENCES encontros(id) ON DELETE CASCADE,
      participante_id TEXT NOT NULL REFERENCES usuarios(id),
      origem TEXT NOT NULL CHECK (origem IN ('qr', 'qr_offline', 'manual')),
      lido_em TEXT,
      registrada_em TEXT NOT NULL DEFAULT (datetime('now')),
      justificativa TEXT
    );

    CREATE TABLE IF NOT EXISTS certificados (
      codigo TEXT PRIMARY KEY,
      atividade_id TEXT NOT NULL REFERENCES atividades(id),
      participante_id TEXT NOT NULL REFERENCES usuarios(id),
      carga_horaria_minutos INTEGER NOT NULL,
      presencas INTEGER NOT NULL,
      encontros INTEGER NOT NULL,
      emitido_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bloqueios (
      participante_id TEXT PRIMARY KEY REFERENCES usuarios(id),
      atividades TEXT NOT NULL,
      bloqueado_desde TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS relogio_teste (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      agora TEXT NOT NULL
    );
  `);

  migrarLidoEmAnulavel(db);

  dbInstance = db;
  return db;
}

function migrarLidoEmAnulavel(db: Database) {
  const info = db.exec("PRAGMA table_info(presencas)");
  if (info.length === 0) return;
  const { columns, values } = info[0];
  const colunas: Record<string, number> = {};
  columns.forEach((c, i) => { colunas[c] = i; });
  const linha = values.find((v) => v[colunas.name] === "lido_em");
  if (!linha || Number(linha[colunas.notnull]) === 0) return;

  db.exec("PRAGMA foreign_keys = OFF");
  db.exec(`
    CREATE TABLE presencas_tmp (
      id TEXT PRIMARY KEY,
      encontro_id TEXT NOT NULL REFERENCES encontros(id) ON DELETE CASCADE,
      participante_id TEXT NOT NULL REFERENCES usuarios(id),
      origem TEXT NOT NULL CHECK (origem IN ('qr', 'qr_offline', 'manual')),
      lido_em TEXT,
      registrada_em TEXT NOT NULL DEFAULT (datetime('now')),
      justificativa TEXT
    );
    INSERT INTO presencas_tmp (id, encontro_id, participante_id, origem, lido_em, registrada_em, justificativa)
      SELECT id, encontro_id, participante_id, origem, lido_em, registrada_em, justificativa FROM presencas;
    DROP TABLE presencas;
    ALTER TABLE presencas_tmp RENAME TO presencas;
  `);
  db.exec("PRAGMA foreign_keys = ON");
}

export function salvarBanco(db: Database) {
  ensureDbDir();
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export function carregarDadosIniciais(db: Database) {
  const usuarios = [
    { id: "org-ana", nome: "Ana Beatriz Lima", papel: "organizacao" },
    { id: "org-bruno", nome: "Bruno Tavares", papel: "organizacao" },
    { id: "p-carla", nome: "Carla Mendes Souza", papel: "participante" },
    { id: "p-diego", nome: "Diego Alves", papel: "participante" },
    { id: "p-elisa", nome: "Elisa Fernandes da Rocha", papel: "participante" },
    { id: "p-fabio", nome: "Fábio Nogueira", papel: "participante" },
    { id: "p-gabriela", nome: "Gabriela Moura Castro", papel: "participante" },
    { id: "p-heitor", nome: "Heitor Campos", papel: "participante" },
    { id: "p-isadora", nome: "Isadora Ribeiro dos Santos", papel: "participante" },
    { id: "p-joao", nome: "João Pedro Martins", papel: "participante" },
  ];

  const salas = [
    { id: "sala_01", nome: "Sala 01", capacidade: 30 },
    { id: "sala_02", nome: "Sala 02", capacidade: 60 },
    { id: "sala_03", nome: "Auditório", capacidade: 100 },
  ];

  const insertUsuario = db.prepare(
    "INSERT OR REPLACE INTO usuarios (id, nome, papel) VALUES (?, ?, ?)"
  );
  const insertSala = db.prepare(
    "INSERT OR REPLACE INTO salas (id, nome, capacidade) VALUES (?, ?, ?)"
  );

  for (const u of usuarios) insertUsuario.run([u.id, u.nome, u.papel]);
  for (const s of salas) insertSala.run([s.id, s.nome, s.capacidade]);
}

export function resetarBanco(db: Database) {
  const tabelas = [
    "presencas",
    "certificados",
    "inscricoes",
    "encontros",
    "atividades",
    "bloqueios",
    "salas",
  ];

  for (const t of tabelas) {
    db.run(`DELETE FROM ${t}`);
  }

  carregarDadosIniciais(db);
}

export function obterRelogioTeste(db: Database): string {
  const result = db.exec("SELECT agora FROM relogio_teste WHERE id = 1");
  if (result.length > 0 && result[0].values.length > 0) {
    return result[0].values[0][0] as string;
  }

  const inicial = "2026-10-13T09:00:00-03:00";
  db.run("INSERT INTO relogio_teste (id, agora) VALUES (1, ?)", [inicial]);
  return inicial;
}

export function definirRelogioTeste(db: Database, agora: string): string {
  db.run("INSERT OR REPLACE INTO relogio_teste (id, agora) VALUES (1, ?)", [agora]);
  return agora;
}

export type SqlJsDatabase = Database;