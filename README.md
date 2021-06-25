# Tiny Expr

Evaluate js expressions safely.

## Example

```typescript
import { evalWith } from "https://deno.land/x/tiny_expr";

console.log(evalWith("a + b", {
  environment: new Map([["a", 5], ["b", 10]]),
  this: {},
}));
// got 15
```
