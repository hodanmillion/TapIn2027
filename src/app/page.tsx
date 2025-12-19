"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { getApiUrl } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MapPin, Users, MessageCircle, Flame, QrCode, Heart, Shield, ArrowRight, Loader2, CheckCircle2 } from "lucide-react"

export default function Home() {
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [waitlistError, setWaitlistError] = useState("")
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error?.message?.toLowerCase().includes("refresh token not found")) {
        await supabase.auth.signOut().catch(() => {})
      }

      if (user) {
        router.push("/app")
      } else {
        setChecking(false)
      }
    }
    checkAuth()
  }, [supabase, router])

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setWaitlistError("")
    
    const res = await fetch(getApiUrl("/api/waitlist"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    
    const data = await res.json()
    setSubmitting(false)
    
    if (res.ok) {
      setSubmitted(true)
    } else {
      setWaitlistError(data.error)
    }
  }

  if (checking) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center safe-inset">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative min-h-[100dvh] bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white overflow-hidden safe-inset">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/15 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent/15 rounded-full blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />

      <header className="relative z-10 max-w-6xl mx-auto safe-top safe-horizontal">
        <nav className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center glow-primary">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold gradient-text">TapIn</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="rounded-xl font-medium">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="rounded-xl bg-primary hover:bg-primary/90 font-medium glow-primary">
                Get Started
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-32">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border/50 mb-8">
            <MapPin className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium">Real-time location-based connections</span>
          </div>
          
          <h1 className="text-5xl sm:text-7xl font-bold mb-6 leading-tight">
            <span className="gradient-text">Walk in.</span> You&apos;re in.
            <br />
            <span className="text-foreground">Leave.</span> <span className="text-muted-foreground">You&apos;re out.</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-10 max-w-xl mx-auto">
            TapIn instantly connects you with everyone at your location. 
            Gyms, cafés, libraries, events — zero friction, zero noise, zero commitment.
          </p>

          <div className="glass rounded-3xl p-8 border border-border/50 max-w-md mx-auto mb-10">
            {submitted ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold">You&apos;re on the list!</h3>
                <p className="text-muted-foreground">We&apos;ll notify you when we launch.</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-2">Join the Waitlist</h3>
                <p className="text-muted-foreground text-sm mb-4">Be the first to know when we launch.</p>
                <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 rounded-xl bg-secondary/50 border-border/50 flex-1"
                  />
                  <Button 
                    type="submit" 
                    disabled={submitting}
                    className="h-12 px-6 rounded-xl bg-primary hover:bg-primary/90 font-semibold glow-primary"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Join"}
                  </Button>
                </form>
                {waitlistError && (
                  <p className="text-sm text-red-400 mt-3">{waitlistError}</p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="h-14 px-8 rounded-2xl bg-primary hover:bg-primary/90 font-semibold text-lg glow-primary">
                Start Connecting
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="h-14 px-8 rounded-2xl border-border/50 font-semibold text-lg">
                I have an account
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-20">
          <FeatureCard
            icon={<MessageCircle className="w-6 h-6" />}
            title="Auto-Generated Chats"
            description="Walk into any location and join the chat instantly. Gyms, cafés, campuses — you're automatically connected."
          />
          <FeatureCard
            icon={<Shield className="w-6 h-6" />}
            title="Anonymous by Default"
            description="Stay anonymous until you choose otherwise. Reveal your identity only when you want to."
          />
          <FeatureCard
            icon={<Flame className="w-6 h-6" />}
            title="Live Heat Maps"
            description="See which places are buzzing right now. Find where the action is in real-time."
          />
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <FeatureCard
            icon={<QrCode className="w-6 h-6" />}
            title="QR Check-Ins"
            description="Scan a venue's QR code to instantly join the conversation. Perfect for events and businesses."
          />
          <FeatureCard
            icon={<Heart className="w-6 h-6" />}
            title="Missed Connections"
            description="Were you both at the same place but didn't talk? TapIn can help you reconnect afterward."
          />
          <FeatureCard
            icon={<Users className="w-6 h-6" />}
            title="Real People, Real Places"
            description="No followers, no likes, no profiles. Just real-time connections with people around you."
          />
        </div>

        <div className="mt-24 text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 gradient-text">The social layer of physical spaces</h2>
          <p className="text-muted-foreground">
            At the gym? Ask who&apos;s free for a spot. At campus? Find study groups near you. 
            At a café? Meet local founders. TapIn connects you to right now, not yesterday.
          </p>
        </div>
      </main>

      <footer className="relative z-10 text-center py-8 text-muted-foreground text-sm">
        <p>Real people. Real places. Real time.</p>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="glass rounded-3xl p-6 border border-border/50 hover:glow-primary transition-all">
      <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  )
}