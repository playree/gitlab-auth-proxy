import { readFileSync } from 'fs'
import Koa from 'koa'

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

if (process.argv.length < 3) {
  console.error('Please specify the configuration file as an argument')
}
const confPath = process.argv[2]

const conf: Conf = JSON.parse(readFileSync(confPath).toString())
console.debug('conf:', conf)

const app = new Koa()
// app.use(
//   koaProxies('/octocat/:name', (params, ctx) => {
//     console.log('@@@', params.name)
//     return {
//       target: 'https://api.github.com/',
//       changeOrigin: true,
//       rewrite: () => `/users/${params.name}`,
//       logs: true,
//       filter: async (pctx) => {
//         return params.name === 'vagusX'
//       },
//     }
//   }),
// )
conf.proxies.forEach((pc) => {
  app.use(
    koaProxies(`/${pc.label}${URL_ACCESS_TOKEN_PREFIX}:token${URL_SEPARATOR}`, (params, ctx) => {
      return {
        target: pc.target,
        changeOrigin: true,
        rewrite: (path) => {
          return path
        },
        logs: true,
        filter: async (pctx) => {
          const gitlabRes = await fetch()
        },
      }
    }),
  )
})
app.listen(3000)
