import { toast } from "sonner"

// This is a compatibility layer for the old use-toast hook
// It wraps the sonner toast library to provide the same API

export interface ToastProps {
  title?: string
  description?: string
  variant?: "default" | "destructive"
  duration?: number
}

export function useToast() {
  return {
    toast: ({ title, description, variant = "default", duration }: ToastProps) => {
      if (variant === "destructive") {
        toast.error(title || description || "Error", {
          description: title ? description : undefined,
          duration,
        })
      } else {
        toast.success(title || description || "Success", {
          description: title ? description : undefined,
          duration,
        })
      }
    },
  }
}