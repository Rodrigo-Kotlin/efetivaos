import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { Logo } from '@/components/shared/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { signInWithPassword } from '@/features/auth/auth.service'
import { isSupabaseConfigured } from '@/lib/env'

const schema = z.object({
  email: z.email('Informe um e-mail valido.'),
  password: z.string().min(1, 'Informe sua senha.'),
})

type LoginData = z.infer<typeof schema>

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginData>({ resolver: zodResolver(schema) })

  if (session) return <Navigate to={destination} replace />

  const onSubmit = handleSubmit(async (data) => {
    setAuthError(null)
    try {
      await signInWithPassword(data.email, data.password)
      navigate(destination, { replace: true })
    } catch {
      setAuthError('E-mail ou senha invalidos. Verifique os dados e tente novamente.')
    }
  })

  return (
    <main className="grid min-h-dvh bg-[#f4f6f3] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-emerald-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 size-[34rem] rounded-full border border-white/10" />
        <div className="absolute -right-16 -top-16 size-[24rem] rounded-full border border-lime-300/20" />
        <Logo className="relative [&_strong]:text-white [&_span_span]:text-emerald-100" />
        <div className="relative max-w-xl pb-12">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.25em] text-lime-300">Operacao centralizada</p>
          <h1 className="font-serif text-5xl font-semibold leading-[1.08]">Decisoes administrativas com contexto e rastreabilidade.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-emerald-100/80">
            Uma base segura para organizar custos, operacao e crescimento da Efetiva SST.
          </p>
        </div>
        <div className="relative flex items-center gap-3 text-sm text-emerald-100/70">
          <ShieldCheck className="size-5 text-lime-300" />
          Acesso interno protegido por perfil e politicas de banco.
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <Logo className="mb-12 lg:hidden" />
          <div className="mb-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">Area interna</p>
            <h2 className="font-serif text-4xl font-semibold text-slate-950">Acesse o Efetiva OS</h2>
            <p className="mt-3 text-slate-600">Use suas credenciais corporativas para continuar.</p>
          </div>

          {!isSupabaseConfigured && (
            <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
              A conexao ainda nao foi configurada. Defina as variaveis publicas do Supabase.
            </div>
          )}

          <form className="space-y-5" onSubmit={onSubmit} noValidate>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="email">E-mail</label>
              <Input id="email" type="email" autoComplete="email" placeholder="nome@efetivasst.com.br" aria-invalid={Boolean(errors.email)} {...register('email')} />
              {errors.email && <p className="mt-1.5 text-sm text-red-700">{errors.email.message}</p>}
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="password">Senha</label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="pr-12" aria-invalid={Boolean(errors.password)} {...register('password')} />
                <button type="button" className="absolute right-1 top-1 grid size-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-sm text-red-700">{errors.password.message}</p>}
            </div>
            {authError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{authError}</div>}
            <Button className="h-12 w-full" type="submit" disabled={isSubmitting || !isSupabaseConfigured}>
              {isSubmitting ? 'Entrando...' : 'Entrar'}
              {!isSubmitting && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
            <LockKeyhole className="size-3.5" /> Sessao protegida e persistida com Supabase Auth
          </p>
        </div>
      </section>
    </main>
  )
}
