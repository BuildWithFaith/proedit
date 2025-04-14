"use client"

import type React from "react"
import { useEffect, useState } from "react"
import type { ToastOptions } from "react-hot-toast"
import { X, CheckCircle2, XCircle, Loader2 } from "lucide-react"

// Custom toast type
interface CustomToast {
  id: string
  type: "success" | "error" | "loading" | "custom"
  message: React.ReactNode
  createdAt: number
}

// Global store for toasts
let toastStore: CustomToast[] = []
let listeners: Function[] = []

// Notify all listeners when store changes
const notifyListeners = () => {
  listeners.forEach((listener) => listener([...toastStore]))
}

// Add toast to store
const addToast = (newToast: CustomToast) => {
  // If this is an update to an existing toast (same ID), replace it
  if (toastStore.some((t) => t.id === newToast.id)) {
    toastStore = toastStore.map((t) => (t.id === newToast.id ? newToast : t))
  } else {
    // Otherwise add as a new toast
    toastStore = [newToast, ...toastStore]
  }
  notifyListeners()
}

// Remove toast from store
const removeToast = (id: string) => {
  toastStore = toastStore.filter((t) => t.id !== id)
  notifyListeners()
}

// Custom toast component
const Toast = ({ toast, onDismiss }: { toast: CustomToast; onDismiss: () => void }) => {
  const getTypeStyles = () => {
    switch (toast.type) {
      case "success":
        return "bg-green-100 border-green-500 text-green-800"
      case "error":
        return "bg-red-100 border-red-500 text-red-800"
      case "loading":
        return "bg-blue-100 border-blue-500 text-blue-800"
      default:
        return "bg-gray-100 border-gray-300 text-gray-800"
    }
  }

  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
      case "error":
        return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
      case "loading":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
      default:
        return null
    }
  }

  return (
    <div className="transform transition-all duration-300 ease-in-out translate-y-0 opacity-100 mb-2">
      <div
        className={`flex items-center py-2 px-3 border-l-2 rounded shadow-sm ${getTypeStyles()}`}
        style={{ maxWidth: "300px" }}
      >
        <div className="mr-2">{getIcon()}</div>
        <div className="flex-1 text-sm font-medium">{toast.message}</div>
        <button onClick={onDismiss} className="ml-2 text-gray-500 hover:text-gray-700" aria-label="Close toast">
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// Stacked toaster component
export const Toaster = () => {
  const [toasts, setToasts] = useState<CustomToast[]>([])

  useEffect(() => {
    // Subscribe to store changes
    const handleChange = (newToasts: CustomToast[]) => {
      setToasts(newToasts)
    }

    listeners.push(handleChange)

    // Initial state
    setToasts([...toastStore])

    // Cleanup
    return () => {
      listeners = listeners.filter((l) => l !== handleChange)
    }
  }, [])

  // Auto-dismiss toasts after duration
  useEffect(() => {
    const timers = toasts.map((t) => {
      // Don't auto-dismiss loading toasts
      if (t.type === "loading") return undefined

      return setTimeout(() => {
        removeToast(t.id)
      }, 5000) // 5 seconds duration
    })

    return () => {
      timers.forEach((timer) => {
        if (timer) clearTimeout(timer)
      })
    }
  }, [toasts])

  const handleDismiss = (id: string) => {
    removeToast(id)
  }

  // Limit the number of visible toasts to 5
  const visibleToasts = toasts.slice(0, 3)

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {visibleToasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={() => handleDismiss(t.id)} />
      ))}
    </div>
  )
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9)

// Custom toast functions
export const toast = {
  success: (message: string, options?: ToastOptions) => {
    const id = options?.id || generateId()

    addToast({
      id,
      type: "success",
      message,
      createdAt: Date.now(),
    })

    return id
  },

  error: (message: string, options?: ToastOptions) => {
    const id = options?.id || generateId()

    addToast({
      id,
      type: "error",
      message,
      createdAt: Date.now(),
    })

    return id
  },

  loading: (message: string, options?: ToastOptions) => {
    const id = options?.id || generateId()

    addToast({
      id,
      type: "loading",
      message,
      createdAt: Date.now(),
    })

    return id
  },

  custom: (message: React.ReactNode, options?: ToastOptions) => {
    const id = options?.id || generateId()

    addToast({
      id,
      type: "custom",
      message,
      createdAt: Date.now(),
    })

    return id
  },
}
