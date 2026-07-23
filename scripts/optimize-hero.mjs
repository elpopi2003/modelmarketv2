// Genera las variantes AVIF y WebP del hero a partir del PNG original.
//
// El PNG pesa ~2 MB; AVIF y WebP lo dejan en ~54 KB y ~85 KB sin pérdida perceptible.
// Se ejecuta a mano cuando cambie el hero: `node scripts/optimize-hero.mjs`. Las tres
// variantes se versionan en git; Index.tsx las sirve con un <picture>.

import sharp from 'sharp'
import { statSync } from 'node:fs'

const BASE = 'src/assets/hero-background'
const kb = (file) => Math.round(statSync(file).size / 1024)

await sharp(`${BASE}.png`).avif({ quality: 55 }).toFile(`${BASE}.avif`)
await sharp(`${BASE}.png`).webp({ quality: 80 }).toFile(`${BASE}.webp`)

console.log(`PNG : ${kb(`${BASE}.png`)} KB`)
console.log(`WebP: ${kb(`${BASE}.webp`)} KB`)
console.log(`AVIF: ${kb(`${BASE}.avif`)} KB`)
