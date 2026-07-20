// Teacher Dashboard Logic

// Protect Route
window.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  if (!isLoggedIn() || !user || user.role !== 'teacher') {
    logout();
    return;
  }

  // Set name
  document.getElementById('teacherName').textContent = `المعلم: ${user.fullName}`;
  
  // Set default target date to today
  const targetDateInput = document.getElementById('targetDate');
  if (targetDateInput) {
    targetDateInput.value = new Date().toLocaleDateString('sv');
  }

  // Initial Load
  loadDashboardData();
});

function loadDashboardData() {
  loadStudents();
  loadAssignments();
  loadSubmissions();
  loadPendingStudents();
  loadTeachers();
  loadStatistics('all');
}

// --- تحميل الطلاب ---
async function loadStudents() {
  try {
    const response = await fetch(`${API_BASE}/teacher/students`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (response.ok) {
      document.getElementById('statTotalStudents').textContent = data.students.length;

      // تحديث قائمة الطلاب في فورم إضافة النقاط
      const pointsSelect = document.getElementById('pointsStudentSelect');
      if (pointsSelect) {
        pointsSelect.innerHTML = '<option value="">-- اختر طالباً --</option>' +
          data.students.map(s => `<option value="${s.id}">${escapeHtml(s.fullName)} (${s.points || 0} نقطة)</option>`).join('');
      }

      const listEl = document.getElementById('studentsListSection');
      if (data.students.length === 0) {
        listEl.innerHTML = '<div class="empty-state">لا يوجد طلاب مسجلين بعد.</div>';
        return;
      }

      listEl.innerHTML = data.students.map((student, index) => {
        // تحديد ميدالية للمراكز الأولى
        let rankBadge = '';
        if (index === 0) rankBadge = '🥇';
        else if (index === 1) rankBadge = '🥈';
        else if (index === 2) rankBadge = '🥉';

        return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--surface); border-radius: 10px; margin-bottom: 8px; border-right: 3px solid var(--primary);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.2rem;">${rankBadge}</span>
            <div>
              <span style="font-weight: 700;">${escapeHtml(student.fullName)}</span>
              <span style="font-size: 0.85rem; color: var(--text-muted); margin-right: 8px;">@${escapeHtml(student.username)}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="points-badge">⭐ ${student.points || 0} نقطة</span>
            <button onclick="handleDeleteUser('${student.id}', '${escapeHtml(student.fullName)}')" style="background: #ef4444; color: white; border: none; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 0.85rem;">🗑️ حذف</button>
          </div>
        </div>
      `;
      }).join('');
    }
  } catch (error) {
    console.error('Error loading students:', error);
  }
}

// --- تحميل المعلمين ---
async function loadTeachers() {
  try {
    const response = await fetch(`${API_BASE}/teacher/all-teachers`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (response.ok) {
      const currentUser = getUser();
      const listEl = document.getElementById('teachersListSection');
      if (data.teachers.length === 0) {
        listEl.innerHTML = '<div class="empty-state">لا يوجد معلمين.</div>';
        return;
      }

      listEl.innerHTML = data.teachers.map(teacher => {
        const isMe = teacher.id === currentUser.id;
        const deleteBtn = isMe 
          ? '<span style="font-size: 0.8rem; color: var(--text-muted);">(أنت)</span>'
          : `<button onclick="handleDeleteUser('${teacher.id}', '${escapeHtml(teacher.fullName)}')" style="background: #ef4444; color: white; border: none; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 0.85rem;">🗑️ حذف</button>`;

        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--surface); border-radius: 10px; margin-bottom: 8px; border-right: 3px solid var(--accent);">
            <div>
              <span style="font-weight: 700;">${escapeHtml(teacher.fullName)}</span>
              <span style="font-size: 0.85rem; color: var(--text-muted); margin-right: 8px;">@${escapeHtml(teacher.username)}</span>
            </div>
            ${deleteBtn}
          </div>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Error loading teachers:', error);
  }
}

// --- تحميل الطلاب المعلقين ---
async function loadPendingStudents() {
  try {
    const response = await fetch(`${API_BASE}/teacher/pending-students`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (response.ok) {
      const pendingCount = data.students.length;
      document.getElementById('statPendingStudents').textContent = pendingCount;

      const card = document.getElementById('pendingStudentsCard');
      const listEl = document.getElementById('pendingStudentsList');

      if (pendingCount === 0) {
        card.style.display = 'none';
        return;
      }

      card.style.display = 'block';
      listEl.innerHTML = data.students.map(student => {
        const date = new Date(student.createdAt).toLocaleDateString('ar-EG', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--surface); border-radius: 10px; margin-bottom: 10px; border-right: 4px solid #f59e0b;">
            <div>
              <div style="font-weight: 700; color: var(--text-primary);">${escapeHtml(student.fullName)}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">@${escapeHtml(student.username)} · سجّل في ${date}</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button onclick="approveStudent('${student.id}')" class="btn btn-primary" style="width: auto; padding: 8px 18px; font-size: 0.85rem;">✓ قبول</button>
              <button onclick="rejectStudent('${student.id}')" class="btn btn-secondary" style="width: auto; padding: 8px 18px; font-size: 0.85rem; background: #ef4444; border-color: #ef4444; color: white;">✗ رفض</button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Error loading pending students:', error);
  }
}

// --- الأوراد ---
async function loadAssignments() {
  try {
    const response = await fetch(`${API_BASE}/teacher/assignments`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (response.ok) {
      const listEl = document.getElementById('assignmentsList');
      if (data.assignments.length === 0) {
        listEl.innerHTML = `
          <tr>
            <td colspan="5" class="empty-state">
              <div class="empty-state-icon">📅</div>
              لا توجد أوراد قراءة مجدولة بعد.
            </td>
          </tr>`;
        return;
      }

      listEl.innerHTML = data.assignments.map(a => `
        <tr>
          <td style="font-weight: 700;">${escapeHtml(a.bookName)}</td>
          <td>${a.startPage}</td>
          <td>${a.endPage}</td>
          <td><span class="user-badge" style="background-color: var(--primary-glow);">${a.targetDate}</span></td>
          <td>
            <button onclick="handleDeleteAssignment('${a.id}', '${escapeHtml(a.bookName)}')" style="background: #ef4444; color: white; border: none; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 0.85rem;">🗑️ حذف</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading assignments:', error);
  }
}

// --- الإنجازات ---
async function loadSubmissions() {
  try {
    const response = await fetch(`${API_BASE}/teacher/submissions`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (response.ok) {
      document.getElementById('statTotalSubmissions').textContent = data.submissions.length;
      
      const listEl = document.getElementById('submissionsList');
      if (data.submissions.length === 0) {
        listEl.innerHTML = `
          <tr>
            <td colspan="7" class="empty-state">
              <div class="empty-state-icon">📥</div>
              لا توجد إنجازات مرسلة بعد.
            </td>
          </tr>`;
        return;
      }

      listEl.innerHTML = data.submissions.map(sub => {
        let statusBadge = sub.isCompleted
          ? '<span class="badge badge-success">أنجز القراءة ✓</span>'
          : '<span class="badge badge-danger">لم ينجز القراءة ✗</span>';

        if (sub.isLate && sub.isCompleted) {
          statusBadge += ' <span class="badge badge-warning">متأخر</span>';
        }

        // النقاط
        let pointsBadge = '';
        if (sub.pointsAwarded > 0) {
          pointsBadge = `<span class="points-badge-sm">+${sub.pointsAwarded} ⭐</span>`;
        } else {
          pointsBadge = '<span style="color: var(--text-muted); font-size: 0.85rem;">0</span>';
        }

        let detailsHtml = '';
        if (sub.questions) {
          detailsHtml += `<div class="detail-box"><div class="detail-box-title">❓ سؤال:</div><div>${escapeHtml(sub.questions)}</div></div>`;
        }
        if (sub.freeSpace) {
          detailsHtml += `<div class="detail-box"><div class="detail-box-title">📝 مساحة حرة:</div><div>${escapeHtml(sub.freeSpace)}</div></div>`;
        }
        if (!detailsHtml) {
          detailsHtml = '<span style="color: var(--text-muted); font-size: 0.9rem;">لا توجد ملاحظات</span>';
        }

        const dateFormatted = new Date(sub.submittedAt).toLocaleTimeString('ar-EG', {
          hour: '2-digit', minute: '2-digit'
        }) + ' - ' + new Date(sub.submittedAt).toLocaleDateString('ar-EG');

        return `
          <tr>
            <td style="font-weight: 700; color: var(--primary);">${escapeHtml(sub.studentName)}</td>
            <td>
              <div style="font-weight: 600;">${escapeHtml(sub.bookName)}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">صفحة: ${sub.pages}</div>
            </td>
            <td><span class="user-badge" style="font-size:0.8rem;">${sub.targetDate}</span></td>
            <td>${statusBadge}</td>
            <td>${pointsBadge}</td>
            <td style="max-width: 300px;">${detailsHtml}</td>
            <td style="font-size: 0.85rem; color: var(--text-muted);">${dateFormatted}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Error loading submissions:', error);
  }
}

// --- الإحصائيات ---
let currentStatsFilter = 'all';

async function loadStatistics(filter = 'all') {
  currentStatsFilter = filter;

  // تحديث أزرار الفلتر
  document.getElementById('statFilterToday').classList.toggle('active', filter === 'today');
  document.getElementById('statFilterWeek').classList.toggle('active', filter === 'week');
  document.getElementById('statFilterAll').classList.toggle('active', filter === 'all');

  const contentEl = document.getElementById('statisticsContent');
  contentEl.innerHTML = '<div class="empty-state">جاري تحميل الإحصائيات...</div>';

  try {
    const response = await fetch(`${API_BASE}/teacher/statistics?filter=${filter}`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error);

    const stats = data.statistics;
    const summary = stats.summary;
    const filterLabels = { today: 'إحصائيات اليوم', week: 'إحصائيات الأسبوع', all: 'إحصائيات شاملة' };
    const filterLabel = filterLabels[filter] || 'إحصائيات شاملة';

    // حسابات إضافية
    const avgPoints = summary.totalStudents > 0
      ? Math.round(summary.totalPointsAwarded / summary.totalStudents)
      : 0;
    const expectedSubmissions = summary.totalStudents * summary.totalAssignments;
    const absentCount = expectedSubmissions - summary.totalSubmissions;
    const absenceRate = expectedSubmissions > 0
      ? Math.round((absentCount / expectedSubmissions) * 100)
      : 0;
    const onTimeSubmissions = summary.completedSubmissions - summary.lateSubmissions;
    const completionPercent = summary.completionRate;

    // حساب dashoffset للحلقة (314 = 2πr = 2 * π * 50)
    const circumference = 314;
    const dashOffset = circumference - (circumference * completionPercent / 100);

    let html = `
      <div id="statsExportArea" style="padding: 20px; background: var(--card-bg); border-radius: 16px;">

        <!-- Header -->
        <div class="stats-header">
          <h3>📊 ${filterLabel} - منصة اقرأ</h3>
          <p>${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
        </div>

        <!-- بطاقات الإحصائيات مع أيقونات -->
        <div class="stats-summary-grid" style="grid-template-columns: repeat(3, 1fr);">
          <div class="stat-card stat-card-primary">
            <div class="stat-card-icon">👥</div>
            <div class="stat-value" data-animated>${summary.totalStudents}</div>
            <div class="stat-label">طالب مسجل</div>
          </div>
          <div class="stat-card stat-card-accent">
            <div class="stat-card-icon">📖</div>
            <div class="stat-value" data-animated>${summary.totalAssignments}</div>
            <div class="stat-label">ورد مجدول</div>
          </div>
          <div class="stat-card stat-card-success">
            <div class="stat-card-icon">✅</div>
            <div class="stat-value" data-animated>${summary.completedSubmissions}</div>
            <div class="stat-label">إنجاز مكتمل</div>
          </div>
          <div class="stat-card stat-card-warning">
            <div class="stat-card-icon">⏰</div>
            <div class="stat-value" data-animated>${summary.lateSubmissions}</div>
            <div class="stat-label">تسليم متأخر</div>
          </div>
          <div class="stat-card stat-card-info">
            <div class="stat-card-icon">⭐</div>
            <div class="stat-value" data-animated>${summary.totalPointsAwarded}</div>
            <div class="stat-label">نقاط ممنوحة</div>
          </div>
          <div class="stat-card stat-card-dark">
            <div class="stat-card-icon">📈</div>
            <div class="stat-value" data-animated>${avgPoints}</div>
            <div class="stat-label">متوسط النقاط / طالب</div>
          </div>
        </div>

        <!-- حلقة نسبة الإنجاز + تفاصيل -->
        <div class="completion-ring-container">
          <div class="completion-ring">
            <svg viewBox="0 0 120 120">
              <defs>
                <linearGradient id="completionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color: var(--primary)" />
                  <stop offset="100%" style="stop-color: var(--success)" />
                </linearGradient>
              </defs>
              <circle class="ring-bg" cx="60" cy="60" r="50" />
              <circle class="ring-fill" cx="60" cy="60" r="50" style="stroke-dashoffset: ${dashOffset}" />
            </svg>
            <div class="completion-ring-value">
              <div class="percentage">${completionPercent}%</div>
              <div class="label">نسبة الإنجاز</div>
            </div>
          </div>
          <div class="completion-details">
            <div class="completion-detail-item">
              <span class="completion-detail-dot" style="background: var(--success);"></span>
              <span>في الوقت: ${onTimeSubmissions > 0 ? onTimeSubmissions : 0}</span>
            </div>
            <div class="completion-detail-item">
              <span class="completion-detail-dot" style="background: var(--warning);"></span>
              <span>متأخر: ${summary.lateSubmissions}</span>
            </div>
            <div class="completion-detail-item">
              <span class="completion-detail-dot" style="background: var(--danger);"></span>
              <span>غائب: ${absentCount > 0 ? absentCount : 0} (${absenceRate}%)</span>
            </div>
            <div class="completion-detail-item">
              <span class="completion-detail-dot" style="background: var(--primary);"></span>
              <span>إجمالي: ${summary.totalSubmissions} تسليم</span>
            </div>
          </div>
        </div>
    `;

    // ترتيب الطلاب (Leaderboard)
    if (stats.studentStats && stats.studentStats.length > 0) {
      const maxPoints = Math.max(...stats.studentStats.map(s => s.totalPoints), 1);

      html += `
        <div class="leaderboard-section">
          <div class="leaderboard-title">
            <div class="leaderboard-title-icon">🏆</div>
            <span>ترتيب الطلاب</span>
          </div>
          <div class="leaderboard-list">
      `;

      stats.studentStats.forEach((s, i) => {
        let medal = '';
        let rankClass = '';
        if (i === 0) { medal = '🥇'; rankClass = 'rank-1'; }
        else if (i === 1) { medal = '🥈'; rankClass = 'rank-2'; }
        else if (i === 2) { medal = '🥉'; rankClass = 'rank-3'; }
        else { medal = `${i + 1}`; }

        const progressWidth = Math.round((s.totalPoints / maxPoints) * 100);
        const avgPointsStudent = s.submissionCount > 0
          ? Math.round(s.pointsFromAssignments / s.submissionCount)
          : 0;

        html += `
          <div class="leaderboard-item ${rankClass}">
            <div class="leaderboard-rank">${medal}</div>
            <div class="leaderboard-info">
              <div class="leaderboard-name">${escapeHtml(s.fullName)}</div>
              <div class="leaderboard-meta">
                <span class="leaderboard-meta-item">✅ ${s.completedCount} مكتمل</span>
                <span class="leaderboard-meta-item">⏰ ${s.lateCount} متأخر</span>
                <span class="leaderboard-meta-item">📊 متوسط ${avgPointsStudent} ن/تسليم</span>
              </div>
              <div class="leaderboard-progress">
                <div class="leaderboard-progress-fill" style="width: ${progressWidth}%"></div>
              </div>
            </div>
            <div class="leaderboard-points">⭐ ${s.totalPoints}</div>
          </div>
        `;
      });

      html += '</div></div>';
    }

    html += '</div>';
    contentEl.innerHTML = html;

  } catch (error) {
    contentEl.innerHTML = `<div class="empty-state">حدث خطأ في تحميل الإحصائيات</div>`;
    console.error('Error loading statistics:', error);
  }
}

// --- تحميل الإحصائيات كصورة ---
async function downloadStatsAsImage() {
  const el = document.getElementById('statsExportArea');
  if (!el) {
    showAlert('teacherAlert', 'يرجى تحميل الإحصائيات أولاً', 'danger');
    return;
  }

  try {
    const canvas = await html2canvas(el, {
      backgroundColor: '#FFFFFF',
      scale: 2,
      useCORS: true,
      logging: false
    });

    const link = document.createElement('a');
    const filterLabel = currentStatsFilter === 'today' ? 'يومية' : 'شاملة';
    const dateStr = new Date().toLocaleDateString('sv');
    link.download = `إحصائيات_اقرأ_${filterLabel}_${dateStr}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    showAlert('teacherAlert', 'تم تحميل الصورة بنجاح!', 'success');
  } catch (error) {
    showAlert('teacherAlert', 'حدث خطأ أثناء تحميل الصورة', 'danger');
    console.error('Error downloading stats image:', error);
  }
}

// --- إضافة نقاط يدوياً ---
async function handleAddPoints(e) {
  e.preventDefault();
  const studentId = document.getElementById('pointsStudentSelect').value;
  const points = document.getElementById('pointsAmount').value;

  if (!studentId || !points) {
    showAlert('teacherAlert', 'يرجى اختيار الطالب وتحديد عدد النقاط', 'danger');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/teacher/add-points`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ studentId, points: parseInt(points) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('teacherAlert', data.message, 'success');
    document.getElementById('addPointsForm').reset();
    loadDashboardData();
  } catch (error) {
    showAlert('teacherAlert', error.message, 'danger');
  }
}

// --- وظائف الحذف ---

async function handleDeleteUser(userId, userName) {
  if (!confirm(`هل أنت متأكد من حذف "${userName}"?\nسيتم حذف جميع بياناته نهائياً!`)) return;

  try {
    const response = await fetch(`${API_BASE}/teacher/delete-user/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('teacherAlert', data.message, 'success');
    loadDashboardData();
  } catch (error) {
    showAlert('teacherAlert', error.message, 'danger');
  }
}

async function handleDeleteAssignment(assignmentId, bookName) {
  if (!confirm(`هل أنت متأكد من حذف ورد "${bookName}"?\nسيتم حذف جميع التسليمات المرتبطة به!`)) return;

  try {
    const response = await fetch(`${API_BASE}/teacher/delete-assignment/${assignmentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('teacherAlert', data.message, 'success');
    loadDashboardData();
  } catch (error) {
    showAlert('teacherAlert', error.message, 'danger');
  }
}

// --- الموافقة / الرفض ---

async function approveStudent(studentId) {
  try {
    const response = await fetch(`${API_BASE}/teacher/approve-student`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ studentId })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('teacherAlert', data.message, 'success');
    loadDashboardData();
  } catch (error) {
    showAlert('teacherAlert', error.message, 'danger');
  }
}

async function rejectStudent(studentId) {
  if (!confirm('هل أنت متأكد من رفض هذا الطالب؟ سيتم حذف حسابه نهائياً.')) return;

  try {
    const response = await fetch(`${API_BASE}/teacher/reject-student`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ studentId })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('teacherAlert', 'تم رفض الطالب وحذف حسابه.', 'success');
    loadDashboardData();
  } catch (error) {
    showAlert('teacherAlert', error.message, 'danger');
  }
}

// --- إنشاء الأوراد والحسابات ---

async function handleCreateAssignment(e) {
  e.preventDefault();
  const bookName = document.getElementById('bookName').value;
  const startPage = document.getElementById('startPage').value;
  const endPage = document.getElementById('endPage').value;
  const targetDate = document.getElementById('targetDate').value;

  try {
    const response = await fetch(`${API_BASE}/teacher/assignments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ bookName, startPage, endPage, targetDate })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('teacherAlert', 'تم نشر الورد اليومي بنجاح!', 'success');
    document.getElementById('assignmentForm').reset();
    document.getElementById('targetDate').value = new Date().toLocaleDateString('sv');
    loadDashboardData();
  } catch (error) {
    showAlert('teacherAlert', error.message, 'danger');
  }
}

async function handleCreateStudent(e) {
  e.preventDefault();
  const fullName = document.getElementById('studentFullName').value;
  const username = document.getElementById('studentUsername').value;
  const password = document.getElementById('studentPassword').value;

  try {
    const response = await fetch(`${API_BASE}/teacher/students`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ fullName, username, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('teacherAlert', `تم إنشاء حساب الطالب "${fullName}" بنجاح!`, 'success');
    document.getElementById('studentForm').reset();
    loadDashboardData();
  } catch (error) {
    showAlert('teacherAlert', error.message, 'danger');
  }
}

async function handleCreateTeacher(e) {
  e.preventDefault();
  const fullName = document.getElementById('newTeacherFullName').value;
  const username = document.getElementById('newTeacherUsername').value;
  const password = document.getElementById('newTeacherPassword').value;

  try {
    const response = await fetch(`${API_BASE}/teacher/create-teacher`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ fullName, username, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('teacherAlert', `تم إنشاء حساب المعلم "${fullName}" بنجاح!`, 'success');
    document.getElementById('teacherForm').reset();
    loadDashboardData();
  } catch (error) {
    showAlert('teacherAlert', error.message, 'danger');
  }
}

// Simple HTML escaping helper
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
