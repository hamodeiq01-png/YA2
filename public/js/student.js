// Student Dashboard Logic

// Protect Route
window.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  if (!isLoggedIn() || !user || user.role !== 'student') {
    logout();
    return;
  }

  // Set name
  document.getElementById('studentName').textContent = `الطالب: ${user.fullName}`;

  // Load dashboard data
  loadStudentDashboard();
});

function loadStudentDashboard() {
  loadStudentPoints();
  loadTodayAssignments();
  loadHistory();
}

// --- تحميل نقاط الطالب ---
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

      // تحديث النقاط مع تأثير بصري
      pointsEl.textContent = data.points || 0;

      // تحديث الترتيب
      if (data.rank && data.totalStudents) {
        let rankEmoji = '';
        if (data.rank === 1) rankEmoji = '🥇';
        else if (data.rank === 2) rankEmoji = '🥈';
        else if (data.rank === 3) rankEmoji = '🥉';
        else rankEmoji = `#${data.rank}`;

        rankBadgeEl.textContent = rankEmoji;
        rankTextEl.textContent = `ترتيبك ${data.rank} من ${data.totalStudents} طالب`;
      }

      // رسائل تحفيزية حسب النقاط
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

// --- تجميع الأوراد حسب اسم الكتاب ---
function groupAssignmentsByBook(assignments) {
  const groups = {};
  assignments.forEach(item => {
    const bookName = item.assignment.bookName;
    if (!groups[bookName]) {
      groups[bookName] = [];
    }
    groups[bookName].push(item);
  });
  return groups;
}

// --- أيقونات الكتب المتنوعة ---
function getBookIcon(index) {
  const icons = ['📗', '📘', '📕', '📙', '📓', '📔'];
  return icons[index % icons.length];
}

async function loadTodayAssignments() {
  const container = document.getElementById('assignmentsContainer');

  try {
    const response = await fetch(`${API_BASE}/student/assignments/today`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();

    if (response.ok) {
      if (!data.assignments || data.assignments.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🌸</div>
            <p style="font-weight: 700; font-size: 1.1rem; color: var(--primary);">لا يوجد ورد قراءة مجدول لك اليوم.</p>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 5px;">استرح اليوم، أو اقرأ قراءة حرة مفيدة!</p>
          </div>`;
        return;
      }

      // تجميع حسب الكتاب
      const bookGroups = groupAssignmentsByBook(data.assignments);
      const bookNames = Object.keys(bookGroups);

      let html = '<div class="books-grid">';
      let globalIndex = 0;

      bookNames.forEach((bookName, bookIndex) => {
        const bookAssignments = bookGroups[bookName];
        const icon = getBookIcon(bookIndex);
        const assignmentCount = bookAssignments.length;
        const countText = assignmentCount === 1 ? 'ورد واحد' : `${assignmentCount} أوراد`;

        html += `
          <div class="book-card">
            <div class="book-card-header">
              <div class="book-card-icon">${icon}</div>
              <div class="book-card-title">
                <h3>${escapeHtml(bookName)}</h3>
                <div class="book-assignments-count">${countText} مطلوبة</div>
              </div>
            </div>
            <div class="book-card-body">`;

        bookAssignments.forEach((item, itemIndex) => {
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

          html += `<div class="book-assignment-item ${typeClass}">`;

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

          // معلومات الورد (الصفحات والتاريخ)
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
                <h4>
                  ✓ تم إرسال إنجاز هذا الورد بنجاح!
                </h4>
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

          html += '</div>'; // end book-assignment-item

          // فاصل بين الأوراد (ما عدا الأخير)
          if (itemIndex < bookAssignments.length - 1) {
            html += '<div class="book-assignment-divider"></div>';
          }
        });

        html += `
            </div>
          </div>`;
      });

      html += '</div>';
      container.innerHTML = html;
    }
  } catch (error) {
    console.error('Error loading today\'s assignments:', error);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        حدث خطأ أثناء تحميل أوراد اليوم. يرجى إعادة تحميل الصفحة.
      </div>`;
  }
}

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
    loadStudentDashboard();
  } catch (error) {
    showAlert('studentAlert', error.message, 'danger');
  }
}

// --- تجميع السجل حسب الكتاب ---
function groupHistoryByBook(historyItems) {
  const groups = {};
  historyItems.forEach(item => {
    const bookName = item.bookName;
    if (!groups[bookName]) {
      groups[bookName] = [];
    }
    groups[bookName].push(item);
  });
  return groups;
}

async function loadHistory() {
  const historyContainer = document.getElementById('historyContainer');
  try {
    const response = await fetch(`${API_BASE}/student/assignments/history`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();

    if (response.ok) {
      if (data.history.length === 0) {
        historyContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📚</div>
            لا توجد أوراد سابقة مسجلة.
          </div>`;
        return;
      }

      // تجميع حسب الكتاب
      const bookGroups = groupHistoryByBook(data.history);
      const bookNames = Object.keys(bookGroups);

      let html = '';

      bookNames.forEach((bookName, bookIndex) => {
        const bookItems = bookGroups[bookName];
        const icon = getBookIcon(bookIndex);

        html += `
          <div class="history-book-group">
            <div class="history-book-header">
              <span class="book-icon">${icon}</span>
              <span class="book-name">${escapeHtml(bookName)}</span>
              <span class="book-count">${bookItems.length} ورد</span>
            </div>
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

        bookItems.forEach(item => {
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

          // النقاط
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
            </div>
          </div>`;
      });

      historyContainer.innerHTML = html;
    }
  } catch (error) {
    console.error('Error loading student history:', error);
  }
}

// Simple HTML escaping helper for security
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
