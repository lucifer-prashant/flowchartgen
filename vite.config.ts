import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react-swc"

// https://vitejs.dev/config/
export default defineConfig({
	base:
		process.env.NODE_ENV === "development"
			? "/"
			: process.env.VITE_BASE_PATH || "/",
	optimizeDeps: {
		entries: ["src/main.tsx", "src/tempobook/**/*"],
	},
	plugins: [react()],
	resolve: {
		preserveSymlinks: true,
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		allowedHosts: true,
		proxy: {
			// Proxy NVIDIA API calls to avoid CORS issues during development
			"/api/nvidia": {
				target: "https://integrate.api.nvidia.com",
				changeOrigin: true,
				secure: true,
				rewrite: (path) => path.replace(/^\/api\/nvidia/, ""),
				// Forward the Authorization header from the client request
			},
		},
	},
})
