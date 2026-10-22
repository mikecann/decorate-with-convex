import { auth } from "./auth";
import router from "./router";
import { uploadImage, uploadImageOptions } from "./images";

const http = router;

auth.addHttpRoutes(http);

http.route({ path: "/images/upload", method: "POST", handler: uploadImage });
http.route({
  path: "/images/upload",
  method: "OPTIONS",
  handler: uploadImageOptions,
});

export default http;
