"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, MapPin, Eye, EyeOff, CheckCircle } from "lucide-react"

export default function ResetPasswordConfirmPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        setError("")
      }
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [supabase])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match")
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    
    setTimeout(() => {
      router.push("/app")
    }, 2000)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 pt-16 relative overflow-hidden bg-[#0a1a1f] safe-inset">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a2525] via-[#0a1a1f] to-[#0a1520]" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-[#00d4aa]/20 rounded-full blur-[120px]" />

        <div className="w-full max-w-md relative z-10">
          <div className="bg-[#0d2428]/80 backdrop-blur-xl rounded-3xl p-8 border border-[#00d4aa]/20 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#00d4aa]/20 mb-4">
              <CheckCircle className="w-8 h-8 text-[#00d4aa]" />
            </div>
            <h2 className="text-2xl font-semibold mb-3 text-white">Password updated!</h2>
            <p className="text-white/60 mb-6">
              Your password has been reset successfully. Redirecting to app...
            </p>
          </div>
        </div>
      </div>
    )
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
          <p className="text-[#00d4aa]/70 text-base">Create a new password</p>
        </div>

        <div className="bg-[#0d2428]/80 backdrop-blur-xl rounded-3xl p-8 border border-[#00d4aa]/20">
          <h2 className="text-2xl font-semibold mb-6 text-center text-white">Reset Password</h2>
          
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#00d4aa]/80 text-base">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 bg-[#0a1a1f]/80 border-[#00d4aa]/20 rounded-xl text-white placeholder:text-white/30 focus:border-[#00d4aa]/50 focus:ring-[#00d4aa]/20 text-base pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 flex items-center text-white/60 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[#00d4aa]/80 text-base">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 bg-[#0a1a1f]/80 border-[#00d4aa]/20 rounded-xl text-white placeholder:text-white/30 focus:border-[#00d4aa]/50 focus:ring-[#00d4aa]/20 text-base pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 flex items-center text-white/60 hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-white/50 text-base">
              Remember your password?{" "}
              <Link href="/login" className="text-[#00d4aa] hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
