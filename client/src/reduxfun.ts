

const createTestAction = (payload: string) => ({
  type: 'TEST' as const,
  payload,
});

interface AnotherAction {
  type: 'ANOTHER',
  payload: number,
}

interface Foo {
  ANOTHER: AnotherAction,
  foo: { f: number };
  bar: { b: 'hello' };
}

type Values<T> = T extends { [K in keyof T]: infer U } ? U : never;

type ReduxTypes<T> = T extends { [K in keyof T]: { type: infer U } } ? U : never;

let actions: ReduxTypes<Foo>;

// actions.

// type V = Values<Foo>;

// let v: V = { type: ReduxType., payload: 'hello'};

// console.log(v.payload);
