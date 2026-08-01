import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from './requireAuth';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('requireAuth', () => {
  it('calls next() when the request is authenticated', () => {
    const req = { isAuthenticated: () => true } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responds 401 and does not call next() when unauthenticated', () => {
    const req = { isAuthenticated: () => false } as unknown as Request;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });

  it('responds 401 when isAuthenticated is not present on the request', () => {
    const req = {} as Request;
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
