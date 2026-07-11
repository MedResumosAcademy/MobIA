// Runner de testes do apps/web — mesmo vitest do monorepo (packages/core).
// Escopo: módulos PUROS de lib/** (sem mock de banco; IO fica fora daqui).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const raiz = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // Espelha o paths do tsconfig ("@/*" → "./*").
      "@": raiz,
    },
  },
});
