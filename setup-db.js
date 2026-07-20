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
