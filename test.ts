import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.99.0/testing/asserts.ts";
import { lit, VM } from "./mod.ts";

Deno.test("simple", () => {
  const vm = new VM();
  const empty = lit();

  assertEquals(vm.eval("number", "1+1", empty), 2);
  assertEquals(vm.eval("string", '"a" + "b"', empty), "ab");
  assertThrows(
    () => vm.eval("string", "1+1", empty),
    TypeError,
    "require string got number",
  );
});

Deno.test("object", () => {
  const vm = new VM();
  const empty = lit();

  vm.set("obj", `object ("str": string, "num": number)`, { str: "test", num: 42 });
  assertEquals(vm.eval("number", "obj.num", empty), 42);
  assertEquals(vm.eval("string", "obj.str", empty), "test");
  assertThrows(
    () => vm.eval("number", "invalid.value", empty),
    ReferenceError,
    '"invalid" not found',
  );
  assertThrows(
    () => vm.eval("number", "obj.invalid", empty),
    ReferenceError,
    '"invalid" not exists in object',
  );
});

Deno.test("function", () => {
  const vm = new VM();
  const empty = lit();

  vm.set("v", lit(42));
  vm.set("f", "function (number) string", (x) => x + "");

  assertEquals(vm.eval("string", "f(v)", empty), "42");
  assertThrows(
    () => vm.eval("string", "f(true)", empty),
    TypeError,
    "require number got boolean",
  );
  assertThrows(
    () => vm.eval("string", "f()", empty),
    TypeError,
    "require number got null",
  );
});

Deno.test("compile", () => {
  const vm = new VM();
  vm.set("f", "function (number) string", (x) => x + "");

  const compiled = vm.compile("string", "f(this)", "number");
  assertEquals(compiled(5), "5");

  assertThrows(
    () => vm.compile("string", "this", "number"),
    TypeError,
    "require string got number",
  );
});
