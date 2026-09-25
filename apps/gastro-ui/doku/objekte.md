# Objekte

## product.schema.ts

- id: number
- name: string
- description: string
- price: string

## order.schema.ts

- id: number
- tableId: number
- employeeId: number
- table: tableSchema
- employee: employeeSchema
- orderItems: Array (orderItemSchema)

## order-item.schema.ts

- id: number
- orderId: number
- productId: number
- status: orderItemStatusSchema
- product: productSummarySchema

## table.schema.ts

- id: number
- tableNumber: number
- seats: number

## ingredients.schema.ts

- id: number
- name: string
