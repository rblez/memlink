import chalk from 'chalk';

// ─── Color palette (hardcoded hex) ────────────────────────────────────────────

export const colors = {
  primary: chalk.hex('#00E5A0'),
  accent: chalk.hex('#CC00CC'),
  muted: chalk.hex('#66B8A0'),
  white: chalk.hex('#e8e8e8'),
  dim: chalk.hex('#444'),
};

// ─── Badge helpers ─────────────────────────────────────────────────────────────

export function ok(message: string): string {
  return `  ${colors.primary('[ ok ]')}  ${colors.white(message)}`;
}

export function err(message: string, hint?: string): string {
  const base = `  ${colors.accent('[ error ]')}  ${colors.white(message)}`;
  return hint ? `${base}\n  ${colors.dim(hint)}` : base;
}

export function info(label: string, value?: string): string {
  if (value === undefined) {
    return `  ${colors.primary(`[ ${label} ]`)}`;
  }
  return `  ${colors.primary(`[ ${label} ]`)}  ${colors.white(value)}`;
}

export function count(label: string, value: number | string): string {
  return `  ${colors.muted(`[ ${value} ${label} ]`)}`;
}

export function confirm(message: string): string {
  return `  ${colors.accent('[ confirm ]')}  ${colors.white(message)}`;
}

export function kv(key: string, value: string): string {
  return `  ${colors.muted(key)}  ${colors.white(value)}`;
}

export function list(label: string, id: string, detail?: string): string {
  const base = `  ${colors.white(label)}  ${colors.dim(id)}`;
  return detail ? `${base}  ${colors.muted(detail)}` : base;
}

export function heading(text: string): string {
  return colors.white(`\n  ${text}\n`);
}

export function subheading(text: string): string {
  return colors.muted(`  ${text}`);
}

export function prompt(text: string): string {
  return `${colors.dim('  >')}  ${colors.white(text)}`;
}

export function dimLine(text: string): string {
  return colors.dim(`  ${text}`);
}
