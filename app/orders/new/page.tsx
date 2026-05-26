import { NewOrderForm } from "./NewOrderForm"

export default function NewOrderPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">📋 สร้างคำสั่งใหม่</h1>
      <NewOrderForm />
    </div>
  )
}
