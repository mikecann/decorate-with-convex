export const isNotNullOrUndefined = <T>(item: T | null | undefined): item is T => {
  if (item === null) return false;
  if (item === undefined) return false;
  return true;
};

export const isNotFalsey = <T>(item: T | null | undefined): item is T => {
  return Boolean(item);
};

export const isFalse = (item: boolean): item is false => item == false;

export const isTrue = (item: boolean): item is true => item == true;

export const isKinds =
  <
    TKindable extends {
      kind: string;
    },
    TKind extends TKindable["kind"],
  >(
    ...kinds: TKind[]
  ) =>
  (item: TKindable): item is Extract<TKindable, { kind: TKind }> =>
    kinds.includes(item.kind as any);

export const isKind =
  <
    TKindable extends {
      kind: string;
    },
    TKind extends TKindable["kind"],
  >(
    kind: TKind,
  ) =>
  (item: TKindable): item is Extract<TKindable, { kind: TKind }> =>
    kind == item.kind;
