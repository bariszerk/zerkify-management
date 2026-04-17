import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// GET: Belirli bir şubenin finansal özetlerini getirir.
// URL'deki {id} parametresi doğrudan şube ID'si (UUID) olarak kabul edilir.
export async function GET(
  request: Request,
  { params }: { params: any }
) {
  const branchId = params.id;

  if (!branchId) {
    return NextResponse.json(
      { error: 'Şube ID parametresi eksik.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Bu işlem için giriş yapmalısınız.' },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from('branch_financials')
    .select('*')
    .eq('branch_id', branchId);

  if (error) {
    return NextResponse.json(
      { error: `Finansal veri alınırken hata: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

// POST: Yeni bir finansal özet ekler.
// URL'deki {id} parametresi doğrudan şube ID'si (UUID) olarak kabul edilir.
export async function POST(
  request: Request,
  { params }: { params: any }
) {
  const branchId = params.id;

  if (!branchId) {
    return NextResponse.json(
      { error: 'Şube ID parametresi eksik.' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Şube varlığını kontrol et
  const { data: branchExists, error: branchCheckError } = await supabase
    .from('branches')
    .select('id')
    .eq('id', branchId)
    .eq('archived', false)
    .maybeSingle();

  if (branchCheckError) {
    return NextResponse.json(
      {
        error: `Şube varlığı kontrol edilirken veritabanı hatası: ${branchCheckError.message}`,
      },
      { status: 500 }
    );
  }
  if (!branchExists) {
    return NextResponse.json(
      { error: `Şube ID '${branchId}' ile eşleşen şube bulunamadı.` },
      { status: 404 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'İstek gövdesi JSON formatında değil veya okunamadı.' },
      { status: 400 }
    );
  }

  const { expenses, earnings, summary, date } = body;

  if (
    typeof expenses !== 'number' ||
    typeof earnings !== 'number' ||
    typeof summary !== 'string' ||
    typeof date !== 'string'
  ) {
    return NextResponse.json(
      {
        error:
          'Eksik veya yanlış türde alanlar. "expenses" (sayı), "earnings" (sayı), "summary" (metin), ve "date" (metin, YYYY-MM-DD) alanları gereklidir.',
      },
      { status: 400 }
    );
  }

  if (expenses < 0 || earnings < 0) {
    return NextResponse.json(
      { error: 'Harcamalar ve kazançlar negatif olamaz.' },
      { status: 400 }
    );
  }

  if (!summary.trim()) {
    return NextResponse.json(
      { error: 'Özet alanı boş olamaz.' },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Tarih formatı YYYY-MM-DD şeklinde olmalıdır.' },
      { status: 400 }
    );
  }

  const { data: insertedData, error: insertError } = await supabase
    .from('branch_financials')
    .insert([
      {
        branch_id: branchId,
        expenses,
        earnings,
        summary,
        date,
      },
    ])
    .select();

  if (insertError) {
    return NextResponse.json(
      { error: `Veri eklenirken hata: ${insertError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json(insertedData, { status: 201 });
}
