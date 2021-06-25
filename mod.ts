import parse, { Expression } from "./parser.ts";

export interface Context {
  environment: Map<string, unknown>;
  this: Record<string, unknown>;
}

export function evalWith(
  code: string,
  context: Context,
): unknown {
  return evalExpr(parse(code), context);
}

export function evalExpr(
  expr: Expression,
  context: Context,
): unknown {
  switch (expr.type) {
    case "ArrayExpression":
      return expr.elements.map((item) => evalExpr(item, context));
    case "BinaryExpression":
      if (expr.operator == "??") {
        return evalExpr(expr.left, context) ?? evalExpr(expr.right, context);
      } else {
        // deno-lint-ignore no-explicit-any
        const left = evalExpr(expr.left, context) as any;
        // deno-lint-ignore no-explicit-any
        const right = evalExpr(expr.right, context) as any;
        switch (expr.operator) {
          case "|":
            return left | right;
          case "^":
            return left ^ right;
          case "&":
            return left & right;
          case "==":
            return left == right;
          case "!=":
            return left != right;
          case "===":
            return left === right;
          case "!==":
            return left !== right;
          case "<":
            return left < right;
          case ">":
            return left > right;
          case "<=":
            return left <= right;
          case ">=":
            return left >= right;
          case "<<":
            return left << right;
          case ">>":
            return left >> right;
          case ">>>":
            return left >>> right;
          case "%":
            return left % right;
          case "+":
            return left + right;
          case "-":
            return left - right;
          case "*":
            return left * right;
          case "/":
            return left / right;
          case "in":
            return left in right;
        }
        throw new SyntaxError(`invalid operator "${expr.operator}"`);
      }
    case "CallExpression": {
      // deno-lint-ignore no-explicit-any
      const callee = evalExpr(expr.callee, context) as any;
      const args = expr.arguments.map((x) => evalExpr(x, context));
      return callee(...args);
    }
    case "Compound": {
      let last;
      for (const item of expr.body) {
        last = evalExpr(item, context);
      }
      return last;
    }
    case "ConditionalExpression":
      return evalExpr(expr.test, context)
        ? evalExpr(expr.consequent, context)
        : evalExpr(expr.alternate, context);
    case "Identifier":
      if (context.environment.has(expr.name)) {
        return context.environment.get(expr.name);
      } else {
        return undefined;
      }
    case "Literal":
      return expr.value;
    case "LogicalExpression":
      switch (expr.operator) {
        case "&&":
          return evalExpr(expr.left, context) && evalExpr(expr.right, context);
        case "||":
          return evalExpr(expr.left, context) || evalExpr(expr.right, context);
      }
      throw new SyntaxError(`invalid operator "${expr.operator}"`);
    case "MemberExpression": {
      // deno-lint-ignore no-explicit-any
      const obj = evalExpr(expr.object, context) as any;
      if (expr.computed) {
        // deno-lint-ignore no-explicit-any
        const prop = evalExpr(expr.property, context) as any;
        return obj[prop];
      } else {
        return expr.property.type === "Identifier"
          ? obj[expr.property.name]
          : undefined;
      }
    }
    case "ThisExpression":
      return context.this;
    case "UnaryExpression": {
      // deno-lint-ignore no-explicit-any
      const value = evalExpr(expr.argument, context) as any;
      switch (expr.operator) {
        case "-":
          return -value;
        case "!":
          return !value;
        case "~":
          return ~value;
        case "+":
          return +value;
      }
      throw new SyntaxError(`invalid operator "${expr.operator}"`);
    }
    default:
      return undefined;
  }
}
