# Tiny Expr

Evaluate js expressions safely.

## Example

```typescript
import { lit, VM } from "https://deno.land/x/tiny_expr";

const vm = new VM();

vm.set("a", lit(5));
vm.set("b", `object ("str": string, "num": number)`, { str: "test", num: 42 });
console.log(vm.eval("number", "a * 3", lit()));
// got 15

const compiled = vm.compile("number", "obj.num * this", n);
console.log(compiled(4));
// got 168

vm.compile("number", "this", "string");
// TypeError: require number got string
```
