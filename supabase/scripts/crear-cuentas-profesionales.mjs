#!/usr/bin/env node
// Crea (o repara) la cuenta de acceso de cada profesional activa:
//
//     <primer nombre>@aurastudio.pe   →   rol `profesional`, enlazada a su fila
//
// Requiere la migración 0020 ya aplicada. Es idempotente: las que ya tienen
// cuenta se saltan, y volver a correrlo solo completa lo que falte.
//
// Se ejecuta con la service role (no está en el repo). Desde la carpeta del bot,
// que ya la tiene en Railway:
//
//     cd bot
//     railway run node ../admin/supabase/scripts/crear-cuentas-profesionales.mjs --dry-run
//     railway run node ../admin/supabase/scripts/crear-cuentas-profesionales.mjs
//
// Opciones:
//     --dry-run        muestra qué haría, sin tocar nada
//     --reset=laura    genera una contraseña nueva para UNA cuenta ya creada
//                      (para cuando alguien la olvida: no hay correo de recuperación)
//
// Las contraseñas NUNCA se imprimen: van a un archivo solo-lectura-del-dueño en
// ~/Documents. Se generan al azar; cada quien la cambia desde la app.

import { createClient } from "@supabase/supabase-js"
import { randomInt } from "node:crypto"
import { appendFileSync, chmodSync, existsSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const DOMINIO = "aurastudio.pe"
const ARCHIVO = process.env.ACCESOS_ARCHIVO || join(homedir(), "Documents", "Aura Studio - Accesos del equipo.txt")

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const reset = args.find((a) => a.startsWith("--reset="))?.slice("--reset=".length).trim().toLowerCase() || null

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Corre esto con `railway run` desde la carpeta bot.")
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

// Sin 0/O, 1/l/I: se dictan por teléfono y se leen en un papel.
const ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789"
function contrasenaNueva() {
  const grupo = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("")
  return `${grupo()}-${grupo()}-${grupo()}`
}

/** «María José Pérez» → «maria». Solo a-z: es la parte local de un correo. */
function primerNombre(nombre) {
  return (nombre ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)[0]
    .replace(/[^a-z]/g, "")
}

async function todosLosUsuarios() {
  const usuarios = []
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 200 })
    if (error) throw new Error(`No se pudo listar usuarios: ${error.message}`)
    usuarios.push(...data.users)
    if (data.users.length < 200) return usuarios
  }
}

async function main() {
  // La migración 0020 crea mi_profesional_id(). Si no existe, PostgREST responde
  // PGRST202; cualquier otro error (p. ej. permiso denegado) significa que sí está.
  const pre = await sb.rpc("mi_profesional_id")
  if (pre.error?.code === "PGRST202") {
    console.error("Falta aplicar la migración 0020_rol_profesional.sql en el SQL editor de Supabase. No se hizo nada.")
    process.exit(1)
  }

  const { data: profesionales, error } = await sb
    .from("profesionales")
    .select("id,slug,nombre,user_id,activa")
    .eq("activa", true)
    .order("sort_order")
  if (error) throw new Error(`No se pudieron leer las profesionales: ${error.message}`)

  // Dos con el mismo primer nombre chocarían en el correo: se avisa en vez de
  // adivinar cuál se queda con él.
  const porUsuario = new Map()
  for (const p of profesionales) {
    const u = primerNombre(p.nombre)
    porUsuario.set(u, [...(porUsuario.get(u) ?? []), p])
  }

  const usuariosAuth = await todosLosUsuarios()
  const porEmail = new Map(usuariosAuth.map((u) => [u.email?.toLowerCase(), u]))

  const nuevas = [] // { nombre, email, password, nota }
  const informe = []

  for (const p of profesionales) {
    const usuario = primerNombre(p.nombre)
    const email = `${usuario}@${DOMINIO}`
    const etiqueta = `${p.nombre} <${email}>`

    if (reset && usuario !== reset) continue

    if (!usuario) {
      informe.push(`✗ ${p.nombre}: no se pudo sacar un primer nombre válido`)
      continue
    }
    if (porUsuario.get(usuario).length > 1) {
      informe.push(`✗ ${etiqueta}: otra profesional activa comparte el primer nombre; elige el correo a mano`)
      continue
    }

    const existente = porEmail.get(email)

    // ── Contraseña nueva para una cuenta ya creada ──────────────────────────
    if (reset) {
      if (!p.user_id || !existente || existente.id !== p.user_id) {
        informe.push(`✗ ${etiqueta}: no tiene una cuenta enlazada; córrelo sin --reset primero`)
        continue
      }
      if (dryRun) {
        informe.push(`· ${etiqueta}: se le generaría una contraseña nueva`)
        continue
      }
      const password = contrasenaNueva()
      const { error: e } = await sb.auth.admin.updateUserById(existente.id, { password })
      if (e) {
        informe.push(`✗ ${etiqueta}: no se pudo cambiar la contraseña (${e.message})`)
        continue
      }
      nuevas.push({ nombre: p.nombre, email, password, nota: "contraseña restablecida" })
      informe.push(`✓ ${etiqueta}: contraseña restablecida`)
      continue
    }

    // ── Ya está todo: no se toca ───────────────────────────────────────────
    if (p.user_id) {
      informe.push(`= ${etiqueta}: ya tiene cuenta`)
      continue
    }

    // ── Existe el usuario pero no está enlazado: se adopta ────────────────
    if (existente) {
      const { data: perfil } = await sb.from("profiles").select("role").eq("id", existente.id).maybeSingle()
      if (perfil?.role === "staff") {
        // Nunca se degrada a una administradora por un choque de nombres.
        informe.push(`✗ ${etiqueta}: ese correo ya es de una cuenta de administración; no se toca`)
        continue
      }
      if (dryRun) {
        informe.push(`· ${etiqueta}: el usuario ya existe; se enlazaría y pasaría a rol profesional (contraseña sin cambios)`)
        continue
      }
      const ok = await asignar(existente.id, p)
      informe.push(ok ? `✓ ${etiqueta}: usuario existente enlazado (contraseña sin cambios)` : `✗ ${etiqueta}: no se pudo enlazar`)
      if (ok) nuevas.push({ nombre: p.nombre, email, password: null, nota: "el usuario ya existía; su contraseña no cambió" })
      continue
    }

    // ── Cuenta nueva ───────────────────────────────────────────────────────
    if (dryRun) {
      informe.push(`· ${etiqueta}: se crearía la cuenta`)
      continue
    }
    const password = contrasenaNueva()
    const { data: creado, error: eCrear } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // no existe el buzón: sin esto nunca podría entrar
      user_metadata: { full_name: p.nombre },
    })
    if (eCrear || !creado?.user) {
      informe.push(`✗ ${etiqueta}: no se pudo crear (${eCrear?.message ?? "sin detalle"})`)
      continue
    }
    const ok = await asignar(creado.user.id, p)
    if (!ok) {
      // No dejar un usuario a medias: sin rol ni enlace no le sirve a nadie.
      await sb.auth.admin.deleteUser(creado.user.id)
      informe.push(`✗ ${etiqueta}: se revirtió la creación (¿está aplicada la migración 0020?)`)
      continue
    }
    nuevas.push({ nombre: p.nombre, email, password, nota: "cuenta nueva" })
    informe.push(`✓ ${etiqueta}: cuenta creada`)
  }

  if (reset && informe.length === 0) informe.push(`✗ No hay una profesional activa con el usuario «${reset}»`)

  console.log(informe.join("\n"))
  if (dryRun) console.log("\n(Simulación: no se cambió nada.)")

  const conClave = nuevas.filter((n) => n.password)
  if (conClave.length > 0) {
    guardarAccesos(nuevas)
    console.log(`\nContraseñas guardadas en: ${ARCHIVO}`)
    console.log("No se muestran aquí. Cada profesional debe cambiarla al entrar por primera vez.")
  }
}

/** role = 'profesional' + enlace en profesionales.user_id, y se comprueba leyendo de vuelta. */
async function asignar(userId, p) {
  const { error: e1 } = await sb.from("profiles").update({ role: "profesional", full_name: p.nombre }).eq("id", userId)
  if (e1) return false
  const { error: e2 } = await sb.from("profesionales").update({ user_id: userId }).eq("id", p.id)
  if (e2) return false

  const [{ data: perfil }, { data: fila }] = await Promise.all([
    sb.from("profiles").select("role").eq("id", userId).maybeSingle(),
    sb.from("profesionales").select("user_id").eq("id", p.id).maybeSingle(),
  ])
  return perfil?.role === "profesional" && fila?.user_id === userId
}

function guardarAccesos(filas) {
  const fecha = new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })
  const bloque = [
    `── ${fecha} ──`,
    ...filas.map((f) =>
      f.password
        ? `${f.nombre}\n  Usuario:    ${f.email}   (basta escribir «${f.email.split("@")[0]}»)\n  Contraseña: ${f.password}\n  (${f.nota})`
        : `${f.nombre}\n  Usuario:    ${f.email}\n  (${f.nota})`,
    ),
    "",
  ].join("\n\n")

  const cabecera = [
    "AURA STUDIO — Accesos del equipo",
    "Entrar en: https://admin.aurastudio.pe  (se instala como app desde el celular)",
    "Cada profesional debe cambiar su contraseña al entrar: menú de su inicial (arriba a la derecha) → Cambiar contraseña.",
    "Si alguien la olvida no llega ningún correo: pídesela a la administradora, que genera una nueva.",
    "Este archivo tiene contraseñas: no lo compartas por un chat abierto y bórralo cuando ya las hayan cambiado.",
    "",
    "",
  ].join("\n")

  if (existsSync(ARCHIVO)) appendFileSync(ARCHIVO, `\n${bloque}`, { mode: 0o600 })
  else writeFileSync(ARCHIVO, `${cabecera}${bloque}`, { mode: 0o600 })
  chmodSync(ARCHIVO, 0o600)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
