import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

function sarvamBlobProxy() {
  return {
    name: 'sarvam-blob-proxy',
    apply: 'serve' as const,
    configureServer(server: any) {
      server.middlewares.use('/__sarvam_proxy/upload', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        const targetUrl = req.headers['x-target-url']
        const encodedHeaders = req.headers['x-target-headers']
        if (!targetUrl || typeof targetUrl !== 'string') {
          res.statusCode = 400
          res.end('Missing x-target-url header')
          return
        }

        const chunks: Uint8Array[] = []
        req.on('data', (chunk: Uint8Array) => chunks.push(chunk))
        req.on('end', async () => {
          try {
            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
            const body = new Uint8Array(totalLength)
            let offset = 0
            for (const chunk of chunks) {
              body.set(chunk, offset)
              offset += chunk.byteLength
            }
            let forwardHeaders: Record<string, string> = {}
            if (typeof encodedHeaders === 'string' && encodedHeaders.length > 0) {
              forwardHeaders = JSON.parse(decodeURIComponent(encodedHeaders)) as Record<string, string>
            }

            const upstream = await fetch(targetUrl, {
              method: 'PUT',
              headers: forwardHeaders,
              body,
            })

            res.statusCode = upstream.status
            const responseText = await upstream.text()
            res.end(responseText)
          } catch (error) {
            res.statusCode = 500
            res.end(error instanceof Error ? error.message : 'Upload proxy failed')
          }
        })
      })

      server.middlewares.use('/__sarvam_proxy/download', async (req: any, res: any) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        try {
          const url = new URL(req.url || '', 'http://localhost')
          const target = url.searchParams.get('url')
          if (!target) {
            res.statusCode = 400
            res.end('Missing url query parameter')
            return
          }

          const upstream = await fetch(target)
          res.statusCode = upstream.status
          res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream')
          const arrayBuffer = await upstream.arrayBuffer()
          res.end(new Uint8Array(arrayBuffer))
        } catch (error) {
          res.statusCode = 500
          res.end(error instanceof Error ? error.message : 'Download proxy failed')
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    sarvamBlobProxy(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
