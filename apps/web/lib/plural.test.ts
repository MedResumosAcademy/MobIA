import { describe, expect, it } from "vitest";
import { plural } from "@/lib/plural";

describe("plural", () => {
  it("1 usa o singular", () => {
    expect(plural(1, "venda fechada", "vendas fechadas")).toBe("venda fechada");
  });

  it("0 e 2+ usam o plural", () => {
    expect(plural(0, "venda fechada", "vendas fechadas")).toBe("vendas fechadas");
    expect(plural(2, "venda fechada", "vendas fechadas")).toBe("vendas fechadas");
    expect(plural(37, "item", "itens")).toBe("itens");
  });
});
