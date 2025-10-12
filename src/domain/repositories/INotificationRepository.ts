import { DriftCheckResult } from '../entities/ApiTarget';

export interface INotificationRepository {
  send(result: DriftCheckResult): Promise<void>;
}
