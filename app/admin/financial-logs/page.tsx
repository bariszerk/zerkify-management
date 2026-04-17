'use client';

import { useEffect, useState, useCallback } from 'react'; // useCallback eklendi
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

type FinancialLog = {
  id: number;
  created_at: string;
  branch_id: string;
  user_id: string;
  action: string;
  data: any;
  branchName: string | null;  // Zenginleştirilmiş veri için yeni alanlar
  userEmail: string | null;   // Zenginleştirilmiş veri için yeni alanlar
};

export default function FinancialLogsPage() {
  const [logs, setLogs] = useState<FinancialLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchAndEnrichLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Ana log verilerini çek
      const { data: logData, error: logError } = await supabase
        .from('financial_logs')
        .select(`
          id,
          created_at,
          branch_id,
          user_id,
          action,
          data
        `)
        .order('created_at', { ascending: false });

      if (logError) {
        throw logError;
      }

      if (!logData) {
        setLogs([]);
        return;
      }

      // 2. Verileri zenginleştir (N+1 sorgusunu çözmek için toplu sorgu)
      const branchIds = [...new Set(logData.map((log) => log.branch_id).filter(Boolean))];
      const userIds = [...new Set(logData.map((log) => log.user_id).filter(Boolean))];

      const [branchesResponse, usersResponse] = await Promise.all([
        branchIds.length > 0
          ? supabase.from('branches').select('id, name').in('id', branchIds)
          : Promise.resolve({ data: [] }),
        userIds.length > 0
          ? supabase.from('profiles').select('id, email').in('id', userIds)
          : Promise.resolve({ data: [] }),
      ]);

      const branchesMap = new Map(
        (branchesResponse.data || []).map((b: any) => [b.id, b.name])
      );
      const usersMap = new Map(
        (usersResponse.data || []).map((u: any) => [u.id, u.email])
      );

      const enrichedLogs = logData.map((log) => ({
        ...log,
        branchName: branchesMap.get(log.branch_id) || 'Bilinmiyor',
        userEmail: usersMap.get(log.user_id) || 'Bilinmiyor',
      }));

      setLogs(enrichedLogs);

    } catch (err: any) {
      console.error('Error fetching financial logs:', err);
      setError(`Finansal kayıtları çekerken hata: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]); // useCallback bağımlılığı sadece supabase

  // Sadece sayfa ilk yüklendiğinde çalışacak tek bir useEffect
  useEffect(() => {
    fetchAndEnrichLogs();
  }, [fetchAndEnrichLogs]);


  const renderAction = (action: string) => {
    switch (action) {
      case 'FINANCIAL_DATA_ADDED':
        return <Badge variant="success">Veri Eklendi</Badge>;
      case 'FINANCIAL_DATA_UPDATED':
        return <Badge variant="warning">Veri Güncellendi</Badge>;
      case 'FINANCIAL_CHANGE_APPROVED':
        return <Badge variant="success">Değişiklik Onaylandı</Badge>;
      default:
        return <Badge>{action}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Finansal İşlem Kayıtları</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <LoadingSpinner />
              <p className="ml-2">Kayıtlar yükleniyor...</p>
            </div>
          ) : error ? (
            <div className="text-red-500 bg-red-100 p-4 rounded-md">
              <p className="font-semibold">Finansal kayıtlar yüklenemedi.</p>
              <pre className="mt-2 whitespace-pre-wrap">{error}</pre>
            </div>
          ) : (
            <>
              <div className="space-y-4 md:hidden">
                {logs.map((log) => (
                  <Card key={log.id} className="text-sm">
                    <CardHeader>
                      <CardTitle className="text-base">
                        {format(new Date(log.created_at), 'PPpp', { locale: tr })}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {log.branchName} | {log.userEmail}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {renderAction(log.action)}
                      <Card className="bg-muted p-2 text-xs border border-border">
                        <pre className="whitespace-pre-wrap break-all text-foreground">{JSON.stringify(log.data, null, 2)}</pre>
                      </Card>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Tarih</TableHead>
                    <TableHead>Şube</TableHead>
                    <TableHead>Kullanıcı</TableHead>
                    <TableHead>Eylem</TableHead>
                    <TableHead>Veri</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {format(new Date(log.created_at), 'PPpp', { locale: tr })}
                    </TableCell>
                    <TableCell>{log.branchName}</TableCell>
                    <TableCell>{log.userEmail}</TableCell>
                    <TableCell>{renderAction(log.action)}</TableCell>
                    <TableCell>
                      <Card className="bg-muted p-2 text-xs border border-border">
                        <pre className="whitespace-pre-wrap break-all text-foreground">{JSON.stringify(log.data, null, 2)}</pre>
                      </Card>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}