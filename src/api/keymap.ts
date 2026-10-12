import axios from "axios"

export type KeyMapRequest = {
  algorithmId: string
  algorithmName: string
  widget: string
  keys: string[]
  params: Record<string, any>
}

export type KeyMapResponse = {
  title?: string
  url?: string
  html?: string
}

function joinUrl(base: string, path: string) {
  const b = base.endsWith("/") ? base : `${base}/`
  const p = path.startsWith("/") ? path.slice(1) : path
  return `${b}${p}`
}

function mockHtml(req: KeyMapRequest) {
  const safeTitle = (req.algorithmName || "一键制图").replace(/[<>&"]/g, "")
  const items = req.keys.map((k, i) => ({
    key: k,
    v: Math.max(1, (k.length * 7 + i * 13) % 100)
  }))
  const max = Math.max(...items.map((x) => x.v), 1)
  const rows = items
    .slice(0, 16)
    .map((x) => {
      const w = Math.round((x.v / max) * 100)
      return `<div class="row"><div class="k">${x.key}</div><div class="bar"><div class="fill" style="width:${w}%"></div></div><div class="v">${x.v}</div></div>`
    })
    .join("")

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial;}
    .wrap{padding:14px;}
    .h{font-weight:700;font-size:14px;margin-bottom:10px;}
    .sub{color:rgba(0,0,0,.55);font-size:12px;margin-bottom:12px;}
    .row{display:flex;align-items:center;gap:10px;margin:8px 0;}
    .k{width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;}
    .bar{flex:1;height:10px;background:rgba(0,0,0,.08);position:relative;}
    .fill{height:10px;background:rgba(64,150,255,1);}
    .v{width:36px;text-align:right;font-variant-numeric:tabular-nums;font-size:12px;color:rgba(0,0,0,.65);}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="h">一键制图结果：${safeTitle}</div>
    <div class="sub">Keys=${req.keys.length} · Widget=${req.widget}</div>
    ${rows || "<div class='sub'>暂无可视化数据</div>"}
  </div>
</body>
</html>`
}

export async function createKeyMap(req: KeyMapRequest): Promise<KeyMapResponse> {
  const base = (process.env.API_BASE as string) || "/v1/"
  const apiLocal = String((process.env.API_LOCAL as any) ?? "")
  if (apiLocal === "1") {
    return { title: "一键制图结果", html: mockHtml(req) }
  }

  const url = joinUrl(base, "keymap")
  const res = await axios.post(url, req, { timeout: 60_000 })
  return res.data as KeyMapResponse
}

