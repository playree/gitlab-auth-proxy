import { ClientRequest, IncomingMessage, ServerResponse } from 'http'

/**
 * Dependencies
 */
import { createProxyServer } from 'http-proxy'
import * as Koa from 'koa'
import pathMatch from 'path-match'
import { v4 as uuidv4 } from 'uuid'

interface IBaseKoaProxiesOptions {
  target: string
  changeOrigin?: boolean
  logs?: boolean | ((ctx: Koa.Context, target: string) => void)
  agent?: unknown
  headers?: { [key: string]: string }
  rewrite?: (path: string) => string
  filter: (ctx: Koa.Context) => Promise<boolean>
  events?: {
    error?: (error: unknown, req: IncomingMessage, res: ServerResponse) => void
    proxyReq?: (proxyReq: ClientRequest, req: IncomingMessage, res: ServerResponse) => void
    proxyRes?: (proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) => void
  }
}
type IKoaProxiesOptionsFunc = (params: { [key: string]: string }, ctx: Koa.Context) => IBaseKoaProxiesOptions | false
type IKoaProxiesOptions = string | IBaseKoaProxiesOptions | IKoaProxiesOptionsFunc

/**
 * Constants
 */

const proxy = createProxyServer()
const route = pathMatch({
  // path-to-regexp options
  sensitive: false,
  strict: false,
  end: false,
})

const REQUEST_IDENTIFIER = '__KOA_PROXIES_MIDDLEWARE_ID__'

const proxyEventHandlers: Record<string, Map<string, unknown>> = {}

function setupProxyEventHandler(event: string) {
  if (['error', 'proxyReq', 'proxyRes'].indexOf(event) < 0) {
    return
  }

  proxyEventHandlers[event] = new Map()

  proxy.on(event, (..._args) => {
    const args = _args as unknown as [
      unknown,
      IncomingMessage & {
        __KOA_PROXIES_MIDDLEWARE_ID__?: string | undefined
      },
    ]
    const req = args[1]
    const eventHandler = proxyEventHandlers[event].get(req[REQUEST_IDENTIFIER] || '')
    if (typeof eventHandler === 'function') {
      eventHandler(...args)
    }
  })

  return proxyEventHandlers[event]
}

/**
 * Koa Http Proxy Middleware
 */
export const koaProxies = (path: string | RegExp | (string | RegExp)[], options: IKoaProxiesOptions) => {
  const middlewareId = uuidv4()

  return (
    ctx: Koa.Context & {
      req: {
        oldPath?: string
        __KOA_PROXIES_MIDDLEWARE_ID__?: string
      }
    },
    next: Koa.Next,
  ) => {
    // create a match function
    const match = route(path)
    const params = match(ctx.path)
    if (!params) return next()

    let opts
    if (typeof options === 'function') {
      opts = options.call(options, params, ctx)
      if (opts === false) {
        return next()
      }
    } else {
      opts = Object.assign({}, options)
    }

    const { logs, rewrite, events, filter, ...httpProxyOpts } = opts as IBaseKoaProxiesOptions

    return new Promise<void>((resolve, reject) => {
      ctx.req.oldPath = ctx.req.url

      filter(ctx)
        .then((isAllowed) => {
          if (!isAllowed) {
            console.log('Not allowed:', ctx.req.url)
            ctx.status = 401
            resolve()
          }

          if (typeof rewrite === 'function') {
            ctx.req.url = rewrite(ctx.req.url || '')
          }

          if (logs) {
            // typeof logs === 'function' ? logs(ctx, opts.target) : logger(ctx, httpProxyOpts)
          }

          if (events && typeof events === 'object') {
            ctx.req[REQUEST_IDENTIFIER] = middlewareId

            Object.entries(events).forEach(([event, handler]) => {
              const eventHandler =
                proxyEventHandlers[event] == null ? setupProxyEventHandler(event) : proxyEventHandlers[event]

              if (typeof eventHandler === 'object' && !eventHandler.has(middlewareId)) {
                eventHandler.set(middlewareId, handler)
              }
            })
          }

          // Let the promise be solved correctly after the proxy.web.
          // The solution comes from https://github.com/nodejitsu/node-http-proxy/issues/951#issuecomment-179904134
          ctx.res.on('close', () => {
            reject(new Error(`Http response closed while proxying ${ctx.req.oldPath}`))
          })

          ctx.res.on('finish', () => {
            resolve()
          })

          proxy.web(ctx.req, ctx.res, httpProxyOpts, (e: Error & { code?: 'ECONNREFUSED' | 'ETIMEOUT' }, ...args) => {
            const errorHandler =
              proxyEventHandlers.error && proxyEventHandlers.error.get(ctx.req[REQUEST_IDENTIFIER] || '')

            if (typeof errorHandler === 'function') {
              errorHandler(e, ...args) // If this error handler sends the headers, the ctx.status setter below is ignored
            }

            const status = {
              ECONNREFUSED: 503,
              ETIMEOUT: 504,
              500: 500,
            }[e.code || '500']
            ctx.status = status
            resolve()
          })
        })
        .catch(() => {
          reject(new Error('Filter Error'))
        })
    })
  }
}

const _proxy = proxy
export { _proxy as proxy }
