/**
 * contact-dev.js
 * نظام التواصل مع المبرمج لتقديم الاقتراحات، التحسينات، والملاحظات
 */

(function () {
  // إعدادات افتراضية قابلة للتعديل
  const DEV_CONFIG = {
    whatsappNumber: '', // رقم واتساب المبرمج (مثال: '9647700000000' أو فارغ ليفتح واتساب مباشرة مع الرسالة المنسقة)
    title: 'تواصل مع المبرمج 💡',
    developerLabel: 'فريق التطوير والبرمجة'
  };

  // إنشاء هيكل المودال وحقنه في الصفحة
  function createDevModal() {
    if (document.getElementById('devContactModal')) return;

    const modalHtml = `
      <div id="devContactModal" class="dev-modal-overlay" onclick="handleDevOverlayClick(event)">
        <div class="dev-modal-card" role="dialog" aria-modal="true" aria-labelledby="devModalTitle">
          
          <!-- Header -->
          <div class="dev-modal-header">
            <div class="dev-modal-title-box">
              <div class="dev-modal-header-icon">💡</div>
              <div>
                <h3 id="devModalTitle">تواصل مع المبرمج</h3>
                <p>نسعد باقتراحاتك وأفكارك وملاحظاتك لتطوير المنصة</p>
              </div>
            </div>
            <button type="button" class="dev-modal-close-btn" onclick="closeDevContactModal()" title="إغلاق">✕</button>
          </div>

          <!-- Body -->
          <div class="dev-modal-body">
            
            <!-- معلومات المرسل -->
            <div class="dev-sender-pill">
              <span>👤 المرسل: <strong class="dev-sender-name" id="devModalSenderName">المستخدم</strong></span>
              <span class="dev-sender-role" id="devModalSenderRole">معلم / طالب</span>
            </div>

            <!-- نوع الرسالة -->
            <div class="dev-form-group">
              <label>نوع الملاحظة أو الطلب:</label>
              <div class="dev-type-grid">
                <label class="dev-type-chip active" onclick="selectDevType(this)">
                  <input type="radio" name="devFeedbackType" value="💡 اقتراح أو فكرة جديدة" checked>
                  <span>💡 اقتراح أو ميزة جديدة</span>
                </label>
                <label class="dev-type-chip" onclick="selectDevType(this)">
                  <input type="radio" name="devFeedbackType" value="⚡ تحسين وتطوير">
                  <span>⚡ تحسين وتطوير</span>
                </label>
                <label class="dev-type-chip" onclick="selectDevType(this)">
                  <input type="radio" name="devFeedbackType" value="🐛 إبلاغ عن مشكلة أو خلل">
                  <span>🐛 إبلاغ عن مشكلة فنية</span>
                </label>
                <label class="dev-type-chip" onclick="selectDevType(this)">
                  <input type="radio" name="devFeedbackType" value="💬 استفسار أو ملاحظة عامة">
                  <span>💬 ملاحظة أو استفسار</span>
                </label>
              </div>
            </div>

            <!-- عنوان الملاحظة -->
            <div class="dev-form-group">
              <label for="devSubjectInput">عنوان الموضوع / ملخص الفكرة (اختياري):</label>
              <input type="text" id="devSubjectInput" class="dev-form-control" placeholder="مثال: إضافة خاصية تصدير التقرير PDF...">
            </div>

            <!-- نص الرسالة -->
            <div class="dev-form-group">
              <label for="devMessageInput">تفاصيل الاقتراح أو الملاحظة: <span style="color: var(--danger);">*</span></label>
              <textarea id="devMessageInput" class="dev-form-control" placeholder="اكتب فكرتك أو مقترحك أو تفاصيل الملاحظة هنا بكل وضوح..." rows="4"></textarea>
            </div>

            <!-- Toast Alert -->
            <div id="devFeedbackToast" class="dev-feedback-toast"></div>

            <!-- أزرار الإجراءات -->
            <div class="dev-modal-actions">
              <button type="button" onclick="sendDevViaWhatsApp()" class="btn-whatsapp-send">
                <span>💬 إرسال عبر واتساب (WhatsApp)</span>
              </button>
              
              <div class="dev-buttons-row">
                <button type="button" onclick="copyDevFeedbackMessage()" class="btn-copy-msg">
                  <span>📋 نسخ نص الرسالة</span>
                </button>
                <button type="button" onclick="submitDevFeedbackToServer()" class="btn-save-system">
                  <span>🚀 إرسال وحفظ بالمنصة</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  // إنشاء زر الـ FAB العائم تلقائياً إذا لم يكن موجوداً
  function createDevFAB() {
    if (document.getElementById('devContactFAB')) return;

    const fab = document.createElement('button');
    fab.id = 'devContactFAB';
    fab.className = 'fab-contact-dev';
    fab.title = 'تواصل مع المبرمج للاقتراحات والتحسينات والملاحظات';
    fab.onclick = window.openDevContactModal;
    fab.innerHTML = `
      <span class="fab-icon">💡</span>
      <span class="fab-label">تواصل مع المبرمج</span>
    `;
    document.body.appendChild(fab);
  }

  // إضافة زر في شريط التنقل (Header)
  function injectNavDevButton() {
    const navInfo = document.querySelector('.user-nav-info');
    if (navInfo && !document.getElementById('devNavBtn')) {
      const btn = document.createElement('button');
      btn.id = 'devNavBtn';
      btn.className = 'btn-dev-contact';
      btn.title = 'تواصل مع المبرمج للاقتراحات والملاحظات';
      btn.onclick = window.openDevContactModal;
      btn.innerHTML = `<span>💡</span> <span>تواصل مع المبرمج</span>`;
      
      // نضعه قبل زر تسجيل الخروج
      const logoutBtn = navInfo.querySelector('button[onclick*="logout"]');
      if (logoutBtn) {
        navInfo.insertBefore(btn, logoutBtn);
      } else {
        navInfo.appendChild(btn);
      }
    }
  }

  // تحديد نوع الملاحظة
  window.selectDevType = function (el) {
    document.querySelectorAll('.dev-type-chip').forEach(chip => chip.classList.remove('active'));
    el.classList.add('active');
    const radio = el.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  };

  // فتح المودال
  window.openDevContactModal = function () {
    createDevModal();

    // جلب معلومات المستخدم
    const user = typeof getUser === 'function' ? getUser() : null;
    const senderNameEl = document.getElementById('devModalSenderName');
    const senderRoleEl = document.getElementById('devModalSenderRole');

    if (senderNameEl && senderRoleEl) {
      if (user) {
        senderNameEl.textContent = user.fullName || user.username || 'مستخدم مسجل';
        senderRoleEl.textContent = user.role === 'teacher' ? '👨‍🏫 المعلم' : '👨‍🎓 الطالب';
      } else {
        // فحص من الصفحة
        const studentName = document.getElementById('studentName');
        const teacherName = document.getElementById('teacherName');
        if (teacherName) {
          senderNameEl.textContent = teacherName.textContent.trim();
          senderRoleEl.textContent = '👨‍🏫 المعلم';
        } else if (studentName) {
          senderNameEl.textContent = studentName.textContent.trim();
          senderRoleEl.textContent = '👨‍🎓 الطالب';
        } else {
          senderNameEl.textContent = 'مستخدم المنصة';
          senderRoleEl.textContent = 'زائر / مستخدم';
        }
      }
    }

    const modal = document.getElementById('devContactModal');
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden'; // منع التمرير الخلفي
      setTimeout(() => {
        const msgInput = document.getElementById('devMessageInput');
        if (msgInput) msgInput.focus();
      }, 150);
    }
  };

  // إغلاق المودال
  window.closeDevContactModal = function () {
    const modal = document.getElementById('devContactModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      hideDevToast();
    }
  };

  // إغلاق عند النقر خارج البطاقة
  window.handleDevOverlayClick = function (e) {
    if (e.target && e.target.id === 'devContactModal') {
      closeDevContactModal();
    }
  };

  // تجهيز نص الرسالة المنسق
  function generateFormattedMessage() {
    const user = typeof getUser === 'function' ? getUser() : null;
    let senderName = 'مستخدم المنصة';
    let senderRole = 'مستخدم';

    if (user) {
      senderName = user.fullName || user.username || 'مستخدم';
      senderRole = user.role === 'teacher' ? 'المعلم' : 'الطالب';
    } else {
      const studentName = document.getElementById('studentName');
      const teacherName = document.getElementById('teacherName');
      if (teacherName) {
        senderName = teacherName.textContent.trim();
        senderRole = 'المعلم';
      } else if (studentName) {
        senderName = studentName.textContent.trim();
        senderRole = 'الطالب';
      }
    }

    const selectedTypeEl = document.querySelector('input[name="devFeedbackType"]:checked');
    const type = selectedTypeEl ? selectedTypeEl.value : '💡 اقتراح أو تحسين';
    const subject = (document.getElementById('devSubjectInput')?.value || '').trim();
    const message = (document.getElementById('devMessageInput')?.value || '').trim();

    if (!message) {
      showDevToast('الرجاء كتابة تفاصيل الاقتراح أو الملاحظة أولاً ⚠️', 'error');
      return null;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let formatted = `*السلام عليكم ورحمة الله وبركاته* 🌟\n\n`;
    formatted += `*رسالة موجهة للمبرمج من منصة (اقرأ | تتبع القراءة)* 📚\n`;
    formatted += `━━━━━━━━━━━━━━━━━━━━\n`;
    formatted += `👤 *المرسل:* ${senderName} (${senderRole})\n`;
    formatted += `📌 *النوع:* ${type}\n`;
    if (subject) {
      formatted += `🏷️ *الموضوع:* ${subject}\n`;
    }
    formatted += `🕒 *التاريخ:* ${dateStr}\n`;
    formatted += `━━━━━━━━━━━━━━━━━━━━\n`;
    formatted += `📝 *نص الملاحظة / الاقتراح:*\n${message}\n\n`;
    formatted += `_شكراً لكم وبارك الله في جهودكم_ ✨`;

    return {
      formatted,
      raw: { senderName, senderRole, type, subject, message }
    };
  }

  // إظهار تنبيه داخلي
  function showDevToast(msg, type = 'success') {
    const toast = document.getElementById('devFeedbackToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `dev-feedback-toast ${type}`;
    toast.style.display = 'block';
  }

  function hideDevToast() {
    const toast = document.getElementById('devFeedbackToast');
    if (toast) toast.style.display = 'none';
  }

  // الإرسال عبر واتساب
  window.sendDevViaWhatsApp = function () {
    const data = generateFormattedMessage();
    if (!data) return;

    const encodedText = encodeURIComponent(data.formatted);
    let url = '';
    if (DEV_CONFIG.whatsappNumber && DEV_CONFIG.whatsappNumber.trim()) {
      const cleanPhone = DEV_CONFIG.whatsappNumber.replace(/[^0-9]/g, '');
      url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${encodedText}`;
    }

    showDevToast('جاري فتح واتساب لإرسال الملاحظة مباشرة... 🚀', 'success');
    setTimeout(() => {
      window.open(url, '_blank');
    }, 400);
  };

  // نسخ الرسالة
  window.copyDevFeedbackMessage = function () {
    const data = generateFormattedMessage();
    if (!data) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(data.formatted)
        .then(() => {
          showDevToast('تم نسخ نص الرسالة المنسق بنجاح! يمكنك الآن لصقها في أي مكان 📋✨', 'success');
        })
        .catch(() => {
          fallbackCopyText(data.formatted);
        });
    } else {
      fallbackCopyText(data.formatted);
    }
  };

  function fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showDevToast('تم نسخ نص الرسالة المنسق بنجاح! 📋✨', 'success');
    } catch (err) {
      showDevToast('تعذر النسخ التلقائي، يمكنك تحديد النص ونسخه يدوياً.', 'error');
    }
    document.body.removeChild(textArea);
  }

  // إرسال وحفظ في النظام عبر API
  window.submitDevFeedbackToServer = async function () {
    const data = generateFormattedMessage();
    if (!data) return;

    showDevToast('جاري حفظ الملاحظة في النظام... ⏳', 'success');

    try {
      const token = typeof getToken === 'function' ? getToken() : null;
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(data.raw)
      });

      const resData = await res.json();
      if (res.ok) {
        showDevToast('تم إرسال وحفظ اقتراحك بنجاح! شكراً لمساهمتك في تطوير المنصة 🌟', 'success');
        // مسح الحقول بعد ثوانٍ قليلة
        setTimeout(() => {
          if (document.getElementById('devSubjectInput')) document.getElementById('devSubjectInput').value = '';
          if (document.getElementById('devMessageInput')) document.getElementById('devMessageInput').value = '';
        }, 1500);
      } else {
        showDevToast(resData.error || 'تمت العملية، يمكنك أيضاً إرسالها عبر واتساب لسرعة الرد.', 'success');
      }
    } catch (err) {
      // حتى لو لم تكن قاعدة البيانات متصلة، نوجه المستخدم للواتساب أو النسخ
      showDevToast('شكراً لك! نرجو أيضاً إرسالها عبر زر الواتساب ليصل للمبرمج مباشرة 💬', 'success');
    }
  };

  // التهيئة عند تحميل الصفحة
  document.addEventListener('DOMContentLoaded', () => {
    createDevModal();
    createDevFAB();
    injectNavDevButton();
  });

  // إذا كانت الصفحة محملة بالفعل
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    createDevModal();
    createDevFAB();
    injectNavDevButton();
  }
})();
