/**
 * 2026 투자포럼 — 사전등록 수집 Apps Script
 *
 * [배포 절차]
 *   1. 구글 시트 새로 생성 (이름: "2026 투자포럼 사전등록" 권장)
 *   2. 시트 상단 메뉴 → 확장 프로그램 → Apps Script
 *   3. 기본 Code.gs 내용을 지우고 이 파일 내용 전체를 붙여넣기
 *   4. 디스크 아이콘(저장) 클릭
 *   5. 상단 "배포" → "새 배포"
 *        - 유형: 웹 앱
 *        - 설명: v1 (원하는 버전명)
 *        - 다음 사용자 인증 정보로 실행: "나"
 *        - 액세스 권한이 있는 사용자: "모든 사용자"
 *   6. "배포" 클릭 → 최초 1회 Google 계정 권한 승인
 *   7. 발급되는 "웹 앱 URL" (끝이 /exec) 을 복사해 forum 프로젝트의
 *      js/main.js 상단 GAS_URL 변수에 붙여넣기
 *
 *   ※ 이후 코드 수정 시, "배포 관리" → 연필(편집) → 버전 "새 버전" → 배포
 *     반드시 재배포해야 변경 사항이 /exec 엔드포인트에 반영됨.
 *     기존 /exec URL 은 그대로 유지되므로 프론트엔드 수정 불필요.
 *
 * [알림 이메일(선택)]
 *   NOTIFY_EMAILS 에 담당자 이메일을 넣으면 등록 건마다 메일이 발송됨.
 *   빈 배열이면 메일 미발송.
 */

/* ========== 설정 ========== */
var SHEET_NAME    = '사전등록';
var NOTIFY_EMAILS = ['forum@fntimes.com'];  // 빈 배열이면 메일 미발송
var NOTIFY_SUBJECT_PREFIX = '[2026 투자포럼] 사전등록';

var HEADERS = [
  '제출일시', '성명', '소속', '직급', '전화번호', '이메일', '사전질문', '기기'
];

/* ========== 엔드포인트 ========== */

function doPost(e) {
  try {
    var p = (e && e.parameter) || {};

    if (p.formType !== '포럼사전등록') {
      return _json({ ok: false, error: 'invalid formType' });
    }

    // 최소 필수값 검증 (클라이언트 검증을 통과하지 못한 요청 차단)
    var required = ['name', 'org', 'rank', 'tel', 'email'];
    for (var i = 0; i < required.length; i++) {
      if (!p[required[i]] || String(p[required[i]]).trim() === '') {
        return _json({ ok: false, error: 'missing: ' + required[i] });
      }
    }

    var sheet = _getSheet();
    sheet.appendRow([
      new Date(),
      p.name     || '',
      p.org      || '',
      p.rank     || '',
      p.tel      || '',
      p.email    || '',
      p.question || '',
      p.device   || ''
    ]);

    _sendNotification(p);

    return _json({ ok: true });
  } catch (err) {
    console.error(err);
    return _json({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};

  // ?action=lookup&name=홍길동&tel=01012345678&callback=cb → JSONP 응답
  if (p.action === 'lookup') {
    try {
      var record = _findRecord(p.name || '', p.tel || '');
      var res = record
        ? { ok: true, record: record }
        : { ok: false, error: 'not found' };
      return _respond(res, p.callback);
    } catch (err) {
      console.error(err);
      return _respond({ ok: false, error: String(err) }, p.callback);
    }
  }

  return _respond({
    ok: true,
    service: '2026 투자포럼 사전등록',
    method: 'POST'
  }, p.callback);
}

function _findRecord(name, tel) {
  var nameKey = String(name).replace(/\s+/g, '');
  var telKey  = String(tel).replace(/\D/g, '');
  if (!nameKey || !telKey) return null;

  var sheet = _getSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  // 컬럼: 제출일시, 성명, 소속, 직급, 전화번호, 이메일, 사전질문, 기기
  var values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  for (var i = values.length - 1; i >= 0; i--) {  // 최신 등록부터 역순 검색
    var row = values[i];
    var rowName = String(row[1] || '').replace(/\s+/g, '');
    var rowTel  = String(row[4] || '').replace(/\D/g, '');
    if (rowName === nameKey && rowTel === telKey) {
      return {
        name:     row[1] || '',
        org:      row[2] || '',
        rank:     row[3] || '',
        tel:      row[4] || '',
        email:    row[5] || '',
        question: row[6] || ''
      };
    }
  }
  return null;
}

/* ========== 수동 실행 도구 ========== */

/**
 * 헤더 행을 만들거나 복구한다.
 * Apps Script 편집기에서 함수 목록에 'setupSheet'를 선택하고 실행하면 된다.
 * - 헤더가 없으면 맨 위에 새 행을 끼워 넣는다 (기존 데이터는 그대로 밀린다)
 * - 이미 헤더가 있으면 서식만 다시 적용한다
 */
function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  var hasHeader = false;
  if (sh.getLastRow() >= 1) {
    var first = sh.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    hasHeader = String(first[0]).trim() === HEADERS[0];
  }
  if (!hasHeader) {
    sh.insertRowBefore(1);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  sh.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#004aad')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 34);

  var widths = [160, 100, 180, 100, 140, 220, 320, 70];
  for (var i = 0; i < widths.length; i++) sh.setColumnWidth(i + 1, widths[i]);

  SpreadsheetApp.getUi().alert(
    hasHeader ? '헤더 서식을 다시 적용했습니다.' : '헤더 행을 추가했습니다.'
  );
}

/* ========== 내부 함수 ========== */

function _getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
  }
  // 헤더 없으면 삽입
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#004aad')
      .setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 160); // 제출일시
    sh.setColumnWidth(7, 320); // 사전질문
  }
  return sh;
}

function _sendNotification(p) {
  if (!NOTIFY_EMAILS || NOTIFY_EMAILS.length === 0) return;
  try {
    var body = [
      '새 사전등록이 접수되었습니다.',
      '',
      '성명: ' + (p.name || ''),
      '소속: ' + (p.org || ''),
      '직급: ' + (p.rank || ''),
      '전화번호: ' + (p.tel || ''),
      '이메일: ' + (p.email || ''),
      '',
      '사전질문:',
      (p.question || '(없음)'),
      '',
      '— 2026 투자포럼 자동 알림'
    ].join('\n');

    MailApp.sendEmail({
      to: NOTIFY_EMAILS.join(','),
      subject: NOTIFY_SUBJECT_PREFIX + ' — ' + (p.name || '이름미상') + '/' + (p.org || ''),
      body: body
    });
  } catch (err) {
    console.error('notify failed:', err);
  }
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** callback 파라미터가 있으면 JSONP, 없으면 순수 JSON 으로 응답 */
function _respond(obj, callback) {
  var json = JSON.stringify(obj);
  if (callback && /^[A-Za-z_][A-Za-z0-9_]*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
