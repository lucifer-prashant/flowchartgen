import { Suspense } from "react"
import { Routes, Route } from "react-router-dom"
import { Toaster } from "sonner"
import { Analytics } from "@vercel/analytics/react"
import Home from "./components/home"

function App() {
	return (
		<Suspense fallback={<p>Loading...</p>}>
			<>
				<Toaster theme="dark" position="top-right" richColors />
				<Routes>
					<Route path="/" element={<Home />} />
				</Routes>
				<Analytics />
			</>
		</Suspense>
	)
}

export default App
