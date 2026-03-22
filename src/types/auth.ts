/**
 * Authentication-related type definitions
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
}

export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}
