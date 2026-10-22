// Test database only. Production reservations always run in Convex transactions.
export class TestDb {
  rows = new Map<string, any>();
  sequence = 0;
  seed(table: string, row: any) {
    const id = row._id ?? `${table}:${++this.sequence}`;
    this.rows.set(id, { _creationTime: 0, ...row, _id: id, table });
    return id;
  }
  async get(id: string) {
    const row = this.rows.get(id);
    if (!row) return null;
    const { table, ...doc } = row;
    return structuredClone(doc);
  }
  async insert(table: string, row: any) {
    return this.seed(table, row);
  }
  async patch(id: string, update: any) {
    if (!this.rows.has(id)) throw new Error("Missing row");
    Object.assign(this.rows.get(id), structuredClone(update));
  }
  async delete(id: string) {
    this.rows.delete(id);
  }
  query(table: string) {
    const conditions: Array<(row: any) => boolean> = [];
    let descending = false;
    const field = (row: any, path: string) =>
      path.split(".").reduce((x, key) => x?.[key], row);
    const q: any = {
      eq: (key: string, value: any) => {
        conditions.push((row) => field(row, key) === value);
        return q;
      },
      field: (key: string) => key,
    };
    const result = () =>
      [...this.rows.values()]
        .filter((row) => row.table === table && conditions.every((c) => c(row)))
        .sort((a, b) =>
          descending
            ? b._creationTime - a._creationTime
            : a._creationTime - b._creationTime,
        )
        .map(({ table, ...doc }) => structuredClone(doc));
    const chain: any = {
      withIndex: (_name: string, callback: any) => {
        callback(q);
        return chain;
      },
      filter: (callback: any) => {
        callback(q);
        return chain;
      },
      order: (direction: string) => {
        descending = direction === "desc";
        return chain;
      },
      unique: async () => {
        const rows = result();
        if (rows.length > 1) throw new Error("Duplicate row");
        return rows[0] ?? null;
      },
      first: async () => result()[0] ?? null,
      collect: async () => result(),
      take: async (n: number) => result().slice(0, n),
    };
    return chain;
  }
}

export function invoke(fn: any, ctx: any, args: any = {}) {
  // Older Convex versions expose the handler directly; newer ones wrap it.
  return (fn._handler ?? fn)(ctx, args);
}
