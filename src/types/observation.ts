/**
 * Observation-related type definitions
 */

export type ObservationType =
  | 'console_error'
  | 'network_failure'
  | 'slow_response'
  | 'layout_shift'
  | 'rage_click'
  | 'broken_image'
  | 'stuck_loader'
  | 'security_finding';

export interface BaseObservation {
  id: string;
  eventType: ObservationType;
  timestamp: string;
  screenshotPath?: string;
}

export interface ConsoleErrorObservation extends BaseObservation {
  eventType: 'console_error';
  payload: {
    message: string;
    stack?: string;
    url: string;
  };
}

export interface NetworkFailureObservation extends BaseObservation {
  eventType: 'network_failure';
  payload: {
    url: string;
    statusCode: number;
    responseTime: number;
    method: string;
  };
}

export interface SlowResponseObservation extends BaseObservation {
  eventType: 'slow_response';
  payload: {
    url: string;
    duration: number;
    method: string;
  };
}

export interface LayoutShiftObservation extends BaseObservation {
  eventType: 'layout_shift';
  payload: {
    selector: string;
    clsScore: number;
  };
}

export interface RageClickObservation extends BaseObservation {
  eventType: 'rage_click';
  payload: {
    selector: string;
    coordinates: {
      x: number;
      y: number;
    };
    clickCount: number;
  };
}

export interface BrokenImageObservation extends BaseObservation {
  eventType: 'broken_image';
  payload: {
    src: string;
    alt?: string;
  };
}

export interface StuckLoaderObservation extends BaseObservation {
  eventType: 'stuck_loader';
  payload: {
    selector: string;
    visibleDuration: number;
  };
}

export interface SecurityFindingObservation extends BaseObservation {
  eventType: 'security_finding';
  payload: {
    checkName: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    evidence?: string;
    url: string;
    passed: boolean;
  };
}

export type Observation =
  | ConsoleErrorObservation
  | NetworkFailureObservation
  | SlowResponseObservation
  | LayoutShiftObservation
  | RageClickObservation
  | BrokenImageObservation
  | StuckLoaderObservation
  | SecurityFindingObservation;

export interface SessionLog {
  runId: string;
  url: string;
  personaId: string;
  startTime: string;
  endTime: string;
  observations: Observation[];
  screenshotPaths: string[];
  totalSteps: number;
  status: 'complete' | 'timeout' | 'error';
  errorMessage?: string;
}
