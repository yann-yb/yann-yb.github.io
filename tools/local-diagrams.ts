import { spawn } from 'node:child_process'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import type { Code } from 'mdast'
import type { Node, Parent } from 'unist'

let activeRenders = 0
const waitingRenders: (() => void)[] = []
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

export function plantUmlBlocks(markdown: string) {
  const content = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
  const blocks: { index: number; line: number; language: 'plantuml'; source: string }[] = []
  function visit(node: Node) {
    if (node.type === 'code') {
      const code = node as Code
      if (['plantuml', 'puml'].includes((code.lang || '').toLowerCase())) blocks.push({ index: blocks.length, line: code.position?.start.line || 0, language: 'plantuml', source: code.value })
    }
    if ('children' in node) (node as Parent).children.forEach(visit)
  }
  visit(unified().use(remarkParse).parse(content))
  return blocks
}

export function safePlantUml(source: string) {
  if (Buffer.byteLength(source) > 16384 || /^\s*!/m.test(source) || /%[a-z_]\w*\s*\(/i.test(source) || /<\s*img\b|(?:https?|ftp|file|jar|data):|^\s*(?:sprite|include|import|load|theme)\b|backgroundimage/i.test(source)) throw new Error('Unsupported diagram')
  const starts = source.match(/@start\w+/gi) || []
  const ends = source.match(/@end\w+/gi) || []
  if (!starts.length && !ends.length) return `@startuml\n${source}\n@enduml`
  if (starts.length !== 1 || ends.length !== 1 || starts[0].toLowerCase() !== '@startuml' || ends[0].toLowerCase() !== '@enduml') throw new Error('Unsupported diagram')
  return source
}

function withoutTextMetadata(png: Buffer) {
  const chunks = [png.subarray(0, 8)]
  let ended = false
  for (let offset = 8; offset + 12 <= png.length;) {
    const length = png.readUInt32BE(offset)
    const end = offset + length + 12
    if (end > png.length) throw new Error('Diagram unavailable')
    const type = png.toString('ascii', offset + 4, offset + 8)
    if (!['tEXt', 'iTXt', 'zTXt', 'eXIf'].includes(type)) chunks.push(png.subarray(offset, end))
    offset = end
    if (type === 'IEND') { ended = true; break }
  }
  if (!ended) throw new Error('Diagram unavailable')
  return Buffer.concat(chunks)
}

export async function renderPlantUml(input: string) {
  const source = safePlantUml(input)
  if (activeRenders >= 2) {
    if (waitingRenders.length >= 16) throw new Error('Diagram unavailable')
    await new Promise<void>(resolve => waitingRenders.push(resolve))
  } else activeRenders++
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      const child = spawn(process.env.PLANTUML_BIN || 'plantuml', ['--pipe', '--png', '--disable-metadata', '--no-error-image', '--stop-on-error', '--graphviz-timeout', '3'], {
        shell: false, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'],
        env: { PATH: process.env.PATH, PLANTUML_SECURITY_PROFILE: 'SANDBOX', PLANTUML_LIMIT_SIZE: '4096', JAVA_TOOL_OPTIONS: '-Xmx128m -DPLANTUML_SECURITY_PROFILE=SANDBOX -Djava.awt.headless=true' },
      })
      const chunks: Buffer[] = []
      let bytes = 0
      let errors = 0
      let failed = false
      let settled = false
      function stop() {
        failed = true
        try { if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL') }
        catch { child.kill('SIGKILL') }
      }
      const timeout = setTimeout(stop, 8000)
      function finish(error?: Error, result?: Buffer) {
        if (settled) return
        settled = true; clearTimeout(timeout)
        if (error) reject(error); else resolve(result!)
      }
      child.on('error', () => finish(new Error('Diagram unavailable')))
      child.stdout.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) stop(); else chunks.push(chunk) })
      child.stderr.on('data', (chunk: Buffer) => { errors += chunk.length; if (errors > 65536) stop() })
      child.on('close', code => {
        const png = Buffer.concat(chunks)
        if (failed || code !== 0 || png.length < 33 || !png.subarray(0, 8).equals(pngSignature) || png.toString('ascii', 12, 16) !== 'IHDR' || png.readUInt32BE(16) < 1 || png.readUInt32BE(16) > 4096 || png.readUInt32BE(20) < 1 || png.readUInt32BE(20) > 4096) finish(new Error('Diagram unavailable'))
        else {
          try { finish(undefined, withoutTextMetadata(png)) }
          catch { finish(new Error('Diagram unavailable')) }
        }
      })
      child.stdin.on('error', () => { /* The process exit reports failed renders. */ })
      child.stdin.end(source)
    })
  } finally {
    const next = waitingRenders.shift()
    if (next) next(); else activeRenders--
  }
}
