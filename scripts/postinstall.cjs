const fs = require("fs")
const path = require("path")
const cp = require("child_process")

const userAgent = String(process.env.npm_config_user_agent || "")
if (userAgent.includes("pnpm/")) process.exit(0)

const root = process.cwd()
const marsDir = path.join(root, "node_modules", "mars3d")
const packageFile = path.join(marsDir, "package.json")
const patchFile = path.join(root, "patches", "mars3d@3.10.12.patch")
if (!fs.existsSync(packageFile) || !fs.existsSync(patchFile)) process.exit(0)

let version = ""
try {
  version = String(JSON.parse(fs.readFileSync(packageFile, "utf8")).version || "").trim()
} catch {
  process.exit(0)
}
if (version !== "3.10.12") process.exit(0)

try {
  cp.execFileSync("patch", ["--batch", "--forward", "-p1", "-i", patchFile], { cwd: marsDir, stdio: "inherit" })
} catch {
  // Keep installation non-fatal when patch is already applied or unavailable.
  process.exit(0)
}
