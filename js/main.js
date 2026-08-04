document.addEventListener('DOMContentLoaded', function () {
  // 배경 영상 — 뷰포트에 맞춰 모바일/데스크톱 소스를 고른다
  // (히어로, 연사소개 등 data-src-desktop을 가진 모든 video에 적용)
  document.querySelectorAll('video[data-src-desktop]').forEach(function(v) {
    var mobile  = v.getAttribute('data-src-mobile');
    var desktop = v.getAttribute('data-src-desktop');
    var src = (window.matchMedia('(max-width: 720px)').matches && mobile) ? mobile : desktop;
    v.src = src;
    v.load();
    var playPromise = v.play();
    if (playPromise && playPromise.catch) playPromise.catch(function() { /* autoplay blocked — ignore */ });
  });

  // Sponsor list — insert middle dots between items on the same line
  var sponsorList = document.querySelector('.forum-hero-orgs .sponsor-list');
  if (sponsorList) {
    var updateDots = function() {
      var items = sponsorList.querySelectorAll(':scope > span');
      for (var i = 0; i < items.length; i++) {
        var curr = items[i];
        var next = items[i + 1];
        if (next && curr.offsetTop === next.offsetTop) {
          curr.classList.add('has-dot');
        } else {
          curr.classList.remove('has-dot');
        }
      }
    };
    updateDots();
    window.addEventListener('resize', updateDots);
    // Re-run after fonts load to catch width shifts
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(updateDots);
    }
  }

  // Sticky header — collapse to single row on scroll
  var header = document.querySelector('.forum-header');

  var onScroll = function() {
    if (!header) return;
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Speaker profile modal
  var modal = document.getElementById('speaker-modal');
  if (modal) {
    var modalImg    = document.getElementById('speaker-modal-img');
    var modalBadge  = document.getElementById('speaker-modal-badge');
    var modalName   = document.getElementById('speaker-modal-title');
    var modalRole   = document.getElementById('speaker-modal-role');
    var modalBio    = document.getElementById('speaker-modal-bio');
    var modalIntro  = document.getElementById('speaker-modal-intro');

    var openModal = function(card) {
      var name  = card.getAttribute('data-name') || '';
      var role  = card.getAttribute('data-role') || '';
      var badge = card.getAttribute('data-badge') || '';
      var image = card.getAttribute('data-image') || '';
      var intro = card.getAttribute('data-intro') || '';
      var bio;
      try { bio = JSON.parse(card.getAttribute('data-bio') || '[]'); }
      catch (e) { bio = []; }

      modalImg.src = image;
      modalImg.alt = name;
      modalBadge.textContent = badge;
      modalName.textContent = name;
      modalRole.innerHTML = role;
      modalBio.innerHTML = bio.map(function(item) {
        var li = document.createElement('li');
        li.innerHTML = item;
        return li.outerHTML;
      }).join('');
      modalIntro.innerHTML = intro;
      modalIntro.style.display = intro ? '' : 'none';

      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('forum-modal-open');
    };

    var closeModal = function() {
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('forum-modal-open');
    };

    /* 엠블럼 카드(div)는 제외 — 프로필 데이터가 없다 */
    document.querySelectorAll('button.forum-speaker-card').forEach(function(card) {
      card.addEventListener('click', function() { openModal(card); });
    });

    modal.querySelectorAll('[data-close]').forEach(function(el) {
      el.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
        closeModal();
      }
    });
  }

  // Registration form — Google Apps Script 연동 (iframe POST 방식)
  var GAS_URL = 'TODO_APPS_SCRIPT_EXEC_URL'; // apps-script/Code.gs 배포 후 발급되는 /exec URL

  // 전화번호 자동 포매팅 — 휴대폰·서울(02)·타 지역·대표번호(15XX) 지원
  function formatPhone(raw) {
    var trailingHyphen = /-$/.test(raw || '');
    var d = (raw || '').replace(/\D/g, '');
    var out;
    // 대표번호 15XX/16XX/18XX/19XX (총 8자리)
    if (d.length >= 1 && d[0] === '1' && d[1] !== '0') {
      d = d.slice(0, 8);
      out = d.length <= 4 ? d : d.slice(0, 4) + '-' + d.slice(4);
    }
    // 서울(02): 최대 10자리
    else if (d.indexOf('02') === 0) {
      d = d.slice(0, 10);
      if (d.length <= 2) out = d;
      else if (d.length <= 5) out = d.slice(0, 2) + '-' + d.slice(2);
      else if (d.length <= 9) out = d.slice(0, 2) + '-' + d.slice(2, d.length - 4) + '-' + d.slice(-4);
      else out = d.slice(0, 2) + '-' + d.slice(2, 6) + '-' + d.slice(6);
    }
    // 기타(010, 031, 070 등): 최대 11자리
    else {
      d = d.slice(0, 11);
      if (d.length < 4) out = d;
      else if (d.length < 8) out = d.slice(0, 3) + '-' + d.slice(3);
      else if (d.length <= 10) out = d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
      else out = d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
    }
    // 사용자가 방금 '-'를 입력한 경우 뒤에 유지 (다음 자릿수 입력을 위한 힌트)
    if (trailingHyphen && out && !/-$/.test(out)) out += '-';
    return out;
  }
  function attachPhoneFormatter(input) {
    if (!input) return;
    input.setAttribute('inputmode', 'tel');
    input.addEventListener('input', function() {
      var selBefore = this.selectionStart;
      var prev = this.value;
      var digitsBefore = prev.slice(0, selBefore).replace(/\D/g, '').length;
      var justTypedHyphen = selBefore > 0 && prev[selBefore - 1] === '-';

      var formatted = formatPhone(prev);
      this.value = formatted;

      var totalDigits = formatted.replace(/\D/g, '').length;
      var newPos;
      if (justTypedHyphen && digitsBefore === totalDigits && /-$/.test(formatted)) {
        newPos = formatted.length;
      } else {
        var count = 0;
        newPos = formatted.length;
        for (var i = 0; i < formatted.length; i++) {
          if (/\d/.test(formatted[i])) count++;
          if (count === digitsBefore) { newPos = i + 1; break; }
        }
        if (justTypedHyphen && formatted[newPos] === '-') newPos++;
      }
      this.selectionStart = this.selectionEnd = newPos;
    });
    input.addEventListener('blur', function() {
      this.value = this.value.replace(/-+$/, '');
    });
  }
  attachPhoneFormatter(document.getElementById('f-tel'));
  attachPhoneFormatter(document.getElementById('lk-tel'));

  // ===== 탭 전환 =====
  var tabs = document.querySelectorAll('.forum-registration-tab');
  var panels = document.querySelectorAll('.forum-registration-panel');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var name = tab.getAttribute('data-tab');
      tabs.forEach(function(t) {
        var on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panels.forEach(function(p) {
        p.hidden = p.getAttribute('data-panel') !== name;
      });
      // 확인 탭 재진입 시 입력 폼 복원 + 이전 결과 숨김
      if (name === 'lookup') {
        var lf = document.getElementById('lookupForm');
        var lr = document.getElementById('lookupResult');
        if (lf) { lf.hidden = false; lf.reset(); }
        if (lr) lr.hidden = true;
      }
    });
  });

  // ===== 참가신청 확인 (JSONP 조회) =====
  var lookupForm = document.getElementById('lookupForm');
  if (lookupForm) {
    lookupForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var name = document.getElementById('lk-name').value.trim();
      var tel = document.getElementById('lk-tel').value.replace(/\D/g, '');
      if (!name) { alert('성명을 입력해주세요.'); return; }
      if (tel.length < 8 || tel.length > 11) { alert('전화번호를 올바르게 입력해주세요.'); return; }

      var submitBtn = lookupForm.querySelector('.btn-submit');
      var originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span>조회 중...';

      var cbName = 'forumLookupCb_' + Date.now();
      var script = document.createElement('script');
      var timer = setTimeout(function() {
        cleanup();
        alert('조회에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }, 15000);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }

      window[cbName] = function(data) {
        cleanup();
        renderLookupResult(data);
      };

      var url = GAS_URL
        + '?action=lookup'
        + '&name=' + encodeURIComponent(name)
        + '&tel=' + encodeURIComponent(tel)
        + '&callback=' + cbName;
      script.src = url;
      script.onerror = function() { cleanup(); alert('조회 서버에 연결하지 못했습니다.'); };
      document.body.appendChild(script);
    });
  }

  function maskEmail(email) {
    if (!email) return '';
    var at = email.indexOf('@');
    if (at < 0) return email;
    var local = email.slice(0, at);
    var domain = email.slice(at);
    var keep = Math.min(3, Math.max(1, local.length - 1));
    return local.slice(0, keep) + '***' + domain;
  }

  function renderLookupResult(data) {
    var result = document.getElementById('lookupResult');
    if (!data || !data.ok || !data.record) {
      alert('등록 정보를 찾을 수 없습니다. 성명과 전화번호를 확인해주세요.');
      result.hidden = true;
      return;
    }
    var r = data.record;
    result.querySelector('[data-field="name"]').textContent  = r.name  || '';
    result.querySelector('[data-field="org"]').textContent   = r.org   || '';
    result.querySelector('[data-field="rank"]').textContent  = r.rank  || '';
    result.querySelector('[data-field="tel"]').textContent   = formatPhone(r.tel || '');
    result.querySelector('[data-field="email"]').textContent = maskEmail(r.email || '');
    result.querySelector('[data-field="question"]').textContent = r.question && r.question.trim() ? r.question : '질문내용이 없습니다.';
    result.hidden = false;
    // 조회 성공 시 입력 폼은 감춤
    if (lookupForm) lookupForm.hidden = true;
  }

  var regForm = document.getElementById('registrationForm');
  if (regForm) {
    regForm.addEventListener('reset', function() {
      // reset 이벤트는 기본 reset 이후 폼 초기화가 끝난 다음 프레임에 스크롤
      requestAnimationFrame(function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    regForm.addEventListener('submit', function(e) {
      e.preventDefault();

      var agree = document.getElementById('f-agree');
      if (!agree.checked) {
        alert('개인정보보호를 위한 이용자 동의사항에 동의해주세요.');
        agree.focus();
        return;
      }

      var checks = [
        { id: 'f-name',  msg: '성명을 입력해주세요.' },
        { id: 'f-org',   msg: '소속을 입력해주세요.' },
        { id: 'f-rank',  msg: '직급을 입력해주세요.' },
        { id: 'f-tel',   msg: '전화번호를 올바르게 입력해주세요.' },
        { id: 'f-email', msg: '이메일을 올바르게 입력해주세요.' }
      ];
      for (var i = 0; i < checks.length; i++) {
        var el = document.getElementById(checks[i].id);
        if (!el.value || !el.validity.valid) {
          alert(checks[i].msg);
          el.focus();
          return;
        }
      }

      var submitBtn = regForm.querySelector('.btn-submit');
      var originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span>제출 중...';

      var telRaw = document.getElementById('f-tel').value;
      var telDigits = telRaw.replace(/\D/g, '');
      if (telDigits.length < 8 || telDigits.length > 11) {
        alert('전화번호를 올바르게 입력해주세요.');
        document.getElementById('f-tel').focus();
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        return;
      }
      // 앞자리 0 보존 및 가독성을 위해 포맷(하이픈 포함) 형태로 저장
      var telFormatted = formatPhone(telDigits).replace(/-+$/, '');

      var data = {
        formType: '포럼사전등록',
        name:     document.getElementById('f-name').value,
        org:      document.getElementById('f-org').value,
        rank:     document.getElementById('f-rank').value,
        tel:      telFormatted,
        email:    document.getElementById('f-email').value,
        question: document.getElementById('f-question').value,
        device:   /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') ? '모바일' : 'PC'
      };

      var iframe = document.createElement('iframe');
      iframe.name = 'gas-iframe-registration';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      var hiddenForm = document.createElement('form');
      hiddenForm.method = 'POST';
      hiddenForm.action = GAS_URL;
      hiddenForm.target = iframe.name;

      Object.keys(data).forEach(function(key) {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = data[key];
        hiddenForm.appendChild(input);
      });

      document.body.appendChild(hiddenForm);
      hiddenForm.submit();

      iframe.addEventListener('load', function() {
        alert('사전등록이 완료되었습니다.');
        regForm.reset();
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        document.body.removeChild(iframe);
        document.body.removeChild(hiddenForm);
      });
    });
  }
});
