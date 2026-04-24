import { useCallback, useEffect, useState, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Maximize2,
  Minimize2,
  Lock,
  Unlock,
  Trash2,
  Square,
  Diamond,
  Circle,
  Grid3x3,
  Download,
  Undo2,
  Redo2,
  Copy,
  ZoomIn,
  ZoomOut,
  Maximize,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  Layout,
  Eye,
  EyeOff,
  Palette,
  Save,
  FolderOpen,
  Image as ImageIcon,
  Pentagon,
  Hexagon,
  ArrowUpDown,
  ArrowLeftRight,
  Target,
  Eraser,
  Pencil,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
	ReactFlow,
	MiniMap,
	Controls,
	Background,
	BackgroundVariant,
	useNodesState,
	useEdgesState,
	addEdge,
    Connection,
    ConnectionMode,
    MarkerType,
	Node,
	Edge,
	NodeTypes,
	Handle,
	Position,
	NodeResizer,
	useReactFlow,
	EdgeTypes,
	getBezierPath,
	EdgeLabelRenderer,
	BaseEdge,
	ReactFlowProvider,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import "./DiagramCanvas.css"

// --- Types ---

export interface FlowchartData {
	nodes: Array<{
		id: string
		label: string
		type: "start" | "end" | "process" | "decision" | "input" | "output"
		x?: number
		y?: number
		width?: number
		height?: number
	}>
	edges: Array<{
		from: string
		to: string
		label?: string
	}>
}

interface DiagramCanvasProps {
  flowchartData: FlowchartData | null
  generationId?: number
  onDataChange?: (data: FlowchartData) => void
  className?: string
  // Optional callback to reset the entire diagram (clears state and stored data)
  onResetCanvas?: () => void
}

// --- Custom Editable Edge ---

const EditableEdge = ({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	style = {},
	markerEnd,
	data,
	selected,
}: any) => {
	const [edgePath, labelX, labelY] = getBezierPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	})

	const [isEditing, setIsEditing] = useState(false)
	const [label, setLabel] = useState(data?.label || "")
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus()
			inputRef.current.select()
		}
	}, [isEditing])

	const handleDoubleClick = () => setIsEditing(true)
	const handleBlur = () => {
		setIsEditing(false)
		if (data) data.label = label
	}
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") setIsEditing(false)
		if (e.key === "Escape") {
			setLabel(data?.label || "")
			setIsEditing(false)
		}
	}

	return (
		<>
			<BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
			<EdgeLabelRenderer>
				<div
					style={{
						position: "absolute",
						transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
						pointerEvents: "all",
					}}
					className="nodrag nopan">
					{isEditing ? (
						<input
							ref={inputRef}
							value={label}
							onChange={(e) => setLabel(e.target.value)}
							onBlur={handleBlur}
							onKeyDown={handleKeyDown}
							className="bg-slate-800 border border-primary/50 text-foreground text-center px-2 py-0.5 rounded text-xs outline-none min-w-[60px]"
						/>
					) : (
						<div
							onDoubleClick={handleDoubleClick}
							className={cn(
								"bg-slate-800/90 text-slate-200 px-2 py-0.5 rounded text-xs font-medium cursor-text transition-all",
								selected && "ring-2 ring-primary",
								label && "border border-slate-600",
							)}
							title="Double-click to edit">
							{label || (selected ? "Double-click to label" : "")}
						</div>
					)}
				</div>
			</EdgeLabelRenderer>
		</>
	)
}

// --- Custom Node ---

const EditableNode = ({
	data,
	selected,
	type: nodeType,
	id,
}: {
	data: { label: string; nodeType: string }
	selected: boolean
	id: string
	type: string
}) => {
	const [isEditing, setIsEditing] = useState(false)
	const [label, setLabel] = useState(data.label)
	const inputRef = useRef<HTMLTextAreaElement>(null)

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus()
			inputRef.current.select()
		}
	}, [isEditing])

	const handleDoubleClick = () => setIsEditing(true)
	const handleBlur = () => {
		setIsEditing(false)
		data.label = label
	}
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			setIsEditing(false)
		}
		if (e.key === "Escape") {
			setLabel(data.label)
			setIsEditing(false)
		}
	}

	const strokeWidth = selected ? 3 : 2

	const renderShape = () => {
		const commonStyle: React.CSSProperties = {
			position: "absolute",
			inset: 0,
			width: "100%",
			height: "100%",
			overflow: "visible",
		}

		switch (nodeType) {
			case "start":
				return (
					<svg style={commonStyle} fill="none" pointerEvents="none">
						<rect
							x="2"
							y="2"
							width="calc(100% - 4px)"
							height="calc(100% - 4px)"
							rx="50%"
							ry="50%"
							fill="rgba(6,182,212,0.12)"
							stroke="#06b6d4"
							strokeWidth={strokeWidth}
						/>
					</svg>
				)
			case "end":
				return (
					<svg style={commonStyle} fill="none" pointerEvents="none">
						<rect
							x="2"
							y="2"
							width="calc(100% - 4px)"
							height="calc(100% - 4px)"
							rx="50%"
							ry="50%"
							fill="rgba(239,68,68,0.12)"
							stroke="#ef4444"
							strokeWidth={strokeWidth}
						/>
					</svg>
				)
			case "decision":
				return (
					<svg pointerEvents="none"
						style={commonStyle}
						viewBox="0 0 100 60"
						preserveAspectRatio="none"
						fill="none">
						<polygon
							points="50,2 98,30 50,58 2,30"
							fill="rgba(245,158,11,0.12)"
							stroke="#f59e0b"
							strokeWidth={strokeWidth}
							vectorEffect="non-scaling-stroke"
						/>
					</svg>
				)
case "input":
                      return (
                        <svg pointerEvents="none"
                          style={commonStyle}
                          viewBox="0 0 100 40"
                          preserveAspectRatio="none"
                          fill="none">
                          <polygon
                            points="10,2 98,2 90,38 2,38"
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth={strokeWidth}
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>
                      )
			case "output":
				return (
					<svg pointerEvents="none"
							style={commonStyle}
							viewBox="0 0 100 40"
							preserveAspectRatio="none"
							fill="none">
							<polygon
								points="10,2 98,2 90,38 2,38"
								fill="none"
								stroke="#a855f7"
								strokeWidth={strokeWidth}
								vectorEffect="non-scaling-stretch"
							/>
						</svg>
					)



			default: // process
				return (
					<svg style={commonStyle} fill="none" pointerEvents="none">
						<rect
							x="2"
							y="2"
							width="calc(100% - 4px)"
							height="calc(100% - 4px)"
							rx="6"
							fill="rgba(59,130,246,0.12)"
							stroke="#3b82f6"
							strokeWidth={strokeWidth}
						/>
					</svg>
				)
		}
	}

	const getHandleColor = () => {
		switch (nodeType) {
			case "start":
				return "#06b6d4"
			case "end":
				return "#ef4444"
			case "decision":
				return "#f59e0b"
			case "input":
				return "#22c55e"
			case "output":
				return "#a855f7"
			default:
				return "#3b82f6"
		}
	}

	return (
		<div
			className="relative w-full h-full min-w-[80px] min-h-[40px] flex items-center justify-center group"
			style={{ background: "transparent" }}>
			<NodeResizer
				isVisible={selected}
				minWidth={80}
				minHeight={40}
				lineClassName="!border-primary/60"
				handleClassName="!bg-primary !h-3 !w-3 !rounded-sm !border-2 !border-slate-900"
			/>
<Handle
                type="target"
                position={Position.Top}
                pointerEvents="all"
                className="!w-3 !h-3 !border-2 !bg-slate-900 transition-all hover:!scale-125"
                style={{ borderColor: getHandleColor() }}
            />
			<div className="absolute inset-0 z-0">{renderShape()}</div>
			<div className="z-10 px-3 py-2 text-center w-full overflow-hidden">
				{isEditing ? (
					<textarea
						ref={inputRef}
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						onBlur={handleBlur}
						onKeyDown={handleKeyDown}
						className="bg-transparent border-b border-primary/50 text-foreground text-center w-full outline-none text-sm font-medium resize-none"
						rows={2}
						style={{ minHeight: "2em" }}
					/>
				) : (
					<span
						onDoubleClick={handleDoubleClick}
						className="text-foreground/90 text-xs sm:text-sm font-medium cursor-text select-none block"
						style={{
							wordWrap: "break-word",
							whiteSpace: "pre-wrap",
							lineHeight: "1.4",
						}}>
						{label}
					</span>
				)}
			</div>
			<Handle
				type="source"
				position={Position.Bottom}
				id="bottom"
				className="!w-3 !h-3 !border-2 !bg-slate-900 transition-all hover:!scale-125"
				style={{ borderColor: getHandleColor() }}
			/>
			<Handle
				type="source"
				position={Position.Right}
				id="right"
				className="!w-3 !h-3 !border-2 !bg-slate-900 transition-all hover:!scale-125"
				style={{ borderColor: getHandleColor() }}
			/>
			<Handle
				type="source"
				position={Position.Left}
				id="left"
				className="!w-3 !h-3 !border-2 !bg-slate-900 transition-all hover:!scale-125"
				style={{ borderColor: getHandleColor() }}
			/>
		</div>
	)
}

const nodeTypes: NodeTypes = {
	start: EditableNode,
	end: EditableNode,
	process: EditableNode,
	decision: EditableNode,
	input: EditableNode,
	output: EditableNode,
}

const edgeTypes: EdgeTypes = {
	editable: EditableEdge,
}

// --- Helpers ---

function measureText(
	text: string,
	fontSize = 14,
): { width: number; height: number } {
	const canvas = document.createElement("canvas")
	const context = canvas.getContext("2d")
	if (!context) return { width: 150, height: 60 }
	context.font = `${fontSize}px sans-serif`
	const metrics = context.measureText(text)
	const lines = text.split("\n").length
	return {
		width: Math.max(120, metrics.width + 40),
		height: Math.max(50, lines * 20 + 30),
	}
}

function convertToReactFlow(data: FlowchartData): {
	nodes: Node[]
	edges: Edge[]
} {
	const nodes: Node[] = data.nodes.map((node, index) => {
		const row = Math.floor(index / 2)
		const col = index % 2
		const x = node.x ?? 250 + col * 200
		const y = node.y ?? 50 + row * 150
		let { width, height } = measureText(node.label)
		if (node.width) width = node.width
		if (node.height) height = node.height
		if (node.type === "decision") {
			width = Math.max(width, 160)
			height = Math.max(height, 80)
		}
		return {
			id: node.id,
			type: node.type,
			position: { x, y },
			data: { label: node.label, nodeType: node.type },
			style: { width, height },
		}
	})

	const edges: Edge[] = data.edges.map((edge, index) => ({
		id: `e${index}-${edge.from}-${edge.to}`,
		source: edge.from,
		target: edge.to,
		label: edge.label,
		type: "editable",
		animated: true,
		style: { stroke: "#94a3b8", strokeWidth: 2 },
		data: { label: edge.label || "" },
		markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
	}))

	return { nodes, edges }
}

function convertFromReactFlow(nodes: Node[], edges: Edge[]): FlowchartData {
	return {
		nodes: nodes.map((n) => ({
			id: n.id,
			label: n.data.label as string,
			type: n.data.nodeType as any,
			x: n.position.x,
			y: n.position.y,
			width: Number(n.style?.width) || 150,
			height: Number(n.style?.height) || 60,
		})),
		edges: edges.map((e) => ({
			from: e.source,
			to: e.target,
			label: (e.data?.label as string) || (e.label as string | undefined),
		})),
	}
}

// --- Inner component that has access to ReactFlow context ---
interface CanvasInnerProps {
  flowchartData: FlowchartData | null
  generationId?: number
  onDataChange?: (data: FlowchartData) => void
  isFullscreen: boolean
  setIsFullscreen: (v: boolean) => void
  // Optional callback to force a fresh canvas (clears internal state)
  onResetCanvas?: () => void
}

function CanvasInner({
  flowchartData,
  generationId,
  onDataChange,
  isFullscreen,
  setIsFullscreen,
  onResetCanvas,
}: CanvasInnerProps) {
	const { fitView, zoomIn, zoomOut, getViewport } = useReactFlow()
	const [nodes, setNodes, onNodesChange] = useNodesState([])
	const [edges, setEdges, onEdgesChange] = useEdgesState([])

	const [isLocked, setIsLocked] = useState(false)
	const [showGrid, setShowGrid] = useState(true)
	const [showMinimap, setShowMinimap] = useState(true)
	const [bgVariant, setBgVariant] = useState<BackgroundVariant>(
		BackgroundVariant.Dots,
	)

const [hasNodes, setHasNodes] = useState(false)
  const [showQuickGuide, setShowQuickGuide] = useState(true)

  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([])
	const [historyIndex, setHistoryIndex] = useState(-1)

	const isHistoryAction = useRef(false)
	const appliedGenerationId = useRef<number | undefined>(undefined)

	// Track last snapshot for meaningful history (ignore selection changes)
	const lastSnapshot = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null)

	const defaultEdgeOptions = useMemo(
		() => ({ type: "editable" as const, animated: true }),
		[],
	)
	const proOptions = useMemo(() => ({ hideAttribution: true }), [])

	const miniMapComponent = useMemo(() => {
		if (!showMinimap) return null
		const nodeColor = (node: Node) => {
			switch (node.type) {
				case "start":
					return "#06b6d4"
				case "end":
					return "#ef4444"
				case "decision":
					return "#f59e0b"
				case "input":
					return "#22c55e"
				case "output":
					return "#a855f7"
				default:
					return "#3b82f6"
			}
		}
		return (
			<MiniMap
				nodeColor={nodeColor}
				className="!bg-slate-800/90 !border-slate-700"
				maskColor="rgba(15,23,42,0.7)"
				pannable
				zoomable
			/>
		)
	}, [showMinimap])

	const pushHistory = useCallback(
		(newNodes: Node[], newEdges: Edge[]) => {
			if (isHistoryAction.current) return
			setHistory((prev) => {
				const trimmed = prev.slice(0, historyIndex + 1)
				return [...trimmed, { nodes: newNodes, edges: newEdges }]
			})
			setHistoryIndex((prev) => prev + 1)
		},
		[historyIndex],
	)

	const undo = useCallback(() => {
		if (historyIndex > 0) {
			isHistoryAction.current = true
			const prev = history[historyIndex - 1]
			setNodes(prev.nodes)
			setEdges(prev.edges)
			setHistoryIndex((i) => i - 1)
			setTimeout(() => {
				isHistoryAction.current = false
			}, 100)
		}
	}, [history, historyIndex, setNodes, setEdges])

	const redo = useCallback(() => {
		if (historyIndex < history.length - 1) {
			isHistoryAction.current = true
			const next = history[historyIndex + 1]
			setNodes(next.nodes)
			setEdges(next.edges)
			setHistoryIndex((i) => i + 1)
			setTimeout(() => {
				isHistoryAction.current = false
			}, 100)
		}
	}, [history, historyIndex, setNodes, setEdges])

	useEffect(() => {
		if (!flowchartData) return
		if (
			generationId !== undefined &&
			generationId === appliedGenerationId.current
		)
			return

		appliedGenerationId.current = generationId

		const { nodes: newNodes, edges: newEdges } =
			convertToReactFlow(flowchartData)

		setNodes(newNodes)
		setEdges(newEdges)
		setHasNodes(newNodes.length > 0)
		setHistory([{ nodes: newNodes, edges: newEdges }])
		setHistoryIndex(0)
		isHistoryAction.current = false

		requestAnimationFrame(() => {
			fitView({ padding: 0.2, duration: 400 })
		})
	}, [flowchartData, generationId, setNodes, setEdges, fitView])

	useEffect(() => {
		if (isHistoryAction.current) return
		// Create a snapshot ignoring transient "selected" flags
		const sanitizedNodes = nodes.map(({ selected, ...rest }) => rest)
		const sanitizedEdges = edges.map(({ selected, ...rest }) => rest)
		if (
			lastSnapshot.current &&
			JSON.stringify(sanitizedNodes) === JSON.stringify(lastSnapshot.current.nodes) &&
			JSON.stringify(sanitizedEdges) === JSON.stringify(lastSnapshot.current.edges)
		) {
			// No meaningful change – skip history entry
			return
		}
		const timer = setTimeout(() => {
			pushHistory(nodes, edges)
			setHasNodes(nodes.length > 0)
			if (onDataChange) onDataChange(convertFromReactFlow(nodes, edges))
			// Update snapshot after pushing
			lastSnapshot.current = { nodes: sanitizedNodes, edges: sanitizedEdges }
		}, 500)
		return () => clearTimeout(timer)
	}, [nodes, edges, pushHistory, onDataChange])

	const onConnect = useCallback(
		(params: Connection) =>
			setEdges((eds) =>
				addEdge(
					{
						...params,
						type: "editable",
						animated: true,
						style: { stroke: "#94a3b8", strokeWidth: 2 },
						data: { label: "" },
						markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
					},
					eds,
				),
			),
		[setEdges],
	)

	const addNode = useCallback(
		(type: string) => {
			const id = `node-${Date.now()}`
			const vp = getViewport()
			const position = {
				x: (window.innerWidth / 2 - vp.x) / vp.zoom - 75,
				y: (window.innerHeight / 2 - vp.y) / vp.zoom - 25,
			}
			const labelText =
				type === "decision"
					? "Decision?"
					: type === "start"
						? "Start"
						: type === "end"
							? "End"
							: type === "input"
								? "Input"
								: type === "output"
									? "Output"
									: "Process"
			const { width, height } = measureText(labelText)
			setNodes((nds) => [
				...nds,
				{
					id,
					type,
					position,
					data: { label: labelText, nodeType: type },
					style: {
						width: type === "decision" ? 160 : width,
						height: type === "decision" ? 80 : height,
					},
				},
			])
			setHasNodes(true)
		},
		[setNodes, getViewport],
	)

	const duplicateSelected = useCallback(() => {
		const sel = nodes.filter((n) => n.selected)
		if (!sel.length) return
		setNodes((nds) => [
			...nds.map((n) => ({ ...n, selected: false })),
			...sel.map((n) => ({
				...n,
				id: `${n.id}-copy-${Date.now()}`,
				position: { x: n.position.x + 50, y: n.position.y + 50 },
				selected: true,
			})),
		])
	}, [nodes, setNodes])

	const deleteSelected = useCallback(() => {
		setNodes((nds) => nds.filter((n) => !n.selected))
		setEdges((eds) => eds.filter((e) => !e.selected))
	}, [setNodes, setEdges])

const clearAll = useCallback(() => {
		if (confirm("Clear entire canvas?")) {
			setNodes([])
			setEdges([])
			setHasNodes(false)
			// Also clear persisted data and reset canvas
			if (onResetCanvas) onResetCanvas()
			localStorage.removeItem('flowchartData')
		}
	}, [setNodes, setEdges, onResetCanvas])

	// Select / Deselect all nodes (and edges)
	const selectAll = useCallback(() => {
		setNodes((nds) => nds.map((n) => ({ ...n, selected: true })))
	}, [setNodes])

	const deselectAll = useCallback(() => {
		setNodes((nds) => nds.map((n) => ({ ...n, selected: false })))
		setEdges((eds) => eds.map((e) => ({ ...e, selected: false })))
	}, [setNodes, setEdges])

	const alignHorizontal = useCallback(() => {
		const sel = nodes.filter((n) => n.selected)
		if (sel.length < 2) return
		const avgY = sel.reduce((s, n) => s + n.position.y, 0) / sel.length
		setNodes((nds) =>
			nds.map((n) =>
				n.selected ? { ...n, position: { ...n.position, y: avgY } } : n,
			),
		)
	}, [nodes, setNodes])

	const alignVertical = useCallback(() => {
		const sel = nodes.filter((n) => n.selected)
		if (sel.length < 2) return
		const avgX = sel.reduce((s, n) => s + n.position.x, 0) / sel.length
		setNodes((nds) =>
			nds.map((n) =>
				n.selected ? { ...n, position: { ...n.position, x: avgX } } : n,
			),
		)
	}, [nodes, setNodes])

	const distributeHorizontal = useCallback(() => {
		const sel = [...nodes.filter((n) => n.selected)].sort(
			(a, b) => a.position.x - b.position.x,
		)
		if (sel.length < 3) return
		const gap =
			(sel[sel.length - 1].position.x - sel[0].position.x) / (sel.length - 1)
		setNodes((nds) =>
			nds.map((n) => {
				const i = sel.findIndex((s) => s.id === n.id)
				return i > 0 && i < sel.length - 1
					? {
							...n,
							position: { ...n.position, x: sel[0].position.x + gap * i },
						}
					: n
			}),
		)
	}, [nodes, setNodes])

	const distributeVertical = useCallback(() => {
		const sel = [...nodes.filter((n) => n.selected)].sort(
			(a, b) => a.position.y - b.position.y,
		)
		if (sel.length < 3) return
		const gap =
			(sel[sel.length - 1].position.y - sel[0].position.y) / (sel.length - 1)
		setNodes((nds) =>
			nds.map((n) => {
				const i = sel.findIndex((s) => s.id === n.id)
				return i > 0 && i < sel.length - 1
					? {
							...n,
							position: { ...n.position, y: sel[0].position.y + gap * i },
						}
					: n
			}),
		)
	}, [nodes, setNodes])

	const downloadImage = (format: string) => {
		alert(
			`Export to ${format.toUpperCase()} — install html-to-image:\nnpm install html-to-image`,
		)
	}

	const saveToJSON = () => {
		const data = convertFromReactFlow(nodes, edges)
		const blob = new Blob([JSON.stringify(data, null, 2)], {
			type: "application/json",
		})
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = `flowchart-${Date.now()}.json`
		a.click()
	}

	const loadFromJSON = () => {
		const input = document.createElement("input")
		input.type = "file"
		input.accept = ".json"
		input.onchange = (e: any) => {
			const file = e.target.files[0]
			if (!file) return
			const reader = new FileReader()
			reader.onload = (ev) => {
				try {
					const data = JSON.parse(ev.target?.result as string)
					const { nodes: newNodes, edges: newEdges } = convertToReactFlow(data)
					setNodes(newNodes)
					setEdges(newEdges)
					setHasNodes(newNodes.length > 0)
					pushHistory(newNodes, newEdges)
				} catch {
					alert("Invalid JSON file")
				}
			}
			reader.readAsText(file)
		}
		input.click()
	}

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (document.activeElement?.tagName === "INPUT") return
			if (document.activeElement?.tagName === "TEXTAREA") return
			if (e.key === "Delete" || e.key === "Backspace") deleteSelected()
			if ((e.ctrlKey || e.metaKey) && e.key === "d") {
				e.preventDefault()
				duplicateSelected()
			}
			if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
				e.preventDefault()
				undo()
			}
			if (
				(e.ctrlKey || e.metaKey) &&
				(e.key === "y" || (e.shiftKey && e.key === "z"))
			) {
				e.preventDefault()
				redo()
			}
	if ((e.ctrlKey || e.metaKey) && e.key === "s") {
		e.preventDefault()
		saveToJSON()
	}
	if ((e.ctrlKey || e.metaKey) && e.key === "a") {
		e.preventDefault()
		selectAll()
	}
	if (!e.ctrlKey && !e.metaKey && (e.key === "i" || e.key === "h")) {
		e.preventDefault()
		setShowQuickGuide(prev => !prev)
	}
		}
		document.addEventListener("keydown", handleKeyDown)
		return () => document.removeEventListener("keydown", handleKeyDown)
	}, [deleteSelected, duplicateSelected, undo, redo, selectAll, setShowQuickGuide])

	return (
		<div className="relative w-full h-full">
			{/* Toolbar - absolutely positioned over the canvas */}
			<div className="absolute top-0 left-0 right-0 z-20 flex flex-wrap items-center justify-between px-2 py-1.5 bg-slate-900/98 backdrop-blur-md border-b border-slate-700/50 gap-1.5 shadow-2xl">
				<div className="flex items-center gap-0.5 bg-slate-800/60 rounded-md px-1 py-0.5 border border-slate-700/50">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => addNode("start")}
						className="h-8 w-8 hover:bg-cyan-500/20"
						title="Start Node">
						<Circle className="w-3.5 h-3.5 text-cyan-400" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => addNode("end")}
						className="h-8 w-8 hover:bg-red-500/20"
						title="End Node">
						<Circle className="w-3.5 h-3.5 text-red-400 fill-red-400/20" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => addNode("process")}
						className="h-8 w-8 hover:bg-blue-500/20"
						title="Process">
						<Square className="w-3.5 h-3.5 text-blue-400" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => addNode("decision")}
						className="h-8 w-8 hover:bg-amber-500/20"
						title="Decision">
						<Diamond className="w-3.5 h-3.5 text-amber-400" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => addNode("input")}
						className="h-8 w-8 hover:bg-green-500/20"
						title="Input">
						<Pentagon className="w-3.5 h-3.5 text-green-400" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => addNode("output")}
						className="h-8 w-8 hover:bg-purple-500/20"
						title="Output">
						<Hexagon className="w-3.5 h-3.5 text-purple-400" />
					</Button>
				</div>
				<div className="flex items-center gap-0.5">
					<div className="flex items-center gap-0.5 bg-slate-800/60 rounded-md px-1 py-0.5 border border-slate-700/50">
						<Button
							variant="ghost"
							size="icon"
							onClick={undo}
							disabled={historyIndex <= 0}
							className={cn("h-8 w-8", historyIndex <= 0 && "opacity-30")}
							title="Undo (Ctrl+Z)">
							<Undo2 className="w-3.5 h-3.5" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={redo}
							disabled={historyIndex >= history.length - 1}
							className={cn(
								"h-8 w-8",
								historyIndex >= history.length - 1 && "opacity-30",
							)}
							title="Redo (Ctrl+Y)">
							<Redo2 className="w-3.5 h-3.5" />
						</Button>
					</div>
					<div className="flex items-center gap-0.5 bg-slate-800/60 rounded-md px-1 py-0.5 border border-slate-700/50">
						<Button
							variant="ghost"
							size="icon"
							onClick={duplicateSelected}
							className="h-8 w-8"
							title="Duplicate (Ctrl+D)">
							<Copy className="w-3.5 h-3.5" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={deleteSelected}
							className="h-8 w-8 hover:bg-red-500/20"
							title="Delete (Del)">
							<Trash2 className="w-3.5 h-3.5 text-red-400" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={clearAll}
							className="h-8 w-8 hover:bg-red-500/20"
							title="Clear All">
							<Eraser className="w-3.5 h-3.5 text-red-300" />
						</Button>
					</div>
				</div>
				<div className="flex items-center gap-0.5 bg-slate-800/60 rounded-md px-1 py-0.5 border border-slate-700/50">
					<Button
						variant="ghost"
						size="icon"
						onClick={selectAll}
						className="h-8 w-8"
						title="Select All (Ctrl+A)">
						<Target className="w-3.5 h-3.5 text-blue-400" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={deselectAll}
						className="h-8 w-8"
						title="Deselect All">
						<Circle className="w-3.5 h-3.5 text-slate-500" />
					</Button>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 bg-slate-800/60 hover:bg-slate-700/60"
							title="Arrange">
							<Layout className="w-3.5 h-3.5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="bg-slate-900 border-slate-700">
						<DropdownMenuLabel className="text-xs text-slate-400">
							Align Selected
						</DropdownMenuLabel>
						<DropdownMenuSeparator className="bg-slate-700" />
						<DropdownMenuItem
							onClick={alignHorizontal}
							className="text-slate-200 text-xs">
							<AlignHorizontalJustifyCenter className="w-3.5 h-3.5 mr-2" />
							Align Horizontal
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={alignVertical}
							className="text-slate-200 text-xs">
							<AlignVerticalJustifyCenter className="w-3.5 h-3.5 mr-2" />
							Align Vertical
						</DropdownMenuItem>
						<DropdownMenuSeparator className="bg-slate-700" />
						<DropdownMenuItem
							onClick={distributeHorizontal}
							className="text-slate-200 text-xs">
							<ArrowLeftRight className="w-3.5 h-3.5 mr-2" />
							Distribute Horizontal
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={distributeVertical}
							className="text-slate-200 text-xs">
							<ArrowUpDown className="w-3.5 h-3.5 mr-2" />
							Distribute Vertical
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				<div className="flex items-center gap-0.5 bg-slate-800/60 rounded-md px-1 py-0.5 border border-slate-700/50">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => zoomIn()}
						className="h-8 w-8"
						title="Zoom In">
						<ZoomIn className="w-3.5 h-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => zoomOut()}
						className="h-8 w-8"
						title="Zoom Out">
						<ZoomOut className="w-3.5 h-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => fitView({ padding: 0.2 })}
						className="h-8 w-8"
						title="Fit View">
						<Maximize className="w-3.5 h-3.5" />
					</Button>
				</div>
				<div className="flex items-center gap-0.5 bg-slate-800/60 rounded-md px-1 py-0.5 border border-slate-700/50">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setShowGrid(!showGrid)}
						className={cn("h-8 w-8", showGrid && "bg-primary/20")}
						title="Grid">
						<Grid3x3 className="w-3.5 h-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setShowMinimap(!showMinimap)}
						className={cn("h-8 w-8", showMinimap && "bg-primary/20")}
						title="Minimap">
						{showMinimap ? (
							<Eye className="w-3.5 h-3.5" />
						) : (
							<EyeOff className="w-3.5 h-3.5" />
						)}
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								title="Background">
								<Palette className="w-3.5 h-3.5" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="bg-slate-900 border-slate-700">
							<DropdownMenuItem
								onClick={() => setBgVariant(BackgroundVariant.Dots)}
								className="text-slate-200 text-xs">
								Dots
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setBgVariant(BackgroundVariant.Lines)}
								className="text-slate-200 text-xs">
								Lines
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setBgVariant(BackgroundVariant.Cross)}
								className="text-slate-200 text-xs">
								Cross
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<div className="flex items-center gap-0.5 bg-slate-800/60 rounded-md px-1 py-0.5 border border-slate-700/50">
					<Button
						variant="ghost"
						size="icon"
						onClick={saveToJSON}
						className="h-8 w-8"
						title="Save JSON (Ctrl+S)">
						<Save className="w-3.5 h-3.5 text-green-400" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={loadFromJSON}
						className="h-8 w-8"
						title="Load JSON">
						<FolderOpen className="w-3.5 h-3.5 text-blue-400" />
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8"
								title="Export Image">
								<Download className="w-3.5 h-3.5 text-purple-400" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="bg-slate-900 border-slate-700">
							<DropdownMenuItem
								onClick={() => downloadImage("png")}
								className="text-slate-200 text-xs">
								<ImageIcon className="w-3.5 h-3.5 mr-2" />
								PNG
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => downloadImage("jpeg")}
								className="text-slate-200 text-xs">
								<ImageIcon className="w-3.5 h-3.5 mr-2" />
								JPG
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => downloadImage("svg")}
								className="text-slate-200 text-xs">
								<ImageIcon className="w-3.5 h-3.5 mr-2" />
								SVG
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<div className="flex items-center gap-0.5 bg-slate-800/60 rounded-md px-1 py-0.5 border border-slate-700/50">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setIsLocked(!isLocked)}
						className="h-8 w-8"
						title={isLocked ? "Unlock" : "Lock"}>
						{isLocked ? (
							<Lock className="w-3.5 h-3.5 text-amber-500" />
						) : (
							<Unlock className="w-3.5 h-3.5" />
						)}
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setIsFullscreen(!isFullscreen)}
						className="h-8 w-8">
						{isFullscreen ? (
							<Minimize2 className="w-3.5 h-3.5" />
						) : (
							<Maximize2 className="w-3.5 h-3.5" />
						)}
					</Button>
				</div>
			</div>

			{/* Empty state overlay */}
			{!hasNodes && (
				<div className="absolute inset-0 flex items-center justify-center text-slate-400 z-10 pointer-events-none">
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						className="text-center">
						<div className="w-24 h-24 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700/50">
							<Sparkles className="w-12 h-12 opacity-50 text-primary" />
						</div>
						<p className="font-semibold text-lg mb-2">Canvas Empty</p>
						<p className="text-sm opacity-60">
							Use AI or toolbar to create your flowchart
						</p>
					</motion.div>
				</div>
			)}

			{/* React Flow canvas */}
			<div className="absolute inset-0 w-full h-full">
				<ReactFlow
					nodes={nodes}
					edges={edges}
					onNodesChange={isLocked ? undefined : onNodesChange}
					onEdgesChange={isLocked ? undefined : onEdgesChange}
					onConnect={isLocked ? undefined : onConnect}
					nodeTypes={nodeTypes}
					edgeTypes={edgeTypes}

					minZoom={0.1}
					maxZoom={4}
					snapToGrid={showGrid}
					snapGrid={[15, 15]}
					connectionMode={ConnectionMode.Loose}
					className="bg-transparent"
					defaultEdgeOptions={defaultEdgeOptions}
					proOptions={proOptions}>
					{showGrid && (
						<Background
							variant={bgVariant}
							gap={20}
							size={1}
							color="rgba(148,163,184,0.15)"
						/>
					)}
					<Controls className="!bg-slate-800/90 !border-slate-700 !fill-slate-200 [&_button]:!bg-slate-900 [&_button:hover]:!bg-slate-700" />
					{miniMapComponent}
				</ReactFlow>
			</div>

			{/* Quick Guide */}
			{hasNodes && !isLocked && (
  showQuickGuide ? (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-3 left-3 bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-lg p-2.5 text-xs text-slate-300 max-w-[260px] shadow-2xl z-10">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowQuickGuide(false)}
        className="absolute top-1 right-1 h-5 w-5 p-0"
        title="Hide Quick Guide (i/h)">
        <X className="w-3 h-3" />
      </Button>
      <p className="font-semibold text-slate-100 mb-1.5 flex items-center gap-1.5">
        <Pencil className="w-3 h-3 text-primary" /> Quick Guide
      </p>
      <ul className="space-y-0.5 list-none text-slate-400 text-[10px] leading-relaxed">
        <li>• Double-click nodes/edges to edit text</li>
        <li>• Drag corner handles to resize nodes</li>
        <li>• Shift+Click to select multiple items</li>
        <li>• Ctrl+Z/Y for undo/redo history</li>
        <li>• Ctrl+D to duplicate selection</li>
        <li>• Ctrl+S to save as JSON file</li>
        <li>• Ctrl+A to select all nodes</li>
      </ul>
    </motion.div>
  ) : (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setShowQuickGuide(true)}
      className="fixed bottom-3 left-3 h-8 w-8"
      title="Show Quick Guide (i/h)">
      <span className="text-sm font-bold">i</span>
    </Button>
  )
)}
		</div>
	)
}

// --- Main Component (provides ReactFlowProvider) ---
export default function DiagramCanvas({
  flowchartData,
  generationId,
  onDataChange,
  className,
  onResetCanvas,
}: DiagramCanvasProps) {
	const [isFullscreen, setIsFullscreen] = useState(false)

	return (
		<div
			className={cn(
				"relative flex flex-col h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950",
				isFullscreen && "fixed inset-0 z-50",
				className,
			)}>
			<ReactFlowProvider>
<CanvasInner
  			flowchartData={flowchartData}
  			generationId={generationId}
  			onDataChange={onDataChange}
  			isFullscreen={isFullscreen}
  			setIsFullscreen={setIsFullscreen}
  			onResetCanvas={onResetCanvas}
  		/>
			</ReactFlowProvider>
		</div>
	)
}
