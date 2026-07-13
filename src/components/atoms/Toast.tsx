import { useEffect, useState } from 'react'

export type ToastVariant = 'success' | 'error' | 'info'

interface ToastProps {
  message: string
  variant?: ToastVariant
  duration?: number
  onClose: () => void
}

export default function Toast({ message, variant = 'success', duration = 2500, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation on next frame
    const enter = requestAnimationFrame(() => setVisible(true))

    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300) // wait for exit animation
    }, duration)

    return () => {
      cancelAnimationFrame(enter)
      clearTimeout(timer)
    }
  }, [duration, onClose])

  const bg = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
  }[variant]

  return (
    <div
      role="status"
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      }`}
    >
      <div className={`${bg} text-white px-6 py-3 rounded-lg shadow-lg text-sm font-medium`}>
        {message}
      </div>
    </div>
  )
}
