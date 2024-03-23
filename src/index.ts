import { readFileSync } from 'fs'
import Koa from 'koa'
import { parseCookie } from 'koa-cookies'
import urljoin from 'url-join'

import { koaProxies } from './koa-proxies'

type Conf = {
  port: number
  gitlabUrl: string
  proxies: {
    label: string
    target: string
  }[]
}

const URL_ACCESS_TOKEN_PREFIX = '/tkn/'
const URL_SEPARATOR = '/-/'

const confPath = process.argv.length > 2 ? process.argv[2] : './conf.json'

const conf: Conf = JSON.parse(readFileSync(confPath).toString())
console.debug('conf:', conf)

const app = new Koa()

conf.proxies.forEach((pc) => {
  // use Personal Access Token
  app.use(
    koaProxies(`/${pc.label}${URL_ACCESS_TOKEN_PREFIX}:token${URL_SEPARATOR}`, (params) => {
      return {
        target: pc.target,
        changeOrigin: true,
        rewrite: (path) => {
          return path.substring(path.indexOf(URL_SEPARATOR) + URL_SEPARATOR.length)
        },
        logs: true,
        filter: async () => {
          const gitlabApiVersionUrl = urljoin(conf.gitlabUrl, '/api/v4/version', `?private_token=${params.token}`)
          const res = await fetch(gitlabApiVersionUrl)
          return res.ok
        },
      }
    }),
  )

  // use _gitlab_session Cookie
  app.use(
    koaProxies(`/${pc.label}${URL_SEPARATOR}`, (_, ctx) => {
      return {
        target: pc.target,
        changeOrigin: true,
        rewrite: (path) => {
          return path.substring(path.indexOf(URL_SEPARATOR) + URL_SEPARATOR.length)
        },
        logs: true,
        filter: async () => {
          const gitlabApiVersionUrl = urljoin(conf.gitlabUrl, '/api/v4/version')
          const gitlabSession = await parseCookie('_gitlab_session')(ctx)
          if (gitlabSession) {
            const res = await fetch(gitlabApiVersionUrl, {
              headers: {
                Cookie: `_gitlab_session=${gitlabSession}`,
              },
            })
            return res.ok
          }
          return false
        },
      }
    }),
  )
})

console.log(`Listen Port: ${conf.port}`)
app.listen(conf.port)
