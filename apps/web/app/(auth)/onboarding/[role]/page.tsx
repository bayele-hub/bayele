export default async function Onboarding({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl font-extrabold text-ink">Finalisation — {role}</h1>
      <p className="mt-2 text-sm text-muted">
        Complétez votre profil. Statut&nbsp;: <code className="rounded bg-surface px-1">pending_review</code> jusqu'à validation admin.
      </p>
    </main>
  );
}
