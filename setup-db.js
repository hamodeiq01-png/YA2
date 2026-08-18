const { Client } = require('pg');

const connectionString = 'postgresql://postgres.eedfepjatrxgpdowybyw:BuAIqJ39wTPhMRgI@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const SQL = `
-- إضافة عمود حالة الموافقة
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;

-- إضافة عمود النقاط للمستخدمين
ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;

-- إضافة عمود النقاط الممنوحة للتسليمات
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS points_awarded INTEGER DEFAULT 0;

-- إضافة عمود التأخير للتسليمات
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT false;
-- إضافة جدول الاقتراحات والملاحظات
CREATE TABLE IF NOT EXISTS feedbacks (
  id BIGSERIAL PRIMARY KEY,
  sender_name TEXT,
  sender_role TEXT,
  type TEXT,
  subject TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on feedbacks" ON feedbacks;
CREATE POLICY "Allow public read on feedbacks" ON feedbacks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert on feedbacks" ON feedbacks;
CREATE POLICY "Allow public insert on feedbacks" ON feedbacks FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on feedbacks" ON feedbacks;
CREATE POLICY "Allow public delete on feedbacks" ON feedbacks FOR DELETE USING (true);

GRANT ALL ON TABLE feedbacks TO anon, authenticated, service_role, postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role, postgres;
`;

async function run() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('جاري تحديث قاعدة البيانات...');
    await client.query(SQL);
    console.log('✅ تم تحديث قاعدة البيانات بنجاح!');
    console.log('   - عمود points في جدول users');
    console.log('   - عمود points_awarded في جدول submissions');
    console.log('   - عمود is_late في جدول submissions');
  } catch (err) {
    console.error('❌ خطأ:', err.message);
  } finally {
    await client.end();
  }
}
run();
