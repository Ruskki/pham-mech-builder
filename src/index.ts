import { serve } from "bun";
import { readFileSync, writeFileSync } from "fs";
import index from "./index.html";

const DATA_FILE = new URL("../src/data/components.json", import.meta.url).pathname;

function loadData(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return { core: [], utility: [], weapon: [] };
  }
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
        setTimeout(() => server.stop(), 100);
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
