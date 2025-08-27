import { createRouter, defineRoute, param } from "type-route";

export const { RouteProvider, useRoute, routes } = createRouter({
  dashboard: defineRoute("/"),
  image: defineRoute(
    { imageId: param.path.string },
    (p) => `/image/${p.imageId}`
  ),
  settings: defineRoute("/settings"),
});
