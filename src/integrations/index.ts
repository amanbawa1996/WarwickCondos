// src/integrations/index.ts
// Phase 1 stub: replaces Wix CMS integrations so UI can compile.
// We'll replace this with Supabase-backed services in Phase 2.

export { MemberProvider, useMember } from "./members";

export class BaseCrudService<T> {
  constructor(_collectionName: string) {}

  async find(_query?: unknown): Promise<T[]> {
    return [];
  }

  async create(_data: Partial<T>): Promise<T> {
    throw new Error("BaseCrudService.create is not implemented (Phase 1 stub).");
  }

  async update(_id: string, _data: Partial<T>): Promise<T> {
    throw new Error("BaseCrudService.update is not implemented (Phase 1 stub).");
  }

  async remove(_id: string): Promise<void> {
    throw new Error("BaseCrudService.remove is not implemented (Phase 1 stub).");
  }

  async getAll(_id: string): Promise<void> {
    throw new Error("BaseCrudService.getAll is not implemented (Phase 1 stub).");
  }
}
