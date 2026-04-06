export interface ColumnVisibilityConfig<TKey extends string> {
  key: TKey;
  defaultVisible: boolean;
  hideable: boolean;
}

export const buildDefaultVisibleColumnKeys = <TKey extends string>(
  columns: readonly ColumnVisibilityConfig<TKey>[]
): Set<TKey> => {
  return new Set<TKey>(
    columns
      .filter((column) => column.defaultVisible || !column.hideable)
      .map((column) => column.key)
  );
};

export const normalizeVisibleColumnKeys = <TKey extends string>(
  columns: readonly ColumnVisibilityConfig<TKey>[],
  keys: readonly string[]
): Set<TKey> => {
  const normalized = new Set<TKey>();
  for (const key of keys) {
    const matched = columns.find((column) => column.key === key);
    if (matched) {
      normalized.add(matched.key);
    }
  }

  for (const column of columns) {
    if (!column.hideable) {
      normalized.add(column.key);
    }
  }

  return normalized;
};

export const buildPresetVisibleColumnKeys = <TKey extends string>(
  columns: readonly ColumnVisibilityConfig<TKey>[],
  preferredKeys: readonly TKey[]
): Set<TKey> => {
  return normalizeVisibleColumnKeys(columns, preferredKeys as readonly string[]);
};
