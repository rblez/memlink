import { describe, test, expect } from 'bun:test';
import { buildVbscript } from '../src/cli/daemon.ts';

describe('buildVbscript', () => {
  test('npm install: includes argv[1] as .js entry between execPath and args', () => {
    const vbs = buildVbscript('C:\\path\\bun.exe', 'C:\\path\\index.js', [
      'serve',
      '--port',
      '4444',
    ]);
    expect(vbs).toContain('Set WshShell = CreateObject("WScript.Shell")');
    expect(vbs).toContain('WshShell.Run');
    expect(vbs).toContain('"C:\\\\path\\\\bun.exe"');
    // backslashes escaped
    expect(vbs).toContain('"C:\\\\path\\\\index.js"');
    expect(vbs).toMatch(/chr\(34\) & "serve" & chr\(34\)/);
    expect(vbs).toMatch(/chr\(34\) & "--port" & chr\(34\)/);
    expect(vbs).toMatch(/chr\(34\) & "4444" & chr\(34\)/);
    // Tokens separated by literal " "
    expect(vbs).toContain('chr(34) & " " & chr(34)');
    // Comma + args (trailing newline is fine)
    expect(vbs).toContain(', 0, False');
  });

  test('standalone (Bun --compile): skips argv[1], no double-args', () => {
    const vbs = buildVbscript('C:\\path\\memlink.exe', 'serve', ['serve', '--port', '4444']);
    // Only one "serve" occurrence (no double-args bug)
    const matches = vbs.match(/"serve"/g);
    expect(matches).toHaveLength(1);
  });

  test('argv[1] undefined: treated as standalone', () => {
    const vbs = buildVbscript('C:\\path\\memlink.exe', undefined, ['serve', '--daemon-child']);
    const matches = vbs.match(/"serve"/g);
    expect(matches).toHaveLength(1);
  });

  test('escapes embedded quotes in tokens', () => {
    const vbs = buildVbscript('C:\\path\\with"quote.exe', 'a.js', ['arg"with"quote']);
    expect(vbs).toContain('with""quote.exe');
    expect(vbs).toContain('arg""with""quote');
  });

  test('escapes backslashes in argv[1]', () => {
    const vbs = buildVbscript('C:\\bin\\bun.exe', 'C:\\Users\\rblez\\app\\index.js', []);
    expect(vbs).toContain('C:\\\\Users\\\\rblez\\\\app\\\\index.js');
  });

  test('produces valid VBScript structure (2 lines, Run on line 2)', () => {
    const vbs = buildVbscript('bun.exe', 'index.js', ['serve']);
    const lines = vbs.split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Set WshShell =/);
    expect(lines[1]).toMatch(/^WshShell\.Run/);
  });

  test('appended --daemon-child is included when passed via buildVbscript caller (sanity)', () => {
    // The function does NOT auto-add --daemon-child; caller passes it explicitly.
    // This test documents that contract.
    const vbs = buildVbscript('bun.exe', 'index.js', ['serve', '--daemon-child']);
    expect(vbs).toContain('"--daemon-child"');
  });
});
