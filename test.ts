import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.99.0/testing/asserts.ts";
import { lit, VM } from "./mod.ts";

Deno.test("simple", () => {
  const vm = new VM();
  const empty = lit();

  assertEquals(vm.eval("n", "1+1", empty), 2);
  assertEquals(vm.eval("s", '"a" + "b"', empty), "ab");
  assertThrows(
    () => vm.eval("s", "1+1", empty),
    TypeError,
    "require string got number",
  );
});

Deno.test("object", () => {
  const vm = new VM();
  const empty = lit();

  vm.set("obj", "{str:s,num:n}", { str: "test", num: 42 });
  assertEquals(vm.eval("n", "obj.num", empty), 42);
  assertEquals(vm.eval("s", "obj.str", empty), "test");
  assertThrows(
    () => vm.eval("n", "invalid.value", empty),
    ReferenceError,
    '"invalid" not found',
  );
  assertThrows(
    () => vm.eval("n", "obj.invalid", empty),
    ReferenceError,
    '"invalid" not exists in object',
  );
});

Deno.test("function", () => {
  const vm = new VM();
  const empty = lit();

  vm.set("v", lit(42));
  vm.set("f", "f(n->s)", (x) => x + "");

  assertEquals(vm.eval("s", "f(v)", empty), "42");
  assertThrows(
    () => vm.eval("s", "f(true)", empty),
    TypeError,
    "require number got boolean",
  );
  assertThrows(
    () => vm.eval("s", "f()", empty),
    TypeError,
    "require number got null",
  );
});

Deno.test("compile", () => {
  const vm = new VM();
  vm.set("f", "f(n->s)", (x) => x + "");

  const compiled = vm.compile("s", "f(this)", "n");
  assertEquals(compiled(5), "5");

  assertThrows(
    () => vm.compile("s", "this", "n"),
    TypeError,
    "require string got number",
  );
});
