import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { orderMachine } from '../order-machine'

import type { OrderContext } from '../order-machine'

function makeActor(overrides?: Partial<OrderContext>) {
  return createActor(orderMachine, {
    input: {
      orderId: 'test-order-1',
      paymentMethod: 'ips_qr',
      hasDigitalItems: false,
      hasPhysicalItems: true,
      ...overrides,
    },
  })
}

function getState(actor: ReturnType<typeof makeActor>) {
  const snap = actor.getSnapshot()
  const v = snap.value as Record<string, string>
  return { order: v.order, payment: v.payment, fulfillment: v.fulfillment }
}

// ─── Tok A: IPS QR i kartice ─────────────────────────────────────────────────

describe('Tok A — IPS QR (plaćanje pre slanja)', () => {
  it('početno stanje: open / pending / unfulfilled', () => {
    const actor = makeActor()
    actor.start()
    expect(getState(actor)).toEqual({ order: 'open', payment: 'pending', fulfillment: 'unfulfilled' })
  })

  it('PAYMENT_INITIATED → awaiting', () => {
    const actor = makeActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    expect(getState(actor).payment).toBe('awaiting')
  })

  it('PAYMENT_CONFIRMED → paid; fulfillment ostaje unfulfilled (fizički)', () => {
    const actor = makeActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    actor.send({ type: 'PAYMENT_CONFIRMED' })
    const state = getState(actor)
    expect(state.payment).toBe('paid')
    expect(state.fulfillment).toBe('unfulfilled')
  })

  it('staff kreira fulfillment → fulfillment_created', () => {
    const actor = makeActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    actor.send({ type: 'PAYMENT_CONFIRMED' })
    actor.send({ type: 'FULFILLMENT_CREATED' })
    expect(getState(actor).fulfillment).toBe('fulfillment_created')
  })

  it('SHIPPED → shipped → DELIVERED → fulfilled → order completed', () => {
    const actor = makeActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    actor.send({ type: 'PAYMENT_CONFIRMED' })
    actor.send({ type: 'FULFILLMENT_CREATED' })
    actor.send({ type: 'SHIPPED', trackingNumber: 'RS123456' })
    expect(getState(actor).fulfillment).toBe('shipped')
    expect(actor.getSnapshot().context.trackingNumber).toBe('RS123456')
    actor.send({ type: 'DELIVERED' })
    expect(getState(actor).fulfillment).toBe('fulfilled')
  })

  it('PAYMENT_FAILED → failed', () => {
    const actor = makeActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    actor.send({ type: 'PAYMENT_FAILED' })
    expect(getState(actor).payment).toBe('failed')
  })

  it('PAYMENT_TIMEOUT → failed', () => {
    const actor = makeActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    actor.send({ type: 'PAYMENT_TIMEOUT' })
    expect(getState(actor).payment).toBe('failed')
  })

  it('failed → PAYMENT_INITIATED → awaiting (retry)', () => {
    const actor = makeActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    actor.send({ type: 'PAYMENT_FAILED' })
    actor.send({ type: 'PAYMENT_INITIATED' })
    expect(getState(actor).payment).toBe('awaiting')
  })
})

// ─── Tok B: Pouzeće (COD) ────────────────────────────────────────────────────

describe('Tok B — Pouzeće (COD)', () => {
  function codActor() {
    return makeActor({ paymentMethod: 'cod' })
  }

  it('PAYMENT_INITIATED → cod_pending (ne awaiting)', () => {
    const actor = codActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    expect(getState(actor).payment).toBe('cod_pending')
  })

  it('staff šalje pre naplate: fulfillment_created → shipped', () => {
    const actor = codActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    actor.send({ type: 'FULFILLMENT_CREATED' })
    actor.send({ type: 'SHIPPED', trackingNumber: 'COD-001' })
    const state = getState(actor)
    expect(state.payment).toBe('cod_pending')
    expect(state.fulfillment).toBe('shipped')
  })

  it('COD_CONFIRMED → paid (kurir naplatio)', () => {
    const actor = codActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    actor.send({ type: 'FULFILLMENT_CREATED' })
    actor.send({ type: 'SHIPPED', trackingNumber: 'COD-001' })
    actor.send({ type: 'COD_CONFIRMED' })
    expect(getState(actor).payment).toBe('paid')
  })

  it('kurir vratio → PAYMENT_FAILED → failed', () => {
    const actor = codActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    actor.send({ type: 'FULFILLMENT_CREATED' })
    actor.send({ type: 'SHIPPED', trackingNumber: 'COD-001' })
    actor.send({ type: 'PAYMENT_FAILED' })
    expect(getState(actor).payment).toBe('failed')
  })

  it('otkazivanje pre slanja → voided', () => {
    const actor = codActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    actor.send({ type: 'CANCEL', reason: 'Kupac odustao' })
    expect(getState(actor).payment).toBe('voided')
    expect(actor.getSnapshot().context.cancelReason).toBe('Kupac odustao')
  })
})

// ─── Tok C: Digitalni proizvodi ──────────────────────────────────────────────

describe('Tok C — Digitalni proizvodi (bez slanja)', () => {
  function digitalActor() {
    return makeActor({ paymentMethod: 'ips_qr', hasDigitalItems: true, hasPhysicalItems: false })
  }

  it('PAYMENT_CONFIRMED → auto-fulfill → fulfilled odmah', () => {
    const actor = digitalActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    actor.send({ type: 'PAYMENT_CONFIRMED' })
    const state = getState(actor)
    expect(state.payment).toBe('paid')
    expect(state.fulfillment).toBe('fulfilled')
  })

  it('bez FULFILLMENT_CREATED koraka za digitalne', () => {
    const actor = digitalActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    actor.send({ type: 'PAYMENT_CONFIRMED' })
    // fulfillment je već fulfilled bez ikakvih dodatnih koraka
    expect(getState(actor).fulfillment).toBe('fulfilled')
  })
})

// ─── Otkazivanje i povraćaj posle plaćanja ───────────────────────────────────

describe('Otkazivanje i povraćaj posle plaćanja', () => {
  it('CANCEL posle paid → order cancelled, payment refunded', () => {
    const actor = makeActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    actor.send({ type: 'PAYMENT_CONFIRMED' })
    actor.send({ type: 'CANCEL', reason: 'Kupac se predomislio' })
    const state = getState(actor)
    expect(state.order).toBe('cancelled')
    expect(state.payment).toBe('refunded')
  })

  it('PARTIAL_REFUND_ISSUED → partially_refunded', () => {
    const actor = makeActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    actor.send({ type: 'PAYMENT_CONFIRMED' })
    actor.send({ type: 'PARTIAL_REFUND_ISSUED' })
    expect(getState(actor).payment).toBe('partially_refunded')
  })

  it('REFUND_ISSUED posle partially_refunded → refunded', () => {
    const actor = makeActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    actor.send({ type: 'PAYMENT_CONFIRMED' })
    actor.send({ type: 'PARTIAL_REFUND_ISSUED' })
    actor.send({ type: 'REFUND_ISSUED' })
    expect(getState(actor).payment).toBe('refunded')
  })

  it('otkazivanje pre plaćanja → voided (ne refunded)', () => {
    const actor = makeActor()
    actor.start()
    actor.send({ type: 'PAYMENT_INITIATED' })
    actor.send({ type: 'CANCEL', reason: 'Test' })
    expect(getState(actor).payment).toBe('voided')
  })
})
