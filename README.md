# Tiny Expr

Evaluate js expressions safely.

## Example

```typescript
import { lit, VM } from "https://deno.land/x/tiny_expr";

const vm = new VM();

vm.set("a", lit(5));
vm.set("b", "{str:s,num:n}", { str: "test", num: 42 });
console.log(vm.eval("n", "a * 3", lit()));
// got 15

const compiled = vm.compile("n", "obj.num * this", n);
console.log(compiled(4));
// got 168

vm.compile("n", "this", "s");
// TypeError: require number got string
```
