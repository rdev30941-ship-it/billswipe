
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Bill = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  amount: number;
  currency: string;
  status: string;
};

type SwipeRecord = {
  bill_id: string;
  action: "support" | "skip";
  created_at: string;
  bill: {
    title: string;
    category: string | null;
    amount: number;
    currency: string;
  } | null;
};

const money = (amount: number, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

const icons: Record<string, string> = {
  Education: "🎓",
  Medical: "✚",
  Technology: "💻",
};

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "U"
  );
}

export default function Home() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [index, setIndex] = useState(0);

  const [supported, setSupported] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [history, setHistory] = useState<SwipeRecord[]>([]);

  const [tab, setTab] = useState("Discover");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [email, setEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  const [swipeLoading, setSwipeLoading] = useState(false);

  // Profile
  const [profileName, setProfileName] = useState("");
  const [profileDraft, setProfileDraft] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  // Authentication session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id || "");
      setUserEmail(data.session?.user.email || "");
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user.id || "");
        setUserEmail(session?.user.email || "");
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  // Fetch bills
  useEffect(() => {
    async function loadBills() {
      const { data, error } = await supabase
        .from("bills")
        .select("id, title, description, category, amount, currency, status")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setBills((data || []) as Bill[]);
      }

      setLoading(false);
    }

    loadBills();
  }, []);

  // Fetch profile
  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!userId) {
        setProfileName("");
        setProfileDraft("");
        return;
      }

      setProfileLoading(true);
      setProfileMessage("");

      const fallbackName = userEmail.split("@")[0] || "User";

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        setProfileMessage(error.message);
        setProfileName(fallbackName);
        setProfileDraft(fallbackName);
      } else {
        const name = data?.display_name || fallbackName;
        setProfileName(name);
        setProfileDraft(name);
      }

      setProfileLoading(false);
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [userId, userEmail]);

  // Fetch swipe history
  useEffect(() => {
    let active = true;

    async function loadActivity() {
      setIndex(0);
      setSupported([]);
      setSkipped([]);
      setHistory([]);

      if (!userId) return;

      const { data, error } = await supabase
        .from("swipes")
        .select(`
          bill_id,
          action,
          created_at,
          bill:bills (
            title,
            category,
            amount,
            currency
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        setAuthMessage(error.message);
        return;
      }

      const records = (data || []) as unknown as SwipeRecord[];

      setHistory(records);

      setSupported(
        records
          .filter((item) => item.action === "support")
          .map((item) => item.bill_id)
      );

      setSkipped(
        records
          .filter((item) => item.action === "skip")
          .map((item) => item.bill_id)
      );
    }

    loadActivity();

    return () => {
      active = false;
    };
  }, [userId]);

  // Replay mode: show all bills, including previously swiped bills
  const current = bills[index];

  // Email sign-in
  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setAuthLoading(true);
    setAuthMessage("");

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      setAuthMessage(
        error ? error.message : "Check your email for your sign-in link."
      );
    } catch {
      setAuthMessage("Something went wrong. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  // Sign out
  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthMessage(error.message);
    } else {
      setAuthMessage("Signed out successfully.");
      setTab("Discover");
    }
  }

  // Save profile
  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!userId) return;

    const name = profileDraft.trim();

    if (!name) {
      setProfileMessage("Please enter a display name.");
      return;
    }

    if (name.length > 40) {
      setProfileMessage("Display name must be 40 characters or less.");
      return;
    }

    setProfileSaving(true);
    setProfileMessage("");

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          display_name: name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (error) {
      setProfileMessage(error.message);
    } else {
      setProfileName(name);
      setProfileDraft(name);
      setProfileMessage("Profile saved successfully!");
    }

    setProfileSaving(false);
  }

  // Support / Skip with replay and database update
  async function swipe(action: "support" | "skip") {
    if (!current || swipeLoading) return;

    if (!userId) {
      setAuthMessage("Please sign in before swiping.");
      return;
    }

    setSwipeLoading(true);
    setAuthMessage("");

    try {
      const { data, error } = await supabase
        .from("swipes")
        .upsert(
          {
            bill_id: current.id,
            user_id: userId,
            action,
            created_at: new Date().toISOString(),
          },
          { onConflict: "bill_id,user_id" }
        )
        .select(`
          bill_id,
          action,
          created_at,
          bill:bills (
            title,
            category,
            amount,
            currency
          )
        `)
        .single();

      if (error) {
        setAuthMessage(error.message);
        return;
      }

      // Update counts without creating duplicate bill entries
      if (action === "support") {
        setSupported((old) =>
          [...old.filter((id) => id !== current.id), current.id]
        );

        setSkipped((old) =>
          old.filter((id) => id !== current.id)
        );
      } else {
        setSkipped((old) =>
          [...old.filter((id) => id !== current.id), current.id]
        );

        setSupported((old) =>
          old.filter((id) => id !== current.id)
        );
      }

      // Replace the existing history record for this bill
      if (data) {
        const updatedRecord = data as unknown as SwipeRecord;

        setHistory((old) =>
          [
            updatedRecord,
            ...old.filter((item) => item.bill_id !== current.id),
          ].sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
        );
      }

      setIndex((old) => old + 1);
    } catch {
      setAuthMessage("Could not save your swipe. Please try again.");
    } finally {
      setSwipeLoading(false);
    }
  }

  // Replay all bills
  function replayBills() {
    setIndex(0);
    setTab("Discover");
    setAuthMessage("");
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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">

          <a
            href="#"
            onClick={() => setTab("Discover")}
            className="text-2xl font-black tracking-tight"
          >
            BILL<span className="bg-gradient-to-r from-violet-300 to-purple-500 bg-clip-text text-transparent">SWIPE</span>
          </a>

          <nav className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1.5 md:flex">
            {["Discover", "My activity", "Profile", "About"].map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  tab === item
                    ? "bg-purple-500/30 text-white shadow-lg shadow-purple-900/30"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>

          {userEmail ? (
            <div className="flex items-center gap-3">
              <span className="hidden max-w-36 truncate text-xs text-purple-200 sm:block">
                {userEmail}
              </span>
              <button
                onClick={handleSignOut}
                className="rounded-full border border-purple-300/30 bg-purple-500/15 px-5 py-2.5 text-sm transition hover:bg-purple-500/30"
              >
                Sign out ↗
              </button>
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="flex items-center gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="w-32 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-purple-400 sm:w-40"
              />
              <button
                type="submit"
                disabled={authLoading}
                className="rounded-full border border-purple-300/30 bg-purple-500/20 px-4 py-2.5 text-sm transition hover:bg-purple-500/30 disabled:opacity-50"
              >
                {authLoading ? "Sending..." : "Sign in ↗"}
              </button>
            </form>
          )}
        </div>
      </header>

      {/* Messages */}
      {authMessage && (
        <div className="relative z-20 mx-auto max-w-7xl px-6 pt-4 text-sm text-purple-300">
          {authMessage}
        </div>
      )}

      {/* Main layout */}
      <section className="relative z-10 mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1fr_390px]">

        <div>
          {/* Hero */}
          <div className="mb-12">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-purple-400/10 px-4 py-2 text-[10px] font-bold tracking-[0.25em] text-purple-200">
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

          {/* Discover */}
          {tab === "Discover" && (
            <>
              <div className="mb-5 flex items-center justify-between">
                <span className="font-medium">Discover opportunities</span>
                <span className="text-xs text-zinc-500">
                  {loading
                    ? "Loading..."
                    : current
                      ? `${index + 1} / ${bills.length}`
                      : "Completed"}
                </span>
              </div>

              {loading ? (
                <div className="max-w-xl rounded-[30px] border border-white/10 bg-white/[0.06] p-12 text-center">
                  Loading opportunities...
                </div>
              ) : error ? (
                <div className="max-w-xl rounded-[30px] border border-red-400/20 bg-red-500/10 p-8 text-red-200">
                  Could not load bills: {error}
                </div>
              ) : current ? (
                <div className="group relative max-w-xl rounded-[30px] border border-white/[0.13] bg-gradient-to-br from-white/[0.12] via-white/[0.045] to-purple-500/[0.08] p-7 shadow-[0_25px_100px_-35px_rgba(139,92,246,0.35)] backdrop-blur-2xl transition duration-500 hover:-translate-y-1 hover:border-purple-300/30 md:p-9">

                  <div className="absolute inset-0 rounded-[30px] bg-gradient-to-br from-purple-400/[0.07] to-transparent opacity-80" />

                  <div className="relative">
                    <div className="mb-8 flex items-center justify-between">
                      <span className="rounded-full border border-purple-300/20 bg-purple-400/15 px-4 py-2 text-[10px] font-bold tracking-widest text-purple-200">
                        {current.category || "COMMUNITY"}
                      </span>

                      <span className="text-[10px] tracking-widest text-zinc-500">
                        DEMO BILL
                      </span>
                    </div>

                    <div className="mb-8 flex h-40 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-purple-400/20 via-indigo-500/10 to-white/[0.03] shadow-inner">
                      <span className="text-7xl">
                        {icons[current.category || ""] || "💜"}
                      </span>
                    </div>

                    <h2 className="text-3xl font-semibold tracking-tight">
                      {current.title}
                    </h2>

                    <p className="mt-3 text-sm leading-7 text-zinc-400">
                      {current.description || "Community support opportunity."}
                    </p>

                    <div className="mt-9">
                      <p className="text-xs text-zinc-500">Required amount</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {money(Number(current.amount), current.currency)}
                      </p>
                    </div>

                    {/* Previous action indicator */}
                    {history.some((item) => item.bill_id === current.id) && (
                      <p className="mt-5 text-center text-xs text-purple-300">
                        Previously swiped · Replaying this bill updates your existing activity.
                      </p>
                    )}

                    <div className="mt-9 grid grid-cols-2 gap-4">
                      <button
                        onClick={() => swipe("skip")}
                        disabled={swipeLoading}
                        className="rounded-2xl border border-white/15 bg-white/[0.04] py-4 text-sm font-medium transition hover:bg-white/10 disabled:opacity-50"
                      >
                        ← Skip
                      </button>

                      <button
                        onClick={() => swipe("support")}
                        disabled={swipeLoading}
                        className="rounded-2xl border border-purple-300/30 bg-gradient-to-r from-violet-500 to-purple-600 py-4 text-sm font-semibold shadow-lg shadow-purple-900/40 transition hover:scale-[1.02] disabled:opacity-50"
                      >
                        {swipeLoading ? "Saving..." : "♥ Support"}
                      </button>
                    </div>

                    <p className="mt-5 text-center text-[10px] text-zinc-500">
                      Prototype only · No real payments
                    </p>
                  </div>
                </div>
              ) : (
                <div className="max-w-xl rounded-[30px] border border-white/10 bg-white/[0.06] p-12 text-center">
                  <h2 className="text-2xl font-semibold">
                    You're all caught up.
                  </h2>

                  <p className="mt-3 text-sm text-zinc-400">
                    You've explored all available demo bills.
                  </p>

                  <button
                    onClick={replayBills}
                    className="mt-7 rounded-xl bg-purple-500 px-6 py-3 font-semibold transition hover:bg-purple-600"
                  >
                    ↻ Start again
                  </button>
                </div>
              )}
            </>
          )}

          {/* Sponsor dashboard */}
          {tab === "My activity" && (
            <div className="max-w-xl space-y-6">
              <div>
                <p className="text-xs font-bold tracking-[0.25em] text-purple-300">
                  SPONSOR DASHBOARD
                </p>
                <h2 className="mt-3 text-3xl font-semibold">
                  Your activity
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Your personal sponsorship activity and history.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-3xl border border-purple-300/20 bg-purple-500/10 p-6">
                  <p className="text-4xl font-semibold">{supported.length}</p>
                  <p className="mt-2 text-sm text-zinc-400">Supported</p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6">
                  <p className="text-4xl font-semibold">{skipped.length}</p>
                  <p className="mt-2 text-sm text-zinc-400">Skipped</p>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Recent activity</h3>
                  <span className="text-xs text-zinc-500">
                    {history.length} records
                  </span>
                </div>

                {!userId ? (
                  <p className="text-sm text-zinc-400">
                    Sign in to see your activity.
                  </p>
                ) : history.length === 0 ? (
                  <p className="text-sm text-zinc-400">
                    No activity yet. Explore Discover!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {history.map((item) => (
                      <div
                        key={item.bill_id}
                        className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {item.bill?.title || "Demo bill"}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {item.bill?.category || "Community"} ·{" "}
                            {new Date(item.created_at).toLocaleDateString("en-IN")}
                          </p>
                          {item.bill && (
                            <p className="mt-1 text-sm text-zinc-300">
                              {money(
                                Number(item.bill.amount),
                                item.bill.currency
                              )}
                            </p>
                          )}
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${
                            item.action === "support"
                              ? "border border-purple-300/20 bg-purple-400/15 text-purple-200"
                              : "border border-white/10 bg-white/[0.06] text-zinc-400"
                          }`}
                        >
                          {item.action === "support" ? "♥ Supported" : "Skipped"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Profile */}
          {tab === "Profile" && (
            <div className="max-w-xl space-y-6">
              <div>
                <p className="text-xs font-bold tracking-[0.25em] text-purple-300">
                  YOUR ACCOUNT
                </p>
                <h2 className="mt-3 text-3xl font-semibold">My profile</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Manage your BillSwipe identity.
                </p>
              </div>

              {!userId ? (
                <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-8">
                  Please sign in to view your profile.
                </div>
              ) : profileLoading ? (
                <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-8">
                  Loading your profile...
                </div>
              ) : (
                <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.09] to-purple-500/[0.06] p-7 backdrop-blur-2xl">
                  <div className="flex items-center gap-5 border-b border-white/10 pb-7">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-purple-300/40 bg-gradient-to-br from-violet-400 to-purple-700 text-2xl font-bold shadow-lg shadow-purple-900/40">
                      {initials(profileName || userEmail)}
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-semibold">
                        {profileName || "BillSwipe User"}
                      </h3>
                      <p className="mt-1 truncate text-sm text-zinc-400">
                        {userEmail}
                      </p>
                      <p className="mt-2 text-xs text-purple-300">
                        BillSwipe member
                      </p>
                    </div>
                  </div>

                  <form onSubmit={saveProfile} className="mt-7 space-y-5">
                    <div>
                      <label className="mb-2 block text-sm text-zinc-300">
                        Display name
                      </label>
                      <input
                        type="text"
                        maxLength={40}
                        required
                        value={profileDraft}
                        onChange={(e) => setProfileDraft(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400"
                      />
                      <p className="mt-2 text-xs text-zinc-500">
                        Maximum 40 characters.
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-zinc-300">
                        Email address
                      </label>
                      <input
                        type="email"
                        readOnly
                        value={userEmail}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-zinc-400 outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 py-4 font-semibold shadow-lg shadow-purple-900/30 transition hover:opacity-90 disabled:opacity-50"
                    >
                      {profileSaving ? "Saving..." : "Save profile"}
                    </button>

                    {profileMessage && (
                      <p className="text-sm text-purple-300">
                        {profileMessage}
                      </p>
                    )}
                  </form>
                </div>
              )}
            </div>
          )}

          {/* About */}
          {tab === "About" && (
            <div className="max-w-xl rounded-[30px] border border-white/10 bg-white/[0.06] p-9">
              <h2 className="text-2xl font-semibold">About BillSwipe</h2>
              <p className="mt-4 text-sm leading-7 text-zinc-400">
                BillSwipe is a community sponsorship prototype. Discover
                fictional demo needs and express interest in supporting them.
                No real payments are processed.
              </p>
            </div>
          )}
        </div>

        {/* Right dashboard */}
        <aside className="space-y-5">
          <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.11] to-white/[0.025] p-7 shadow-2xl backdrop-blur-2xl">
            <p className="text-[10px] font-bold tracking-[0.25em] text-zinc-500">
              YOUR ACTIVITY
            </p>

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
              <p className="text-xs font-bold tracking-widest text-purple-200">
                THE EXPERIENCE
              </p>
              <div className="mt-7 space-y-6 text-sm text-zinc-300">
                <p>01 — Discover a need.</p>
                <p>02 — Understand the story.</p>
                <p>03 — Express your support.</p>
                <p>04 — Make an impact.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7">
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
