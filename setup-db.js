const { Client } = require('pg');

const connectionString = 'postgresql://postgres.eedfepjatrxgpdowybyw:BuAIqJ39wTPhMRgI@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const SQL = `
-- منح جميع الصلاحيات على الجداول لجميع الأدوار
GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;

GRANT ALL ON TABLE public.assignments TO anon;
GRANT ALL ON TABLE public.assignments TO authenticated;
GRANT ALL ON TABLE public.assignments TO service_role;

GRANT ALL ON TABLE public.submissions TO anon;
GRANT ALL ON TABLE public.submissions TO authenticated;
GRANT ALL ON TABLE public.submissions TO service_role;

-- منح صلاحية استخدام الـ schema
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- تأكيد تعطيل RLS
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions DISABLE ROW LEVEL SECURITY;
`;

async function fix() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    console.log('جاري الاتصال...');
    await client.connect();
    console.log('✅ تم الاتصال');
    
    console.log('جاري منح الصلاحيات...');
    await client.query(SQL);
    console.log('✅ تم منح جميع الصلاحيات بنجاح!');
    
    // Verify
    const res = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename IN ('users', 'assignments', 'submissions');
    `);
    console.log('حالة الجداول:');
    res.rows.forEach(r => console.log(`  ✓ ${r.tablename} - RLS: ${r.rowsecurity ? 'مفعّل' : 'معطّل'}`));

    // Check grants
    const grants = await client.query(`
      SELECT grantee, table_name, privilege_type
      FROM information_schema.table_privileges
      WHERE table_schema = 'public' 
        AND table_name IN ('users', 'assignments', 'submissions')
        AND grantee IN ('anon', 'authenticated', 'service_role')
      ORDER BY table_name, grantee;
    `);
    console.log('\nالصلاحيات الممنوحة:');
    grants.rows.forEach(r => console.log(`  ✓ ${r.table_name} -> ${r.grantee}: ${r.privilege_type}`));
    
  } catch (err) {
    console.error('❌ خطأ:', err.message);
  } finally {
    await client.end();
  }
}

fix();
