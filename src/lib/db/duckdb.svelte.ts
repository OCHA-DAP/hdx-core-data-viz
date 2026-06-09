import * as duckdb from "@duckdb/duckdb-wasm";
import duckdbEhWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import duckdbMvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";

// Workers are self-hosted (small JS files). Engine WASM binaries are fetched
// from jsDelivr because they're ~34–39 MiB — above typical static host limits.
// jsDelivr serves them with CORS + COEP-compatible headers.
// Only mvp and eh bundles are exposed; coi pthread worker breaks the OPFS path.
const jsdelivr = duckdb.getJsDelivrBundles();

const BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: jsdelivr.mvp!.mainModule, mainWorker: duckdbMvpWorker },
  eh: { mainModule: jsdelivr.eh!.mainModule, mainWorker: duckdbEhWorker },
};

class DuckDBState {
  db: duckdb.AsyncDuckDB | null = null;
  conn: duckdb.AsyncDuckDBConnection | null = null;
  ready = $state(false);
  error = $state<string | null>(null);
}

export const duckdbState = new DuckDBState();

export async function initDuckDB(): Promise<void> {
  if (duckdbState.ready || duckdbState.error) return;
  try {
    // Race the init against a timeout so a CDN outage surfaces as an error
    // rather than a permanent loading spinner.
    await Promise.race([
      _doInit(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DuckDB init timed out (30s). Check your network.")), 30_000)
      ),
    ]);
  } catch (e) {
    duckdbState.error = e instanceof Error ? e.message : String(e);
  }
}

async function _doInit(): Promise<void> {
  try {
    const bundle = await duckdb.selectBundle(BUNDLES);
    const worker = new Worker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
    const instance = new duckdb.AsyncDuckDB(logger, worker);

    // Worker errors (e.g. WASM fetch failure) surface as unhandled rejections.
    // Bridge them into a Promise so they're catchable.
    const workerError = new Promise<never>((_, reject) => {
      worker.addEventListener("error", (e) => reject(new Error(e.message ?? "Worker error")));
    });
    await Promise.race([instance.instantiate(bundle.mainModule, bundle.pthreadWorker), workerError]);

    await instance.open({});
    duckdbState.db = instance;

    const conn = await instance.connect();
    duckdbState.conn = conn;

    await conn.query("SET threads = 1");

    // httpfs enables HTTP range reads against remote Parquet files.
    // data.source.coop serves HAPI Parquet with CORS + Accept-Ranges: bytes.
    try {
      await conn.query("LOAD httpfs;");
    } catch {
      await conn.query("INSTALL httpfs; LOAD httpfs;");
    }

    duckdbState.ready = true;
  } catch (e) {
    // Re-throw so the outer initDuckDB catch sets duckdbState.error.
    throw e;
  }
}

export async function runQuery(sql: string): Promise<Record<string, unknown>[]> {
  if (!duckdbState.conn) throw new Error("DuckDB not initialised");
  const table = await duckdbState.conn.query(sql);
  return table.toArray().map((row) => {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      // Arrow returns INT64 as BigInt; convert to Number for JSON-safe display.
      obj[k] = typeof v === "bigint" ? Number(v) : v;
    }
    return obj;
  });
}
