import * as React from "react"
import { cn } from "@/lib/utils"
import { Upload } from "lucide-react"

export interface DropzoneProps {
  maxSize?: number
  accept?: Record<string, string[]>
  onDrop?: (files: File[]) => void
  src?: File[] | undefined
  onError?: (error: Error) => void
  className?: string
  children?: React.ReactNode
}

const Dropzone = React.forwardRef<HTMLDivElement, DropzoneProps>(
  ({ className, maxSize, accept, onDrop, src, onError, children, ...props }, ref) => {
    const [isDragOver, setIsDragOver] = React.useState(false)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
    }

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      
      const files = Array.from(e.dataTransfer.files)
      if (onDrop) onDrop(files)
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (onDrop) onDrop(files)
    }

    const handleClick = () => {
      fileInputRef.current?.click()
    }

    return (
      <div
        ref={ref}
        className={cn(
          "relative border border-dashed border-gray-300 rounded-lg p-6 cursor-pointer transition-colors",
          isDragOver && "border-blue-500 bg-blue-50",
          className
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        {...props}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleFileSelect}
        />
        {children}
      </div>
    )
  }
)
Dropzone.displayName = "Dropzone"

const DropzoneEmptyState = ({ className }: { className?: string }) => (
  <div className={cn("text-center", className)}>
    <Upload className="mx-auto h-12 w-12 text-gray-400" />
    <div className="mt-4">
      <p className="text-sm text-gray-600">
        파일을 드래그하여 업로드하거나 클릭하여 선택하세요
      </p>
    </div>
  </div>
)

const DropzoneContent = ({ className }: { className?: string }) => (
  <div className={cn("text-center", className)}>
    <p className="text-sm text-gray-600">파일이 업로드되었습니다</p>
  </div>
)

export { Dropzone, DropzoneEmptyState, DropzoneContent } 