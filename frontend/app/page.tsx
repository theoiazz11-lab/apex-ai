
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0f] px-6 text-center text-white">
      <div className="mb-6 rounded-full border border-red-500 px-4 py-2 text-sm text-red-400">
        AI-POWERED SIM RACING
      </div>

      <h1 className="text-6xl font-extrabold tracking-tight">
        APEX <span className="text-red-500">AI</span>
      </h1>

      <p className="mt-6 max-w-xl text-lg text-gray-400">
        Analyze your laps. Improve your driving.
        Push beyond your limits.
      </p>

      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <a
          href="#features"
          className="rounded-lg bg-red-600 px-8 py-4 font-semibold hover:bg-red-700"
        >
          Explore Features
        </a>
      </div>

      <section id="features" className="mt-24 grid gap-6 md:grid-cols-3">
        {[
          ["Lap Analysis", "Review your racing lines and braking points."],
          ["AI Coaching", "Get personalized driving feedback."],
          ["Leaderboards", "Compete with sim racers worldwide."],
        ].map(([title, description]) => (
          <div
            key={title}
            className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-left"
          >
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="mt-3 text-gray-400">{description}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
