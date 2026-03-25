import type { Request } from 'express';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  workspaceId?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

