// app/api/branch/route.ts
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const supabase = await createClient();

    // Kullanıcı oturumunu ve rolünü kontrol et (güvenlik için)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ message: 'Yetkisiz erişim.' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        return NextResponse.json({ message: 'Bu işlemi yapma yetkiniz yok.' }, { status: 403 });
    }

    // İstek gövdesini JSON olarak oku
    let body;
    try {
        body = await request.json();
    } catch (error) {
        return NextResponse.json({ message: 'Geçersiz istek formatı.' + error }, { status: 400 });
    }

    const { name, address } = body;

    // Gerekli alanları kontrol et
    if (!name || typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json({ message: 'Şube adı gereklidir.' }, { status: 400 });
    }

    if (address !== undefined && address !== null && typeof address !== 'string') {
        return NextResponse.json({ message: 'Geçersiz adres formatı.' }, { status: 400 });
    }

    // Aynı isimde başka bir şube olup olmadığını kontrol et
  const { data: existingBranch, error: checkError } = await supabase
        .from('branches')
        .select('id')
        .eq('name', name.trim())
        .eq('archived', false)
        .maybeSingle();

    if (checkError) {
        return NextResponse.json({ message: `Veritabanı hatası: ${checkError.message}` }, { status: 500 });
    }

    if (existingBranch) {
        return NextResponse.json({ message: `"${name.trim()}" adında bir şube zaten mevcut.` }, { status: 409 }); // 409 Conflict
    }

    // Yeni şubeyi veritabanına ekle
    const { data, error } = await supabase
        .from('branches')
        .insert([{
            name: name.trim(),
            address: (address && typeof address === 'string') ? address.trim() : null,
        }])
        .select()
        .single();

    if (error) {
        return NextResponse.json({ message: `Şube oluşturulurken hata: ${error.message}` }, { status: 500 });
    }

    // Başarılı yanıtı döndür
    return NextResponse.json(data, { status: 201 });
}