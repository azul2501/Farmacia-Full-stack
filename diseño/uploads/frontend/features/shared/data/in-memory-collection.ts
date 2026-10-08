import type { MutationResult } from "@/features/shared/types/data";

type Identifiable = {
  id: string;
};

export class InMemoryCollection<T extends Identifiable> {
  private items: T[];

  constructor(seed: T[]) {
    this.items = seed.map((item) => ({ ...item }));
  }

  list() {
    return this.items.map((item) => ({ ...item }));
  }

  find(id: string) {
    const item = this.items.find((current) => current.id === id);
    return item ? { ...item } : null;
  }

  create(item: T): MutationResult<T> {
    this.items = [...this.items, { ...item }];
    return {
      data: { ...item },
      persisted: false,
      message: "Registro creado temporalmente en modo demostracion.",
    };
  }

  update(id: string, changes: Partial<Omit<T, "id">>): MutationResult<T> {
    const current = this.items.find((item) => item.id === id);
    if (!current) throw new Error("No se encontro el registro temporal.");
    const updated = { ...current, ...changes, id };
    this.items = this.items.map((item) => (item.id === id ? updated : item));
    return {
      data: { ...updated },
      persisted: false,
      message: "Registro actualizado temporalmente en modo demostracion.",
    };
  }

  remove(id: string): MutationResult<{ id: string }> {
    this.items = this.items.filter((item) => item.id !== id);
    return {
      data: { id },
      persisted: false,
      message: "Registro retirado de la coleccion temporal.",
    };
  }
}
