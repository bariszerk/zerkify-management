import { describe, it, expect, mock } from 'bun:test';

// Mock modules BEFORE importing the code that uses them
mock.module('@/utils/supabase/server', () => ({
  createClient: mock(() => Promise.resolve({
    auth: {
      signOut: mock(() => Promise.resolve({ error: null })),
    },
  })),
}));

mock.module('next/server', () => ({
  NextResponse: {
    json: mock((data: any, init?: any) => ({
      status: init?.status || 200,
      json: async () => data,
    })),
  },
}));

// Use dynamic import to ensure mocks are applied
const { POST } = await import('./route');
const { createClient } = await import('@/utils/supabase/server');

describe('POST /logout', () => {
  it('successfully signs out the user', async () => {
    const request = new Request('http://localhost/logout', { method: 'POST' });
    const response = await POST(request);
    const result = await response.json();

    expect(result).toEqual({ success: true });
    expect(response.status).toBe(200);
  });

  it('returns 500 when sign out fails', async () => {
    const errorMessage = 'Sign out failed';
    // Re-mock for this specific test case
    (createClient as any).mockImplementation(() => Promise.resolve({
      auth: {
        signOut: () => Promise.resolve({ error: { message: errorMessage } }),
      },
    }));

    const request = new Request('http://localhost/logout', { method: 'POST' });
    const response = await POST(request);
    const result = await response.json();

    expect(result).toEqual({ success: false, error: errorMessage });
    expect(response.status).toBe(500);
  });
});
