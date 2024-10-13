import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    username: string;
  };
}
