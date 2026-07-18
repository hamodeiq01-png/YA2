const { Client } = require('pg');

const connectionString = 'postgresql://postgres.eedfepjatrxgpdowybyw:BuAIqJ39wTPhMRgI@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const SQL = `
-- جدول المستخدمين
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  teacher_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- جدول المهام
CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES users(id) NOT NULL,
  book_name TEXT NOT NULL,
  start_page INTEGER NOT NULL,
  end_page INTEGER NOT NULL,
  target_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE assignments DISABLE ROW LEVEL SECURITY;

-- جدول الإنجازات
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES users(id) NOT NULL,
  assignment_id UUID REFERENCES assignments(id) NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  questions TEXT,
  free_space TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(student_id, assignment_id)
);
ALTER TABLE submissions DISABLE ROW LEVEL SECURITY;
`;

async function setup() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  
  try {
    console.log('جاري الاتصال بقاعدة البيانات...');
    await client.connect();
    console.log('✅ تم الاتصال بنجاح!');
    
    console.log('جاري إنشاء الجداول...');
    await client.query(SQL);
    console.log('✅ تم إنشاء جميع الجداول بنجاح!');
    
    // Verify tables exist
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('users', 'assignments', 'submissions')
      ORDER BY table_name;
    `);
    console.log('الجداول الموجودة:');
    res.rows.forEach(r => console.log('  ✓ ' + r.table_name));
    
  } catch (err) {
    console.error('❌ حدث خطأ:', err.message);
  } finally {
    await client.end();
  }
}

setup();
