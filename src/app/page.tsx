export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
          No conversation selected
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Start a new conversation from the sidebar, or pick an existing one.
        </p>
      </div>
    </div>
  );
}
