#!/usr/bin/env node
// Crea (o repara) la cuenta de un vendedor: atiende los chats y las reservas
// desde la app, sin ver caja, ventas ni métricas.
//
//     <usuario>@aurastudio.pe   →   rol `vendedor`
//
// Requiere la migración 0021 ya aplicada. Es idempotente: si la cuenta ya
// existe como vendedor, no la toca (salvo con --reset).
//
// Se ejecuta con la service role (no está en el repo). Desde la carpeta del bot:
//
//     cd bot
//     railway run node ../admin/supabase/scripts/crear-cuenta-vendedor.mjs --usuario=ventas --nombre="Ventas"
//
// Opciones:
//     --usuario=ventas   parte antes de la @ (por defecto «ventas»)
//     --nombre="Ventas"  cómo se muestra (por defecto «Ventas»)
//     --reset            genera una contraseña nueva para una cuenta ya creada
//     --dry-run          muestra qué haría, sin tocar nada
//
// La contraseña NUNCA se imprime: va a un archivo solo-lectura-del-dueño en
// ~/Documents, junto a las de las profesionales.

import { createClient } from "@supabase/supabase-js"
import { randomInt } from "node:crypto"
import { appendFileSync, chmodSync, existsSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const DOMINIO = "aurastudio.pe"
const ARCHIVO = process.env.ACCESOS_ARCHIVO || join(homedir(), "Documents", "Aura Studio - Accesos del equipo.txt")

const args = process.argv.slice(2)
const valor = (nombre) => args.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3).trim()
const dryRun = args.includes("--dry-run")
const reset = args.includes("--reset")
const usuario = (valor("usuario") ?? "ventas").toLowerCase().replace(/[^a-z0-9._-]/g, "")
const nombre = valor("nombre") ?? "Ventas"
const email = `${usuario}@${DOMINIO}`

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Corre esto con `railway run` desde la carpeta bot.")
  process.exit(1)
}
if (!usuario) {
  console.error("El usuario quedó vacío: usa letras, números, punto o guion.")
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

// Sin 0/O, 1/l/I: se dictan por teléfono y se leen en un papel.
const ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789"
function contrasenaNueva() {
  const grupo = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("")
  return `${grupo()}-${grupo()}-${grupo()}`
}

async function buscarUsuario() {
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 200 })
    if (error) throw new Error(`No se pudo listar usuarios: ${error.message}`)
    const hallado = data.users.find((u) => u.email?.toLowerCase() === email)
    if (hallado) return hallado
    if (data.users.length < 200) return null
  }
}

function guardarAcceso(password, nota) {
  const fecha = new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })
  const bloque = `\n── ${fecha} ──\n\n${nombre} (vendedor)\n  Usuario:    ${email}   (basta escribir «${usuario}»)\n  Contraseña: ${password}\n  (${nota})\n`
  if (existsSync(ARCHIVO)) appendFileSync(ARCHIVO, bloque, { mode: 0o600 })
  else {
    writeFileSync(
      ARCHIVO,
      `AURA STUDIO — Accesos del equipo\nEntrar en: https://admin.aurastudio.pe  (se instala como app desde el celular)\nEste archivo tiene contraseñas: no lo compartas por un chat abierto y bórralo cuando ya las hayan cambiado.\n${bloque}`,
      { mode: 0o600 },
    )
  }
  chmodSync(ARCHIVO, 0o600)
}

async function main() {
  // La migración 0021 crea puede_atender(). Si no existe, PostgREST responde PGRST202.
  const pre = await sb.rpc("puede_atender")
  if (pre.error?.code === "PGRST202") {
    console.error("Falta aplicar la migración 0021_rol_vendedor_y_leads.sql en el SQL editor de Supabase. No se hizo nada.")
    process.exit(1)
  }

  const existente = await buscarUsuario()

  if (existente) {
    const { data: perfil } = await sb.from("profiles").select("role").eq("id", existente.id).maybeSingle()
    if (perfil?.role === "staff" || perfil?.role === "profesional") {
      // Nunca se degrada una cuenta de administración o de una profesional por un choque de nombres.
      console.error(`✗ ${email} ya es una cuenta de ${perfil.role}. No se toca; elige otro --usuario.`)
      process.exit(1)
    }
    if (perfil?.role === "vendedor" && !reset) {
      console.log(`= ${email}: ya es vendedor (usa --reset para darle una contraseña nueva)`)
      return
    }
    if (dryRun) {
      console.log(`· ${email}: ${perfil?.role === "vendedor" ? "se le generaría una contraseña nueva" : "pasaría a vendedor, con contraseña nueva"}`)
      return
    }
    const password = contrasenaNueva()
    const { error: eClave } = await sb.auth.admin.updateUserById(existente.id, { password, email_confirm: true })
    if (eClave) throw new Error(`No se pudo cambiar la contraseña: ${eClave.message}`)
    const { error: eRol } = await sb.from("profiles").update({ role: "vendedor", full_name: nombre }).eq("id", existente.id)
    if (eRol) throw new Error(`No se pudo dar el rol: ${eRol.message}`)
    guardarAcceso(password, "contraseña restablecida")
    console.log(`✓ ${email}: contraseña restablecida`)
  } else {
    if (dryRun) {
      console.log(`· ${email}: se crearía la cuenta de vendedor`)
      return
    }
    const password = contrasenaNueva()
    const { data: creado, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // no existe el buzón: sin esto nunca podría entrar
      user_metadata: { full_name: nombre },
    })
    if (error || !creado?.user) throw new Error(`No se pudo crear: ${error?.message ?? "sin detalle"}`)
    const { error: eRol } = await sb.from("profiles").update({ role: "vendedor", full_name: nombre }).eq("id", creado.user.id)
    const { data: perfil } = await sb.from("profiles").select("role").eq("id", creado.user.id).maybeSingle()
    if (eRol || perfil?.role !== "vendedor") {
      // No dejar un usuario a medias: sin rol no le sirve a nadie.
      await sb.auth.admin.deleteUser(creado.user.id)
      console.error("✗ Se revirtió la creación (¿está aplicada la migración 0021?).")
      process.exit(1)
    }
    guardarAcceso(password, "cuenta nueva")
    console.log(`✓ ${email}: cuenta de vendedor creada`)
  }
  console.log(`\nContraseña guardada en: ${ARCHIVO}\nNo se muestra aquí. Debe cambiarla al entrar por primera vez.`)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
