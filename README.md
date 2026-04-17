# Pizza - Multi-Branch Financial Management Dashboard

This project is a comprehensive multi-branch financial management and tracking application. Originally built for managing workplace finances, it provides a centralized dashboard to track branch performance, record daily income and expenses, and manage personnel roles.

## 🌟 Key Features

*   **Role-Based Access Control (RBAC):** Supports distinct user roles, including `admin`, `branch_manager`, `branch_staff`, and `user` (pending authorization).
*   **Branch Management:** Add new branches, manage existing ones, and optionally archive branches that are no longer active to keep lists clean.
*   **Daily Financial Tracking:** Record daily earnings, expenses, and a descriptive summary for each branch.
*   **Approval Workflows:** Staff can request changes to financial records, which managers or admins can approve via a dedicated interface.
*   **Financial Logs & Auditing:** Every financial action (inserts, updates, approvals) is logged securely for auditing purposes.
*   **Centralized Dashboard:**
    *   View aggregate financial data (total income, expenses, and net profit) across all assigned branches.
    *   Interactive charts displaying income/expense distribution and net profit over time.
    *   Filter financial data by specific date ranges.

## 🛠️ Tech Stack

*   **Framework:** [Next.js 15](https://nextjs.org/) (App Router, Turbopack)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) & [Radix UI](https://www.radix-ui.com/) (shadcn/ui inspired components)
*   **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL, Authentication, Row Level Security)
*   **Charts:** [Recharts](https://recharts.org/)
*   **Icons:** [Lucide React](https://lucide.dev/)

## 👥 User Roles Explained

1.  **Admin (`admin`):** Full access to the entire application. Can create branches, assign roles to users, assign managers to branches, view all financial data, and manage change requests.
2.  **Branch Manager (`branch_manager`):** Has oversight over specific branches assigned to them. They can view the dashboard for their branches, enter financial records, and approve change requests from staff.
3.  **Branch Staff (`branch_staff`):** Assigned to a single branch. They are redirected straight to their branch's data entry page upon login to input daily earnings and expenses. They can request changes if they make a mistake.
4.  **User (`user`):** The default role upon signing up. Users with this role are redirected to an "Authorization Pending" page until an Admin assigns them a proper role and branch.

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have Node.js (v18+) and npm (or yarn/pnpm) installed. You will also need a Supabase project.

### 2. Environment Variables
Create a `.env.local` file in the root directory and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Installation & Running
Install dependencies and run the development server:

`npm install`
`npm run dev`

Open http://localhost:3000 in your browser.

## 🗄️ Database Schema Setup (Supabase)

To replicate this project, you need the following PostgreSQL tables in your Supabase database. Ensure Row Level Security (RLS) is configured according to the roles.

### `profiles`
Stores extended user data linked to Supabase Auth.
*   `id` (uuid, primary key, references `auth.users`)
*   `first_name` (text)
*   `last_name` (text)
*   `email` (text)
*   `role` (text) - Default: 'user'. (e.g., 'admin', 'branch_manager', 'branch_staff', 'user')
*   `staff_branch_id` (uuid, references `branches(id)`) - The specific branch assigned if role is `branch_staff`.

### `branches`
Stores branch information.
*   `id` (uuid, primary key)
*   `name` (text)
*   `address` (text)
*   `created_at` (timestamp)
*   `archived` (boolean) - Default: `false`. Used to soft-delete branches.

### `manager_branch_assignments`
Mapping table assigning `branch_manager` users to multiple branches.
*   `id` (uuid, primary key)
*   `manager_id` (uuid, references `profiles(id)`)
*   `branch_id` (uuid, references `branches(id)`)

### `branch_financials`
Stores the daily financial records for each branch.
*   `id` (integer/uuid, primary key)
*   `branch_id` (uuid, references `branches(id)`)
*   `date` (date) - The date the record applies to.
*   `earnings` (numeric/decimal) - Total income.
*   `expenses` (numeric/decimal) - Total expenses.
*   `summary` (text) - Notes regarding the day's financials.
*   `created_at` (timestamp)

### `financial_change_requests`
Stores modification requests made by staff for existing records.
*   `id` (integer/uuid, primary key)
*   `branch_id` (uuid, references `branches(id)`)
*   `user_id` (uuid, references `profiles(id)`)
*   `requested_at` (timestamp)
*   `status` (text) - e.g., 'pending', 'approved', 'rejected'.
*   `old_data` (jsonb) - The previous state of the record.
*   `new_data` (jsonb) - The requested new state.
*   `notes` (text) - Reason for the change request.

### `financial_logs`
Audit log for all significant financial operations.
*   `id` (integer/uuid, primary key)
*   `created_at` (timestamp)
*   `branch_id` (uuid, references `branches(id)`)
*   `user_id` (uuid, references `profiles(id)`)
*   `action` (text) - e.g., 'insert', 'update', 'approve'.
*   `data` (jsonb) - Snapshot of the data during the action.

---

# Pizza - Çok Şubeli Finans Yönetim Paneli (Multi-Branch Financial Management Dashboard)

Bu proje, kapsamlı bir çok şubeli finans yönetimi ve takip uygulamasıdır. Başlangıçta iş yeri finansmanını yönetmek için oluşturulmuş olup, şube performansını izlemek, günlük gelir ve giderleri kaydetmek ve personel rollerini yönetmek için merkezi bir kontrol paneli sunar.

## 🌟 Temel Özellikler

*   **Role Dayalı Erişim Kontrolü (RBAC):** `admin`, `branch_manager` (şube yöneticisi), `branch_staff` (şube personeli) ve `user` (yetki bekleyen kullanıcı) gibi farklı kullanıcı rollerini destekler.
*   **Şube Yönetimi:** Yeni şubeler ekleyin, mevcut olanları yönetin ve listeleri temiz tutmak için artık aktif olmayan şubeleri isteğe bağlı olarak arşivleyin.
*   **Günlük Finansal Takip:** Her şube için günlük kazançları, harcamaları ve açıklayıcı özetleri kaydedin.
*   **Onay İş Akışları:** Personel, finansal kayıtlarda değişiklik talebinde bulunabilir; yöneticiler veya adminler bu talepleri özel bir arayüz üzerinden onaylayabilir.
*   **Finansal Loglar ve Denetim:** Her finansal işlem (ekleme, güncelleme, onaylama) denetim amacıyla güvenli bir şekilde kaydedilir.
*   **Merkezi Kontrol Paneli (Dashboard):**
    *   Atanan tüm şubelerdeki toplam finansal verileri (toplam gelir, gider ve net kâr) görüntüleyin.
    *   Zaman içindeki gelir/gider dağılımını ve net kârı gösteren interaktif grafikler.
    *   Finansal verileri belirli tarih aralıklarına göre filtreleyin.

## 🛠️ Kullanılan Teknolojiler

*   **Framework:** [Next.js 15](https://nextjs.org/) (App Router, Turbopack)
*   **Dil:** [TypeScript](https://www.typescriptlang.org/)
*   **Stil (Styling):** [Tailwind CSS](https://tailwindcss.com/) & [Radix UI](https://www.radix-ui.com/) (shadcn/ui ilhamlı bileşenler)
*   **Veritabanı ve Kimlik Doğrulama:** [Supabase](https://supabase.com/) (PostgreSQL, Authentication, Row Level Security)
*   **Grafikler:** [Recharts](https://recharts.org/)
*   **İkonlar:** [Lucide React](https://lucide.dev/)

## 👥 Kullanıcı Rolleri Açıklamaları

1.  **Admin (`admin`):** Tüm uygulamaya tam erişim sağlar. Şubeler oluşturabilir, kullanıcılara rol atayabilir, şubelere yönetici atayabilir, tüm finansal verileri görüntüleyebilir ve değişiklik taleplerini yönetebilir.
2.  **Şube Yöneticisi (`branch_manager`):** Kendilerine atanan belirli şubeler üzerinde gözetim yetkisine sahiptir. Şubelerinin kontrol panelini görüntüleyebilir, finansal kayıtlar girebilir ve personelden gelen değişiklik taleplerini onaylayabilir.
3.  **Şube Personeli (`branch_staff`):** Tek bir şubeye atanır. Giriş yaptıklarında, günlük gelir ve giderleri girmek için doğrudan şubelerinin veri giriş sayfasına yönlendirilirler. Hata yaparlarsa değişiklik talep edebilirler.
4.  **Kullanıcı (`user`):** Kayıt olunduğunda varsayılan roldür. Bu role sahip kullanıcılar, bir Admin onlara uygun bir rol ve şube atayana kadar "Yetki Bekleniyor (Authorization Pending)" sayfasına yönlendirilir.

## 🚀 Başlangıç

### 1. Ön Koşullar
Sisteminizde Node.js (v18+) ve npm (veya yarn/pnpm) yüklü olduğundan emin olun. Ayrıca bir Supabase projesine ihtiyacınız olacak.

### 2. Çevre Değişkenleri (Environment Variables)
Kök dizinde bir `.env.local` dosyası oluşturun ve Supabase kimlik bilgilerinizi ekleyin:

```env
NEXT_PUBLIC_SUPABASE_URL=sizin_supabase_proje_url_adresiniz
NEXT_PUBLIC_SUPABASE_ANON_KEY=sizin_supabase_anon_key_bilginiz
```

### 3. Kurulum ve Çalıştırma
Gerekli paketleri kurun ve geliştirme sunucusunu başlatın:

`npm install`
`npm run dev`

Tarayıcınızda http://localhost:3000 adresini açın.

## 🗄️ Veritabanı Şema Kurulumu (Supabase)

Bu projeyi kendi ortamınızda kurmak için Supabase veritabanınızda aşağıdaki PostgreSQL tablolarına ihtiyacınız vardır. Satır Düzeyi Güvenliğin (Row Level Security - RLS) rollere uygun şekilde yapılandırıldığından emin olun.

### `profiles`
Supabase Auth'a bağlı genişletilmiş kullanıcı verilerini saklar.
*   `id` (uuid, birincil anahtar, `auth.users`'a referans)
*   `first_name` (text)
*   `last_name` (text)
*   `email` (text)
*   `role` (text) - Varsayılan: 'user'. (örneğin; 'admin', 'branch_manager', 'branch_staff', 'user')
*   `staff_branch_id` (uuid, `branches(id)`'ye referans) - Rol `branch_staff` ise atanan belirli şube.

### `branches`
Şube bilgilerini saklar.
*   `id` (uuid, birincil anahtar)
*   `name` (text)
*   `address` (text)
*   `created_at` (timestamp)
*   `archived` (boolean) - Varsayılan: `false`. Kullanılmayan şubeleri gizlemek (soft-delete) için kullanılır.

### `manager_branch_assignments`
`branch_manager` rolündeki kullanıcıları birden fazla şubeye atayan eşleştirme (mapping) tablosudur.
*   `id` (uuid, birincil anahtar)
*   `manager_id` (uuid, `profiles(id)`'ye referans)
*   `branch_id` (uuid, `branches(id)`'ye referans)

### `branch_financials`
Her şube için günlük finansal kayıtları saklar.
*   `id` (integer/uuid, birincil anahtar)
*   `branch_id` (uuid, `branches(id)`'ye referans)
*   `date` (date) - Kaydın ait olduğu tarih.
*   `earnings` (numeric/decimal) - Toplam gelir/kazanç.
*   `expenses` (numeric/decimal) - Toplam gider/harcama.
*   `summary` (text) - O günün finansallarına dair notlar/özet.
*   `created_at` (timestamp)

### `financial_change_requests`
Personel tarafından mevcut kayıtlarda yapılmak istenen değişiklik taleplerini saklar.
*   `id` (integer/uuid, birincil anahtar)
*   `branch_id` (uuid, `branches(id)`'ye referans)
*   `user_id` (uuid, `profiles(id)`'ye referans)
*   `requested_at` (timestamp)
*   `status` (text) - örn. 'pending' (bekliyor), 'approved' (onaylandı), 'rejected' (reddedildi).
*   `old_data` (jsonb) - Kaydın önceki durumu.
*   `new_data` (jsonb) - Talep edilen yeni durum.
*   `notes` (text) - Değişiklik talebinin nedeni.

### `financial_logs`
Tüm önemli finansal işlemler için denetim günlüğü (audit log).
*   `id` (integer/uuid, birincil anahtar)
*   `created_at` (timestamp)
*   `branch_id` (uuid, `branches(id)`'ye referans)
*   `user_id` (uuid, `profiles(id)`'ye referans)
*   `action` (text) - örn. 'insert' (ekleme), 'update' (güncelleme), 'approve' (onaylama).
*   `data` (jsonb) - İşlem anındaki verinin anlık görüntüsü.
