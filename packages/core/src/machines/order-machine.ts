import { createMachine, assign } from 'xstate'
import type { OrderStatus, PaymentStatus, FulfillmentStatus, PaymentMethod } from '../schema/orders'

export type OrderContext = {
  orderId: string
  paymentMethod: PaymentMethod
  hasDigitalItems: boolean
  hasPhysicalItems: boolean
  cancelReason?: string
  trackingNumber?: string
}

export type OrderEvent =
  | { type: 'PAYMENT_INITIATED' }
  | { type: 'PAYMENT_CONFIRMED' }                    // IPS/kartice — webhook potvrda
  | { type: 'COD_CONFIRMED' }                        // Kurir naplatio
  | { type: 'PAYMENT_FAILED' }
  | { type: 'PAYMENT_TIMEOUT' }                       // Auto-cancel
  | { type: 'FULFILLMENT_CREATED' }
  | { type: 'SHIPPED'; trackingNumber: string }
  | { type: 'DELIVERED' }
  | { type: 'CANCEL'; reason?: string }
  | { type: 'REFUND_ISSUED' }
  | { type: 'PARTIAL_REFUND_ISSUED' }

export type OrderState = {
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillmentStatus: FulfillmentStatus
}

// Snapshot koji mašina vraća — koristi se za update u bazi
export type OrderSnapshot = OrderState & {
  cancelReason?: string
  trackingNumber?: string
}

export const orderMachine = createMachine(
  {
    id: 'order',
    type: 'parallel',
    context: ({ input }: { input: OrderContext }) => input,

    states: {
      order: {
        initial: 'open',
        states: {
          open: {
            on: {
              CANCEL: {
                target: 'cancelled',
                actions: assign({ cancelReason: ({ event }) => event.reason }),
              },
            },
          },
          completed: { type: 'final' },
          cancelled: { type: 'final' },
        },
      },

      payment: {
        initial: 'pending',
        states: {
          pending: {
            on: {
              PAYMENT_INITIATED: [
                {
                  guard: ({ context }) => context.paymentMethod === 'cod',
                  target: 'cod_pending',
                },
                { target: 'awaiting' },
              ],
            },
          },
          awaiting: {
            on: {
              PAYMENT_CONFIRMED: { target: 'paid' },
              PAYMENT_FAILED:    { target: 'failed' },
              PAYMENT_TIMEOUT:   { target: 'failed' },
              CANCEL:            { target: 'voided' },
            },
          },
          cod_pending: {
            on: {
              COD_CONFIRMED: { target: 'paid' },
              PAYMENT_FAILED: { target: 'failed' },
              CANCEL:        { target: 'voided' },
            },
          },
          paid: {
            on: {
              PARTIAL_REFUND_ISSUED: { target: 'partially_refunded' },
              REFUND_ISSUED:         { target: 'refunded' },
              CANCEL:                { target: 'refunded' },
            },
          },
          partially_refunded: {
            on: {
              REFUND_ISSUED: { target: 'refunded' },
            },
          },
          refunded: { type: 'final' },
          voided:   { type: 'final' },
          failed: {
            on: {
              PAYMENT_INITIATED: [
                {
                  guard: ({ context }) => context.paymentMethod === 'cod',
                  target: 'cod_pending',
                },
                { target: 'awaiting' },
              ],
            },
          },
        },
      },

      fulfillment: {
        initial: 'unfulfilled',
        states: {
          unfulfilled: {
            on: {
              // IPS/kartice i digitalni: kad je paid
              PAYMENT_CONFIRMED: [
                {
                  guard: ({ context }) => context.hasDigitalItems && !context.hasPhysicalItems,
                  target: 'auto_fulfilling',
                },
              ],
              FULFILLMENT_CREATED: { target: 'fulfillment_created' },
            },
          },
          auto_fulfilling: {
            // Prelazni state za digitalne proizvode
            always: { target: 'fulfilled' },
          },
          fulfillment_created: {
            on: {
              SHIPPED: {
                target: 'shipped',
                actions: assign({ trackingNumber: ({ event }) => event.trackingNumber }),
              },
            },
          },
          partial: {
            on: {
              SHIPPED: {
                target: 'shipped',
                actions: assign({ trackingNumber: ({ event }) => event.trackingNumber }),
              },
            },
          },
          shipped: {
            on: {
              DELIVERED: { target: 'fulfilled' },
            },
          },
          fulfilled: { type: 'final' },
          returned: {},
        },
      },
    },
  },
)

// Helper: izvuci snapshot statusa iz XState actor-a
export function snapshotToOrderState(snapshot: ReturnType<typeof orderMachine.getInitialSnapshot>): OrderSnapshot {
  const orderState = snapshot.value as {
    order: OrderStatus
    payment: PaymentStatus
    fulfillment: FulfillmentStatus
  }
  return {
    status: orderState.order,
    paymentStatus: orderState.payment,
    fulfillmentStatus: orderState.fulfillment,
    cancelReason: snapshot.context.cancelReason,
    trackingNumber: snapshot.context.trackingNumber,
  }
}
