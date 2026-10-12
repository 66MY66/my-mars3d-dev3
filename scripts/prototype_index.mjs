import fs from "node:fs"

const inputPath = "docx/标段4-原型设计材料0313.md"
const outputPath = "docx/标段4-原型设计材料0313.index.md"

const content = fs.readFileSync(inputPath, "utf8")
const lines = content.split(/\r?\n/)

const headingRe = /^(#{1,6})\s+(.*)$/
const figCapRe = /<figcaption><p>图\s*(\d+)\s*([^<]*)<\/p><\/figcaption>/
const figLineRe = /^图\s*(\d+)\s*(.*)$/
const imgRe = /<img\s+src="media\/(image\d+\.(png|jpe?g))"/i

let headings = []
const entries = []

function currentSection() {
  return headings.filter(Boolean).join(" / ")
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]

  const hm = line.match(headingRe)
  if (hm) {
    const level = hm[1].length
    headings = headings.slice(0, level - 1)
    headings[level - 1] = hm[2].trim()
    continue
  }

  let m = line.match(figCapRe)
  if (m) {
    entries.push({ n: Number(m[1]), caption: m[2].trim(), line: i + 1, section: currentSection() })
    continue
  }

  m = line.match(figLineRe)
  if (m) {
    entries.push({ n: Number(m[1]), caption: m[2].trim(), line: i + 1, section: currentSection() })
    continue
  }

  const im = line.match(imgRe)
  if (im && !line.includes("figcaption")) {
    entries.push({ n: null, caption: im[1], line: i + 1, section: currentSection() })
  }
}

entries.sort((a, b) => (a.n ?? 1e9) - (b.n ?? 1e9) || a.line - b.line)

const out = []
out.push("# 原型页面索引（图号→功能）")
out.push("")
out.push(`来源：${inputPath}`)
out.push("")
out.push("| 图号 | 功能/页面 | 章节 | 位置（md行号） |")
out.push("|---:|---|---|---:|")

for (const e of entries) {
  const id = e.n == null ? "—" : String(e.n)
  const cap = String(e.caption || "").replaceAll("|", "\\|")
  const sec = String(e.section || "").replaceAll("|", "\\|")
  out.push(`| 图 ${id} | ${cap} | ${sec} | ${e.line} |`)
}

fs.writeFileSync(outputPath, out.join("\n"))
console.log(`wrote ${entries.length} entries to ${outputPath}`)

