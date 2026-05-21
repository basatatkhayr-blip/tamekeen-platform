import { defineConfig } from "vite";
import fs from "fs";
import path from "path";

export default defineConfig({
  server: {
    port: 8080,
    strictPort: true,
  },
  plugins: [
    {
      name: "serve-static-root",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = new URL(req.url || "", `http://${req.headers.host}`);
          const pathname = url.pathname;
          
          // الملفات التي نريد خدمتها بشكل مباشر بدون معالجة Vite
          const staticFiles = ["/styles.css", "/app.js", "/config.js", "/SECURITY_SETUP.sql"];
          
          if (staticFiles.includes(pathname)) {
            const filePath = path.join(__dirname, pathname);
            if (fs.existsSync(filePath)) {
              let contentType = "text/plain";
              if (pathname.endsWith(".css")) {
                contentType = "text/css";
              } else if (pathname.endsWith(".js")) {
                contentType = "text/javascript";
              } else if (pathname.endsWith(".sql")) {
                contentType = "application/sql";
              }
              
              res.setHeader("Content-Type", contentType);
              res.end(fs.readFileSync(filePath));
              return;
            }
          }
          next();
        });
      },
    },
  ],
});


