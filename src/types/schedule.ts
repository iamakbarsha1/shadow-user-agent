/**
 * TypeScript type definitions for the Schedule domain
 */

export interface Schedule {
  id: string;
  url: string;
  personaId: string;
  cronExpression: string;
  enabled: boolean;
  label: string | null;
  generateTests: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleRequest {
  url: string;
  personaId: string;
  cronExpression: string;
  label?: string;
  generateTests?: boolean;
}

export interface UpdateScheduleRequest {
  url?: string;
  personaId?: string;
  cronExpression?: string;
  label?: string;
  enabled?: boolean;
  generateTests?: boolean;
}

export interface CreateScheduleResponse extends Schedule {}

export interface GetScheduleResponse extends Schedule {}

export interface ListSchedulesResponse {
  schedules: Schedule[];
  total: number;
}
