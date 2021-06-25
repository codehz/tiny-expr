import { assertEquals } from "https://deno.land/std@0.99.0/testing/asserts.ts";
import { Context, evalWith } from "./mod.ts";

const emptyContext: Context = {
  environment: new Map(),
  this: {},
};

function testEval<T>(
  code: string,
  expected: T,
  context: Context = emptyContext,
) {
  const result = evalWith(code, context);
  assertEquals(result, expected, `${code}(${result}) != ${expected}`);
}

Deno.test("simple expression", () => {
  testEval("1 + 1", 1 + 1);
  testEval("1 + 2 * 3", 1 + 2 * 3);
  testEval("false || true", false || true);
  testEval("invalid", undefined);
  testEval("1 > 2", 1 > 2);
  testEval("1 in [1, 2, 3]", 1 in [1, 2, 3]);
});

Deno.test("with environment", () => {
  const xctx: Context = {
    environment: new Map([["a", 5], ["b", 10]]),
    this: { c: 6 },
  };
  testEval("a", 5, xctx);
  testEval("a + b", 15, xctx);
  testEval("[a, b]", [5, 10], xctx);
  testEval("this.c", 6, xctx);
});
