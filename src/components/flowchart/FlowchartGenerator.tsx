import { useState, useCallback, useEffect } from "react"
import { motion } from "framer-motion"
import DiagramCanvas, { FlowchartData } from "./DiagramCanvas"
import ChatSidebar from "./ChatSidebar"
import { cn } from "@/lib/utils"
import { Command, Zap } from "lucide-react"

/**
 * Main FlowchartGenerator component
 * Wraps DiagramCanvas in ReactFlowProvider to enable internal hooks
 */
export default function FlowchartGenerator() {
  const [flowchartData, setFlowchartData] = useState<FlowchartData | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [canvasKey, setCanvasKey] = useState(0)
  const [generationId, setGenerationId] = useState(0)
  // Load persisted diagram on mount
  useEffect(() => {
    const stored = localStorage.getItem('flowchartData')
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as FlowchartData
        setFlowchartData(parsed)
      } catch {
        // ignore malformed data
      }
    }
  }, [])

  // Persist diagram on changes
  useEffect(() => {
    if (flowchartData) {
      localStorage.setItem('flowchartData', JSON.stringify(flowchartData))
    } else {
      localStorage.removeItem('flowchartData')
    }
  }, [flowchartData])


	const handleFlowchartGenerated = useCallback((data: FlowchartData) => {
		setGenerationId((id) => id + 1)
		setFlowchartData(data)
	}, [])

	// Sync data from manual Canvas changes
	const handleDataChange = useCallback((data: FlowchartData) => {
		setFlowchartData(data)
	}, [])

const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  // Reset canvas and flowchart data for a brand‑new diagram
  const startNewDiagram = useCallback(() => {
    setFlowchartData(null)
    setCanvasKey((k) => k + 1)
  }, [])

	return (
		<div className="h-screen w-full bg-gray-950 flex flex-col overflow-hidden text-gray-100 font-sans">
			{/* Main Workspace - Split Screen */}
			<div className="flex-1 flex overflow-hidden relative">
				{/* Left Panel - Canvas */}
				<motion.div
					layout
					className="flex-1 h-full relative z-0"
					transition={{ type: "spring", stiffness: 300, damping: 30 }}>
					<DiagramCanvas
						key={canvasKey}
						flowchartData={flowchartData}
						generationId={generationId}
						onDataChange={handleDataChange}
						onResetCanvas={startNewDiagram}
						className="h-full w-full"
					/>
				</motion.div>

				{/* Right Panel - Sidebar */}
				<ChatSidebar
					isOpen={sidebarOpen}
					onToggle={toggleSidebar}
					onFlowchartGenerated={handleFlowchartGenerated}
					currentFlowchart={flowchartData}
				/>
			</div>

			{/* Status Bar */}
			<div className="h-6 bg-gray-900/80 border-t border-gray-800 flex items-center justify-between px-3 text-xs text-gray-500">
				<div className="flex items-center gap-4">
					<span className="flex items-center gap-1">
						<Zap className="w-3 h-3 text-green-400" />
						<span className="text-green-400 font-medium">Auto-save enabled</span>
					</span>
					{flowchartData && (
						<span className="text-gray-500">
							{flowchartData.nodes.length} nodes · {flowchartData.edges.length} edges
						</span>
					)}
				</div>
				<div className="flex items-center gap-4">
					<span className="flex items-center gap-1">
						<Command className="w-3 h-3" />
						<span>+</span>
						<span className="font-mono">Z</span>
						<span>Undo</span>
					</span>
					<span className="w-px h-3 bg-gray-700" />
					<span className="flex items-center gap-1">
						<Command className="w-3 h-3" />
						<span>+</span>
						<span className="font-mono">D</span>
						<span>Duplicate</span>
					</span>
				</div>
			</div>
		</div>
	)
}
