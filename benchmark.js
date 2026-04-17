const { performance } = require('perf_hooks');

const NUM_REQUESTS = 50;

const mockRequests = Array.from({ length: NUM_REQUESTS }).map((_, i) => ({
  id: i,
  branch_id: `branch-${i % 5}`,
  user_id: `user-${i % 10}`
}));

// In an N+1 scenario, Node handles requests sequentially if connection pool is limited
// To simulate realistic node behaviour we'll batch them a bit or just sum the times since Promise.all
// fires them in parallel but network bandwidth/DB concurrency isn't infinite.
const CONCURRENCY_LIMIT = 10; // Supabase/Postgres might only handle x concurrent queries well

const simulateQuery = async (time) => {
    // Artificial blocking to simulate DB/Network congestion when 100 queries are fired
    return new Promise(resolve => setTimeout(resolve, time));
}

// Mock Supabase client for N+1 scenario
const createMockSupabaseNPlus1 = () => {
  let queryCount = 0;
  let activeQueries = 0;
  return {
    getQueryCount: () => queryCount,
    from: (table) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: async () => {
              queryCount++;
              activeQueries++;
              const penalty = Math.floor(activeQueries / CONCURRENCY_LIMIT) * 5; // adding 5ms for every 10 queries
              await simulateQuery(10 + penalty);
              activeQueries--;
              return { data: table === 'branches' ? { name: 'Mock Branch' } : { email: 'mock@example.com' } };
            }
          }),
          single: async () => {
            queryCount++;
            activeQueries++;
            const penalty = Math.floor(activeQueries / CONCURRENCY_LIMIT) * 5; // adding 5ms for every 10 queries
            await simulateQuery(10 + penalty);
            activeQueries--;
            return { data: { email: 'mock@example.com' } };
          }
        })
      })
    })
  };
};

// Mock Supabase client for batched scenario
const createMockSupabaseBatched = () => {
  let queryCount = 0;
  return {
    getQueryCount: () => queryCount,
    from: (table) => ({
      select: () => ({
        in: (col, arr) => {
          const queryObj = {
            eq: async (col2, val) => {
              queryCount++;
              await simulateQuery(15);
              const mockData = Array.from({length: 5}).map((_, i) => ({ id: `branch-${i}`, name: 'Mock Branch' }));
              return { data: mockData, error: null };
            },
            then: (resolve, reject) => {
              const execute = async () => {
                queryCount++;
                await simulateQuery(15);
                const mockData = Array.from({length: 10}).map((_, i) => ({ id: `user-${i}`, email: 'mock@example.com' }));
                return { data: mockData, error: null };
              };
              execute().then(resolve).catch(reject);
            }
          };
          return queryObj;
        }
      })
    })
  };
};

async function runNPlus1() {
  const supabase = createMockSupabaseNPlus1();
  const requests = [...mockRequests];
  const start = performance.now();

  const enriched = await Promise.all(
    requests.map(async (r) => {
      const [b, u] = await Promise.all([
        supabase
          .from('branches')
          .select('name')
          .eq('id', r.branch_id)
          .eq('archived', false)
          .single(),
        supabase.from('profiles').select('email').eq('id', r.user_id).single(),
      ]);
      return {
        ...r,
        branch: b.data ? [{ name: b.data.name }] : null,
        requester: u.data ? [{ email: u.data.email }] : null,
      };
    })
  );

  const end = performance.now();
  console.log(`N+1 Query took ${end - start} ms. Database queries executed: ${supabase.getQueryCount()}`);
  return end - start;
}

async function runBatched() {
  const supabase = createMockSupabaseBatched();
  const requests = [...mockRequests];
  const start = performance.now();

  const branchIds = [...new Set(requests.map(r => r.branch_id).filter(Boolean))];
  const userIds = [...new Set(requests.map(r => r.user_id).filter(Boolean))];

  const [branchesResponse, usersResponse] = await Promise.all([
    supabase
      .from('branches')
      .select('id, name')
      .in('id', branchIds)
      .eq('archived', false),
    supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds)
  ]);

  const branchesResponseData = branchesResponse.data || [];
  const usersResponseData = usersResponse.data || [];

  const branchesMap = new Map((branchesResponseData || []).map(b => [b.id, b]));
  const usersMap = new Map((usersResponseData || []).map(u => [u.id, u]));

  const enriched = requests.map(r => ({
    ...r,
    branch: r.branch_id && branchesMap.has(r.branch_id) ? [{ name: branchesMap.get(r.branch_id).name }] : null,
    requester: r.user_id && usersMap.has(r.user_id) ? [{ email: usersMap.get(r.user_id).email }] : null,
  }));

  const end = performance.now();
  console.log(`Batched Query took ${end - start} ms. Database queries executed: ${supabase.getQueryCount()}`);
  return end - start;
}

async function runBenchmark() {
  console.log('Running benchmark for N+1 vs Batched queries...');
  await runNPlus1();
  await runBatched();
}

runBenchmark();
