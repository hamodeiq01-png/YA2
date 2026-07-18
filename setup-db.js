const { Client } = require('pg');

const connectionString = 'postgresql://postgres.eedfepjatrxgpdowybyw:BuAIqJ39wTPhMRgI@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const SQL = `
-- إضافة عمود حالة الموافقة
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;
`;

async function run() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('جاري تحديث قاعدة البيانات...');
    await client.query(SQL);
    console.log('✅ تم إضافة عمود is_approved بنجاح!');
  } catch (err) {
    console.error('❌ خطأ:', err.message);
  } finally {
    await client.end();
  }
}
run();
