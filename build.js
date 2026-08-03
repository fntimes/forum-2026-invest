const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
// BASE_PATH rewrites absolute asset/link paths at build time. Set to '/forum'
// when publishing to https://<org>.github.io/forum/; leave empty for root
// (custom domain) deployment. Trailing slashes are normalized.
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/$/, '');

// 0. Site-wide variables (src/site.json). Page front-matter overrides these,
//    so 행사명·도메인·OG 이미지 같은 공통 값은 여기 한 곳에서만 고친다.
const sitePath = path.join(SRC, 'site.json');
let site = {};
function loadSite() {
  site = fs.existsSync(sitePath)
    ? JSON.parse(fs.readFileSync(sitePath, 'utf-8'))
    : {};
}

// 1. Read all partials
const partialsDir = path.join(SRC, 'partials');
const partials = {};

// 2. Parse front-matter from page files
function parsePage(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parts = raw.split('---');
  const meta = {};
  parts[1].trim().split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    meta[key] = val;
  });
  const body = parts.slice(2).join('---').trim();
  return { meta, body };
}

// 3. Inject GNB active states into header
function injectGnbActive(headerHtml, gnbActive, megaActiveHref) {
  if (gnbActive) {
    headerHtml = headerHtml.replace(
      `<a href="#">${gnbActive}</a>`,
      `<a href="#" class="gnb-active">${gnbActive}</a>`
    );
  }
  if (megaActiveHref) {
    headerHtml = headerHtml.replace(
      `<a href="${megaActiveHref}">`,
      `<a href="${megaActiveHref}" class="mega-active">`
    );
  }
  return headerHtml;
}

// 4. Assemble page
function buildPage(pagePath) {
  const { meta, body } = parsePage(pagePath);
  const vars = Object.assign({}, site, meta);

  // canonical/og:url — front-matter가 없으면 siteUrl + outputPath 로 자동 생성.
  // 'a/index.html' -> '/a/', 'index.html' -> '/'
  if (!vars.canonical && site.siteUrl) {
    const slug = meta.outputPath.replace(/index\.html$/, '');
    vars.canonical = site.siteUrl.replace(/\/$/, '') + '/' + slug;
  }

  let html;
  if (meta.raw === 'true') {
    html = body;
  } else {
    let header = injectGnbActive(partials['header'], meta.gnbActive, meta.megaActiveHref);

    html = partials['head']
      + '\n' + header
      + '\n' + partials['mobile-nav']
      + (meta.noHero === 'true' ? '' : '\n' + partials['hero'])
      + '\n' + body
      + '\n' + partials['footer']
      + '\n' + partials['scripts'];
  }

  // Replace every {{key}} present in site.json or the page front-matter,
  // then blank out any token that stayed unresolved.
  Object.keys(vars).forEach(key => {
    html = html.split(`{{${key}}}`).join(vars[key] == null ? '' : String(vars[key]));
  });
  html = html.replace(/\{\{[\w.-]+\}\}/g, '');

  // Rewrite absolute paths to include BASE_PATH (for /forum/ subpath hosting)
  if (BASE_PATH) {
    html = html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE_PATH}/`);
    html = html.replace(/url\(\/(?!\/)/g, `url(${BASE_PATH}/`);
  }

  // Write output
  const outPath = path.join(DIST, meta.outputPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);
  console.log(`Built: ${meta.outputPath}`);
}

// 5. Copy static assets
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src, { withFileTypes: true }).forEach(entry => {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  });
}

// Full build
function build() {
  // Re-read site vars and partials (may have changed)
  loadSite();
  fs.readdirSync(partialsDir).forEach(file => {
    const name = path.basename(file, '.html');
    partials[name] = fs.readFileSync(path.join(partialsDir, file), 'utf-8');
  });

  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
  }
  fs.mkdirSync(DIST, { recursive: true });

  const pagesDir = path.join(SRC, 'pages');
  fs.readdirSync(pagesDir).forEach(file => {
    if (file.endsWith('.html')) {
      buildPage(path.join(pagesDir, file));
    }
  });

  ['css', 'js', 'images'].forEach(dir => {
    const src = path.join(ROOT, dir);
    if (fs.existsSync(src)) {
      copyDir(src, path.join(DIST, dir));
    }
  });

  // CNAME is skipped when BASE_PATH is set (serving at <user>.github.io/<repo>/
  // rather than at a custom apex/subdomain).
  const rootFiles = ['favicon.ico', 'robots.txt'];
  if (!BASE_PATH) rootFiles.push('CNAME');
  rootFiles.forEach(file => {
    const src = path.join(ROOT, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DIST, file));
    }
  });

  console.log('Build complete.');
}

// Initial build
build();

// Watch mode
if (process.argv.includes('--watch')) {
  let timer = null;

  function rebuild() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log('\nFile changed, rebuilding...');
      try { build(); } catch (e) { console.error('Build error:', e.message); }
    }, 200);
  }

  function watchDirRecursive(dir) {
    fs.watch(dir, (event, filename) => {
      if (filename && (filename.endsWith('.swp') || filename.startsWith('.'))) return;
      rebuild();
    });
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      if (entry.isDirectory()) {
        watchDirRecursive(path.join(dir, entry.name));
      }
    });
  }

  [SRC, path.join(ROOT, 'css'), path.join(ROOT, 'js')].forEach(watchDirRecursive);

  console.log('Watching for changes... (Ctrl+C to stop)');
}
