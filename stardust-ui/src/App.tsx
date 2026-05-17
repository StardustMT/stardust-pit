export default function App() {
  return (
    <div className="grid min-h-screen place-items-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Stardust</h1>
        <p className="mt-3 text-muted-foreground">
          v0.1 scaffold. Run Storybook to iterate on the UI:
        </p>
        <pre className="mt-4 inline-block rounded bg-muted px-3 py-2 text-sm">
          pnpm storybook
        </pre>
      </div>
    </div>
  )
}
