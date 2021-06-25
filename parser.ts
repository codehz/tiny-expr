import jsep from "https://esm.sh/jsep";

jsep.addBinaryOp("??", 5);
jsep.addBinaryOp("in", 12);

export default (jsep as (s: string) => Expression);

export interface ArrayExpression {
  type: "ArrayExpression";
  elements: Expression[];
}

export interface BinaryExpression {
  type: "BinaryExpression";
  operator: string;
  left: Expression;
  right: Expression;
}

export interface CallExpression {
  type: "CallExpression";
  arguments: Expression[];
  callee: Expression;
}

export interface Compound {
  type: "Compound";
  body: Expression[];
}

export interface ConditionalExpression {
  type: "ConditionalExpression";
  test: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface Identifier {
  type: "Identifier";
  name: string;
}

export interface Literal {
  type: "Literal";
  value: boolean | number | string;
  raw: string;
}

export interface LogicalExpression {
  type: "LogicalExpression";
  operator: string;
  left: Expression;
  right: Expression;
}

export interface MemberExpression {
  type: "MemberExpression";
  computed: boolean;
  object: Expression;
  property: Expression;
}

export interface ThisExpression {
  type: "ThisExpression";
}

export interface UnaryExpression {
  type: "UnaryExpression";
  operator: string;
  argument: Expression;
  prefix: boolean;
}

export type ExpressionType =
  | "Compound"
  | "Identifier"
  | "MemberExpression"
  | "Literal"
  | "ThisExpression"
  | "CallExpression"
  | "UnaryExpression"
  | "BinaryExpression"
  | "LogicalExpression"
  | "ConditionalExpression"
  | "ArrayExpression";

export type Expression<
  T = ExpressionType,
> = T extends "ArrayExpression" ? ArrayExpression
  : T extends "BinaryExpression" ? BinaryExpression
  : T extends "CallExpression" ? CallExpression
  : T extends "Compound" ? Compound
  : T extends "ConditionalExpression" ? ConditionalExpression
  : T extends "Identifier" ? Identifier
  : T extends "Literal" ? Literal
  : T extends "LogicalExpression" ? LogicalExpression
  : T extends "MemberExpression" ? MemberExpression
  : T extends "ThisExpression" ? ThisExpression
  : T extends "UnaryExpression" ? UnaryExpression
  : never;
