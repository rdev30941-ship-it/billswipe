
"use client";

import { useState } from "react";

const bills = [
  { id: 1, title: "College Semester Fees", category: "EDUCATION", description: "Helping a student continue their engineering education.", amount: 18500, raised: 7200, icon: "🎓" },
  { id: 2, title: "Medical Consultation", category: "HEALTHCARE", description: "Support for essential medical consultation expenses.", amount: 8500, raised: 3000, icon: "✚" },
  { id: 3, title: "Laptop for Learning", category: "TECHNOLOGY", description: "A laptop to support learning and programming.", amount: 32000, raised: 12000, icon: "💻" },
];

const money = (n: number) => "₹" + n.toLocaleString("en-IN");

export default function Home() {
  const [index, setIndex] = useState(0);
  const [supported, setSupported] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [tab, setTab] = useState("Discover");

  const current = bills[index];

  function swipe(action: "support" | "skip") {
    if (!current) return;
    if (action === "support") setSupported(old => [...old, current.id]);
    else setSkipped(old => [...old, current.id]);
    setIndex(old => old + 1);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090810] text-white selection:bg-purple-500/40">

      {/* Ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-purple-700/20 blur-[130px]" />
        <div className="absolute -right-40 top-80 h-96 w-96 rounded-full bg-violet-500/20 blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#090810]/65 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <a href="#" className="text-2xl font-black tracking-tight">
            BILL<span className="bg-gradient-to-r from-violet-300 to-purple-500 bg-clip-text text-transparent">SWIPE</span>
          </a>

          <nav className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1.5 md:flex">
            {["Discover", "My activity", "About"].map(item => (
              <button key={item} onClick={() => setTab(item)}
                className={`rounded-full px-5 py-2 text-sm transition ${
                  tab === item ? "bg-purple-500/30 text-white shadow-lg shadow-purple-900/30" : "text-zinc-400 hover:text-white"
                }`}>
                {item}
              </button>
            ))}
          </nav>

          <button className="rounded-full border border-purple-300/30 bg-purple-500/15 px-5 py-2.5 text-sm backdrop-blur-xl transition hover:bg-purple-500/30">
            Sign in ↗
          </button>
        </div>
      </header>

      {/* Main */}
      <section className="relative z-10 mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1fr_390px]">

        <div>
          <div className="mb-12">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-400/10 px-4 py-2 text-[10px] font-bold tracking-[0.25em] text-purple-200 backdrop-blur-xl">
              <span className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_12px_#a78bfa]" />
              COMMUNITY SPONSORSHIP
            </div>

            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.12] tracking-tight md:text-7xl">
              A little help.
              <br />
              <span className="bg-gradient-to-r from-violet-300 via-purple-400 to-indigo-300 bg-clip-text text-transparent">
                A big difference.
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-sm leading-7 text-zinc-400">
              Discover meaningful needs. Support someone's journey.
              Make kindness part of the digital world.
            </p>
          </div>

          <div className="mb-5 flex items-center justify-between">
            <span className="font-medium">Discover opportunities</span>
            <span className="text-xs text-zinc-500">
              {index < bills.length ? `${index + 1} / ${bills.length}` : "Completed"}
            </span>
          </div>

          {current ? (
            <div className="group relative max-w-xl rounded-[30px] border border-white/[0.13] bg-gradient-to-br from-white/[0.12] via-white/[0.045] to-purple-500/[0.08] p-7 shadow-[0_25px_100px_-35px_rgba(139,92,246,0.35)] backdrop-blur-2xl transition duration-500 hover:-translate-y-1 hover:border-purple-300/30 md:p-9">

              <div className="absolute inset-0 rounded-[30px] bg-gradient-to-br from-purple-400/[0.07] to-transparent opacity-80" />

              <div className="relative">
                <div className="mb-8 flex items-center justify-between">
                  <span className="rounded-full border border-purple-300/20 bg-purple-400/15 px-4 py-2 text-[10px] font-bold tracking-widest text-purple-200">
                    {current.category}
                  </span>
                  <span className="text-[10px] tracking-widest text-zinc-500">DEMO BILL</span>
                </div>

                <div className="mb-8 flex h-40 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-purple-400/20 via-indigo-500/10 to-white/[0.03] shadow-inner">
                  <span className="text-7xl drop-shadow-[0_10px_30px_rgba(167,139,250,0.5)]">
                    {current.icon}
                  </span>
                </div>

                <h2 className="text-3xl font-semibold tracking-tight">{current.title}</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-400">{current.description}</p>

                <div className="mt-9 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-zinc-500">Required amount</p>
                    <p className="mt-2 text-3xl font-semibold">{money(current.amount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Sample support</p>
                    <p className="mt-2 text-xl font-semibold text-violet-300">{money(current.raised)}</p>
                  </div>
                </div>

                <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-300 shadow-[0_0_15px_rgba(167,139,250,0.6)]"
                    style={{ width: `${current.raised / current.amount * 100}%` }} />
                </div>

                <div className="mt-9 grid grid-cols-2 gap-4">
                  <button onClick={() => swipe("skip")}
                    className="rounded-2xl border border-white/15 bg-white/[0.04] py-4 text-sm font-medium backdrop-blur-xl transition hover:bg-white/10">
                    ← Skip
                  </button>
                  <button onClick={() => swipe("support")}
                    className="rounded-2xl border border-purple-300/30 bg-gradient-to-r from-violet-500 to-purple-600 py-4 text-sm font-semibold shadow-lg shadow-purple-900/40 transition hover:scale-[1.02] hover:shadow-purple-700/40">
                    ♥ Support
                  </button>
                </div>

                <p className="mt-5 text-center text-[10px] text-zinc-500">
                  Demo only · No real payments
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-xl rounded-[30px] border border-white/10 bg-white/[0.06] p-12 text-center backdrop-blur-2xl">
              <h2 className="text-2xl font-semibold">You're all caught up.</h2>
              <p className="mt-3 text-sm text-zinc-400">You've explored all sample bills.</p>
              <button onClick={() => setIndex(0)} className="mt-7 rounded-xl bg-purple-500 px-6 py-3 font-semibold">Start again</button>
            </div>
          )}
        </div>

        {/* Right dashboard */}
        <aside className="space-y-5">

          <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.11] to-white/[0.025] p-7 shadow-2xl backdrop-blur-2xl">
            <p className="text-[10px] font-bold tracking-[0.25em] text-zinc-500">YOUR ACTIVITY</p>

            <div className="mt-8 grid grid-cols-2 gap-5">
              <div>
                <p className="text-4xl font-semibold">{supported.length}</p>
                <p className="mt-2 text-xs text-zinc-400">Supported</p>
              </div>
              <div>
                <p className="text-4xl font-semibold">{skipped.length}</p>
                <p className="mt-2 text-xs text-zinc-400">Skipped</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-purple-300/20 bg-gradient-to-br from-purple-500/25 via-violet-500/10 to-white/[0.03] p-7 shadow-[0_20px_70px_-30px_rgba(139,92,246,0.5)] backdrop-blur-2xl">
            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-purple-400/20 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-bold tracking-widest text-purple-200">THE EXPERIENCE</p>
              <div className="mt-7 space-y-6 text-sm text-zinc-300">
                <p>01 — Discover a need.</p>
                <p>02 — Understand the story.</p>
                <p>03 — Express your support.</p>
                <p>04 — Make an impact.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-2xl">
            <p className="text-sm font-semibold">More than an app.</p>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              We believe technology should make helping people simpler,
              more transparent and more accessible.
            </p>
          </div>

        </aside>
      </section>

      <footer className="relative z-10 border-t border-white/[0.08] px-6 py-9 text-center text-xs text-zinc-500">
        BILLSWIPE © 2026 · MADE FOR GOOD
      </footer>
    </main>
  );
}
