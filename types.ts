type ArrayElement<A> = A extends readonly (infer T)[] ? T : never;
type Cast<X, Y> = X extends Y ? X : never;
type FromEntries<T> = T extends [infer Key, unknown][]
  ? { [K in Cast<Key, string>]: Extract<ArrayElement<T>, [K, unknown]>[1] }
  : { [key in string]: unknown };

type NoNull<T> = T extends null ? never : T;

/** @ignore */
export type ParseObject<
  T extends string,
> = T extends `` ? []
  : T extends `${infer K}:${infer V},${infer next}`
    ? [[K, TypeMapper<V>], ...ParseObject<next>]
  : T extends `${infer K}:${infer V}` ? [[K, TypeMapper<V>]]
  : never;

/** @ignore */
export type ParseObjectModel<
  T extends string,
> = T extends `` ? []
  : T extends `${infer K}:${infer V},${infer next}`
    ? [[K, TypeRuntimeModel<V>], ...ParseObjectModel<next>]
  : T extends `${infer K}:${infer V}` ? [[K, TypeRuntimeModel<V>]]
  : never;

/** @ignore */
export type ParameterMapper<
  T extends string,
> = T extends "" ? []
  : T extends `x${infer next}` ? [null, ...ParameterMapper<next>]
  : T extends `n${infer next}` ? [number, ...ParameterMapper<next>]
  : T extends `s${infer next}` ? [string, ...ParameterMapper<next>]
  : T extends `b${infer next}` ? [boolean, ...ParameterMapper<next>]
  : T extends `?(${infer X})${infer next}`
    ? [NoNull<TypeMapper<X>> | null, ...ParameterMapper<next>]
  : T extends `[${infer A}]${infer next}`
    ? [TypeMapper<A>[], ...ParameterMapper<next>]
  : T extends `{${infer O}}${infer next}`
    ? [FromEntries<ParseObject<O>>, ...ParameterMapper<next>]
  : T extends `f(${infer A}->${infer R})${infer next}`
    ? [(...args: ParameterMapper<A>) => TypeMapper<R>, ...ParameterMapper<next>]
  : never;

/**
 * Map type description to type
 * 
 * @example
 * TypeMapper<"s"> = string
 * TypeMapper<"{str:s,num:n}"> = { str: string; num: number }
 */
export type TypeMapper<
  T extends string,
> = ParameterMapper<T> extends [infer S] ? S : never;

/** @ignore */
export type ParameterRuntimeModel<
  T extends string,
> = T extends "" ? []
  : T extends `x${infer next}`
    ? [{ type: "simple"; name: "null" }, ...ParameterRuntimeModel<next>]
  : T extends `n${infer next}`
    ? [{ type: "simple"; name: "number" }, ...ParameterRuntimeModel<next>]
  : T extends `s${infer next}`
    ? [{ type: "simple"; name: "string" }, ...ParameterRuntimeModel<next>]
  : T extends `b${infer next}`
    ? [{ type: "simple"; name: "boolean" }, ...ParameterRuntimeModel<next>]
  : T extends `?(${infer X})${infer next}` ? [
    { type: "nullable"; inner: TypeRuntimeModel<X> },
    ...ParameterRuntimeModel<next>,
  ]
  : T extends `[${infer X}]${infer next}` ? [
    { type: "array"; inner: TypeRuntimeModel<X> },
    ...ParameterRuntimeModel<next>,
  ]
  : T extends `{${infer X}}${infer next}` ? [
    { type: "object"; entries: ParseObjectModel<X> },
    ...ParameterRuntimeModel<next>,
  ]
  : T extends `f(${infer A}->${infer R})${infer next}` ? [
    {
      type: "function";
      arguments: ParameterRuntimeModel<A>;
      result: TypeRuntimeModel<R>;
    },
    ...ParameterRuntimeModel<next>,
  ]
  : never;

/**
 * Type description to type model
 * 
 * @example
 * TypeRuntimeModel<"s"> = { type: "simple", name: "string" }
 */
export type TypeRuntimeModel<
  T extends string,
> = ParameterRuntimeModel<T> extends [infer S] ? S : never;

/** @ignore */
export type TypeNames = "simple" | "nullable" | "array" | "object" | "function";
/** @ignore */
export type SimpleTypeNames = "null" | "number" | "string" | "boolean";

/** @ignore */
export type LooseObjectModel = Array<[string, LooseTypeRuntimeModel]>;

/** @ignore */
export type LooseSimpleTypeRuntimeModel<
  T extends SimpleTypeNames = SimpleTypeNames,
> = {
  type: "simple";
  name: T;
};

/** @ignore */
export type LooseTypeRuntimeModel<
  X extends TypeNames = TypeNames,
> = X extends "simple" ? LooseSimpleTypeRuntimeModel
  : X extends "nullable" | "array" ? { type: X; inner: LooseTypeRuntimeModel }
  : X extends "object" ? { type: X; entries: LooseObjectModel }
  : X extends "function" ? {
    type: X;
    arguments: LooseTypeRuntimeModel[];
    result: LooseTypeRuntimeModel;
  }
  : never;
