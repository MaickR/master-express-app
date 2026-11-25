export const useLocalEntities = Boolean(
  import.meta.env.DEV && window.location.hostname === '127.0.0.1' &&
  import.meta.env.VITE_BASE44_DATOS_LOCALES === 'true'
);

function createEntity(name, initialRows = []) {
  const key = `master-express:local:${name}`;
  const changes = new EventTarget();
  const read = () => JSON.parse(localStorage.getItem(key)) ?? initialRows;
  const save = (rows, type, data) => {
    localStorage.setItem(key, JSON.stringify(rows));
    changes.dispatchEvent(new CustomEvent('change', { detail: { type, id: data.id, data } }));
  };

  async function filter(criteria, sort = '-created_date', limit, skip = 0) {
    const rows = read().filter(row =>
      Object.entries(criteria).every(([field, value]) => row[field] === value)
    );
    const descending = sort.startsWith('-');
    const field = descending ? sort.slice(1) : sort;
    const direction = descending ? -1 : 1;
    rows.sort((a, b) => direction * String(a[field] ?? '').localeCompare(
      String(b[field] ?? ''), undefined, { numeric: true }
    ));
    return rows.slice(skip, limit == null ? undefined : skip + limit);
  }

  return {
    filter,
    list: (sort, limit, skip) => filter({}, sort, limit, skip),
    async get(id) {
      return read().find(row => row.id === id) ?? null;
    },
    async create(fields) {
      const date = new Date().toISOString();
      const row = { ...fields, id: crypto.randomUUID(), created_date: date, updated_date: date };
      save([...read(), row], 'create', row);
      return row;
    },
    async update(id, fields) {
      const rows = read();
      const index = rows.findIndex(row => row.id === id);
      if (index === -1) throw new Error(`Registro de ${name} no encontrado`);
      const row = { ...rows[index], ...fields, id, updated_date: new Date().toISOString() };
      rows[index] = row;
      save(rows, 'update', row);
      return row;
    },
    async delete(id) {
      save(read().filter(row => row.id !== id), 'delete', { id });
    },
    subscribe(callback) {
      const listener = event => callback(event.detail);
      changes.addEventListener('change', listener);
      return () => changes.removeEventListener('change', listener);
    }
  };
}

export function createLocalEntities() {
  const entities = new Map();

  return new Proxy({}, {
    get(_target, name) {
      if (!entities.has(name)) entities.set(name, createEntity(name));
      return entities.get(name);
    }
  });
}
