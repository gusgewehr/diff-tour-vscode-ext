import * as vscode from 'vscode';
import { SCHEME, buildQuery, parseQuery, showBlob } from './blob';

export { SCHEME };

export class DiffTourContentProvider implements vscode.TextDocumentContentProvider {
  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const q = parseQuery(uri.query);
    if (!q || q.empty) return '';
    return showBlob(q.cwd, q.sha, uri.path.replace(/^\//, ''));
  }
}

// Real filename stays last in the path so VS Code picks the language.
export function tourUri(relPath: string | undefined, sha: string, cwd: string): vscode.Uri {
  if (relPath === undefined) return vscode.Uri.from({ scheme: SCHEME, path: '/empty', query: 'empty=1' });
  return vscode.Uri.from({ scheme: SCHEME, path: '/' + relPath.replace(/\\/g, '/'), query: buildQuery({ sha, cwd }) });
}
