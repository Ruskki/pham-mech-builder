import { serve } from "bun";
import { readFileSync, writeFileSync, existsSync } from "fs";
import index from "./index.html";
import defaultData from "./data/components.json";

const DATA_FILE = "components.json";

function loadData(): Record<string, unknown> {
  if (existsSync(DATA_FILE)) {
    try {
      return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
    } catch { /* fall through */ }
  }
  return defaultData as Record<string, unknown>;
}

function saveData(data: Record<string, unknown>): void {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const server = serve({
  routes: {
    "/*": index,

    "/api/data": {
      async GET() {
        return Response.json(loadData());
      },
      async POST(req) {
        const body = (await req.json()) as Record<string, unknown>;
        saveData(body);
        return Response.json({ ok: true });
      },
    },

    "/api/shutdown": {
      async POST() {
        setTimeout(() => {
          server.stop(true);
          process.exit(0);
        }, 100);
        return Response.json({ message: "Server shutting down" });
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
