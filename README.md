# 2026 투자포럼 소개페이지

`fntimes/forum`(2026 한국금융미래포럼)과 동일한 구조의 정적 사이트.
front-matter를 가진 HTML 조각을 `build.js`가 조립해 `dist/`에 출력하고,
GitHub Actions가 GitHub Pages로 배포한다.

## 개발

```bash
npm run dev     # 감시 모드 — src/, css/, js/ 변경 시 자동 재빌드
npm run build   # 1회 빌드 → dist/
```

로컬 확인은 `dist/`를 정적 서버로 띄운다.

```bash
python3 -m http.server 3333 --directory dist
```

## 구조

```
build.js              조립 스크립트
src/site.json         행사명·도메인·OG 등 사이트 공통 변수
src/partials/         head · header · mobile-nav · footer · scripts
src/pages/*.html      페이지. front-matter의 outputPath가 출력 경로
css/style.css         스타일
js/main.js            헤더 스크롤, 히어로 영상, 연사 모달, 사전등록
images/               이미지·영상
apps-script/Code.gs   사전등록 수집 백엔드 (Google Apps Script)
```

### 페이지 추가

`src/pages/`에 파일을 하나 만들면 끝이다. 빌드 스크립트는 건드리지 않는다.

```html
---
title: 초대의 글
outputPath: invitation/index.html
noHero: true
---
<main id="main-content"> ... </main>
```

front-matter 키

| 키 | 설명 |
|---|---|
| `title` | `<title>`의 앞부분. 뒤에 `- {{siteName}}`이 붙는다 |
| `outputPath` | `dist/` 기준 출력 경로 |
| `noHero` | `true`면 hero 파샬을 붙이지 않는다 |
| `raw` | `true`면 파샬 조립 없이 본문을 그대로 출력 |
| `canonical` | og:url. 생략하면 `siteUrl` + `outputPath`로 자동 생성 |
| `extraScripts` | 페이지 전용 `<script>` |
| `gnbActive` | 해당 텍스트의 GNB 항목에 활성 클래스 부여 |

### 템플릿 변수

`src/site.json`의 모든 키와 페이지 front-matter의 모든 키를 `{{키}}`로 쓸 수 있다.
같은 이름이면 front-matter가 이긴다. 값이 없는 `{{...}}`는 빈 문자열로 지워진다.

행사명·일자·도메인처럼 여러 페이지에 반복되는 값은 `src/site.json`에서만 고친다.

## 배포

`main`에 push하면 `.github/workflows/deploy.yml`이 빌드 후 GitHub Pages에 올린다.

**최초 1회 설정**

1. 저장소 Settings → Pages → Source를 **GitHub Actions**로 변경
2. 서브도메인을 정한 뒤 저장소 루트에 `CNAME` 파일 생성 (내용은 도메인 한 줄)
3. DNS에 `CNAME` 레코드 추가: `<서브도메인> → fntimes.github.io`
4. Settings → Pages → Custom domain에 같은 도메인 입력, HTTPS 적용 대기

`CNAME` 파일이 없으면 `https://fntimes.github.io/<저장소명>/`으로만 뜬다.
그 경로로 테스트하려면 `BASE_PATH`를 주고 빌드한다 — 절대경로가 전부 재작성되고
`CNAME` 복사도 생략된다.

```bash
BASE_PATH=/forum-2026-invest npm run build
```

## 사전등록 백엔드

`apps-script/Code.gs`를 구글 시트의 Apps Script에 붙여넣고 웹 앱으로 배포한 뒤,
발급되는 `/exec` URL을 `js/main.js`의 `GAS_URL`에 넣는다.
자세한 절차는 `Code.gs` 상단 주석에 있다.

## 남은 TODO

- [ ] 서브도메인 확정 → `CNAME`, `src/site.json`의 `siteUrl`·`ogImage`
- [ ] 정식 행사명·슬로건·일시·장소 → `src/site.json`
- [ ] 시안 반영 → `css/style.css`의 `:root` 브랜드 토큰, 섹션별 스타일
- [ ] GNB 메뉴 구성 확정 → `src/partials/header.html`
- [ ] 이미지 에셋 (`header_logo.png`, `footer_logo.png`, `logo_fntimes.png`,
      `logo_wealth.png`, `og_image.jpg`) → `images/`
- [ ] Apps Script 재배포 후 `GAS_URL` 교체
