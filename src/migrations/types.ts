export interface Migration {
  name: string;
  version: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

export interface MigrationRecord {
  version: string;
  name: string;
  executed_at: string;
}
