// Teacher Dashboard Logic

// Tab switching
function switchTab(tabName) {
  // Hide all tab contents
  document.querySelectorAll('.teacher-tab-content').forEach(el => {
    el.classList.remove('active');
  });
  // Deactivate all tab buttons
  document.querySelectorAll('.teacher-tab').forEach(el => {
    el.classList.remove('active');
  });

  // Show selected tab
  const tabContent = document.getElementById('tab-' + tabName);
  if (tabContent) {
    tabContent.classList.remove('active');
    // Force reflow for animation
    void tabContent.offsetWidth;
    tabContent.classList.add('active');
  }

  // Activate button
  const tabBtn = document.querySelector(`.teacher-tab[data-tab="${tabName}"]`);
  if (tabBtn) tabBtn.classList.add('active');

  // If feedback tab is opened, reload feedbacks
  if (tabName === 'feedback') {
    loadTeacherFeedbacks();
  }

  // If messages tab is opened, reload conversations
  if (tabName === 'messages') {
    loadTeacherConversations();
  }

  // Save to localStorage
  localStorage.setItem('teacherActiveTab', tabName);
}


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

  // Polling unread messages count every 15s
  setInterval(() => {
    loadUnreadMessagesCount();
    if (activeChatUserId) {
      loadActiveChatMessages(activeChatUserId, true);
    }
  }, 15000);

  // Restore saved tab
  const savedTab = localStorage.getItem('teacherActiveTab');
  if (savedTab) switchTab(savedTab);
});

function loadDashboardData() {
  loadStudents();
  loadAssignments();
  loadSubmissions();
  loadPendingStudents();
  loadTeachers();
  loadStatistics('all');
  loadBookNames();
  loadTeacherFeedbacks();
  loadUnreadMessagesCount();
  loadTeacherConversations();
}


// --- تحميل الطلاب والبحث ---
let cachedStudents = [];

function filterStudentsList() {
  const query = (document.getElementById('studentSearchInput')?.value || '').trim().toLowerCase();
  const listEl = document.getElementById('studentsListSection');
  if (!listEl) return;

  const filtered = cachedStudents.filter(s => 
    s.fullName.toLowerCase().includes(query) || s.username.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    listEl.innerHTML = '<div class="empty-state">لا يوجد طلاب مطابقين للبحث.</div>';
    return;
  }

  listEl.innerHTML = filtered.map((student, index) => {
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
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="points-badge">⭐ ${student.points || 0} نقطة</span>
          <button type="button" class="btn-student-msg" onclick="openStudentChatDirect('${student.id}', '${escapeHtml(student.fullName)}')" title="مراسلة الطالب">💬 مراسلة</button>
          <button onclick="handleDeleteUser('${student.id}', '${escapeHtml(student.fullName)}')" style="background: #ef4444; color: white; border: none; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 0.85rem;">🗑️ حذف</button>
        </div>
      </div>
    `;
  }).join('');
}

async function loadStudents() {
  try {
    const response = await fetch(`${API_BASE}/teacher/students`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (response.ok) {
      cachedStudents = data.students || [];
      document.getElementById('statTotalStudents').textContent = cachedStudents.length;

      // تحديث قائمة الطلاب في فورم إضافة النقاط
      const pointsSelect = document.getElementById('pointsStudentSelect');
      if (pointsSelect) {
        pointsSelect.innerHTML = '<option value="">-- اختر طالباً --</option>' +
          cachedStudents.map(s => `<option value="${s.id}">${escapeHtml(s.fullName)} (${s.points || 0} نقطة)</option>`).join('');
      }

      filterStudentsList();
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
    // إضافة وضع التصدير للتخطيط العريض
    el.classList.add('export-mode');

    // انتظار قليلاً لتطبيق الأنماط
    await new Promise(r => setTimeout(r, 100));

    const canvas = await html2canvas(el, {
      backgroundColor: '#FFFFFF',
      scale: 2,
      useCORS: true,
      logging: false,
      width: el.scrollWidth,
      height: el.scrollHeight
    });

    // إزالة وضع التصدير
    el.classList.remove('export-mode');

    const link = document.createElement('a');
    const filterLabels = { today: 'يومية', week: 'أسبوعية', all: 'شاملة' };
    const filterLabel = filterLabels[currentStatsFilter] || 'شاملة';
    const dateStr = new Date().toLocaleDateString('sv');
    link.download = `إحصائيات_اقرأ_${filterLabel}_${dateStr}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    showAlert('teacherAlert', 'تم تحميل الصورة بنجاح!', 'success');
  } catch (error) {
    // إزالة وضع التصدير حتى لو حصل خطأ
    el.classList.remove('export-mode');
    showAlert('teacherAlert', 'حدث خطأ أثناء تحميل الصورة', 'danger');
    console.error('Error downloading stats image:', error);
  }
}

// --- إضافة / خصم نقاط ---
async function handlePointsAction(action) {
  const studentId = document.getElementById('pointsStudentSelect').value;
  const pointsInput = document.getElementById('pointsAmount').value;
  const reason = document.getElementById('pointsReason') ? document.getElementById('pointsReason').value.trim() : '';

  if (!studentId || !pointsInput) {
    showAlert('teacherAlert', 'يرجى اختيار الطالب وتحديد عدد النقاط', 'danger');
    return;
  }

  let points = Math.abs(parseInt(pointsInput));
  if (isNaN(points) || points === 0) {
    showAlert('teacherAlert', 'يرجى إدخال عدد نقاط صحيح', 'danger');
    return;
  }

  if (action === 'deduct') {
    // تأكيد الخصم
    const selectedOption = document.getElementById('pointsStudentSelect').selectedOptions[0];
    const studentName = selectedOption ? selectedOption.textContent : 'الطالب';
    const reasonText = reason ? ` بسبب: ${reason}` : '';
    if (!confirm(`هل أنت متأكد من خصم ${points} نقطة من ${studentName}؟${reasonText}`)) {
      return;
    }
    points = -points; // تحويل لسالب
  }

  try {
    const response = await fetch(`${API_BASE}/teacher/add-points`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ studentId, points })
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

// --- جدولة جماعية ---
function toggleBulkSchedule() {
  const isBulk = document.getElementById('bulkScheduleToggle').checked;
  const bulkRange = document.getElementById('bulkDateRange');
  const targetDateGroup = document.getElementById('targetDate').parentElement;

  if (isBulk) {
    bulkRange.classList.add('visible');
    targetDateGroup.style.display = 'none';
    document.getElementById('targetDate').removeAttribute('required');
    document.getElementById('bulkStartDate').setAttribute('required', 'true');
    document.getElementById('bulkEndDate').setAttribute('required', 'true');
    document.getElementById('bulkStartDate').value = new Date().toLocaleDateString('sv');
  } else {
    bulkRange.classList.remove('visible');
    targetDateGroup.style.display = 'block';
    document.getElementById('targetDate').setAttribute('required', 'true');
    document.getElementById('bulkStartDate').removeAttribute('required');
    document.getElementById('bulkEndDate').removeAttribute('required');
  }
}

async function handleCreateAssignment(e) {
  e.preventDefault();
  const bookName = document.getElementById('bookName').value.trim();
  const startPage = document.getElementById('startPage').value;
  const endPage = document.getElementById('endPage').value;
  const isBulk = document.getElementById('bulkScheduleToggle')?.checked;

  try {
    if (isBulk) {
      const startDateStr = document.getElementById('bulkStartDate').value;
      const endDateStr = document.getElementById('bulkEndDate').value;

      if (!startDateStr || !endDateStr) {
        showAlert('teacherAlert', 'يرجى تحديد تاريخ البداية والنهاية', 'danger');
        return;
      }

      const start = new Date(startDateStr);
      const end = new Date(endDateStr);

      if (start > end) {
        showAlert('teacherAlert', 'تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية', 'danger');
        return;
      }

      // حساب عدد الأيام وتوليد التواريخ
      const dates = [];
      const current = new Date(start);
      while (current <= end) {
        dates.push(current.toLocaleDateString('sv'));
        current.setDate(current.getDate() + 1);
      }

      if (dates.length > 30) {
        showAlert('teacherAlert', 'الحد الأقصى للجدولة الجماعية 30 يوماً دفعة واحدة', 'danger');
        return;
      }

      // إرسال طلب لكل تاريخ
      let createdCount = 0;
      for (const targetDate of dates) {
        const response = await fetch(`${API_BASE}/teacher/assignments`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ bookName, startPage, endPage, targetDate })
        });
        if (response.ok) createdCount++;
      }

      showAlert('teacherAlert', `تمت جدولة ${createdCount} ورد بنجاح! 📅`, 'success');
    } else {
      const targetDate = document.getElementById('targetDate').value;
      const response = await fetch(`${API_BASE}/teacher/assignments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ bookName, startPage, endPage, targetDate })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      showAlert('teacherAlert', 'تم نشر الورد اليومي بنجاح!', 'success');
    }

    document.getElementById('assignmentForm').reset();
    document.getElementById('targetDate').value = new Date().toLocaleDateString('sv');
    if (document.getElementById('bulkScheduleToggle')) {
      document.getElementById('bulkScheduleToggle').checked = false;
      toggleBulkSchedule();
    }
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

// --- تحميل أسماء الكتب ---
async function loadBookNames() {
  try {
    const response = await fetch(`${API_BASE}/teacher/book-names`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (response.ok) {
      const options = '<option value="">-- اختر كتاباً --</option>' +
        data.bookNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');

      // تحديث قائمة تعديل الاسم
      const renameSelect = document.getElementById('oldBookName');
      if (renameSelect) renameSelect.innerHTML = options;

      // تحديث قائمة صورة الكتاب
      const imageSelect = document.getElementById('imageBookName');
      if (imageSelect) imageSelect.innerHTML = options;
    }
  } catch (error) {
    console.error('Error loading book names:', error);
  }
}

// --- معاينة صورة الكتاب من الملف ---
let currentBookImageBase64 = null;

// ضغط وتصغير الصورة قبل الإرسال
function compressImage(file, maxWidth = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // تصغير إذا كانت أكبر من maxWidth
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = () => reject(new Error('فشل في قراءة الصورة'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('فشل في قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

function previewBookImage(input) {
  const file = input.files[0];
  const preview = document.getElementById('bookImagePreview');
  const previewImg = document.getElementById('bookImagePreviewImg');
  const uploadText = document.getElementById('fileUploadText');
  const uploadArea = document.getElementById('fileUploadArea');

  if (!file) {
    preview.style.display = 'none';
    currentBookImageBase64 = null;
    uploadText.textContent = 'اضغط لاختيار صورة من الألبوم';
    uploadArea.classList.remove('file-upload-has-file');
    return;
  }

  // التحقق من الحجم (max 5MB للملف الأصلي - سيتم ضغطه)
  if (file.size > 5 * 1024 * 1024) {
    showAlert('teacherAlert', 'حجم الصورة كبير جداً. الحد الأقصى 5 ميجابايت.', 'danger');
    input.value = '';
    currentBookImageBase64 = null;
    return;
  }

  uploadText.textContent = 'جاري معالجة الصورة...';

  // ضغط الصورة قبل الحفظ
  compressImage(file, 800, 0.7)
    .then(compressedBase64 => {
      currentBookImageBase64 = compressedBase64;
      previewImg.src = compressedBase64;
      preview.style.display = 'block';
      uploadText.textContent = '✓ تم اختيار: ' + file.name;
      uploadArea.classList.add('file-upload-has-file');
    })
    .catch(err => {
      showAlert('teacherAlert', 'حدث خطأ أثناء معالجة الصورة', 'danger');
      input.value = '';
      currentBookImageBase64 = null;
      uploadText.textContent = 'اضغط لاختيار صورة من الألبوم';
    });
}

// --- تعيين صورة كتاب ---
async function handleSetBookImage() {
  const bookName = document.getElementById('imageBookName').value;

  if (!bookName) {
    showAlert('teacherAlert', 'يرجى اختيار الكتاب أولاً', 'danger');
    return;
  }

  if (!currentBookImageBase64) {
    showAlert('teacherAlert', 'يرجى اختيار صورة من الألبوم أولاً', 'danger');
    return;
  }

  // إظهار حالة التحميل
  const setBtn = document.querySelector('[onclick="handleSetBookImage()"]');
  const originalBtnText = setBtn ? setBtn.innerHTML : '';
  if (setBtn) {
    setBtn.innerHTML = '⏳ جاري رفع الصورة...';
    setBtn.disabled = true;
  }

  try {
    const response = await fetch(`${API_BASE}/teacher/set-book-image`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ bookName, imageUrl: currentBookImageBase64 })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('teacherAlert', data.message, 'success');
    // تنظيف الحقول
    document.getElementById('imageBookName').value = '';
    document.getElementById('bookImageFile').value = '';
    document.getElementById('bookImagePreview').style.display = 'none';
    document.getElementById('fileUploadText').textContent = 'اضغط لاختيار صورة من الألبوم';
    document.getElementById('fileUploadArea').classList.remove('file-upload-has-file');
    currentBookImageBase64 = null;
  } catch (error) {
    showAlert('teacherAlert', error.message || 'حدث خطأ أثناء رفع الصورة', 'danger');
  } finally {
    if (setBtn) {
      setBtn.innerHTML = originalBtnText;
      setBtn.disabled = false;
    }
  }
}

// --- تعديل اسم كتاب ---
async function handleRenameBook(e) {
  e.preventDefault();
  const oldName = document.getElementById('oldBookName').value;
  const newName = document.getElementById('newBookName').value.trim();

  if (!oldName || !newName) {
    showAlert('teacherAlert', 'يرجى اختيار الكتاب وإدخال الاسم الجديد', 'danger');
    return;
  }

  if (!confirm(`هل أنت متأكد من تغيير اسم الكتاب من "${oldName}" إلى "${newName}"؟`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/teacher/rename-book`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ oldName, newName })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('teacherAlert', data.message, 'success');
    document.getElementById('renameBookForm').reset();
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

// ==========================================
// --- صندوق الاقتراحات والملاحظات للمعلم ---
// ==========================================

let cachedFeedbacks = [];
let currentFeedbackFilter = 'all';

async function loadTeacherFeedbacks() {
  const container = document.getElementById('feedbackListContainer');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/feedback`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      container.innerHTML = '<div class="empty-state">لا توجد صلاحية لجلب الملاحظات أو حدث خطأ.</div>';
      return;
    }

    const data = await res.json();
    cachedFeedbacks = Array.isArray(data) ? data : [];

    // تحديث الشارات العداد
    const badgeEl = document.getElementById('feedbackBadgeCount');
    const totalBadgeEl = document.getElementById('feedbackTotalBadge');
    
    if (badgeEl) {
      if (cachedFeedbacks.length > 0) {
        badgeEl.textContent = cachedFeedbacks.length;
        badgeEl.style.display = 'inline-block';
      } else {
        badgeEl.style.display = 'none';
      }
    }

    if (totalBadgeEl) {
      totalBadgeEl.textContent = `${cachedFeedbacks.length} ملاحظة`;
    }

    filterFeedbackList();
  } catch (err) {
    console.error('Error loading feedbacks:', err);
    if (container) {
      container.innerHTML = '<div class="empty-state">حدث خطأ في تحميل الاقتراحات.</div>';
    }
  }
}

function setFeedbackFilter(filterType) {
  currentFeedbackFilter = filterType;

  // تحديث أزرار الفلاتر
  const filterBtns = document.querySelectorAll('#feedbackFilterButtons .stat-filter-btn');
  filterBtns.forEach(btn => btn.classList.remove('active'));

  if (filterType === 'all') document.getElementById('fbFilterAll')?.classList.add('active');
  else if (filterType === 'student') document.getElementById('fbFilterStudents')?.classList.add('active');
  else if (filterType === 'teacher') document.getElementById('fbFilterTeachers')?.classList.add('active');
  else if (filterType === 'idea') document.getElementById('fbFilterIdeas')?.classList.add('active');
  else if (filterType === 'bug') document.getElementById('fbFilterBugs')?.classList.add('active');

  filterFeedbackList();
}

function filterFeedbackList() {
  const container = document.getElementById('feedbackListContainer');
  if (!container) return;

  const query = (document.getElementById('feedbackSearchInput')?.value || '').trim().toLowerCase();

  let filtered = cachedFeedbacks.filter(item => {
    // تصفية حسب الدور أو النوع
    const role = (item.senderRole || '').toLowerCase();
    if (currentFeedbackFilter === 'student' && !role.includes('طالب') && role !== 'student') return false;
    if (currentFeedbackFilter === 'teacher' && !role.includes('معلم') && role !== 'teacher') return false;
    if (currentFeedbackFilter === 'idea' && !item.type?.includes('اقتراح') && !item.type?.includes('فكرة')) return false;
    if (currentFeedbackFilter === 'bug' && !item.type?.includes('مشكلة') && !item.type?.includes('خلل')) return false;


    // بحث نصي
    if (query) {
      const matchName = (item.senderName || '').toLowerCase().includes(query);
      const matchSubject = (item.subject || '').toLowerCase().includes(query);
      const matchMessage = (item.message || '').toLowerCase().includes(query);
      const matchType = (item.type || '').toLowerCase().includes(query);
      if (!matchName && !matchSubject && !matchMessage && !matchType) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 40px 20px;">
        <div class="empty-state-icon">💡</div>
        <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 6px;">لا توجد اقتراحات أو ملاحظات مطابقة</div>
        <div style="color: var(--text-muted); font-size: 0.9rem;">أي اقتراح يرسله الطلاب أو المعلمون سيظهر هنا تلقائياً.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="feedback-cards-grid">${filtered.map(item => renderFeedbackCard(item)).join('')}</div>`;
}

function renderFeedbackCard(item) {
  const isTeacher = item.senderRole === 'teacher' || item.senderRole === 'المعلم';
  const roleText = isTeacher ? '👨‍🏫 المعلم' : '👨‍🎓 الطالب';
  const roleBadgeClass = isTeacher ? 'badge-teacher' : 'badge-student';

  // تحديد صنف النوع
  let typeClass = 'type-general';
  let badgeClass = 'badge-general';
  const itemType = item.type || '💡 اقتراح';

  if (itemType.includes('مشكلة') || itemType.includes('خلل')) {
    typeClass = 'type-bug';
    badgeClass = 'badge-bug';
  } else if (itemType.includes('تحسين') || itemType.includes('تطوير')) {
    typeClass = 'type-improvement';
    badgeClass = 'badge-improvement';
  } else if (itemType.includes('اقتراح') || itemType.includes('فكرة')) {
    typeClass = 'type-idea';
    badgeClass = 'badge-idea';
  }

  // تنسيق التاريخ
  let dateFormatted = '';
  if (item.createdAt) {
    try {
      const d = new Date(item.createdAt);
      dateFormatted = d.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      dateFormatted = item.createdAt;
    }
  }

  const avatarChar = (item.senderName || 'م').trim().charAt(0);

  return `
    <div class="feedback-item-card ${typeClass}" id="fb-card-${item.id}">
      <div class="feedback-item-header">
        <div class="feedback-item-author">
          <div class="feedback-author-avatar">${escapeHtml(avatarChar)}</div>
          <div class="feedback-author-info">
            <span class="feedback-author-name">${escapeHtml(item.senderName || 'غير معروف')}</span>
            <span class="feedback-item-date">${dateFormatted}</span>
          </div>
        </div>

        <div class="feedback-item-badges">
          <span class="feedback-type-badge ${badgeClass}">${escapeHtml(itemType)}</span>
          <span class="feedback-role-badge">${roleText}</span>
        </div>
      </div>

      ${item.subject ? `<div class="feedback-item-subject">🏷️ ${escapeHtml(item.subject)}</div>` : ''}

      <div class="feedback-item-body">${escapeHtml(item.message)}</div>

      <div class="feedback-item-footer">
        <button type="button" class="btn-fb-action btn-fb-whatsapp" onclick="shareFeedbackCardWhatsApp('${item.id}')" title="إرسال عبر واتساب">
          <span>💬 واتساب</span>
        </button>
        <button type="button" class="btn-fb-action btn-fb-copy" onclick="copyFeedbackCardText('${item.id}')" title="نسخ الملاحظة">
          <span>📋 نسخ</span>
        </button>
        <button type="button" class="btn-fb-action btn-fb-delete" onclick="handleDeleteFeedback('${item.id}')" title="حذف الملاحظة">
          <span>🗑️ حذف</span>
        </button>
      </div>
    </div>
  `;
}

// حذف ملاحظة
async function handleDeleteFeedback(id) {
  if (!confirm('هل أنت متأكد من رغبتك في حذف هذه الملاحظة؟')) return;

  try {
    const res = await fetch(`${API_BASE}/feedback/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!res.ok) throw new Error('فشل حذف الملاحظة');

    // إزالة من الكاش
    cachedFeedbacks = cachedFeedbacks.filter(f => f.id !== id);

    // تحديث الشارة
    const badgeEl = document.getElementById('feedbackBadgeCount');
    const totalBadgeEl = document.getElementById('feedbackTotalBadge');
    if (badgeEl) {
      badgeEl.textContent = cachedFeedbacks.length;
      if (cachedFeedbacks.length === 0) badgeEl.style.display = 'none';
    }
    if (totalBadgeEl) totalBadgeEl.textContent = `${cachedFeedbacks.length} ملاحظة`;

    showAlert('teacherAlert', 'تم حذف الملاحظة بنجاح', 'success');
    filterFeedbackList();
  } catch (err) {
    showAlert('teacherAlert', err.message || 'حدث خطأ في حذف الملاحظة', 'danger');
  }
}

// نسخ نص الملاحظة
function copyFeedbackCardText(id) {
  const item = cachedFeedbacks.find(f => f.id === id);
  if (!item) return;

  const text = `📌 *اقتراح/ملاحظة من:* ${item.senderName} (${item.senderRole === 'teacher' ? 'معلم' : 'طالب'})\n🏷️ *النوع:* ${item.type || 'عام'}\n${item.subject ? `📝 *الموضوع:* ${item.subject}\n` : ''}💬 *الرسالة:*\n${item.message}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showAlert('teacherAlert', 'تم نسخ الملاحظة بنجاح! 📋', 'success');
    });
  } else {
    showAlert('teacherAlert', 'تم تحديد الملاحظة', 'success');
  }
}

// مشاركة ملاحظة في واتساب
function shareFeedbackCardWhatsApp(id) {
  const item = cachedFeedbacks.find(f => f.id === id);
  if (!item) return;

  const text = `*السلام عليكم ورحمة الله* 🌟\n\n📌 *ملاحظة/اقتراح من:* ${item.senderName} (${item.senderRole === 'teacher' ? 'المعلم' : 'الطالب'})\n🏷️ *النوع:* ${item.type || 'عام'}\n${item.subject ? `📝 *الموضوع:* ${item.subject}\n` : ''}🕒 *التاريخ:* ${item.createdAt || ''}\n━━━━━━━━━━━━━━━━━━━━\n💬 *الرسالة:*\n${item.message}`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// ==========================================
// --- نظام المراسلة والمحادثات المباشرة ---
// ==========================================

let cachedConversations = [];
let activeChatUserId = null;
let activeChatUser = null;
let activeChatMessages = [];

// جلب إجمالي الرسائل غير المقروءة لتحديث الشارات
async function loadUnreadMessagesCount() {
  try {
    const res = await fetch(`${API_BASE}/messages/unread-count`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return;
    const data = await res.json();
    const count = data.unreadCount || 0;

    const badgeEl = document.getElementById('unreadMessagesBadgeCount');
    const headerBadgeEl = document.getElementById('unreadMessagesHeaderBadge');

    if (badgeEl) {
      if (count > 0) {
        badgeEl.textContent = count;
        badgeEl.style.display = 'inline-block';
      } else {
        badgeEl.style.display = 'none';
      }
    }

    if (headerBadgeEl) {
      if (count > 0) {
        headerBadgeEl.textContent = `${count} رسالة جديدة`;
        headerBadgeEl.style.display = 'inline-block';
      } else {
        headerBadgeEl.style.display = 'none';
      }
    }
  } catch (e) {
    console.error('Error fetching unread count:', e);
  }
}

// جلب قائمة المحادثات
async function loadTeacherConversations() {
  const listContainer = document.getElementById('chatContactsList');
  if (!listContainer) return;

  try {
    const res = await fetch(`${API_BASE}/messages/conversations`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      listContainer.innerHTML = '<div class="empty-state">تعذر جلب المحادثات.</div>';
      return;
    }

    const data = await res.json();
    cachedConversations = data.conversations || [];
    filterChatContacts();
  } catch (err) {
    console.error('Error loading conversations:', err);
    if (listContainer) {
      listContainer.innerHTML = '<div class="empty-state">حدث خطأ في تحميل المحادثات.</div>';
    }
  }
}

// فلترة وعرض جهات الاتصال في القائمة الجانبية
function filterChatContacts() {
  const listContainer = document.getElementById('chatContactsList');
  if (!listContainer) return;

  const query = (document.getElementById('chatContactSearch')?.value || '').trim().toLowerCase();

  const filtered = cachedConversations.filter(c => {
    const name = (c.user.fullName || '').toLowerCase();
    const username = (c.user.username || '').toLowerCase();
    return name.includes(query) || username.includes(query);
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = '<div class="empty-state" style="padding: 20px;">لا يوجد طلاب مطابقين للبحث.</div>';
    return;
  }

  listContainer.innerHTML = filtered.map(c => {
    const isActive = activeChatUserId && activeChatUserId.toString() === c.user.id.toString();
    const avatarChar = (c.user.fullName || 'ط').trim().charAt(0);
    const roleClass = c.user.role === 'teacher' ? 'teacher' : '';

    let timeFormatted = '';
    if (c.lastMessage && c.lastMessage.createdAt) {
      try {
        const d = new Date(c.lastMessage.createdAt);
        timeFormatted = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {}
    }

    const snippet = c.lastMessage ? escapeHtml(c.lastMessage.content) : 'انقر لبدء المحادثة...';

    return `
      <div class="chat-contact-item ${isActive ? 'active' : ''}" onclick="openConversation('${c.user.id}', '${escapeHtml(c.user.fullName)}', '${c.user.role}', '${c.user.points || 0}')">
        <div class="chat-contact-avatar ${roleClass}">${escapeHtml(avatarChar)}</div>
        <div class="chat-contact-info">
          <div class="chat-contact-top">
            <span class="chat-contact-name">${escapeHtml(c.user.fullName)}</span>
            <span class="chat-contact-time">${timeFormatted}</span>
          </div>
          <div class="chat-contact-bottom">
            <span class="chat-contact-snippet">${snippet}</span>
            ${c.unreadCount > 0 ? `<span class="chat-contact-badge">${c.unreadCount}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// فتح محادثة طالب مباشرة من قائمة الطلاب
function openStudentChatDirect(studentId, studentName) {
  switchTab('messages');
  openConversation(studentId, studentName || 'طالب', 'student', 0);
}

// فتح محادثة
async function openConversation(userId, userName, userRole, points) {
  activeChatUserId = userId.toString();
  activeChatUser = { id: userId, fullName: userName, role: userRole, points };

  // تحديث حالة العرض في الموبايل
  const container = document.getElementById('teacherChatContainer');
  if (container) container.classList.add('chat-view-active');

  // تحديث هيدر المحادثة
  const emptyEl = document.getElementById('chatMainEmpty');
  const activeEl = document.getElementById('chatMainActive');
  if (emptyEl) emptyEl.style.display = 'none';
  if (activeEl) activeEl.style.display = 'flex';

  const nameEl = document.getElementById('activeChatName');
  const roleEl = document.getElementById('activeChatRole');
  const avatarEl = document.getElementById('activeChatAvatar');
  const extraEl = document.getElementById('activeChatExtra');

  if (nameEl) nameEl.textContent = userName;
  if (roleEl) roleEl.textContent = userRole === 'teacher' ? '👨‍🏫 معلم' : `👨‍🎓 طالب (⭐ ${points || 0} نقطة)`;
  if (avatarEl) {
    avatarEl.textContent = (userName || 'م').trim().charAt(0);
    avatarEl.className = `chat-contact-avatar ${userRole === 'teacher' ? 'teacher' : ''}`;
  }
  if (extraEl) {
    extraEl.innerHTML = `
      <div style="display: flex; gap: 8px; align-items: center;">
        <button type="button" class="btn-chat-clear" onclick="handleClearActiveChat()" title="مسح المحادثة بالكامل">🗑️ مسح المحادثة</button>
        <button type="button" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.78rem;" onclick="loadActiveChatMessages('${userId}')">🔄 تحديث</button>
      </div>
    `;
  }

  // تمييز العنصر النشط بالقائمة
  filterChatContacts();

  // جلب الرسائل وتحديدها كمقروءة
  await loadActiveChatMessages(userId);
  markConversationAsRead(userId);
}

// إغلاق المحادثة النشطة في الهاتف للرجوع للقائمة
function closeActiveChatMobile() {
  const container = document.getElementById('teacherChatContainer');
  if (container) container.classList.remove('chat-view-active');
}

// جلب سجل المحادثة
async function loadActiveChatMessages(userId, isBackgroundRefresh = false) {
  if (!userId || activeChatUserId !== userId.toString()) return;

  const body = document.getElementById('chatMessagesBody');
  if (!body) return;

  if (!isBackgroundRefresh && activeChatMessages.length === 0) {
    body.innerHTML = '<div class="empty-state">جاري تحميل الرسائل...</div>';
  }

  try {
    const res = await fetch(`${API_BASE}/messages/chat/${userId}`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) throw new Error('فشل جلب الرسائل');

    const data = await res.json();
    activeChatMessages = data.messages || [];
    renderMessages(activeChatMessages);
  } catch (err) {
    console.error('Error fetching chat messages:', err);
    if (!isBackgroundRefresh && body) {
      body.innerHTML = '<div class="empty-state">تعذر تحميل الرسائل.</div>';
    }
  }
}

// عرض فقاعات الرسائل
function renderMessages(messages) {
  const body = document.getElementById('chatMessagesBody');
  if (!body) return;

  const currentUser = getUser();
  const currentUserId = currentUser ? currentUser.id.toString() : '';

  if (messages.length === 0) {
    body.innerHTML = `
      <div class="empty-state" style="padding: 40px 20px;">
        <div style="font-size: 2.5rem; margin-bottom: 8px;">✨</div>
        <div style="font-weight: 700; color: var(--text-main); margin-bottom: 4px;">لا توجد رسائل سابقة</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">ابدأ المحادثة الآن وأرسل التوجيهات أو الملاحظات للطالب.</div>
      </div>
    `;
    return;
  }

  body.innerHTML = messages.map(msg => {
    const isOutgoing = msg.senderId.toString() === currentUserId;
    const rowClass = isOutgoing ? 'outgoing' : 'incoming';

    let timeFormatted = '';
    if (msg.createdAt) {
      try {
        const d = new Date(msg.createdAt);
        timeFormatted = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {}
    }

    const readStatusHtml = isOutgoing 
      ? `<span class="chat-read-status" title="${msg.isRead ? 'تمت القراءة' : 'تم الإرسال'}">${msg.isRead ? '✓✓' : '✓'}</span>` 
      : '';

    return `
      <div class="chat-msg-row ${rowClass}" id="msg-row-${msg.id}">
        <div class="chat-msg-bubble">${escapeHtml(msg.content)}</div>
        <div class="chat-msg-meta">
          <span>${timeFormatted}</span>
          ${readStatusHtml}
          <button type="button" class="btn-msg-delete" onclick="handleDeleteMessage('${msg.id}')" title="حذف الرسالة">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  // النزول لأسفل المحادثة تلقائياً
  body.scrollTop = body.scrollHeight;
}

// حذف رسالة فردية
async function handleDeleteMessage(messageId) {
  if (!confirm('هل أنت متأكد من رغبتك في حذف هذه الرسالة؟')) return;

  try {
    const res = await fetch(`${API_BASE}/messages/${messageId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف الرسالة');

    // إزالة الرسالة من القائمة المعروضة
    activeChatMessages = activeChatMessages.filter(m => m.id.toString() !== messageId.toString());
    renderMessages(activeChatMessages);
    loadTeacherConversations();
  } catch (err) {
    showAlert('teacherAlert', err.message || 'حدث خطأ في حذف الرسالة', 'danger');
  }
}

// مسح المحادثة بالكامل
async function handleClearActiveChat() {
  if (!activeChatUserId) return;
  if (!confirm('هل أنت متأكد من رغبتك في مسح جميع رسائل هذه المحادثة؟ لا يمكن التراجع عن هذا الإجراء.')) return;

  try {
    const res = await fetch(`${API_BASE}/messages/clear/${activeChatUserId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل مسح المحادثة');

    activeChatMessages = [];
    renderMessages(activeChatMessages);
    loadTeacherConversations();
    showAlert('teacherAlert', 'تم مسح سجل المحادثة بنجاح', 'success');
  } catch (err) {
    showAlert('teacherAlert', err.message || 'حدث خطأ في مسح المحادثة', 'danger');
  }
}

// تحديد محادثة كمقروءة
async function markConversationAsRead(userId) {
  try {
    await fetch(`${API_BASE}/messages/mark-read/${userId}`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });

    // تحديث في الكاش المحلي
    const convo = cachedConversations.find(c => c.user.id.toString() === userId.toString());
    if (convo) {
      convo.unreadCount = 0;
    }
    filterChatContacts();
    loadUnreadMessagesCount();
  } catch (e) {}
}

// إدخال رد جاهز وسريع
function insertQuickReply(text) {
  const input = document.getElementById('chatMessageInput');
  if (!input) return;
  input.value = text;
  input.focus();
}

// زر Enter للإرسال
function handleChatInputKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSendTeacherMessage(event);
  }
}

// إرسال رسالة المعلم
async function handleSendTeacherMessage(event) {
  if (event) event.preventDefault();

  if (!activeChatUserId) return;

  const input = document.getElementById('chatMessageInput');
  if (!input) return;

  const content = input.value.trim();
  if (!content) return;

  const sendBtn = document.getElementById('btnSendChat');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/messages/send`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        receiverId: activeChatUserId,
        content: content
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إرسال الرسالة');

    input.value = '';
    input.style.height = 'auto';

    // إضافة الرسالة للمحادثة فوراً
    if (data.data) {
      activeChatMessages.push(data.data);
      renderMessages(activeChatMessages);
    }

    // تحديث جهات الاتصال لإظهار آخر رسالة
    loadTeacherConversations();
  } catch (err) {
    showAlert('teacherAlert', err.message || 'حدث خطأ أثناء إرسال الرسالة', 'danger');
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }
}


