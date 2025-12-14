import Link from "next/link"
import { MapPin, Compass, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a1a1f] text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a2525] via-[#0a1a1f] to-[#0a1520]" />
      <div className="absolute top-1/4 left-1/3 w-[520px] h-[520px] bg-[#00d4aa]/15 rounded-full blur-[140px]" />
      <div className="absolute bottom-1/4 right-1/3 w-[420px] h-[420px] bg-[#00d4aa]/10 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-20 flex flex-col items-center text-center gap-8">
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 shadow-lg shadow-[#00d4aa]/10">
          <MapPin className="w-5 h-5 text-[#00d4aa]" strokeWidth={1.5} />
          <span className="text-sm text-white/70">You wandered off-route</span>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-[#00d4aa]/15 blur-3xl rounded-full" />
          <div className="relative bg-white/5 border border-white/10 rounded-3xl px-10 py-12 backdrop-blur-xl shadow-2xl shadow-[#00d4aa]/10">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-[#00d4aa]/15 flex items-center justify-center mb-6">
              <Compass className="w-8 h-8 text-[#00d4aa]" strokeWidth={1.5} />
            </div>
            <h1 className="text-4xl font-semibold mb-3">Page not found</h1>
            <p className="text-white/60 text-lg max-w-xl">
              Let&apos;s get you back to places that matter. Choose where you want to go next.
            </p>

            <div className="mt-8 grid sm:grid-cols-3 gap-3">
              <Link href="/app" className="w-full">
                <Button className="w-full h-12 rounded-xl bg-[#00d4aa] text-[#0a1a1f] font-semibold hover:bg-[#00d4aa]/90">
                  Open App
                </Button>
              </Link>
              <Link href="/login" className="w-full">
                <Button variant="outline" className="w-full h-12 rounded-xl border-white/20 text-white hover:bg-white/10">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup" className="w-full">
                <Button variant="ghost" className="w-full h-12 rounded-xl text-white/80 hover:bg-white/10">
                  Create Account
                </Button>
              </Link>
            </div>

            <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mt-6 justify-center">
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
