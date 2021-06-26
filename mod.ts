import parse, { Expression } from "./parser.ts";
import {
  LooseSimpleTypeRuntimeModel,
  LooseTypeRuntimeModel,
  SimpleTypeNames,
  TypeMapper,
  TypeNames,
  TypeRuntimeModel,
} from "./types.ts";
import { evalModel, parseModel } from "./validator.ts";

export class VarModel<M extends string = string> {
  model: TypeRuntimeModel<M>;
  constructor(spec: TypeRuntimeModel<M> | M, public value: TypeMapper<M>) {
    this.model = typeof spec == "string" ? parseModel(spec) : spec;
    if (!evalModel(this.model, value)) {
      throw new TypeError("Model validation failed");
    }
  }
}

export function lit(val: number): VarModel<"n">;
export function lit(val: string): VarModel<"s">;
export function lit(val: boolean): VarModel<"b">;
export function lit(): VarModel<"x">;

export function lit(val?: number | string | boolean): unknown {
  if (val == null) {
    return new VarModel("x", null);
  }
  switch (typeof val) {
    case "number":
      return new VarModel("n", val);
    case "string":
      return new VarModel("s", val);
    case "boolean":
      return new VarModel("b", val);
  }
  throw new TypeError(`invalid value ${val}`);
}

function extractNullable(x: LooseTypeRuntimeModel): LooseTypeRuntimeModel {
  if (x.type === "nullable") {
    return extractNullable(x.inner);
  }
  return x;
}

function assertType<T extends TypeNames>(
  model: LooseTypeRuntimeModel,
  type: T | T[],
): asserts model is LooseTypeRuntimeModel<T> {
  if (
    Array.isArray(type) ? !type.includes(model.type as T) : model.type != type
  ) {
    throw new TypeError(`require ${type} got ${model.type}`);
  }
}

function assertSimpleType<T extends SimpleTypeNames>(
  model: LooseTypeRuntimeModel,
  type: T | T[],
): asserts model is LooseSimpleTypeRuntimeModel<T> {
  if (
    model.type != "simple" ||
    (Array.isArray(type) ? !type.includes(model.name as T) : type != model.name)
  ) {
    throw new TypeError(
      `require ${type} got ${model.type == "simple" ? model.name : model.type}`,
    );
  }
}

function mergeType(
  a: LooseTypeRuntimeModel | undefined,
  b: LooseTypeRuntimeModel,
): LooseTypeRuntimeModel {
  if (a == null) {
    return b;
  }
  if (a.type == "nullable" || b.type == "nullable") {
    return {
      type: "nullable",
      inner: mergeType(extractNullable(a), extractNullable(b)),
    };
  }
  switch (a.type) {
    case "simple":
      assertType(b, "simple");
      assertSimpleType(b, a.name);
      return a;
    case "array":
      assertType(b, "array");
      return { type: "array", inner: mergeType(a.inner, b.inner) };
    case "function": {
      assertType(b, "function");
      if (JSON.stringify(a) != JSON.stringify(b)) {
        throw new TypeError(`cannot merge type between incompatible functions`);
      }
      return a;
    }
    case "object": {
      assertType(b, "object");
      if (JSON.stringify(a) != JSON.stringify(b)) {
        throw new TypeError(`cannot merge type between incompatible objects`);
      }
      return a;
    }
  }
  throw new TypeError("failed to merge type");
}

function acceptType(
  expected: LooseTypeRuntimeModel,
  actual: LooseTypeRuntimeModel,
): boolean {
  const merged = mergeType(expected, actual);
  return JSON.stringify(merged) == JSON.stringify(expected);
}

export class VM {
  #environment = new Map<string, VarModel>();

  set<M extends string>(
    name: string,
    spec: M,
    value: TypeMapper<M>,
  ): void;

  set<M extends string>(
    name: string,
    model: VarModel<M>,
  ): void;

  set<M extends string>(
    name: string,
    spec: M | VarModel<M>,
    value?: TypeMapper<M>,
  ) {
    this.#environment.set(
      name,
      (typeof spec == "string"
        ? new VarModel(spec, value as TypeMapper<M>)
        : spec) as unknown as VarModel,
    );
  }

  get(name: string) {
    return this.#environment.get(name);
  }

  delete(name: string) {
    this.#environment.delete(name);
  }

  #fetchType(
    expr: Expression,
    self: LooseTypeRuntimeModel,
  ): LooseTypeRuntimeModel {
    switch (expr.type) {
      case "ArrayExpression": {
        if (expr.elements.length == 0) {
          throw new TypeError("invalid array");
        }
        let tmp: LooseTypeRuntimeModel | undefined;
        for (const item of expr.elements) {
          tmp = mergeType(tmp, this.#fetchType(item, self));
        }
        return { type: "array", inner: tmp! };
      }
      case "BinaryExpression":
        switch (expr.operator) {
          case "??": {
            const left = this.#fetchType(expr.left, self);
            const right = this.#fetchType(expr.right, self);
            return mergeType(extractNullable(left), right);
          }
          case "|":
          case "^":
          case "&":
          case ">>":
          case "<<":
          case ">>>":
          case "-":
          case "%":
          case "*":
          case "/": {
            const left = this.#fetchType(expr.left, self);
            const right = this.#fetchType(expr.right, self);
            const merged = mergeType(left, right);
            assertSimpleType(merged, "number");
            return merged;
          }
          case "==":
          case "!=":
          case "===":
          case "!==": {
            const left = this.#fetchType(expr.left, self);
            const right = this.#fetchType(expr.right, self);
            const merged = extractNullable(mergeType(left, right));
            assertType(merged, "simple");
            return { type: "simple", name: "boolean" };
          }
          case ">":
          case "<":
          case ">=":
          case "<=": {
            const left = this.#fetchType(expr.left, self);
            const right = this.#fetchType(expr.right, self);
            const merged = mergeType(left, right);
            assertSimpleType(merged, ["number", "string"]);
            return { type: "simple", name: "boolean" };
          }
          case "+": {
            const left = this.#fetchType(expr.left, self);
            const right = this.#fetchType(expr.right, self);
            const merged = mergeType(left, right);
            assertSimpleType(merged, ["number", "string"]);
            return merged;
          }
          case "in": {
            const left = this.#fetchType(expr.left, self);
            const right = this.#fetchType(expr.right, self);
            assertType(right, "array");
            const merged = extractNullable(mergeType(left, right.inner));
            assertType(merged, "simple");
            return { type: "simple", name: "boolean" };
          }
        }
        throw new TypeError(`invalid operator ${expr.operator}`);
      case "CallExpression": {
        const callee = this.#fetchType(expr.callee, self);
        assertType(callee, "function");
        const args = expr.arguments.map((x) => this.#fetchType(x, self));
        const min = Math.min(args.length, callee.arguments.length);
        for (let i = 0; i < callee.arguments.length; i++) {
          const expected = callee.arguments[i];
          const actual = i >= min
            ? ({ type: "simple", name: "null" } as const)
            : args[i];
          if (!acceptType(expected, actual)) {
            throw new TypeError(`Invalid arguments ${i}`);
          }
        }
        return callee.result;
      }
      case "Compound": {
        let tmp: LooseTypeRuntimeModel = { type: "simple", name: "null" };
        for (const item of expr.body) {
          tmp = this.#fetchType(item, self);
        }
        return tmp;
      }
      case "ConditionalExpression": {
        const cond = this.#fetchType(expr.test, self);
        assertSimpleType(cond, "boolean");
        const left = this.#fetchType(expr.consequent, self);
        const right = this.#fetchType(expr.alternate, self);
        return mergeType(left, right);
      }
      case "Identifier": {
        const tmp = this.#environment.get(expr.name);
        if (tmp != null) {
          return tmp.model as LooseTypeRuntimeModel;
        } else {
          throw new ReferenceError(`${JSON.stringify(expr.name)} not found`);
        }
      }
      case "Literal":
        return { type: "simple", name: (typeof expr.value) as SimpleTypeNames };
      case "LogicalExpression": {
        const left = this.#fetchType(expr.left, self);
        const right = this.#fetchType(expr.right, self);
        assertSimpleType(left, "boolean");
        assertSimpleType(right, "boolean");
        return { type: "simple", name: "boolean" };
      }
      case "MemberExpression": {
        const obj = this.#fetchType(expr.object, self);
        if (expr.computed) {
          assertType(obj, "array");
          const prop = this.#fetchType(expr.property, self);
          assertSimpleType(prop, "number");
          return { type: "nullable", inner: extractNullable(obj.inner) };
        } else {
          assertType(obj, "object");
          if (expr.property.type === "Identifier") {
            const prop = expr.property.name;
            const m = new Map(obj.entries);
            const result = m.get(prop);
            if (result == null) {
              throw new ReferenceError(
                `${JSON.stringify(prop)} not exists in object`,
              );
            }
            return result;
          } else {
            throw new SyntaxError(`unsupported ${expr.property}`);
          }
        }
      }
      case "ThisExpression":
        return self;
      case "UnaryExpression": {
        if (!expr.prefix) {
          throw new SyntaxError(`invalid unary operator ${expr.operator}`);
        }
        const val = this.#fetchType(expr.argument, self);
        switch (expr.operator) {
          case "+": {
            assertSimpleType(val, ["boolean", "number", "string"]);
            return { type: "simple", name: "number" };
          }
          case "~":
          case "-": {
            assertSimpleType(val, "number");
            return val;
          }
          case "!": {
            assertSimpleType(val, ["boolean", "number", "string"]);
            return { type: "simple", name: "boolean" };
          }
        }
        throw new SyntaxError(`invalid unary operator ${expr.operator}`);
      }
    }
  }

  #check(
    result: LooseTypeRuntimeModel,
    expr: Expression,
    self: LooseTypeRuntimeModel,
  ): void {
    const actual = this.#fetchType(expr, self);
    if (!acceptType(result, actual)) {
      throw new TypeError(
        `expected ${JSON.stringify(result)} got ${JSON.stringify(actual)}`,
      );
    }
  }

  #eval(expr: Expression, self: unknown): unknown {
    switch (expr.type) {
      case "ArrayExpression":
        return expr.elements.map((item) => this.#eval(item, self));
      case "BinaryExpression":
        if (expr.operator == "??") {
          return this.#eval(expr.left, self) ?? this.#eval(expr.right, self);
        } else {
          // deno-lint-ignore no-explicit-any
          const left = this.#eval(expr.left, self) as any;
          // deno-lint-ignore no-explicit-any
          const right = this.#eval(expr.right, self) as any;
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
        const callee = this.#eval(expr.callee, self) as any;
        const args = expr.arguments.map((x) => this.#eval(x, self));
        return callee(...args);
      }
      case "Compound": {
        let last;
        for (const item of expr.body) {
          last = this.#eval(item, self);
        }
        return last;
      }
      case "ConditionalExpression":
        return this.#eval(expr.test, self)
          ? this.#eval(expr.consequent, self)
          : this.#eval(expr.alternate, self);
      case "Identifier":
        return this.#environment.get(expr.name)?.value;
      case "Literal":
        return expr.value;
      case "LogicalExpression":
        switch (expr.operator) {
          case "&&":
            return this.#eval(expr.left, self) && this.#eval(expr.right, self);
          case "||":
            return this.#eval(expr.left, self) || this.#eval(expr.right, self);
        }
        throw new SyntaxError(`invalid operator "${expr.operator}"`);
      case "MemberExpression": {
        // deno-lint-ignore no-explicit-any
        const obj = this.#eval(expr.object, self) as any;
        if (expr.computed) {
          // deno-lint-ignore no-explicit-any
          const prop = this.#eval(expr.property, self) as any;
          return obj[prop];
        } else {
          return expr.property.type === "Identifier"
            ? obj[expr.property.name]
            : undefined;
        }
      }
      case "ThisExpression":
        return self;
      case "UnaryExpression": {
        // deno-lint-ignore no-explicit-any
        const value = this.#eval(expr.argument, self) as any;
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

  compile<M extends string, S extends string>(
    result: M,
    code: string | Expression,
    selfSpec: S,
  ): (self: TypeMapper<S>) => TypeMapper<M> {
    if (typeof code == "string") {
      return this.compile(result, parse(code), selfSpec);
    }
    const rmod = parseModel(result);
    const selfModel = parseModel(selfSpec);
    this.#check(
      rmod as LooseTypeRuntimeModel,
      code,
      selfModel as LooseTypeRuntimeModel,
    );
    return (self: TypeMapper<S>) => this.#eval(code, self) as TypeMapper<M>;
  }

  eval<M extends string, S extends string>(
    result: M,
    code: string | Expression,
    self: VarModel<S>,
  ): TypeMapper<M> {
    if (typeof code == "string") {
      return this.eval(result, parse(code), self);
    }
    const rmod = parseModel(result);
    this.#check(
      rmod as LooseTypeRuntimeModel,
      code,
      self.model as LooseTypeRuntimeModel,
    );
    const r = this.#eval(code, self.value);
    if (evalModel(rmod, r)) {
      return r;
    } else {
      throw new TypeError("invalid result type");
    }
  }
}
