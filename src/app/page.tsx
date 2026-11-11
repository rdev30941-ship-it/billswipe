
"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type Bill = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  amount: number;
  currency: string;
  status: string;
  created_at?: string;
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
  Other: "💜",
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";
}

export default function Home() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [index, setIndex] = useState(0);
  const [supported, setSupported] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [history, setHistory] = useState<SwipeRecord[]>([]);
  const [submissions, setSubmissions] = useState<Bill[]>([]);
  const [pendingBills, setPendingBills] = useState<Bill[]>([]);
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

  // Create bill
  const [billTitle, setBillTitle] = useState("");
  const [billDescription, setBillDescription] = useState("");
  const [billCategory, setBillCategory] = useState("Education");
  const [billAmount, setBillAmount] = useState("");
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState("");

  // Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecking, setAdminChecking] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [pendingLoading, setPendingLoading] = useState(false);
  const [moderatingId, setModeratingId] = useState("");
  const [moderationMessage, setModerationMessage] = useState("");

  const inputClass =
    "w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-zinc-600 focus:border-purple-400";

  // Register PWA service worker
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .then(() => console.log("BillSwipe service worker registered."))
      .catch((err) =>
        console.error("Service worker registration failed:", err)
      );
  }, []);

  // Authentication session
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserId(data.session?.user.id || "");
      setUserEmail(data.session?.user.email || "");
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user.id || "");
        setUserEmail(session?.user.email || "");
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Check admin permissions
  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      if (!userId) {
        setIsAdmin(false);
        setAdminChecking(false);
        return;
      }

      setAdminChecking(true);

      const { data, error } = await supabase.rpc("is_admin");

      if (!active) return;

      if (error) {
        setIsAdmin(false);
        setAdminError(error.message);
      } else {
        setIsAdmin(data === true);
        setAdminError("");
      }

      setAdminChecking(false);
    }

    checkAdmin();

    return () => {
      active = false;
    };
  }, [userId]);

  // Fetch public bills
  useEffect(() => {
    let active = true;

    async function loadBills() {
      const { data, error } = await supabase
        .from("bills")
        .select("id, title, description, category, amount, currency, status, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        setError(error.message);
      } else {
        setBills((data || []) as Bill[]);
      }

      setLoading(false);
    }

    loadBills();

    return () => {
      active = false;
    };
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

      const fallback = userEmail.split("@")[0] || "User";

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;

      const name = error
        ? fallback
        : data?.display_name || fallback;

      setProfileName(name);
      setProfileDraft(name);

      if (error) setProfileMessage(error.message);

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
        records.filter((item) => item.action === "support")
          .map((item) => item.bill_id)
      );
      setSkipped(
        records.filter((item) => item.action === "skip")
          .map((item) => item.bill_id)
      );
    }

    loadActivity();

    return () => {
      active = false;
    };
  }, [userId]);

  // Fetch user's submissions
  useEffect(() => {
    let active = true;

    async function loadSubmissions() {
      if (!userId) {
        setSubmissions([]);
        return;
      }

      const { data, error } = await supabase
        .from("bills")
        .select("id, title, description, category, amount, currency, status, created_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (!error) setSubmissions((data || []) as Bill[]);
    }

    loadSubmissions();

    return () => {
      active = false;
    };
  }, [userId]);

  // Fetch pending submissions for admin
  useEffect(() => {
    let active = true;

    async function loadPending() {
      if (!isAdmin) {
        setPendingBills([]);
        return;
      }

      setPendingLoading(true);

      const { data, error } = await supabase
        .from("bills")
        .select("id, title, description, category, amount, currency, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (!active) return;

      if (error) {
        setAdminError(error.message);
      } else {
        setPendingBills((data || []) as Bill[]);
        setAdminError("");
      }

      setPendingLoading(false);
    }

    loadPending();

    return () => {
      active = false;
    };
  }, [isAdmin]);

  const current = bills[index];

  // Email sign-in
  async function handleSignIn(e: FormEvent<HTMLFormElement>) {
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
  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const name = profileDraft.trim();

    if (!userId) return;

    if (!name || name.length > 40) {
      setProfileMessage("Enter a name between 1 and 40 characters.");
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

  // Create a fictional demo bill
  async function createBill(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!userId) return;

    const title = billTitle.trim();
    const description = billDescription.trim();
    const amount = Number(billAmount);

    if (title.length < 3 || title.length > 80) {
      setSubmissionMessage("Title must be between 3 and 80 characters.");
      return;
    }

    if (description.length < 10 || description.length > 400) {
      setSubmissionMessage("Description must be between 10 and 400 characters.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
      setSubmissionMessage("Enter a valid amount.");
      return;
    }

    setSubmissionLoading(true);
    setSubmissionMessage("");

    try {
      const { data, error } = await supabase
        .from("bills")
        .insert({
          title,
          description,
          category: billCategory,
          amount,
          currency: "INR",
          status: "pending",
          owner_id: userId,
        })
        .select("id, title, description, category, amount, currency, status, created_at")
        .single();

      if (error) {
        setSubmissionMessage(error.message);
        return;
      }

      setSubmissions((old) => [data as Bill, ...old]);

      if (isAdmin) {
        setPendingBills((old) => [data as Bill, ...old]);
      }

      setBillTitle("");
      setBillDescription("");
      setBillCategory("Education");
      setBillAmount("");

      setSubmissionMessage("Submitted successfully for admin review!");
    } catch {
      setSubmissionMessage("Submission failed. Please try again.");
    } finally {
      setSubmissionLoading(false);
    }
  }

  // Persistent Support / Skip
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

      if (action === "support") {
        setSupported((old) => [
          ...old.filter((id) => id !== current.id),
          current.id,
        ]);
        setSkipped((old) => old.filter((id) => id !== current.id));
      } else {
        setSkipped((old) => [
          ...old.filter((id) => id !== current.id),
          current.id,
        ]);
        setSupported((old) => old.filter((id) => id !== current.id));
      }

      if (data) {
        const record = data as unknown as SwipeRecord;

        setHistory((old) =>
          [record, ...old.filter((item) => item.bill_id !== current.id)]
            .sort(
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

  function replayBills() {
    setIndex(0);
    setTab("Discover");
    setAuthMessage("");
  }

  // Admin moderation
  async function moderateBill(
    bill: Bill,
    decision: "open" | "rejected"
  ) {
    if (!isAdmin || moderatingId) return;

    setModeratingId(bill.id);
    setModerationMessage("");

    const { data, error } = await supabase
      .from("bills")
      .update({ status: decision })
      .eq("id", bill.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error) {
      setModerationMessage(error.message);
      setModeratingId("");
      return;
    }

    if (!data) {
      setModerationMessage("This submission has already been reviewed.");
      setModeratingId("");
      return;
    }

    setPendingBills((old) =>
      old.filter((item) => item.id !== bill.id)
    );

    setSubmissions((old) =>
      old.map((item) =>
        item.id === bill.id ? { ...item, status: decision } : item
      )
    );

    if (decision === "open") {
      setBills((old) => [
        { ...bill, status: "open" },
        ...old.filter((item) => item.id !== bill.id),
      ]);
      setModerationMessage("Approved and published to Discover!");
    } else {
      setModerationMessage("Submission rejected.");
    }

    setModeratingId("");
  }

  const navItems = [
    "Discover",
    "Create a bill",
    "My submissions",
    "My activity",
    "Profile",
    ...(isAdmin ? ["Admin"] : []),
    "About",
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090810] text-white selection:bg-purple-500/40">

      {/* Ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-purple-700/20 blur-[130px]" />
        <div className="absolute -right-40 top-80 h-96 w-96 rounded-full bg-violet-500/20 blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#090810]/85 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">

          <button
            onClick={() => setTab("Discover")}
            className="text-2xl font-black tracking-tight"
          >
            BILL<span className="bg-gradient-to-r from-violet-300 to-purple-500 bg-clip-text text-transparent">SWIPE</span>
          </button>

          <nav className="flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            {navItems.map((item) => (
              <button
                key={item}
                onClick={() => {
                  setTab(item);
                  setSubmissionMessage("");
                  setModerationMessage("");
                }}
                className={`rounded-full px-3 py-2 text-xs transition sm:px-4 sm:text-sm ${
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
                className="w-32 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 sm:w-40"
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

      {/* Main content */}
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

                    {history.some((item) => item.bill_id === current.id) && (
                      <p className="mt-5 text-center text-xs text-purple-300">
                        Previously swiped · Replay updates existing activity.
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

          {/* Create a bill */}
          {tab === "Create a bill" && (
            <div className="max-w-xl space-y-6">
              <div>
                <p className="text-xs font-bold tracking-[0.25em] text-purple-300">
                  NEW SUBMISSION
                </p>
                <h2 className="mt-3 text-3xl font-semibold">
                  Create a demo bill
                </h2>
                <p className="mt-2 text-sm leading-7 text-zinc-400">
                  Submit a fictional sponsorship request for review.
                </p>
              </div>

              {!userId ? (
                <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-8">
                  Please sign in before creating a submission.
                </div>
              ) : (
                <form onSubmit={createBill} className="space-y-5 rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.08] to-purple-500/[0.05] p-7">
                  <div>
                    <label className="mb-2 block text-sm text-zinc-300">
                      Bill title
                    </label>
                    <input
                      required
                      minLength={3}
                      maxLength={80}
                      value={billTitle}
                      onChange={(e) => setBillTitle(e.target.value)}
                      placeholder="e.g. Learning resources"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-zinc-300">
                      Description
                    </label>
                    <textarea
                      required
                      minLength={10}
                      maxLength={400}
                      rows={4}
                      value={billDescription}
                      onChange={(e) => setBillDescription(e.target.value)}
                      placeholder="Describe this fictional demo request..."
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-zinc-300">
                      Category
                    </label>
                    <select
                      value={billCategory}
                      onChange={(e) => setBillCategory(e.target.value)}
                      className={inputClass}
                    >
                      <option value="Education">Education</option>
                      <option value="Medical">Medical</option>
                      <option value="Technology">Technology</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-zinc-300">
                      Required amount (INR)
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="1000000"
                      step="1"
                      value={billAmount}
                      onChange={(e) => setBillAmount(e.target.value)}
                      placeholder="Enter amount"
                      className={inputClass}
                    />
                  </div>

                  <div className="rounded-2xl border border-purple-300/15 bg-purple-500/10 p-4 text-xs leading-6 text-purple-200">
                    Demo only. Don't enter real financial or identity
                    documents. No actual payments are processed.
                  </div>

                  <button
                    type="submit"
                    disabled={submissionLoading}
                    className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 py-4 font-semibold disabled:opacity-50"
                  >
                    {submissionLoading ? "Submitting..." : "Submit for review"}
                  </button>

                  {submissionMessage && (
                    <p className="text-sm text-purple-300">
                      {submissionMessage}
                    </p>
                  )}
                </form>
              )}
            </div>
          )}

          {/* My submissions */}
          {tab === "My submissions" && (
            <div className="max-w-xl space-y-6">
              <h2 className="text-3xl font-semibold">My submissions</h2>

              {!userId ? (
                <p className="text-sm text-zinc-400">Please sign in.</p>
              ) : submissions.length === 0 ? (
                <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-8 text-center">
                  <p>No submissions yet.</p>
                  <button
                    onClick={() => setTab("Create a bill")}
                    className="mt-5 rounded-xl bg-purple-500 px-5 py-3 text-sm font-semibold"
                  >
                    Create a demo bill
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[25px] border border-white/10 bg-white/[0.05] p-6"
                    >
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="mt-3 text-sm text-zinc-400">
                        {item.description}
                      </p>
                      <div className="mt-4 flex justify-between text-sm">
                        <span>{item.category}</span>
                        <span>{money(Number(item.amount), item.currency)}</span>
                      </div>
                      <p className="mt-3 text-xs text-purple-300">
                        Status: {item.status === "open" ? "Approved" : item.status}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* My activity */}
          {tab === "My activity" && (
            <div className="max-w-xl space-y-6">
              <h2 className="text-3xl font-semibold">Your activity</h2>

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
                  <p className="text-sm text-zinc-400">Sign in to see activity.</p>
                ) : history.length === 0 ? (
                  <p className="text-sm text-zinc-400">No activity yet.</p>
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
                              {money(Number(item.bill.amount), item.bill.currency)}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-xs text-purple-200">
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
              <h2 className="text-3xl font-semibold">My profile</h2>

              {!userId ? (
                <p className="text-zinc-400">Please sign in.</p>
              ) : profileLoading ? (
                <p className="text-zinc-400">Loading profile...</p>
              ) : (
                <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.09] to-purple-500/[0.06] p-7">
                  <div className="flex items-center gap-5 border-b border-white/10 pb-7">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-purple-300/40 bg-gradient-to-br from-violet-400 to-purple-700 text-2xl font-bold">
                      {initials(profileName || userEmail)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-semibold">
                        {profileName || "BillSwipe User"}
                      </h3>
                      <p className="mt-1 truncate text-sm text-zinc-400">
                        {userEmail}
                      </p>
                    </div>
                  </div>

                  <form onSubmit={saveProfile} className="mt-7 space-y-5">
                    <div>
                      <label className="mb-2 block text-sm text-zinc-300">
                        Display name
                      </label>
                      <input
                        required
                        maxLength={40}
                        value={profileDraft}
                        onChange={(e) => setProfileDraft(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-zinc-300">
                        Email address
                      </label>
                      <input
                        readOnly
                        value={userEmail}
                        className={`${inputClass} text-zinc-400`}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 py-4 font-semibold disabled:opacity-50"
                    >
                      {profileSaving ? "Saving..." : "Save profile"}
                    </button>

                    {profileMessage && (
                      <p className="text-sm text-purple-300">{profileMessage}</p>
                    )}
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Admin */}
          {tab === "Admin" && (
            <div className="max-w-2xl space-y-6">
              <div>
                <p className="text-xs font-bold tracking-[0.25em] text-purple-300">
                  PRIVATE ADMIN AREA
                </p>
                <h2 className="mt-3 text-3xl font-semibold">
                  Moderation dashboard
                </h2>
              </div>

              {!userId ? (
                <p className="text-zinc-400">Please sign in first.</p>
              ) : adminChecking ? (
                <p className="text-zinc-400">Checking admin permissions...</p>
              ) : !isAdmin ? (
                <div className="rounded-[28px] border border-red-400/20 bg-red-500/10 p-8 text-red-200">
                  Admin access denied.
                  {adminError && <p className="mt-3 text-sm">{adminError}</p>}
                </div>
              ) : (
                <>
                  <div className="rounded-3xl border border-purple-300/20 bg-purple-500/10 p-6">
                    <p className="text-xs font-bold tracking-widest text-purple-200">
                      PENDING REVIEW
                    </p>
                    <p className="mt-2 text-4xl font-semibold">
                      {pendingBills.length}
                    </p>
                  </div>

                  {adminError && (
                    <p className="text-sm text-red-300">{adminError}</p>
                  )}

                  {moderationMessage && (
                    <p className="text-sm text-purple-300">{moderationMessage}</p>
                  )}

                  {pendingLoading ? (
                    <p className="text-zinc-400">Loading submissions...</p>
                  ) : pendingBills.length === 0 ? (
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-10 text-center">
                      <p className="text-xl font-semibold">All caught up!</p>
                      <p className="mt-2 text-sm text-zinc-400">
                        No pending submissions.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {pendingBills.map((bill) => (
                        <div
                          key={bill.id}
                          className="rounded-[28px] border border-white/10 bg-white/[0.05] p-6"
                        >
                          <h3 className="text-xl font-semibold">{bill.title}</h3>
                          <p className="mt-2 text-sm text-zinc-400">
                            {bill.description}
                          </p>
                          <p className="mt-4 text-2xl font-semibold">
                            {money(Number(bill.amount), bill.currency)}
                          </p>
                          <p className="mt-2 text-xs text-zinc-500">
                            {bill.category} · Pending
                          </p>

                          <div className="mt-6 grid grid-cols-2 gap-3">
                            <button
                              disabled={!!moderatingId}
                              onClick={() => moderateBill(bill, "rejected")}
                              className="rounded-xl border border-red-300/20 bg-red-500/10 py-3 text-sm text-red-200 disabled:opacity-50"
                            >
                              {moderatingId === bill.id ? "Updating..." : "Reject"}
                            </button>
                            <button
                              disabled={!!moderatingId}
                              onClick={() => moderateBill(bill, "open")}
                              className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 py-3 text-sm font-semibold disabled:opacity-50"
                            >
                              {moderatingId === bill.id ? "Updating..." : "Approve"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
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
