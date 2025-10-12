import { ApiSnapshot } from '../entities/ApiTarget';

export interface ISnapshotRepository {
  save(snapshot: ApiSnapshot): Promise<void>;
  load(): Promise<ApiSnapshot | null>;
}
