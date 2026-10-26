import { Component, lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import type { ComponentProps } from "react";
import type EditScreen from "./EditScreen";

type EditorModule = {default: typeof EditScreen};
let resolvedEditor: EditorModule | undefined;
async function loadEditor(url: string | null): Promise<EditorModule> {
  if (resolvedEditor) return resolvedEditor;
  const loaded: EditorModule = url
    ? await import(/* @vite-ignore */ url)
    : await import("./EditScreen");
  resolvedEditor = loaded;
  return loaded;
}

class EditorBoundary extends Component<{children: ReactNode; onRetry: (error: Error) => void}, {error: Error | null}> {
  state: {error: Error | null} = {error: null};
  static getDerivedStateFromError(error: Error) { return {error}; }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="editor-load-error">
      <h1 tabIndex={-1} ref={el => el?.focus()}>The editor couldn’t open</h1>
      <p role="alert">The connection was interrupted. Your photos and edits are still here.</p>
      <div className="recovery-actions">
        <button className="primary-button" onClick={() => this.props.onRetry(this.state.error!)}>Try again</button>
        <Link className="secondary-button" to="/">Back to Start</Link>
      </div>
    </main>;
  }
}

// A failed module URL is cached by browsers. Retry the same-origin Vite chunk
// under a fresh URL, while the session continues to live above this boundary.
function retryUrl(error?: Error) {
  const match = error?.message.match(/https?:\/\/[^\s]+/);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    if (url.origin !== location.origin || !/^\/(assets|src)\//.test(url.pathname) || !/\.(js|tsx)$/.test(url.pathname)) return null;
    url.searchParams.set("editor-retry", String(Date.now()));
    return url.href;
  } catch { return null; }
}
export default function EditorLoader(props: ComponentProps<typeof EditScreen>) {
  const [attempt, setAttempt] = useState<{key: number; url: string | null}>({key: 0, url: null});
  const Editor = useMemo(() => lazy(() => loadEditor(attempt.url)), [attempt]);
  return <EditorBoundary key={attempt.key} onRetry={error => setAttempt(a => ({key: a.key + 1, url: retryUrl(error)}))}>
    <Suspense fallback={<main className="editor-loading" aria-busy="true"><p role="status">Opening editor…</p></main>}>
      <Editor {...props} />
    </Suspense>
  </EditorBoundary>;
}
