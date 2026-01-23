import { MemoryStorage } from './storage.js';
import {
  CreateEntitiesInput,
  CreateRelationsInput,
  AddObservationsInput,
  DeleteObservationsInput,
  DeleteRelationsInput,
  SearchResult
} from './types.js';

export class MemoryServer {
  private storage: MemoryStorage;

  constructor(filePath?: string) {
    this.storage = new MemoryStorage(filePath);
  }

  async initialize(): Promise<void> {
    await this.storage.load();
  }

  async create_entities(entities: CreateEntitiesInput[]): Promise<void> {
    for (const entityData of entities) {
      const existing = this.storage.getEntity(entityData.name);
      if (!existing) {
        this.storage.setEntity({
          name: entityData.name,
          entityType: entityData.entityType,
          observations: entityData.observations || []
        });
      }
    }
    await this.storage.save();
  }

  async create_relations(relations: CreateRelationsInput[]): Promise<void> {
    for (const relationData of relations) {
      // Verify both entities exist
      const fromEntity = this.storage.getEntity(relationData.from);
      const toEntity = this.storage.getEntity(relationData.to);
      
      if (fromEntity && toEntity) {
        this.storage.addRelation({
          from: relationData.from,
          to: relationData.to,
          relationType: relationData.relationType
        });
      }
    }
    await this.storage.save();
  }

  async add_observations(observations: AddObservationsInput[]): Promise<{ [entityName: string]: string[] }> {
    const result: { [entityName: string]: string[] } = {};

    for (const obsData of observations) {
      const entity = this.storage.getEntity(obsData.entityName);
      if (entity) {
        const newObservations = obsData.contents.filter(obs => !entity.observations.includes(obs));
        entity.observations.push(...newObservations);
        this.storage.setEntity(entity);
        result[obsData.entityName] = newObservations;
      } else {
        throw new Error(`Entity '${obsData.entityName}' does not exist`);
      }
    }

    await this.storage.save();
    return result;
  }

  async delete_entities(entityNames: string[]): Promise<void> {
    for (const name of entityNames) {
      this.storage.deleteEntity(name);
    }
    await this.storage.save();
  }

  async delete_observations(deletions: DeleteObservationsInput[]): Promise<void> {
    for (const deletion of deletions) {
      const entity = this.storage.getEntity(deletion.entityName);
      if (entity) {
        entity.observations = entity.observations.filter(
          obs => !deletion.observations.includes(obs)
        );
        this.storage.setEntity(entity);
      }
    }
    await this.storage.save();
  }

  async delete_relations(relations: DeleteRelationsInput[]): Promise<void> {
    for (const relation of relations) {
      this.storage.removeRelation(relation.from, relation.to, relation.relationType);
    }
    await this.storage.save();
  }

  async read_graph(): Promise<{ entities: any[], relations: any[] }> {
    const graph = this.storage.getGraph();
    return {
      entities: Array.from(graph.entities.values()),
      relations: graph.relations
    };
  }

  async search_nodes(query: string): Promise<SearchResult[]> {
    const matchingEntities = this.storage.searchEntities(query);
    const results: SearchResult[] = [];

    for (const entity of matchingEntities) {
      const relations = this.storage.getRelationsForEntity(entity.name);
      results.push({
        entity,
        relations
      });
    }

    return results;
  }

  async open_nodes(names: string[]): Promise<{ entities: any[], relations: any[] }> {
    const entities: any[] = [];
    const entityNames = new Set<string>();
    const relations: any[] = [];

    // Get requested entities
    for (const name of names) {
      const entity = this.storage.getEntity(name);
      if (entity) {
        entities.push(entity);
        entityNames.add(name);
      }
    }

    // Get relations between requested entities
    const graph = this.storage.getGraph();
    for (const relation of graph.relations) {
      if (entityNames.has(relation.from) && entityNames.has(relation.to)) {
        relations.push(relation);
      }
    }

    return { entities, relations };
  }
}
