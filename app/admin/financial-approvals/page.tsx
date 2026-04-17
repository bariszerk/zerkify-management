'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';

type ChangeRequest = {
  id: number;
  branch_id: string | null;
  user_id: string | null;
  requested_at: string;
  status: string;
  old_data: Record<string, any> | null;
  new_data: Record<string, any>;
  notes: string | null;
  branch?: { name: string }[] | null;
  requester?: { email: string }[] | null;
};

export default function FinancialApprovalsPage() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchRequests = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setRequests([]);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      setRequests([]);
      setLoading(false);
      return;
    }

    let query = supabase
      .from('financial_change_requests')
      .select('*')
      .eq('status', 'pending');

    if (profile.role === 'manager') {
      const { data: assignments, error: assignmentsError } = await supabase
        .from('manager_branch_assignments')
        .select('branch_id')
        .eq('manager_id', user.id);

      if (assignmentsError) {
        toast.error('Talep listesi alınamadı');
        setRequests([]);
        setLoading(false);
        return;
      }

      const branchIds = assignments?.map((a) => a.branch_id) ?? [];
      if (branchIds.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      query = query.in('branch_id', branchIds);
    } else if (profile.role !== 'admin') {
      setRequests([]);
      setLoading(false);
      return;
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      toast.error('Talep listesi alınamadı');
      setRequests([]);
    } else {
      setRequests(data as ChangeRequest[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    const enrich = async () => {
      const branchIds = [...new Set(requests.map((r) => r.branch_id).filter(Boolean))];
      const userIds = [...new Set(requests.map((r) => r.user_id).filter(Boolean))];

      const [branchesRes, usersRes] = await Promise.all([
        branchIds.length > 0
          ? supabase.from('branches').select('id, name').in('id', branchIds).eq('archived', false)
          : { data: [] },
        userIds.length > 0
          ? supabase.from('profiles').select('id, email').in('id', userIds)
          : { data: [] },
      ]);

      const branchesMap = new Map((branchesRes.data || []).map((b) => [b.id, b]));
      const usersMap = new Map((usersRes.data || []).map((u) => [u.id, u]));

      const enriched = requests.map((r) => ({
        ...r,
        branch: r.branch_id && branchesMap.has(r.branch_id) ? [{ name: branchesMap.get(r.branch_id)?.name || '' }] : null,
        requester: r.user_id && usersMap.has(r.user_id) ? [{ email: usersMap.get(r.user_id)?.email || '' }] : null,
      }));

      setRequests(enriched);
    };
    if (requests.length && !requests[0].branch) {
      enrich();
    }
  }, [requests, supabase]);

  const handleAction = async (req: ChangeRequest, approve: boolean) => {
    const status = approve ? 'approved' : 'rejected';
    const { error } = await supabase
      .from('financial_change_requests')
      .update({ status })
      .eq('id', req.id);
    if (error) {
      toast.error('İşlem başarısız');
      return;
    }
    if (approve) {
      const payload = {
        branch_id: req.branch_id ?? '',
        expenses: req.new_data.expenses,
        earnings: req.new_data.earnings,
        summary: req.new_data.summary,
        date: req.requested_at,
      };
      const { data: existing, error: fetchErr } = await supabase
        .from('branch_financials')
        .select('id')
        .eq('branch_id', req.branch_id ?? '')
        .eq('date', req.requested_at)
        .maybeSingle();
      if (!fetchErr) {
        if (existing) {
          await supabase.from('branch_financials').update(payload).eq('id', existing.id);
        } else {
          await supabase.from('branch_financials').insert([payload]);
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('financial_logs').insert([{
            branch_id: req.branch_id,
            user_id: user.id,
            action: 'FINANCIAL_CHANGE_APPROVED',
            data: payload,
          }]);
        }
      }
    }
    toast.success(`Talep ${approve ? 'onaylandı' : 'reddedildi'}`);
    await fetchRequests();
    window.dispatchEvent(new Event('approvals-updated'));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Finansal Değişiklik Talepleri</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <LoadingSpinner />
              <p className="ml-2">Kayıtlar yükleniyor...</p>
            </div>
          ) : requests.length === 0 ? (
            <p className="text-center">Bekleyen talep bulunmuyor.</p>
          ) : (
            <>
              <div className="space-y-4 md:hidden">
                {requests.map((r) => (
                  <Card key={r.id} className="text-sm">
                    <CardHeader>
                      <CardTitle className="flex flex-col gap-1 text-base">
                        <span>{format(new Date(r.requested_at), 'dd MMM yyyy', { locale: tr })}</span>
                        <span className="text-muted-foreground text-sm">{r.branch?.[0]?.name || r.branch_id}</span>
                        <span className="text-xs">{r.requester?.[0]?.email || r.user_id}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {r.old_data ? (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Önce</p>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Toplam Kazanç:</span>
                                <span className="font-medium text-green-600">₺{Number(r.old_data.earnings).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Toplam Harcama:</span>
                                <span className="font-medium text-red-600">₺{Number(r.old_data.expenses).toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Günün Özeti:</span>
                                <p className="mt-1 p-1 bg-muted/50 rounded border whitespace-pre-wrap break-words">{r.old_data.summary || 'Özet girilmemiş.'}</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="font-semibold text-muted-foreground">Sonra</p>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Toplam Kazanç:</span>
                                <span className="font-medium text-green-600">₺{Number(r.new_data.earnings).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Toplam Harcama:</span>
                                <span className="font-medium text-red-600">₺{Number(r.new_data.expenses).toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Günün Özeti:</span>
                                <p className="mt-1 p-1 bg-muted/50 rounded border whitespace-pre-wrap break-words">{r.new_data.summary || 'Özet girilmemiş.'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Toplam Kazanç:</span>
                            <span className="font-medium text-green-600">₺{Number(r.new_data.earnings).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Toplam Harcama:</span>
                            <span className="font-medium text-red-600">₺{Number(r.new_data.expenses).toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Günün Özeti:</span>
                            <p className="mt-1 p-1 bg-muted/50 rounded border whitespace-pre-wrap break-words">{r.new_data.summary || 'Özet girilmemiş.'}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={() => handleAction(r, true)}>Onayla</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAction(r, false)}>Reddet</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Şube</TableHead>
                    <TableHead>Kullanıcı</TableHead>
                    <TableHead>Veri</TableHead>
                    <TableHead>İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{format(new Date(r.requested_at), 'dd MMM yyyy', { locale: tr })}</TableCell>
                    <TableCell>{r.branch?.[0]?.name || r.branch_id}</TableCell>
                    <TableCell>{r.requester?.[0]?.email || r.user_id}</TableCell>
                    <TableCell>
                      {r.old_data ? (
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="font-semibold text-muted-foreground mb-1">Önce</p>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Toplam Kazanç:</span>
                                <span className="font-medium text-green-600">
                                  ₺{Number(r.old_data.earnings).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Toplam Harcama:</span>
                                <span className="font-medium text-red-600">
                                  ₺{Number(r.old_data.expenses).toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Günün Özeti:</span>
                                <p className="mt-1 p-1 bg-muted/50 rounded border whitespace-pre-wrap break-words">
                                  {r.old_data.summary || 'Özet girilmemiş.'}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div>
                            <p className="font-semibold text-muted-foreground mb-1">Sonra</p>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Toplam Kazanç:</span>
                                <span className="font-medium text-green-600">
                                  ₺{Number(r.new_data.earnings).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Toplam Harcama:</span>
                                <span className="font-medium text-red-600">
                                  ₺{Number(r.new_data.expenses).toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Günün Özeti:</span>
                                <p className="mt-1 p-1 bg-muted/50 rounded border whitespace-pre-wrap break-words">
                                  {r.new_data.summary || 'Özet girilmemiş.'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Toplam Kazanç:</span>
                            <span className="font-medium text-green-600">
                              ₺{Number(r.new_data.earnings).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Toplam Harcama:</span>
                            <span className="font-medium text-red-600">
                              ₺{Number(r.new_data.expenses).toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Günün Özeti:</span>
                            <p className="mt-1 p-1 bg-muted/50 rounded border whitespace-pre-wrap break-words">
                              {r.new_data.summary || 'Özet girilmemiş.'}
                            </p>
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button size="sm" onClick={() => handleAction(r, true)}>Onayla</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleAction(r, false)}>Reddet</Button>
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
