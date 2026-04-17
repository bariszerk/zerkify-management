import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from './client'
import { createBrowserClient } from '@supabase/ssr'

// Mock the @supabase/ssr module
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(),
}))

describe('createClient (Browser)', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup environment variables
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test-url.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    }
  })

  it('should call createBrowserClient with environment variables', () => {
    // Setup a mock return value
    const mockClient = { auth: {} }
    vi.mocked(createBrowserClient).mockReturnValue(mockClient as any)

    // Call the function
    const result = createClient()

    // Assertions
    expect(createBrowserClient).toHaveBeenCalledTimes(1)
    expect(createBrowserClient).toHaveBeenCalledWith(
      'https://test-url.supabase.co',
      'test-anon-key'
    )
    expect(result).toBe(mockClient)
  })

  it('should handle undefined environment variables', () => {
    // Override env variables for this specific test
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Call the function
    createClient()

    // It should pass undefined to the underlying library
    expect(createBrowserClient).toHaveBeenCalledTimes(1)
    expect(createBrowserClient).toHaveBeenCalledWith(undefined, undefined)
  })
})
