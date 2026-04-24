import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
	Loader2,
	Sparkles,
	Send,
	ChevronRight,
	ChevronLeft,
	AlertCircle,
	X,
	Trash2,
	RotateCcw,
	Check,
} from "lucide-react"
import {
	ReactFlow,
	ReactFlowProvider,
	Background,
	BackgroundVariant,
	useReactFlow,
} from "@xyflow/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { FlowchartData } from "./DiagramCanvas"
import { convertToReactFlow, nodeTypes, edgeTypes } from "./DiagramCanvas"

// --- Read-only diagram preview used inside the AI confirmation modal ---

function DiagramPreviewInner({ data }: { data: FlowchartData }) {
	const { fitView } = useReactFlow()
	const { nodes, edges } = useMemo(() => convertToReactFlow(data), [data])

	useEffect(() => {
		const id = requestAnimationFrame(() => fitView({ padding: 0.25, duration: 350 }))
		return () => cancelAnimationFrame(id)
	}, [fitView, nodes, edges])

	return (
		<ReactFlow
			nodes={nodes}
			edges={edges}
			nodeTypes={nodeTypes}
			edgeTypes={edgeTypes}
			nodesDraggable={false}
			nodesConnectable={false}
			elementsSelectable={false}
			panOnDrag={false}
			zoomOnScroll={false}
			zoomOnPinch={false}
			zoomOnDoubleClick={false}
			proOptions={{ hideAttribution: true }}
			className="bg-transparent">
			<Background
				variant={BackgroundVariant.Dots}
				gap={20}
				size={1}
				color="rgba(148,163,184,0.08)"
			/>
		</ReactFlow>
	)
}

function DiagramPreview({ data }: { data: FlowchartData }) {
	return (
		<ReactFlowProvider>
			<DiagramPreviewInner data={data} />
		</ReactFlowProvider>
	)
}

// Vite proxy: /api/nvidia/* → https://integrate.api.nvidia.com/*
// Authorization header is forwarded as-is by the proxy (changeOrigin handles the rest)
const NVIDIA_PROXY = "/api/nvidia/v1/chat/completions"

const DEFAULT_MODEL =
	(import.meta.env.VITE_NVIDIA_MODEL as string | undefined) ??
	"moonshotai/kimi-k2-instruct-0905"

interface Message {
	id: string
	role: "user" | "assistant" | "system"
	content: string
	timestamp: Date
	diagramGenerated?: boolean
}

interface ChatSidebarProps {
	isOpen: boolean
	onToggle: () => void
	onFlowchartGenerated: (data: FlowchartData) => void
	currentFlowchart: FlowchartData | null
	className?: string
}

interface ErrorToast {
	message: string
	visible: boolean
}

export default function ChatSidebar({
	isOpen,
	onToggle,
	onFlowchartGenerated,
	currentFlowchart,
	className,
}: ChatSidebarProps) {
	const [prompt, setPrompt] = useState("")
	const [messages, setMessages] = useState<Message[]>([
		{
			id: "welcome",
			role: "system",
			content:
				"Welcome! Describe any process, concept, or workflow and I'll generate a flowchart diagram for you.",
			timestamp: new Date(),
		},
	])
	const [isGenerating, setIsGenerating] = useState(false)
  const [previewData, setPreviewData] = useState<FlowchartData | null>(null)
  const [showPreview, setShowPreview] = useState(false)
	const [errorToast, setErrorToast] = useState<ErrorToast>({
		message: "",
		visible: false,
	})

	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const messagesEndRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [messages])

	useEffect(() => {
		if (errorToast.visible) {
			const timer = setTimeout(
				() => setErrorToast((prev) => ({ ...prev, visible: false })),
				5000,
			)
			return () => clearTimeout(timer)
		}
	}, [errorToast.visible])

	const showError = useCallback((message: string) => {
		setErrorToast({ message, visible: true })
	}, [])

	const extractFlowchartData = (content: string): FlowchartData | null => {
		// 1. JSON inside markdown fences
		const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
		if (fenceMatch) {
			try {
				const parsed = JSON.parse(fenceMatch[1].trim())
				if (parsed.nodes && parsed.edges) return parsed as FlowchartData
			} catch {
				/* continue */
			}
		}
		// 2. Raw JSON string
		try {
			const parsed = JSON.parse(content)
			if (parsed.nodes && parsed.edges) return parsed as FlowchartData
		} catch {
			/* continue */
		}
		// 3. JSON object embedded in prose
		const embeddedMatch = content.match(
			/\{[\s\S]*"nodes"[\s\S]*"edges"[\s\S]*\}/,
		)
		if (embeddedMatch) {
			try {
				const parsed = JSON.parse(embeddedMatch[0])
				if (parsed.nodes && parsed.edges) return parsed as FlowchartData
			} catch {
				/* continue */
			}
		}
		return null
	}

	const handleSubmit = async () => {
		if (!prompt.trim() || isGenerating) return

		// Validate API key before doing anything
		const apiKey = import.meta.env.VITE_NVIDIA_API_KEY as string | undefined
		if (!apiKey) {
			showError(
				"NVIDIA API key not found. Add VITE_NVIDIA_API_KEY to your .env and restart Vite.",
			)
			return
		}

		const userMessage: Message = {
			id: `user-${Date.now()}`,
			role: "user",
			content: prompt,
			timestamp: new Date(),
		}

		setMessages((prev) => [...prev, userMessage])
		setPrompt("")
		setIsGenerating(true)

		try {
			const contextMessages = currentFlowchart
				? `Current diagram exists with ${currentFlowchart.nodes.length} nodes. User wants to modify it. Current structure: ${JSON.stringify(currentFlowchart)}`
				: "No existing diagram. Create a new one."

			const response = await fetch(NVIDIA_PROXY, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					// Sent to localhost Vite proxy, which forwards it to NVIDIA.
					// Fine for local dev — key only visible in your own browser network tab.
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model: DEFAULT_MODEL,
					messages: [
						{
							role: "system",
							content: `You are an expert at creating flowchart diagrams. When given a concept, process, or problem statement, generate a JSON structure for a flowchart.

CRITICAL RULES:
1. Return ONLY valid JSON wrapped in \`\`\`json code blocks
2. Use the exact structure shown below
3. Node types must be one of: "start", "end", "process", "decision", "input", "output"
4. Each node needs a unique id (use descriptive names like "start", "step1", "decision1")
5. Edges connect nodes using "from" and "to" fields with node ids
6. Position nodes logically - calculate x,y coordinates for a top-to-bottom flow
7. Start at x=300, y=50 and increment y by 120 for each row

${contextMessages}

Required JSON structure:
\`\`\`json
{
  "nodes": [
    { "id": "start", "label": "Start", "type": "start", "x": 300, "y": 50 },
    { "id": "step1", "label": "Process Step", "type": "process", "x": 300, "y": 170 },
    { "id": "decision1", "label": "Is Valid?", "type": "decision", "x": 300, "y": 290 },
    { "id": "end", "label": "End", "type": "end", "x": 300, "y": 410 }
  ],
  "edges": [
    { "from": "start", "to": "step1" },
    { "from": "step1", "to": "decision1" },
    { "from": "decision1", "to": "end", "label": "Yes" }
  ]
}
\`\`\`

Node type guidelines:
- "start": Beginning of the flow (oval shape, cyan)
- "end": End of the flow (oval shape, red)
- "process": Action/step (rectangle, blue border)
- "decision": Yes/No question (diamond, amber)
- "input": User input/data entry (parallelogram, green)
- "output": Display/output (parallelogram, purple)

For branching flows:
- Use different x positions (e.g., x=150 for left branch, x=450 for right branch)
- Add labels to edges for decision paths (e.g., "Yes", "No")

Always respond with ONLY the JSON, no explanations.`,
						},
						...messages
							.filter((m) => m.role !== "system")
							.slice(-10)
							.map((m) => ({
								role: m.role as "user" | "assistant",
								content: m.content,
							})),
						{ role: "user", content: userMessage.content },
					],
					temperature: 0.7,
					max_tokens: 4000,
				}),
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}))
				throw new Error(
					errorData.error?.message ??
						`API request failed: ${response.status} ${response.statusText}`,
				)
			}

			const data = await response.json()

			if (data.error) {
				throw new Error(data.error.message ?? "API returned an error")
			}

			const content: string | undefined = data.choices?.[0]?.message?.content
			if (!content) {
				throw new Error("No content received from API. Please try again.")
			}

			const extractedData = extractFlowchartData(content)

			setMessages((prev) => [
				...prev,
				{
					id: `assistant-${Date.now()}`,
					role: "assistant",
					content: extractedData
						? "Diagram generated – please review the preview before applying."
						: content,
					timestamp: new Date(),
					diagramGenerated: !!extractedData,
				},
			])

			if (extractedData) {
				setPreviewData(extractedData)
				setShowPreview(true)
			} else {
				showError(
					"Could not extract a valid diagram. Try rephrasing your request.",
				)
			}
		} catch (error) {
			showError(
				error instanceof Error
					? error.message
					: "Failed to generate diagram. Please try again.",
			)
			setMessages((prev) => [
				...prev,
				{
					id: `error-${Date.now()}`,
					role: "assistant",
					content:
						"Sorry, I encountered an error while generating the diagram. Please try again.",
					timestamp: new Date(),
				},
			])
		} finally {
			setIsGenerating(false)
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			handleSubmit()
		}
	}

	const clearChat = () => {
		setMessages([
			{
				id: "welcome",
				role: "system",
				content: "Chat cleared. Ready to generate a new diagram!",
				timestamp: new Date(),
			},
		])
	}

	return (
		<>
			{/* Error Toast */}
			<AnimatePresence>
				{errorToast.visible && (
					<motion.div
						initial={{ x: 100, opacity: 0 }}
						animate={{ x: 0, opacity: 1 }}
						exit={{ x: 100, opacity: 0 }}
						className="fixed top-6 right-6 z-50 max-w-md">
						<div className="flex items-center gap-3 bg-card border-l-4 border-destructive rounded-lg p-4 shadow-lg">
							<AlertCircle className="h-5 w-5 text-destructive shrink-0" />
							<p className="text-sm text-foreground flex-1">
								{errorToast.message}
							</p>
							<button
								onClick={() =>
									setErrorToast((prev) => ({ ...prev, visible: false }))
								}
								className="text-muted-foreground hover:text-foreground transition-colors">
								<X className="h-4 w-4" />
							</button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Toggle Button (visible when sidebar is closed) */}
			<AnimatePresence>
				{!isOpen && (
					<motion.button
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 20 }}
						onClick={onToggle}
						className={cn(
							"fixed right-0 top-1/2 -translate-y-1/2 z-40",
							"bg-primary text-primary-foreground",
							"p-2 rounded-l-lg shadow-lg",
							"hover:bg-primary/90 transition-colors",
						)}>
						<ChevronLeft className="h-5 w-5" />
					</motion.button>
				)}
			</AnimatePresence>

			{/* Sidebar */}
			<motion.div
				initial={false}
				animate={{
					width: isOpen ? 380 : 0,
					opacity: isOpen ? 1 : 0,
				}}
				transition={{ duration: 0.3, ease: "easeInOut" }}
				className={cn(
					"h-full bg-card border-l border-border overflow-hidden flex flex-col",
					className,
				)}>
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/80 shrink-0">
					<div className="flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-primary" />
						<h2 className="font-display text-sm font-bold text-foreground">
							AI Assistant
						</h2>
					</div>
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="sm"
							onClick={clearChat}
							className="h-7 w-7 p-0 hover:bg-secondary"
							title="Clear chat">
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={onToggle}
							className="h-7 w-7 p-0 hover:bg-secondary">
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Messages */}
				<div className="flex-1 overflow-y-auto p-4 space-y-4">
					{messages.map((message) => (
						<motion.div
							key={message.id}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							className={cn(
								"flex",
								message.role === "user" ? "justify-end" : "justify-start",
							)}>
							<div
								className={cn(
									"max-w-[85%] rounded-lg px-3 py-2",
									message.role === "user"
										? "bg-primary text-primary-foreground"
										: message.role === "system"
											? "bg-secondary/50 text-muted-foreground text-sm italic"
											: "bg-secondary text-foreground",
								)}>
								<p className="text-sm whitespace-pre-wrap">{message.content}</p>
								{message.diagramGenerated && (
									<div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/10">
										<RotateCcw className="h-3 w-3 text-primary" />
										<span className="text-xs text-primary">
											Diagram updated
										</span>
									</div>
								)}
							</div>
						</motion.div>
					))}

					{isGenerating && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="flex justify-start">
							<div className="bg-secondary rounded-lg px-4 py-3">
								<div className="flex items-center gap-2">
									<Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--warning))]" />
									<span className="text-sm text-muted-foreground">
										Generating diagram...
									</span>
								</div>
							</div>
						</motion.div>
					)}

<div ref={messagesEndRef} />
			</div>

			{/* Preview Modal */}
			<AnimatePresence>
				{showPreview && previewData && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 p-4">
						<motion.div
							initial={{ scale: 0.95, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.95, opacity: 0 }}
							transition={{ duration: 0.15 }}
							className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden"
							style={{ maxHeight: "85vh" }}>
							{/* Header */}
							<div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/60 shrink-0">
								<div>
									<h3 className="text-sm font-semibold text-slate-100">
										Diagram Preview
									</h3>
									<p className="text-xs text-slate-400 mt-0.5">
										{previewData.nodes.length} nodes ·{" "}
										{previewData.edges.length} edges — looks good? Apply it to
										the canvas.
									</p>
								</div>
								<button
									onClick={() => {
										setShowPreview(false)
										setPreviewData(null)
									}}
									className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded">
									<X className="h-4 w-4" />
								</button>
							</div>

							{/* Diagram */}
							<div className="flex-1 min-h-0 bg-slate-950/60" style={{ height: 420 }}>
								<DiagramPreview data={previewData} />
							</div>

							{/* Footer */}
							<div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-700/60 bg-slate-900/80 shrink-0">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										setShowPreview(false)
										setPreviewData(null)
									}}
									className="text-slate-400 hover:text-slate-200">
									Discard
								</Button>
								<Button
									size="sm"
									onClick={() => {
										onFlowchartGenerated(previewData)
										setShowPreview(false)
										setPreviewData(null)
									}}
									className="gap-1.5">
									<Check className="h-3.5 w-3.5" />
									Apply to Canvas
								</Button>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Input Area */}
				<div className="p-4 border-t border-border/50 bg-card/80 shrink-0">
					<div className="relative">
						<Textarea
							ref={textareaRef}
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							onKeyDown={handleKeyDown}
							disabled={isGenerating}
							placeholder="Describe a process or ask for changes..."
							className={cn(
								"min-h-[80px] max-h-[150px] w-full resize-none pr-12",
								"bg-secondary/50 border-border/50",
								"text-foreground placeholder:text-muted-foreground",
								"text-sm p-3 rounded-lg",
								"focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
								"transition-all duration-200",
							)}
						/>
						<Button
							onClick={handleSubmit}
							disabled={isGenerating || !prompt.trim()}
							size="sm"
							className={cn(
								"absolute right-2 bottom-2 h-8 w-8 p-0",
								"bg-primary hover:bg-primary/90",
								"disabled:opacity-50",
							)}>
							{isGenerating ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Send className="h-4 w-4" />
							)}
						</Button>
					</div>
					<p className="text-xs text-muted-foreground mt-2">
						Press Enter to send, Shift+Enter for new line
					</p>
				</div>
			</motion.div>
		</>
	)
}
