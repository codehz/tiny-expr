// deno-lint-ignore-file no-explicit-any

type ArrayElement<A> = A extends readonly (infer T)[] ? T : never;
type Cast<X, Y> = X extends Y ? X : never;

type ParserError<T extends string> = { error: true } & T;
type EatWhitespace<
  State extends string,
> = string extends State ? ParserError<"EatWhitespace got generic string type">
  : State extends ` ${infer State}` | `\n${infer State}` ? EatWhitespace<State>
  : State;

type ParseOptional<State extends string> = string extends State
  ? ParserError<"ParseOptional got generic string type">
  : ParseTypeDesc<State> extends [infer Value, `${infer State}`]
    ? EatWhitespace<State> extends `)${infer State}`
      ? [{ type: "optional"; inner: Value }, State]
    : ParserError<"Unclosed optional">
  : ParserError<`ParseOptional receive unexpected token ${State}`>;

type ParseArray<State extends string> = string extends State
  ? ParserError<"ParseArray got generic string type">
  : ParseTypeDesc<State> extends [infer Value, `${infer State}`]
    ? EatWhitespace<State> extends `)${infer State}`
      ? [{ type: "array"; inner: Value }, State]
    : ParserError<"Unclosed array">
  : ParserError<`ParseArray receive unexpected token ${State}`>;

type AddKeyValue<
  Memo extends any[],
  Key extends string,
  Value extends any,
> = [...Memo, [Key, Value]];

type ParseObject<
  State extends string,
  Memo extends any[] = [],
> = string extends State ? ParserError<"ParseObject got generic string type">
  : EatWhitespace<State> extends `)${infer State}`
    ? [{ type: "object"; entries: Memo }, State]
  : EatWhitespace<State> extends `"${infer Key}"${infer State}`
    ? EatWhitespace<State> extends `:${infer State}`
      ? ParseTypeDesc<State> extends [infer Value, `${infer State}`]
        ? EatWhitespace<State> extends `,${infer State}`
          ? ParseObject<State, AddKeyValue<Memo, Key, Value>>
        : EatWhitespace<State> extends `)${infer State}`
          ? [{ type: "object"; entries: AddKeyValue<Memo, Key, Value> }, State]
        : ParserError<`ParseObject receive unexpected token ${State}`>
      : ParserError<`ParseObject receive unexpected value for ${State}`>
    : ParserError<`ParseObject receive unexpected token ${State}`>
  : ParserError<`ParseObject receive unexpected token ${State}`>;

type ParseFunctionResult<
  State extends string,
  Memo extends any[],
> = string extends State
  ? ParserError<"ParseFunctionResult got generic string type">
  : ParseTypeDesc<State> extends [infer Value, `${infer State}`]
    ? [{ type: "function"; arguments: Memo; result: Value }, State]
  : ParserError<`ParseFunctionResult receive unexpected token ${State}`>;

type ParseFunction<
  State extends string,
  Memo extends any[] = [],
> = string extends State ? ParserError<"ParseFunction got generic string type">
  : EatWhitespace<State> extends `)${infer State}`
    ? ParseFunctionResult<State, Memo>
  : ParseTypeDesc<State> extends [infer Value, `${infer State}`]
    ? ParseFunction<State, [...Memo, Value]>
  : EatWhitespace<State> extends `,${infer State}` ? ParseFunction<State, Memo>
  : ParserError<`ParseFunction receive unexpected token ${State}`>;

type ParseTypeDesc<State extends string> = string extends State
  ? ParserError<"ParseTypeDesc got generic string type">
  : EatWhitespace<State> extends `string${infer State}`
    ? [{ type: "simple"; name: "string" }, State]
  : EatWhitespace<State> extends `number${infer State}`
    ? [{ type: "simple"; name: "number" }, State]
  : EatWhitespace<State> extends `boolean${infer State}`
    ? [{ type: "simple"; name: "boolean" }, State]
  : EatWhitespace<State> extends `null${infer State}`
    ? [{ type: "simple"; name: "null" }, State]
  : EatWhitespace<State> extends `optional${infer State}`
    ? EatWhitespace<State> extends `(${infer State}` ? ParseOptional<State>
    : ParserError<`Expect "(" got ${State}`>
  : EatWhitespace<State> extends `array${infer State}`
    ? EatWhitespace<State> extends `(${infer State}` ? ParseArray<State>
    : ParserError<`Expect "(" got ${State}`>
  : EatWhitespace<State> extends `object${infer State}`
    ? EatWhitespace<State> extends `(${infer State}` ? ParseObject<State>
    : ParserError<`Expect "(" got ${State}`>
  : EatWhitespace<State> extends `function${infer State}`
    ? EatWhitespace<State> extends `(${infer State}` ? ParseFunction<State>
    : ParserError<`Expect "(" got ${State}`>
  : ParserError<`ParseTypeDesc receive unexpected token ${State}`>;

export type TypeRuntimeModel<
  T extends string,
> = ParseTypeDesc<T> extends infer Result
  ? Result extends [infer Value, infer Rest]
    ? Rest extends string ? EatWhitespace<Rest> extends "" ? Value
    : ParserError<`Unclosed input ${Rest}`>
    : ParserError<"Invalid state"> & Rest
  : Result extends ParserError<any> ? Result
  : ParserError<"ParseTypeDesc return unexpected result">
  : ParserError<"ParseTypeDesc returned uninferrable Result">;

type FromEntries<T> = T extends [infer Key, unknown][] ? {
  [K in Cast<Key, string>]: ModelToType<
    Extract<ArrayElement<T>, [K, unknown]>[1]
  >;
}
  : { [key in string]: unknown };

type MapArgs<
  Arguments,
  Result,
> = {
  [K in keyof Arguments]: ModelToType<Arguments[K]>;
} extends infer Args
  ? Args extends any[] ? (...args: Args) => ModelToType<Result> : never
  : never;

type ModelToType<
  T,
> = T extends { type: "simple"; name: "null" } ? null
  : T extends { type: "simple"; name: "string" } ? string
  : T extends { type: "simple"; name: "number" } ? number
  : T extends { type: "simple"; name: "boolean" } ? boolean
  : T extends { type: "optional"; inner: infer X } ? ModelToType<X> | null
  : T extends { type: "array"; inner: infer X } ? ModelToType<X>[]
  : T extends { type: "object"; entries: infer X } ? FromEntries<X>
  : T extends { type: "function"; arguments: infer Args; result: infer Res }
    ? MapArgs<Args, Res>
  : never;

export type TypeMapper<
  T extends string,
> = ModelToType<TypeRuntimeModel<T>>;

export type TypeNames = "simple" | "optional" | "array" | "object" | "function";
export type SimpleTypeNames = "null" | "number" | "string" | "boolean";
export type LooseObjectModel = Array<[string, LooseTypeRuntimeModel]>;
export type LooseSimpleTypeRuntimeModel<
  T extends SimpleTypeNames = SimpleTypeNames,
> = {
  type: "simple";
  name: T;
};
export type LooseTypeRuntimeModel<
  X extends TypeNames = TypeNames,
> = X extends "simple" ? LooseSimpleTypeRuntimeModel
  : X extends "optional" | "array" ? { type: X; inner: LooseTypeRuntimeModel }
  : X extends "object" ? { type: X; entries: LooseObjectModel }
  : X extends "function" ? {
    type: X;
    arguments: LooseTypeRuntimeModel[];
    result: LooseTypeRuntimeModel;
  }
  : never;
