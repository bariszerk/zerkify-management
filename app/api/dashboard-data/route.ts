// app/api/dashboard-data/route.ts
import { createClient } from '@/utils/supabase/server';
import {
	eachDayOfInterval,
	endOfDay,
	format,
	isValid,
	parseISO,
	startOfDay,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { NextResponse } from 'next/server';
import { type DateRange } from 'react-day-picker';

type FinancialRecord = {
	id: string;
	branch_id: string;
	expenses: number;
	earnings: number;
	summary: string;
	date: string; // "yyyy-MM-dd"
};

type FinancialData = FinancialRecord & {
	branch_name?: string;
};

type OverviewChartDataPoint = {
	name: string; // Gün formatı (örn: 19 May)
	originalDate: string; // "yyyy-MM-dd" formatında tıklama için
	kazanc: number;
	netKar: number;
};

type BranchInfo = {
	id: string;
	name: string;
};

type DashboardApiResponse = {
	userRole: string | null;
	availableBranches: BranchInfo[];
	selectedBranchId?: string | null; // Seçili şube ID'si
	overviewData: OverviewChartDataPoint[];
	totalRevenue: number;
	totalExpenses: number;
	totalNetProfit: number;
	totalTransactions: number;
	cardTitleTotalRevenue: string;
	cardTitleTotalExpenses: string;
	cardTitleTotalNetProfit: string;
	cardTitleTotalTransactions: string;
	cardTitleDataEntryStatus: string;
	dataEntryStatusToday: boolean;
	dailyBreakdown: FinancialRecord[] | null; // Grafik tıklaması için tüm finansal kayıtlar
};

export async function GET(request: Request) {
	const supabase = await createClient();
	const { searchParams } = new URL(request.url);
	const fromParam = searchParams.get('from');
	const toParam = searchParams.get('to');
	const branchIdParam = searchParams.get('branch'); // Bu artık tek bir ID veya null olmalı

	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		return NextResponse.json(
			{ error: 'Yetkilendirme hatası: Kullanıcı bulunamadı.' },
			{ status: 401 }
		);
	}

	const { data: profile, error: profileError } = await supabase
		.from('profiles')
		.select('role, staff_branch_id')
		.eq('id', user.id)
		.single();

	if (profileError || !profile) {
		return NextResponse.json(
			{ error: 'Profil bulunamadı veya yetki hatası.' },
			{ status: 403 }
		);
	}

	const userRole = profile.role;
	if (userRole !== 'admin' && userRole !== 'manager') {
		return NextResponse.json(
			{ error: 'Bu verilere erişim yetkiniz yok (rol).' },
			{ status: 403 }
		);
	}

        const { data: allBranchesData, error: allBranchesError } = await supabase
                .from('branches')
                .select('id, name')
                .eq('archived', false)
                .order('name', { ascending: true });

	if (allBranchesError || !allBranchesData) {
		return NextResponse.json(
			{ error: 'Şube bilgileri alınırken bir hata oluştu.' },
			{ status: 500 }
		);
	}
	const branchMap = new Map(allBranchesData.map((b) => [b.id, b.name]));

	let availableBranchesForSelect: BranchInfo[] = [];
	let accessibleBranchIdsForQuery: string[] = [];

	if (userRole === 'admin') {
		availableBranchesForSelect = allBranchesData;
		accessibleBranchIdsForQuery = allBranchesData.map((b) => b.id);
	} else if (userRole === 'manager') {
		const { data: assignments, error: assignmentsError } = await supabase
			.from('manager_branch_assignments')
			.select('branch_id')
			.eq('manager_id', user.id);

		if (assignmentsError) {
			return NextResponse.json(
				{ error: 'Yönetici şube atamaları alınamadı.' },
				{ status: 500 }
			);
		}
		const assignedIds = assignments.map((a) => a.branch_id);
		availableBranchesForSelect = allBranchesData.filter((b) =>
			assignedIds.includes(b.id)
		);
		accessibleBranchIdsForQuery = assignedIds;

		if (availableBranchesForSelect.length === 0) {
			// Yöneticiye atanmış şube yoksa, temel bilgileri ve boş veri setlerini döndür
			return NextResponse.json({
				userRole,
				availableBranches: [],
				selectedBranchId: null,
				overviewData: [],
				totalRevenue: 0,
				totalExpenses: 0,
				totalNetProfit: 0,
				totalTransactions: 0,
				cardTitleTotalRevenue: 'Toplam Kazanç',
				cardTitleTotalExpenses: 'Toplam Gider',
				cardTitleTotalNetProfit: 'Net Kar',
				cardTitleTotalTransactions: 'Toplam İşlem',
				cardTitleDataEntryStatus: 'Bugünkü Veri Girişi',
				dataEntryStatusToday: false,
				dailyBreakdown: [],
			} as DashboardApiResponse);
		}
	}

	// Eğer branchIdParam gelmediyse (ilk yükleme, şube seçimi için)
	// sadece kullanıcı rolünü ve erişilebilir şubeleri döndür
	if (!branchIdParam) {
		return NextResponse.json({
			userRole,
			availableBranches: availableBranchesForSelect,
			selectedBranchId: null,
			// Diğer alanlar null veya boş olarak ayarlanabilir
			overviewData: [],
			totalRevenue: 0,
			totalExpenses: 0,
			totalNetProfit: 0,
			totalTransactions: 0,
			cardTitleTotalRevenue: 'Toplam Kazanç',
			cardTitleTotalExpenses: 'Toplam Gider',
			cardTitleTotalNetProfit: 'Net Kar',
			cardTitleTotalTransactions: 'Toplam İşlem',
			cardTitleDataEntryStatus: 'Bugünkü Veri Girişi',
			dataEntryStatusToday: false,
			dailyBreakdown: [],
		} as DashboardApiResponse);
	}

	// branchIdParam artık 'all' veya 'all_assigned' olmamalı.
	// Eğer gelirse, bu bir hata durumudur veya eski bir URL'dir.
	if (branchIdParam === 'all' || branchIdParam === 'all_assigned') {
		return NextResponse.json(
			{ error: 'Geçersiz şube seçimi. Lütfen belirli bir şube seçin.' },
			{ status: 400 }
		);
	}

	// Kullanıcının seçilen şubeye erişimi var mı kontrol et
	if (!accessibleBranchIdsForQuery.includes(branchIdParam)) {
		return NextResponse.json(
			{ error: 'Bu şubeye erişim yetkiniz yok.' },
			{ status: 403 }
		);
	}

	let dateRange: DateRange | undefined = undefined;
	if (fromParam && isValid(parseISO(fromParam))) {
		const fromDate = startOfDay(parseISO(fromParam));
		const toDate =
			toParam && isValid(parseISO(toParam))
				? endOfDay(parseISO(toParam))
				: endOfDay(fromDate);
		dateRange = { from: fromDate, to: toDate };
	} else {
		return NextResponse.json(
			{ error: "Geçerli 'from' tarihi gereklidir." },
			{ status: 400 }
		);
	}

	let financialQueryBuilder = supabase
		.from('branch_financials')
		.select<string, FinancialRecord>(
			'id, branch_id, expenses, earnings, summary, date'
		) // branch_name'i ayrıca ekleyeceğiz
		.eq('branch_id', branchIdParam); // Sadece seçili şubenin verileri

	if (dateRange?.from) {
		financialQueryBuilder = financialQueryBuilder.gte(
			'date',
			format(dateRange.from, 'yyyy-MM-dd')
		);
	}
	if (dateRange?.to) {
		financialQueryBuilder = financialQueryBuilder.lte(
			'date',
			format(dateRange.to, 'yyyy-MM-dd')
		);
	}

	const { data: financials, error: financialsError } =
		await financialQueryBuilder.order('date', { ascending: true }); // Grafikte doğru sıralama için ascending

	if (financialsError) {
		return NextResponse.json(
			{ error: 'Finansal veriler alınamadı: ' + financialsError.message },
			{ status: 500 }
		);
	}

	const selectedBranchName = branchMap.get(branchIdParam) || branchIdParam;
	const typedFinancials: FinancialData[] = (financials || []).map((f) => ({
		...f,
		branch_name: selectedBranchName, // Her kayda seçili şubenin adını ekle
	}));

	let totalRevenue = 0;
	let totalExpenses = 0;
	typedFinancials.forEach((item) => {
		totalRevenue += item.earnings;
		totalExpenses += item.expenses;
	});
	const totalNetProfit = totalRevenue - totalExpenses;
	const totalTransactions = typedFinancials.length;

	const overviewData: OverviewChartDataPoint[] = [];
	if (dateRange.from && dateRange.to) {
		const intervalDays = eachDayOfInterval({
			start: dateRange.from,
			end: dateRange.to,
		});

		// Pre-aggregate financials by date to avoid O(N*M) complexity
		const financialsByDate = new Map<string, { earnings: number; expenses: number }>();
		typedFinancials.forEach((item) => {
			const current = financialsByDate.get(item.date) || { earnings: 0, expenses: 0 };
			financialsByDate.set(item.date, {
				earnings: current.earnings + item.earnings,
				expenses: current.expenses + item.expenses,
			});
		});

		intervalDays.forEach((day) => {
			const dayStr = format(day, 'yyyy-MM-dd');
			const dailyData = financialsByDate.get(dayStr) || { earnings: 0, expenses: 0 };

			overviewData.push({
				name: format(day, 'dd MMM', { locale: tr }),
				originalDate: dayStr, // Tıklama için orijinal tarihi sakla
				kazanc: dailyData.earnings,
				netKar: dailyData.earnings - dailyData.expenses,
			});
		});
	}

	const todayStr = format(new Date(), 'yyyy-MM-dd');
	const dataEntryToday = typedFinancials.some((f) => f.date === todayStr);

	const responsePayload: DashboardApiResponse = {
		userRole,
		availableBranches: availableBranchesForSelect,
		selectedBranchId: branchIdParam, // Artık her zaman tek bir ID olmalı
		overviewData,
		totalRevenue,
		totalExpenses,
		totalNetProfit,
		totalTransactions,
		cardTitleTotalRevenue: `Toplam Kazanç`,
		cardTitleTotalExpenses: `Toplam Gider`,
		cardTitleTotalNetProfit: `Net Kâr`,
		cardTitleTotalTransactions: `Toplam İşlem`,
		cardTitleDataEntryStatus: `Bugünkü Veri Girişi`,
		dataEntryStatusToday: dataEntryToday,
		dailyBreakdown: typedFinancials, // Tüm finansal kayıtları gönder
	};

	return NextResponse.json(responsePayload);
}
