import * as fs from 'fs/promises';
import * as path from 'path';
import { Entity, Relation, KnowledgeGraph } from './types.js';

export class MemoryStorage {
  private filePath: string;
  private graph: KnowledgeGraph;

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), 'memory.jsonl');
    this.graph = {
      entities: new Map(),
      relations: []
    };
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const lines = data.trim().split('\n').filter(line => line.trim());
      
      this.graph = {
        entities: new Map(),
        relations: []
      };

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'entity') {
            this.graph.entities.set(entry.data.name, entry.data);
          } else if (entry.type === 'relation') {
            this.graph.relations.push(entry.data);
          }
        } catch (parseError) {
          console.warn('Failed to parse line:', line, parseError);
        }
      }
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.warn('Error loading memory file:', error);
      }
      // File doesn't exist, start with empty graph
    }
  }

  async save(): Promise<void> {
    const lines: string[] = [];
    
    // Save entities
    for (const entity of this.graph.entities.values()) {
      lines.push(JSON.stringify({ type: 'entity', data: entity }));
    }
    
    // Save relations
    for (const relation of this.graph.relations) {
      lines.push(JSON.stringify({ type: 'relation', data: relation }));
    }

    await fs.writeFile(this.filePath, lines.join('\n'), 'utf-8');
  }

  getGraph(): KnowledgeGraph {
    return this.graph;
  }

  setGraph(graph: KnowledgeGraph): void {
    this.graph = graph;
  }

  getEntity(name: string): Entity | undefined {
    return this.graph.entities.get(name);
  }

  setEntity(entity: Entity): void {
    this.graph.entities.set(entity.name, entity);
  }

  deleteEntity(name: string): boolean {
    const deleted = this.graph.entities.delete(name);
    if (deleted) {
      // Remove all relations involving this entity
      this.graph.relations = this.graph.relations.filter(
        rel => rel.from !== name && rel.to !== name
      );
    }
    return deleted;
  }

  addRelation(relation: Relation): void {
    // Check for duplicate relations
    const exists = this.graph.relations.some(
      rel => rel.from === relation.from && 
             rel.to === relation.to && 
             rel.relationType === relation.relationType
    );
    
    if (!exists) {
      this.graph.relations.push(relation);
    }
  }

  removeRelation(from: string, to: string, relationType: string): boolean {
    const initialLength = this.graph.relations.length;
    this.graph.relations = this.graph.relations.filter(
      rel => !(rel.from === from && rel.to === to && rel.relationType === relationType)
    );
    return this.graph.relations.length < initialLength;
  }

  getRelationsForEntity(entityName: string): Relation[] {
    return this.graph.relations.filter(
      rel => rel.from === entityName || rel.to === entityName
    );
  }

  searchEntities(query: string): Entity[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.graph.entities.values()).filter(entity => 
      entity.name.toLowerCase().includes(lowerQuery) ||
      entity.entityType.toLowerCase().includes(lowerQuery) ||
      entity.observations.some(obs => obs.toLowerCase().includes(lowerQuery))
    );
  }
}
