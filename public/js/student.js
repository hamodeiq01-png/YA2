// Student Dashboard Logic — Per-Book Pages

// بيانات مخزنة مؤقتاً
let allAssignmentsData = [];
let allHistoryData = [];
let currentBookName = null;

// Protect Route
window.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  if (!isLoggedIn() || !user || user.role !== 'student') {
    logout();
    return;
  }

  // Set name
  document.getElementById('studentName').textContent = `الطالب: ${user.fullName}`;

  // Load dashboard
  loadStudentDashboard();
});

function loadStudentDashboard() {
  loadStudentPoints();
  loadBooksOverview();
}

// --- تحميل نقاط الطالب الإجمالية ---
async function loadStudentPoints() {
  try {
    const response = await fetch(`${API_BASE}/student/points`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();

    if (response.ok) {
      const pointsEl = document.getElementById('studentPointsValue');
      const rankBadgeEl = document.getElementById('studentRankBadge');
      const rankTextEl = document.getElementById('studentRankText');
      const motivationEl = document.getElementById('pointsMotivation');

      pointsEl.textContent = data.points || 0;

      if (data.rank && data.totalStudents) {
        let rankEmoji = '';
        if (data.rank === 1) rankEmoji = '🥇';
        else if (data.rank === 2) rankEmoji = '🥈';
        else if (data.rank === 3) rankEmoji = '🥉';
        else rankEmoji = `#${data.rank}`;

        rankBadgeEl.textContent = rankEmoji;
        rankTextEl.textContent = `ترتيبك ${data.rank} من ${data.totalStudents} طالب`;
      }

      const points = data.points || 0;
      if (points === 0) {
        motivationEl.textContent = 'ابدأ رحلتك في القراءة واكسب أولى نقاطك! 🚀';
      } else if (points < 30) {
        motivationEl.textContent = 'بداية ممتازة! واصل القراءة واكسب المزيد! 💪';
      } else if (points < 70) {
        motivationEl.textContent = 'أحسنت! أنت في تقدم مستمر، واصل الهمة! 🌟';
      } else if (points < 150) {
        motivationEl.textContent = 'ما شاء الله! أنت من المتميزين في القراءة! 🏆';
      } else {
        motivationEl.textContent = 'بارك الله فيك! أنت قدوة في المثابرة والقراءة! 👑';
      }
    }
  } catch (error) {
    console.error('Error loading student points:', error);
  }
}

// --- أيقونات الكتب ---
function getBookIcon(index) {
  const icons = ['📗', '📘', '📕', '📙', '📓', '📔', '📒', '📚'];
  return icons[index % icons.length];
}

// --- تحميل بطاقات الكتب (الشاشة الرئيسية) ---
async function loadBooksOverview() {
  const grid = document.getElementById('booksGrid');

  try {
    // جلب الأوراد الحالية
    const assignRes = await fetch(`${API_BASE}/student/assignments/today`, {
      headers: getAuthHeaders()
    });
    const assignData = await assignRes.json();

    // جلب السجل الكامل
    const histRes = await fetch(`${API_BASE}/student/assignments/history`, {
      headers: getAuthHeaders()
    });
    const histData = await histRes.json();

    if (!assignRes.ok || !histRes.ok) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div>حدث خطأ في تحميل البيانات.</div>`;
      return;
    }

    // حفظ البيانات
    allAssignmentsData = assignData.assignments || [];
    allHistoryData = histData.history || [];

    // استخراج أسماء الكتب الفريدة من الأوراد والسجل
    const bookNamesSet = new Set();
    allAssignmentsData.forEach(item => bookNamesSet.add(item.assignment.bookName));
    allHistoryData.forEach(item => bookNamesSet.add(item.bookName));

    const bookNames = Array.from(bookNamesSet);

    if (bookNames.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🌸</div>
          <p style="font-weight: 700; font-size: 1.1rem; color: var(--primary);">لا توجد كتب منزلة لك حالياً.</p>
          <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 5px;">انتظر حتى يضيف المعلم أوراد القراءة.</p>
        </div>`;
      return;
    }

    // بناء بطاقات الكتب
    grid.innerHTML = bookNames.map((bookName, index) => {
      const icon = getBookIcon(index);

      // عدد الأوراد النشطة لهذا الكتاب
      const activeAssignments = allAssignmentsData.filter(a => a.assignment.bookName === bookName);
      const pendingCount = activeAssignments.filter(a => !a.submission).length;
      const completedCount = activeAssignments.filter(a => a.submission).length;

      // نقاط هذا الكتاب (من السجل)
      const bookHistory = allHistoryData.filter(h => h.bookName === bookName);
      const bookPoints = bookHistory.reduce((sum, h) => sum + (h.pointsAwarded || 0), 0);

      // إجمالي الأوراد
      const totalOrds = bookHistory.length;

      // آخر نشاط
      const lastActivity = bookHistory.find(h => h.submittedAt);
      let lastActivityText = 'لم يبدأ بعد';
      if (lastActivity && lastActivity.submittedAt) {
        const d = new Date(lastActivity.submittedAt);
        lastActivityText = d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
      }

      // شارة التنبيه (أوراد متبقية)
      let urgencyBadge = '';
      if (pendingCount > 0) {
        urgencyBadge = `<div class="book-select-badge book-select-badge-pending">${pendingCount} ورد متبقي</div>`;
      } else if (activeAssignments.length > 0) {
        urgencyBadge = `<div class="book-select-badge book-select-badge-done">✓ مكتمل</div>`;
      }

      return `
        <div class="book-select-card" onclick="openBook('${escapeHtml(bookName).replace(/'/g, "\\'")}')">
          ${urgencyBadge}
          <div class="book-select-icon">${icon}</div>
          <h3 class="book-select-name">${escapeHtml(bookName)}</h3>
          <div class="book-select-stats">
            <div class="book-select-stat">
              <span class="book-select-stat-value">${bookPoints}</span>
              <span class="book-select-stat-label">⭐ نقطة</span>
            </div>
            <div class="book-select-stat">
              <span class="book-select-stat-value">${totalOrds}</span>
              <span class="book-select-stat-label">📖 ورد</span>
            </div>
          </div>
          <div class="book-select-footer">
            <span class="book-select-activity">آخر نشاط: ${lastActivityText}</span>
          </div>
          <div class="book-select-enter">الدخول للكتاب ←</div>
        </div>`;
    }).join('');

  } catch (error) {
    console.error('Error loading books overview:', error);
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div>حدث خطأ أثناء تحميل الكتب.</div>`;
  }
}

// --- فتح صفحة كتاب محدد ---
function openBook(bookName) {
  currentBookName = bookName;

  // إخفاء شاشة الكتب وإظهار شاشة التفاصيل
  document.getElementById('booksView').style.display = 'none';
  const detailView = document.getElementById('bookDetailView');
  detailView.style.display = 'block';

  // أنيميشن دخول
  detailView.classList.remove('view-enter');
  void detailView.offsetWidth; // force reflow
  detailView.classList.add('view-enter');

  // تحديد أيقونة الكتاب
  const bookNames = [...new Set([
    ...allAssignmentsData.map(a => a.assignment.bookName),
    ...allHistoryData.map(h => h.bookName)
  ])];
  const bookIndex = bookNames.indexOf(bookName);
  const icon = getBookIcon(bookIndex >= 0 ? bookIndex : 0);

  // تحديث هيدر الكتاب
  document.getElementById('bookDetailIcon').textContent = icon;
  document.getElementById('bookDetailName').textContent = bookName;

  // تحميل بيانات الكتاب
  loadBookAssignments(bookName);
  loadBookHistory(bookName);
  updateBookStats(bookName);

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- الرجوع لشاشة الكتب ---
function goBackToBooks() {
  currentBookName = null;
  document.getElementById('bookDetailView').style.display = 'none';
  const booksView = document.getElementById('booksView');
  booksView.style.display = 'block';

  // تحديث البيانات
  loadBooksOverview();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- تحديث إحصائيات الكتاب ---
function updateBookStats(bookName) {
  // نقاط من السجل
  const bookHistory = allHistoryData.filter(h => h.bookName === bookName);
  const bookPoints = bookHistory.reduce((sum, h) => sum + (h.pointsAwarded || 0), 0);
  const totalOrds = bookHistory.length;

  document.getElementById('bookDetailPoints').textContent = bookPoints;
  document.getElementById('bookDetailOrdsCount').textContent = totalOrds;
}

// --- تحميل أوراد كتاب محدد ---
function loadBookAssignments(bookName) {
  const container = document.getElementById('bookAssignmentsContainer');

  // فلترة الأوراد لهذا الكتاب
  const bookAssignments = allAssignmentsData.filter(a => a.assignment.bookName === bookName);

  if (bookAssignments.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🌸</div>
        <p style="font-weight: 700; font-size: 1.1rem; color: var(--primary);">لا يوجد ورد قراءة مجدول لك اليوم في هذا الكتاب.</p>
        <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 5px;">استرح أو اقرأ قراءة حرة!</p>
      </div>`;
    return;
  }

  let globalIndex = 0;
  container.innerHTML = bookAssignments.map((item, itemIndex) => {
    const assign = item.assignment;
    const sub = item.submission;
    const currentIndex = globalIndex++;

    // حساب الفرق بالأيام
    const todayStr = new Date().toLocaleDateString('sv');
    const today = new Date(todayStr);
    const target = new Date(assign.targetDate);
    const diffDays = Math.floor((today - target) / (1000 * 60 * 60 * 24));

    // تحديد نوع الورد
    let assignType = 'today';
    let typeClass = '';
    let pointsBadge = '<span class="badge badge-success">✨ 10 نقاط عند الإنجاز</span>';

    if (diffDays === 1) {
      assignType = 'late';
      typeClass = 'assignment-type-late';
      pointsBadge = '<span class="badge badge-warning">⏰ تسليم متأخر (5 نقاط بدلاً من 10)</span>';
    } else if (diffDays >= 2) {
      assignType = 'missed';
      typeClass = 'assignment-type-missed';
      pointsBadge = '<span class="badge badge-missed">📛 ورد فائت - بدون نقاط</span>';
    }

    let html = `<div class="book-assignment-item ${typeClass}">`;

    // تنبيه الورد الفائت
    if (assignType === 'missed' && !sub) {
      html += `
        <div class="missed-alert">
          <div class="missed-alert-icon">📛</div>
          <div class="missed-alert-text">
            <strong>ورد فائت</strong> - يمكنك إنجازه لكن بدون نقاط
          </div>
        </div>`;
    }

    // معلومات الورد
    html += `
      <div class="book-assignment-meta">
        <div class="book-assignment-pages">
          📄 صفحات الورد: من ${assign.startPage} إلى ${assign.endPage}
        </div>
        <div class="book-assignment-date">
          مجدول لتاريخ: ${assign.targetDate}
        </div>
        ${pointsBadge}
      </div>`;

    if (sub) {
      // تم التسليم
      let subDetails = '';
      if (sub.questions) {
        subDetails += `
          <div class="detail-box">
            <div class="detail-box-title">❓ سؤالك المرسل:</div>
            <div>${escapeHtml(sub.questions)}</div>
          </div>`;
      }
      if (sub.freeSpace) {
        subDetails += `
          <div class="detail-box">
            <div class="detail-box-title">📝 مساحتك الحرة / تلخيصك:</div>
            <div>${escapeHtml(sub.freeSpace)}</div>
          </div>`;
      }

      html += `
        <div class="book-submission-success">
          <h4>✓ تم إرسال إنجاز هذا الورد بنجاح!</h4>
          <p style="font-size: 0.9rem; color: var(--text-main);">
            لقد أرسلت إنجازك للمعلم، بارك الله في همتك.
            ${sub.pointsAwarded > 0 ? `<span class="points-badge" style="margin-right: 8px;">+${sub.pointsAwarded} ⭐</span>` : '<span class="badge badge-missed" style="margin-right: 8px;">بدون نقاط</span>'}
            ${sub.isLate ? '<span class="badge badge-warning" style="margin-right: 4px;">متأخر</span>' : ''}
          </p>
          ${subDetails}
        </div>`;
    } else {
      // فورم التسليم
      const submitBtnText = assignType === 'missed'
        ? 'إرسال الإنجاز (بدون نقاط)'
        : 'إرسال الإنجاز للمعلم';
      const submitBtnStyle = assignType === 'missed'
        ? 'style="background: linear-gradient(135deg, #6B7280, #9CA3AF);"'
        : '';

      html += `
        <div class="book-form-section">
          <h4>✍️ تسجيل إنجازك</h4>
          <form onsubmit="handleSubmitProgress(event, '${assign.id}', ${currentIndex})">
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="isCompleted_${currentIndex}">
                <span>أؤكد أنني قرأت هذا الورد كاملاً وبتركيز.</span>
              </label>
            </div>
            <div class="form-group">
              <label>❓ هل لديك أسئلة حول ما قرأت؟ (اختياري)</label>
              <textarea id="questions_${currentIndex}" class="form-control" placeholder="اكتب سؤالك هنا..."></textarea>
            </div>
            <div class="form-group">
              <label>📝 مساحة حرة (تلخيص، خواطر) (اختياري)</label>
              <textarea id="freeSpace_${currentIndex}" class="form-control" placeholder="اكتب ما يجول في خاطرك..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary" ${submitBtnStyle}>${submitBtnText}</button>
          </form>
        </div>`;
    }

    html += '</div>';

    // فاصل بين الأوراد
    if (itemIndex < bookAssignments.length - 1) {
      html += '<div class="book-assignment-divider"></div>';
    }

    return html;
  }).join('');
}

// --- إرسال الإنجاز ---
async function handleSubmitProgress(e, assignmentId, index) {
  e.preventDefault();
  const isCompleted = document.getElementById(`isCompleted_${index}`).checked;
  const questions = document.getElementById(`questions_${index}`).value;
  const freeSpace = document.getElementById(`freeSpace_${index}`).value;

  if (!isCompleted) {
    showAlert('studentAlert', 'يرجى تأكيد أنك قرأت الورد أولاً بوضع علامة ✓', 'danger');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/student/submit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ assignmentId, isCompleted, questions, freeSpace })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('studentAlert', data.message, 'success');

    // إعادة تحميل النقاط الإجمالية
    loadStudentPoints();

    // إعادة تحميل البيانات وتحديث صفحة الكتاب
    await reloadDataAndRefreshBook();
  } catch (error) {
    showAlert('studentAlert', error.message, 'danger');
  }
}

// --- إعادة تحميل البيانات وتحديث العرض ---
async function reloadDataAndRefreshBook() {
  try {
    const assignRes = await fetch(`${API_BASE}/student/assignments/today`, {
      headers: getAuthHeaders()
    });
    const assignData = await assignRes.json();

    const histRes = await fetch(`${API_BASE}/student/assignments/history`, {
      headers: getAuthHeaders()
    });
    const histData = await histRes.json();

    allAssignmentsData = assignData.assignments || [];
    allHistoryData = histData.history || [];

    // إذا كنا في صفحة كتاب، نحدّثها
    if (currentBookName) {
      loadBookAssignments(currentBookName);
      loadBookHistory(currentBookName);
      updateBookStats(currentBookName);
    }
  } catch (error) {
    console.error('Error reloading data:', error);
  }
}

// --- تحميل سجل كتاب محدد ---
function loadBookHistory(bookName) {
  const container = document.getElementById('bookHistoryContainer');

  const bookHistory = allHistoryData.filter(h => h.bookName === bookName);

  if (bookHistory.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📚</div>
        لا توجد أوراد سابقة لهذا الكتاب.
      </div>`;
    return;
  }

  let html = `
    <div class="table-responsive">
      <table style="font-size: 0.9rem;">
        <thead>
          <tr>
            <th>الصفحات</th>
            <th>التاريخ</th>
            <th>الحالة</th>
            <th>النقاط</th>
          </tr>
        </thead>
        <tbody>`;

  bookHistory.forEach(item => {
    let statusBadge = '';
    if (item.submittedAt) {
      statusBadge = item.isCompleted
        ? '<span class="badge badge-success">تم الإنجاز ✓</span>'
        : '<span class="badge badge-danger">لم ينجز ✗</span>';
      if (item.isLate && item.isCompleted) {
        statusBadge += ' <span class="badge badge-warning">متأخر</span>';
      }
    } else {
      statusBadge = '<span class="badge badge-danger" style="background-color: #F3F4F6; color: #9CA3AF;">لم يسجل</span>';
    }

    let pointsDisplay = '';
    if (item.pointsAwarded > 0) {
      pointsDisplay = `<span class="points-badge-sm">+${item.pointsAwarded} ⭐</span>`;
    } else {
      pointsDisplay = '<span style="color: var(--text-muted);">-</span>';
    }

    html += `
      <tr>
        <td>${item.startPage} - ${item.endPage}</td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${item.targetDate}</td>
        <td>${statusBadge}</td>
        <td>${pointsDisplay}</td>
      </tr>`;
  });

  html += `
        </tbody>
      </table>
    </div>`;

  container.innerHTML = html;
}

// --- HTML Escape ---
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
