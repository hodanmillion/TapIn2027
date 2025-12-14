"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, MapPin, Users, Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push("/app/nearby")
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pt-16 relative overflow-hidden bg-[#0a1a1f] safe-inset">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a2525] via-[#0a1a1f] to-[#0a1520]" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-[#00d4aa]/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/3 left-1/4 w-[300px] h-[300px] bg-[#00d4aa]/10 rounded-full blur-[100px]" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <div className="relative inline-flex items-center justify-center w-24 h-24 mb-4">
            <div className="absolute inset-0 bg-[#00d4aa]/20 rounded-full blur-xl animate-pulse" />
            <div className="absolute inset-2 bg-[#00d4aa]/10 rounded-full" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#0a2525] to-[#0a1a1f] border border-[#00d4aa]/30 flex items-center justify-center">
              <MapPin className="w-10 h-10 text-[#00d4aa]" strokeWidth={1.5} />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">TapIn</h1>
          <p className="text-[#00d4aa]/70 text-base">Walk in. You&apos;re in.</p>
        </div>

        <div className="bg-[#0d2428]/80 backdrop-blur-xl rounded-3xl p-8 border border-[#00d4aa]/20">
          <h2 className="text-2xl font-semibold mb-6 text-center text-white">Welcome back</h2>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#00d4aa]/80 text-base">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-[#0a1a1f]/80 border-[#00d4aa]/20 rounded-xl text-white placeholder:text-white/30 focus:border-[#00d4aa]/50 focus:ring-[#00d4aa]/20 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#00d4aa]/80 text-base">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 bg-[#0a1a1f]/80 border-[#00d4aa]/20 rounded-xl text-white placeholder:text-white/30 focus:border-[#00d4aa]/50 focus:ring-[#00d4aa]/20 text-base pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 flex items-center text-white/60 hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 p-3 rounded-xl">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-[#00d4aa] hover:bg-[#00d4aa]/90 text-[#0a1a1f] font-semibold shadow-lg shadow-[#00d4aa]/25 text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-[#0a1a1f]/50 rounded-xl border border-[#00d4aa]/10">
            <div className="flex items-center gap-2 text-[#00d4aa]/80 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">Find Friends</span>
            </div>
            <p className="text-white/50 text-sm">
              Once signed in, search for users by username to add friends and start connecting!
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-white/50 text-base">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-[#00d4aa] hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}