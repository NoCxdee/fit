import React from 'react';

// ── SVG Icon Components ──────────────────────────────────────────

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
    {/* Back page/flap */}
    <path fill="url(#folderBackGrad)" d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12h20V8c0-1.1-.9-2-2-2z" />
    {/* Front flap open */}
    <path fill="url(#folderOpenGrad)" d="M2 10v9c0 .55.45 1 1 1h18c.55 0 1-.45 1-1v-9H2z" />
  </svg>
);

const GitIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <path fill="currentColor" d="M22.5 11.24L12.76 1.5a1.07 1.07 0 00-1.52 0L9 3.73l2.84 2.84a1.86 1.86 0 011.08-.29 1.89 1.89 0 011.89 1.89 1.85 1.85 0 01-.36 1.1l2.82 2.82c.38-.2.83-.33 1.3-.33A1.89 1.89 0 0120.47 13.7a1.89 1.89 0 01-1.89 1.89 1.89 1.89 0 01-1.89-1.89 1.86 1.86 0 01.38-1.12l-2.82-2.82c-.36.21-.79.35-1.25.35A1.89 1.89 0 0111 8.24c0-.44.15-.85.39-1.2L8.54 4.2L1.5 11.24a1.07 1.07 0 000 1.52l9.74 9.74a1.07 1.07 0 001.52 0l9.74-9.74a1.07 1.07 0 000-1.52z" />
  </svg>
);

const VercelIgnoreIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <rect width="22" height="22" x="1" y="1" rx="5" fill="#000000" stroke="#333" strokeWidth="1" />
    <polygon points="12 5 18 16 6 16" fill="#FFFFFF" />
  </svg>
);

const JsIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <rect width="22" height="22" x="1" y="1" rx="5" fill="#FFE033" />
    <path d="M1 1h22v8L1 18V1z" fill="white" fillOpacity="0.08" />
    <text x="12" y="15.5" fill="#1C1B1A" fontSize="11" fontWeight="900" fontFamily="Outfit, Inter, system-ui, sans-serif" textAnchor="middle">JS</text>
  </svg>
);

const TsIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <rect width="22" height="22" x="1" y="1" rx="5" fill="#3178C6" />
    <path d="M1 1h22v8L1 18V1z" fill="white" fillOpacity="0.08" />
    <text x="12" y="15.5" fill="#FFFFFF" fontSize="11" fontWeight="900" fontFamily="Outfit, Inter, system-ui, sans-serif" textAnchor="middle">TS</text>
  </svg>
);

const TsxIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="tsxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2A2F3A" />
        <stop offset="100%" stopColor="#1C1E24" />
      </linearGradient>
      <linearGradient id="reactGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00D8FF" />
        <stop offset="100%" stopColor="#00B4D8" />
      </linearGradient>
    </defs>
    <rect width="22" height="22" x="1" y="1" rx="5" fill="url(#tsxGrad)" stroke="#3B82F6" strokeWidth="0.5" />
    <g stroke="url(#reactGrad)" strokeWidth="1.3" fill="none" transform="translate(12, 12) scale(0.68)">
      <ellipse rx="11" ry="4.2" transform="rotate(0)" />
      <ellipse rx="11" ry="4.2" transform="rotate(60)" />
      <ellipse rx="11" ry="4.2" transform="rotate(120)" />
      <circle cx="0" cy="0" r="2.2" fill="url(#reactGrad)" stroke="none" />
    </g>
  </svg>
);

const DtsIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <rect width="22" height="22" x="1" y="1" rx="5" fill="#2F363D" stroke="#444D56" strokeWidth="1" />
    <text x="12" y="15" fill="#8B949E" fontSize="9" fontWeight="900" fontFamily="Outfit, Inter, sans-serif" textAnchor="middle">d.ts</text>
  </svg>
);

const JsonIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="jsonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
    </defs>
    <rect width="22" height="22" x="1" y="1" rx="5" fill="#201E1A" stroke="url(#jsonGrad)" strokeWidth="1.2" />
    <text x="12" y="15.5" fill="url(#jsonGrad)" fontSize="13" fontWeight="900" fontFamily="Courier New, monospace" textAnchor="middle">{"{}"}</text>
  </svg>
);

const NodeIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="nodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#43853D" />
        <stop offset="100%" stopColor="#30632B" />
      </linearGradient>
    </defs>
    <rect width="22" height="22" x="1" y="1" rx="5" fill="#1C211D" stroke="url(#nodeGrad)" strokeWidth="1.2" />
    <polygon points="12 4 19 8 19 16 12 20 5 16 5 8" fill="url(#nodeGrad)" fillOpacity="0.85" />
    <polyline points="5 8 12 12 19 8" fill="none" stroke="#FFFFFF" strokeWidth="1.2" />
    <line x1="12" y1="12" x2="12" y2="20" stroke="#FFFFFF" strokeWidth="1.2" />
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

const CssIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="cssGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2062F5" />
        <stop offset="100%" stopColor="#007ACC" />
      </linearGradient>
    </defs>
    <path fill="url(#cssGrad)" d="M3 2h18l-1.6 17.5-7.4 2.5-7.4-2.5L3 2z" />
    <path fill="#FFF" fillOpacity="0.9" d="M12 4.2v4.8h4.5l-.4 4.8-4.1 1.4v2.7l6.8-2.3.8-9.4H12z" />
    <path fill="#EAEAEA" fillOpacity="0.8" d="M12 4.2H5.2l.8 9.4 6 2v-2.7l-4.1-1.4-.2-2.5H12V4.2z" />
  </svg>
);

const HtmlIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="htmlGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E44D26" />
        <stop offset="100%" stopColor="#F16529" />
      </linearGradient>
    </defs>
    <path fill="url(#htmlGrad)" d="M3 2h18l-1.6 17.5-7.4 2.5-7.4-2.5L3 2z" />
    <path fill="#FFF" fillOpacity="0.9" d="M12 4.2v4.8h4.5l-.4 4.8-4.1 1.4v2.7l6.8-2.3.8-9.4H12z" />
    <path fill="#EAEAEA" fillOpacity="0.8" d="M12 4.2H5.2l.8 9.4 6 2v-2.7l-4.1-1.4-.2-2.5H12V4.2z" />
  </svg>
);

const MarkdownIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="mdGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0ea5e9" />
        <stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
    </defs>
    <rect width="22" height="22" x="1" y="1" rx="5" fill="url(#mdGrad)" />
    <path d="M3 7h3l2 2.5L10 7h3v10H9.5v-5.5L7.5 14l-2-2.5V17H3V7zm13.5 0h3v5.5H22L18 17.5 14 12.5h2.5V7z" fill="#FFFFFF" />
  </svg>
);

const RustIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="rustGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E05A47" />
        <stop offset="100%" stopColor="#A73A2A" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" fill="none" stroke="url(#rustGrad)" strokeWidth="1.5" strokeDasharray="3 1.5" />
    <circle cx="12" cy="12" r="7" fill="url(#rustGrad)" />
    <text x="12" y="15.5" fill="#FFFFFF" fontSize="10" fontWeight="900" fontFamily="Inter, sans-serif" textAnchor="middle">R</text>
  </svg>
);

const PythonIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="pyBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3776AB" />
        <stop offset="100%" stopColor="#1E4B75" />
      </linearGradient>
      <linearGradient id="pyYellowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFE873" />
        <stop offset="100%" stopColor="#FFD43B" />
      </linearGradient>
    </defs>
    <g transform="translate(2, 2) scale(0.83)">
      <path fill="url(#pyBlueGrad)" d="M12 2c-2.7 0-3 .2-4.1.3-.9.1-1.6.5-2.2 1.1s-1 1.3-1.1 2.2c-.2 1.1-.3 1.4-.3 4.1h2.5v-.9c0-.8.3-1.6.9-2.2s1.4-.9 2.2-.9h5c.8 0 1.6.3 2.2.9.4.4.7.9.8 1.4v.9h1.7c2.7 0 3-.2 4.1-.3.9-.1 1.6-.5 2.2-1.1s1-1.3 1.1-2.2c.2-1.1.3-1.4.3-4.1C22 2.7 20 2 12 2zM9 5c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1z" />
      <path fill="url(#pyYellowGrad)" d="M12 22c2.7 0 3-.2 4.1-.3.9-.1 1.6-.5 2.2-1.1s1-1.3 1.1-2.2c.2-1.1.3-1.4.3-4.1H17.2v.9c0 .8-.3 1.6-.9 2.2s-1.4.9-2.2.9H9.1c-.8 0-1.6-.3-2.2-.9-.4-.4-.7-.9-.8-1.4v-.9H4.4c-2.7 0-3 .2-4.1.3-.9.1-1.6.5-2.2 1.1s-1 1.3-1.1 2.2c-.2 1.1-.3 1.4-.3 4.1C2 21.3 4 22 12 22zm3-3c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1z" />
    </g>
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

const SassIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="sassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#CF649A" />
        <stop offset="100%" stopColor="#B34A7E" />
      </linearGradient>
    </defs>
    <rect width="22" height="22" x="1" y="1" rx="5" fill="url(#sassGrad)" />
    <path d="M1 1h22v8L1 18V1z" fill="white" fillOpacity="0.08" />
    <text x="12" y="15" fill="#FFFFFF" fontSize="8" fontWeight="900" fontFamily="Outfit, Inter, sans-serif" textAnchor="middle">SASS</text>
  </svg>
);

const ViteIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="viteBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E1E24" />
        <stop offset="100%" stopColor="#121214" />
      </linearGradient>
      <linearGradient id="viteLightning" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFD600" />
        <stop offset="100%" stopColor="#FF8F00" />
      </linearGradient>
      <linearGradient id="vitePurple" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#BD34FE" />
        <stop offset="100%" stopColor="#41B883" />
      </linearGradient>
    </defs>
    <rect width="22" height="22" x="1" y="1" rx="5" fill="url(#viteBg)" stroke="url(#vitePurple)" strokeWidth="1" />
    <polygon points="13 4 6 12 11 12 10 20 18 10 13 10" fill="url(#viteLightning)" />
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

const TerminalIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <defs>
      <linearGradient id="terminalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
    <rect width="22" height="22" x="1" y="1" rx="5" fill="#18181B" stroke="url(#terminalGrad)" strokeWidth="1.2" />
    <path d="M5 6 L10 11 L5 16" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="11" y1="16" x2="17" y2="16" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" />
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

const DefaultFileIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%">
    <path d="M19 8.5V20c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h6.5L19 8.5z" fill="#3A3D45" />
    <path d="M19 8.5H14.5V4L19 8.5z" fill="#282A30" />
    <line x1="8" y1="12" x2="16" y2="12" stroke="#6C7280" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8" y1="15" x2="16" y2="15" stroke="#6C7280" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8" y1="18" x2="12" y2="18" stroke="#6C7280" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ── File Mapping ──

export function getFileIcon(filename: string): { icon: React.ReactNode; color?: string } {
  const nameLower = filename.toLowerCase();

  // Exact file name checks
  if (nameLower === '.gitignore' || nameLower === '.gitattributes') {
    return { icon: <GitIcon />, color: '#F05032' };
  }
  if (nameLower === '.vercelignore') {
    return { icon: <VercelIgnoreIcon />, color: '#000000' };
  }
  if (nameLower === 'package.json' || nameLower === 'package-lock.json') {
    return { icon: <NodeIcon />, color: '#43853D' };
  }
  if (nameLower === 'tsconfig.json') {
    return { icon: <TsConfigIcon />, color: '#3178c6' };
  }
  if (nameLower.startsWith('vite.config.')) {
    return { icon: <ViteIcon />, color: '#BD34FE' };
  }

  // Extensions
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  switch (ext) {
    case 'js':
    case 'mjs':
    case 'cjs':
      return { icon: <JsIcon />, color: '#F7DF1E' };
    case 'jsx':
      return { icon: <TsxIcon />, color: '#00D8FF' };
    case 'ts':
    case 'mts':
    case 'cts':
      if (nameLower.endsWith('.d.ts')) {
        return { icon: <DtsIcon />, color: '#8B949E' };
      }
      return { icon: <TsIcon />, color: '#3178C6' };
    case 'tsx':
      return { icon: <TsxIcon />, color: '#00D8FF' };
    case 'json':
      return { icon: <JsonIcon />, color: '#FBBF24' };
    case 'html':
    case 'htm':
      return { icon: <HtmlIcon />, color: '#E44D26' };
    case 'css':
      return { icon: <CssIcon />, color: '#2062F5' };
    case 'scss':
    case 'sass':
      return { icon: <SassIcon />, color: '#CF649A' };
    case 'md':
    case 'mdx':
      return { icon: <MarkdownIcon />, color: '#0ea5e9' };
    case 'rs':
      return { icon: <RustIcon />, color: '#E05A47' };
    case 'py':
      return { icon: <PythonIcon />, color: '#3776AB' };
    case 'svg':
      return { icon: <SvgFileIcon />, color: '#F59E0B' };
    case 'env':
      return { icon: <EnvIcon />, color: '#10B981' };
    case 'tsbuildinfo':
      return { icon: <DtsIcon />, color: '#8B949E' };
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'ico':
      return { icon: <ImageIcon />, color: '#EC4899' };
    case 'sh':
    case 'bat':
    case 'cmd':
    case 'ps1':
      return { icon: <TerminalIcon />, color: '#3B82F6' };
    default:
      return { icon: <DefaultFileIcon />, color: '#888888' };
  }
}

export function getLanguageFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  const langMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    'ts': 'javascript',
    'tsx': 'javascript',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'css',
    'less': 'css',
    'json': 'json',
    'md': 'markdown',
    'mdx': 'markdown',
    'rs': 'rust',
    'py': 'python',
  };

  return langMap[ext] ?? 'text';
}
