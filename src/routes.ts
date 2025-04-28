import { createRouter, defineRoute, param } from "type-route";

export const { RouteProvider, useRoute, routes } = createRouter({
  dashboard: defineRoute("/"),
  imageProgress: defineRoute(
    { imageId: param.path.string },
    (p) => `/progress/${p.imageId}`
  ),
});
