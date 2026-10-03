import type { StackInfo } from './ir';

/** Minimal virtual filesystem so detection works on a local folder, a git checkout or an upload. */
export interface VFS {
  list(): Promise<string[]>;
  read(path: string): Promise<string | null>;
}

const IGNORE = /(^|\/)(node_modules|\.git|dist|build|\.next|\.nuxt|\.svelte-kit|vendor|target|\.morpheus-out)(\/|$)/;

const EXT_LANG: Record<string, string> = {
  html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', sass: 'Sass', less: 'Less',
  js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX',
  vue: 'Vue SFC', svelte: 'Svelte', astro: 'Astro', php: 'PHP', rb: 'Ruby', py: 'Python', go: 'Go',
  java: 'Java', cs: 'C#', ex: 'Elixir', dart: 'Dart', rs: 'Rust', kt: 'Kotlin', swift: 'Swift',
  erb: 'ERB', twig: 'Twig', liquid: 'Liquid', hbs: 'Handlebars', ejs: 'EJS', pug: 'Pug', njk: 'Nunjucks',
  jinja: 'Jinja', md: 'Markdown', mdx: 'MDX',
};

const NPM_FRAMEWORKS: [string, string][] = [
  ['next', 'Next.js'], ['react', 'React'], ['vue', 'Vue'], ['nuxt', 'Nuxt'], ['svelte', 'Svelte'],
  ['@sveltejs/kit', 'SvelteKit'], ['astro', 'Astro'], ['@angular/core', 'Angular'], ['gatsby', 'Gatsby'],
  ['@remix-run/react', 'Remix'], ['solid-js', 'SolidJS'], ['preact', 'Preact'], ['@builder.io/qwik', 'Qwik'],
  ['vite', 'Vite'], ['webpack', 'Webpack'], ['parcel', 'Parcel'], ['@11ty/eleventy', 'Eleventy'],
  ['express', 'Express'], ['@nestjs/core', 'NestJS'], ['hono', 'Hono'], ['ember-source', 'Ember'],
];

const NPM_STYLING: [string, string][] = [
  ['tailwindcss', 'Tailwind CSS'], ['bootstrap', 'Bootstrap'], ['sass', 'Sass'], ['styled-components', 'styled-components'],
  ['@emotion/react', 'Emotion'], ['@mui/material', 'Material UI'], ['@chakra-ui/react', 'Chakra UI'],
  ['@mantine/core', 'Mantine'], ['antd', 'Ant Design'], ['bulma', 'Bulma'], ['@radix-ui/react-slot', 'Radix UI'],
  ['@shadcn/ui', 'shadcn/ui'], ['daisyui', 'daisyUI'], ['@vanilla-extract/css', 'vanilla-extract'], ['unocss', 'UnoCSS'],
  ['framer-motion', 'Framer Motion'], ['lucide-react', 'Lucide icons'], ['postcss', 'PostCSS'],
];

export async function detectStack(vfs: VFS): Promise<StackInfo> {
  const all = (await vfs.list()).filter((p) => !IGNORE.test(p));
  const langCount = new Map<string, number>();
  for (const p of all) {
    const ext = p.split('.').pop()?.toLowerCase() ?? '';
    const lang = EXT_LANG[ext];
    if (lang) langCount.set(lang, (langCount.get(lang) ?? 0) + 1);
  }
  const has = (re: RegExp) => all.some((p) => re.test(p));
  const frameworks = new Set<string>();
  const styling = new Set<string>();
  const notes: string[] = [];
  let packageManager: string | undefined;

  if (has(/(^|\/)pnpm-lock\.yaml$/)) packageManager = 'pnpm';
  else if (has(/(^|\/)yarn\.lock$/)) packageManager = 'yarn';
  else if (has(/(^|\/)bun\.lockb?$/)) packageManager = 'bun';
  else if (has(/(^|\/)package-lock\.json$/) || has(/(^|\/)package\.json$/)) packageManager = 'npm';
  else if (has(/(^|\/)composer\.json$/)) packageManager = 'composer';
  else if (has(/(^|\/)Gemfile$/)) packageManager = 'bundler';
  else if (has(/(^|\/)(requirements\.txt|pyproject\.toml|Pipfile)$/)) packageManager = 'pip';

  // JavaScript ecosystem
  const pkgPaths = all.filter((p) => /(^|\/)package\.json$/.test(p)).slice(0, 5);
  for (const pp of pkgPaths) {
    const raw = await vfs.read(pp);
    if (!raw) continue;
    try {
      const pkg = JSON.parse(raw);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [dep, label] of NPM_FRAMEWORKS) if (deps[dep]) frameworks.add(label);
      for (const [dep, label] of NPM_STYLING) if (deps[dep]) styling.add(label);
    } catch {
      notes.push(`Could not parse ${pp}.`);
    }
  }
  if (has(/(^|\/)tailwind\.config\.(js|cjs|mjs|ts)$/)) styling.add('Tailwind CSS');
  if (has(/(^|\/)components\.json$/)) styling.add('shadcn/ui');

  // PHP
  for (const cp of all.filter((p) => /(^|\/)composer\.json$/.test(p)).slice(0, 2)) {
    const raw = (await vfs.read(cp)) ?? '';
    if (/laravel\/framework/.test(raw)) frameworks.add('Laravel');
    if (/symfony\//.test(raw)) frameworks.add('Symfony');
    if (/johnpbloch\/wordpress|roots\/bedrock/.test(raw)) frameworks.add('WordPress');
  }
  if (has(/\.blade\.php$/)) frameworks.add('Laravel (Blade)');
  if (has(/(^|\/)wp-content\//) || has(/(^|\/)functions\.php$/)) {
    const style = all.find((p) => /(^|\/)style\.css$/.test(p));
    const head = style ? ((await vfs.read(style)) ?? '').slice(0, 600) : '';
    if (/Theme Name:/i.test(head) || has(/(^|\/)wp-content\//)) frameworks.add('WordPress theme');
  }

  // Ruby
  const gemfile = all.find((p) => /(^|\/)Gemfile$/.test(p));
  if (gemfile) {
    const raw = (await vfs.read(gemfile)) ?? '';
    if (/gem ['"]rails['"]/.test(raw)) frameworks.add('Rails');
    if (/gem ['"]jekyll['"]/.test(raw)) frameworks.add('Jekyll');
    if (/gem ['"]sinatra['"]/.test(raw)) frameworks.add('Sinatra');
  }
  if (has(/(^|\/)_config\.yml$/) && has(/(^|\/)_layouts\//)) frameworks.add('Jekyll');

  // Python
  const pyDeps = all.find((p) => /(^|\/)(requirements\.txt|pyproject\.toml)$/.test(p));
  if (pyDeps) {
    const raw = ((await vfs.read(pyDeps)) ?? '').toLowerCase();
    if (/django/.test(raw)) frameworks.add('Django');
    if (/flask/.test(raw)) frameworks.add('Flask');
    if (/fastapi/.test(raw)) frameworks.add('FastAPI');
    if (/streamlit/.test(raw)) frameworks.add('Streamlit');
  }

  // Others
  if (has(/(^|\/)hugo\.(toml|yaml|json)$/) || (has(/(^|\/)config\.toml$/) && has(/(^|\/)layouts\//))) frameworks.add('Hugo');
  if (has(/(^|\/)pubspec\.yaml$/)) frameworks.add('Flutter');
  if (has(/(^|\/)go\.mod$/)) frameworks.add('Go');
  if (has(/(^|\/)mix\.exs$/)) frameworks.add('Phoenix/Elixir');
  if (has(/\.csproj$/)) frameworks.add('.NET');
  if (has(/\.(njk|liquid)$/) && has(/(^|\/)\.eleventy\.js$/)) frameworks.add('Eleventy');

  // CSS-level styling detection
  const cssPaths = all.filter((p) => /\.(css|scss|sass|less)$/.test(p)).slice(0, 12);
  for (const cp of cssPaths) {
    const raw = ((await vfs.read(cp)) ?? '').slice(0, 4000);
    if (/@tailwind|@apply|@import ['"]tailwindcss/.test(raw)) styling.add('Tailwind CSS');
    if (/bootstrap/i.test(raw.slice(0, 400))) styling.add('Bootstrap');
  }
  const htmlPaths = all.filter((p) => /\.html?$/.test(p)).slice(0, 8);
  for (const hp of htmlPaths) {
    const raw = ((await vfs.read(hp)) ?? '').slice(0, 20000);
    if (/cdn\.tailwindcss\.com|tailwindcss/.test(raw)) styling.add('Tailwind CSS');
    if (/bootstrap(\.min)?\.(css|js)|bootstrap@/.test(raw)) styling.add('Bootstrap');
    if (/bulma/.test(raw)) styling.add('Bulma');
  }

  const languages = [...langCount.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
  const jsFramework = ['Next.js', 'Nuxt', 'SvelteKit', 'Astro', 'Gatsby', 'Remix', 'Angular', 'React', 'Vue', 'Svelte', 'SolidJS', 'Qwik'].find((f) => frameworks.has(f));
  const pureStatic = !jsFramework && frameworks.size === 0 && (langCount.get('HTML') ?? 0) > 0;
  const renderer = jsFramework ?? ([...frameworks][0] || (pureStatic ? 'static-html' : 'unknown'));

  let adapter: StackInfo['adapter'] = 'none';
  let adapterSupport: StackInfo['adapterSupport'] = 'none';
  if (pureStatic || (!jsFramework && (langCount.get('HTML') ?? 0) > 0 && !has(/\.(php|erb|twig|blade\.php|liquid|hbs|ejs|pug|njk)$/))) {
    adapter = 'html';
    adapterSupport = 'full';
  } else if (languages.length) {
    adapterSupport = 'planned';
    notes.push(`No adapter for ${renderer} yet. The Site IR design is language-neutral; an adapter for ${renderer} can read and write it.`);
  }

  return {
    languages,
    frameworks: [...frameworks],
    styling: [...styling],
    packageManager,
    renderer,
    adapter,
    adapterSupport,
    notes,
  };
}
