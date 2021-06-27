// deno-lint-ignore-file no-explicit-any

import {
  LooseObjectModel,
  LooseSimpleTypeRuntimeModel,
  LooseTypeRuntimeModel,
  SimpleTypeNames,
  TypeMapper,
  TypeRuntimeModel,
} from "./types.ts";

import {
  C,
  F,
  GenLex,
  SingleParser,
  Streams,
} from "https://esm.sh/@masala/parser";

const genlex = new GenLex();

genlex.keywords([
  "null",
  "string",
  "number",
  "boolean",
  "optional",
  "array",
  "object",
  "function",
  "(",
  ")",
  ":",
  ",",
]);
const identifier = genlex.tokenize(C.stringLiteral(), "identifier", 800);

function tkKey(key: string) {
  return genlex.get(key);
}

function genSimple<K extends SimpleTypeNames>(
  k: K,
): SingleParser<LooseSimpleTypeRuntimeModel<K>> {
  return tkKey(k).returns({ type: "simple", name: k });
}

function seprated<Inner>(inner: SingleParser<Inner>): SingleParser<[Inner]> {
  return inner
    .then(tkKey(",").drop().then(inner).optrep())
    .array()
    .opt()
    .map((x) => x.orElse([]) as [Inner]);
}

function parseObject(): SingleParser<LooseObjectModel> {
  return seprated(
    identifier.then(tkKey(":").drop()).then(F.lazy(parseType)).map(
      (x) => [x.first() as string, x.last() as LooseTypeRuntimeModel],
    ),
  );
}

function parseFunction(): SingleParser<LooseTypeRuntimeModel<"function">> {
  return seprated(F.lazy(parseType))
    .then(tkKey(")").drop())
    .then(F.lazy(parseType))
    .map((x) => ({
      type: "function",
      arguments: x.first() as LooseTypeRuntimeModel[],
      result: x.last() as LooseTypeRuntimeModel,
    }));
}

function parseType(): SingleParser<LooseTypeRuntimeModel> {
  return genSimple("null")
    .or(genSimple("string"))
    .or(genSimple("number"))
    .or(genSimple("boolean"))
    .or(
      tkKey("optional").then(tkKey("(")).drop().then(F.lazy(parseType)).then(
        tkKey(")").drop(),
      ).single().map((
        inner,
      ) => ({ type: "optional", inner })),
    )
    .or(
      tkKey("array").then(tkKey("(")).drop().then(F.lazy(parseType)).then(
        tkKey(")").drop(),
      ).single().map((
        inner,
      ) => ({ type: "array", inner })),
    )
    .or(
      tkKey("object").then(tkKey("(")).drop().then(parseObject()).then(
        tkKey(")").drop(),
      ).single().map((entries) => ({ type: "object", entries })),
    )
    .or(
      tkKey("function").then(tkKey("(")).drop().then(parseFunction()).single(),
    );
}

const modelParser = genlex.use(parseType().then(F.eos().drop()).single());

/**
 * Parse type description to type model
 * @param input Type description
 * @returns Type model
 */
export function parseModel<T extends string>(input: T): TypeRuntimeModel<T> {
  const res = modelParser.parse(Streams.ofString(input));
  if (res.isAccepted()) {
    return res.value as TypeRuntimeModel<T>;
  } else {
    throw new SyntaxError(`failed to parse ${input}:${res.location}`);
  }
}

/**
 * Check input value with model
 * @param model_ Type model
 * @param input Input object
 * @returns true if type matched
 */
export function evalModel<T extends string>(
  model_: TypeRuntimeModel<T>,
  input: unknown,
): input is TypeMapper<T> {
  const model = model_ as LooseTypeRuntimeModel;
  switch (model.type) {
    case "simple": {
      if (model.name == "null") {
        return input == null;
      } else {
        // deno-lint-ignore valid-typeof
        return typeof input == model.name;
      }
    }
    case "optional": {
      return input == null || evalModel(model.inner as any, input);
    }
    case "array": {
      return Array.isArray(input) &&
        input.every((x) => evalModel(model.inner as any, x));
    }
    case "object": {
      if (input == null || typeof input != "object") return false;
      for (const [key, value] of (model.entries as Array<[string, unknown]>)) {
        // @ts-ignore: bypass
        if (!evalModel(value as never, input![key])) {
          return false;
        }
      }
      return true;
    }
    case "function":
      return typeof input == "function";
  }
}
