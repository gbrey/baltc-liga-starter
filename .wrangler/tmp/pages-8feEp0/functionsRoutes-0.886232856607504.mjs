import { onRequestGet as __api_health_ts_onRequestGet } from "/Users/gusbrey/Downloads/baltc-liga-starter/functions/api/health.ts"
import { onRequest as ____path___ts_onRequest } from "/Users/gusbrey/Downloads/baltc-liga-starter/functions/[[path]].ts"

export const routes = [
    {
      routePath: "/api/health",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_health_ts_onRequestGet],
    },
  {
      routePath: "/:path*",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [____path___ts_onRequest],
    },
  ]