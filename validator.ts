import {
  LooseObjectModel,
  LooseTypeRuntimeModel,
  TypeMapper,
  TypeRuntimeModel,
} from "./types.ts";

import { C, F, SingleParser, Streams } from "https://esm.sh/@masala/parser";

function parseSimpleType(): SingleParser<LooseTypeRuntimeModel<"simple">> {
  return C.charIn("xnsb").map((c) =>
    c == "x"
      ? "null"
      : c === "n"
      ? "number"
      : c === "s"
      ? "string"
      : "boolean"
  ).map((name) => ({ type: "simple", name }));
}

function parseIdentifer() {
  return F
    .satisfy<string>((c) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z"))
    .then(
      F.satisfy<string>((c) =>
        (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") ||
        (c >= "0" && c <= "9") || c == "_"
      ).optrep(),
    ).array().map((x) => x.join(""));
}

function wrapper<Inner>(
  prefix: string,
  suffix: string,
  inner: () => SingleParser<Inner>,
) {
  return C
    .string(prefix).drop()
    .then(F.lazy(inner))
    .then(C.string(suffix).drop())
    .single();
}

function parseObjectEntry() {
  return parseIdentifer()
    .then(C.char(":").drop())
    .then<LooseTypeRuntimeModel>(parseType())
    .map((x) =>
      [x.first() as string, x.last() as LooseTypeRuntimeModel] as const
    );
}

function parseNullable(): SingleParser<LooseTypeRuntimeModel<"nullable">> {
  return wrapper("?(", ")", parseType).map((inner) => ({
    type: "nullable",
    inner,
  }));
}

function parseArray(): SingleParser<LooseTypeRuntimeModel<"array">> {
  return wrapper("[", "]", parseType).map((inner) => ({
    type: "array",
    inner,
  }));
}

function seprated<Inner>(inner: SingleParser<Inner>): SingleParser<[Inner]> {
  return inner
    .then(C.char(",").drop().then(inner).optrep())
    .array()
    .opt()
    .map((x) => x.orElse([]) as [Inner]);
}

function parseObject(): SingleParser<LooseTypeRuntimeModel<"object">> {
  return wrapper("{", "}", () => seprated(parseObjectEntry())).map((
    inner,
  ) => ({
    type: "object",
    entries: inner as unknown as LooseObjectModel,
  }));
}

function parseFunction(): SingleParser<LooseTypeRuntimeModel<"function">> {
  return wrapper(
    "f(",
    ")",
    () =>
      seprated(
        parseType()
          .optrep()
          .array(),
      )
        .map((x) => x[0])
        .then(C.string("->").drop())
        .then(parseType())
        .map((tp) => ({
          type: "function",
          arguments: tp.first() as LooseTypeRuntimeModel[],
          result: tp.last() as LooseTypeRuntimeModel,
        })),
  );
}

function parseType(): SingleParser<LooseTypeRuntimeModel> {
  return F
    .try(parseSimpleType())
    .or(F.try(parseNullable()))
    .or(F.try(parseArray()))
    .or(F.try(parseObject()))
    .or(parseFunction());
}

export function parseModel<T extends string>(input: T): TypeRuntimeModel<T> {
  const res = parseType().eos().parse(Streams.ofString(input));
  if (res.isAccepted()) {
    return res.value as TypeRuntimeModel<T>;
  } else {
    throw new SyntaxError(`failed to parse ${input}:${res.location}`);
  }
}

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
    case "nullable": {
      return input == null || evalModel(model.inner, input);
    }
    case "array": {
      return Array.isArray(input) &&
        input.every((x) => evalModel(model.inner, x));
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
