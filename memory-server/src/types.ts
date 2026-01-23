export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
}

export interface Relation {
  from: string;
  to: string;
  relationType: string;
}

export interface Observation {
  entityName: string;
  observations: string[];
}

export interface KnowledgeGraph {
  entities: Map<string, Entity>;
  relations: Relation[];
}

export interface CreateEntitiesInput {
  name: string;
  entityType: string;
  observations: string[];
}

export interface CreateRelationsInput {
  from: string;
  to: string;
  relationType: string;
}

export interface AddObservationsInput {
  entityName: string;
  contents: string[];
}

export interface DeleteObservationsInput {
  entityName: string;
  observations: string[];
}

export interface DeleteRelationsInput {
  from: string;
  to: string;
  relationType: string;
}

export interface SearchResult {
  entity: Entity;
  relations: Relation[];
}
