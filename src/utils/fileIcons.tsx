import React from 'react';
import {
  JavaScript,
  TypeScript,
  React as React_,
  CSS3,
  Sass,
  HTML5,
  JSON as JSON_,
  Markdown,
  RustDark,
  Python,
  NodeJs,
  ViteJS,
  Bash,
  PowerShell,
  Git,
  Docker,
  ESLint,
  Prettier,
  TailwindCSS,
  Prisma,
  GraphQL,
  CPlusPlus,
  CSharp,
  Ruby,
  PHP,
  Go,
  Java,
  Kotlin,
  Swift,
  Lua,
  Solidity,
  PostgreSQL,
  NPM,
  BunJs,
  SvelteJS,
  VueJs,
} from 'developer-icons';

const ICON_SIZE = 18;

// ── Custom icons (not in developer-icons) ─────────────────────────

export const FolderClosedIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="folderClosedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFA000" />
        <stop offset="100%" stopColor="#FF6F00" />
      </linearGradient>
      <filter id="folderShadow" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="1.2" stdDeviation="1" floodOpacity="0.25"/>
      </filter>
    </defs>
    <path fill="url(#folderClosedGrad)" filter="url(#folderShadow)" d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
  </svg>
);

export const FolderOpenIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="folderOpenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFB300" />
        <stop offset="100%" stopColor="#FF8F00" />
      </linearGradient>
      <linearGradient id="folderBackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E65100" />
        <stop offset="100%" stopColor="#FF6D00" />
      </linearGradient>
    </defs>
    <path fill="url(#folderBackGrad)" d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12h20V8c0-1.1-.9-2-2-2z" />
    <path fill="url(#folderOpenGrad)" d="M2 10v9c0 .55.45 1 1 1h18c.55 0 1-.45 1-1v-9H2z" />
  </svg>
);

const VercelIgnoreIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <rect width="22" height="22" x="1" y="1" rx="5" fill="#000000" stroke="#333" strokeWidth="1" />
    <polygon points="12 5 18 16 6 16" fill="#FFFFFF" />
  </svg>
);

const TsConfigIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="tsConfigGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3178c6" />
        <stop offset="100%" stopColor="#235A97" />
      </linearGradient>
    </defs>
    <rect width="22" height="22" x="1" y="1" rx="5" fill="#2D3139" stroke="url(#tsConfigGrad)" strokeWidth="1.2" />
    <text x="8" y="14" fill="url(#tsConfigGrad)" fontSize="8.5" fontWeight="900" fontFamily="Inter, sans-serif">TS</text>
    <path d="M14 11 A 2 2 0 1 0 18 15" stroke="#FFFFFF" strokeWidth="1" fill="none" />
    <circle cx="16" cy="13" r="1.5" fill="#FFFFFF" />
  </svg>
);

const DtsIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <rect width="22" height="22" x="1" y="1" rx="5" fill="#2F363D" stroke="#444D56" strokeWidth="1" />
    <text x="12" y="15" fill="#8B949E" fontSize="9" fontWeight="900" fontFamily="Outfit, Inter, sans-serif" textAnchor="middle">d.ts</text>
  </svg>
);

const EnvIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="envGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
    </defs>
    <rect width="22" height="22" x="1" y="1" rx="5" fill="none" stroke="url(#envGrad)" strokeWidth="1.5" />
    <rect x="7" y="11" width="10" height="7" rx="1" fill="url(#envGrad)" />
    <path d="M9 11V8.5a3 3 0 0 1 6 0V11" fill="none" stroke="url(#envGrad)" strokeWidth="1.5" />
  </svg>
);

const SvgFileIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="svgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
    </defs>
    <rect width="22" height="22" x="1" y="1" rx="5" fill="none" stroke="url(#svgGrad)" strokeWidth="1.5" />
    <circle cx="7" cy="17" r="2" fill="url(#svgGrad)" />
    <circle cx="17" cy="7" r="2" fill="url(#svgGrad)" />
    <path d="M7 17 C 7 10, 10 7, 17 7" fill="none" stroke="url(#svgGrad)" strokeWidth="1.5" />
    <text x="12" y="14" fill="url(#svgGrad)" fontSize="7.5" fontWeight="900" fontFamily="Inter, sans-serif" textAnchor="middle">SVG</text>
  </svg>
);

const ImageIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="imageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8B5CF6" />
        <stop offset="100%" stopColor="#EC4899" />
      </linearGradient>
    </defs>
    <rect width="22" height="22" x="1" y="1" rx="5" fill="none" stroke="url(#imageGrad)" strokeWidth="1.5" />
    <circle cx="7.5" cy="7.5" r="2" fill="url(#imageGrad)" />
    <polygon points="3 19 9 11 14 16 17 12 21 19" fill="url(#imageGrad)" opacity="0.85" />
  </svg>
);

const DefaultFileIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <path d="M19 8.5V20c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h6.5L19 8.5z" fill="#3A3D45" />
    <path d="M19 8.5H14.5V4L19 8.5z" fill="#282A30" />
    <line x1="8" y1="12" x2="16" y2="12" stroke="#6C7280" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8" y1="15" x2="16" y2="15" stroke="#6C7280" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8" y1="18" x2="12" y2="18" stroke="#6C7280" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ── Icon wrapper ──────────────────────────────────────────────────

function wrap(icon: React.ComponentType<{ size?: number }>, size = ICON_SIZE) {
  return React.createElement(icon, { size });
}

// ── File Mapping ──────────────────────────────────────────────────

export function getFileIcon(filename: string): { icon: React.ReactNode; color?: string } {
  const nameLower = filename.toLowerCase();

  // Exact file name checks
  if (nameLower === '.gitignore' || nameLower === '.gitattributes') {
    return { icon: wrap(Git), color: '#F05032' };
  }
  if (nameLower === '.vercelignore') {
    return { icon: <VercelIgnoreIcon />, color: '#000000' };
  }
  if (nameLower === '.env' || nameLower.startsWith('.env.')) {
    return { icon: <EnvIcon />, color: '#10B981' };
  }
  if (nameLower === 'package.json' || nameLower === 'package-lock.json') {
    return { icon: wrap(NPM), color: '#CB3837' };
  }
  if (nameLower === 'tsconfig.json') {
    return { icon: <TsConfigIcon />, color: '#3178c6' };
  }
  if (nameLower.startsWith('vite.config.')) {
    return { icon: wrap(ViteJS), color: '#BD34FE' };
  }
  if (nameLower === 'dockerfile' || nameLower.startsWith('dockerfile.') || nameLower === 'docker-compose.yml' || nameLower === 'docker-compose.yaml') {
    return { icon: wrap(Docker), color: '#2496ED' };
  }
  if (nameLower.startsWith('.eslintrc') || nameLower === '.eslintrc.js' || nameLower === '.eslintrc.json' || nameLower === '.eslintrc.cjs') {
    return { icon: wrap(ESLint), color: '#4B32C3' };
  }
  if (nameLower.startsWith('.prettierrc') || nameLower === 'prettier.config.js') {
    return { icon: wrap(Prettier), color: '#F7B93E' };
  }
  if (nameLower.startsWith('tailwind.config.')) {
    return { icon: wrap(TailwindCSS), color: '#06B6D4' };
  }
  if (nameLower === 'schema.prisma') {
    return { icon: wrap(Prisma), color: '#2D3748' };
  }
  if (nameLower === 'bun.lockb' || nameLower === 'bunfig.toml') {
    return { icon: wrap(BunJs), color: '#F9F1E1' };
  }
  if (nameLower === 'biome.json') {
    return { icon: wrap(JavaScript, 18), color: '#60A5FA' };
  }

  // Extensions
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  switch (ext) {
    case 'js':
    case 'mjs':
    case 'cjs':
    case 'jsx':
      return { icon: wrap(JavaScript), color: '#F7DF1E' };
    case 'ts':
    case 'mts':
    case 'cts':
      if (nameLower.endsWith('.d.ts')) {
        return { icon: <DtsIcon />, color: '#8B949E' };
      }
      return { icon: wrap(TypeScript), color: '#3178C6' };
    case 'tsx':
      return { icon: wrap(React_), color: '#00D8FF' };
    case 'json':
      return { icon: wrap(JSON_), color: '#FBBF24' };
    case 'html':
    case 'htm':
      return { icon: wrap(HTML5), color: '#E44D26' };
    case 'css':
      return { icon: wrap(CSS3), color: '#1572B6' };
    case 'scss':
    case 'sass':
      return { icon: wrap(Sass), color: '#CC6699' };
    case 'md':
    case 'mdx':
      return { icon: wrap(Markdown), color: '#0EA5E9' };
    case 'rs':
      return { icon: wrap(RustDark), color: '#E05A47' };
    case 'py':
    case 'pyw':
      return { icon: wrap(Python), color: '#3776AB' };
    case 'svg':
      return { icon: <SvgFileIcon />, color: '#F59E0B' };
    case 'sh':
      return { icon: wrap(Bash), color: '#4EAA25' };
    case 'bash':
    case 'zsh':
    case 'fish':
      return { icon: wrap(Bash), color: '#4EAA25' };
    case 'ps1':
    case 'psm1':
      return { icon: wrap(PowerShell), color: '#5391FE' };
    case 'bat':
    case 'cmd':
      return { icon: wrap(PowerShell), color: '#5391FE' };
    case 'yaml':
    case 'yml':
      return { icon: wrap(JSON_), color: '#FBBF24' };
    case 'graphql':
    case 'gql':
      return { icon: wrap(GraphQL), color: '#E10098' };
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'hpp':
      return { icon: wrap(CPlusPlus), color: '#00599C' };
    case 'cs':
      return { icon: wrap(CSharp), color: '#68217A' };
    case 'rb':
      return { icon: wrap(Ruby), color: '#CC342D' };
    case 'php':
      return { icon: wrap(PHP), color: '#777BB4' };
    case 'go':
      return { icon: wrap(Go), color: '#00ADD8' };
    case 'java':
      return { icon: wrap(Java), color: '#ED8B00' };
    case 'kt':
    case 'kts':
      return { icon: wrap(Kotlin), color: '#7F52FF' };
    case 'swift':
      return { icon: wrap(Swift), color: '#F05138' };
    case 'lua':
      return { icon: wrap(Lua), color: '#000080' };
    case 'sol':
      return { icon: wrap(Solidity), color: '#627EEA' };
    case 'vue':
      return { icon: wrap(VueJs), color: '#4FC08D' };
    case 'svelte':
      return { icon: wrap(SvelteJS), color: '#FF3E00' };
    case 'prisma':
      return { icon: wrap(Prisma), color: '#2D3748' };
    case 'sql':
    case 'psql':
      return { icon: wrap(PostgreSQL), color: '#336791' };
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'ico':
    case 'avif':
      return { icon: <ImageIcon />, color: '#EC4899' };
    default:
      return { icon: <DefaultFileIcon />, color: '#888888' };
  }
}
