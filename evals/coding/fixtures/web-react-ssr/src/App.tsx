export function App({ pending }: { pending: boolean }) {
  return <main aria-busy={pending}>{pending ? <p role="status">Loading</p> : <h1>Ready</h1>}</main>;
}

