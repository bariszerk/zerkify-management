import { describe, it, expect, mock } from 'bun:test';

// Helper to create a chainable mock
const createChainableMock = () => {
  const m: any = mock(() => m);
  m.single = mock(() => Promise.resolve({ data: null, error: null }));
  m.maybeSingle = mock(() => Promise.resolve({ data: null, error: null }));
  m.select = mock(() => m);
  m.eq = mock(() => m);
  m.insert = mock(() => m);
  return m;
};

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: mock(() => Promise.resolve({ data: { user: { id: 'admin-id' } } })),
  },
  from: mock((table: string) => {
    const chain = createChainableMock();
    if (table === 'profiles') {
      chain.single = mock(() => Promise.resolve({ data: { role: 'admin' }, error: null }));
    } else if (table === 'branches') {
      // Mock for insert(...).select().single()
      chain.single = mock(() => Promise.resolve({ data: { id: 'new-id' }, error: null }));
    }
    return chain;
  }),
};

mock.module('@/utils/supabase/server', () => ({
  createClient: mock(() => Promise.resolve(mockSupabase)),
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

describe('POST /api/branch', () => {
  it('returns 400 when address is not a string', async () => {
    const requestBody = {
      name: 'New Branch',
      address: { city: 'London' }, // Non-string address
    };

    const request = new Request('http://localhost/api/branch', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.message).toBe('Geçersiz adres formatı.');
  });

  it('successfully creates a branch with a string address', async () => {
    const requestBody = {
      name: 'New Branch',
      address: '123 Street',
    };

    const request = new Request('http://localhost/api/branch', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.id).toBe('new-id');
  });

  it('successfully creates a branch without an address', async () => {
    const requestBody = {
      name: 'New Branch',
    };

    const request = new Request('http://localhost/api/branch', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.id).toBe('new-id');
  });
});
